import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import { createGameLoop } from '../../shared/loop.js';
import {
  triggerShake,
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
  drawGlow,
  feedbackBundle,
  triggerSquash,
  updateSquashes,
  getSquash,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();

document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';

/* ============================================================
   DONKEY KONG — Arcade Hub
   Canvas 2D platformer, sin dependencias.
   ============================================================ */

// ── CONSTANTES ──
const GAME_W = 480;
const GAME_H = 540;
const TILE = 36;

// Plataformas: x, y, w(en tiles), h(en tiles)
const PLATFORMS = [
  { x: 0, y: 0, w: 14, h: 1 }, // techo / top
  { x: 0, y: 12, w: 14, h: 1 }, // suelo
  { x: 1, y: 3, w: 9, h: 1 }, // nivel 1
  { x: 0, y: 6, w: 8, h: 1 }, // nivel 2
  { x: 3, y: 9, w: 9, h: 1 }, // nivel 3
  { x: 4, y: 0.5, w: 6, h: 1 }, // mini plataforma cima
];

// Escaleras: x, y (base), h (en tiles, incluye base)
const LADDERS = [
  { x: 9, y: 3, h: 4 }, // nivel 1 → suelo
  { x: 7, y: 6, h: 4 }, // nivel 2 → nivel 1
  { x: 4, y: 9, h: 4 }, // nivel 3 → nivel 2
  { x: 6, y: 0, h: 4 }, // cima → nivel 3
];

const PLAYER_W = 20;
const PLAYER_H = 28;
const PLAYER_SPEED = 180;
const JUMP_HEIGHT = 3.2 * TILE;
const TIME_TO_APEX = 0.38;
const GRAVITY = (2 * JUMP_HEIGHT) / TIME_TO_APEX ** 2;
const JUMP_VEL = -(2 * JUMP_HEIGHT) / TIME_TO_APEX;
const FALL_GRAVITY = GRAVITY * 1.8;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER = 0.12;

const BARREL_RADIUS = 10;
const BARREL_SPEED = 120;
const MAX_BARRELS = 6;

// ── ESTADO ──
const state = {
  running: false,
  gameOver: false,
  score: 0,
  level: 1,
  lives: 3,
  timeLeft: 60,
};
const player = { x: 0, y: 0, vx: 0, vy: 0, w: PLAYER_W, h: PLAYER_H, onGround: false };
const barrels = [];
let coyoteTimer = 0;
let bufferTimer = 0;
let jumpPressed = false;
let jumpReleased = false;
let timeAcc = 0;

// ── CANVAS SETUP ──
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const {
  w: canvasW,
  h: canvasH,
  s: scale,
  x: offX,
  y: offY,
} = setupCanvas(canvas, ctx, GAME_W, GAME_H, 12);

// ── SONIDOS ──
function playJump() {
  feedbackBundle('medium', player.x + player.w / 2, player.y + player.h, {
    color: '#ff8a65',
    onBeep: () => beep({ freq: 500, freqEnd: 700, duration: 0.08, type: 'square', volume: 0.1 }),
  });
}
function playDeath() {
  feedbackBundle('large', player.x + player.w / 2, player.y, {
    color: '#ff4444',
    noFlash: true,
    onBeep: () => beep({ freq: 200, freqEnd: 80, duration: 0.3, type: 'sawtooth', volume: 0.15 }),
  });
}
function playLevelUp() {
  feedbackBundle('large', GAME_W / 2, TILE * 2, {
    color: '#ffb800',
    noFlash: false,
    onBeep: () => {},
  });
  [660, 880, 1100, 1320].forEach((f, i) =>
    setTimeout(() => beep({ freq: f, duration: 0.1, type: 'triangle', volume: 0.15 }), i * 80),
  );
}

// ── ENTRADA ──
const keys = { left: false, right: false, jump: false };
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'KeyA'].includes(e.code)) {
    e.preventDefault();
    keys.left = true;
  }
  if (['ArrowRight', 'KeyD'].includes(e.code)) {
    e.preventDefault();
    keys.right = true;
  }
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault();
    if (!state.running && !state.gameOver) startGame();
    else {
      jumpPressed = true;
    }
  }
  if (e.code === 'KeyR') {
    e.preventDefault();
    startGame();
  }
});
window.addEventListener('keyup', (e) => {
  if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.left = false;
  if (['ArrowRight', 'KeyD'].includes(e.code)) keys.right = false;
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
    jumpReleased = true;
  }
});

