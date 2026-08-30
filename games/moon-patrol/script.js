import { ensureAudio, beep, startAmbient } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements, setHint } from '../../shared/dom.js';
import { startMusic } from '../../shared/music.js';
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
const shell = setupGameShell('moon-patrol');

/* ============================================================
   MOON PATROL — Arcade Hub
   Side-scroll lunar shooter: 3 lanes, forward + up shooting.
   ============================================================ */

// ── CONSTANTS ──
const GAME_W = 480;
const GAME_H = 320;
const GROUND_Y = GAME_H - 60;
const PLAYER_W = 24;
const PLAYER_H = 16;
const BULLET_SPEED = 300;
const JUMP_FORCE = 250;
const GRAVITY = 600;
const SCROLL_SPEED = 80;
const LEVEL_BASE_DIST = 2200;
const CRATER_W = 30;
const RAPID_COOLDOWN = 0.05;
const NORMAL_COOLDOWN = 0.15;
const POWERUP_DURATION = 8;

// ── STATE ──
const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: loadBest('moonPatrol'),
  level: 1,
  levelTimer: 0,
  levelDist: 0,
  levelDistTarget: LEVEL_BASE_DIST,
  jumpsThisLevel: 0,
  tripleTimer: 0,
  rapidTimer: 0,
  tripleKills: 0,
  scrollX: 0,
};

// Player
const player = { x: 80, y: GROUND_Y, vy: 0, grounded: true, lane: 2, w: PLAYER_W, h: PLAYER_H };
// Bullets
let bullets = [];
// Enemies
let enemies = [];
// Craters / obstacles
let obstacles = [];
// Power-up pickups
let powerups = [];
// Stars (background)
let stars = [];
// Terrain segments
let terrain = [];

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
  beep({ freq: 600, freqEnd: 200, duration: 0.06, type: 'square', volume: 0.12 });
}
function playJumpSound() {
  beep({ freq: 300, freqEnd: 600, duration: 0.1, type: 'triangle', volume: 0.12 });
}
function playHitSound() {
  feedbackBundle('medium', player.x, player.y, {
    color: '#ffb800',
    onBeep: () => beep({ freq: 400, freqEnd: 100, duration: 0.15, type: 'sawtooth', volume: 0.18 }),
  });
}
function playDeathSound() {
  feedbackBundle('large', player.x, player.y, {
    color: '#ff5e7a',
    noFlash: true,
    onBeep: () => beep({ freq: 300, freqEnd: 40, duration: 0.5, type: 'sawtooth', volume: 0.2 }),
  });
}

// ── TERRAIN GENERATION ──
function generateTerrain() {
  terrain = [];
  for (let i = 0; i < 200; i++) {
    terrain.push({
      x: i * 60 + Math.random() * 30,
      hasCrater: Math.random() < 0.3,
      craterW: CRATER_W + Math.random() * 20,
    });
  }
}

function generateStars() {
  stars = [];
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * GAME_W,
      y: Math.random() * (GROUND_Y - 30),
      size: Math.random() * 2 + 0.5,
      brightness: Math.random() * 0.5 + 0.5,
    });
  }
}

// ── SPAWNING ──
function spawnEnemy() {
  const type = Math.random();
  if (type < 0.4) {
    // Rover (ground)
    enemies.push({
      x: GAME_W + 20,
      y: GROUND_Y - PLAYER_H + 2,
      type: 'rover',
      speed: 60 + state.level * 10,
      w: 20,
      h: 12,
    });
  } else if (type < 0.7) {
    // UFO (air)
    enemies.push({
      x: GAME_W + 20,
      y: GROUND_Y - 40 - Math.random() * 60,
      type: 'ufo',
      speed: 40 + state.level * 8,
      w: 16,
      h: 10,
      shootTimer: 2 + Math.random() * 3,
    });
  } else {
    // Crater or mine (ground obstacle)
    if (Math.random() < 0.5) {
      obstacles.push({
        x: GAME_W + 20,
        y: GROUND_Y - 6,
        w: CRATER_W + Math.random() * 20,
        h: 6,
        kind: 'crater',
      });
    } else {
      obstacles.push({
        x: GAME_W + 20,
        y: GROUND_Y - 4,
        w: 12,
        h: 8,
        kind: 'mine',
      });
    }
  }
}

