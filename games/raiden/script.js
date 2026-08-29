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
  spawnParticles,
  updateParticles,
  drawParticles,
  clearParticles,
  drawGlow,
} from '../../shared/effects.js';
import { overlap } from '../../shared/collide.js';

injectCommonElements();

const shell = setupGameShell('raiden');

/* ============================================================
   RAIDEN — Arcade Hub
   Vertical shooter (vertical-scroll shmup), autofire.
   Canvas 2D, sin dependencias externas.
   ============================================================ */

const W = 720;
const H = 640;
const PLAY_W = 480;
const PLAY_H = H;
const PAD_X = (W - PLAY_W) / 2;
const MOVE_MAX = 5.2;
const BULLET_SPEED = 13;
const M_BULLET_SPEED = 6.5;

const state = {
  phase: 'menu',
  paused: false,
  stage: 1,
  score: 0,
  best: loadBest('raiden2d'),
  lives: 3,
  bombs: 3,
  boss: false,
};

const player = {
  x: PLAY_W / 2,
  y: PLAY_H - 60,
  vx: 0,
  vy: 0,
  inv: 0,
  fireTimer: 0,
};

let enemies = [];
let bullets = [];
let mBullets = [];
let bombs = [];
let pickups = [];
const stars = Array.from({ length: 140 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  z: 0.2 + Math.random() * 0.8,
}));
let boss = null;
let spawnTimer = 0;
let waveIndex = 0;
let bossIntro = false;
let bossOutro = 0;
let clearTimer = 0;
let gameoverDone = false;
let curWeapon = 'twin';

// ▸ Convención: los efectos reciben COORDENADAS LÓGICAS (no escaladas).

function goSelect() {
  state.phase = 'select';
  state.paused = false;
  if (state.stage > MAX_STAGE) {
    updateHUD();
    gameOver(true);
  }
}

function startGame() {
  ensureAudio();
  state.score = 0;
  state.stage = 1;
  state.lives = 3;
  state.bombs = 3;
  curWeapon = 'twin';
  enemies = [];
  bullets = [];
  mBullets = [];
  bombs = [];
  pickups = [];
  boss = null;
  bossIntro = false;
  bossOutro = 0;
  clearTimer = 0;
  gameoverDone = false;
  state.boss = false;
  player.x = PLAY_W / 2;
  player.y = PLAY_H - 60;
  player.inv = 0;
  clearParticles();
  startAmbient();
  startMusic('raiden');
  updateWeaponBar();
  updateHUD();
  shell.enableTabTrap();
  overlay.style.display = 'none';
  goSelect();
  say('Raiden — ¡En marcha!');
}

function startStage() {
  state.phase = 'play';
  state.paused = false;
  spawnTimer = 0;
  waveIndex = 0;
  setupStage();
}

function gameOver(win) {
  if (!gameoverDone) {
    gameoverDone = true;
    shell.disableTabTrap();
    stopMusic();
    if (state.score > state.best) {
      state.best = state.score;
      saveBest('raiden2d', state.best);
    }
    finalScoreEl.textContent = win ? `¡Victoria! Puntos: ${state.score}` : `Puntos: ${state.score}`;
    finalScoreEl.style.display = '';
    overlayText.textContent = win
      ? '¡Derrotaste a todos los jefes! Tu misión está completa.'
      : 'Nave destruida. ¡Reiniciá para volver al combate!';
    hintEl.innerHTML =
      '<kbd>R</kbd> reiniciar &nbsp;·&nbsp; <kbd>Espacio</kbd> / tap para jugar de nuevo';
    overlay.style.display = '';
    updateHUD();
    say(`Fin de partida — Puntos: ${state.score}. Mejor: ${state.best}`);
  }
}

// ── Utilidades ──
function rnd(a, b) {
  return a + Math.random() * (b - a);
}


// ── Configuración de stage ──
const MAX_STAGE = 7;

