import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import {
  triggerShake,
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
} from '../../shared/effects.js';
document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';
/* ============================================================
   FLAPPY BIRD 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const CW = 600,
  CH = 500,
  CPAD = 20;
const GRAVITY = 1200;
const FLAP_VEL = -380;
const PIPE_W = 50;
const PIPE_GAP = 140;
const PIPE_SPEED = 200;
const PIPE_SPAWN_INTERVAL = 1.6;
const BIRD_X = 150;
const GROUND_H = 30;

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  score: 0,
  best: Number(localStorage.getItem('flappy2d_best') || 0),
};

// ============================================================
// CANVAS
// ============================================================
const c = document.getElementById('gc'),
  ctx = c.getContext('2d', { alpha: false });
let cw = 0,
  ch = 0,
  sc = 1,
  ox = 0,
  oy = 0;
function resize() {
  const dpr = window.devicePixelRatio || 1;
  cw = window.innerWidth;
  ch = window.innerHeight;
  c.width = cw * dpr;
  c.height = ch * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sx = (cw - CPAD * 2) / CW,
    sy = (ch - CPAD * 2) / CH;
  sc = Math.min(sx, sy);
  ox = (cw - CW * sc) / 2;
  oy = (ch - CH * sc) / 2;
}
window.addEventListener('resize', resize);
resize();

// SONIDO (usando shared/audio.js)
function pFlap() {
  beep({ freq: 500, freqEnd: 700, duration: 0.08, type: 'triangle', volume: 0.14 });
}
function pScore() {
  beep({ freq: 600, freqEnd: 900, duration: 0.1, type: 'square', volume: 0.12 });
  triggerShake(2);
}
function pHit() {
  triggerShake(6);
  beep({ freq: 200, freqEnd: 50, duration: 0.35, type: 'sawtooth', volume: 0.2 });
}
function pBest() {
  [660, 880, 1100, 1320].forEach((ff, i) =>
    setTimeout(() => beep({ freq: ff, duration: 0.1, type: 'triangle', volume: 0.16 }), i * 90),
  );
}

// ============================================================
// ENTIDADES
// ============================================================
const bird = { y: CH / 2, vy: 0, rot: 0, wingPhase: 0 };
let pipes = [];
let pipeTimer = 0;

function resetGame() {
  state.score = 0;
  state.gameOver = false;
  bird.y = CH / 2;
  bird.vy = 0;
  bird.rot = 0;
  bird.wingPhase = 0;
  pipes = [];
  pipeTimer = 1.2;
  document.getElementById('fs').style.display = 'none';
  updateHUD();
}

function startGame() {
  ensureAudio();
  resetGame();
  state.running = true;
  achievements.incrementPlays('flappy-bird');
  document.getElementById('overlay').classList.add('hidden');
  document.addEventListener('keydown', trapTab);
  if (state.best >= 10) achievements.unlock('flappy_decathlon');
  say('Flappy Bird: comenzó la partida.');
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  const isBest = state.score > state.best;
  if (isBest) {
    state.best = state.score;
    localStorage.setItem('flappy2d_best', String(state.best));
    pHit();
    pBest();
    if (state.best >= 10) achievements.unlock('flappy_decathlon');
  } else pHit();
  const ot = document.getElementById('ot'),
    fs = document.getElementById('fs'),
    he = document.getElementById('he');
  ot.textContent = isBest ? '🏆 ¡Nuevo récord!' : '💥 ¡Chocaste!';
  fs.style.display = 'block';
  fs.textContent = `Puntaje: ${state.score} · Récord: ${state.best}`;
  he.innerHTML = `<kbd>Espacio</kbd> / tocar para empezar · <kbd>R</kbd> reiniciar`;
  document.getElementById('overlay').classList.remove('hidden');
  document.removeEventListener('keydown', trapTab);
  say(isBest ? 'Flappy Bird: nuevo récord.' : 'Flappy Bird: chocaste.');
  updateHUD();
}

function flap() {
  if (!state.running || state.gameOver) return;
  bird.vy = FLAP_VEL;
  pFlap();
  spawnParticles(BIRD_X, bird.y, '#ffcc44', 6, { spd: 60, life: 0.3, sm: 1.5, smx: 2.5 });
}

// ============================================================
// FÍSICA
// ============================================================
function updateBird(dt) {
  bird.vy += GRAVITY * dt;
  bird.y += bird.vy * dt;

  // Rotación basada en velocidad
  const targetRot = bird.vy > 0 ? Math.min(bird.vy * 0.003, 0.8) : Math.max(bird.vy * 0.003, -0.4);
  bird.rot += (targetRot - bird.rot) * Math.min(1, dt * 8);

  // Alas
  bird.wingPhase += dt * 8;

  // Límite superior
  if (bird.y < 0) {
    bird.y = 0;
    bird.vy = 0;
  }
}

function spawnPipe() {
  const minY = 60;
  const maxY = CH - PIPE_GAP - GROUND_H - 60;
  const gapY = minY + Math.random() * (maxY - minY);
  pipes.push({
    x: CW + PIPE_W,
    gapY: gapY,
    passed: false,
  });
}

function updatePipes(dt) {
  pipeTimer -= dt;
  if (pipeTimer <= 0) {
    spawnPipe();
    pipeTimer = PIPE_SPAWN_INTERVAL * (0.8 + Math.random() * 0.4);
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= PIPE_SPEED * dt;

    // Score al pasar
    if (!p.passed && p.x + PIPE_W < BIRD_X) {
      p.passed = true;
      state.score++;
      pScore();
      spawnParticles(BIRD_X + 20, bird.y - 10, '#ffcc44', 8, { spd: 80, life: 0.4, sm: 2, smx: 3 });
      updateHUD();
    }

    if (p.x + PIPE_W < -20) {
      pipes.splice(i, 1);
    }
  }
}

function checkCollisions() {
  const bx = BIRD_X,
    by = bird.y;
  const br = 10; // radio del pájaro
  const groundY = CH - GROUND_H;

  for (const p of pipes) {
    // Tubo superior (de 0 a gapY)
    if (bx + br > p.x && bx - br < p.x + PIPE_W) {
      if (by - br < p.gapY || by + br > p.gapY + PIPE_GAP) {
        endGame();
        return;
      }
    }
  }

  // Suelo
  if (by + br > groundY) {
    endGame();
  }
}

// ============================================================
// ENTRADA
// ============================================================

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (!state.running) startGame();
    else flap();
  }
  if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
  }
});

const bF = document.getElementById('bF');
bF?.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    bF.classList.add('is-pressed');
    if (!state.running) startGame();
    else flap();
  },
  { passive: false },
);
bF?.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    bF.classList.remove('is-pressed');
  },
  { passive: false },
);
bF?.addEventListener('touchcancel', () => bF.classList.remove('is-pressed'));
bF?.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (!state.running) startGame();
  else flap();
});

document.getElementById('gc').addEventListener('pointerdown', () => {
  if (!state.running) startGame();
  else flap();
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
const gP = { f: false };
window.addEventListener('gamepadconnected', (e) => (gI = e.gamepad.index));
window.addEventListener('gamepaddisconnected', (e) => {
  if (gI === e.gamepad.index) gI = null;
});
function pG() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const gp = (gI !== null ? pads[gI] : null) || pads[0];
  if (!gp) return;
  const fH = !!(
    gp.buttons[0]?.pressed ||
    gp.buttons[1]?.pressed ||
    gp.buttons[2]?.pressed ||
    gp.buttons[3]?.pressed ||
    gp.buttons[12]?.pressed
  );
  const sH = !!(gp.buttons[9]?.pressed || gp.buttons[8]?.pressed);
  if (fH && !gP.f) {
    if (!state.running) startGame();
    else flap();
  }
  if (sH && !gP.s && !state.running) startGame();
  gP.f = fH;
  gP.s = sH;
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
    cy = oy,
    cw2 = CW * s,
    ch2 = CH * s;

  // Cielo
  const grad = ctx.createLinearGradient(cx, cy, cx, cy + ch2);
  grad.addColorStop(0, '#1a2a4a');
  grad.addColorStop(0.6, '#0d1a2a');
  grad.addColorStop(1, '#0a0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(cx, cy, cw2, ch2);

  // Nubes
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  const cloudOff = (Date.now() * 0.02) % (cw2 + 200);
  for (let i = 0; i < 4; i++) {
    const cx2 = cx + ((i * 200 + cloudOff) % (cw2 + 200)) - 100;
    const cy2 = cy + 40 + i * 40;
    ctx.beginPath();
    ctx.ellipse(cx2, cy2, 50 * s, 15 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx2 + 30 * s, cy2 - 5 * s, 35 * s, 12 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Suelo
  const groundY = cy + (CH - GROUND_H) * s;
  ctx.fillStyle = '#1a2a1a';
  ctx.fillRect(cx, groundY, cw2, cy + ch2 - groundY);
  ctx.shadowColor = 'rgba(110,231,183,0.1)';
  ctx.strokeStyle = 'rgba(110,231,183,0.2)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(cx, groundY);
  ctx.lineTo(cx + cw2, groundY);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Tubos
  for (const p of pipes) {
    const px = cx + p.x * s,
      pw = PIPE_W * s;
    // Tubo superior
    drawPipe(px, cy, pw, p.gapY * s);
    // Tubo inferior
    drawPipe(px, cy + (p.gapY + PIPE_GAP) * s, pw, (CH - GROUND_H - p.gapY - PIPE_GAP) * s);
  }

  // Pájaro
  if (state.running || state.gameOver) {
    const bx = cx + BIRD_X * s,
      by = cy + bird.y * s;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(bird.rot);

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(3 * s, 3 * s, 12 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cuerpo
    ctx.shadowColor = '#6ee7b7';
    ctx.shadowBlur = 10 * s;
    ctx.fillStyle = '#6ee7b7';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12 * s, 9 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Ala (animada)
    const wingY = Math.sin(bird.wingPhase) * 6 * s;
    ctx.fillStyle = '#2f9e73';
    ctx.beginPath();
    ctx.ellipse(-4 * s, -3 * s + wingY, 10 * s, 4 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Ojo
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(6 * s, -2 * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(7 * s, -2 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Pico
    ctx.fillStyle = '#ffa726';
    ctx.beginPath();
    ctx.moveTo(12 * s, 0);
    ctx.lineTo(18 * s, 1.5 * s);
    ctx.lineTo(12 * s, 4 * s);
    ctx.fill();

    ctx.restore();
  }

  // Partículas
  drawParticles(ctx, ox, oy, sc);

  ctx.restore();
}

function drawPipe(x, y, w, h) {
  const r = 4 * sc;
  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(ctx, x + 2 * sc, y + 2 * sc, w, h, r);
  ctx.fill();

  // Cuerpo
  ctx.shadowColor = 'rgba(110,231,183,0.15)';
  ctx.shadowBlur = 6 * sc;
  ctx.fillStyle = '#2a5a3a';
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Borde superior
  ctx.fillStyle = '#3a7a4a';
  roundRect(ctx, x - 3 * sc, y, w + 6 * sc, 8 * sc, 3 * sc);
  ctx.fill();

  // Brillo
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundRect(ctx, x + 4 * sc, y + 4 * sc, w * 0.2, h - 8 * sc, 2 * sc);
  ctx.fill();
}

// ============================================================
// HUD
// ============================================================
const scEl = document.getElementById('sc'),
  bsEl = document.getElementById('bst');
function updateHUD() {
  scEl.textContent = String(state.score);
  bsEl.textContent = String(state.best);
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
    updateBird(dt);
    updatePipes(dt);
    checkCollisions();
  }

  updateParticles(dt);
  draw();
  animFrameId = requestAnimationFrame(tick);
}

updateHUD();

function cleanup() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  document.removeEventListener('keydown', trapTab);
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
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('flappy-bird'));
