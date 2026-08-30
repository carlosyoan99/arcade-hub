import { games } from '../games.js';
import { drawGameThumb } from './hub-cards.js';
import { lsGet, lsSet, lsGetJSON } from '../shared/storage.js';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/* ── Animated canvas background (theme-aware) ── */
const bgCanvas = (function initBg() {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let w,
    h,
    t = 0;
  const stars = [];

  const C = (r, g, b, a = 1) => ({ r, g, b, a });
  const DARK = {
    bg: [C(8, 5, 28), C(12, 9, 34), C(6, 4, 22)],
    neb1: C(0, 240, 255, 0.035),
    neb2: C(255, 45, 120, 0.025),
    neb3: C(255, 184, 0, 0.02),
    grid: C(255, 255, 255, 0.02),
    star: C(255, 255, 255, 0.2),
    starOp: [0.2, 0.7],
  };
  const LIGHT = {
    bg: [C(226, 224, 238), C(232, 230, 242), C(240, 238, 248)],
    neb1: C(80, 180, 255, 0.02),
    neb2: C(200, 80, 200, 0.015),
    neb3: C(200, 160, 60, 0.01),
    grid: C(0, 0, 0, 0.012),
    star: C(0, 0, 0, 0.06),
    starOp: [0.04, 0.12],
  };

  let colors = DARK;
  let curTheme = 'dark';
  const trans = { active: false, from: null, to: null, startTime: 0, duration: 0.4 };

  function lerpColor(c1, c2, t) {
    return {
      r: c1.r + (c2.r - c1.r) * t,
      g: c1.g + (c2.g - c1.g) * t,
      b: c1.b + (c2.b - c1.b) * t,
      a: c1.a + (c2.a - c1.a) * t,
    };
  }

  function rgba(c) {
    return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${c.a})`;
  }

  function lerpPalette(from, to, t) {
    return {
      bg: from.bg.map((c, i) => lerpColor(c, to.bg[i], t)),
      neb1: lerpColor(from.neb1, to.neb1, t),
      neb2: lerpColor(from.neb2, to.neb2, t),
      neb3: lerpColor(from.neb3, to.neb3, t),
      grid: lerpColor(from.grid, to.grid, t),
      star: lerpColor(from.star, to.star, t),
      starOp: [
        from.starOp[0] + (to.starOp[0] - from.starOp[0]) * t,
        from.starOp[1] + (to.starOp[1] - from.starOp[1]) * t,
      ],
    };
  }

  function setTheme(theme, instant) {
    const target = theme === 'dark' ? DARK : LIGHT;
    if (instant || curTheme === theme) {
      colors = target;
      curTheme = theme;
      trans.active = false;
      return;
    }
    trans.active = true;
    trans.from = colors;
    trans.to = target;
    trans.startTime = performance.now();
    curTheme = theme;
  }

  setTheme(document.documentElement.dataset.theme || 'dark', true);

  /* Caché de gradientes radiales: se recrean solo cuando cambian el
     tamaño, la paleta o el centro (cuantizado), no en cada frame. */
  const gradCache = new Map();
  function clearGradientCache() {
    gradCache.clear();
  }
  function cachedGrad(key, x0, y0, r0, x1, y1, r1, stops) {
    let c = gradCache.get(key);
    if (
      !c ||
      c.x0 !== x0 ||
      c.y0 !== y0 ||
      c.r0 !== r0 ||
      c.x1 !== x1 ||
      c.y1 !== y1 ||
      c.r1 !== r1
    ) {
      const g = ctx.createRadialGradient(x0, y0, r0, x1, y1, r1);
      for (const [off, col] of stops) g.addColorStop(off, col);
      c = { x0, y0, r0, x1, y1, r1, grad: g };
      gradCache.set(key, c);
    }
    return c.grad;
  }

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    // Las estrellas se re-generan para cubrir la nueva ventana.
    scatterStars();
    // Los gradientes dependen del tamaño: invalidar la caché.
    clearGradientCache();
  }
  // Debounce del resize: agrupa ráfagas de eventos en un solo frame.
  let resizeRaf = null;
  window.addEventListener('resize', () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      resize();
    });
  });
  resize();

  function scatterStars() {
    stars.length = 0;
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        size: Math.random() * 1.5 + 0.3,
        speed: Math.random() * 0.15 + 0.02,
        seed: Math.random(),
      });
    }
  }
  scatterStars();

  function draw() {
    if (paused) {
      rafId = null;
      return;
    }
    t += 0.003;

    if (trans.active) {
      const elapsed = (performance.now() - trans.startTime) / 1000;
      const p = Math.min(1, elapsed / trans.duration);
      const ease = 1 - Math.pow(1 - p, 3);
      colors = lerpPalette(trans.from, trans.to, ease);
      if (p >= 1) {
        colors = trans.to;
        trans.active = false;
      }
    }

    ctx.clearRect(0, 0, w, h);

    // Deep space gradient (centro animado, tamaño caché según tamaño/paleta)
    ctx.fillStyle = cachedGrad(
      rgba(colors.bg[0]) + '|' + rgba(colors.bg[1]) + '|' + rgba(colors.bg[2]),
      Math.round(w * 0.5 + Math.sin(t * 0.4) * w * 0.2),
      Math.round(h * 0.5 + Math.cos(t * 0.3) * h * 0.15),
      0,
      Math.round(w * 0.5),
      Math.round(h * 0.5),
      Math.round(w * 0.8),
      [
        [0, rgba(colors.bg[0])],
        [0.4, rgba(colors.bg[1])],
        [1, rgba(colors.bg[2])],
      ],
    );
    ctx.fillRect(0, 0, w, h);

    // Nebula glow 1 — cyan
    ctx.fillStyle = cachedGrad(
      rgba(colors.neb1) + '|' + rgba({ ...colors.neb1, a: 0 }),
      Math.round(w * 0.35 + Math.sin(t * 0.2) * w * 0.12),
      Math.round(h * 0.4 + Math.cos(t * 0.25) * h * 0.1),
      0,
      Math.round(w * 0.35),
      Math.round(h * 0.4),
      Math.round(w * 0.35),
      [
        [0, rgba(colors.neb1)],
        [1, rgba({ ...colors.neb1, a: 0 })],
      ],
    );
    ctx.fillRect(0, 0, w, h);

    // Nebula glow 2 — pink neon
    ctx.fillStyle = cachedGrad(
      rgba(colors.neb2) + '|' + rgba({ ...colors.neb2, a: 0 }),
      Math.round(w * 0.7 + Math.cos(t * 0.15) * w * 0.1),
      Math.round(h * 0.65 + Math.sin(t * 0.2) * h * 0.08),
      0,
      Math.round(w * 0.7),
      Math.round(h * 0.65),
      Math.round(w * 0.3),
      [
        [0, rgba(colors.neb2)],
        [1, rgba({ ...colors.neb2, a: 0 })],
      ],
    );
    ctx.fillRect(0, 0, w, h);

    // Nebula glow 3 — gold
    ctx.fillStyle = cachedGrad(
      rgba(colors.neb3) + '|' + rgba({ ...colors.neb3, a: 0 }),
      Math.round(w * 0.2 + Math.sin(t * 0.18) * w * 0.08),
      Math.round(h * 0.8 + Math.cos(t * 0.22) * h * 0.06),
      0,
      Math.round(w * 0.2),
      Math.round(h * 0.8),
      Math.round(w * 0.25),
      [
        [0, rgba(colors.neb3)],
        [1, rgba({ ...colors.neb3, a: 0 })],
      ],
    );
    ctx.fillRect(0, 0, w, h);

    // Grid pattern
    ctx.strokeStyle = rgba(colors.grid);
    ctx.lineWidth = 1;
    const gridSize = 48;
    const offsetX = (t * 8) % gridSize;
    const offsetY = (t * 5) % gridSize;
    for (let x = -gridSize + offsetX; x < w + gridSize; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = -gridSize + offsetY; y < h + gridSize; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Floating stars with theme-aware color
    ctx.fillStyle = rgba(colors.star);
    const [opMin, opMax] = colors.starOp;
    for (const s of stars) {
      const sx = (s.x + t * 4 * s.speed * (s.x / w - 0.5) + w) % w;
      const sy = (s.y + t * 2 * s.speed * (s.y / h - 0.5) + h) % h;
      const baseOp = opMin + s.seed * (opMax - opMin);
      ctx.globalAlpha = baseOp * (0.6 + 0.4 * Math.sin(t * 2 + s.x));
      ctx.beginPath();
      ctx.arc(sx, sy, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    rafId = requestAnimationFrame(draw);
  }

  let paused = false;
  let rafId = null;
  // Pausa/reanuda el bucle: detiene el draw (y cancela el rAF pendiente)
  // para no gastar CPU/batería con un juego abierto encima o en pestaña oculta.
  function setPaused(v) {
    paused = v;
    if (paused) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else if (rafId == null) {
      rafId = requestAnimationFrame(draw);
    }
  }

  rafId = requestAnimationFrame(draw);
  return { setTheme, setPaused };
})();

/* ── Per-game accent colors (matching new palette) ── */
const palette = [
  ['#00f0ff', '#ff2d78'], // Pong      — cyan → pink
  ['#ffb800', '#ff6600'], // Breakout  — gold → orange
  ['#39ff14', '#00cc66'], // Snake     — green
  ['#ff6600', '#ff3300'], // Dino Run  — orange → red
  ['#ff2d78', '#6600ff'], // Asteroids — pink → purple
  ['#00ff44', '#00ccaa'], // S.Invad.  — lime → teal
  ['#ffcc00', '#ff8800'], // Flappy    — gold
  ['#ffdd00', '#ff6600'], // Pac-Man   — yellow
  ['#00ccff', '#0066ff'], // Tetris    — sky blue
  ['#39ff14', '#00cc44'], // Frogger   — green
  ['#00f0ff', '#ff2d78'], // Galaga    — cyan → pink
  ['#39ff14', '#ffb800'], // Centipede — green → gold
  ['#ff6600', '#ffb800'], // Dig Dug   — orange → gold
  ['#ff2d78', '#00f0ff'], // M.Command — pink → cyan
  ['#00f0ff', '#ffb800'], // Neon Nexus— cyan → gold
  ['#ff2d78', '#39ff14'], // Cell Swarm— pink → green
];

function hashId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/* ── Theme toggle ── */
(function initTheme() {
  const saved = lsGet('arcadehub_theme');
  const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '🌙' : '☀️';
    btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.add('theme-transition');
      document.documentElement.dataset.theme = next;
      lsSet('arcadehub_theme', next);
      btn.textContent = next === 'dark' ? '🌙' : '☀️';
      bgCanvas.setTheme(next);
      setTimeout(() => {
        document.documentElement.classList.remove('theme-transition');
      }, 450);
    });
  }
})();

/* ── H1: Split-door entry sequence (first visit) ── */
(function initEntrySequence() {
  const entryOverlay = document.getElementById('entryOverlay');
  const entryGlitch = document.getElementById('entryGlitch');
  const doors = {
    left: document.querySelector('.split-door-left'),
    right: document.querySelector('.split-door-right'),
  };
  const removeDoors = () => {
    doors.left?.remove();
    doors.right?.remove();
  };
  function seenBefore() {
    return !!lsGet('arcadehub_coin_inserted');
  }
  function markSeen() {
    lsSet('arcadehub_coin_inserted', '1');
  }
  if (!entryOverlay) return;
  if (seenBefore()) {
    entryOverlay.remove();
    removeDoors();
    return;
  }

  // Skip if arriving directly to a game via hash (e.g. #game/pong)
  if (window.location.hash.startsWith('#game/')) {
    entryOverlay.remove();
    removeDoors();
    return;
  }

  // H1: Close the doors over the hub
  if (doors.left) doors.left.classList.add('visible');
  if (doors.right) doors.right.classList.add('visible');

  // Mostrar el entry overlay
  entryOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  function playCoinSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1400, ctx.currentTime);
      osc.frequency.setValueAtTime(1800, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    } catch {
      /* el audio es opcional: sin AudioContext seguimos igual */
    }
  }

  function playInsertSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      /* el audio es opcional: sin AudioContext seguimos igual */
    }
  }

  function cleanListeners() {
    events.forEach((ev) => document.removeEventListener(ev, handler, true));
  }

  let dismissed = false;

  // Desmontaje garantizado: bajo ningún escenario (almacenamiento
  // no disponible, audio bloqueado, elementos faltantes) la pantalla
  // de entrada puede quedar trabada sobre el hub.
  function forceLeave() {
    if (!entryOverlay.isConnected) return;
    entryOverlay.remove();
    removeDoors();
    document.body.style.overflow = '';
  }

  function dismissEntry() {
    if (dismissed) return;
    dismissed = true;
    cleanListeners();
    entryOverlay.classList.add('dismissed');
    entryOverlay.setAttribute('aria-hidden', 'true');
    markSeen();
    try {
      playInsertSound();
    } catch {
      /* sin audio la inserción igual procede */
    }
    // H1: Glitch flash → doors slide open revealing the hub.
    // Cada paso es independiente: si uno falla, igual salimos.
    try {
      if (entryGlitch) entryGlitch.classList.add('active');
      if (entryGlitch) {
        setTimeout(() => {
          entryGlitch.classList.remove('active');
          if (doors.left) doors.left.classList.add('open');
          if (doors.right) doors.right.classList.add('open');
          setTimeout(forceLeave, 850);
        }, 100);
      }
    } catch {
      forceLeave();
    }
    // Safety net: pase lo que pase, el overlay desaparece.
    setTimeout(forceLeave, 2500);
  }

  const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
  const handler = (e) => {
    if (dismissed) return;
    if (e.type === 'keydown') {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Tab') return;
    }
    e.preventDefault();
    // El primer gesto del usuario "inserta la moneda": el sonido se emite
    // aquí (gracias al gesto, sin warnings de autoplay), no al cargar.
    try {
      playCoinSound();
    } catch {
      /* sin audio el gesto igual cierra el overlay */
    }
    dismissEntry();
  };
  events.forEach((ev) => document.addEventListener(ev, handler, true));

  setTimeout(() => {
    if (!dismissed) dismissEntry();
  }, 7000);
})();

/* ── Service Worker registration ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ── Animated counter ── */
function animateCounter(el, target, duration = 800) {
  const start = 0;
  const startTime = performance.now();

  function step(now) {
    const p = Math.min(1, (now - startTime) / duration);
    const ease = 1 - Math.pow(1 - p, 3);
    const current = Math.floor(start + (target - start) * ease);
    el.textContent = current;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ── Sort / View state ── */
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const viewGridBtn = document.getElementById('viewGridBtn');
const viewListBtn = document.getElementById('viewListBtn');
const grid = document.getElementById('grid');
const emptyMsg = document.getElementById('empty');

const ready = games.filter((g) => g.status === 'listo');
const pending = games.filter((g) => g.status !== 'listo');

const readyCountEl = document.getElementById('ready-count');
const totalCountEl = document.getElementById('total-count');

// Set initial values first for layout, then animate
readyCountEl.textContent = '0';
totalCountEl.textContent = '0';

// Animate counters after a short delay (hero entrance)
setTimeout(() => {
  animateCounter(readyCountEl, ready.length);
  animateCounter(totalCountEl, games.length);
}, 400);

if (ready.length === 0 && pending.length === 0) {
  emptyMsg.style.display = 'block';
}
const savedSort = lsGet('arcadehub_sort', 'default');
const savedView = lsGet('arcadehub_view', 'grid');
sortSelect.value = savedSort;
if (savedView === 'list') {
  grid.classList.add('list-view');
  viewGridBtn.classList.remove('active');
  viewListBtn.classList.add('active');
}

function sortGames() {
  const sort = sortSelect.value;
  const allGames = [...ready, ...pending];
  const playsData = lsGetJSON('arcadehub_plays', {});

  const creationOrder = {
    'donkey-kong': 19,
    defender: 18,
    joust: 17,
    'neon-nexus': 16,
    'cell-swarm': 15,
    'missile-command': 14,
    digdug: 13,
    centipede: 12,
    galaga: 11,
    frogger: 10,
    tetris: 9,
    pacman: 8,
    'flappy-bird': 7,
    'space-invaders': 6,
    asteroids: 5,
    'dino-runner': 4,
    snake: 3,
    breakout: 2,
    pong: 1,
  };

  switch (sort) {
    case 'name':
      allGames.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'newest':
      allGames.sort((a, b) => (creationOrder[b.id] || 0) - (creationOrder[a.id] || 0));
      break;
    case 'most-played':
      allGames.sort((a, b) => (playsData[b.id] || 0) - (playsData[a.id] || 0));
      break;
    default:
      allGames.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'listo' ? -1 : 1;
        return games.indexOf(a) - games.indexOf(b);
      });
  }
  return allGames;
}

/* ── Hover sound effect ── */
// El audio solo se habilita tras el primer gesto del usuario (pointerdown,
// tecla o touch). Antes, el hover se silencia: crear/resumir un
// AudioContext sin gesto dispara warnings de autoplay en la consola.
let hoverAudioCtx = null;
let lastHoverSound = 0;
let hoverAudioUnlocked = false;
function unlockHoverAudio() {
  hoverAudioUnlocked = true;
  if (!hoverAudioCtx) hoverAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (hoverAudioCtx.state === 'suspended') hoverAudioCtx.resume();
}
window.addEventListener('keydown', unlockHoverAudio, { once: true });
window.addEventListener('pointerdown', unlockHoverAudio, { once: true });
window.addEventListener('touchstart', unlockHoverAudio, { once: true });
function playHoverSound() {
  if (!hoverAudioUnlocked || !hoverAudioCtx) return;
  const now = Date.now();
  if (now - lastHoverSound < 100) return; // throttle
  lastHoverSound = now;
  try {
    if (hoverAudioCtx.state === 'suspended') hoverAudioCtx.resume();
    const osc = hoverAudioCtx.createOscillator();
    const gain = hoverAudioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 660 + Math.random() * 220;
    gain.gain.setValueAtTime(0.04, hoverAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, hoverAudioCtx.currentTime + 0.08);
    osc.connect(gain).connect(hoverAudioCtx.destination);
    osc.start(hoverAudioCtx.currentTime);
    osc.stop(hoverAudioCtx.currentTime + 0.08);
  } catch {
    /* ignore audio errors */
  }
}

function renderCard(game, index, playsData = {}) {
  const isReady = game.status === 'listo';
  const el = document.createElement(isReady ? 'a' : 'div');
  el.className = `card ${isReady ? 'ready' : 'pending'}`;
  el.dataset.gameId = game.id;

  const delay = 0.08 * index;
  el.style.animationDelay = `${delay}s`;

  const idx = hashId(game.id) % palette.length;
  const [glow1, glow2] = palette[idx];
  el.style.setProperty('--card-glow', glow1);
  el.style.setProperty('--card-glow2', glow2);

  if (isReady) {
    el.href = game.file;
    el.addEventListener('mouseenter', playHoverSound);
    el.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      window.location.hash = 'game/' + game.id;
    });
  }

  // Check if game was created within the last 30 days
  const isNew = (() => {
    if (!game.created) return false;
    const created = new Date(game.created);
    const now = new Date();
    const diffDays = (now - created) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30;
  })();

  const plays = playsData[game.id] || 0;
  const playsHtml =
    plays > 0
      ? `<span class="plays-count"><span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" fill="currentColor" stroke="none"/></svg></span> ${plays}</span>`
      : '';
  const newBadgeHtml =
    isReady && isNew
      ? '<span class="new-badge"><span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="none"/></svg></span> Nuevo</span>'
      : '';

  el.innerHTML = `
    ${newBadgeHtml}
    ${
      game.thumbnail
        ? `<canvas class="icon-thumb" role="img" aria-label="${esc(game.title)}"></canvas>`
        : `<span class="icon">${esc(game.icon ?? '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" fill="currentColor" stroke="none"/></svg></span>')}</span>`
    }
    <h2>${esc(game.title)}</h2>
    <p>${esc(game.description)}</p>
    <div class="card-footer">
      <span class="status">${isReady ? 'Jugar' : 'En desarrollo'}</span>
      ${playsHtml}
    </div>
  `;
  const thumbCanvas = el.querySelector('canvas.icon-thumb');
  if (thumbCanvas && !drawGameThumb(thumbCanvas, game.id)) {
    // Sin escena dibujada para este id → SVG clásico como fallback
    const img = document.createElement('img');
    img.className = 'icon-thumb';
    img.src = game.thumbnail;
    img.alt = game.title;
    img.loading = 'lazy';
    thumbCanvas.replaceWith(img);
  }
  return el;
}

function renderGrid() {
  const playsData = lsGetJSON('arcadehub_plays', {});

  const searchTerm = searchInput.value.trim().toLowerCase();
  const sorted = sortGames();

  const filtered = searchTerm
    ? sorted.filter(
        (g) =>
          g.title.toLowerCase().includes(searchTerm) ||
          g.description.toLowerCase().includes(searchTerm),
      )
    : sorted;

  if (filtered.length === 0) {
    emptyMsg.style.display = 'block';
    emptyMsg.textContent = searchTerm
      ? `No se encontraron juegos para "${searchInput.value.trim()}"`
      : 'Todavía no hay juegos listos. Revisá TODO.md para ver qué sigue.';
  } else {
    emptyMsg.style.display = 'none';
  }

  const idsToKeep = new Set(filtered.map((g) => g.id));

  // Cancel any pending exit animation
  if (window._cardExitTimer) {
    clearTimeout(window._cardExitTimer);
    window._cardExitTimer = null;
  }

  const existingCards = Array.from(grid.children).filter((c) => c.classList.contains('card'));

  // Revert card-exit on cards that should stay (user refined search)
  existingCards.forEach((c) => {
    if (c.classList.contains('card-exit') && idsToKeep.has(c.dataset.gameId)) {
      c.classList.remove('card-exit');
    }
  });

  const cardsToRemove = existingCards.filter(
    (c) => !idsToKeep.has(c.dataset.gameId) && !c.classList.contains('card-exit'),
  );

  if (cardsToRemove.length > 0) {
    cardsToRemove.forEach((c) => c.classList.add('card-exit'));
    window._cardExitTimer = setTimeout(() => {
      window._cardExitTimer = null;
      cardsToRemove.forEach((c) => {
        if (c.parentNode) c.parentNode.removeChild(c);
      });
      // Add new cards after removals
      const domIds = new Set(Array.from(grid.children).map((c) => c.dataset.gameId));
      for (const [i, game] of filtered.entries()) {
        if (!domIds.has(game.id)) {
          grid.appendChild(renderCard(game, i, playsData));
          domIds.add(game.id);
        }
      }
      updateSchema(filtered, searchTerm);
    }, 280);
    return;
  }

  // No removals needed — just add new cards
  const domIds = new Set(Array.from(grid.children).map((c) => c.dataset.gameId));
  for (const [i, game] of filtered.entries()) {
    if (!domIds.has(game.id)) {
      grid.appendChild(renderCard(game, i, playsData));
      domIds.add(game.id);
    }
  }

  updateSchema(filtered, searchTerm);
}

function updateSchema(filtered, searchTerm) {
  // Update ItemList schema with current filtered/all games
  document.getElementById('itemlist-schema').textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Juegos de Arcade Hub',
    description: searchTerm
      ? `Resultados de búsqueda para "${searchTerm}"`
      : sortSelect.value === 'most-played'
        ? 'Juegos ordenados por más jugados'
        : 'Todos los juegos clásicos de Arcade Hub',
    numberOfItems: filtered.length,
    itemListElement: filtered.map((g, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'VideoGame',
        name: g.title,
        description: g.description,
        applicationCategory: 'Game',
        operatingSystem: 'Any',
        url: g.file,
      },
    })),
  });
}