function stageParams(n) {
  const p = {
    enemySpeed: 1 + (n - 1) * 0.08,
    bullets: 1 + Math.floor((n - 1) / 3),
    hitpoints: 1 + Math.floor((n - 1) / 2),
    spawnInterval: Math.max(0.7, 1.5 - (n - 1) * 0.1),
    building: n === 7,
    bossHp: 40 + (n - 1) * 20,
    bossPattern:
      n === 1
        ? 'spiral'
        : n === 2
          ? 'aimed'
          : n === 3
            ? 'ring'
            : n === 4
              ? 'waves'
              : n === 5
                ? 'spiral2'
                : n === 6
                  ? 'aimed2'
                  : 'final',
  };
  return p;
}

function setupStage() {
  enemies = [];
  bullets = [];
  mBullets = [];
  pickups = [];
  boss = null;
  bossIntro = false;
  bossOutro = 0;
  clearTimer = 0;
  state.boss = false;
  setBossIdle();
  document.getElementById('bossBarWrap').style.display = 'none';
  updateHUD();
}

function waveCount(n) {
  return 5 + n;
}

function spawnEnemyRun() {
  const p = stageParams(state.stage);
  if (boss) return;
  if (waveIndex >= waveCount(state.stage)) {
    if (enemies.length === 0 && !bossIntro && !bossOutro) {
      spawnBoss();
    }
    return;
  }
  spawnTimer -= 0.016;
  if (spawnTimer > 0) return;
  spawnTimer = p.spawnInterval;
  waveIndex++;

  const paths = [];
  const side = Math.random() < 0.5 ? 0.25 : 0.55;
  for (let i = 0; i < p.bullets; i++) {
    paths.push({
      x: side * PLAY_W + i * 42,
      y: -30 - i * 40,
      vx: rnd(-0.4, 0.4),
      vy: rnd(1.2, 2.2) * p.enemySpeed,
    });
  }
  for (const pa of paths) {
    enemies.push({
      type: 'ship',
      x: pa.x,
      y: pa.y,
      vx: pa.vx,
      vy: pa.vy,
      r: 14,
      hp: p.hitpoints,
      fire: Math.random() < 0.5,
      fireTimer: rnd(0.4, 1.2),
      wobble: Math.random() * Math.PI * 2,
      score: 100,
    });
  }

  if (state.stage >= 3 && waveIndex % 3 === 0) {
    enemies.push({
      type: 'drone',
      x: rnd(60, PLAY_W - 60),
      y: -30,
      vx: rnd(-0.6, 0.6),
      vy: rnd(0.8, 1.4) * p.enemySpeed,
      r: 13,
      hp: 2,
      fire: false,
      fireTimer: 0,
      wobble: 0,
      score: 200,
    });
  }
}

function spawnBoss() {
  const p = stageParams(state.stage);
  boss = {
    x: PLAY_W / 2,
    y: 110,
    r: 26,
    hp: p.bossHp,
    maxHp: p.bossHp,
    pattern: p.bossPattern,
    timer: 1.8,
    phase: 0,
  };
  bossIntro = true;
  state.boss = true;
  const bWrap = document.getElementById('bossBarWrap');
  bWrap.style.display = 'flex';
  updateBossBar();
  playBossSound();
}

function bossHit() {
  spawnParticles(boss.x, boss.y, 6, '#ff8a65', { spd: 120, life: 0.4 });
}

function updateBossDie() {
  if (!boss) return;
  state.boss = false;
  const bWrap = document.getElementById('bossBarWrap');
  bWrap.style.display = 'none';
  spawnParticles(boss.x, boss.y, 22, '#ffd166', { spd: 200, life: 0.9 });
  playBoomSound();
  state.score += 5000 + state.stage * 500;
  achievements.unlock('raiden_boss_slayer');
  bossOutro = 1.2;
  boss = null;
  updateHUD();
}

function setBossIdle() {
  const bWrap = document.getElementById('bossBarWrap');
  if (bWrap) bWrap.style.display = 'none';
}