function spawnPowerUp() {
  const kinds = ['triple', 'rapid'];
  powerups.push({
    x: GAME_W + 20,
    y: GROUND_Y - PLAYER_H - 14 - Math.random() * 40,
    kind: kinds[Math.floor(Math.random() * kinds.length)],
    w: 16,
    h: 16,
    blink: 0,
  });
}

// ── COLLISION ──
function rectCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ── GAME FLOW ──
function startGame() {
  ensureAudio();
  state.score = 0;
  state.level = 1;
  state.levelTimer = 0;
  state.scrollX = 0;
  state.running = true;
  state.gameOver = false;
  state.paused = false;

  player.x = 80;
  player.y = GROUND_Y;
  player.vy = 0;
  player.grounded = true;
  bullets = [];
  enemies = [];
  obstacles = [];
  powerups = [];
  state.levelTimer = 0;
  state.levelDist = 0;
  state.levelDistTarget = LEVEL_BASE_DIST;
  state.jumpsThisLevel = 0;
  state.tripleTimer = 0;
  state.rapidTimer = 0;
  state.tripleKills = 0;

  generateTerrain();
  generateStars();
  clearSquashes();
  startAmbient();
  startMusic('moon-patrol');
  shell.enableTabTrap();
  overlay.classList.add('hidden');
  say('Moon Patrol — ¡Patrullando la luna!');
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  shell.disableTabTrap();
  playDeathSound();

  if (state.score > state.best) {
    state.best = state.score;
    saveBest('moonPatrol', state.best);
  }

  finalScoreEl.textContent = `Puntos: ${state.score}`;
  finalScoreEl.style.display = '';
  overlayText.textContent = '¡Juego terminado!';
  setHint(hintEl, '{R} reiniciar &nbsp;·&nbsp; {Espacio} / tap para jugar de nuevo');
  overlay.classList.remove('hidden');
  say(`Juego terminado. Puntos: ${state.score}. Mejor: ${state.best}`);
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
}

// ── INPUT: KEYBOARD ──
const keys = {};
function doJump() {
  if (!player.grounded) return;
  player.vy = -JUMP_FORCE;
  player.grounded = false;
  state.jumpsThisLevel++;
  playJumpSound();
}

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

  if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    doJump();
  }
  if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    fireForward();
  }
});

function fireForward() {
  const originX = player.x + PLAYER_W;
  const originY = player.y + PLAYER_H / 2 - 2;
  if (state.tripleTimer > 0) {
    bullets.push({ x: originX, y: originY, vx: BULLET_SPEED, vy: -BULLET_SPEED * 0.5, w: 8, h: 3 });
    bullets.push({ x: originX, y: originY, vx: BULLET_SPEED, vy: 0, w: 8, h: 3 });
    bullets.push({ x: originX, y: originY, vx: BULLET_SPEED, vy: BULLET_SPEED * 0.5, w: 8, h: 3 });
    state.tripleKills = 0;
  } else {
    bullets.push({ x: originX, y: originY, vx: BULLET_SPEED, vy: 0, w: 8, h: 3 });
  }
  playShootSound();
}

function fireUp() {
  bullets.push({
    x: player.x + PLAYER_W / 2,
    y: player.y - 4,
    vx: BULLET_SPEED * 0.5,
    vy: -BULLET_SPEED,
    w: 3,
    h: 8,
  });
  playShootSound();
}

onKeyup((e) => {
  keys[e.code] = false;
});

// ── INPUT: TOUCH ──
let touchJump = false;
let touchShoot = false;
let touchShootUp = false;