renderGrid();

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderGrid, 120);
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchInput.value = '';
    renderGrid();
    searchInput.blur();
  }
});

sortSelect.addEventListener('change', () => {
  lsSet('arcadehub_sort', sortSelect.value);
  renderGrid();
});

function setView(view) {
  if (view === 'list') {
    grid.classList.add('list-view');
    viewGridBtn.classList.remove('active');
    viewListBtn.classList.add('active');
  } else {
    grid.classList.remove('list-view');
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
  }
  lsSet('arcadehub_view', view);
}
viewGridBtn.addEventListener('click', () => setView('grid'));
viewListBtn.addEventListener('click', () => setView('list'));
document.getElementById('surpriseBtn').addEventListener('click', () => {
  if (ready.length === 0) return;
  const pick = ready[Math.floor(Math.random() * ready.length)];
  window.location.hash = 'game/' + pick.id;
});

/* ── Scroll reveal for sections ── */
(function initScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.1, rootMargin: '50px' },
  );
  for (const el of document.querySelectorAll('.section-reveal')) {
    observer.observe(el);
  }
})();

/* ── Achievements panel ── */
function renderAchievements() {
  const achData = lsGetJSON('ach_data', {});
  const achGrid = document.getElementById('achGrid');
  const achCount = document.getElementById('achCount');

  const allAchievements = [
    {
      id: 'pong_first_win',
      icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="6" r="4" fill="currentColor" stroke="none"/><path d="M8 22V18a4 4 0 0 1 8 0v4" fill="currentColor" stroke="none"/></svg></span>',
      name: 'Primera victoria',
      desc: 'Ganá tu primera partida de Pong',
      game: 'Pong',
    },
    {
      id: 'pong_win_streak',
      icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="currentColor" stroke="none"/></svg></span>',
      name: 'Invencible',
      desc: 'Acumulá 5 victorias en Pong',
      game: 'Pong',
    },
    {
      id: 'breakout_thousand',
      icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="6" rx="1" fill="currentColor" stroke="none"/><rect x="3" y="11" width="18" height="6" rx="1" fill="currentColor" stroke="none"/></svg></span>',
      name: 'Rompe-récords',
      desc: 'Alcanzá los 1.000 puntos en Breakout',
      game: 'Breakout',
    },
    {
      id: 'snake_decathlon',
      icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12c0-4 4-8 8-8s8 4 8 8-4 4-8 4-4-4-4-4z" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/></svg></span>',
      name: 'Decatlón',
      desc: 'Alcanzá los 100 puntos en Snake',
      game: 'Snake',
    },
    {
      id: 'dino_century',
      icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4h2v2H8zM6 6h2v4H6zM8 10h8v2H8zM16 6h2v4h-2zM18 4h2v2h-2z" fill="currentColor" stroke="none"/><path d="M6 14h2v6H6zM14 12h2v8h-2z" fill="currentColor" stroke="none"/></svg></span>',
      name: 'Centuria',
      desc: 'Sobreviví 100 segundos en Dino Runner',
      game: 'Dino Runner',
    },
    {
      id: 'asteroid_hunter',
      icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg></span>',
      name: 'Cazador de asteroides',
      desc: 'Destruí 50 asteroides en una partida',
      game: 'Asteroids',
    },
    {
      id: 'flappy_score',
      icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10a4 4 0 0 0-8 0c0 3-2 5-5 6 4 2 7 1 9 0 1 2 4 2 6 0-1-2-2-4-2-6z" fill="currentColor" stroke="none"/></svg></span>',
      name: 'Aleteo constante',
      desc: 'Alcanzá 20 puntos en Flappy Bird',
      game: 'Flappy Bird',
    },
    {
      id: 'pacman_ghost',
      icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 4a6 6 0 0 0-6 6v8h12v-8a6 6 0 0 0-6-6z" fill="currentColor" stroke="none"/><path d="M6 18l-1 4 3-3 3 3 3-3 3 3 3-3 1 4" stroke-width="1.5"/><circle cx="9.5" cy="10" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="14.5" cy="10" r="1.5" fill="var(--bg-mid, #0c0922)" stroke="none"/></svg></span>',
      name: 'Cazafantasmas',
      desc: 'Comé 4 fantasmas en un solo power pellet',
      game: 'Pac-Man',
    },
    {
      id: 'tetris_lines',
      icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4.5v11L12 22l-8-4.5v-11z" fill="currentColor" stroke="none"/><path d="M12 12l8-4.5M12 12l-8-4.5M12 12v10" stroke-width="1.5"/></svg></span>',
      name: 'Tetris maestro',
      desc: 'Completá 30 líneas en una partida',
      game: 'Tetris',
    },
    {
      id: 'frogger_safe',
      icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="14" rx="8" ry="6" fill="currentColor" stroke="none"/><circle cx="8" cy="9" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="9" r="3" fill="currentColor" stroke="none"/><circle cx="8" cy="9" r="1.2" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="16" cy="9" r="1.2" fill="var(--bg-mid, #0c0922)" stroke="none"/></svg></span>',
      name: 'Rana segura',
      desc: 'Llegá a las 5 zonas seguras en Frogger',
      game: 'Frogger',
    },
    {
      id: 'space_commander',
      icon: '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="6" width="8" height="14" rx="4" fill="currentColor" stroke="none"/><circle cx="10" cy="11" r="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><circle cx="14" cy="11" r="1" fill="var(--bg-mid, #0c0922)" stroke="none"/><path d="M6 6l-3-3M18 6l3-3M6 13l-3 2M18 13l3 2M6 17l-3 1M18 17l3 1"/></svg></span>',
      name: 'Comandante espacial',
      desc: 'Destruí los 55 invasores de Space Invaders',
      game: 'Space Invaders',
    },
  ];

  const unlocked = allAchievements.filter((a) => achData[a.id]);
  achCount.textContent = `${unlocked.length} / ${allAchievements.length}`;

  for (const ach of allAchievements) {
    const card = document.createElement('div');
    card.className = `ach-card ${achData[ach.id] ? 'unlocked' : 'locked'}`;
    card.style.animationDelay = `${allAchievements.indexOf(ach) * 0.04}s`;
    card.innerHTML = `
      <div class="ach-icon">${esc(ach.icon)}</div>
      <div class="ach-info">
        <div class="name">${esc(ach.name)}</div>
        <div class="desc">${esc(ach.desc)}</div>
        <div class="game-label">${esc(ach.game)}</div>
      </div>
    `;
    achGrid.appendChild(card);
  }
}
renderAchievements();

/* ── Stats panel ── */
function renderStats() {
  const playsData = lsGetJSON('arcadehub_plays', {});
  const statsGrid = document.getElementById('statsGrid');
  const statSummary = document.getElementById('statSummary');
  const gamesPlayedCount = document.getElementById('gamesPlayedCount');

  const allStats = [];
  let totalPlays = 0;
  for (const g of games) {
    const plays = playsData[g.id] || 0;
    totalPlays += plays;
    allStats.push({ ...g, plays });
  }

  allStats.sort((a, b) => b.plays - a.plays);
  const mostPlayed = allStats[0];
  gamesPlayedCount.textContent = `${totalPlays} jugados`;

  // Summary
  const sumHtml = `
    <div class="sum-item">
      <span class="sum-val">${games.length}</span>
      <span class="sum-label">Juegos</span>
    </div>
    <div class="sum-item">
      <span class="sum-val">${totalPlays}</span>
      <span class="sum-label">Partidas</span>
    </div>
    <div class="sum-item">
      <span class="sum-val">${ready.length}</span>
      <span class="sum-label">Jugables</span>
    </div>
  `;
  statSummary.innerHTML = sumHtml;

  // Top 3 ranking
  const top3 = allStats.slice(0, 3);
  const medals = ['🥇', '🥈', '🥉'];

  // Render top3 section before the grid
  const top3Section = document.createElement('div');
  top3Section.className = 'top3-section';

  if (top3.some((s) => s.plays > 0)) {
    let top3Html =
      '<div class="top3-title"><span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="currentColor" stroke="none"/></svg></span> Más jugados</div><div class="top3-grid">';
    for (const [i, s] of top3.entries()) {
      if (s.plays === 0) break;
      top3Html += `
        <div class="top3-card pos${i + 1}" style="animation-delay:${i * 0.08}s">
          <div class="top3-medal">${medals[i]}</div>
            <div class="top3-info">
            <div class="name">${esc(s.title)}</div>
            <div class="count">${s.plays} ${s.plays === 1 ? 'partida' : 'partidas'}</div>
          </div>
        </div>
      `;
    }
    top3Html += '</div>';
    top3Section.innerHTML = top3Html;
  } else {
    top3Section.innerHTML =
      '<div class="top3-title"><span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="currentColor" stroke="none"/></svg></span> Más jugados</div><div class="top3-empty">Todavía no hay partidas registradas. ¡Elegí un juego y empezá a jugar!</div>';
  }

  statsGrid.parentNode.insertBefore(top3Section, statsGrid);

  for (const [i, s] of allStats.entries()) {
    const card = document.createElement('div');
    card.className = `stat-card${s === mostPlayed && s.plays > 0 ? ' most-played' : ''}`;
    card.style.animationDelay = `${i * 0.03}s`;
    const isMost = s === mostPlayed && s.plays > 0;

    card.innerHTML = `
      <div class="stat-icon${isMost ? ' icon-most' : ''}">
        ${esc(s.icon ?? '<span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" fill="currentColor" stroke="none"/></svg></span>')}
        ${isMost ? '<span class="crown-badge"><span class="icon-svg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z" fill="currentColor" stroke="none"/><path d="M3 20h18" stroke-width="2"/></svg></span></span>' : ''}
      </div>
      <div class="stat-info">
        <div class="name">${esc(s.title)}${isMost ? ' <span class="most-label">MÁS JUGADO</span>' : ''}</div>
        <div class="score${s.plays === 0 ? ' none' : ''}">${s.plays > 0 ? `${s.plays} ${s.plays === 1 ? 'vez' : 'veces'}` : 'Sin jugar'}</div>
        <div class="stat-plays">${s.status === 'listo' ? '✅ Disponible' : '🔧 En desarrollo'}</div>
      </div>
    `;
    statsGrid.appendChild(card);
  }
}
renderStats();

/* ── Hash routing for games ── */
const gameContainer = document.getElementById('gameContainer');
const gameFrame = document.getElementById('gameFrame');

function showGame(game) {
  // Pausa el canvas de fondo: el iframe lo tapa y no tiene sentido dibujar.
  if (bgCanvas.setPaused) bgCanvas.setPaused(true);
  // H6: Staggered page transition
  gameContainer.classList.remove('hidden');
  gameContainer.classList.add('game-entering');
  gameContainer.setAttribute('aria-hidden', 'false');
  // Defer iframe load for smoother transition
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      gameFrame.src = game.file;
      gameContainer.classList.remove('game-entering');
    });
  });
  document.title = 'Arcade Hub — ' + game.icon + ' ' + game.title;
  document.getElementById('og-title').content = 'Arcade Hub — ' + game.icon + ' ' + game.title;
  document.getElementById('og-desc').content = game.description;
  document.getElementById('tw-title').content = 'Arcade Hub — ' + game.icon + ' ' + game.title;
  document.getElementById('tw-desc').content = game.description;
  document.getElementById('game-schema').textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.title,
    description: game.description,
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    browserRequirements: 'HTML5 Canvas',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  });
  document.body.style.overflow = 'hidden';
}

