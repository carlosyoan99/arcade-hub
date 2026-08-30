import { ensureAudio, beep, startAmbient } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { startMusic, stopMusic } from '../../shared/music.js';
import { setupCanvas } from '../../shared/display.js';
import { setupGameShell } from '../../shared/shell.js';
import { loadBest, saveBest } from '../../shared/scores.js';
import { createGameLoop } from '../../shared/loop.js';
import { createGamepad, onKey, cleanupAll } from '../../shared/input.js';
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
const shell = setupGameShell('tempest');

/* ============================================================
   TEMPEST — Arcade Hub
   Tube shooter: player on the rim, enemies climb up.
   16-sided tube rendered in 2D with perspective.
   ============================================================ */

// ── CONSTANTS ──
const GAME_W = 480;
const GAME_H = 480;
const SIDES = 16;
const CENTER_X = GAME_W / 2;
const CENTER_Y = GAME_H * 0.42;
const RIM_RADIUS = 180;
const DEPTH = 200;
const BULLET_SPEED = 350;
const ENEMY_SPEED_BASE = 30;
const JUMP_DURATION = 0.5;

// ── STATE ──
const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: loadBest('tempest2d'),
  level: 1,
  wave: 0,
  enemiesRemaining: 0,
  spinProgress: 0,
  jumpsThisWave: 0,
};

// Player position on rim (angle index 0..SIDES-1)
let playerAngle = 0;
let playerJumping = false;
let jumpTimer = 0;
let jumpFromAngle = 0;
let jumpToAngle = 0;

// Enemies: { angle, depth (0=rims, 1=center), type, speed, alive }
let enemies = [];
let spawnTimer = 0;
let bullets = [];

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
function playShootSound() {
  beep({ freq: 800, freqEnd: 200, duration: 0.06, type: 'square', volume: 0.12 });
}
function playKillSound() {
  beep({ freq: 500, freqEnd: 100, duration: 0.1, type: 'triangle', volume: 0.15 });
}
function playJumpSound() {
  beep({ freq: 300, freqEnd: 600, duration: 0.12, type: 'sine', volume: 0.1 });
}
function playDeathSound() {
  feedbackBundle('large', CENTER_X, CENTER_Y, {
    color: '#00f0ff',
    noFlash: true,
    onBeep: () => beep({ freq: 400, freqEnd: 50, duration: 0.5, type: 'sawtooth', volume: 0.2 }),
  });
}

// ── TUBE GEOMETRY ──
function getSidePoint(angleIdx, depth) {
  // depth: 0 = rim (far), 1 = center (near)
  const angle = (angleIdx / SIDES) * Math.PI * 2 - Math.PI / 2;
  const perspective = 1 - depth * 0.7;
  const r = RIM_RADIUS * perspective;
  return {
    x: CENTER_X + Math.cos(angle) * r,
    y: CENTER_Y + Math.sin(angle) * r * 0.5 + depth * DEPTH * 0.3,
  };
}

function getSideScreenPos(angleIdx, depth) {
  const p = getSidePoint(angleIdx, depth);
  return { x: offX + p.x * scale, y: offY + p.y * scale };
}

// ── SPAWNING ──
function spawnWave() {
  if (state.wave === 10) achievements.unlock('survivor');
  state.wave++;
  state.level = Math.floor(state.wave / 3) + 1;
  state.jumpsThisWave = 0;
  const count = 4 + state.wave * 2;
  state.enemiesRemaining = count;
  spawnTimer = 0;

  for (let i = 0; i < count; i++) {
    const angle = Math.floor(Math.random() * SIDES);
    const type = Math.random() < 0.3 ? 'spiker' : Math.random() < 0.5 ? 'fuseball' : 'pulsar';
    enemies.push({
      angle,
      depth: 0,
      type,
      speed: ENEMY_SPEED_BASE + state.level * 5,
      alive: true,
      timer: Math.random() * 2,
    });
  }
}

