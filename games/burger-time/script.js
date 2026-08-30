import { ensureAudio, beep, startAmbient } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
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
const shell = setupGameShell('burger-time');

const GW = 400;
const GH = 400;
const PLAT_COUNT = 5;
const PLAT_H = 6;
const PLAT_GAP = 70;
const PLAT_Y = (i) => 40 + i * PLAT_GAP;
const PLAYER_W = 14;
const PLAYER_H = 20;
const SPEED = 80;
const CLIMB_SPEED = 60;
const INGREDIENT_W = 30;
const INGREDIENT_H = 8;
const BUN_TOP = 0,
  LETTUCE = 1,
  TOMATO = 2,
  PATTY = 3,
  BUN_BOT = 4;
const INGREDIENT_COLOR = ['#ffb800', '#39ff14', '#ff2d78', '#8B4513', '#ffb800'];
const ENEMY_TYPES = {
  hotdog: { color: '#ff5e7a', speed: 35, score: 20 },
  pickle: { color: '#39ff14', speed: 25, score: 30 },
  egg: { color: '#ffe066', speed: 30, score: 25 },
};

const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: loadBest('burgerTime'),
  level: 1,
  lives: 3,
  burgersCompleted: 0,
  pepperCount: 3,
};

const player = { x: GW / 2, y: PLAT_Y(4), plat: 4, onLadder: false, facing: 1, stunned: 0 };
let ingredients = [];
let enemies = [];
let platforms = [];

function sfx(f, e, d, t, v) {
  beep({ freq: f, freqEnd: e, duration: d, type: t, volume: v });
}
function stepSfx() {
  sfx(300, 200, 0.04, 'square', 0.06);
}
function stackSfx() {
  sfx(500, 800, 0.15, 'triangle', 0.2);
}
function deathSfx() {
  feedbackBundle('large', player.x, player.y, {
    color: '#ff5e7a',
    noFlash: true,
    onBeep: () => sfx(300, 40, 0.5, 'sawtooth', 0.2),
  });
}

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const { w: cW, h: cH, s: sc, x: ox, y: oy } = setupCanvas(canvas, ctx, GW, GH, 10);

function buildLevel() {
  platforms = [];
  for (let i = 0; i < PLAT_COUNT; i++) {
    const y = PLAT_Y(i);
    const gaps =
      i === 0
        ? []
        : [60 + Math.random() * (GW - 120), 60 + Math.random() * (GW - 120)].sort((a, b) => a - b);
    platforms.push({ y, gaps, width: GW });
  }
  ingredients = [];
  for (let p = 0; p < PLAT_COUNT - 1; p++) {
    const y = PLAT_Y(p) - 12;
    const types = [BUN_BOT, PATTY, TOMATO, LETTUCE, BUN_TOP];
    for (let j = 0; j < types.length; j++) {
      ingredients.push({
        x: 80 + j * 55,
        y,
        baseY: y,
        plat: p,
        type: types[j],
        falling: false,
        fallTimer: 0,
        landed: false,
      });
    }
  }
  enemies = [];
  const etypes = Object.keys(ENEMY_TYPES);
  for (let i = 0; i < 3 + state.level; i++) {
    const t = etypes[i % etypes.length];
    const e = ENEMY_TYPES[t];
    enemies.push({
      x: 40 + Math.random() * (GW - 80),
      plat: Math.floor(Math.random() * PLAT_COUNT),
      type: t,
      color: e.color,
      speed: e.speed + state.level * 3,
      facing: Math.random() < 0.5 ? 1 : -1,
      stunned: 0,
    });
  }
}

function getLadderX(platIdx) {
  return platforms[platIdx].gaps[0] || GW / 2;
}