function bindTouch(id, flag) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      btn.classList.add('is-pressed');
      if (flag === 'jump') touchJump = true;
      if (flag === 'shoot') touchShoot = true;
      if (flag === 'shootUp') touchShootUp = true;
      if (!state.running) startGame();
    },
    { passive: false },
  );
  btn.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
      if (flag === 'jump') touchJump = false;
      if (flag === 'shoot') touchShoot = false;
      if (flag === 'shootUp') touchShootUp = false;
    },
    { passive: false },
  );
  btn.addEventListener('touchcancel', () => {
    btn.classList.remove('is-pressed');
    if (flag === 'jump') touchJump = false;
    if (flag === 'shoot') touchShoot = false;
    if (flag === 'shootUp') touchShootUp = false;
  });
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    if (!state.running) startGame();
    if (flag === 'jump') touchJump = true;
    if (flag === 'shoot') touchShoot = true;
    if (flag === 'shootUp') touchShootUp = true;
  });
  btn.addEventListener('mouseup', () => {
    if (flag === 'jump') touchJump = false;
    if (flag === 'shoot') touchShoot = false;
    if (flag === 'shootUp') touchShootUp = false;
  });
}

bindTouch('btnUp', 'jump');
bindTouch('btnRight', 'shoot');
bindTouch('btnLeft', 'shootUp');
bindTouch('btnDown', 'pause');

// ── INPUT: GAMEPAD ──
const gamepad = createGamepad();
let prevStart = false;