// ── GAME FLOW ──
function startGame() {
  ensureAudio();
  state.score = 0;
  state.level = 1;
  state.wave = 0;
  state.running = true;
  state.gameOver = false;
  state.paused = false;

  playerAngle = 0;
  playerJumping = false;
  enemies = [];
  bullets = [];
  state.spinProgress = 0;

  clearSquashes();
  startAmbient();
  startMusic('tempest');
  shell.enableTabTrap();
  overlay.classList.add('hidden');
  spawnWave();
  say('Tempest — ¡Oleada 1!');
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  shell.disableTabTrap();
  stopMusic();
  playDeathSound();

  if (state.score > state.best) {
    state.best = state.score;
    saveBest('tempest2d', state.best);
  }

  finalScoreEl.textContent = `Puntos: ${state.score}`;
  finalScoreEl.style.display = '';
  overlayText.textContent = '¡Juego terminado!';
  hintEl.innerHTML =
    '<kbd>R</kbd> reiniciar &nbsp;·&nbsp; <kbd>Espacio</kbd> / tap para jugar de nuevo';
  overlay.classList.remove('hidden');
  say(`Juego terminado. Puntos: ${state.score}. Mejor: ${state.best}`);
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
}

// ── INPUT: KEYBOARD ──
function rotatePlayer(dir) {
  playerAngle = (playerAngle + dir + SIDES) % SIDES;
  state.spinProgress++;
  if (state.spinProgress >= SIDES) {
    achievements.unlock('spin_master');
    state.spinProgress = 0;
  }
}

onKey((e) => {
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

  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    rotatePlayer(-1);
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    rotatePlayer(1);
  } else if (e.code === 'Space') {
    e.preventDefault();
    shoot();
  } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    jump();
  }
});

// ── INPUT: TOUCH ──
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
  rotatePlayer(-1);
});
bindTouch('btnRight', () => {
  rotatePlayer(1);
});
bindTouch('btnFire', shoot);
bindTouch('btnUp', jump);

// ── INPUT: GAMEPAD ──
const gamepad = createGamepad();
let prevStart = false;

function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  const dpadLeft = !!gp.buttons[14]?.pressed;
  const dpadRight = !!gp.buttons[15]?.pressed;
  const aHeld = !!gp.buttons[0]?.pressed;
  const bHeld = !!gp.buttons[1]?.pressed;

  if (dpadLeft) rotatePlayer(-1);
  if (dpadRight) rotatePlayer(1);
  if (aHeld) shoot();
  if (bHeld) jump();

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

// ── ACTIONS ──
function shoot() {
  if (!state.running || state.gameOver || state.paused) return;
  bullets.push({
    angle: playerAngle,
    depth: 1,
    speed: BULLET_SPEED,
    alive: true,
  });
  playShootSound();
}

function jump() {
  if (!state.running || state.gameOver || state.paused || playerJumping) return;
  playerJumping = true;
  jumpTimer = JUMP_DURATION;
  jumpFromAngle = playerAngle;
  jumpToAngle = (playerAngle + 2) % SIDES;
  state.jumpsThisWave++;
  if (state.jumpsThisWave === 10) achievements.unlock('jump_pro');
  playJumpSound();
}

// ── UPDATE ──
function updateGame(dt) {
  // Jump animation
  if (playerJumping) {
    jumpTimer -= dt;
    if (jumpTimer <= 0) {
      playerJumping = false;
      playerAngle = jumpToAngle;
    } else {
      const t = 1 - jumpTimer / JUMP_DURATION;
      playerAngle = jumpFromAngle + (jumpToAngle - jumpFromAngle) * t;
    }
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.depth -= b.speed * dt * 0.003;
    if (b.depth < -0.1) {
      bullets.splice(i, 1);
    }
  }

  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.alive) continue;

    e.depth += e.speed * dt * 0.001;
    e.timer -= dt;

    // Enemy reaches rim = player dies
    if (e.depth >= 1) {
      if (Math.abs(e.angle - Math.round(playerAngle)) < 0.5 && !playerJumping) {
        endGame();
        return;
      }
      // Fuseballs kill on contact
      if (e.type === 'fuseball') {
        endGame();
        return;
      }
    }

    // Spiker digs at rim
    if (e.type === 'spiker' && e.depth >= 0.95) {
      // Creates a spikel at the rim (visual only for now)
    }
  }

  // Bullet-enemy collisions
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (!e.alive) continue;
      if (Math.abs(e.angle - b.angle) < 0.8 && Math.abs(e.depth - b.depth) < 0.15) {
        e.alive = false;
        bullets.splice(bi, 1);
        state.score += e.type === 'fuseball' ? 50 : 20;
        state.enemiesRemaining--;
        playKillSound();
        const pos = getSideScreenPos(e.angle, e.depth);
        spawnParticles(pos.x, pos.y, 6, '#00f0ff', { speed: 80, life: 0.3 });
        break;
      }
    }
  }

  // Clean dead enemies
  enemies = enemies.filter((e) => e.alive);

  // Next wave
  if (enemies.length === 0) {
    spawnTimer += dt;
    if (spawnTimer >= 1.5) {
      spawnWave();
      say(`Oleada ${state.wave}`);
    }
  }
}

