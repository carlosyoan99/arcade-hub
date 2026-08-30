import { ensureAudio, beep, startAmbient } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements, setHint } from '../../shared/dom.js';
import { startMusic, stopMusic } from '../../shared/music.js';
import { setupCanvas } from '../../shared/display.js';
import { setupGameShell } from '../../shared/shell.js';
import { loadBest, saveBest } from '../../shared/scores.js';
import { createGameLoop } from '../../shared/loop.js';
import { createGamepad, onKey, onKeyup, cleanupAll } from '../../shared/input.js';
import {
  updateShake,
  spawnParticles,
  updateParticles,
  drawParticles,
  drawGlow,
  feedbackBundle,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();
const shell = setupGameShell('paperboy');

const GW = 480;
const GH = 320;
const LANE_COUNT = 3;
const LANE_H = 40;
const ROAD_TOP = GH * 0.5;
const PLAYER_X = 80;
const BIKE_W = 20;
const BIKE_H = 14;
const SCROLL_SPEED = 70;
const DAY_LENGTH = 45;
const HOUSE_SPACING = 90;

const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: loadBest('paperboy'),
  day: 1,
  time: DAY_LENGTH,
  lane: 1,
  subscribers: 0,
  papersThrown: 0,
  papersDelivered: 0,
};

const player = { lane: 1, y: 0, targetY: 0 };
let papers = [];
let obstacles = [];
let houses = [];
let scrollX = 0;
let throwCooldown = 0;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const { w: cW, h: cH, s: sc, x: ox, y: oy } = setupCanvas(canvas, ctx, GW, GH, 10);

function sfx(f, e, d, t, v) {
  beep({ freq: f, freqEnd: e, duration: d, type: t, volume: v });
}
function throwSfx() {
  sfx(500, 300, 0.06, 'square', 0.1);
}
function deliverSfx() {
  sfx(600, 900, 0.12, 'triangle', 0.15);
}
function crashSfx() {
  feedbackBundle('large', PLAYER_X, player.y, {
    color: '#ff5e7a',
    noFlash: true,
    onBeep: () => sfx(200, 40, 0.4, 'sawtooth', 0.2),
  });
}

function laneY(lane) {
  return ROAD_TOP + lane * LANE_H + LANE_H * 0.5;
}

function generateHouses() {
  houses = [];
  for (let i = 0; i < 30; i++) {
    const subscribed = Math.random() < 0.6;
    houses.push({
      x: GW + i * HOUSE_SPACING + Math.random() * 30,
      lane: Math.floor(Math.random() * 3),
      subscribed,
      delivered: false,
      color: subscribed ? '#39ff14' : '#666',
    });
  }
}

function generateObstacles() {
  obstacles = [];
  for (let i = 0; i < 20; i++) {
    const types = ['car', 'fence', 'dog', 'truck'];
    const type = types[Math.floor(Math.random() * types.length)];
    obstacles.push({
      x: GW + 100 + i * 120 + Math.random() * 60,
      lane: Math.floor(Math.random() * 3),
      type,
      w: type === 'truck' ? 50 : type === 'car' ? 35 : type === 'fence' ? 20 : 16,
      h: type === 'dog' ? 10 : 14,
      speed: type === 'dog' ? 40 : 0,
    });
  }
}

function startGame() {
  ensureAudio();
  state.score = 0;
  state.day = 1;
  state.time = DAY_LENGTH;
  state.lane = 1;
  state.subscribers = 0;
  state.papersThrown = 0;
  state.papersDelivered = 0;
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  player.lane = 1;
  player.y = laneY(1);
  player.targetY = laneY(1);
  papers = [];
  obstacles = [];
  scrollX = 0;
  throwCooldown = 0;
  generateHouses();
  generateObstacles();
  clearSquashes();
  startAmbient();
  startMusic('paperboy');
  shell.enableTabTrap();
  overlay.classList.add('hidden');
  say('Paperboy — ¡A entregar!');
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  shell.disableTabTrap();
  stopMusic();
  crashSfx();
  if (state.score > state.best) {
    state.best = state.score;
    saveBest('paperboy', state.best);
  }
  achievements.unlock('pb_first_delivery');
  if (state.score >= 500) achievements.unlock('pb_high_scorer');
  if (state.papersDelivered >= 20) achievements.unlock('pb_perfect_delivery');
  finalScoreEl.textContent = `Puntos: ${state.score}`;
  finalScoreEl.style.display = '';
  overlayText.textContent = '¡Juego terminado!';
  setHint(hintEl, '{R} reiniciar · {Espacio} / tap para jugar de nuevo');
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
}

