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
  triggerShake,
  updateShake,
  getShakeOffset,
  spawnParticles,
  updateParticles,
  drawParticles,
  drawGlow,
  feedbackBundle,
  updateSquashes,
  clearSquashes,
} from '../../shared/effects.js';
import { dist } from '../../shared/collide.js';

injectCommonElements();
const shell = setupGameShell('double-dragon');

/* ============================================================
   DOUBLE DRAGON — Arcade Hub
   Beat 'em up: 4-direction movement, punch/kick/combo, enemies, boss.
   ============================================================ */

const GW = 480;
const GH = 320;
const GROUND_Y = GH - 70;
const PLAYER_W = 18;
const PLAYER_H = 28;
const PUNCH_RANGE = 28;
const KICK_RANGE = 34;
const COMBO_RANGE = 30;
const PUNCH_DMG = 10;
const KICK_DMG = 18;
const COMBO_DMG = 30;
const PLAYER_SPEED = 100;
const ENEMY_SPEED = 55;
const ATTACK_COOLDOWN = 0.3;
const COMBO_COOLDOWN = 0.6;
const ACTS = 4;
const ENEMIES_PER_ACT = [5, 7, 8, 10];
const BOSS_HP = [80, 120, 160, 250];
const BOSS_SPEED = [40, 50, 55, 65];
const WEAPON_TYPES = ['sword', 'bat', 'dynamite'];
const WEAPON_DMG = { sword: 15, bat: 20, dynamite: 40 };
const ENEMY_COLORS = { punk: '#ff5e7a', thug: '#c084fc', soldier: '#ffb800', boss: '#ff2d78' };

const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  best: loadBest('doubleDragon'),
  lives: 3,
  act: 0,
  enemiesLeft: 0,
  attackTimer: 0,
  comboTimer: 0,
};

const player = { x: GW / 2, y: GROUND_Y, facing: 1, weapon: null, weaponTimer: 0 };
let enemies = [];
let pickups = [];
let attackFlash = 0;
let damageFlash = 0;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const { w: cW, h: cH, s: sc, x: ox, y: oy } = setupCanvas(canvas, ctx, GW, GH, 10);

function sfx(freq, end, dur, type, vol) {
  beep({ freq, freqEnd: end, duration: dur, type, volume: vol });
}
function punchSfx() {
  sfx(400, 200, 0.08, 'square', 0.15);
}
function kickSfx() {
  sfx(300, 100, 0.1, 'sawtooth', 0.18);
}
function comboSfx() {
  sfx(500, 800, 0.15, 'triangle', 0.2);
}
function hitSfx() {
  sfx(200, 80, 0.12, 'square', 0.12);
}
function deathSfx() {
  feedbackBundle('large', player.x, player.y, {
    color: '#ff2d78',
    noFlash: true,
    onBeep: () => sfx(300, 40, 0.5, 'sawtooth', 0.2),
  });
}
function pickupSfx() {
  sfx(600, 900, 0.12, 'triangle', 0.15);
}

function spawnEnemies() {
  enemies = [];
  const count = ENEMIES_PER_ACT[state.act] || 5;
  for (let i = 0; i < count; i++) {
    const typeRoll = Math.random();
    let type = 'punk';
    if (typeRoll > 0.7) type = 'thug';
    if (typeRoll > 0.9) type = 'soldier';
    enemies.push({
      x: 40 + Math.random() * (GW - 80),
      y: GROUND_Y - 10 + Math.random() * 20,
      type,
      hp: type === 'punk' ? 25 : type === 'thug' ? 40 : 55,
      maxHp: type === 'punk' ? 25 : type === 'thug' ? 40 : 55,
      speed: ENEMY_SPEED + (type === 'soldier' ? 15 : 0),
      attackTimer: 1 + Math.random() * 2,
      hit: 0,
      facing: Math.random() < 0.5 ? 1 : -1,
      alive: true,
    });
  }
  state.enemiesLeft = count;
}

function spawnBoss() {
  const hp = BOSS_HP[state.act] || 80;
  enemies = [
    {
      x: GW / 2,
      y: GROUND_Y - 10,
      type: 'boss',
      hp,
      maxHp: hp,
      speed: BOSS_SPEED[state.act] || 40,
      attackTimer: 1.5,
      hit: 0,
      facing: -1,
      alive: true,
    },
  ];
  state.enemiesLeft = 1;
}

