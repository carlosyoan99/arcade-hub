import { ensureAudio, beep, startAmbient } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { startMusic, stopMusic } from '../../shared/music.js';
import { setupCanvas } from '../../shared/display.js';
import { setupGameShell } from '../../shared/shell.js';
import { loadBest, saveBest } from '../../shared/scores.js';
import { createGameLoop } from '../../shared/loop.js';
import { createGamepad } from '../../shared/input.js';
import {
  updateShake,
  updateParticles,
  drawParticles,
  drawGlow,
  feedbackBundle,
  triggerShake,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();
const shell = setupGameShell('pole-position');

/* ============================================================
   POLE POSITION — Arcade Hub
   Top-down racing: qualifying lap + race vs 8 rivals.
   ============================================================ */

// ── CONSTANTS ──
const GAME_W = 480;
const GAME_H = 640;
const ROAD_W = 160;
const CAR_W = 12;
const CAR_H = 20;
const RIVAL_COUNT = 8;
const QUALIFY_TIME = 35;
const RACE_TIME = 60;
const MAX_SPEED = 220;
const ACCEL = 180;
const BRAKE = 300;
const FRICTION = 60;
const TURN_SPEED = 150;
const TURBO_SPEED = 320;
const TURBO_DURATION = 2;
const TURBO_COOLDOWN = 5;
const ROAD_SEGMENTS = 120;
const SEGMENT_H = GAME_H / 6;

// Colors for rivals
const RIVAL_COLORS = [
  '#00f0ff',
  '#ffb800',
  '#39ff14',
  '#c084fc',
  '#ff5e7a',
  '#ff8a65',
  '#6ec6ff',
  '#ffe066',
];

// ── STATE ──
const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: loadBest('polePosition'),
  time: RACE_TIME,
  phase: 'qualify', // 'qualify' | 'race' | 'finished'
  position: 1,
  laps: 0,
  totalLaps: 3,
  qualifyingTime: 0,
  turbo: 0,
  turboCooldown: 0,
};

// Player car
const player = { x: GAME_W / 2, y: GAME_H - 80, speed: 0, angle: 0 };
// Rivals
let rivals = [];
// Road segments: array of { curve: -1..1 }
let road = [];
let roadOffset = 0;
let roadLength = 0;

// ── CANVAS ──
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const {
  w: canvasW,
  h: canvasH,
  s: scale,
  x: offX,
  y: offY,
} = setupCanvas(canvas, ctx, GAME_W, GAME_H, 10);

// ── SOUND ──
function playEngineSound() {
  const freq = 80 + player.speed * 0.3;
  beep({ freq, duration: 0.05, type: 'sawtooth', volume: 0.04 });
}
function playTurboSound() {
  beep({ freq: 200, freqEnd: 600, duration: 0.2, type: 'sawtooth', volume: 0.15 });
}
function playCrashSound() {
  feedbackBundle('large', player.x, player.y, {
    color: '#ff5e7a',
    noFlash: true,
    onBeep: () => beep({ freq: 100, freqEnd: 30, duration: 0.3, type: 'sawtooth', volume: 0.2 }),
  });
}
function playLapSound() {
  beep({ freq: 500, freqEnd: 800, duration: 0.15, type: 'triangle', volume: 0.2 });
}
function playFinishSound() {
  beep({ freq: 600, freqEnd: 1200, duration: 0.3, type: 'triangle', volume: 0.25 });
}

// ── ROAD GENERATION ──
function generateRoad() {
  road = [];
  for (let i = 0; i < ROAD_SEGMENTS; i++) {
    const curve = Math.sin(i * 0.08) * 0.6 + Math.sin(i * 0.03) * 0.4;
    road.push({ curve: Math.max(-1, Math.min(1, curve)) });
  }
  roadLength = road.length * SEGMENT_H;
}

