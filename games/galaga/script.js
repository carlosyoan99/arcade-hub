import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import {
  updateShake,
  getShakeOffset,
  spawnParticles,
  updateParticles,
  drawParticles,
  drawGlow,
  feedbackBundle,
  triggerSquash,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();

/* ============================================================
   GALAGA 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const CW = 800,
  CH = 600,
  CPAD = 20;
const SHIP_Y = CH - 45,
  SHIP_W = 28,
  SHIP_H = 22;
const SHIP_SPEED = 350;
const ENEMY_COLS = 10,
  ENEMY_ROWS = 5;
const ENEMY_W = 24,
  ENEMY_H = 20,
  ENEMY_GAP = 6;
const START_LIVES = 3;
const BULLET_SPEED = 520,
  ENEMY_BULLET_SPEED = 200;
const FIRE_CD = 0.28;

const ROW_POINTS = [150, 100, 80, 60, 40];
const ROW_COLORS = ['#ff6b6b', '#ffa76b', '#ffe066', '#6ee7b7', '#6ec6ff'];

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  score: 0,
  lives: START_LIVES,
  wave: 1,
  best: Number(localStorage.getItem('galaga2d_best') || 0),
  invincibleTimer: 0,
  fireTimer: 0,
};

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('gameCanvas'),
  ctx = canvas.getContext('2d', { alpha: false });
const { w: cw, h: ch, s: sc, x: ox, y: oy } = setupCanvas(canvas, ctx, CW, CH, CPAD);

// ============================================================
// SONIDO (usando shared/audio.js)
// ============================================================
function pFire() {
  beep({ freq: 900, freqEnd: 1400, duration: 0.04, type: 'square', volume: 0.08 });
}
function pExplode() {
  beep({ freq: 200, freqEnd: 40, duration: 0.2, type: 'sawtooth', volume: 0.18 });
}
function pDeath() {
  feedbackBundle('large', ship.x, SHIP_Y, {
    color: '#6ec6ff',
    noFlash: true,
    onBeep: () => beep({ freq: 400, freqEnd: 30, duration: 0.4, type: 'sawtooth', volume: 0.2 }),
  });
}
function pDive() {
  beep({ freq: 220, freqEnd: 400, duration: 0.1, type: 'triangle', volume: 0.1 });
}
function pBonus() {
  [660, 880, 1100, 1320].forEach((ff, i) =>
    setTimeout(() => beep({ freq: ff, duration: 0.08, type: 'triangle', volume: 0.14 }), i * 70),
  );
}
function pWave() {
  beep({ freq: 330, freqEnd: 660, duration: 0.12, type: 'triangle', volume: 0.12 });
}

// ============================================================
// PARTÍCULAS
// ============================================================

// ============================================================
// ENTIDADES
// ============================================================
const ship = { x: CW / 2, y: SHIP_Y };
let enemies = [],
  pBullets = [],
  eBullets = [];
let formationDir = 1,
  formationTimer = 0;
let diving = []; // enemies currently diving
let bonusActive = false,
  bonusTimer = 0;
let diveTimer = 0;
const diveInterval = 2.5;

function buildEnemies() {
  enemies = [];
  const tw = ENEMY_COLS * ENEMY_W + (ENEMY_COLS - 1) * ENEMY_GAP;
  const sx = (CW - tw) / 2 + ENEMY_W / 2;
  for (let r = 0; r < ENEMY_ROWS; r++) {
    for (let co = 0; co < ENEMY_COLS; co++) {
      enemies.push({
        x: sx + co * (ENEMY_W + ENEMY_GAP),
        y: 45 + r * (ENEMY_H + ENEMY_GAP),
        homeX: sx + co * (ENEMY_W + ENEMY_GAP),
        homeY: 45 + r * (ENEMY_H + ENEMY_GAP),
        w: ENEMY_W,
        h: ENEMY_H,
        alive: true,
        row: r,
        col: co,
        color: ROW_COLORS[r],
        points: ROW_POINTS[r],
        diving: false,
      });
    }
  }
  diving = [];
  formationDir = 1;
  diveTimer = diveInterval;
  bonusActive = false;
}

function resetGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.gameOver = false;
  state.wave = 1;
  state.invincibleTimer = 0;
  state.fireTimer = 0;
  state.running = false;
  ship.x = CW / 2;
  pBullets = [];
  eBullets = [];
  buildEnemies();
  document.getElementById('fs').style.display = 'none';
  updateHUD();
}

function startGame() {
  clearSquashes();
  ensureAudio();
  resetGame();
  state.running = true;
  achievements.incrementPlays('galaga');
  startAmbient();
  document.getElementById('overlay').classList.add('hidden');
  document.addEventListener('keydown', trapTab);
  if (state.best >= 2000) achievements.unlock('galaga_twothousand');
  say('Galaga: comenzó la partida. Derribá a los enemigos en formación.');
}

function loseLife() {
  state.lives--;
  pDeath();
  spawnParticles(ship.x, SHIP_Y, '#6ec6ff', 20, { spd: 120, life: 0.6, smx: 5 });
  updateHUD();
  if (state.lives <= 0) {
    endGame();
    return;
  }
  state.invincibleTimer = 2;
  ship.x = CW / 2;
  pBullets = [];
  eBullets = [];
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('galaga2d_best', String(state.best));
  }
  const ot = document.getElementById('ot'),
    fs = document.getElementById('fs'),
    he = document.getElementById('he');
  ot.textContent = '💥 ¡Game Over!' + (state.score >= 5000 ? ' 🏆' : '');
  fs.style.display = 'block';
  fs.textContent = `Puntaje: ${state.score} · Récord: ${state.best}`;
  he.innerHTML = `<kbd>Espacio</kbd> / tocar para empezar · <kbd>R</kbd> reiniciar`;
  document.getElementById('overlay').classList.remove('hidden');
  document.removeEventListener('keydown', trapTab);
  say('Galaga: game over.');
  updateHUD();
}

// ============================================================
// ENTRADA
// ============================================================
const input = { left: false, right: false, fire: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    input.left = true;
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    input.right = true;
  } else if (e.code === 'Space') {
    e.preventDefault();
    if (!state.running) startGame();
    else input.fire = true;
  } else if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  else if (e.code === 'Space') input.fire = false;
});

function bH(id, onDown, onUp) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      el.classList.add('is-pressed');
      onDown();
    },
    { passive: false },
  );
  el.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      el.classList.remove('is-pressed');
      onUp?.();
    },
    { passive: false },
  );
  el.addEventListener('touchcancel', () => {
    el.classList.remove('is-pressed');
    onUp?.();
  });
}
bH(
  'bL',
  () => (input.left = true),
  () => (input.left = false),
);
bH(
  'bR',
  () => (input.right = true),
  () => (input.right = false),
);
const bF = document.getElementById('bF');
bF?.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    bF.classList.add('is-pressed');
    if (!state.running) startGame();
    else input.fire = true;
  },
  { passive: false },
);
bF?.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    bF.classList.remove('is-pressed');
    input.fire = false;
  },
  { passive: false },
);
bF?.addEventListener('touchcancel', () => {
  bF.classList.remove('is-pressed');
  input.fire = false;
});

canvas.addEventListener('pointerdown', () => {
  if (!state.running) startGame();
});
const announce = document.getElementById('announce');
function say(msg) {
  if (announce) announce.textContent = msg;
}
function trapTab(e) {
  if (e.key === 'Tab') e.preventDefault();
}

document.getElementById('overlay').addEventListener('click', () => {
  if (!state.running) startGame();
});

// Gamepad
let gI = null;
const gP = { f: false, s: false };
window.addEventListener('gamepadconnected', (e) => (gI = e.gamepad.index));
window.addEventListener('gamepaddisconnected', (e) => {
  if (gI === e.gamepad.index) gI = null;
});
function pG() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const gp = (gI !== null ? pads[gI] : null) || pads[0];
  if (!gp) return;
  const ax = gp.axes[0] ?? 0;
  input.left = ax < -0.4 || !!gp.buttons[14]?.pressed;
  input.right = ax > 0.4 || !!gp.buttons[15]?.pressed;
  const fH = !!(gp.buttons[0]?.pressed || gp.buttons[2]?.pressed);
  const sH = !!gp.buttons[9]?.pressed;
  if (fH && !gP.f && !state.gameOver) {
    if (!state.running) startGame();
    else input.fire = true;
  }
  if (!fH && gP.f) input.fire = false;
  if (sH && !gP.s && !state.running) startGame();
  gP.f = fH;
  gP.s = sH;
}

// ============================================================
// FÍSICA / LÓGICA
// ============================================================
function updateFormation(dt) {
  if (bonusActive) return;
  const alive = enemies.filter((e) => e.alive && !e.diving);
  if (alive.length === 0) {
    pBonus();
    nextWave();
    return;
  }

  // Side movement
  const speedMult = 1 + (ENEMY_COLS * ENEMY_ROWS - alive.length) * 0.025;
  formationTimer += dt * speedMult;
  const interval = 0.6;
  while (formationTimer >= interval) {
    formationTimer -= interval;
    let hitEdge = false;
    for (const e of alive) {
      e.x += formationDir * 8;
      if (e.x > CW - 30 || e.x < 30) hitEdge = true;
    }
    if (hitEdge) {
      formationDir *= -1;
      for (const e of alive) e.y += 4;
    }
  }

  // Dive timer
  diveTimer -= dt;
  if (diveTimer <= 0 && alive.length > 3) {
    startDive();
    diveTimer = Math.max(0.8, diveInterval - state.wave * 0.08);
  }
}

function startDive() {
  const alive = enemies.filter((e) => e.alive && !e.diving);
  if (alive.length < 2) return;
  const count = Math.min(2, Math.floor(alive.length / 3));
  pDive();
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * alive.length);
    const e = alive[idx];
    e.diving = true;
    diving.push(e);
    alive.splice(idx, 1);
  }
}

function updateDiving(dt) {
  for (let i = diving.length - 1; i >= 0; i--) {
    const e = diving[i];
    const speed = 140 + state.wave * 8;

    // Sine-wave swoop
    const targetX = ship.x;
    const dx = targetX - e.x;
    e.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt * 0.6);
    e.x += Math.sin(Date.now() / 200 + e.col) * 30 * dt;
    e.y += speed * dt;

    // Enemy shoots
    if (Math.random() < 0.008 && e.y > CH * 0.3) {
      eBullets.push({ x: e.x, y: e.y, vy: ENEMY_BULLET_SPEED });
    }

    // If reached bottom, return to formation
    if (e.y > SHIP_Y - 20) {
      // Collision with player
      if (state.invincibleTimer <= 0 && Math.abs(e.x - ship.x) < SHIP_W) {
        loseLife();
      }
      // Return to formation
      e.diving = false;
      e.x = e.homeX;
      e.y = e.homeY;
      diving.splice(i, 1);
      // Add formation offset
      const alive = enemies.filter((en) => en.alive && !en.diving);
      if (alive.length > 0) {
        const avgY = alive.reduce((s, en) => s + en.homeY, 0) / alive.length;
        e.y = avgY + 20;
      }
    }
  }
}

function nextWave() {
  state.wave++;
  pWave();
  buildEnemies();
  // Speed up with each wave

  updateHUD();
}

function updatePlayer(dt) {
  if (state.invincibleTimer > 0) state.invincibleTimer -= dt;
  ship.x += (input.left ? -SHIP_SPEED * dt : 0) + (input.right ? SHIP_SPEED * dt : 0);
  ship.x = Math.max(15, Math.min(CW - 15, ship.x));

  // Fire
  if (state.fireTimer > 0) state.fireTimer -= dt;
  if (input.fire && state.fireTimer <= 0) {
    pBullets.push({ x: ship.x, y: ship.y - 15, vy: -BULLET_SPEED });
    state.fireTimer = FIRE_CD;
    pFire();
  }
}

function updateBullets(dt) {
  // Player bullets
  for (let i = pBullets.length - 1; i >= 0; i--) {
    const b = pBullets[i];

    // Anti-tunneling: sub-pasos para balas rápidas
    const maxStep = BULLET_SPEED * dt;
    const minThickness = ENEMY_W * 0.5; // half enemy width
    if (maxStep > minThickness * 0.4) {
      const steps = Math.ceil(maxStep / (minThickness * 0.3));
      const subDt = dt / steps;
      let hit = false;
      for (let s = 0; s < steps && !hit; s++) {
        b.y += b.vy * subDt;
        if (b.y < 0) {
          pBullets.splice(i, 1);
          hit = true;
          break;
        }
        // Collision check in each sub-step
        for (const e of enemies) {
          if (!e.alive) continue;
          if (Math.abs(b.x - e.x) < ENEMY_W / 2 && Math.abs(b.y - e.y) < ENEMY_H / 2) {
            e.alive = false;
            state.score += e.points;
            pExplode();
            spawnParticles(e.x, e.y, e.color, 12, { spd: 80, life: 0.35 });
            pBullets.splice(i, 1);
            hit = true;
            updateHUD();
            const di = diving.indexOf(e);
            if (di >= 0) diving.splice(di, 1);
            if (enemies.filter((en) => en.alive).length === 0) {
              if (!bonusActive) {
                pBonus();
                nextWave();
              }
            }
            break;
          }
        }
      }
    } else {
      b.y += b.vy * dt;
      if (b.y < 0) {
        pBullets.splice(i, 1);
        continue;
      }

      // Hit enemies
      let hit = false;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (Math.abs(b.x - e.x) < ENEMY_W / 2 && Math.abs(b.y - e.y) < ENEMY_H / 2) {
          e.alive = false;
          state.score += e.points;
          pExplode();
          spawnParticles(e.x, e.y, e.color, 12, { spd: 80, life: 0.35 });
          pBullets.splice(i, 1);
          hit = true;
          updateHUD();
          const di = diving.indexOf(e);
          if (di >= 0) diving.splice(di, 1);
          if (enemies.filter((en) => en.alive).length === 0) {
            if (!bonusActive) {
              pBonus();
              nextWave();
            }
          }
          break;
        }
      }
      if (hit) continue;
    }
  }

  // Enemy bullets
  for (let i = eBullets.length - 1; i >= 0; i--) {
    const b = eBullets[i];
    b.y += b.vy * dt;
    if (b.y > CH + 10) {
      eBullets.splice(i, 1);
      continue;
    }
    if (state.invincibleTimer <= 0 && Math.abs(b.x - ship.x) < 10 && Math.abs(b.y - SHIP_Y) < 15) {
      eBullets.splice(i, 1);
      loseLife();
      break;
    }
  }
}

// ============================================================
// RENDER
// ============================================================
function draw() {
  ctx.clearRect(0, 0, cw, ch);
  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);
  const s = sc,
    cx = ox,
    cy = oy;

  // Background
  const grad = ctx.createRadialGradient(
    cx + (CW * s) / 2,
    cy + (CH * s) / 2,
    0,
    cx + (CW * s) / 2,
    cy + (CH * s) / 2,
    CW * s * 0.7,
  );
  grad.addColorStop(0, '#0d1020');
  grad.addColorStop(1, '#0a0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(cx, cy, CW * s, CH * s);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 89 + 31) % CW,
      y = (i * 143 + 67) % CH;
    ctx.beginPath();
    ctx.arc(cx + x * s, cy + y * s, (0.5 + (i % 2)) * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Border
  ctx.shadowColor = 'rgba(110,231,183,0.06)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(110,231,183,0.1)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(cx, cy, CW * s, CH * s);
  ctx.shadowBlur = 0;

  // Enemies in formation
  for (const e of enemies) {
    if (!e.alive || e.diving) continue;
    const ex = cx + e.x * s,
      ey = cy + e.y * s,
      ew = ENEMY_W * s,
      eh = ENEMY_H * s;
    ctx.fillStyle = e.color;
    drawEnemy(ex, ey, ew, eh);
    drawGlow(ctx, ex, ey, ew * 0.5, e.color, 0.1, 3);
  }

  // Diving enemies
  for (const e of diving) {
    const ex = cx + e.x * s,
      ey = cy + e.y * s,
      ew = ENEMY_W * s,
      eh = ENEMY_H * s;
    ctx.fillStyle = e.color;
    drawEnemy(ex, ey, ew, eh);
    drawGlow(ctx, ex, ey, ew * 0.6, e.color, 0.15, 3.5);
  }

  // Player bullets
  for (const b of pBullets) {
    const bx = cx + b.x * s,
      by = cy + b.y * s;
    ctx.fillStyle = '#ffdd88';
    ctx.fillRect(bx - 1.5 * s, by, 3 * s, 10 * s);
    drawGlow(ctx, bx, by, 3 * s, '#ffdd88', 0.12, 4);
  }

  // Enemy bullets
  for (const b of eBullets) {
    const bx = cx + b.x * s,
      by = cy + b.y * s;
    ctx.fillStyle = '#ff6666';
    ctx.beginPath();
    ctx.arc(bx, by, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, bx, by, 2 * s, '#ff6666', 0.15, 4);
  }

  // Player ship
  if (!state.gameOver) {
    const blink = state.invincibleTimer > 0 && Math.floor(state.invincibleTimer * 8) % 2 === 0;
    if (!blink) {
      const sx = cx + ship.x * s,
        sy = cy + SHIP_Y * s;
      ctx.shadowColor = '#6ec6ff';
      ctx.shadowBlur = 12 * s;
      drawPlayerShip(sx, sy, SHIP_W * s, SHIP_H * s);
      ctx.shadowBlur = 0;
    }
  }

  // Bonus wave indicator
  if (bonusActive) {
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.font = `${18 * s}px 'Courier New',monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⭐ BONUS ⭐', cx + (CW * s) / 2, cy + (CH * s) / 2);
  }

  // Particles
  drawParticles(ctx, ox, oy, sc);
  ctx.restore();
}

function drawEnemy(x, y, w, h) {
  // Body
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.15, w * 0.45, h * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Wings
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y + h * 0.2);
  ctx.lineTo(x - w * 0.6, y + h * 0.5);
  ctx.lineTo(x - w * 0.3, y + h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.2);
  ctx.lineTo(x + w * 0.6, y + h * 0.5);
  ctx.lineTo(x + w * 0.3, y + h * 0.3);
  ctx.closePath();
  ctx.fill();
  // Top antenna
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x - w * 0.08, y - h * 0.15, w * 0.16, h * 0.15);
  // Eyes
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(x - w * 0.15, y - h * 0.05, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * 0.15, y - h * 0.05, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x - w * 0.15, y - h * 0.03, w * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w * 0.15, y - h * 0.03, w * 0.05, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayerShip(x, y, w, h) {
  // Main body
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x - w / 2, y + h / 2);
  ctx.lineTo(x + w / 2, y + h / 2);
  ctx.closePath();
  ctx.fill();
  // Wings
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.1, y);
  ctx.lineTo(x - w * 0.7, y + h * 0.7);
  ctx.lineTo(x - w * 0.4, y + h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y);
  ctx.lineTo(x + w * 0.7, y + h * 0.7);
  ctx.lineTo(x + w * 0.4, y + h * 0.4);
  ctx.closePath();
  ctx.fill();
  // Cockpit
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.2);
  ctx.lineTo(x - w * 0.15, y + h * 0.1);
  ctx.lineTo(x + w * 0.15, y + h * 0.1);
  ctx.closePath();
  ctx.fill();
}

// ============================================================
// HUD
// ============================================================
const scoreEl = document.getElementById('scoreValue'),
  livesEl = document.getElementById('livesValue');
const waveEl = document.getElementById('waveValue'),
  bestEl = document.getElementById('bestValue');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent =
    '●'.repeat(Math.max(0, state.lives)) + '○'.repeat(Math.max(0, START_LIVES - state.lives));
  waveEl.textContent = String(state.wave);
  bestEl.textContent = String(state.best);
}

// ============================================================
// MAIN LOOP
// ============================================================
let animFrameId = null;
let lt = 0;
function tick(t) {
  const dt = Math.min((t - lt) / 1000, 0.05);
  lt = t;
  pG();
  updateShake(dt);

  if (state.running && !state.gameOver) {
    updatePlayer(dt);
    updateFormation(dt);
    updateDiving(dt);
    updateBullets(dt);

    // Check for bonus state (when very few enemies left)
    const aliveCount = enemies.filter((e) => e.alive && !e.diving).length;
    if (aliveCount <= 3 && aliveCount > 0 && !bonusActive) {
      bonusActive = true;
      bonusTimer = 3;
    }
    if (bonusActive) {
      bonusTimer -= dt;
      if (bonusTimer <= 0) bonusActive = false;
    }
  }

  updateSquashes(dt);
  updateParticles(dt);
  draw();
  animFrameId = requestAnimationFrame(tick);
}

resetGame();
updateHUD();

function cleanup() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  document.removeEventListener('keydown', trapTab);
  stopAmbient();
  closeAudio();
}
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);
document.getElementById('loading').classList.add('hidden');
animFrameId = requestAnimationFrame((t) => {
  lt = t;
  tick(t);
});

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
// Help button
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('galaga'));