function startGame() {
  ensureAudio();
  state.score = 0;
  state.level = 1;
  state.burgersCompleted = 0;
  state.pepperCount = 3;
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  player.x = GW / 2;
  player.y = PLAT_Y(4);
  player.plat = 4;
  player.onLadder = false;
  player.stunned = 0;
  buildLevel();
  clearSquashes();
  startAmbient();
  startMusic('burger-time');
  shell.enableTabTrap();
  overlay.classList.add('hidden');
  say('BurgerTime — ¡A cocinar!');
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  shell.disableTabTrap();
  stopMusic();
  deathSfx();
  if (state.score > state.best) {
    state.best = state.score;
    saveBest('burgerTime', state.best);
  }
  achievements.unlock('bt_first_cook');
  if (state.score >= 1000) achievements.unlock('bt_high_scorer');
  if (state.burgersCompleted >= 3) achievements.unlock('bt_speed_cook');
  finalScoreEl.textContent = `Puntos: ${state.score}`;
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
  if (e.code === 'KeyZ' && state.pepperCount > 0) {
    e.preventDefault();
    usePepper();
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
bindTouch('btnLeft', () => {
  keys['ArrowLeft'] = true;
  setTimeout(() => (keys['ArrowLeft'] = false), 80);
});
bindTouch('btnRight', () => {
  keys['ArrowRight'] = true;
  setTimeout(() => (keys['ArrowRight'] = false), 80);
});
bindTouch('btnUp', () => {
  keys['ArrowUp'] = true;
  setTimeout(() => (keys['ArrowUp'] = false), 80);
});
bindTouch('btnDown', () => {
  keys['ArrowDown'] = true;
  setTimeout(() => (keys['ArrowDown'] = false), 80);
});
bindTouch('btnPepper', () => {
  if (state.pepperCount > 0) usePepper();
});

const gamepad = createGamepad();
let prevStart = false;
function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  keys['ArrowLeft'] = !!gp.buttons[14]?.pressed;
  keys['ArrowRight'] = !!gp.buttons[15]?.pressed;
  keys['ArrowUp'] = !!gp.buttons[12]?.pressed;
  keys['ArrowDown'] = !!gp.buttons[13]?.pressed;
  if (!!gp.buttons[0]?.pressed && state.pepperCount > 0) usePepper();
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

function usePepper() {
  state.pepperCount--;
  sfx(600, 200, 0.15, 'triangle', 0.15);
  for (const e of enemies) {
    if (Math.abs(e.x - player.x) < 50 && e.plat === player.plat) {
      e.stunned = 3;
    }
  }
}

function updateGame(dt) {
  if (player.stunned > 0) {
    player.stunned -= dt;
    return;
  }

  let moving = false;
  if (keys['ArrowLeft'] || keys['KeyA']) {
    player.x -= SPEED * dt;
    player.facing = -1;
    moving = true;
  }
  if (keys['ArrowRight'] || keys['KeyD']) {
    player.x += SPEED * dt;
    player.facing = 1;
    moving = true;
  }
  player.x = Math.max(PLAYER_W, Math.min(GW - PLAYER_W, player.x));

  if (!player.onLadder) {
    if (keys['ArrowUp'] || keys['KeyW']) {
      const lx = getLadderX(player.plat);
      if (Math.abs(player.x - lx) < 20 && player.plat > 0) {
        player.onLadder = true;
      }
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      if (player.plat < PLAT_COUNT - 1) {
        const lx = getLadderX(player.plat + 1);
        if (Math.abs(player.x - lx) < 20) {
          player.onLadder = true;
          player.plat++;
        }
      }
    }
  }

  if (player.onLadder) {
    const targetY = PLAT_Y(player.plat);
    if (keys['ArrowUp'] || keys['KeyW']) {
      player.y -= CLIMB_SPEED * dt;
      moving = true;
    }
    if (keys['ArrowDown'] || keys['KeyS']) {
      player.y += CLIMB_SPEED * dt;
      moving = true;
    }
    if (Math.abs(player.y - targetY) < 4) {
      player.y = targetY;
      player.onLadder = false;
    }
  } else {
    player.y = PLAT_Y(player.plat);
  }

  if (moving && Math.random() < 0.1) stepSfx();

  // Ingredients: check if player walks over
  for (const ing of ingredients) {
    if (ing.falling || ing.landed) continue;
    if (
      Math.abs(ing.x - player.x) < INGREDIENT_W * 0.6 &&
      ing.plat === player.plat &&
      !player.onLadder
    ) {
      ing.falling = true;
      ing.fallTimer = 0;
      sfx(200, 100, 0.08, 'square', 0.1);
    }
  }

  // Falling ingredients
  for (const ing of ingredients) {
    if (!ing.falling) continue;
    ing.fallTimer += dt;
    ing.y += 120 * dt;
    const nextPlatY = PLAT_Y(ing.plat + 1);
    if (ing.y >= nextPlatY - 10) {
      ing.y = nextPlatY - 10;
      ing.falling = false;
      ing.plat++;
      ing.landed = true;
      sfx(400, 300, 0.06, 'triangle', 0.1);
    }
  }

  // Check completed burgers
  for (let p = 0; p < PLAT_COUNT; p++) {
    const bunBot = ingredients.find((i) => i.type === BUN_BOT && i.plat === p && i.landed);
    if (!bunBot) continue;
    const stack = [BUN_BOT, PATTY, TOMATO, LETTUCE, BUN_TOP];
    let complete = true;
    for (let s = 0; s < stack.length; s++) {
      const found = ingredients.find(
        (i) => i.type === stack[s] && i.plat === p && i.landed && Math.abs(i.x - bunBot.x) < 20,
      );
      if (!found) {
        complete = false;
        break;
      }
    }
    if (complete) {
      state.score += 200;
      state.burgersCompleted++;
      stackSfx();
      // Remove completed ingredients
      for (let i = ingredients.length - 1; i >= 0; i--) {
        const ing = ingredients[i];
        if (ing.plat === p && ing.landed) {
          spawnParticles(ox + ing.x * sc, oy + ing.y * sc, 5, INGREDIENT_COLOR[ing.type], {
            speed: 60,
            life: 0.3,
          });
          ingredients.splice(i, 1);
        }
      }
      // Check if level complete
      if (ingredients.length === 0) {
        state.level++;
        buildLevel();
        say(`Nivel ${state.level}`);
      }
    }
  }

  // Enemies
  for (const e of enemies) {
    if (e.stunned > 0) {
      e.stunned -= dt;
      continue;
    }
    e.x += e.facing * e.speed * dt;
    if (e.x < 20 || e.x > GW - 20) e.facing *= -1;
    // Simple pathfinding: if near ladder, sometimes climb
    if (Math.random() < 0.005) {
      if (e.plat > 0 && Math.abs(e.x - getLadderX(e.plat)) < 20) {
        e.plat--;
        e.y = PLAT_Y(e.plat);
      } else if (e.plat < PLAT_COUNT - 1) {
        e.plat++;
        e.y = PLAT_Y(e.plat);
      }
    }
    // Collision with player
    if (Math.abs(e.x - player.x) < 16 && e.plat === player.plat && player.stunned <= 0) {
      player.stunned = 1;
      state.lives--;
      state.score = Math.max(0, state.score - 50);
      sfx(150, 50, 0.2, 'sawtooth', 0.15);
      if (state.lives <= 0) endGame();
    }
  }
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, cW, cH);

  ctx.fillStyle = '#120a08';
  ctx.fillRect(ox, oy, GW * sc, GH * sc);

  // Platforms
  for (let i = 0; i < PLAT_COUNT; i++) {
    const p = platforms[i];
    const y = oy + PLAT_Y(i) * sc;
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(ox, y, GW * sc, PLAT_H * sc);
    // Gaps
    for (const g of p.gaps) {
      ctx.fillStyle = '#120a08';
      ctx.fillRect(ox + (g - 15) * sc, y - 2 * sc, 30 * sc, (PLAT_H + 4) * sc);
    }
    // Ladder
    const lx = ox + getLadderX(i) * sc;
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(lx - 3 * sc, y - PLAT_GAP * sc + PLAT_H * sc, 6 * sc, PLAT_GAP * sc - PLAT_H * sc);
    for (let r = 0; r < 4; r++) {
      const ry = y - PLAT_GAP * sc + PLAT_H * sc + r * (PLAT_GAP / 5) * sc;
      ctx.fillRect(lx - 6 * sc, ry, 12 * sc, 2 * sc);
    }
  }

  // Ingredients
  for (const ing of ingredients) {
    const sx = ox + ing.x * sc;
    const sy = oy + ing.y * sc;
    ctx.fillStyle = INGREDIENT_COLOR[ing.type];
    ctx.fillRect(sx - INGREDIENT_W * sc * 0.5, sy, INGREDIENT_W * sc, INGREDIENT_H * sc);
    drawGlow(
      ctx,
      sx,
      sy + INGREDIENT_H * sc * 0.5,
      INGREDIENT_W * sc * 0.4,
      INGREDIENT_COLOR[ing.type],
      0.1,
      2,
    );
  }

  // Enemies
  for (const e of enemies) {
    const sx = ox + e.x * sc;
    const sy = oy + PLAT_Y(e.plat) * sc - PLAYER_H * sc;
    if (e.stunned > 0) ctx.globalAlpha = 0.4;
    ctx.fillStyle = e.color;
    ctx.fillRect(sx - 7 * sc, sy, 14 * sc, PLAYER_H * sc);
    drawGlow(ctx, sx, sy + PLAYER_H * sc * 0.5, 8 * sc, e.color, 0.1, 2);
    ctx.globalAlpha = 1;
  }

  // Player
  if (player.stunned > 0 && Math.floor(player.stunned * 8) % 2) ctx.globalAlpha = 0.3;
  const px = ox + player.x * sc;
  const py = oy + player.y * sc - PLAYER_H * sc;
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(px - PLAYER_W * sc * 0.5, py, PLAYER_W * sc, PLAYER_H * sc);
  ctx.fillStyle = '#ffb800';
  ctx.beginPath();
  ctx.arc(px, py - 3 * sc, 4 * sc, 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, px, py + PLAYER_H * sc * 0.5, PLAYER_W * sc, '#00f0ff', 0.1, 2);
  ctx.globalAlpha = 1;

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
const levelEl = document.getElementById('levelValue');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
  levelEl.textContent = String(state.level);
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
buildLevel();
shell.onCleanup(() => { cleanupAll(); loop.stop(); });
document.getElementById('loading').classList.add('hidden');
loop.start();