function updateBossBar() {
  const fill = document.getElementById('bossFill');
  if (!boss) return;
  fill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
}

function aRing(cx, cy, dir, speed, count, offset, color, r) {
  const cols = color || ['#ff2d78'];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + offset;
    mBullets.push({
      x: cx,
      y: cy,
      a: a + dir,
      px: Math.cos(a) * speed,
      py: Math.sin(a) * speed,
      color: cols[i % cols.length],
      r: r || 5,
      ttl: 7,
    });
  }
}

function aAimed(cx, cy, speed, scatter, count) {
  const n = count || 3;
  for (let i = 0; i < n; i++) {
    const base = Math.atan2(player.y - cy, player.x - cx);
    const a = base + (i - (n - 1) / 2) * 0.18 + rnd(-(scatter || 0.05), scatter || 0.05);
    mBullets.push({
      x: cx,
      y: cy,
      a,
      px: Math.cos(a) * speed,
      py: Math.sin(a) * speed,
      color: '#ff8a65',
      r: 5,
      ttl: 7,
    });
  }
}

function updateBoss(dt) {
  if (!boss || bossOutro) return;
  boss.timer -= dt;

  // Movimiento: patrón lateral o lazo
  const t = performance.now() / 1000;
  if (boss.pattern === 'final') {
    boss.x = PLAY_W / 2 + Math.sin(t * 1.4) * (PLAY_W * 0.3);
    boss.y = 90 + Math.sin(t * 2.2) * 30;
  } else {
    boss.x += (Math.sin(t * 1.1) * (PLAY_W * 0.32) - (boss.x - PLAY_W / 2)) * 0.04;
    boss.y += Math.sin(t * 1.11) * 18 * dt;
    if (boss.y < 60 || boss.y > 150) boss.y = Math.max(60, Math.min(150, boss.y));
  }

  if (boss.timer <= 0) {
    switch (boss.pattern) {
      case 'spiral':
        boss.phase++;
        aRing(boss.x, boss.y, boss.phase * 0.3, 3.4, 22, boss.phase, ['#ff2d78'], 5);
        boss.timer = 2.0;
        break;
      case 'aimed':
        aAimed(boss.x, boss.y, 5, 0.08, 3);
        boss.timer = 1.5;
        break;
      case 'ring':
        aRing(boss.x, boss.y, 0, 3.2, 26, 0, ['#ff2d78', '#ff8a65'], 5);
        aAimed(boss.x, boss.y, 5.2, 0.07, 2);
        boss.timer = 1.7;
        break;
      case 'waves': {
        boss.phase++;
        const dir = boss.phase % 2 === 0 ? 1 : -1;
        aRing(boss.x, boss.y, dir * 0.4, 3.0, 18, boss.phase, ['#ff8a65'], 5);
        aAimed(boss.x, boss.y, 4.6, 0.08, 2);
        boss.timer = 1.4;
        break;
      }
      case 'spiral2':
        boss.phase++;
        aRing(
          boss.x,
          boss.y,
          boss.phase * 0.22,
          3.6,
          30,
          boss.phase * 0.5,
          ['#ff2d78', '#ff8a65'],
          5,
        );
        boss.timer = 1.3;
        break;
      case 'aimed2':
        aRing(boss.x, boss.y, boss.phase * 0.2, 3.2, 14, 0, ['#ffd166'], 5);
        aAimed(boss.x, boss.y, 6.2, 0.05, 4);
        boss.timer = 1.1;
        break;
      case 'final':
        boss.phase++;
        aRing(boss.x, boss.y, boss.phase * 0.3, 3.6, 32, 0, ['#ff2d78', '#ff8a65', '#ffd166'], 5);
        aAimed(boss.x, boss.y, 6.4, 0.04, 5);
        boss.timer = 0.9;
        break;
    }
  }
}