function spawnPickup(x, y) {
  if (Math.random() < 0.3) {
    const type = WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)];
    pickups.push({ x, y, type, timer: 8 });
  }
  if (Math.random() < 0.15) {
    pickups.push({ x: x + 10, y, type: 'life', timer: 8 });
  }
}

function startGame() {
  ensureAudio();
  state.score = 0;
  state.lives = 3;
  state.act = 0;
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  state.attackTimer = 0;
  state.comboTimer = 0;
  player.x = GW / 2;
  player.y = GROUND_Y;
  player.facing = 1;
  player.weapon = null;
  player.weaponTimer = 0;
  attackFlash = 0;
  damageFlash = 0;
  enemies = [];
  pickups = [];
  clearSquashes();
  startAmbient();
  startMusic('double-dragon');
  shell.enableTabTrap();
  overlay.classList.add('hidden');
  spawnEnemies();
  say(`Acto ${state.act + 1}`);
}

function endGame() {
  state.gameOver = true;
  state.running = false;
  shell.disableTabTrap();
  stopMusic();
  deathSfx();
  if (state.score > state.best) {
    state.best = state.score;
    saveBest('doubleDragon', state.best);
  }
  achievements.unlock('dd_first_fight');
  if (state.score >= 2000) achievements.unlock('dd_high_scorer');
  if (state.act >= 3) achievements.unlock('dd_final_boss');
  finalScoreEl.textContent = `Puntos: ${state.score}`;
  finalScoreEl.style.display = '';
  overlayText.textContent = state.act >= 3 && state.lives > 0 ? '¡Victoria!' : '¡Juego terminado!';
  hintEl.innerHTML = '<kbd>R</kbd> reiniciar · <kbd>Espacio</kbd> / tap para jugar de nuevo';
  overlay.classList.remove('hidden');
  say(`Puntos: ${state.score}. Mejor: ${state.best}`);
}

function togglePause() {
  if (!state.running || state.gameOver) return;
  state.paused = !state.paused;
}

function attack(type) {
  if (state.attackTimer > 0) return;
  const dmg =
    type === 'punch'
      ? player.weapon
        ? WEAPON_DMG[player.weapon] || PUNCH_DMG
        : PUNCH_DMG
      : type === 'kick'
        ? KICK_DMG
        : COMBO_DMG;
  const range = type === 'punch' ? PUNCH_RANGE : type === 'kick' ? KICK_RANGE : COMBO_RANGE;
  const cd = type === 'combo' ? COMBO_COOLDOWN : ATTACK_COOLDOWN;
  state.attackTimer = cd;
  attackFlash = 0.15;
  if (type === 'punch') punchSfx();
  else if (type === 'kick') kickSfx();
  else comboSfx();

  for (const e of enemies) {
    if (!e.alive) continue;
    const dx = e.x - player.x;
    const facingOk = (player.facing > 0 && dx > 0) || (player.facing < 0 && dx < 0);
    if (facingOk && Math.abs(dx) < range && Math.abs(e.y - player.y) < 30) {
      e.hp -= dmg;
      e.hit = 0.2;
      state.score += 10;
      triggerShake(0.3);
      hitSfx();
      spawnParticles(ox + e.x * sc, oy + e.y * sc, 4, ENEMY_COLORS[e.type] || '#fff', {
        speed: 80,
        life: 0.25,
      });
      if (e.hp <= 0) {
        e.alive = false;
        state.enemiesLeft--;
        state.score += e.type === 'boss' ? 500 : 50;
        spawnPickup(e.x, e.y);
        if (state.enemiesLeft <= 0) {
          if (state.act < ACTS - 1) {
            state.act++;
            setTimeout(() => {
              if (state.running && !state.gameOver) {
                spawnEnemies();
                say(`Acto ${state.act + 1}`);
              }
            }, 1500);
          } else {
            setTimeout(() => {
              if (state.running && !state.gameOver) endGame();
            }, 1000);
          }
        }
      }
      break;
    }
  }
  if (player.weapon) {
    player.weaponTimer -= 0.1;
    if (player.weaponTimer <= 0) player.weapon = null;
  }
}