function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  const dpadUp = !!gp.buttons[12]?.pressed;
  const dpadRight = !!gp.buttons[15]?.pressed;
  const aHeld = !!gp.buttons[0]?.pressed;
  const bHeld = !!gp.buttons[1]?.pressed;

  if (dpadUp) {
    doJump();
  }
  if (dpadRight || aHeld) {
    fireForward();
  }
  if (bHeld) {
    fireUp();
  }

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
let shootCooldown = 0;
function updateGame(dt) {
  state.scrollX += SCROLL_SPEED * dt;
  state.levelTimer += dt;
  state.levelDist += SCROLL_SPEED * dt;

  // Power-up timers
  if (state.tripleTimer > 0) state.tripleTimer -= dt;
  if (state.rapidTimer > 0) state.rapidTimer -= dt;

  // Level completion (distance reached): time bonus + achievements
  if (state.levelDist >= state.levelDistTarget) {
    const elapsed = state.levelTimer;
    const bonus = 500 + Math.max(0, Math.ceil(45 - elapsed) * 10);
    state.score += bonus;
    if (state.jumpsThisLevel === 0) achievements.unlock('no_jump_clear');
    if (elapsed < 45) achievements.unlock('speed_run');
    state.level++;
    state.levelTimer = 0;
    state.levelDist = 0;
    state.levelDistTarget = LEVEL_BASE_DIST + (state.level - 1) * 600;
    state.jumpsThisLevel = 0;
    say(`Nivel ${state.level} — ¡Bonus +${bonus}!`);
  }

  // Score by distance
  state.score = Math.floor(state.scrollX * 0.1);

  // Gravity
  if (!player.grounded) {
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= GROUND_Y) {
      player.y = GROUND_Y;
      player.vy = 0;
      player.grounded = true;
    }
  }

  // Shooting cooldown
  shootCooldown -= dt;
  const cd = state.rapidTimer > 0 ? RAPID_COOLDOWN : NORMAL_COOLDOWN;
  if ((keys['ArrowRight'] || keys['KeyD'] || touchShoot) && shootCooldown <= 0) {
    fireForward();
    shootCooldown = cd;
  }
  if ((keys['ArrowUp'] || keys['KeyW'] || touchShootUp) && shootCooldown <= 0) {
    fireUp();
    shootCooldown = cd;
  }

  // Jump (held on touch)
  if ((keys['ArrowUp'] || keys['KeyW'] || touchJump) && player.grounded) {
    doJump();
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x > GAME_W + 20 || b.y < -20 || b.y > GAME_H + 20) {
      bullets.splice(i, 1);
    }
  }

  // Spawn enemies
  if (Math.random() < 0.02 + state.level * 0.005) {
    spawnEnemy();
  }
  // Spawn power-ups
  if (Math.random() < 0.01 + state.level * 0.002) {
    spawnPowerUp();
  }

  // Update power-ups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.x -= SCROLL_SPEED * dt;
    p.blink += dt;
    if (p.x < -30) {
      powerups.splice(i, 1);
      continue;
    }
    if (rectCollide(player, p)) {
      if (p.kind === 'triple') state.tripleTimer = POWERUP_DURATION;
      else state.rapidTimer = POWERUP_DURATION;
      spawnParticles(offX + p.x * scale, offY + p.y * scale, 6, '#00f0ff', {
        speed: 80,
        life: 0.3,
      });
      powerups.splice(i, 1);
      say(p.kind === 'triple' ? '¡Triple disparo!' : '¡Rapid fire!');
    }
  }

  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.x -= (SCROLL_SPEED + e.speed) * dt;
    if (e.x < -30) {
      enemies.splice(i, 1);
      continue;
    }

    // UFO shooting
    if (e.type === 'ufo') {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0) {
        e.shootTimer = 2 + Math.random() * 3;
        bullets.push({ x: e.x, y: e.y + e.h, vx: -100, vy: 80, w: 4, h: 4, enemy: true });
      }
    }

    // Collision with player
    if (rectCollide(player, e)) {
      endGame();
      return;
    }
  }

  // Update obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.x -= SCROLL_SPEED * dt;
    if (o.x < -30) {
      obstacles.splice(i, 1);
      continue;
    }
    if (rectCollide(player, o)) {
      endGame();
      return;
    }
  }

  // Bullet-enemy collisions
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    if (b.enemy) {
      // Enemy bullet hits player
      if (rectCollide(player, b)) {
        endGame();
        return;
      }
      continue;
    }
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (rectCollide(b, e)) {
        state.score += e.type === 'ufo' ? 50 : 20;
        if (state.tripleTimer > 0) {
          state.tripleKills++;
          if (state.tripleKills >= 3) achievements.unlock('triple_kill');
        }
        playHitSound();
        spawnParticles(offX + e.x * scale, offY + e.y * scale, 6, '#ffb800', {
          speed: 100,
          life: 0.3,
        });
        bullets.splice(bi, 1);
        enemies.splice(ei, 1);
        break;
      }
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

  // Sky gradient
  const grad = ctx.createLinearGradient(ox, oy, ox, oy + GROUND_Y * s);
  grad.addColorStop(0, '#050510');
  grad.addColorStop(1, '#0a0a20');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, GAME_W * s, GROUND_Y * s);

  // Stars (parallax)
  for (const star of stars) {
    const sx = (((star.x - state.scrollX * 0.2) % GAME_W) + GAME_W) % GAME_W;
    ctx.fillStyle = `rgba(255,255,255,${star.brightness})`;
    ctx.fillRect(ox + sx * s, oy + star.y * s, star.size * s, star.size * s);
  }

  // Moon surface
  ctx.fillStyle = '#2a2a35';
  ctx.fillRect(ox, oy + GROUND_Y * s, GAME_W * s, (GAME_H - GROUND_Y) * s);

  // Surface details (craters)
  ctx.fillStyle = '#222230';
  for (let i = 0; i < 10; i++) {
    const cx = (((i * 80 - state.scrollX * 0.8) % (GAME_W + 80)) + GAME_W + 80) % (GAME_W + 80);
    const cr = 8 + ((i * 7) % 12);
    ctx.beginPath();
    ctx.ellipse(ox + cx * s, oy + (GROUND_Y + 15) * s, cr * s, cr * s * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ground line
  ctx.fillStyle = '#ffb800';
  ctx.fillRect(ox, oy + GROUND_Y * s, GAME_W * s, 2 * s);

  // Obstacles (craters / mines)
  for (const o of obstacles) {
    const sx = ox + o.x * s;
    const sy = oy + o.y * s;
    if (o.kind === 'crater') {
      ctx.fillStyle = '#1a1a26';
      ctx.beginPath();
      ctx.ellipse(
        sx + o.w * s * 0.5,
        sy + o.h * s * 0.5,
        o.w * s * 0.5,
        o.h * s,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    } else {
      ctx.fillStyle = '#ff5e7a';
      ctx.beginPath();
      ctx.arc(sx + o.w * s * 0.5, sy + o.h * s * 0.5, o.w * s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      drawGlow(ctx, sx + o.w * s * 0.5, sy + o.h * s * 0.5, o.w * s * 0.3, '#ff5e7a', 0.15, 2);
    }
  }

  // Power-ups
  for (const p of powerups) {
    if (Math.floor(p.blink * 6) % 2 === 1) continue;
    const sx = ox + p.x * s;
    const sy = oy + p.y * s;
    const col = p.kind === 'triple' ? '#00f0ff' : '#39ff14';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(sx + p.w * s * 0.5, sy + p.h * s * 0.5, p.w * s * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#050510';
    ctx.font = `${10 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.kind === 'triple' ? '3' : '»', sx + p.w * s * 0.5, sy + p.h * s * 0.5 + s);
    drawGlow(ctx, sx + p.w * s * 0.5, sy + p.h * s * 0.5, p.w * s * 0.4, col, 0.15, 2);
  }

  // Enemies
  for (const e of enemies) {
    const sx = ox + e.x * s;
    const sy = oy + e.y * s;
    if (e.type === 'rover') {
      ctx.fillStyle = '#ff5e78';
      ctx.fillRect(sx, sy, e.w * s, e.h * s);
      // Wheels
      ctx.fillStyle = '#333';
      ctx.fillRect(sx + 2 * s, sy + e.h * s, 5 * s, 3 * s);
      ctx.fillRect(sx + (e.w - 7) * s, sy + e.h * s, 5 * s, 3 * s);
    } else {
      // UFO
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.ellipse(
        sx + e.w * s * 0.5,
        sy + e.h * s * 0.5,
        e.w * s * 0.5,
        e.h * s * 0.3,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      drawGlow(ctx, sx + e.w * s * 0.5, sy + e.h * s * 0.5, e.w * s * 0.4, '#c084fc', 0.12, 2);
    }
  }

  // Bullets
  for (const b of bullets) {
    const sx = ox + b.x * s;
    const sy = oy + b.y * s;
    ctx.fillStyle = b.enemy ? '#ff5e7a' : '#ffb800';
    ctx.fillRect(sx, sy, b.w * s, b.h * s);
    if (!b.enemy) drawGlow(ctx, sx + b.w * s * 0.5, sy + b.h * s * 0.5, 4 * s, '#ffb800', 0.15, 2);
  }

  // Player buggy
  const px = ox + player.x * s;
  const py = oy + player.y * s;

  // Body
  ctx.fillStyle = '#ffb800';
  ctx.fillRect(px, py, PLAYER_W * s, PLAYER_H * s);

  // Cockpit
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(px + 4 * s, py + 2 * s, 8 * s, 6 * s);

  // Wheels
  ctx.fillStyle = '#333';
  ctx.fillRect(px + 2 * s, py + PLAYER_H * s, 6 * s, 4 * s);
  ctx.fillRect(px + (PLAYER_W - 8) * s, py + PLAYER_H * s, 6 * s, 4 * s);

  // Antenna
  ctx.strokeStyle = '#ffb800';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(px + PLAYER_W * s, py + 4 * s);
  ctx.lineTo(px + (PLAYER_W + 8) * s, py - 4 * s);
  ctx.stroke();

  drawGlow(
    ctx,
    px + PLAYER_W * s * 0.5,
    py + PLAYER_H * s * 0.5,
    PLAYER_W * s * 0.6,
    '#ffb800',
    0.12,
    2,
  );

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
generateTerrain();
generateStars();
updateHUD();

shell.onCleanup(() => {
  cleanupAll();
  loop.stop();
});
document.getElementById('loading').classList.add('hidden');
loop.start();