// ── Disparos del jugador ──
function fireWeapon() {
  const cy = player.y - 8;
  switch (curWeapon) {
    case 'twin':
      bullets.push({ x: player.x - 7, y: cy, vx: 0, vy: -BULLET_SPEED, r: 4 });
      bullets.push({ x: player.x + 7, y: cy, vx: 0, vy: -BULLET_SPEED, r: 4 });
      break;
    case 'laser': {
      const b = { x: player.x, y: cy, vx: 0, vy: -BULLET_SPEED - 3, r: 6, laser: true };
      bullets.push(b);
      bullets.push({ x: player.x - 18, y: cy + 12, vx: 0, vy: -BULLET_SPEED, r: 3 });
      bullets.push({ x: player.x + 18, y: cy + 12, vx: 0, vy: -BULLET_SPEED, r: 3 });
      break;
    }
    case 'proton':
      for (let i = 0; i < 5; i++) {
        bullets.push({
          x: player.x + (i - 2) * 8,
          y: cy,
          vx: (i - 2) * 0.7,
          vy: -BULLET_SPEED,
          r: 3,
        });
      }
      break;
    case 'missile':
      bullets.push({ x: player.x - 10, y: cy + 6, vx: -2.4, vy: -8, r: 4, heavy: true });
      bullets.push({ x: player.x + 10, y: cy + 6, vx: 2.4, vy: -8, r: 4, heavy: true });
      break;
    case 'shield':
      bullets.push({ x: player.x, y: cy, vx: 0, vy: -BULLET_SPEED, r: 5, heavy: true });
      break;
  }
}

function playerShoot() {
  if (state.phase !== 'play' || state.paused) return;
  player.fireTimer -= 0.016;
  if (player.fireTimer <= 0) {
    player.fireTimer = 0.13;
    fireWeapon();
  }
}

function updatePlayer(dt) {
  const kbdX = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  const kbdY = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
  const kx = held.has('right') || held.has('left') ? kbdX : gamepadX;
  const ky = held.has('down') || held.has('up') ? kbdY : gamepadY;
  player.vx = kx * MOVE_MAX;
  player.vy = ky * MOVE_MAX;
  player.x = Math.max(0, Math.min(PLAY_W, player.x + player.vx * dt * 60));
  player.y = Math.max(30, Math.min(PLAY_H - 36, player.y + player.vy * dt * 60));
  if (player.inv > 0) player.inv -= dt;
  playerShoot();
}

// ── Enemigos ──
function updateEnemies(dt) {
  for (const e of enemies) {
    e.x += e.vx;
    e.y += e.vy;
    if (e.type === 'ship') e.wobble += 0.1;
    if (e.fire) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && e.y > 20 && e.y < PLAY_H - 80) {
        e.fireTimer = 1.8;
        const d = Math.atan2(player.y - e.y, player.x - e.x);
        mBullets.push({
          x: e.x,
          y: e.y + 8,
          a: d,
          px: Math.cos(d) * M_BULLET_SPEED,
          py: Math.sin(d) * M_BULLET_SPEED,
          color: '#ff2d78',
          r: 4,
          ttl: 6,
        });
      }
    }
  }
  enemies = enemies.filter((e) => e.y < PLAY_H + 60);
}

function damageEnemy(e, dmg) {
  e.hp -= dmg;
  spawnParticles(e.x, e.y, 4, '#ffd166', { spd: 80, life: 0.3 });
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  state.score += e.score || 100;
  spawnParticles(e.x, e.y, 10, '#ffd166', { spd: 140, life: 0.55 });
  achievements.unlock('raiden_first_ship');
  updateHUD();
}

function updateBullets() {
  for (const b of bullets) {
    b.x += b.vx;
    b.y += b.vy;
    if (b.y < -20 || b.x < -20 || b.x > PLAY_W + 20) continue;

    if (boss) {
      if (overlap(b, b.r, boss, boss.r + 6)) {
        b.dead = true;
        boss.hp -= b.heavy ? 2 : 1;
        bossHit();
        updateBossBar();
        continue;
      }
    }

    for (const e of enemies) {
      if (overlap(b, b.r, e, e.r)) {
        b.dead = true;
        damageEnemy(e, b.heavy ? 2 : 1);
        break;
      }
    }
  }
  bullets = bullets.filter((b) => !b.dead);
  if (boss && boss.hp <= 0) updateBossDie();
}