// Táctil
function bindTouch(btnId, onDown, onUp) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      onDown();
      btn.classList.add('is-pressed');
    },
    { passive: false },
  );
  btn.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      onUp();
      btn.classList.remove('is-pressed');
    },
    { passive: false },
  );
  btn.addEventListener('touchcancel', () => {
    onUp();
    btn.classList.remove('is-pressed');
  });
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onDown();
  });
  btn.addEventListener('mouseup', () => {
    onUp();
  });
  btn.addEventListener('mouseleave', () => {
    onUp();
  });
}
bindTouch(
  'btnLeft',
  () => (keys.left = true),
  () => (keys.left = false),
);
bindTouch(
  'btnRight',
  () => (keys.right = true),
  () => (keys.right = false),
);
bindTouch(
  'btnUp',
  () => {
    jumpPressed = true;
  },
  () => {
    jumpReleased = true;
  },
);

// Gamepad
let gamepadIndex = null;
let prevJumpBtn = false;
window.addEventListener('gamepadconnected', (e) => {
  gamepadIndex = e.gamepad.index;
});
window.addEventListener('gamepaddisconnected', (e) => {
  if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
});
function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const gp = (gamepadIndex !== null ? pads[gamepadIndex] : null) || pads[0];
  if (!gp) return;
  const axis = gp.axes[0] ?? 0;
  if (axis < -0.3) keys.left = true;
  else if (!(pads[0]?.axes[0] < -0.3)) keys.left = false;
  if (axis > 0.3) keys.right = true;
  else if (!(pads[0]?.axes[0] > 0.3)) keys.right = false;
  const jumpBtn = !!(gp.buttons[0]?.pressed || gp.buttons[12]?.pressed);
  if (jumpBtn && !prevJumpBtn) {
    if (!state.running && !state.gameOver) startGame();
    else {
      jumpPressed = true;
    }
  }
  if (!jumpBtn && prevJumpBtn) {
    jumpReleased = true;
  }
  prevJumpBtn = jumpBtn;
}

// ── OVERLAY ──
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const hintEl = document.getElementById('hintEl');
const finalScoreEl = document.getElementById('finalScore');
const announce = document.getElementById('announce');

function say(msg) {
  if (announce) announce.textContent = msg;
}
function trapTab(e) {
  if (e.key === 'Tab') e.preventDefault();
}

overlay.addEventListener('click', () => {
  if (!state.running && !state.gameOver) startGame();
});

// ── LÓGICA ──
function initPlayer() {
  player.x = 1.5 * TILE;
  player.y = 11 * TILE - PLAYER_H;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  coyoteTimer = 0;
  bufferTimer = 0;
}

function startGame() {
  clearSquashes();
  ensureAudio();
  startAmbient();
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.level = 1;
  state.lives = 3;
  state.timeLeft = 60;
  timeAcc = 0;
  barrels.length = 0;
  achievements.incrementPlays('donkey-kong');
  initPlayer();
  overlay.classList.add('hidden');
  document.addEventListener('keydown', trapTab);
  say('Donkey Kong: ayudá a Mario a escalar la obra.');
  hintEl.innerHTML =
    '<kbd>←</kbd><kbd>→</kbd> mover · <kbd>Espacio</kbd> / <kbd>↑</kbd> saltar · <kbd>R</kbd> reiniciar';
  updateHUD();
}