// ── RIVALS ──
function spawnRivals() {
  rivals = [];
  for (let i = 0; i < RIVAL_COUNT; i++) {
    rivals.push({
      x: GAME_W / 2 + (Math.random() - 0.5) * ROAD_W * 0.6,
      y: 100 + i * 60,
      speed: 80 + Math.random() * 80,
      color: RIVAL_COLORS[i],
      passed: false,
    });
  }
}

// ── GAME FLOW ──
function startGame() {
  ensureAudio();
  state.score = 0;
  state.time = QUALIFY_TIME;
  state.phase = 'qualify';
  state.position = RIVAL_COUNT + 1;
  state.laps = 0;
  state.qualifyingTime = 0;
  state.turbo = 0;
  state.turboCooldown = 0;
  state.running = true;
  state.gameOver = false;
  state.paused = false;

  player.x = GAME_W / 2;
  player.y = GAME_H - 80;
  player.speed = 0;
  player.angle = 0;
  roadOffset = 0;

  generateRoad();
  spawnRivals();
  clearSquashes();
  startAmbient();
  startMusic('pole-position');
  shell.enableTabTrap();
  overlay.classList.add('hidden');
  say('¡Calificación! Completá la vuelta en menos de 35 segundos');
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  shell.disableTabTrap();
  stopMusic();
  playFinishSound();

  if (state.score > state.best) {
    state.best = state.score;
    saveBest('polePosition', state.best);
  }

  achievements.unlock('pole_first_race');
  if (state.position <= 3) achievements.unlock('podium');
  if (state.position === 1) achievements.unlock('champion');

  const posText =
    state.position <= 3 ? ['1° 🥇', '2° 🥈', '3° 🥉'][state.position - 1] : `${state.position}°`;
  finalScoreEl.textContent = `Posición: ${posText}`;
  finalScoreEl.style.display = '';
  overlayText.textContent = state.phase === 'qualify' ? '¡No clasificaste!' : '¡Carrera terminada!';
  hintEl.innerHTML =
    '<kbd>R</kbd> reiniciar &nbsp;·&nbsp; <kbd>Espacio</kbd> / tap para jugar de nuevo';
  overlay.classList.remove('hidden');
  say(`Posición final: ${posText}. Mejor: ${state.best}`);
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
}

// ── INPUT: KEYBOARD ──
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyR' && (state.gameOver || !state.running)) {
    e.preventDefault();
    startGame();
    return;
  }
  if (e.code === 'Space' || e.code === 'KeyP') {
    e.preventDefault();
    if (!state.running) startGame();
    else togglePause();
    return;
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// ── INPUT: TOUCH ──
let touchAccel = false;
let touchBrake = false;
let touchLeft = false;
let touchRight = false;
let touchTurbo = false;

function bindTouch(id, flag) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      btn.classList.add('is-pressed');
      if (flag === 'accel') touchAccel = true;
      if (flag === 'brake') touchBrake = true;
      if (flag === 'left') touchLeft = true;
      if (flag === 'right') touchRight = true;
      if (flag === 'turbo') touchTurbo = true;
      if (!state.running) startGame();
    },
    { passive: false },
  );
  btn.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
      if (flag === 'accel') touchAccel = false;
      if (flag === 'brake') touchBrake = false;
      if (flag === 'left') touchLeft = false;
      if (flag === 'right') touchRight = false;
      if (flag === 'turbo') touchTurbo = false;
    },
    { passive: false },
  );
  btn.addEventListener('touchcancel', () => {
    btn.classList.remove('is-pressed');
    if (flag === 'accel') touchAccel = false;
    if (flag === 'brake') touchBrake = false;
    if (flag === 'left') touchLeft = false;
    if (flag === 'right') touchRight = false;
    if (flag === 'turbo') touchTurbo = false;
  });
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (!state.running) startGame();
    if (flag === 'accel') touchAccel = true;
    if (flag === 'brake') touchBrake = true;
    if (flag === 'left') touchLeft = true;
    if (flag === 'right') touchRight = true;
    if (flag === 'turbo') touchTurbo = true;
  });
  btn.addEventListener('mouseup', () => {
    if (flag === 'accel') touchAccel = false;
    if (flag === 'brake') touchBrake = false;
    if (flag === 'left') touchLeft = false;
    if (flag === 'right') touchRight = false;
    if (flag === 'turbo') touchTurbo = false;
  });
}