function hideGame() {
  // Reanuda el canvas de fondo al volver al hub.
  if (bgCanvas.setPaused) bgCanvas.setPaused(false);
  // Refresh stats & achievements with fresh localStorage data
  const achGridEl = document.getElementById('achGrid');
  if (achGridEl) {
    achGridEl.innerHTML = '';
    renderAchievements();
  }
  const statsGridEl = document.getElementById('statsGrid');
  if (statsGridEl) {
    statsGridEl.innerHTML = '';
    const top3Old = statsGridEl.parentNode.querySelector('.top3-section');
    if (top3Old) top3Old.remove();
    renderStats();
  }
  // H6: Fade out transition
  gameContainer.classList.add('hidden');
  gameContainer.setAttribute('aria-hidden', 'true');
  // Delay iframe clear to let transition play
  setTimeout(() => {
    gameFrame.src = '';
  }, 400);
  document.title = 'Arcade Hub — 32 juegos clásicos recreados';
  document.getElementById('og-title').content = 'Arcade Hub — 32 juegos clásicos recreados';
  document.getElementById('og-desc').content =
    '32 juegos clásicos de arcade (Pong, Breakout, Snake, Pac-Man, Tetris y más) recreados con estética 2D/2.5D. Un archivo HTML por juego, cero dependencias.';
  document.getElementById('tw-title').content = 'Arcade Hub — 32 juegos clásicos recreados';
  document.getElementById('tw-desc').content =
    '32 juegos clásicos de arcade (Pong, Breakout, Snake, Pac-Man, Tetris y más) recreados con estética 2D/2.5D. Un archivo HTML por juego, cero dependencias.';
  document.getElementById('game-schema').textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: 'Arcade Hub',
    description: 'Seleccioná un juego para empezar a jugar',
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    browserRequirements: 'HTML5 Canvas',
  });
  document.body.style.overflow = '';
  history.replaceState(null, '', window.location.pathname + window.location.search);
}