function loseLife() {
  playDeath();
  state.lives -= 1;
  if (state.lives <= 0) {
    endGame();
    return;
  }
  initPlayer();
  barrels.length = 0;
  state.timeLeft = Math.max(30, state.timeLeft);
  updateHUD();
}

function endGame() {
  stopAmbient();
  state.running = false;
  state.gameOver = true;
  if (state.score >= 5000) achievements.unlock('dk_thousand');
  if (state.level >= 10) achievements.unlock('dk_master');
  overlayText.textContent = '¡Game Over! 💀';
  finalScoreEl.style.display = 'block';
  finalScoreEl.textContent = `Puntaje: ${state.score} · Nivel: ${state.level}`;
  hintEl.innerHTML = '<kbd>Espacio</kbd> / tocar para reintentar · <kbd>R</kbd> reiniciar';
  overlay.classList.remove('hidden');
  document.removeEventListener('keydown', trapTab);
  say('Donkey Kong: game over.');
  updateHUD();
}

function levelComplete() {
  playLevelUp();
  state.level += 1;
  state.timeLeft = 60;
  timeAcc = 0;
  barrels.length = 0;
  initPlayer();
  if (state.level === 2) achievements.unlock('dk_first_win');
  updateHUD();
}

// ── COLISIONES ──
function rectCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function getPlayerRect() {
  return { x: player.x, y: player.y, w: player.w, h: player.h };
}

function isOnPlatform(r) {
  for (const p of PLATFORMS) {
    const pr = { x: p.x * TILE, y: p.y * TILE, w: p.w * TILE, h: p.h * TILE };
    if (r.x + r.w > pr.x + 2 && r.x < pr.x + pr.w - 2 && Math.abs(r.y + r.h - pr.y) < 6) {
      return pr.y;
    }
  }
  return -1;
}
function canClimbUp(r) {
  for (const l of LADDERS) {
    const lx = l.x * TILE;
    const ly = (l.y - l.h + 1) * TILE;
    if (
      r.x + r.w > lx + 4 &&
      r.x < lx + TILE - 4 &&
      r.y + r.h > ly &&
      r.y + r.h < ly + l.h * TILE &&
      keys.up
    ) {
      return true;
    }
  }
  return false;
}

function getLadderAbove(r) {
  for (const l of LADDERS) {
    const lx = l.x * TILE;
    const ly = (l.y - l.h + 1) * TILE;
    const lh = l.h * TILE;
    if (r.x + r.w > lx + 4 && r.x < lx + TILE - 4 && r.y + r.h > ly && r.y < ly + lh) {
      return { tlx: lx, tly: ly, tlh: lh };
    }
  }
  return null;
}