bindTouch('btnUp', 'accel');
bindTouch('btnDown', 'brake');
bindTouch('btnLeft', 'left');
bindTouch('btnRight', 'right');
bindTouch('btnTurbo', 'turbo');

// ── INPUT: GAMEPAD ──
const gamepad = createGamepad();
let prevStart = false;

function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  const dpadUp = !!gp.buttons[12]?.pressed;
  const dpadDown = !!gp.buttons[13]?.pressed;
  const dpadLeft = !!gp.buttons[14]?.pressed;
  const dpadRight = !!gp.buttons[15]?.pressed;
  const stickY = gp.axes[1] ?? 0;
  const stickX = gp.axes[0] ?? 0;

  if (dpadUp || stickY < -0.4) touchAccel = true;
  else if (!keys['ArrowUp'] && !keys['KeyW']) touchAccel = false;
  if (dpadDown || stickY > 0.4) touchBrake = true;
  else if (!keys['ArrowDown'] && !keys['KeyS']) touchBrake = false;
  if (dpadLeft || stickX < -0.4) touchLeft = true;
  else if (!keys['ArrowLeft'] && !keys['KeyA']) touchLeft = false;
  if (dpadRight || stickX > 0.4) touchRight = true;
  else if (!keys['ArrowRight'] && !keys['KeyD']) touchRight = false;

  const aHeld = !!gp.buttons[0]?.pressed;
  if (aHeld) touchTurbo = true;
  else if (!keys['Space']) touchTurbo = false;

  const startHeld = !!gp.buttons[9]?.pressed;
  if (startHeld && !prevStart) {
    if (!state.running) startGame();
    else togglePause();
  }
  prevStart = startHeld;
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
overlay.addEventListener('click', () => {
  if (!state.running) startGame();
});

// ── UPDATE ──
function updateGame(dt) {
  // Timer
  state.time -= dt;
  if (state.time <= 0) {
    if (state.phase === 'qualify') {
      endGame();
      return;
    }
    state.time = 0;
  }

  // Turbo
  if (state.turboCooldown > 0) state.turboCooldown -= dt;
  if (state.turbo > 0) state.turbo -= dt;

  const accelInput = keys['ArrowUp'] || keys['KeyW'] || touchAccel;
  const brakeInput = keys['ArrowDown'] || keys['KeyS'] || touchBrake;
  const leftInput = keys['ArrowLeft'] || keys['KeyA'] || touchLeft;
  const rightInput = keys['ArrowRight'] || keys['KeyD'] || touchRight;
  const turboInput = keys['Space'] || touchTurbo;

  // Turbo activation
  if (turboInput && state.turboCooldown <= 0 && state.turbo <= 0) {
    state.turbo = TURBO_DURATION;
    state.turboCooldown = TURBO_COOLDOWN;
    playTurboSound();
  }

  // Speed
  const maxSpd = state.turbo > 0 ? TURBO_SPEED : MAX_SPEED;
  if (accelInput) {
    player.speed = Math.min(maxSpd, player.speed + ACCEL * dt);
  } else if (brakeInput) {
    player.speed = Math.max(0, player.speed - BRAKE * dt);
  } else {
    player.speed = Math.max(0, player.speed - FRICTION * dt);
  }

  // Turning
  if (leftInput) player.angle -= TURN_SPEED * dt;
  if (rightInput) player.angle += TURN_SPEED * dt;
  player.angle = Math.max(-1.2, Math.min(1.2, player.angle));

  // Road curve effect
  const segIdx = Math.floor((roadOffset + player.y) / SEGMENT_H) % road.length;
  const curve = road[segIdx]?.curve ?? 0;
  player.x += curve * player.speed * dt * 0.8;

  // Move forward
  roadOffset += player.speed * dt;

  // Wrap player position
  if (player.x < GAME_W / 2 - ROAD_W / 2 + CAR_W) {
    player.x = GAME_W / 2 - ROAD_W / 2 + CAR_W;
    player.speed *= 0.5;
  }
  if (player.x > GAME_W / 2 + ROAD_W / 2 - CAR_W) {
    player.x = GAME_W / 2 + ROAD_W / 2 - CAR_W;
    player.speed *= 0.5;
  }

  // Rivals
  let position = 1;
  for (const r of rivals) {
    r.y -= r.speed * dt;
    if (r.y < -50) r.y = GAME_H + 50 + Math.random() * 200;

    // Simple lane keeping
    const targetX = GAME_W / 2 + Math.sin(r.y * 0.02 + r.speed) * ROAD_W * 0.3;
    r.x += (targetX - r.x) * dt * 2;

    // Collision with player
    const dx = Math.abs(r.x - player.x);
    const dy = Math.abs(r.y - player.y);
    if (dx < CAR_W * 1.5 && dy < CAR_H * 1.5) {
      player.speed *= 0.3;
      r.speed *= 0.8;
      playCrashSound();
      triggerShake(8);
    }

    // Position tracking
    if (r.y < player.y) position++;
  }
  state.position = position;

  // Lap detection
  if (roadOffset >= roadLength) {
    roadOffset -= roadLength;
    state.laps++;
    playLapSound();

    if (state.phase === 'qualify') {
      state.phase = 'race';
      state.time = RACE_TIME;
      state.qualifyingTime = QUALIFY_TIME - state.time;
      say('¡Clasificado! ¡Arranca la carrera!');
    } else if (state.laps >= state.totalLaps) {
      state.score = (RIVAL_COUNT + 1 - state.position) * 100 + Math.floor(state.time) * 10;
      endGame();
      return;
    }
  }

  // Engine sound
  if (player.speed > 10 && Math.random() < 0.1) playEngineSound();
}