function handleHash() {
  const match = window.location.hash.match(/^#game\/(.+)$/);
  if (match) {
    const gameId = match[1];
    const game = games.find((g) => g.id === gameId);
    if (game && game.status === 'listo') {
      showGame(game);
    } else {
      window.location.hash = '';
    }
  } else {
    hideGame();
  }
}

window.addEventListener('hashchange', handleHash);
// Pausa el canvas de fondo cuando la pestaña queda en segundo plano y lo
// reanuda al volver, salvo que haya un juego abierto (que ya lo mantiene pausado).
document.addEventListener('visibilitychange', () => {
  if (!bgCanvas || !bgCanvas.setPaused) return;
  if (document.hidden) bgCanvas.setPaused(true);
  else if (!gameFrame.src) bgCanvas.setPaused(false);
});
// La barra superior (Arcade / Fullscreen / Música / Configuración / Ayuda)
// la inyecta cada juego (shared/dom.js + shell.js) dentro del iframe; el
// hub solo gestiona la navegación (Esc/añadir-hash) y el cambio de ruta.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !gameContainer.classList.contains('hidden')) {
    window.location.hash = '';
  }
});

/* ═══════════════════════════════════════════════════
   H4 — SCROLL-AWARE HEADER
   ═══════════════════════════════════════════════════ */