function updateMBullets() {
  for (const m of mBullets) {
    m.x += m.px;
    m.y += m.py;
    m.ttl -= 0.016;
    if (player.inv <= 0 && overlap(m, m.r, player, 9)) {
      m.dead = true;
      playerHit();
    }
  }
  mBullets = mBullets.filter((m) => !m.dead && m.ttl > 0);
}

function updateBombs() {
  for (const b of bombs) {
    b.r += 26 * 0.016;
    b.ttl -= 0.016;
    for (const e of enemies) {
      if (!e.dead && overlap(b, b.r, e, e.r)) damageEnemy(e, 4);
    }
    if (boss && !bossOutro && overlap(b, b.r, boss, boss.r + 10)) {
      boss.hp -= 10;
      updateBossBar();
    }
  }
  bombs = bombs.filter((b) => b.ttl > 0);
  if (boss && boss.hp <= 0) updateBossDie();
}

function updatePickups() {
  for (const p of pickups) {
    p.y += 1.6;
    if (overlap(p, 10, player, 12)) {
      p.dead = true;
      switchWeapon(p.w);
    }
  }
  pickups = pickups.filter((p) => !p.dead && p.y < PLAY_H + 20);
}

// ── Bomba y daño al jugador ──
function useBomb() {
  if (state.bombs <= 0) return;
  state.bombs--;
  bombs.push({ x: player.x, y: player.y, r: 8, ttl: 0.8 });
  spawnParticles(player.x, player.y, 20, '#39ff14', { spd: 200, life: 0.6 });
  playBoomSound();
  updateHUD();
  // Si se eliminó todo con bomba y aún queda stage, no contar
  achievements.unlock('raiden_bomb_save');
}

function playerHit() {
  if (player.inv > 0) return;
  player.inv = 1.6;
  state.lives--;
  spawnParticles(player.x, player.y, 14, '#00f0ff', { spd: 130, life: 0.5 });
  playDeathSound();
  if (state.lives <= 0) {
    gameOver(false);
    return;
  }
  curWeapon = 'twin';
  updateWeaponBar();
  updateHUD();
}

// ── Apparición de armas / actualización de stage ──
function switchWeapon(w) {
  curWeapon = w;
  updateWeaponBar();
  beep({ freq: 900, freqEnd: 1400, duration: 0.08, type: 'triangle', volume: 0.15 });
}

const WEAPONS = ['twin', 'laser', 'proton', 'missile', 'shield'];
const WEAPON_COLOR = {
  twin: '#00f0ff',
  laser: '#ff2d78',
  proton: '#c084fc',
  missile: '#ffb800',
  shield: '#39ff14',
};

function cycleWeapon(dir) {
  const idx = WEAPONS.indexOf(curWeapon);
  const next = (idx + dir + WEAPONS.length) % WEAPONS.length;
  curWeapon = WEAPONS[next];
  updateWeaponBar();
  beep({ freq: 500 + next * 80, duration: 0.06, type: 'square', volume: 0.1 });
}

function updateWeaponBar() {
  const bar = document.getElementById('weaponBar');
  if (!bar) return;
  bar.innerHTML = '';
  for (const w of WEAPONS) {
    const cell = document.createElement('div');
    cell.classList.add('weapon-cell');
    if (w === curWeapon) cell.classList.add('active');
    const dot = document.createElement('div');
    dot.classList.add('wdot');
    dot.style.background = WEAPON_COLOR[w];
    dot.style.color = WEAPON_COLOR[w];
    cell.appendChild(dot);
    bar.appendChild(cell);
  }
}

// ── Input ──
const held = new Set();
let gamepadX = 0;
let gamepadY = 0;