function playerTakeDamage(_dmg) {
  if (damageFlash > 0) return;
  damageFlash = 0.5;
  state.lives--;
  triggerShake(0.6);
  sfx(150, 50, 0.3, 'sawtooth', 0.2);
  if (state.lives <= 0) endGame();
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
  if (e.code === 'KeyZ') {
    e.preventDefault();
    attack('punch');
  }
  if (e.code === 'KeyX') {
    e.preventDefault();
    attack('kick');
  }
  if (e.code === 'KeyC') {
    e.preventDefault();
    attack('combo');
  }
});
window.addEventListener('keyup', (e) => {
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
bindTouch('btnPunch', () => attack('punch'));
bindTouch('btnKick', () => attack('kick'));
bindTouch('btnCombo', () => attack('combo'));
bindTouch('btnUp', () => {
  keys['ArrowUp'] = true;
  setTimeout(() => (keys['ArrowUp'] = false), 80);
});
bindTouch('btnDown', () => {
  keys['ArrowDown'] = true;
  setTimeout(() => (keys['ArrowDown'] = false), 80);
});
bindTouch('btnLeft', () => {
  keys['ArrowLeft'] = true;
  setTimeout(() => (keys['ArrowLeft'] = false), 80);
});
bindTouch('btnRight', () => {
  keys['ArrowRight'] = true;
  setTimeout(() => (keys['ArrowRight'] = false), 80);
});

const gamepad = createGamepad();
let prevStart = false;
function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  const dl = !!gp.buttons[14]?.pressed,
    dr = !!gp.buttons[15]?.pressed;
  const du = !!gp.buttons[12]?.pressed,
    dd = !!gp.buttons[13]?.pressed;
  const aH = !!gp.buttons[0]?.pressed,
    bH = !!gp.buttons[1]?.pressed,
    xH = !!gp.buttons[2]?.pressed;
  keys['ArrowLeft'] = dl;
  keys['ArrowRight'] = dr;
  keys['ArrowUp'] = du;
  keys['ArrowDown'] = dd;
  if (aH) attack('punch');
  if (bH) attack('kick');
  if (xH) attack('combo');
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

function updateGame(dt) {
  if (state.attackTimer > 0) state.attackTimer -= dt;
  if (attackFlash > 0) attackFlash -= dt;
  if (damageFlash > 0) damageFlash -= dt;
  updateShake(dt);

  let dx = 0,
    dy = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) dx = -1;
  if (keys['ArrowRight'] || keys['KeyD']) dx = 1;
  if (keys['ArrowUp'] || keys['KeyW']) dy = -1;
  if (keys['ArrowDown'] || keys['KeyS']) dy = 1;
  if (dx || dy) {
    const len = Math.hypot(dx, dy);
    player.x += (dx / len) * PLAYER_SPEED * dt;
    player.y += (dy / len) * PLAYER_SPEED * dt;
    player.x = Math.max(PLAYER_W, Math.min(GW - PLAYER_W, player.x));
    player.y = Math.max(GROUND_Y - 40, Math.min(GROUND_Y + 20, player.y));
    if (dx !== 0) player.facing = dx;
  }

  for (const e of enemies) {
    if (!e.alive) continue;
    if (e.hit > 0) {
      e.hit -= dt;
      continue;
    }
    const d = dist(player, e);
    if (d > 20) {
      const a = Math.atan2(player.y - e.y, player.x - e.x);
      e.x += Math.cos(a) * e.speed * dt;
      e.y += Math.sin(a) * e.speed * dt;
      e.facing = player.x > e.x ? 1 : -1;
    }
    e.attackTimer -= dt;
    if (e.attackTimer <= 0 && d < 35) {
      e.attackTimer = 1.5 + Math.random();
      const dmg = e.type === 'boss' ? 25 : e.type === 'soldier' ? 15 : e.type === 'thug' ? 12 : 8;
      playerTakeDamage(dmg);
    }
  }

  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.timer -= dt;
    if (p.timer <= 0) {
      pickups.splice(i, 1);
      continue;
    }
    if (dist(player, p) < 25) {
      if (p.type === 'life') {
        state.lives = Math.min(5, state.lives + 1);
      } else {
        player.weapon = p.type;
        player.weaponTimer = 15;
      }
      pickupSfx();
      pickups.splice(i, 1);
    }
  }

  // Boss spawn when act enemies cleared mid-act
  if (state.enemiesLeft <= 0 && state.act < ACTS) {
    if (enemies.length === 0 || enemies.every((e) => !e.alive)) {
      spawnBoss();
      say(`¡BOSS del Acto ${state.act + 1}!`);
    }
  }
}