(function initScrollAware() {
  if (matchMedia('(max-width: 600px)').matches) return;
  const hero = document.querySelector('.hero');
  if (!hero) return;
  let lastScroll = 0;
  let ticking = false;

  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          ticking = false;
          const currentScroll = window.scrollY;
          if (currentScroll > 120 && currentScroll > lastScroll + 10) {
            hero.classList.add('hero-hidden');
            hero.classList.remove('hero-visible');
          } else if (currentScroll < lastScroll - 10 || currentScroll < 80) {
            hero.classList.remove('hero-hidden');
            hero.classList.add('hero-visible');
          }
          lastScroll = currentScroll;
        });
        ticking = true;
      }
    },
    { passive: true },
  );
})();

/* ═══════════════════════════════════════════════════
   H5 — MAGNETIC MICRO-INTERACTIONS
   ═══════════════════════════════════════════════════ */
(function initMagnetic() {
  if (matchMedia('(hover: none) and (pointer: coarse)').matches) return;
  const els = document.querySelectorAll('.view-btn, #themeToggle');
  for (const el of els) {
    el.classList.add('magnetic-wrap');
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 80) {
        const pull = (1 - dist / 80) * 6;
        el.style.transform = `translate(${(dx * pull) / 80}px, ${(dy * pull) / 80}px)`;
      } else {
        el.style.transform = '';
      }
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  }
})();

if (window.location.hash) handleHash();