// ── FÍSICA ──
function updatePlayer(dt) {
  // Input horizontal
  let moveDir = 0;
  if (keys.left) moveDir -= 1;
  if (keys.right) moveDir += 1;
  player.vx = moveDir * PLAYER_SPEED;

  // Coyote time & jump buffer
  if (player.onGround) coyoteTimer = COYOTE_TIME;
  else coyoteTimer -= dt;

  if (jumpPressed) {
    bufferTimer = JUMP_BUFFER;
    jumpPressed = false;
  }
  bufferTimer -= dt;

  // Jump
  if (bufferTimer > 0 && coyoteTimer > 0 && !canClimbUp(getPlayerRect())) {
    player.vy = JUMP_VEL;
    bufferTimer = 0;
    coyoteTimer = 0;
    player.onGround = false;
    playerSquashIdx = triggerSquash(0.2, 0.7, 1.4);
    playJump();
    spawnParticles(player.x + player.w / 2, player.y + player.h, '#ff8a65', 4);
  }

  // Variable jump height
  if (jumpReleased && player.vy < 0) {
    player.vy *= 0.45;
    jumpReleased = false;
  }

  // Gravedad
  const g = player.vy > 0 ? FALL_GRAVITY : GRAVITY;
  player.vy += g * dt;

  // Escaleras: movimiento vertical sin gravedad cuando está en escalera
  const ladderRect = getLadderAbove(getPlayerRect());
  if (ladderRect && keys.up) {
    player.vy = -PLAYER_SPEED * 0.7;
    player.onGround = false;
  }

  // Mover X
  player.x += player.vx * dt;
  player.x = Math.max(0, Math.min(GAME_W - player.w, player.x));

  // Mover Y
  player.y += player.vy * dt;

  // Colisión con plataformas (suelo)
  const pRect = getPlayerRect();
  const platY = isOnPlatform(pRect);
  if (platY >= 0 && player.vy >= 0) {
    player.y = platY - player.h;
    player.vy = 0;
    player.onGround = true;
  } else {
    // Colisión con el suelo del nivel
    if (player.y + player.h > 12 * TILE) {
      player.y = 12 * TILE - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }

  // Caer al vacío
  if (player.y > GAME_H) {
    loseLife();
  }

  // Detectar llegada a la cima
  if (player.y < 1.5 * TILE && player.x > 4 * TILE && player.x < 10 * TILE) {
    levelComplete();
  }

  // Detectar caída de barril (colisión con barriles)
  const pr = getPlayerRect();
  for (let i = barrels.length - 1; i >= 0; i--) {
    const b = barrels[i];
    const br = {
      x: b.x - BARREL_RADIUS,
      y: b.y - BARREL_RADIUS,
      w: BARREL_RADIUS * 2,
      h: BARREL_RADIUS * 2,
    };
    if (rectCollide(pr, br)) {
      loseLife();
      break;
    }
  }
}

function spawnBarrel() {
  barrels.push({
    x: 7 * TILE,
    y: 0.8 * TILE,
    vx: (Math.random() > 0.5 ? 1 : -1) * BARREL_SPEED,
    vy: 0,
  });
}

function updateBarrels(dt) {
  for (let i = barrels.length - 1; i >= 0; i--) {
    const b = barrels[i];
    b.vy += GRAVITY * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // Colisión con plataformas
    let onPlat = false;
    for (const p of PLATFORMS) {
      const pr = { x: p.x * TILE, y: p.y * TILE, w: p.w * TILE, h: p.h * TILE };
      if (
        b.x + BARREL_RADIUS > pr.x &&
        b.x - BARREL_RADIUS < pr.x + pr.w &&
        b.y + BARREL_RADIUS > pr.y &&
        b.y + BARREL_RADIUS < pr.y + pr.h + 8 &&
        b.vy >= 0
      ) {
        b.y = pr.y - BARREL_RADIUS;
        b.vy = 0;
        onPlat = true;
        // Rodar por la plataforma
        if (b.x < pr.x + 8) b.vx = Math.abs(b.vx);
        else if (b.x > pr.x + pr.w - 8) b.vx = -Math.abs(b.vx);
        break;
      }
    }

    // Rebote en bordes de plataforma
    if (!onPlat) {
      for (const p of PLATFORMS) {
        const pr = { x: p.x * TILE, y: p.y * TILE, w: p.w * TILE, h: p.h * TILE };
        if (b.x > pr.x && b.x < pr.x + pr.w && b.y > pr.y && b.y < pr.y + pr.h + 4 && b.vy > 0) {
          b.y = pr.y - BARREL_RADIUS;
          b.vy = 0;
          break;
        }
      }
    }

    // Eliminar barriles que caen al vacío o salen del mapa
    if (b.y > GAME_H + 50 || b.x < -50 || b.x > GAME_W + 50) {
      barrels.splice(i, 1);
    }
  }
}

// ── HUD ──
const scoreEl = document.getElementById('scoreDisplay');
const levelEl = document.getElementById('levelDisplay');
const livesEl = document.getElementById('livesDisplay');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  levelEl.textContent = String(state.level);
  livesEl.textContent = String(state.lives);
}