function draw() {
  ctx.save();
  const so = getShakeOffset();
  ctx.translate(so.x, so.y);
  ctx.clearRect(-so.x, -so.y, cW, cH);

  // Stage background
  const grad = ctx.createLinearGradient(ox, oy, oy, oy + GH * sc);
  grad.addColorStop(0, '#1a0a20');
  grad.addColorStop(1, '#0a0510');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, GW * sc, GH * sc);

  // Ground
  ctx.fillStyle = '#1a1520';
  ctx.fillRect(ox, oy + (GROUND_Y - 20) * sc, GW * sc, 90 * sc);
  ctx.fillStyle = '#ff2d78';
  ctx.fillRect(ox, oy + (GROUND_Y - 20) * sc, GW * sc, 2 * sc);

  // Pickups
  for (const p of pickups) {
    const sx = ox + p.x * sc,
      sy = oy + p.y * sc;
    const color =
      p.type === 'life'
        ? '#39ff14'
        : p.type === 'sword'
          ? '#00f0ff'
          : p.type === 'bat'
            ? '#ffb800'
            : '#ff5e7a';
    ctx.fillStyle = color;
    ctx.fillRect(sx - 5 * sc, sy - 5 * sc, 10 * sc, 10 * sc);
    drawGlow(ctx, sx, sy, 8 * sc, color, 0.15, 2);
  }

  // Enemies
  for (const e of enemies) {
    if (!e.alive) continue;
    const sx = ox + e.x * sc,
      sy = oy + e.y * sc;
    const c = ENEMY_COLORS[e.type] || '#fff';
    if (e.hit > 0) ctx.globalAlpha = 0.5;
    ctx.fillStyle = c;
    ctx.fillRect(sx - PLAYER_W * sc * 0.5, sy - PLAYER_H * sc, PLAYER_W * sc, PLAYER_H * sc);
    // Head
    ctx.fillStyle = '#ffb800';
    ctx.beginPath();
    ctx.arc(sx, sy - PLAYER_H * sc - 4 * sc, 5 * sc, 0, Math.PI * 2);
    ctx.fill();
    if (e.type === 'boss') {
      drawGlow(ctx, sx, sy - PLAYER_H * sc * 0.5, PLAYER_W * sc, c, 0.15, 2.5);
      // HP bar
      const bw = 30 * sc,
        bh = 3 * sc;
      ctx.fillStyle = '#333';
      ctx.fillRect(sx - bw * 0.5, sy - PLAYER_H * sc - 14 * sc, bw, bh);
      ctx.fillStyle = '#ff2d78';
      ctx.fillRect(sx - bw * 0.5, sy - PLAYER_H * sc - 14 * sc, bw * (e.hp / e.maxHp), bh);
    }
    ctx.globalAlpha = 1;
  }

  // Player
  const px = ox + player.x * sc,
    py = oy + player.y * sc;
  if (damageFlash > 0 && Math.floor(damageFlash * 10) % 2) ctx.globalAlpha = 0.4;
  ctx.fillStyle = '#00f0ff';
  ctx.fillRect(px - PLAYER_W * sc * 0.5, py - PLAYER_H * sc, PLAYER_W * sc, PLAYER_H * sc);
  ctx.fillStyle = '#ffb800';
  ctx.beginPath();
  ctx.arc(px, py - PLAYER_H * sc - 4 * sc, 5 * sc, 0, Math.PI * 2);
  ctx.fill();
  // Weapon indicator
  if (player.weapon) {
    const wc =
      player.weapon === 'sword' ? '#00f0ff' : player.weapon === 'bat' ? '#ffb800' : '#ff5e7a';
    ctx.fillStyle = wc;
    ctx.fillRect(px + player.facing * 12 * sc, py - PLAYER_H * sc * 0.6, 3 * sc, 14 * sc);
  }
  // Attack flash
  if (attackFlash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(
      px + player.facing * 8 * sc,
      py - PLAYER_H * sc * 0.5,
      PUNCH_RANGE * sc * 0.5,
      8 * sc,
    );
  }
  drawGlow(ctx, px, py - PLAYER_H * sc * 0.5, PLAYER_W * sc, '#00f0ff', 0.1, 2);
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
const livesEl = document.getElementById('livesValue');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  bestEl.textContent = String(state.best);
  livesEl.textContent = String(state.lives);
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
shell.onCleanup(() => loop.stop());
document.getElementById('loading').classList.add('hidden');
loop.start();
