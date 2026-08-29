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
  triggerShake,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();
const shell = setupGameShell('out-run');

const GW = 480;
const GH = 360;
const ROAD_W = 180;
const SEGMENTS = 300;
const SEG_LEN = 12;
const CAM_HEIGHT = 100;
const DRAW_DIST = 80;
const MAX_SPEED = 240;
const ACCEL = 160;
const BRAKE = 280;
const FRICTION = 40;
const TURN_SPEED = 180;
const TURBO_MULT = 1.8;
const TURBO_DUR = 2.5;
const TURBO_CD = 6;
const STAGE_LEN = SEGMENTS * SEG_LEN;
const RIVAL_COLORS = ['#00f0ff', '#ffb800', '#39ff14', '#c084fc', '#ff5e7a'];

const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: loadBest('outRun'),
  time: 75,
  stage: 0,
  turbo: 0,
  turboCd: 0,
};

const player = { x: 0, speed: 0 };
let camZ = 0;
let rivals = [];
let segments = [];

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const { w: cW, h: cH, s: sc, x: ox, y: oy } = setupCanvas(canvas, ctx, GW, GH, 10);

function sfx(f, e, d, t, v) {
  beep({ freq: f, freqEnd: e, duration: d, type: t, volume: v });
}
function engineSfx() {
  sfx(60 + player.speed * 0.2, 40, 0.05, 'sawtooth', 0.03);
}
function turboSfx() {
  sfx(200, 600, 0.2, 'sawtooth', 0.15);
}
function crashSfx() {
  sfx(100, 30, 0.3, 'sawtooth', 0.18);
}
function stageSfx() {
  sfx(500, 1000, 0.2, 'triangle', 0.2);
}

function generateRoad() {
  segments = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const curve = Math.sin(i * 0.02) * 0.6 + Math.sin(i * 0.007) * 0.8;
    const hill = Math.sin(i * 0.015) * 30;
    const hasTree = Math.random() < 0.04;
    const hasRival = Math.random() < 0.015;
    segments.push({ curve: Math.max(-1, Math.min(1, curve)), hill, hasTree, hasRival, rivalX: 0 });
  }
}

function spawnRivals() {
  rivals = [];
  for (let i = 0; i < 8; i++) {
    rivals.push({
      z: camZ + 200 + i * 150 + Math.random() * 100,
      x: (Math.random() - 0.5) * 1.2,
      speed: 80 + Math.random() * 60,
      color: RIVAL_COLORS[i % RIVAL_COLORS.length],
    });
  }
}

function project(x, y, z) {
  const relZ = z - camZ;
  if (relZ <= 0) return null;
  const scale = 300 / relZ;
  return {
    x: GW / 2 + (x + player.x * 0.5) * scale * 100,
    y: GH / 2 - (y - CAM_HEIGHT) * scale * 2,
    w: ROAD_W * scale,
    scale,
  };
}

function getSeg(z) {
  return segments[Math.floor(z / SEG_LEN) % segments.length];
}

function startGame() {
  ensureAudio();
  state.score = 0;
  state.time = 75;
  state.stage = 0;
  state.turbo = 0;
  state.turboCd = 0;
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  player.x = 0;
  player.speed = 0;
  camZ = 0;
  generateRoad();
  spawnRivals();
  clearSquashes();
  startAmbient();
  startMusic('out-run');
  shell.enableTabTrap();
  overlay.classList.add('hidden');
  say('Out Run — ¡A la carretera!');
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  shell.disableTabTrap();
  stopMusic();
  sfx(300, 40, 0.5, 'sawtooth', 0.2);
  if (state.score > state.best) {
    state.best = state.score;
    saveBest('outRun', state.best);
  }
  achievements.unlock('ou_first_race');
  if (state.score >= 500) achievements.unlock('ou_high_scorer');
  if (state.stage >= 3) achievements.unlock('ou_stage_clear');
  finalScoreEl.textContent = `Puntos: ${state.score} · Stage ${state.stage + 1}`;
  finalScoreEl.style.display = '';
  overlayText.textContent = '¡Juego terminado!';
  hintEl.innerHTML = '<kbd>R</kbd> reiniciar · <kbd>Espacio</kbd> / tap para jugar de nuevo';
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
}

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
  if (!state.running || state.gameOver || state.paused) return;
  if (e.code === 'Space') {
    e.preventDefault();
    activateTurbo();
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

function bindTouch(id, flag) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      btn.classList.add('is-pressed');
      if (!state.running) startGame();
      if (flag === 'turbo') activateTurbo();
    },
    { passive: false },
  );
  btn.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
    },
    { passive: false },
  );
  btn.addEventListener('touchcancel', () => btn.classList.remove('is-pressed'));
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (!state.running) startGame();
    if (flag === 'turbo') activateTurbo();
  });
}
bindTouch('btnUp', 'accel');
bindTouch('btnDown', 'brake');
bindTouch('btnLeft', 'left');
bindTouch('btnRight', 'right');
bindTouch('btnTurbo', 'turbo');