const keys = {};
onKey((e) => {
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
  if ((e.code === 'ArrowUp' || e.code === 'KeyW') && state.lane > 0) {
    e.preventDefault();
    state.lane--;
    throwSfx();
  }
  if ((e.code === 'ArrowDown' || e.code === 'KeyS') && state.lane < LANE_COUNT - 1) {
    e.preventDefault();
    state.lane++;
    throwSfx();
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    throwPaper();
  }
});
onKeyup((e) => {
  keys[e.code] = false;
});

function bindTouch(id, fn) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      btn.classList.add('is-pressed');
      if (!state.running) startGame();
      fn();
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
    fn();
  });
}
bindTouch('btnUp', () => {
  if (state.lane > 0) state.lane--;
});
bindTouch('btnDown', () => {
  if (state.lane < LANE_COUNT - 1) state.lane++;
});
bindTouch('btnThrow', throwPaper);

const gamepad = createGamepad();
let prevStart = false;
function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  if (!!gp.buttons[12]?.pressed && state.lane > 0) state.lane--;
  if (!!gp.buttons[13]?.pressed && state.lane < LANE_COUNT - 1) state.lane++;
  if (gp.buttons[15]?.pressed) throwPaper();
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

function throwPaper() {
  if (throwCooldown > 0) return;
  throwCooldown = 0.3;
  state.papersThrown++;
  papers.push({
    x: PLAYER_X + BIKE_W,
    y: player.y - 4,
    lane: state.lane,
    vx: 200,
    delivered: false,
  });
  throwSfx();
}

