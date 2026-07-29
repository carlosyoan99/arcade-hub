import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import {
  triggerShake,
  updateShake,
  getShakeOffset,
  spawnParticles,
  updateParticles,
  drawParticles,
  clearParticles,
} from '../../shared/effects.js';
document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';
/* ============================================================
   ASTEROIDS 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   JS organizado: constantes → estado → canvas → sonido → partículas
   → nave → asteroides → balas → entrada → lógica → render → bucle
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const COURT_W = 800;
const COURT_H = 600;
const COURT_PADDING = 20;
const WRAP_MARGIN = 50; // margen extra para wrapping

const ROT_SPEED = 4.5;
const THRUST_POWER = 320;
const FRICTION = 0.992;
const MAX_SPEED = 500;
const BULLET_SPEED = 550;
const BULLET_LIFE = 1.0;
const FIRE_COOLDOWN = 0.15;

const START_LIVES = 3;
const ASTEROID_COUNT = 4;

// Tamaños de asteroides
const ASTEROID_SIZES = [
  { radius: 45, points: 20, label: 'large' },
  { radius: 25, points: 50, label: 'medium' },
  { radius: 13, points: 100, label: 'small' },
];

const INVINCIBLE_TIME = 2.0; // segundos de invulnerabilidad tras perder vida

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  score: 0,
  lives: START_LIVES,
  best: Number(localStorage.getItem('asteroids2d_best') || 0),
  invincibleTimer: 0,
};

// ============================================================
// CANVAS SETUP
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let canvasW = 0,
  canvasH = 0;
let scale = 1;
let offX = 0,
  offY = 0;

function resizeCanvas() {
  canvasW = window.innerWidth;
  canvasH = window.innerHeight;
  canvas.width = canvasW;
  canvas.height = canvasH;
  const sx = (canvasW - COURT_PADDING * 2) / COURT_W;
  const sy = (canvasH - COURT_PADDING * 2) / COURT_H;
  scale = Math.min(sx, sy);
  offX = (canvasW - COURT_W * scale) / 2;
  offY = (canvasH - COURT_H * scale) / 2;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();
// SONIDO (usando shared/audio.js)
function playFireSound() {
  beep({ freq: 800, freqEnd: 1200, duration: 0.05, type: 'square', volume: 0.1 });
}
function playExplosionSound() {
  beep({ freq: 200, freqEnd: 40, duration: 0.2, type: 'sawtooth', volume: 0.18 });
  triggerShake(3);
}
function playThrustSound() {
  beep({ freq: 120, freqEnd: 90, duration: 0.06, type: 'sawtooth', volume: 0.05 });
}
function playDeathSound() {
  triggerShake(8);
  beep({ freq: 300, freqEnd: 30, duration: 0.5, type: 'sawtooth', volume: 0.2 });
}
function playLevelClearSound() {
  [660, 880, 1100].forEach((f, i) =>
    setTimeout(() => beep({ freq: f, duration: 0.1, type: 'triangle', volume: 0.14 }), i * 80),
  );
}

// ============================================================
// PARTÍCULAS
// ============================================================
// ============================================================
// ENTIDADES: Nave, Asteroides, Balas
// ============================================================
const ship = { x: COURT_W / 2, y: COURT_H / 2, vx: 0, vy: 0, angle: -Math.PI / 2 };
let bullets = [];
let asteroids = [];
let fireTimer = 0;

// ============================================================
// WRAP-AROUND
// ============================================================
function wrap(val, min, max) {
  while (val < min) val += max - min;
  while (val >= max) val -= max - min;
  return val;
}
function wrapEntity(e) {
  e.x = wrap(e.x, -WRAP_MARGIN, COURT_W + WRAP_MARGIN);
  e.y = wrap(e.y, -WRAP_MARGIN, COURT_H + WRAP_MARGIN);
}

// ============================================================
// ASTEROIDES
// ============================================================
function spawnAsteroid(x, y, sizeIndex, vx, vy) {
  const sz = ASTEROID_SIZES[sizeIndex];
  const angle = Math.random() * Math.PI * 2;
  const spd = 30 + Math.random() * 60;
  return {
    x,
    y,
    vx: vx ?? Math.cos(angle) * spd,
    vy: vy ?? Math.sin(angle) * spd,
    radius: sz.radius,
    sizeIndex,
    points: sz.points,
    vertices: generateAsteroidVerts(sz.radius),
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 2,
  };
}

function generateAsteroidVerts(radius) {
  const verts = [];
  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = radius * (0.7 + Math.random() * 0.3);
    verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return verts;
}

function spawnAsteroidWave() {
  for (let i = 0; i < ASTEROID_COUNT + Math.floor(state.score / 200); i++) {
    let x, y;
    // Spawn lejos de la nave
    do {
      x = Math.random() * COURT_W;
      y = Math.random() * COURT_H;
    } while (Math.hypot(x - ship.x, y - ship.y) < 150);
    asteroids.push(spawnAsteroid(x, y, 0));
  }
}

function breakAsteroid(a) {
  if (a.sizeIndex < 2) {
    const childSize = a.sizeIndex + 1;
    const spd = 60 + Math.random() * 40;
    for (let i = 0; i < 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      asteroids.push(
        spawnAsteroid(
          a.x,
          a.y,
          childSize,
          Math.cos(angle) * spd + a.vx * 0.5,
          Math.sin(angle) * spd + a.vy * 0.5,
        ),
      );
    }
  }
}

// ============================================================
// BALAS
// ============================================================
function fireBullet() {
  if (fireTimer > 0) return;
  fireTimer = FIRE_COOLDOWN;
  const spread = (Math.random() - 0.5) * 0.05;
  const a = ship.angle + spread;
  bullets.push({
    x: ship.x + Math.cos(ship.angle) * 20,
    y: ship.y + Math.sin(ship.angle) * 20,
    vx: Math.cos(a) * BULLET_SPEED + ship.vx,
    vy: Math.sin(a) * BULLET_SPEED + ship.vy,
    life: BULLET_LIFE,
  });
  playFireSound();
}

// ============================================================
// ENTRADA: TECLADO
// ============================================================
const input = { left: false, right: false, thrust: false, fire: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    input.left = true;
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    input.right = true;
  } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    input.thrust = true;
  } else if (e.code === 'Space') {
    e.preventDefault();
    if (!state.running) startGame();
    else if (!state.gameOver) input.fire = true;
  } else if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') input.thrust = false;
  else if (e.code === 'Space') input.fire = false;
});

// ============================================================
// ENTRADA: TÁCTIL
// ============================================================
function bindHold(id, onDown, onUp) {
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
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onDown();
  });
  el.addEventListener('mouseup', () => onUp?.());
  el.addEventListener('mouseleave', () => onUp?.());
}
bindHold(
  'btnRotL',
  () => {
    input.left = true;
  },
  () => {
    input.left = false;
  },
);
bindHold(
  'btnRotR',
  () => {
    input.right = true;
  },
  () => {
    input.right = false;
  },
);
bindHold(
  'btnThrust',
  () => {
    input.thrust = true;
  },
  () => {
    input.thrust = false;
  },
);
const btnFire = document.getElementById('btnFire');
btnFire?.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    btnFire.classList.add('is-pressed');
    if (!state.running) startGame();
    else if (!state.gameOver) input.fire = true;
  },
  { passive: false },
);
btnFire?.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    btnFire.classList.remove('is-pressed');
    input.fire = false;
  },
  { passive: false },
);
btnFire?.addEventListener('touchcancel', () => {
  btnFire.classList.remove('is-pressed');
  input.fire = false;
});
btnFire?.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (!state.running) startGame();
  else if (!state.gameOver) input.fire = true;
});
btnFire?.addEventListener('mouseup', () => {
  input.fire = false;
});

// Tap en canvas
canvas.addEventListener('pointerdown', (e) => {
  if (!state.running) startGame();
});

// ============================================================
// ENTRADA: GAMEPAD
// ============================================================
let gpIdx = null;
let gpPrev = { fire: false, start: false };
window.addEventListener('gamepadconnected', (e) => {
  gpIdx = e.gamepad.index;
});
window.addEventListener('gamepaddisconnected', (e) => {
  if (gpIdx === e.gamepad.index) gpIdx = null;
});

function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const gp = (gpIdx !== null ? pads[gpIdx] : null) || pads[0];
  if (!gp) return;
  const ax = gp.axes[0] ?? 0;
  const ay = gp.axes[1] ?? 0;
  input.left = !!gp.buttons[14]?.pressed || ax < -0.4;
  input.right = !!gp.buttons[15]?.pressed || ax > 0.4;
  input.thrust = !!gp.buttons[12]?.pressed || ay < -0.4;
  const fireHeld = !!(gp.buttons[0]?.pressed || gp.buttons[2]?.pressed);
  const startHeld = !!(gp.buttons[9]?.pressed || gp.buttons[8]?.pressed);
  if (fireHeld && !gpPrev.fire && !state.gameOver) {
    if (!state.running) startGame();
    else input.fire = true;
  }
  if (!fireHeld && gpPrev.fire) input.fire = false;
  if (startHeld && !gpPrev.start && !state.running) startGame();
  gpPrev = { fire: fireHeld, start: startHeld };
}

// ============================================================
// OVERLAY
// ============================================================
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const hintEl = document.getElementById('hintEl');
const finalScoreEl = document.getElementById('finalScore');
overlay.addEventListener('click', () => {
  if (!state.running) startGame();
});

// ============================================================
// LÓGICA DEL JUEGO
// ============================================================
function resetGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.gameOver = false;
  state.invincibleTimer = 0;
  ship.x = COURT_W / 2;
  ship.y = COURT_H / 2;
  ship.vx = 0;
  ship.vy = 0;
  ship.angle = -Math.PI / 2;
  bullets = [];
  asteroids = [];
  fireTimer = 0;
  finalScoreEl.style.display = 'none';
  spawnAsteroidWave();
  updateHUD();
}

function startGame() {
  ensureAudio();
  startAmbient();
  if (state.best >= 1000) achievements.unlock('asteroids_thousand');
  resetGame();
  state.running = true;
  achievements.incrementPlays('asteroids');
  overlay.classList.add('hidden');
}

function loseLife() {
  state.lives -= 1;
  playDeathSound();
  spawnParticles(ship.x, ship.y, '#6ec6ff', 35, { spd: 150, life: 0.8, smx: 5, friction: 0.97 });
  updateHUD();
  if (state.lives <= 0) {
    endGame();
    return;
  }
  state.invincibleTimer = INVINCIBLE_TIME;
  ship.x = COURT_W / 2;
  ship.y = COURT_H / 2;
  ship.vx = 0;
  ship.vy = 0;
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('asteroids2d_best', String(state.best));
  }
  overlayText.textContent = '💥 ¡Game Over!';
  finalScoreEl.style.display = 'block';
  finalScoreEl.textContent = `Puntos: ${state.score} · Récord: ${state.best}`;
  hintEl.innerHTML = `<kbd>Espacio</kbd> / tocar para empezar  ·  <kbd>R</kbd> reiniciar`;
  overlay.classList.remove('hidden');
  updateHUD();
}

// ============================================================
// FÍSICA / ACTUALIZACIÓN
// ============================================================
function updateShip(dt) {
  if (state.gameOver) return;
  if (state.invincibleTimer > 0) state.invincibleTimer -= dt;

  if (input.left) ship.angle -= ROT_SPEED * dt;
  if (input.right) ship.angle += ROT_SPEED * dt;

  if (input.thrust) {
    ship.vx += Math.cos(ship.angle) * THRUST_POWER * dt;
    ship.vy += Math.sin(ship.angle) * THRUST_POWER * dt;
    if (Math.random() < 0.6)
      spawnParticles(
        ship.x - Math.cos(ship.angle) * 10,
        ship.y - Math.sin(ship.angle) * 10,
        '#ffd700',
        1,
        { spd: 30, life: 0.15, sm: 1, smx: 2 },
      );
  }

  ship.vx *= FRICTION;
  ship.vy *= FRICTION;
  const spd = Math.hypot(ship.vx, ship.vy);
  if (spd > MAX_SPEED) {
    ship.vx = (ship.vx / spd) * MAX_SPEED;
    ship.vy = (ship.vy / spd) * MAX_SPEED;
  }
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  wrapEntity(ship);

  if (input.fire) {
    fireBullet();
  }
  if (fireTimer > 0) fireTimer -= dt;
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    wrapEntity(b);
    if (b.life <= 0) {
      bullets.splice(i, 1);
      continue;
    }
  }
}

function updateAsteroids(dt) {
  for (const a of asteroids) {
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rot += a.rotSpeed * dt;
    wrapEntity(a);
  }
}

function checkCollisions() {
  // Balas vs asteroides
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    for (let ai = asteroids.length - 1; ai >= 0; ai--) {
      const a = asteroids[ai];
      if (Math.hypot(b.x - a.x, b.y - a.y) < a.radius) {
        state.score += a.points;
        playExplosionSound();
        spawnParticles(a.x, a.y, '#6ec6ff', 15, { spd: 100, life: 0.4, friction: 0.97 });
        breakAsteroid(a);
        bullets.splice(bi, 1);
        asteroids.splice(ai, 1);
        updateHUD();
        if (asteroids.length === 0) {
          playLevelClearSound();
          spawnAsteroidWave();
        }
        break;
      }
    }
  }

  // Nave vs asteroides (los asteroides tienen radio ≥20px, nave max 25px/frame — suficiente)
  if (state.invincibleTimer <= 0 && !state.gameOver) {
    for (let ai = asteroids.length - 1; ai >= 0; ai--) {
      const a = asteroids[ai];
      if (Math.hypot(ship.x - a.x, ship.y - a.y) < a.radius + 8) {
        loseLife();
        break;
      }
    }
  }
}

// ============================================================
// RENDER
// ============================================================
function draw() {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);

  const s = scale,
    ox = offX,
    oy = offY,
    cw = COURT_W * s,
    ch = COURT_H * s;

  // Fondo estelar
  const grad = ctx.createRadialGradient(
    ox + cw / 2,
    oy + ch / 2,
    0,
    ox + cw / 2,
    oy + ch / 2,
    cw * 0.7,
  );
  grad.addColorStop(0, '#0d1020');
  grad.addColorStop(1, '#0a0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, cw, ch);

  // Estrellas
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 60; i++) {
    const sx = (i * 97 + 33) % cw;
    const sy = (i * 151 + 77) % ch;
    const r = 0.5 + (i % 3) * 0.5;
    ctx.beginPath();
    ctx.arc(ox + sx, oy + sy, r * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Borde glow
  ctx.shadowColor = 'rgba(110,198,255,0.08)';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = 'rgba(110,198,255,0.15)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(ox, oy, cw, ch);
  ctx.shadowBlur = 0;

  // Asteroides
  for (const a of asteroids) {
    const ax = ox + a.x * s,
      ay = oy + a.y * s;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(a.rot);
    ctx.strokeStyle = 'rgba(180,200,220,0.5)';
    ctx.lineWidth = 2 * s;
    ctx.shadowColor = 'rgba(180,200,220,0.1)';
    ctx.shadowBlur = 8 * s;
    ctx.beginPath();
    for (let i = 0; i < a.vertices.length; i++) {
      const v = a.vertices[i];
      i === 0 ? ctx.moveTo(v.x * s, v.y * s) : ctx.lineTo(v.x * s, v.y * s);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Balas
  for (const b of bullets) {
    const bx = ox + b.x * s,
      by = oy + b.y * s;
    ctx.fillStyle = '#ffdd88';
    ctx.shadowColor = '#ffdd88';
    ctx.shadowBlur = 8 * s;
    ctx.beginPath();
    ctx.arc(bx, by, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Nave
  if (!state.gameOver) {
    const blink = state.invincibleTimer > 0 && Math.floor(state.invincibleTimer * 8) % 2 === 0;
    if (!blink) {
      const nx = ox + ship.x * s,
        ny = oy + ship.y * s;
      const tipX = nx + Math.cos(ship.angle) * 18 * s;
      const tipY = ny + Math.sin(ship.angle) * 18 * s;
      const lx = nx + Math.cos(ship.angle + 2.3) * 14 * s;
      const ly = ny + Math.sin(ship.angle + 2.3) * 14 * s;
      const rx = nx + Math.cos(ship.angle - 2.3) * 14 * s;
      const ry = ny + Math.sin(ship.angle - 2.3) * 14 * s;
      const ex = nx - Math.cos(ship.angle) * 6 * s;
      const ey = ny - Math.sin(ship.angle) * 6 * s;

      ctx.strokeStyle = '#6ec6ff';
      ctx.lineWidth = 2 * s;
      ctx.shadowColor = '#6ec6ff';
      ctx.shadowBlur = 12 * s;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(lx, ly);
      ctx.lineTo(ex, ey);
      ctx.lineTo(rx, ry);
      ctx.closePath();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Llama del motor
      if (input.thrust) {
        const flicker = 0.8 + Math.random() * 0.4;
        const flx = nx - Math.cos(ship.angle) * (14 + 8 * flicker) * s;
        const fly = ny - Math.sin(ship.angle) * (14 + 8 * flicker) * s;
        ctx.fillStyle = `rgba(255,200,50,${0.4 * flicker})`;
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 10 * s;
        ctx.beginPath();
        ctx.moveTo(
          ex - 2 * s * Math.cos(ship.angle + 0.5) * s,
          ey - 2 * s * Math.sin(ship.angle + 0.5) * s,
        );
        ctx.lineTo(flx, fly);
        ctx.lineTo(
          ex + 2 * s * Math.cos(ship.angle - 0.5) * s,
          ey + 2 * s * Math.sin(ship.angle - 0.5) * s,
        );
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  // Partículas
  drawParticles(ctx, offX, offY, scale);
  ctx.restore();
}

// ============================================================
// HUD
// ============================================================
const scoreEl = document.getElementById('scoreValue');
const livesEl = document.getElementById('livesValue');
const bestEl = document.getElementById('bestValue');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent =
    '●'.repeat(Math.max(0, state.lives)) + '○'.repeat(Math.max(0, START_LIVES - state.lives));
  bestEl.textContent = String(state.best);
}

// ============================================================
// BUCLE PRINCIPAL
// ============================================================
let animFrameId = null;
let lastTime = 0;
function tick(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  pollGamepad();
  updateShake(dt);
  if (state.running && !state.gameOver) {
    updateShip(dt);
    updateBullets(dt);
    updateAsteroids(dt);
    checkCollisions();
  }
  updateParticles(dt);
  draw();
  animFrameId = requestAnimationFrame(tick);
}

updateHUD();

function cleanup() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  closeAudio();
}
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);
document.getElementById('loading').classList.add('hidden');
animFrameId = requestAnimationFrame((t) => {
  lastTime = t;
  tick(t);
});

// Game Bar
document.getElementById('hubBtn')?.addEventListener('click', () => {
  window.location.href = '../../index.html';
});
document.getElementById('fsBtn')?.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
});

// Help button
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('asteroids'));
