import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import { createGameLoop } from '../../shared/loop.js';
import {
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
  feedbackBundle,
  triggerSquash,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();
document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';
/* ============================================================
   DINO RUNNER 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   Side-scroller: el dino corre en su lugar, el mundo se mueve.
   JS organizado: constantes → estado → canvas → sonido → partículas
   → jugador → obstáculos → suelo → entrada → lógica → render → bucle
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const COURT_W = 800;
const COURT_H = 400;
const COURT_PADDING = 20;
const GROUND_Y = 300; // coordenada Y del suelo
const GRAVITY = -1800;
const JUMP_VEL = 620;
const DUCK_SCALE_H = 0.45;
const BASE_SPEED = 280;
const MAX_SPEED = 680;
const SPEED_RAMP = 2.8; // aceleración por segundo
const SPAWN_MIN = 0.9;
const SPAWN_MAX = 1.9;

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  distance: 0,
  best: Number(localStorage.getItem('dinorunner2d_best') || 0),
  speed: BASE_SPEED,
  elapsed: 0,
  nextSpawnIn: 1.2,
};

// Jugador
const player = {
  y: GROUND_Y,
  vy: 0,
  onGround: true,
  ducking: false,
  legPhase: 0,
  scaleY: 1,
};

// Obstáculos
let obstacles = [];
let groundOffset = 0;

// ============================================================
// CANVAS SETUP
// ============================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const {
  w: canvasW,
  h: canvasH,
  s: scale,
  x: offX,
  y: offY,
} = setupCanvas(canvas, ctx, COURT_W, COURT_H, COURT_PADDING);

// ============================================================
// SONIDO (usando shared/audio.js)
// ============================================================
function playJumpSound() {
  beep({ freq: 520, freqEnd: 760, duration: 0.12, type: 'square', volume: 0.14 });
}
function playLandSound() {
  feedbackBundle('medium', dino.x + dino.w / 2, dino.y + dino.h, {
    color: '#ff8a65',
    onBeep: () => beep({ freq: 220, freqEnd: 140, duration: 0.07, type: 'sine', volume: 0.08 }),
  });
}
function playDuckSound() {
  beep({ freq: 260, freqEnd: 200, duration: 0.05, type: 'sine', volume: 0.06 });
}
function playCollisionSound() {
  feedbackBundle('large', dino.x + dino.w / 2, dino.y + dino.h / 2, {
    color: '#ff4444',
    noFlash: true,
    onBeep: () => beep({ freq: 180, freqEnd: 55, duration: 0.35, type: 'sawtooth', volume: 0.22 }),
  });
}
function playRecordSound() {
  [660, 880, 1100].forEach((freq, i) => {
    setTimeout(() => beep({ freq, duration: 0.1, type: 'triangle', volume: 0.16 }), i * 90);
  });
}

// ============================================================
// ENTRADA: TECLADO
// ============================================================
const keys = {};

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault();
    if (!state.running) startGame();
    else jump();
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    setDuck(true);
  } else if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'ArrowDown') setDuck(false);
});

// ============================================================
// ENTRADA: TÁCTIL
// ============================================================
const btnJump = document.getElementById('btnJump');
const btnDuck = document.getElementById('btnDuck');

btnJump.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    btnJump.classList.add('is-pressed');
    if (!state.running) startGame();
    else jump();
  },
  { passive: false },
);
btnJump.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    btnJump.classList.remove('is-pressed');
  },
  { passive: false },
);
btnJump.addEventListener('touchcancel', () => {
  btnJump.classList.remove('is-pressed');
});
btnJump.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (!state.running) startGame();
  else jump();
});

btnDuck.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    btnDuck.classList.add('is-pressed');
    setDuck(true);
  },
  { passive: false },
);
btnDuck.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    btnDuck.classList.remove('is-pressed');
    setDuck(false);
  },
  { passive: false },
);
btnDuck.addEventListener('touchcancel', () => {
  btnDuck.classList.remove('is-pressed');
  setDuck(false);
});
btnDuck.addEventListener('mousedown', (e) => {
  e.preventDefault();
  setDuck(true);
});
btnDuck.addEventListener('mouseup', () => {
  setDuck(false);
});
btnDuck.addEventListener('mouseleave', () => {
  setDuck(false);
});

// Click/tap en canvas y overlay
canvas.addEventListener('pointerdown', () => {
  if (!state.running) startGame();
  else jump();
});

const overlay = document.getElementById('overlay');
overlay.addEventListener('click', () => {
  if (!state.running) startGame();
});

// ============================================================
// ENTRADA: GAMEPAD
// ============================================================
let gamepadIndex = null;
let prevGamepadButtons = { jump: false, start: false };

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

  const jumpHeld = !!(gp.buttons[0]?.pressed || gp.buttons[3]?.pressed);
  const startHeld = !!(gp.buttons[9]?.pressed || gp.buttons[8]?.pressed);
  const stickDown = (gp.axes[1] ?? 0) > 0.6;
  const duckHeld = !!(gp.buttons[1]?.pressed || gp.buttons[13]?.pressed || stickDown);

  const jumpEdge = jumpHeld && !prevGamepadButtons.jump;
  const startEdge = startHeld && !prevGamepadButtons.start;

  if (!state.running && (jumpEdge || startEdge)) {
    startGame();
  } else if (state.running && jumpEdge) {
    jump();
  }

  setDuck(duckHeld);

  prevGamepadButtons = { jump: jumpHeld, start: startHeld };
}

// SONIDO + LOGROS: usando shared/audio.js y shared/achievements.js
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

// ============================================================
// LÓGICA DEL JUEGO
// ============================================================
function jump() {
  if (player.onGround && state.running && !state.gameOver) {
    player.vy = -JUMP_VEL;
    player.onGround = false;
    playJumpSound();
    spawnParticles(80, GROUND_Y);
  }
}

function setDuck(active) {
  if (!state.running || state.gameOver) return;
  if (active && !player.onGround) return;
  player.ducking = active;
  if (active) playDuckSound();
}

function resetGame() {
  obstacles = [];
  state.distance = 0;
  state.speed = BASE_SPEED;
  state.elapsed = 0;
  state.nextSpawnIn = 1.2;
  state.gameOver = false;
  player.y = GROUND_Y;
  player.vy = 0;
  player.onGround = true;
  player.ducking = false;
  player.legPhase = 0;
  player.scaleY = 1;
  groundOffset = 0;
  finalScoreEl.style.display = 'none';
  updateHUD();
}
function startGame() {
  clearSquashes();
  ensureAudio();
  startAmbient();
  if (state.best >= 500) achievements.unlock('dino_fivehundo');
  resetGame();
  state.running = true;
  achievements.incrementPlays('dino-runner');
  overlay.classList.add('hidden');
  document.addEventListener('keydown', trapTab);
  say('Dino Runner: corré lo más lejos posible esquivando obstáculos.');
}

function endGame() {
  state.running = false;
  state.gameOver = true;

  const dist = Math.floor(state.distance);
  const isNewRecord = dist > state.best;
  if (isNewRecord) {
    state.best = dist;
    localStorage.setItem('dinorunner2d_best', String(state.best));
  }

  playCollisionSound();
  if (isNewRecord) playRecordSound();
  spawnParticles(
    80,
    player.y - 40,
    ['#6ee7b7', '#ff6b6b', '#ffe066', '#ffffff'][Math.floor(Math.random() * 4)],
    30,
    { spd: 130, life: 0.7, sm: 2, smx: 5.5, gravity: 400, friction: 0.96 },
  );

  overlayText.textContent = isNewRecord ? '🏆 ¡Nuevo récord!' : '💥 ¡Chocaste!';
  finalScoreEl.style.display = 'block';
  finalScoreEl.textContent = `Distancia: ${dist} m · Récord: ${state.best} m`;
  hintEl.innerHTML = `<kbd>Espacio</kbd> / tocar para reintentar  ·  <kbd>R</kbd> reiniciar`;
  overlay.classList.remove('hidden');
  document.removeEventListener('keydown', trapTab);
  say(isNewRecord ? 'Dino Runner: nuevo récord.' : 'Dino Runner: chocaste.');
  updateHUD();
}

// ============================================================
// FÍSICA / ACTUALIZACIÓN
// ============================================================
function updatePlayer(dt) {
  const wasOnGround = player.onGround;

  // Gravedad
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;

  if (player.y >= GROUND_Y) {
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
    if (!wasOnGround) {
      playLandSound();
      spawnParticles(80, GROUND_Y);
    }
  }

  // Escala de agachado
  const duckTarget = player.ducking && player.onGround ? DUCK_SCALE_H : 1;
  player.scaleY += (duckTarget - player.scaleY) * Math.min(1, dt * 14);

  // Animación de piernas
  if (player.onGround && !player.ducking) {
    player.legPhase += dt * (10 + state.speed * 0.006);
  } else if (!player.onGround) {
    player.legPhase += (0 - player.legPhase) * 0.1;
  }
}

function updateObstacles(dt) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    // Anti-tunneling: sub-pasos si el movimiento por frame es grande
    const step = state.speed * dt;
    if (step > 15) {
      const steps = Math.ceil(step / 12);
      const subDt = dt / steps;
      for (let s = 0; s < steps; s++) {
        o.x -= state.speed * subDt;
        if (checkCollision(o)) {
          endGame();
          return;
        }
      }
    } else {
      o.x -= state.speed * dt;
      if (checkCollision(o)) {
        endGame();
        return;
      }
    }

    // Alas de pájaro
    if (o.type === 'bird') {
      o.flapPhase += dt * 12;
    }

    if (o.x < -60) {
      obstacles.splice(i, 1);
      continue;
    }
  }
}

function spawnCactus() {
  const clusters = 1 + Math.floor(Math.random() * 3);
  const halfW = clusters * 18;
  const h = 30 + Math.random() * 20;
  obstacles.push({
    type: 'cactus',
    x: COURT_W + 40,
    y: GROUND_Y,
    w: halfW * 2,
    h: h,
    halfW: halfW,
    halfH: h / 2,
    clusters,
  });
}

function spawnBird() {
  const flyY = GROUND_Y - 50 - Math.random() * 70;
  obstacles.push({
    type: 'bird',
    x: COURT_W + 40,
    y: flyY,
    w: 50,
    h: 20,
    halfW: 25,
    halfH: 10,
    flapPhase: Math.random() * Math.PI * 2,
  });
}

function spawnObstacle() {
  if (state.distance > 50 && Math.random() < 0.35) {
    spawnBird();
  } else {
    spawnCactus();
  }
}

function checkCollision(o) {
  // Hitbox del dino
  const dinoX = 80;
  const dinoH = player.ducking && player.onGround ? 30 : 55;
  const dinoW = player.ducking && player.onGround ? 45 : 30;
  const dinoY = player.y - dinoH * player.scaleY;
  const dinoB = player.y;

  // Margen de tolerancia
  const margin = 6;

  const oLeft = o.x - o.halfW + margin;
  const oRight = o.x + o.halfW - margin;
  const oTop = o.y - o.halfH + margin;
  const oBottom = o.y + o.halfH - margin;

  if (dinoX + dinoW - margin < oLeft) return false;
  if (dinoX + margin > oRight) return false;
  if (dinoB - margin < oTop) return false;
  if (dinoY + margin > oBottom) return false;

  return true;
}

function updateGround(dt) {
  groundOffset += state.speed * dt;
  if (groundOffset > 60) groundOffset -= 60;
}

// ============================================================
// RENDER
// ============================================================
function draw() {
  ctx.clearRect(0, 0, canvasW, canvasH);

  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);

  const s = scale;
  const ox = offX;
  const oy = offY;
  const cw = COURT_W * s;
  const ch = COURT_H * s;

  // --- Fondo: cielo degradado ---
  const skyGrad = ctx.createLinearGradient(ox, oy, ox, oy + ch);
  skyGrad.addColorStop(0, '#1a1a3e');
  skyGrad.addColorStop(0.6, '#0d1a24');
  skyGrad.addColorStop(1, '#0a0a14');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(ox, oy, cw, ch);

  // --- Estrellas / puntos distantes ---
  // (usando posición fija pseudoaleatoria)
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 30; i++) {
    const sx = (i * 137.5 + 50) % cw;
    const sy = (i * 97.3 + 20) % (ch * 0.4);
    const sr = 0.5 + (i % 3) * 0.5;
    ctx.beginPath();
    ctx.arc(ox + sx, oy + sy, sr * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Montañas lejanas ---
  ctx.fillStyle = 'rgba(30,40,60,0.4)';
  for (let i = 0; i < 5; i++) {
    const mx = -80 + i * 200 - ((groundOffset * 0.1) % 200);
    const mh = 60 + ((i * 13) % 40);
    ctx.beginPath();
    ctx.moveTo(ox + mx * s, oy + GROUND_Y * s);
    ctx.quadraticCurveTo(
      ox + (mx + 50) * s,
      oy + (GROUND_Y - mh) * s,
      ox + (mx + 100) * s,
      oy + GROUND_Y * s,
    );
    ctx.fill();
  }

  // --- Suelo ---
  const groundYpx = oy + GROUND_Y * s;
  ctx.fillStyle = '#2b2b45';
  ctx.fillRect(ox, groundYpx, cw, oy + ch - groundYpx);

  // Línea del suelo
  ctx.shadowColor = 'rgba(110,231,183,0.1)';
  ctx.shadowBlur = 8 * s;
  ctx.strokeStyle = 'rgba(110,231,183,0.25)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(ox, groundYpx);
  ctx.lineTo(ox + cw, groundYpx);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Líneas de carril (scroll)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1 * s;
  const lineSpacing = 60 * s;
  const offsetPx = (groundOffset * s) % lineSpacing;
  for (let x = -lineSpacing + offsetPx; x < cw + lineSpacing; x += lineSpacing) {
    ctx.beginPath();
    ctx.moveTo(ox + x, groundYpx + 8 * s);
    ctx.lineTo(ox + x, oy + ch);
    ctx.stroke();
  }

  // --- Obstáculos ---
  for (const o of obstacles) {
    if (o.type === 'cactus') {
      drawCactus(ox + o.x * s, oy + o.y * s, o.w * s, o.h * s, o.clusters);
    } else {
      drawBird(ox + o.x * s, oy + o.y * s, 50 * s, 20 * s, o.flapPhase);
    }
  }

  // --- Dino ---
  const dinoX = ox + 80 * s;
  const dinoY = oy + player.y * s;
  drawDino(dinoX, dinoY, s, player.legPhase, player.scaleY, player.ducking && player.onGround);

  // --- Partículas ---
  drawParticles(ctx, offX, offY, scale);

  ctx.restore();
}

function drawDino(x, y, s, legPhase, scaleY, isDucking) {
  const sc = (w) => w * s;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, scaleY);

  const bodyH = isDucking ? 18 : 36;
  const bodyW = isDucking ? 42 : 30;
  const color = '#6ee7b7';
  const darkColor = '#2f9e73';

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  roundRect(ctx, (-bodyW / 2) * s + sc(2), -bodyH * s + sc(2), bodyW * s, bodyH * s, sc(4));
  ctx.fill();

  // Cuerpo
  ctx.shadowColor = 'rgba(110,231,183,0.3)';
  ctx.shadowBlur = sc(8);
  ctx.fillStyle = color;
  roundRect(ctx, (-bodyW / 2) * s, -bodyH * s, bodyW * s, bodyH * s, sc(4));
  ctx.fill();
  ctx.shadowBlur = 0;

  if (!isDucking) {
    // Cabeza
    const headH = sc(14);
    const headW = sc(16);
    const headY = -bodyH * s - sc(2);
    ctx.fillStyle = color;
    roundRect(ctx, sc(2), headY - headH + sc(2), headW, headH, sc(3));
    ctx.fill();

    // Mandíbula
    ctx.fillStyle = darkColor;
    roundRect(ctx, sc(4), headY - headH + sc(8), headW - sc(4), sc(6), sc(2));
    ctx.fill();

    // Ojo
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = sc(4);
    ctx.beginPath();
    ctx.arc(sc(12), headY - headH + sc(6), sc(2.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Cola
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo((-bodyW / 2) * s, -bodyH * s * 0.4);
    ctx.quadraticCurveTo(
      (-bodyW / 2) * s - sc(14),
      -bodyH * s * 0.7,
      (-bodyW / 2) * s - sc(10),
      -bodyH * s * 0.15,
    );
    ctx.quadraticCurveTo((-bodyW / 2) * s - sc(8), 0, (-bodyW / 2) * s, 0);
    ctx.fill();

    // Brazos
    ctx.fillStyle = darkColor;
    roundRect(ctx, (-bodyW / 2) * s - sc(2), -bodyH * s * 0.5, sc(4), sc(10), sc(2));
    ctx.fill();
    roundRect(ctx, (bodyW / 2) * s - sc(2), -bodyH * s * 0.5, sc(4), sc(10), sc(2));
    ctx.fill();
  }

  // Piernas
  const legLen = isDucking ? sc(8) : sc(16);
  const legOff = sc(7);
  ctx.fillStyle = darkColor;

  const legSwing = Math.sin(legPhase) * sc(6);
  roundRect(ctx, -legOff - sc(3), sc(2), sc(6), legLen + legSwing * 0.5, sc(2));
  ctx.fill();
  roundRect(ctx, legOff - sc(3), sc(2), sc(6), legLen - legSwing * 0.5, sc(2));
  ctx.fill();

  ctx.restore();
}

function drawCactus(x, y, w, h, clusters) {
  const s = scale;
  const sc2 = (v) => v * s;
  const cw = w / clusters;

  for (let i = 0; i < clusters; i++) {
    const cx = x - w / 2 + cw * i + cw / 2;
    const ch = h * (0.8 + (i % 3) * 0.1);

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    roundRect(ctx, cx - cw / 3 + sc2(2), y - ch + sc2(2), cw / 1.5, ch, sc2(3));
    ctx.fill();

    // Tronco
    ctx.shadowColor = 'rgba(63,174,92,0.3)';
    ctx.shadowBlur = sc2(6);
    ctx.fillStyle = '#3fae5c';
    roundRect(ctx, cx - cw / 3, y - ch, cw / 1.5, ch, sc2(3));
    ctx.fill();
    ctx.shadowBlur = 0;

    // Brazo
    const armDir = i % 2 === 0 ? 1 : -1;
    ctx.fillStyle = '#3fae5c';
    roundRect(ctx, cx + (armDir * cw) / 3, y - ch * 0.7, cw / 2.5, ch * 0.35, sc2(2));
    ctx.fill();
  }
}

function drawBird(x, y, w, h, flapPhase) {
  const s = scale;
  const sc2 = (v) => v * s;
  const flap = Math.sin(flapPhase) * 0.5;
  const halfW = w / 2;
  const halfH = h / 2;

  // Sombra
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x + sc2(2), y + sc2(2), halfW * 0.4, halfH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cuerpo
  ctx.shadowColor = 'rgba(217,140,74,0.3)';
  ctx.shadowBlur = sc2(6);
  ctx.fillStyle = '#d98c4a';
  ctx.beginPath();
  ctx.ellipse(x, y, halfW * 0.4, halfH * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ala izquierda
  ctx.fillStyle = '#c47a3a';
  ctx.save();
  ctx.translate(x - halfW * 0.3, y - halfH * 0.3);
  ctx.rotate(flap * 0.8);
  roundRect(ctx, -halfW * 0.35, -halfH * 0.1, halfW * 0.5, halfH * 0.4, sc2(3));
  ctx.fill();
  ctx.restore();

  // Ala derecha
  ctx.save();
  ctx.translate(x + halfW * 0.3, y - halfH * 0.3);
  ctx.rotate(-flap * 0.8);
  roundRect(ctx, -halfW * 0.15, -halfH * 0.1, halfW * 0.5, halfH * 0.4, sc2(3));
  ctx.fill();
  ctx.restore();

  ctx.shadowBlur = 0;

  // Ojo
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x + halfW * 0.3, y - halfH * 0.15, sc2(2), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x + halfW * 0.35, y - halfH * 0.15, sc2(1), 0, Math.PI * 2);
  ctx.fill();

  // Pico
  ctx.fillStyle = '#e8a040';
  ctx.beginPath();
  ctx.moveTo(x + halfW * 0.5, y);
  ctx.lineTo(x + halfW * 0.7, y + sc2(1.5));
  ctx.lineTo(x + halfW * 0.5, y + sc2(2));
  ctx.fill();
}

// ============================================================
// HUD
// ============================================================
const distValueEl = document.getElementById('distValue');
const speedValueEl = document.getElementById('speedValue');
const bestValueEl = document.getElementById('bestValue');

function updateHUD() {
  distValueEl.textContent = `${Math.floor(state.distance)} m`;
  speedValueEl.textContent = `${Math.floor(state.speed / 50) + 1}`;
  bestValueEl.textContent = `${state.best} m`;
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
    state.elapsed += dt;
    state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.elapsed * SPEED_RAMP);
    state.distance += state.speed * dt * 0.04;

    updatePlayer(dt);
    updateGround(dt);
    updateObstacles(dt);

    state.nextSpawnIn -= dt;
    if (state.nextSpawnIn <= 0) {
      spawnObstacle();
      const range = SPAWN_MAX - SPAWN_MIN;
      const difficultyFactor = Math.max(0.5, 1 - state.elapsed / 90);
      state.nextSpawnIn = (SPAWN_MIN + Math.random() * range) * difficultyFactor;
    }

    updateHUD();
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
  lastTime = t;
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
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('dino-runner'));
