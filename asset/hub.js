import { games } from '../games.js';
import { drawGameThumb } from './hub-cards.js';
import { lsGet, lsSet, lsGetJSON } from '../shared/storage.js';
import { icons } from '../shared/icons.js';

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/* ── Fondo estático: sin canvas animado ni rAF ──
   El color de fondo lo define hub.css; este objeto conserva la interfaz
   que el resto del módulo usa (setTheme / setPaused) como operaciones
   inocuas para no romper el cambio de tema ni la navegación al iframe. */
const bgCanvas = { setTheme() {}, setPaused() {} };

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

/* ── Pantalla de entrada (solo la primera visita) ──
   Una línea de texto, sin puertas ni glitch. Mantiene el contrato que
   comprueban los tests: aria-hidden, clase 'dismissed', cierre por gesto
   y auto-cierre. El sonido solo se emite tras un gesto real del usuario. */
(function initEntrySequence() {
  const entryOverlay = document.getElementById('entryOverlay');
  if (!entryOverlay) return;

  const seenBefore = () => !!lsGet('arcadehub_coin_inserted');
  const markSeen = () => lsSet('arcadehub_coin_inserted', '1');

  if (seenBefore() || window.location.hash.startsWith('#game/')) {
    entryOverlay.remove();
    return;
  }

  entryOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  function playSound(freq, endFreq, duration) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      /* el audio es opcional */
    }
  }

  let dismissed = false;
  function forceLeave() {
    if (entryOverlay.isConnected) entryOverlay.remove();
    document.body.style.overflow = '';
  }
  function dismissEntry(byGesture) {
    if (dismissed) return;
    dismissed = true;
    events.forEach((ev) => document.removeEventListener(ev, handler, true));
    entryOverlay.classList.add('dismissed');
    entryOverlay.setAttribute('aria-hidden', 'true');
    markSeen();
    if (byGesture) playSound(1400, 200, 0.2);
    setTimeout(forceLeave, 220);
  }

  const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
  const handler = (e) => {
    if (dismissed) return;
    if (e.type === 'keydown') {
      if (e.ctrlKey || e.metaKey || e.altKey || e.key === 'Tab') return;
    }
    e.preventDefault();
    dismissEntry(true);
  };
  events.forEach((ev) => document.addEventListener(ev, handler, true));
  setTimeout(() => dismissEntry(false), 7000);
})();

/* ── Service Worker registration ── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

/* ── Animated counter ── */
function animateCounter(el, target, duration = 800) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = target;
    return;
  }
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
  viewGridBtn.setAttribute('aria-pressed', 'false');
  viewListBtn.setAttribute('aria-pressed', 'true');
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