const gamepad = createGamepad();
let prevStart = false;
function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  keys['ArrowUp'] = !!gp.buttons[12]?.pressed;
  keys['ArrowDown'] = !!gp.buttons[13]?.pressed;
  keys['ArrowLeft'] = !!gp.buttons[14]?.pressed;
  keys['ArrowRight'] = !!gp.buttons[15]?.pressed;
  if (gp.buttons[0]?.pressed) activateTurbo();
  const sH = !!gp.buttons[9]?.pressed;
  if (sH && !prevStart) {
    if (!state.running) startGame();
    else togglePause();
  }
  prevStart = sH;
}

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

function activateTurbo() {
  if (state.turboCd > 0 || state.turbo > 0) return;
  state.turbo = TURBO_DUR;
  state.turboCd = TURBO_CD;
  turboSfx();
}

function updateGame(dt) {
  state.time -= dt;
  if (state.time <= 0) {
    endGame();
    return;
  }
  state.turboCd = Math.max(0, state.turboCd - dt);
  state.turbo = Math.max(0, state.turbo - dt);

  const accel = keys['ArrowUp'] || keys['KeyW'];
  const brake = keys['ArrowDown'] || keys['KeyS'];
  const left = keys['ArrowLeft'] || keys['KeyA'];
  const right = keys['ArrowRight'] || keys['KeyD'];

  const maxSpd = state.turbo > 0 ? MAX_SPEED * TURBO_MULT : MAX_SPEED;
  if (accel) player.speed = Math.min(maxSpd, player.speed + ACCEL * dt);
  else if (brake) player.speed = Math.max(0, player.speed - BRAKE * dt);
  else player.speed = Math.max(0, player.speed - FRICTION * dt);

  if (left) player.x -= TURN_SPEED * dt * (player.speed / MAX_SPEED);
  if (right) player.x += TURN_SPEED * dt * (player.speed / MAX_SPEED);
  player.x = Math.max(-2.5, Math.min(2.5, player.x));

  const seg = getSeg(camZ);
  player.x += seg.curve * player.speed * dt * 0.003;

  camZ += player.speed * dt;
  state.score = Math.floor(camZ * 0.01);

  if (camZ >= (state.stage + 1) * STAGE_LEN) {
    state.stage++;
    state.time = Math.min(90, state.time + 15);
    stageSfx();
    say(`Stage ${state.stage + 1}`);
    if (state.stage >= 5) {
      endGame();
      return;
    }
  }

  for (const r of rivals) {
    r.z -= r.speed * dt;
    if (r.z < camZ - 50) r.z = camZ + 500 + Math.random() * 300;
    const dx = Math.abs(r.x - player.x);
    const dz = Math.abs(r.z - camZ);
    if (dx < 0.6 && dz < 30) {
      player.speed *= 0.3;
      crashSfx();
      triggerShake(6);
    }
  }

  if (player.speed > 20 && Math.random() < 0.08) engineSfx();
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, cW, cH);

  // Sky gradient
  const skyGrad = ctx.createLinearGradient(ox, oy, ox, oy + GH * 0.45 * sc);
  skyGrad.addColorStop(0, '#1a0a2a');
  skyGrad.addColorStop(0.5, '#2a1040');
  skyGrad.addColorStop(1, '#ff6b35');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(ox, oy, GW * sc, GH * 0.45 * sc);

  // Sun
  const sunY = oy + GH * 0.32 * sc;
  ctx.fillStyle = '#ffb800';
  ctx.beginPath();
  ctx.arc(ox + GW * 0.5 * sc, sunY, 25 * sc, 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, ox + GW * 0.5 * sc, sunY, 30 * sc, '#ffb800', 0.2, 3);

  // Road segments
  const baseSeg = Math.floor(camZ / SEG_LEN);
  let curveAcc = 0;

  for (let n = 0; n < DRAW_DIST; n++) {
    const idx = (baseSeg + n) % segments.length;
    const seg = segments[idx];
    const z = (baseSeg + n) * SEG_LEN;
    const p = project(0, seg.hill, z);
    if (!p || p.y > GH * sc) continue;

    const pNext = project(0, seg.hill, z + SEG_LEN);
    if (!pNext) continue;

    curveAcc += seg.curve;
    const offX = curveAcc * 2;

    const roadL = p.x - p.w * 0.5 + offX * sc;
    const roadR = p.x + p.w * 0.5 + offX * sc;
    const nextL = pNext.x - pNext.w * 0.5 + (curveAcc + seg.curve) * 2 * sc;
    const nextR = pNext.x + pNext.w * 0.5 + (curveAcc + seg.curve) * 2 * sc;

    // Grass
    const grassColor = idx % 2 === 0 ? '#1a4a1a' : '#1a3a1a';
    ctx.fillStyle = grassColor;
    ctx.fillRect(ox, p.y, GW * sc, pNext.y - p.y + 2);

    // Road
    const roadColor = idx % 2 === 0 ? '#333340' : '#2a2a35';
    ctx.fillStyle = roadColor;
    ctx.beginPath();
    ctx.moveTo(ox + roadL, p.y);
    ctx.lineTo(ox + roadR, p.y);
    ctx.lineTo(ox + nextR, pNext.y);
    ctx.lineTo(ox + nextL, pNext.y);
    ctx.fill();

    // Center line
    if (idx % 4 < 2) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(ox + p.x + offX * sc - 1, p.y, 2 * sc, pNext.y - p.y + 1);
    }

    // Edge lines
    ctx.fillStyle = '#ff2d78';
    ctx.fillRect(ox + roadL, p.y, 2 * sc, pNext.y - p.y + 1);
    ctx.fillRect(ox + roadR - 2 * sc, p.y, 2 * sc, pNext.y - p.y + 1);

    // Trees
    if (seg.hasTree && n > 2) {
      const treeX = roadL - 30 * sc;
      ctx.fillStyle = '#2a5a2a';
      ctx.fillRect(
        ox + treeX,
        p.y - 20 * sc * p.scale * 10,
        4 * sc * p.scale * 10,
        20 * sc * p.scale * 10,
      );
      ctx.fillStyle = '#3a8a3a';
      ctx.beginPath();
      ctx.arc(
        ox + treeX + 2 * sc * p.scale * 10,
        p.y - 25 * sc * p.scale * 10,
        10 * sc * p.scale * 10,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  // Rivals
  for (const r of rivals) {
    const relZ = r.z - camZ;
    if (relZ < 10 || relZ > DRAW_DIST * SEG_LEN) continue;
    const p = project(r.x, 0, r.z);
    if (!p) continue;
    const carW = 16 * p.scale * 100;
    const carH = 10 * p.scale * 100;
    ctx.fillStyle = r.color;
    ctx.fillRect(ox + p.x - carW * 0.5, p.y - carH, carW, carH);
    drawGlow(ctx, ox + p.x, p.y - carH * 0.5, carW * 0.5, r.color, 0.1, 2);
  }

  // Player car
  const carW = 20 * sc;
  const carH = 14 * sc;
  const carX = ox + GW * 0.5 * sc;
  const carY = oy + GH * 0.82 * sc;

  ctx.fillStyle = '#ff2d78';
  ctx.fillRect(carX - carW * 0.5, carY - carH, carW, carH);
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(carX - carW * 0.3, carY - carH * 0.7, carW * 0.6, carH * 0.3);

  // Turbo flame
  if (state.turbo > 0) {
    ctx.fillStyle = '#ffb800';
    const fh = (8 + Math.random() * 6) * sc;
    ctx.fillRect(carX - 3 * sc, carY, 6 * sc, fh);
    drawGlow(ctx, carX, carY + fh * 0.5, 10 * sc, '#ffb800', 0.2, 3);
  }

  drawGlow(ctx, carX, carY - carH * 0.5, carW * 0.6, '#ff2d78', 0.12, 2.5);

  drawParticles(ctx, ox, oy, sc);

  // Turbo bar
  if (state.turboCd > 0 || state.turbo > 0) {
    const bw = 80 * sc,
      bh = 6 * sc;
    const bx = ox + GW * sc - bw - 10 * sc,
      by = oy + 10 * sc;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, bw, bh);
    const fill = state.turbo > 0 ? state.turbo / TURBO_DUR : 1 - state.turboCd / TURBO_CD;
    ctx.fillStyle = state.turbo > 0 ? '#ffb800' : '#39ff14';
    ctx.fillRect(bx, by, bw * fill, bh);
  }

  if (state.paused && state.running) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(ox, oy, GW * sc, GH * sc);
    ctx.fillStyle = '#fff';
    ctx.font = `${28 * sc}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSA', ox + GW * sc * 0.5, oy + GH * sc * 0.5);
  }
  ctx.restore();
}

const timeEl = document.getElementById('timeValue');
const scoreEl = document.getElementById('scoreValue');
const speedEl = document.getElementById('speedValue');
function updateHUD() {
  timeEl.textContent = state.time > 0 ? Math.ceil(state.time) : '0';
  scoreEl.textContent = String(state.score);
  speedEl.textContent = Math.floor(player.speed);
}

const loop = createGameLoop((dt) => {
  pollGamepad();
  updateShake(dt);
  if (state.running && !state.gameOver && !state.paused) updateGame(dt);
  updateSquashes(dt);
  updateParticles(dt);
  updateHUD();
  draw();
});

updateHUD();
generateRoad();
shell.onCleanup(() => loop.stop());
document.getElementById('loading').classList.add('hidden');
loop.start();