// ── RENDER ──
function draw() {
  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);

  const ox = offX;
  const oy = offY;
  const s = scale;

  // Background
  ctx.fillStyle = '#050510';
  ctx.fillRect(ox, oy, GAME_W * s, GAME_H * s);

  // Draw tube walls (perspective lines from rim to center)
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i < SIDES; i++) {
    const rim = getSidePoint(i, 0);
    const center = getSidePoint(i, 1);
    ctx.beginPath();
    ctx.moveTo(ox + rim.x * s, oy + rim.y * s);
    ctx.lineTo(ox + center.x * s, oy + center.y * s);
    ctx.stroke();
  }

  // Draw rim (ellipse)
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  for (let i = 0; i <= SIDES; i++) {
    const p = getSidePoint(i % SIDES, 0);
    if (i === 0) ctx.moveTo(ox + p.x * s, oy + p.y * s);
    else ctx.lineTo(ox + p.x * s, oy + p.y * s);
  }
  ctx.closePath();
  ctx.stroke();

  // Draw enemies
  for (const e of enemies) {
    const pos = getSideScreenPos(e.angle, e.depth);
    const size = (4 + e.depth * 8) * s;

    if (e.type === 'fuseball') {
      ctx.fillStyle = '#ff5e7a';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      drawGlow(ctx, pos.x, pos.y, size * 0.3, '#ff5e7a', 0.15, 2);
    } else if (e.type === 'spiker') {
      ctx.fillStyle = '#ffb800';
      ctx.fillRect(pos.x - size * 0.3, pos.y - size * 0.5, size * 0.6, size);
    } else {
      // pulsar
      ctx.fillStyle = '#39ff14';
      const pulse = 1 + Math.sin(e.timer * 8) * 0.3;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, size * 0.4 * pulse, 0, Math.PI * 2);
      ctx.fill();
      drawGlow(ctx, pos.x, pos.y, size * 0.3, '#39ff14', 0.12, 2);
    }
  }

  // Draw bullets
  for (const b of bullets) {
    const pos = getSideScreenPos(b.angle, b.depth);
    const size = (3 + b.depth * 4) * s;
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, pos.x, pos.y, size * 0.3, '#00f0ff', 0.2, 2.5);
  }

  // Draw player
  const playerPos = getSideScreenPos(Math.round(playerAngle) % SIDES, 1);
  const playerSize = 10 * s;

  if (playerJumping) {
    // Jump arc
    const jumpHeight = Math.sin((1 - jumpTimer / JUMP_DURATION) * Math.PI) * 30;
    const fromPos = getSideScreenPos(jumpFromAngle, 1);
    const toPos = getSideScreenPos(jumpToAngle, 1);
    const t = 1 - jumpTimer / JUMP_DURATION;
    const jx = fromPos.x + (toPos.x - fromPos.x) * t;
    const jy = fromPos.y + (toPos.y - fromPos.y) * t - jumpHeight * s;

    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(jx, jy, playerSize * 0.6, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, jx, jy, playerSize * 0.4, '#00f0ff', 0.2, 3);
  } else {
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, playerSize * 0.6, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, playerPos.x, playerPos.y, playerSize * 0.4, '#00f0ff', 0.2, 3);
  }

  // ── Particles ──
  drawParticles(ctx, offX, offY, scale);

  // ── Pause overlay ──
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
const scoreValueEl = document.getElementById('scoreValue');
const bestValueEl = document.getElementById('bestValue');
const levelValueEl = document.getElementById('levelValue');

function updateHUD() {
  scoreValueEl.textContent = String(state.score);
  bestValueEl.textContent = String(state.best);
  levelValueEl.textContent = String(state.level);
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
updateHUD();

shell.onCleanup(() => { cleanupAll(); loop.stop(); });
document.getElementById('loading').classList.add('hidden');
loop.start();