function renderCard(game, playsData = {}) {
  const isReady = game.status === 'listo';
  const el = document.createElement(isReady ? 'a' : 'div');
  el.className = `card ${isReady ? 'ready' : 'pending'}`;
  el.dataset.gameId = game.id;

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
      ? `<span class="plays-count"><span class="icon-svg">${icons.gamepad}</span> ${plays}</span>`
      : '';
  const newBadgeHtml =
    isReady && isNew
      ? `<span class="new-badge"><span class="icon-svg">${icons.star}</span> Nuevo</span>`
      : '';

  const fallbackIcon = `<span class="icon-svg">${icons.gamepad}</span>`;
  el.innerHTML = `
    ${newBadgeHtml}
    ${
      game.thumbnail
        ? `<canvas class="icon-thumb" role="img" aria-label="${esc(game.title)}"></canvas>`
        : `<span class="icon">${esc(game.icon ?? fallbackIcon)}</span>`
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
      for (const game of filtered) {
        if (!domIds.has(game.id)) {
          grid.appendChild(renderCard(game, playsData));
          domIds.add(game.id);
        }
      }
      updateSchema(filtered, searchTerm);
    }, 280);
    return;
  }

  // No removals needed — just add new cards
  const domIds = new Set(Array.from(grid.children).map((c) => c.dataset.gameId));
  for (const game of filtered) {
    if (!domIds.has(game.id)) {
      grid.appendChild(renderCard(game, playsData));
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

  // Un único anuncio por cambio, sin bombardear al lector de pantalla.
  const status = document.getElementById('hub-status');
  if (status) {
    status.textContent = searchTerm
      ? `${filtered.length} ${filtered.length === 1 ? 'juego encontrado' : 'juegos encontrados'}`
      : `${ready.length} de ${games.length} juegos disponibles`;
  }
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
    viewGridBtn.setAttribute('aria-pressed', 'false');
    viewListBtn.setAttribute('aria-pressed', 'true');
  } else {
    grid.classList.remove('list-view');
    viewGridBtn.classList.add('active');
    viewListBtn.classList.remove('active');
    viewGridBtn.setAttribute('aria-pressed', 'true');
    viewListBtn.setAttribute('aria-pressed', 'false');
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

/* ── Achievements panel ── */
function renderAchievements() {
  const achData = lsGetJSON('ach_data', {});
  const achGrid = document.getElementById('achGrid');
  const achCount = document.getElementById('achCount');

  const allAchievements = [
    {
      id: 'pong_first_win',
      icon: `<span class="icon-svg">${icons.pawn}</span>`,
      name: 'Primera victoria',
      desc: 'Ganá tu primera partida de Pong',
      game: 'Pong',
    },
    {
      id: 'pong_win_streak',
      icon: `<span class="icon-svg">${icons.trophy}</span>`,
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
      icon: `<span class="icon-svg">${icons.snake}</span>`,
      name: 'Decatlón',
      desc: 'Alcanzá los 100 puntos en Snake',
      game: 'Snake',
    },
    {
      id: 'dino_century',
      icon: `<span class="icon-svg">${icons.dino}</span>`,
      name: 'Centuria',
      desc: 'Sobreviví 100 segundos en Dino Runner',
      game: 'Dino Runner',
    },
    {
      id: 'asteroid_hunter',
      icon: `<span class="icon-svg">${icons.rocket}</span>`,
      name: 'Cazador de asteroides',
      desc: 'Destruí 50 asteroides en una partida',
      game: 'Asteroids',
    },
    {
      id: 'flappy_score',
      icon: `<span class="icon-svg">${icons.bird}</span>`,
      name: 'Aleteo constante',
      desc: 'Alcanzá 20 puntos en Flappy Bird',
      game: 'Flappy Bird',
    },
    {
      id: 'pacman_ghost',
      icon: `<span class="icon-svg">${icons.ghost}</span>`,
      name: 'Cazafantasmas',
      desc: 'Comé 4 fantasmas en un solo power pellet',
      game: 'Pac-Man',
    },
    {
      id: 'tetris_lines',
      icon: `<span class="icon-svg">${icons.cube}</span>`,
      name: 'Tetris maestro',
      desc: 'Completá 30 líneas en una partida',
      game: 'Tetris',
    },
    {
      id: 'frogger_safe',
      icon: `<span class="icon-svg">${icons.frog}</span>`,
      name: 'Rana segura',
      desc: 'Llegá a las 5 zonas seguras en Frogger',
      game: 'Frogger',
    },
    {
      id: 'space_commander',
      icon: `<span class="icon-svg">${icons.bug}</span>`,
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
    let top3Html = `<div class="top3-title"><span class="icon-svg">${icons.trophy}</span> Más jugados</div><div class="top3-grid">`;
    for (const [i, s] of top3.entries()) {
      if (s.plays === 0) break;
      top3Html += `
        <div class="top3-card pos${i + 1}">
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
    top3Section.innerHTML = `<div class="top3-title"><span class="icon-svg">${icons.trophy}</span> Más jugados</div><div class="top3-empty">Todavía no hay partidas registradas. ¡Elegí un juego y empezá a jugar!</div>`;
  }

  statsGrid.parentNode.insertBefore(top3Section, statsGrid);

  for (const [i, s] of allStats.entries()) {
    const card = document.createElement('div');
    card.className = `stat-card${s === mostPlayed && s.plays > 0 ? ' most-played' : ''}`;
    card.style.animationDelay = `${i * 0.03}s`;
    const isMost = s === mostPlayed && s.plays > 0;

    const fallbackIcon = `<span class="icon-svg">${icons.gamepad}</span>`;
    card.innerHTML = `
      <div class="stat-icon${isMost ? ' icon-most' : ''}">
        ${esc(s.icon ?? fallbackIcon)}
        ${isMost ? `<span class="crown-badge"><span class="icon-svg">${icons.crown}</span></span>` : ''}
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
  bgCanvas.setPaused(true);
  gameContainer.classList.remove('hidden');
  gameContainer.classList.add('game-entering');
  gameContainer.setAttribute('aria-hidden', 'false');
  gameFrame.title = game.title;
  // Diferir la carga un frame para que la transición se vea primero.
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
  bgCanvas.setPaused(false);
  gameFrame.title = 'Juego';
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

if (window.location.hash) handleHash();