const codeToDir = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyR' && (state.phase === 'menu' || state.phase === 'select')) {
    e.preventDefault();
    startGame();
    return;
  }
  if (state.phase === 'menu' && (e.code === 'Space' || e.code === 'Enter')) {
    e.preventDefault();
    startGame();
    return;
  }
  if (state.phase === 'select' && !state.paused) {
    if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      cycleWeapon(-1);
      return;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      e.preventDefault();
      cycleWeapon(1);
      return;
    }
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      startStage();
      return;
    }
  }
  if (e.code === 'Space' && state.phase === 'play' && !state.paused) {
    e.preventDefault();
    useBomb();
    return;
  }
  if (e.code === 'KeyP') {
    if (state.phase === 'play') {
      state.paused = !state.paused;
      say(state.paused ? 'Pausa' : 'Reanudado');
    }
    return;
  }
  if (state.paused || state.phase !== 'play') return;
  const dir = codeToDir[e.code];
  if (dir) {
    e.preventDefault();
    held.add(dir);
  }
});

window.addEventListener('keyup', (e) => {
  const dir = codeToDir[e.code];
  if (dir) held.delete(dir);
});

function bindBtn(id, onDown, onUp) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      btn.classList.add('is-pressed');
      onDown();
    },
    { passive: false },
  );
  btn.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      btn.classList.remove('is-pressed');
      onUp?.();
    },
    { passive: false },
  );
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onDown();
  });
  btn.addEventListener('mouseup', () => onUp?.());
}

bindBtn(
  'btnUp',
  () => {
    if (state.phase === 'menu') startGame();
    else if (state.phase === 'select') cycleWeapon(-1);
    else held.add('up');
  },
  () => held.delete('up'),
);
bindBtn(
  'btnDown',
  () => {
    if (state.phase === 'select') cycleWeapon(1);
    else held.add('down');
  },
  () => held.delete('down'),
);
bindBtn(
  'btnLeft',
  () => held.add('left'),
  () => held.delete('left'),
);
bindBtn(
  'btnRight',
  () => held.add('right'),
  () => held.delete('right'),
);
bindBtn('btnBomb', () => {
  if (state.phase === 'menu') startGame();
  else if (state.phase === 'select') startStage();
  else useBomb();
});

const gamepad = createGamepad();
let prevStart = false;
let prevA = false;

function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  gamepadX = gp.axes[0] ?? 0;
  gamepadY = gp.axes[1] ?? 0;
  const startHeld = !!gp.buttons[9]?.pressed;
  if (startHeld && !prevStart) {
    if (state.phase === 'menu') startGame();
    else if (state.phase === 'play') state.paused = !state.paused;
  }
  prevStart = startHeld;
  const aHeld = !!gp.buttons[0]?.pressed;
  if (aHeld && !prevA) {
    if (state.phase === 'menu') startGame();
    else if (state.phase === 'select') startStage();
    else useBomb();
  }
  prevA = aHeld;
}