// ── RENDER ──
function draw() {
  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);

  const ox = offX;
  const oy = offY;
  const s = scale;

  // Sky / grass
  ctx.fillStyle = '#1a3a1a';
  ctx.fillRect(ox, oy, GAME_W * s, GAME_H * s);

  // Road segments
  const roadLeft = ox + (GAME_W / 2 - ROAD_W / 2) * s;
  const roadRight = ox + (GAME_W / 2 + ROAD_W / 2) * s;
  const segmentCount = Math.ceil(GAME_H / SEGMENT_H) + 2;

  for (let i = 0; i < segmentCount; i++) {
    const baseY = i * SEGMENT_H - (roadOffset % SEGMENT_H);
    const segIdx = Math.floor((roadOffset + baseY) / SEGMENT_H) % road.length;
    const curve = road[segIdx]?.curve ?? 0;

    const y1 = oy + baseY * s;
    const y2 = oy + (baseY + SEGMENT_H) * s;

    // Road surface
    const alt = Math.floor((roadOffset + baseY) / SEGMENT_H) % 2 === 0;
    ctx.fillStyle = alt ? '#333340' : '#2a2a35';
    ctx.fillRect(roadLeft + curve * 40 * s, y1, ROAD_W * s, y2 - y1 + 1);

    // Road lines
    if (alt) {
      ctx.fillStyle = '#555';
      ctx.fillRect(roadLeft + curve * 40 * s + ROAD_W * s * 0.48, y1, 3 * s, y2 - y1 + 1);
    }

    // Edge lines
    ctx.fillStyle = '#ff2d78';
    ctx.fillRect(roadLeft + curve * 40 * s, y1, 2 * s, y2 - y1 + 1);
    ctx.fillRect(roadRight + curve * 40 * s - 2 * s, y1, 2 * s, y2 - y1 + 1);
  }

  // Draw rivals
  for (const r of rivals) {
    const screenY = (r.y - roadOffset) % (GAME_H + 200);
    if (screenY < -30 || screenY > GAME_H + 30) continue;

    const segIdx = Math.floor((roadOffset + r.y) / SEGMENT_H) % road.length;
    const curve = road[segIdx]?.curve ?? 0;
    const sx = ox + (r.x + curve * 40) * s;
    const sy = oy + screenY * s;

    ctx.fillStyle = r.color;
    ctx.fillRect(sx - CAR_W * s * 0.5, sy - CAR_H * s * 0.5, CAR_W * s, CAR_H * s);
    drawGlow(ctx, sx, sy, CAR_W * s, r.color, 0.1, 2);
  }

  // Draw player
  const playerSegIdx = Math.floor((roadOffset + player.y) / SEGMENT_H) % road.length;
  const playerCurve = road[playerSegIdx]?.curve ?? 0;
  const playerScreenX = ox + (player.x + playerCurve * 40) * s;
  const playerScreenY = oy + (player.y % GAME_H) * s;

  ctx.save();
  ctx.translate(playerScreenX, playerScreenY);
  ctx.rotate(player.angle * 0.3);

  // Car body
  ctx.fillStyle = '#ff2d78';
  ctx.fillRect(-CAR_W * s * 0.5, -CAR_H * s * 0.5, CAR_W * s, CAR_H * s);

  // Windshield
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(-CAR_W * s * 0.3, -CAR_H * s * 0.3, CAR_W * s * 0.6, CAR_H * s * 0.25);

  // Turbo flame
  if (state.turbo > 0) {
    ctx.fillStyle = '#ffb800';
    ctx.fillRect(-3 * s, CAR_H * s * 0.4, 6 * s, (8 + Math.random() * 6) * s);
    drawGlow(ctx, 0, CAR_H * s * 0.5, 10 * s, '#ffb800', 0.2, 3);
  }

  ctx.restore();
  drawGlow(ctx, playerScreenX, playerScreenY, CAR_W * s, '#ff2d78', 0.15, 2.5);

  // ── Particles ──
  drawParticles(ctx, offX, offY, scale);

  // ── HUD overlay ──
  // Turbo bar
  if (state.turboCooldown > 0 || state.turbo > 0) {
    const barW = 80 * s;
    const barH = 8 * s;
    const barX = ox + GAME_W * s - barW - 10 * s;
    const barY = oy + 10 * s;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX, barY, barW, barH);
    const fill =
      state.turbo > 0 ? state.turbo / TURBO_DURATION : 1 - state.turboCooldown / TURBO_COOLDOWN;
    ctx.fillStyle = state.turbo > 0 ? '#ffb800' : '#39ff14';
    ctx.fillRect(barX, barY, barW * fill, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${8 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(state.turbo > 0 ? 'TURBO' : 'TURBO', barX + barW / 2, barY + barH + 10 * s);
  }

  // Pause overlay
  if (state.paused && state.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(ox, oy, GAME_W * s, GAME_H * s);
    ctx.fillStyle = '#fff';
    ctx.font = `${28 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSA', ox + GAME_W * s * 0.5, oy + GAME_H * s * 0.5);
  }

  ctx.restore();
}

// ── HUD ──
const timeValueEl = document.getElementById('timeValue');
const posValueEl = document.getElementById('posValue');
const speedValueEl = document.getElementById('speedValue');

function updateHUD() {
  timeValueEl.textContent = state.time > 0 ? Math.ceil(state.time) : '0';
  const pos = state.position;
  posValueEl.textContent = pos <= 3 ? `${pos}°${['🥇', '🥈', '🥉'][pos - 1] || ''}` : `${pos}°`;
  speedValueEl.textContent = Math.floor(player.speed);
}

// ── GAME LOOP ──
const loop = createGameLoop((dt) => {
  pollGamepad();
  updateShake(dt);

  if (state.running && !state.gameOver && !state.paused) {
    updateGame(dt);
  }

  updateSquashes(dt);
  updateParticles(dt);
  updateHUD();
  draw();
});

// Init
generateRoad();
updateHUD();

shell.onCleanup(() => loop.stop());
document.getElementById('loading').classList.add('hidden');
loop.start();