function updateGame(dt) {
  state.time -= dt;
  if (state.time <= 0) {
    state.day++;
    state.time = DAY_LENGTH;
    generateHouses();
    generateObstacles();
    say(`Día ${state.day}`);
    return;
  }

  scrollX += SCROLL_SPEED * dt;
  throwCooldown -= dt;
  state.score = Math.floor(scrollX * 0.05) + state.papersDelivered * 30;

  // Player lane movement
  const targetY = laneY(state.lane);
  player.y += (targetY - player.y) * dt * 12;

  // Update papers
  for (let i = papers.length - 1; i >= 0; i--) {
    const p = papers[i];
    p.x += p.vx * dt;
    if (p.x > GW + 20) {
      papers.splice(i, 1);
      continue;
    }

    // Check house delivery
    for (const h of houses) {
      if (h.delivered || h.lane !== p.lane) continue;
      if (Math.abs(p.x - h.x) < 20 && Math.abs(scrollX - (h.x - GW)) < 30) {
        h.delivered = true;
        papers.splice(i, 1);
        if (h.subscribed) {
          state.papersDelivered++;
          state.subscribers++;
          deliverSfx();
          spawnParticles(ox + h.x * sc, oy + laneY(h.lane) * sc, 5, '#39ff14', {
            speed: 60,
            life: 0.3,
          });
        } else {
          state.score = Math.max(0, state.score - 20);
          sfx(200, 100, 0.1, 'sawtooth', 0.1);
        }
        break;
      }
    }
  }

  // Update obstacles
  for (const o of obstacles) {
    o.x -= SCROLL_SPEED * dt;
    if (o.type === 'dog') o.x -= o.speed * dt;
    if (o.x < -60) {
      o.x = GW + 100 + Math.random() * 200;
      o.lane = Math.floor(Math.random() * 3);
    }

    // Collision with player
    if (o.lane === state.lane && Math.abs(o.x - PLAYER_X) < o.w * 0.7) {
      endGame();
      return;
    }
  }
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, cW, cH);

  // Sky
  const skyGrad = ctx.createLinearGradient(ox, oy, ox, oy + ROAD_TOP * sc);
  skyGrad.addColorStop(0, '#0a120e');
  skyGrad.addColorStop(1, '#1a2a1a');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(ox, oy, GW * sc, ROAD_TOP * sc);

  // Road
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(ox, oy + ROAD_TOP * sc, GW * sc, LANE_COUNT * LANE_H * sc);

  // Lane markers
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  for (let i = 1; i < LANE_COUNT; i++) {
    const y = oy + (ROAD_TOP + i * LANE_H) * sc;
    ctx.setLineDash([10 * sc, 10 * sc]);
    ctx.beginPath();
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + GW * sc, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Houses
  for (const h of houses) {
    const hx = ox + (h.x - scrollX) * sc;
    if (hx < -50 || hx > GW + 50) continue;
    const hy = oy + laneY(h.lane) * sc;
    ctx.fillStyle = h.subscribed ? '#1a3a1a' : '#1a1a1a';
    ctx.fillRect(hx - 15 * sc, hy - 18 * sc, 30 * sc, 20 * sc);
    ctx.fillStyle = h.delivered ? '#39ff14' : h.color;
    ctx.fillRect(hx - 12 * sc, hy - 12 * sc, 8 * sc, 8 * sc);
    if (h.delivered) {
      ctx.fillStyle = '#39ff14';
      ctx.font = `${10 * sc}px monospace`;
      ctx.fillText('✓', hx - 4 * sc, hy - 4 * sc);
    }
  }

  // Obstacles
  for (const o of obstacles) {
    const sx = ox + o.x * sc;
    const sy = oy + laneY(o.lane) * sc;
    if (sx < -60 || sx > GW + 60) continue;
    if (o.type === 'car') {
      ctx.fillStyle = '#ff5e7a';
      ctx.fillRect(sx - o.w * sc * 0.5, sy - o.h * sc * 0.5, o.w * sc, o.h * sc);
    } else if (o.type === 'truck') {
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(sx - o.w * sc * 0.5, sy - o.h * sc * 0.5, o.w * sc, o.h * sc);
    } else if (o.type === 'fence') {
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(sx - o.w * sc * 0.5, sy - o.h * sc, o.w * sc, o.h * sc * 2);
    } else {
      ctx.fillStyle = '#ffb800';
      ctx.beginPath();
      ctx.arc(sx, sy, o.w * sc * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Papers
  for (const p of papers) {
    const sx = ox + p.x * sc;
    const sy = oy + p.y * sc;
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - 4 * sc, sy - 3 * sc, 8 * sc, 6 * sc);
    drawGlow(ctx, sx, sy, 5 * sc, '#fff', 0.1, 2);
  }

  // Player bike
  const px = ox + PLAYER_X * sc;
  const py = oy + player.y * sc;
  ctx.fillStyle = '#ffb800';
  ctx.fillRect(px - BIKE_W * sc * 0.5, py - BIKE_H * sc * 0.5, BIKE_W * sc, BIKE_H * sc);
  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  ctx.arc(px - 4 * sc, py - BIKE_H * sc * 0.5 - 3 * sc, 4 * sc, 0, Math.PI * 2);
  ctx.fill();
  // Wheels
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(px - 6 * sc, py + BIKE_H * sc * 0.5, 3 * sc, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px + 6 * sc, py + BIKE_H * sc * 0.5, 3 * sc, 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, px, py, BIKE_W * sc, '#ffb800', 0.1, 2);

  drawParticles(ctx, ox, oy, sc);

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

const scoreEl = document.getElementById('scoreValue');
const bestEl = document.getElementById('bestValue');
const dayEl = document.getElementById('dayValue');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
  dayEl.textContent = String(state.day);
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
shell.onCleanup(() => {
  cleanupAll();
  loop.stop();
});
document.getElementById('loading').classList.add('hidden');
loop.start();