// ── Render ──
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const { w: canvasW, h: canvasH, s: scale, x: offX, y: offY } = setupCanvas(canvas, ctx, W, H, 0);

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#05060f';
  ctx.fillRect(0, 0, canvasW, canvasH);
  const ox = offX;
  const oy = offY;
  const sx = scale;

  // fondo de estrellas
  for (const st of stars) {
    st.y += st.z * (state.phase === 'play' ? 4 : 1.2);
    if (st.y > H) st.y = 0;
    ctx.globalAlpha = 0.3 + st.z * 0.5;
    ctx.fillStyle = '#9fc4ff';
    ctx.fillRect(ox + st.x * sx, oy + st.y * sx, st.z * 2.4 * sx, 4 * st.z * sx);
  }
  ctx.globalAlpha = 1;

  // área de juego
  ctx.fillStyle = 'rgba(4, 6, 16, 0.55)';
  ctx.fillRect(ox + PAD_X * sx, oy, PLAY_W * sx, PLAY_H * sx);
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox + PAD_X * sx, oy, PLAY_W * sx, PLAY_H * sx);

  ctx.save();
  ctx.translate(ox + PAD_X * sx, oy);
  const s = sx;

  // ── Nave del jugador ──
  if (player.y > -20 && state.phase !== 'menu') {
    const blink = player.inv > 0 && Math.floor(player.inv * 10) % 2 === 0;
    if (!blink) {
      ctx.save();
      ctx.translate(player.x * s, player.y * s);
      ctx.fillStyle = '#39ff14';
      ctx.beginPath();
      ctx.moveTo(0, -13 * s);
      ctx.lineTo(9 * s, 9 * s);
      ctx.lineTo(0, 5 * s);
      ctx.lineTo(-9 * s, 9 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(0, -6 * s);
      ctx.lineTo(4 * s, 7 * s);
      ctx.lineTo(-4 * s, 7 * s);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, 0, 0, 14 * s, '#39ff14', 0.3);
      ctx.restore();
    }
  }

  // ── Balas del jugador ──
  for (const b of bullets) {
    ctx.fillStyle = b.laser ? '#ff2d78' : b.heavy ? '#ffb800' : '#00f0ff';
    ctx.beginPath();
    ctx.arc(b.x * s, b.y * s, b.r * s * 0.9, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, b.x * s, b.y * s, b.r * s * 2, b.laser ? '#ff2d78' : '#00f0ff', 0.25);
  }

  // ── Balas enemigas ──
  for (const m of mBullets) {
    ctx.fillStyle = m.color || '#ff2d78';
    ctx.beginPath();
    ctx.arc(m.x * s, m.y * s, m.r * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Enemigos ──
  for (const e of enemies) {
    if (e.type === 'ship') {
      ctx.save();
      ctx.translate(e.x * s, e.y * s);
      ctx.fillStyle = '#ff2d78';
      ctx.beginPath();
      ctx.moveTo(0, 10 * s);
      ctx.lineTo(10 * s, -8 * s);
      ctx.lineTo(0, -4 * s);
      ctx.lineTo(-10 * s, -8 * s);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, 0, 0, 13 * s, '#ff2d78', 0.2);
      ctx.restore();
    } else {
      ctx.save();
      ctx.translate(e.x * s, e.y * s);
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.moveTo(0, -9 * s);
      ctx.lineTo(9 * s, 0);
      ctx.lineTo(0, 9 * s);
      ctx.lineTo(-9 * s, 0);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, 0, 0, 12 * s, '#c084fc', 0.25);
      ctx.restore();
    }
  }

  // ── Power-ups ──
  for (const p of pickups) {
    const c = WEAPON_COLOR[p.w] || '#fff';
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo((p.x - 8) * s, (p.y + 6) * s);
    ctx.lineTo((p.x + 8) * s, (p.y + 6) * s);
    ctx.lineTo(p.x * s, (p.y - 8) * s);
    ctx.closePath();
    ctx.fill();
    drawGlow(ctx, p.x * s, p.y * s, 12 * s, c, 0.3);
  }

  // ── Jefe ──
  if (boss) {
    ctx.save();
    ctx.translate(boss.x * s, boss.y * s);
    ctx.fillStyle = '#ff2d78';
    ctx.beginPath();
    ctx.moveTo(0, -30 * s);
    ctx.lineTo(20 * s, 8 * s);
    ctx.lineTo(24 * s, 26 * s);
    ctx.lineTo(12 * s, 22 * s);
    ctx.lineTo(0, 30 * s);
    ctx.lineTo(-12 * s, 22 * s);
    ctx.lineTo(-24 * s, 26 * s);
    ctx.lineTo(-20 * s, 8 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, -4 * s, 8 * s, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, 0, 0, 30 * s, '#ff2d78', 0.35);
    ctx.restore();
  }

  // ── Bomba de área ──
  for (const b of bombs) {
    ctx.globalAlpha = Math.max(0, b.ttl / 0.8) * 0.5;
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(b.x * s, b.y * s, b.r * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── Partículas ──
  drawParticles(ctx, ox + PAD_X * s, oy, s);

  // ── Pausa ──
  if (state.paused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, PLAY_W * s, PLAY_H * s);
    ctx.fillStyle = '#fff';
    ctx.font = `${26 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSA', PLAY_W * s * 0.5, PLAY_H * s * 0.5);
  }

  ctx.restore();

  // OE (sin estado: inactivo)
  if (state.phase === 'select') {
    ctx.fillStyle = 'rgba(5, 6, 15, 0.72)';
    ctx.fillRect(ox, oy, W * s, H * s);
    ctx.fillStyle = '#e6fdff';
    ctx.font = `${20 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Ronda ' + state.stage, ox + W * s * 0.5, oy + (H * s * 0.5 - 40 * s));
    ctx.fillStyle = '#7cffb2';
    ctx.font = `${15 * s}px 'Courier New', monospace`;
    ctx.fillText(
      'Elegí tu arma con ↑/↓ o SPACE para confirmar',
      ox + W * s * 0.5,
      oy + H * s * 0.5,
    );
  }

  ctx.restore();
}

// ── Update general ──
function updateGame(dt) {
  if (state.paused) return;

  // Pausa si murió
  if (state.phase === 'play' && state.lives <= 0) {
    updateEnemies(dt);
    return;
  }

  spawnEnemyRun();
  if (bossIntro) {
    bossIntro = false;
  }
  if (bossOutro > 0) {
    bossOutro -= dt;
    if (bossOutro <= 0) {
      clearTimer = 1.2;
    }
  }
  if (clearTimer > 0) {
    clearTimer -= dt;
    if (clearTimer <= 0) {
      state.score += 1000;
      state.stage++;
      updateHUD();
      goSelect();
    }
  }

  updatePlayer(dt);
  updateEnemies(dt);
  updateMBullets();
  updateBullets();
  updateBombs();
  updatePickups();
  updateBoss(dt);
  if (boss) updateBossBar();
}

// ── HUD ──
const scoreValueEl = document.getElementById('scoreValue');
const bestValueEl = document.getElementById('bestValue');
const levelValueEl = document.getElementById('levelValue');
const livesValueEl = document.getElementById('livesValue');
const bombsValueEl = document.getElementById('bombsValue');

function updateHUD() {
  scoreValueEl.textContent = String(state.score);
  bestValueEl.textContent = String(state.best);
  levelValueEl.textContent = String(state.stage);
  livesValueEl.textContent = String(Math.max(state.lives, 0));
  bombsValueEl.textContent = String(Math.max(state.bombs, 0));
}

// ── Overlay / anuncio ──
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const hintEl = document.getElementById('hintEl');
const finalScoreEl = document.getElementById('finalScore');
const announce = document.getElementById('announce');

function say(msg) {
  if (announce) announce.textContent = msg;
}

overlay.addEventListener('click', () => {
  if (state.phase === 'menu') startGame();
});

function playBossSound() {
  beep({ freq: 220, freqEnd: 440, duration: 0.15, type: 'sawtooth', volume: 0.18 });
}
function playBoomSound() {
  beep({ freq: 120, freqEnd: 40, duration: 0.22, type: 'sawtooth', volume: 0.2 });
}
function playDeathSound() {
  beep({ freq: 400, freqEnd: 80, duration: 0.35, type: 'sawtooth', volume: 0.18 });
}

// ── Bucle principal ──
const loop = createGameLoop((dt) => {
  pollGamepad();
  if (state.phase === 'play') {
    updateGame(dt);
  }
  updateParticles(dt);
  updateHUD();
  draw();
});

// Estado inicial
updateWeaponBar();
setupStage();
updateHUD();

shell.onCleanup(() => loop.stop());
document.getElementById('loading').classList.add('hidden');
loop.start();