// ── SQUASH INDEX ──
let playerSquashIdx = -1;

// ── RENDER ──
function draw() {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);
  const s = scale,
    ox = offX,
    oy = offY;

  // Fondo: obra en construcción
  const grad = ctx.createRadialGradient(
    ox + (GAME_W * s) / 2,
    oy + GAME_H * s * 0.3,
    0,
    ox + (GAME_W * s) / 2,
    oy + (GAME_H * s) / 2,
    GAME_W * s * 0.9,
  );
  grad.addColorStop(0, '#1a1520');
  grad.addColorStop(0.6, '#0f0a12');
  grad.addColorStop(1, '#080508');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, GAME_W * s, GAME_H * s);

  // Vigas / estructura de fondo
  ctx.strokeStyle = 'rgba(255,138,101,0.04)';
  ctx.lineWidth = 1 * s;
  for (let i = 0; i < GAME_W / 30; i++) {
    ctx.beginPath();
    ctx.moveTo(ox + i * 30 * s, oy);
    ctx.lineTo(ox + i * 30 * s, oy + GAME_H * s);
    ctx.stroke();
  }

  // Plataformas (vigas)
  for (const p of PLATFORMS) {
    const px = ox + p.x * TILE * s;
    const py = oy + p.y * TILE * s;
    const pw = p.w * TILE * s;
    const ph = p.h * TILE * s;

    // Viga principal
    const g1 = ctx.createLinearGradient(px, py, px, py + ph);
    g1.addColorStop(0, '#ff6600');
    g1.addColorStop(0.5, '#cc5500');
    g1.addColorStop(1, '#994400');
    ctx.fillStyle = g1;
    roundRect(ctx, px, py, pw, ph, 3 * s);
    ctx.fill();

    drawGlow(ctx, px + pw / 2, py + ph / 2, pw * 0.3, 'rgba(255,138,101,0.08)', 0.04, 2.5);

    // Remaches
    ctx.fillStyle = 'rgba(255,200,150,0.25)';
    const rivetSize = 3 * s;
    for (let rx = px + 6 * s; rx < px + pw - 4 * s; rx += TILE * s) {
      ctx.beginPath();
      ctx.arc(rx, py + ph / 2, rivetSize, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Escaleras
  for (const l of LADDERS) {
    const lx = ox + (l.x + 0.3) * TILE * s;
    const ly = oy + (l.y - l.h + 1) * TILE * s;
    const lw = TILE * 0.4 * s;
    const lh = l.h * TILE * s;

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(180,120,80,0.4)';
    ctx.lineWidth = 2 * s;
    // Laterales
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, ly + lh);
    ctx.moveTo(lx + lw, ly);
    ctx.lineTo(lx + lw, ly + lh);
    ctx.stroke();
    // Travesaños
    ctx.strokeStyle = 'rgba(180,120,80,0.25)';
    ctx.lineWidth = 1.5 * s;
    for (let sy = ly + TILE * s * 0.3; sy < ly + lh; sy += TILE * s * 0.4) {
      ctx.beginPath();
      ctx.moveTo(lx, sy);
      ctx.lineTo(lx + lw, sy);
      ctx.stroke();
    }
  }

  // Donkey Kong (en la cima)
  const dkx = ox + 8.2 * TILE * s;
  const dky = oy + 0.2 * TILE * s;
  ctx.shadowColor = 'rgba(139,69,19,0.3)';
  ctx.shadowBlur = 20 * s;
  // Cuerpo (marrón)
  ctx.fillStyle = '#8B4513';
  roundRect(ctx, dkx - 14 * s, dky, 28 * s, 22 * s, 6 * s);
  ctx.fill();
  // Barril que lanza
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#cc4400';
  ctx.beginPath();
  ctx.arc(dkx + 18 * s, dky + 10 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();
  // Ojos
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(dkx - 6 * s, dky + 6 * s, 3 * s, 0, Math.PI * 2);
  ctx.arc(dkx + 6 * s, dky + 6 * s, 3 * s, 0, Math.PI * 2);
  ctx.fill();

  // Barriles
  for (const b of barrels) {
    const bx = ox + b.x * s;
    const by = oy + b.y * s;
    const r = BARREL_RADIUS * s;

    const bg = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, 0, bx, by, r);
    bg.addColorStop(0, '#ff6633');
    bg.addColorStop(0.6, '#cc4400');
    bg.addColorStop(1, '#882200');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();

    drawGlow(ctx, bx, by, r, 'rgba(200,68,0,0.2)', 0.06, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();

    // Aros del barril
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.arc(bx, by, r * 0.65, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Player (Mario)
  const px = ox + player.x * s;
  const py = oy + player.y * s;
  const pw = player.w * s;
  const ph = player.h * s;

  const sq = getSquash(playerSquashIdx);
  if (sq && (sq.sx !== 1 || sq.sy !== 1)) {
    const cx = px + pw / 2;
    const cy = py + ph / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(sq.sx, sq.sy);
    ctx.translate(-cx, -cy);

    // Sombra
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(px + pw / 2, py + ph + 2 * s, pw * 0.5, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo (overalls azules)
    ctx.shadowColor = 'rgba(255,0,0,0.15)';
    ctx.shadowBlur = 10 * s;
    ctx.fillStyle = '#e03030';
    roundRect(ctx, px + 2 * s, py, pw - 4 * s, ph * 0.4, 3 * s);
    ctx.fill();

    ctx.fillStyle = '#3050c0';
    roundRect(ctx, px + 2 * s, py + ph * 0.35, pw - 4 * s, ph * 0.45, 2 * s);
    ctx.fill();

    // Cabeza (skin)
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f5d0a9';
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + ph * 0.15, pw * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Gorra roja
    ctx.fillStyle = '#e03030';
    roundRect(ctx, px + pw * 0.15, py - 1 * s, pw * 0.7, ph * 0.15, 2 * s);
    ctx.fill();

    if (sq && (sq.sx !== 1 || sq.sy !== 1)) {
      ctx.restore();
    }
  }

  // Partículas
  drawParticles(ctx, offX, offY, scale);

  ctx.restore();
}

// ── SPAWN TIMER ──
let barrelSpawnTimer = 0;

// ── BUCLE PRINCIPAL ──
const loop = createGameLoop((dt) => {
  ime;
  pollGamepad();
  updateShake(dt);

  if (state.running && !state.gameOver) {
    updatePlayer(dt);
    updateBarrels(dt);

    // Spawn de barriles
    barrelSpawnTimer -= dt;
    if (barrelSpawnTimer <= 0 && barrels.length < MAX_BARRELS) {
      spawnBarrel();
      barrelSpawnTimer = Math.max(0.8, 2.5 - state.level * 0.15);
    }

    // Timer
    timeAcc += dt;
    if (timeAcc >= 1) {
      state.timeLeft -= 1;
      timeAcc = 0;
      updateHUD();
      if (state.timeLeft <= 0) loseLife();
    }
  }

  updateSquashes(dt);
  updateParticles(dt);
  draw();
});

// ── INIT ──
initPlayer();
updateHUD();

function cleanup() {
  loop.stop();
  document.removeEventListener('keydown', trapTab);
  stopAmbient();
  closeAudio();
}
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);
document.getElementById('loading').classList.add('hidden');
loop.start();

// Game Bar
document.getElementById('hubBtn')?.addEventListener('click', () => {
  if (window.self !== window.top) {
    window.top.location.hash = '';
  } else {
    window.location.href = '../../index.html';
  }
});
document.getElementById('fsBtn')?.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
});
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('donkey-kong'));
