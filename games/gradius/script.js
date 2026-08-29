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
import { overlap as overlapBullet } from '../../shared/collide.js';

injectCommonElements();

const shell = setupGameShell('gradius');

/* ============================================================
   GRADIUS — Arcade Hub
   Side-scroll shooter: power-up bar (speed/missile/double/
   option/shield), 7 stages with bosses. Autofire + manual.
   Canvas 2D, sin dependencias externas.
   ============================================================ */

const W = 880;
const H = 560;
const BASE_MOVE = 3.2;
const SPEED_STEP = 0.65;

const state = {
  phase: 'menu',
  paused: false,
  stage: 1,
  score: 0,
  best: loadBest('gradius2d'),
  lives: 3,
};

const player = {
  x: 130,
  y: H / 2,
  vx: 0,
  vy: 0,
  inv: 0,
  fireTimer: 0,
  speed: 0,
  missile: false,
  double: false,
  options: 0,
  shield: false,
};

let enemies = [];
let bullets = [];
let mBullets = [];
let pickups = [];
let stars = [];
let cue = [];
let boss = null;
let stageClock = 0;
let introTimer = 0;
let bossOutro = 0;
let clearTimer = 0;
let gauge = 0;
let gameoverDone = false;
let damageThisStage = false;

// Input
const held = new Set();
let fireHeld = false;
let gamepadX = 0;
let gamepadY = 0;

function rnd(a, b) {
  return a + Math.random() * (b - a);
}


/* ── Ayudas de sonido ── */
function playShotSound() {
  beep({ freq: 880, freqEnd: 660, duration: 0.03, type: 'square', volume: 0.06 });
}
function playBoomSound() {
  beep({ freq: 110, freqEnd: 40, duration: 0.25, type: 'sawtooth', volume: 0.2 });
}
function playPickSound() {
  beep({ freq: 660, freqEnd: 990, duration: 0.08, type: 'triangle', volume: 0.15 });
}
function playPowerSound() {
  beep({ freq: 440, freqEnd: 880, duration: 0.12, type: 'square', volume: 0.14 });
}
function playDeathSound() {
  beep({ freq: 400, freqEnd: 70, duration: 0.4, type: 'sawtooth', volume: 0.18 });
}

/* ── Flujo del juego ── */
function startGame() {
  ensureAudio();
  state.score = 0;
  state.stage = 1;
  state.lives = 3;
  resetPower();
  enemies = [];
  bullets = [];
  mBullets = [];
  pickups = [];
  boss = null;
  cue = [];
  stageClock = 0;
  bossOutro = 0;
  clearTimer = 0;
  gauge = 0;
  gameoverDone = false;
  state.boss = false;
  removeBossBar();
  player.x = 130;
  player.y = H / 2;
  player.inv = 0;
  clearParticles();
  startAmbient();
  startMusic('gradius');
  shell.enableTabTrap();
  overlay.style.display = 'none';
  goPlay();
  updateGauge();
  updateHUD();
  say('Gradius — ¡En marcha!');
}

function resetPower() {
  player.speed = 0;
  player.missile = false;
  player.double = false;
  player.options = 0;
  player.shield = false;
  gauge = 0;
  updateGauge();
}

function goPlay() {
  state.phase = 'play';
  state.paused = false;
  introTimer = 1.6;
  stageClock = 0;
  cue = buildCue(state.stage);
  damageThisStage = false;
  player.x = 130;
  player.y = H / 2;
  player.inv = 2;
  removeBossBar();
}

function nextStage() {
  if (!damageThisStage) {
    achievements.unlock('gradius_no_damage_clear');
  }
  state.score += 1000 + state.stage * 500;
  state.stage++;
  updateHUD();
  goPlay();
}

function gameOver(win) {
  if (!gameoverDone) {
    gameoverDone = true;
    shell.disableTabTrap();
    stopMusic();
    if (state.score > state.best) {
      state.best = state.score;
      saveBest('gradius2d', state.best);
    }
    finalScoreEl.textContent = win ? `¡Victoria! Puntos: ${state.score}` : `Puntos: ${state.score}`;
    finalScoreEl.style.display = '';
    overlayText.textContent = win
      ? '¡Derrotaste a todos los jefes! La flota está a salvo.'
      : 'Nave destruida. ¡Reiniciá para volver al combate!';
    hintEl.innerHTML =
      '<kbd>R</kbd> reiniciar &nbsp;·&nbsp; <kbd>Espacio</kbd> / tap para jugar de nuevo';
    overlay.style.display = '';
    updateHUD();
    say(`Fin de partida — Puntos: ${state.score}. Mejor: ${state.best}`);
  }
}

/* ── Power-up bar ── */
const SLOTS = ['SPD', 'MSL', 'DBL', 'OPT', 'SHD'];

function slotAvailable(i) {
  if (i === 0) return player.speed < 4;
  if (i === 3) return player.options < 2;
  if (i === 1) return !player.missile;
  if (i === 2) return !player.double;
  return !player.shield;
}

function activatePower() {
  if (gauge === 0) return;
  const i = gauge;
  if (!slotAvailable(i)) {
    beep({ freq: 180, duration: 0.08, type: 'square', volume: 0.12 });
    gauge = 0;
    updateGauge();
    return;
  }
  playPowerSound();
  if (i === 0) {
    player.speed = Math.min(player.speed + 1, 4);
    if (player.speed === 4) {
      achievements.unlock('gradius_speed_demon');
    }
  } else if (i === 1) player.missile = true;
  else if (i === 2) player.double = true;
  else if (i === 3) {
    player.options++;
    if (player.options === 2) {
      achievements.unlock('gradius_option_master');
    }
  } else player.shield = true;
  gauge = 0;
  spawnParticles(player.x + 24, player.y, 10, '#39ff14', { spd: 120, life: 0.5 });
  updateGauge();
}

function updateGauge() {
  const bar = document.getElementById('gaugeBar');
  if (!bar) return;
  bar.innerHTML = '';
  for (let i = 0; i < SLOTS.length; i++) {
    const cell = document.createElement('div');
    cell.classList.add('gauge-cell');
    const label = document.createElement('span');
    label.textContent = SLOTS[i];
    // Equipo ya activado
    let equipped = false;
    let maxed = false;
    if (i === 0) equipped = player.speed > 0;
    else if (i === 1) equipped = player.missile;
    else if (i === 2) equipped = player.double;
    else if (i === 3) equipped = player.options > 0;
    else equipped = player.shield;
    if (i === 0) maxed = player.speed >= 4;
    else if (i === 3) maxed = player.options >= 2;
    if (equipped) cell.classList.add('equipped');
    if (maxed) cell.classList.add('maxed');
    if (i === gauge) cell.classList.add('current');
    cell.appendChild(label);
    cell.addEventListener('click', () => {
      gauge = Math.max(gauge, 0);
      activatePower();
    });
    bar.appendChild(cell);
  }
}

/* ── Generación de stage: cola de eventos ── */
function buildCue(stage) {
  const q = [];
  let t = 1.2;
  const steps = 5 + stage;
  for (let i = 0; i < steps; i++) {
    const y = rnd(80, H - 80);
    const type = Math.random() < 0.3 ? 'diver' : Math.random() < 0.15 ? 'pod' : 'ship';
    q.push({ at: t, type, y, n: type === 'diver' ? (stage >= 4 ? 2 : 1) : 1 });
    t += rnd(1.1, 1.7);
  }
  return q;
}

function spawnEvent(ev) {
  if (ev.type === 'formation') {
    const n = ev.n || 3 + Math.floor(state.stage / 2);
    for (let i = 0; i < n; i++) {
      enemies.push(
        mkEnemy('ship', W + 40 + i * 34, ev.y, -1.2 - (state.stage - 1) * 0.15, 0, true),
      );
    }
  } else if (ev.type === 'diver') {
    for (let i = 0; i < (ev.n || 1); i++) {
      enemies.push(
        mkEnemy('diver', W + 40 + i * 60, ev.y, -2.6 - (state.stage - 1) * 0.2, 0, true),
      );
    }
  } else if (ev.type === 'pod') {
    enemies.push(mkEnemy('pod', W + 40, ev.y, -1.6 - (state.stage - 1) * 0.12, 0, false));
  } else {
    enemies.push(mkEnemy('ship', W + 40, ev.y, -1.2 - (state.stage - 1) * 0.15, 0, true));
  }
}

function mkEnemy(type, x, y, vx, vy, fires) {
  return {
    type,
    x,
    y,
    vx,
    vy,
    r: type === 'diver' ? 15 : type === 'pod' ? 10 : 14,
    hp: type === 'diver' ? 2 + Math.floor(state.stage / 3) : 1,
    fires,
    fireTimer: rnd(1.2, 2.4),
    seed: Math.random() * Math.PI * 2,
    maxHp: 1,
  };
}

function updateSpawns(dt) {
  stageClock += dt;
  for (const ev of cue) {
    if (!ev.done && stageClock >= ev.at) {
      ev.done = true;
      spawnEvent(ev);
    }
  }
}

function checkSpawnBoss() {
  if (boss || bossOutro > 0) return;
  const allSpent = cue.every((ev) => ev.done);
  if (!allSpent) return;
  if (enemies.length > 0) return;
  spawnBoss(state.stage);
}

const BOSS_PARAMS = [
  { hp: 26, a: 0.9, v: 2.4, spins: 1, aimed: 1 },
  { hp: 32, a: 0.85, v: 2.7, spins: 1, aimed: 2 },
  { hp: 38, a: 0.8, v: 3.0, spins: 2, aimed: 2 },
  { hp: 46, a: 0.75, v: 3.2, spins: 2, aimed: 3 },
  { hp: 54, a: 0.7, v: 3.4, spins: 3, aimed: 3 },
  { hp: 62, a: 0.65, v: 3.6, spins: 3, aimed: 4 },
  { hp: 80, a: 0.6, v: 3.9, spins: 4, aimed: 5 },
];

function spawnBoss(stage) {
  const p = BOSS_PARAMS[Math.min(stage, 7) - 1];
  boss = {
    x: W - 150,
    y: H / 2,
    r: 26,
    hp: p.hp,
    maxHp: p.hp,
    a: p.a,
    v: p.v,
    spins: p.spins,
    aimed: p.aimed,
    timer: 1.5,
    phase: 0,
    spinDir: 1,
  };
  state.boss = true;
  document.getElementById('bossBarWrap').style.display = 'flex';
  updateBossBar();
  beep({ freq: 200, freqEnd: 420, duration: 0.18, type: 'sawtooth', volume: 0.18 });
}

function removeBossBar() {
  state.boss = false;
  const el = document.getElementById('bossBarWrap');
  if (el) el.style.display = 'none';
}

function updateBossBar() {
  const fill = document.getElementById('bossFill');
  if (!boss) return;
  fill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
}

const BOSS_COLORS = ['#ff2d78', '#ff8a65', '#ffd166'];

function bossFan(cx, cy, dir, speed, count, offset) {
  for (let i = 0; i < count; i++) {
    const a = dir + (i - (count - 1) / 2) * 0.16 + offset;
    mBullets.push({
      x: cx,
      y: cy,
      a,
      px: Math.cos(a) * speed,
      py: Math.sin(a) * speed,
      color: BOSS_COLORS[i % 3],
      r: 5,
      ttl: 10,
    });
  }
}

function bossAimed(cx, cy, speed, count) {
  const base = Math.atan2(player.y - cy, player.x - cx);
  for (let i = 0; i < count; i++) {
    const a = base + (i - (count - 1) / 2) * 0.14;
    mBullets.push({
      x: cx,
      y: cy,
      a,
      px: Math.cos(a) * speed,
      py: Math.sin(a) * speed,
      color: '#ffd166',
      r: 5,
      ttl: 10,
    });
  }
}

function updateBoss(dt) {
  if (!boss || bossOutro > 0) return;
  boss.timer -= dt;
  const t = performance.now() / 1000;
  boss.y = H / 2 + Math.sin(t * 1.3) * (H * 0.3);
  boss.x = W - 150 + Math.sin(t * 0.9) * 28;
  if (boss.timer <= 0) {
    boss.phase++;
    boss.spinDir *= -1;
    const off = boss.phase * 0.28;
    for (let s = 0; s < boss.spins; s++) {
      bossFan(boss.x, boss.y, boss.spinDir * s * 0.5, boss.v, 7, off);
    }
    bossAimed(boss.x, boss.y, boss.v * 1.5, Math.min(boss.aimed, 5));
    boss.timer = boss.a;
  }
}

/* ── Disparos del jugador ── */
function fire() {
  playShotSound();
  const nose = player.x + 16;
  const y = player.y;
  bullets.push({ x: nose, y: y - 5, vx: 11, vy: 0, r: 4 });
  bullets.push({ x: nose, y: y + 5, vx: 11, vy: 0, r: 4 });
  if (player.double) {
    bullets.push({ x: nose, y: y - 8, vx: 9.5, vy: -2.6, r: 4 });
    bullets.push({ x: nose, y: y + 8, vx: 9.5, vy: 2.6, r: 4 });
  }
  if (player.missile) {
    for (const off of [-16, 16]) {
      bullets.push({
        x: player.x + 4,
        y: y + off,
        vx: 5.2,
        vy: -1.4,
        r: 6,
        missile: true,
        fuse: 0,
      });
    }
  }
  for (let i = 1; i <= player.options; i++) {
    const oy = y + 16 * i;
    bullets.push({ x: player.x - 14 * i + 16, y: oy, vx: 11, vy: 0, r: 3 });
    bullets.push({ x: player.x - 14 * i + 16, y: oy - 10, vx: 11, vy: 0, r: 3 });
  }
}

function updateFire(dt) {
  if (state.paused) return;
  player.fireTimer -= dt;
  const interval = fireHeld ? 0.09 : 0.16;
  if (player.fireTimer <= 0) {
    player.fireTimer = interval;
    fire();
  }
}

/* ── Actualización del mundo ── */
function updatePlayer(dt) {
  let kx = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
  let ky = (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0);
  const sp = BASE_MOVE + player.speed * SPEED_STEP;
  const k = held.has('right') || held.has('left');
  const v = held.has('down') || held.has('up');
  kx = k ? kx : gamepadX;
  ky = v ? ky : gamepadY;
  const mag = Math.hypot(kx, ky) || 1;
  player.vx = (kx / Math.max(mag, 1)) * sp;
  player.vy = (ky / Math.max(mag, 1)) * sp;
  player.x = Math.max(16, Math.min(W - 16, player.x + player.vx));
  player.y = Math.max(16, Math.min(H - 16, player.y + player.vy));
  if (player.inv > 0) player.inv -= dt;
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.type === 'diver') {
      e.seed += 0.06;
      e.x += e.vx * (0.8 + Math.sin(e.seed) * 6 * dt);
      e.y = e.y + Math.sin(e.seed * 1.7) * 40 * dt;
      if (e.fires) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && e.x > 40 && e.x < W) {
          e.fireTimer = 2.2;
          const a = Math.atan2(player.y - e.y, player.x - e.x);
          mBullets.push({
            x: e.x - 10,
            y: e.y,
            a,
            px: Math.cos(a) * 4.6,
            py: Math.sin(a) * 4.6,
            color: '#ff2d78',
            r: 4,
            ttl: 8,
          });
        }
      }
    } else {
      e.x += e.vx;
      if (e.fires) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0 && e.x > 60 && e.x < W - 60) {
          e.fireTimer = 2.6;
          const a = Math.atan2(player.y - e.y, player.x - e.x);
          mBullets.push({
            x: e.x - 14,
            y: e.y,
            a,
            px: Math.cos(a) * 3.6,
            py: Math.sin(a) * 3.6,
            color: '#ff2d78',
            r: 4,
            ttl: 8,
          });
        }
      }
    }
  }
  enemies = enemies.filter((e) => e.x > -80);
}

function damageEnemy(e, dmg) {
  e.hp -= dmg;
  spawnParticles(e.x, e.y, 4, '#ffd166', { spd: 80, life: 0.3 });
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  state.score += e.type === 'diver' ? 250 : e.type === 'pod' ? 150 : 100;
  spawnParticles(e.x, e.y, 12, '#ffd166', { spd: 150, life: 0.55 });
  if (Math.random() < 0.16) {
    pickups.push({ x: e.x, y: e.y, vx: -1.6, vy: 0 });
  }
  updateHUD();
}

function updateBullets() {
  for (const b of bullets) {
    if (b.missile) {
      // Arco descendente tras un breve ascenso
      b.fuse += 0.016;
      if (b.fuse > 0.8) b.vy += 0.12;
    }
    b.x += b.vx;
    b.y += b.vy;
    if (b.x > W + 30 || b.y < -30 || b.y > H + 30) {
      b.dead = true;
      continue;
    }
    if (boss) {
      if (overlapBullet(b, b.r, boss, boss.r + 6)) {
        b.dead = true;
        boss.hp -= b.missile ? 3 : 1;
        spawnParticles(b.x, b.y, 6, '#ff8a65', { spd: 90, life: 0.4 });
        updateBossBar();
        continue;
      }
    }
    for (const e of enemies) {
      if (overlapBullet(b, b.r, e, e.r)) {
        b.dead = true;
        damageEnemy(e, b.missile ? 3 : 1);
        break;
      }
    }
  }
  bullets = bullets.filter((b) => !b.dead);
  if (boss && boss.hp <= 0) killBoss();
}

function killBoss() {
  if (!boss) return;
  if (!damageThisStage) {
    achievements.unlock('gradius_no_damage_clear');
  }
  removeBossBar();
  spawnParticles(boss.x, boss.y, 26, '#ffd166', { spd: 220, life: 0.9 });
  playBoomSound();
  state.score += 5000 + state.stage * 500;
  bossOutro = 1.1;
  boss = null;
  updateHUD();
}

function updateMBullets() {
  for (const m of mBullets) {
    m.x += m.px;
    m.y += m.py;
    m.ttl -= 0.016;
    if (player.inv <= 0 && overlapBullet(m, m.r, player, 10)) {
      m.dead = true;
      playerHit();
    }
  }
  mBullets = mBullets.filter((m) => !m.dead && m.ttl > 0);
  mBullets.forEach((m) => {
    if (m.x < -40 || m.x > W + 40 || m.y < -40 || m.y > H + 40) m.dead = true;
  });
  mBullets = mBullets.filter((m) => !m.dead);
}

function updatePickups() {
  for (const p of pickups) {
    p.x += p.vx;
    if (overlapBullet(p, 12, player, 14)) {
      p.dead = true;
      gauge = (gauge + 1) % SLOTS.length;
      playPickSound();
      updateGauge();
      spawnParticles(p.x, p.y, 8, '#00f0ff', { spd: 90, life: 0.4 });
    }
  }
  pickups = pickups.filter((p) => !p.dead && p.x > -30);
}

function playerHit() {
  if (player.inv > 0) return;
  damageThisStage = true;
  if (player.shield) {
    player.shield = false;
    player.inv = 1.2;
    playDeathSound();
    spawnParticles(player.x, player.y, 14, '#39ff14', { spd: 120, life: 0.5 });
    updateGauge();
    return;
  }
  player.inv = 2;
  state.lives--;
  spawnParticles(player.x, player.y, 16, '#00f0ff', { spd: 140, life: 0.6 });
  playDeathSound();
  resetPower();
  if (state.lives <= 0) {
    gameOver(false);
    return;
  }
  player.x = 130;
  player.y = H / 2;
  updateHUD();
}

/* ── Stars background ── */
function initStars() {
  stars = Array.from({ length: 130 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    z: 0.3 + Math.random() * 0.7,
  }));
}

/* ── Input ── */
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
  if (e.code === 'KeyR' && (state.phase === 'menu' || gameoverDone)) {
    e.preventDefault();
    startGame();
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.phase === 'menu' || gameoverDone) {
      startGame();
      return;
    }
    activatePower();
    return;
  }
  if (e.code === 'KeyP') {
    if (state.phase === 'play') {
      state.paused = !state.paused;
      say(state.paused ? 'Pausa' : 'Reanudado');
    }
    return;
  }
  if (e.code === 'KeyX' || e.code === 'KeyZ') {
    fireHeld = true;
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
  if (e.code === 'KeyX' || e.code === 'KeyZ') fireHeld = false;
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
  () => held.add('up'),
  () => held.delete('up'),
);
bindBtn(
  'btnDown',
  () => held.add('down'),
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
bindBtn(
  'btnFire',
  () => {
    if (state.phase === 'menu' || gameoverDone) startGame();
    else fireHeld = true;
  },
  () => {
    fireHeld = false;
  },
);

const gamepad = createGamepad();
let prevStart = false;
let prevA = false;
let prevB = false;

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
  fireHeld = fireHeld || aHeld;
  if (aHeld && !prevA && (state.phase === 'menu' || gameoverDone)) startGame();
  prevA = aHeld;
  const bHeld = !!gp.buttons[1]?.pressed;
  if (bHeld && !prevB && state.phase === 'play') activatePower();
  prevB = bHeld;
}

/* ── Update ── */
function updateGame(dt) {
  if (state.paused || gameoverDone) return;
  if (introTimer > 0) {
    introTimer -= dt;
    if (introTimer <= 0) {
      player.inv = 0;
    }
  }
  updateSpawns(dt);
  if (bossOutro > 0) {
    bossOutro -= dt;
    if (bossOutro <= 0) {
      clearTimer = 1.4;
    }
  }
  if (clearTimer > 0) {
    clearTimer -= dt;
    if (clearTimer <= 0) {
      nextStage();
    }
  }
  checkSpawnBoss();
  updateFire(dt);
  updatePlayer(dt);
  updateEnemies(dt);
  updateMBullets();
  updateBullets();
  updatePickups();
  updateBoss(dt);
  if (boss) updateBossBar();
}

/* ── Render ── */
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

  // Estrellas desplazándose hacia la derecha (el mundo avanza)
  for (const st of stars) {
    const spd = state.phase === 'play' ? 2.4 : 0.8;
    st.x -= st.z * spd;
    if (st.x < 0) st.x = W;
    ctx.globalAlpha = 0.25 + st.z * 0.45;
    ctx.fillStyle = '#9fc4ff';
    ctx.fillRect(ox + st.x * sx, oy + st.y * sx, st.z * 2 * sx, st.z * 2 * sx);
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(ox, oy);
  const s = sx;

  // Nave del jugador
  if (state.phase === 'play') {
    const blink = player.inv > 0 && Math.floor(player.inv * 10) % 2 === 0;
    if (!blink) {
      ctx.save();
      ctx.translate(player.x * s, player.y * s);
      ctx.fillStyle = '#39ff14';
      ctx.beginPath();
      ctx.moveTo(16 * s, 0);
      ctx.lineTo(-11 * s, 10 * s);
      ctx.lineTo(-6 * s, 0);
      ctx.lineTo(-11 * s, -10 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#00f0ff';
      ctx.beginPath();
      ctx.moveTo(7 * s, 0);
      ctx.lineTo(-5 * s, 4.5 * s);
      ctx.lineTo(-3 * s, 0);
      ctx.lineTo(-5 * s, -4.5 * s);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, 0, 0, 16 * s, '#39ff14', 0.3);
      ctx.restore();
    }
    // Options (drones)
    for (let i = 1; i <= player.options; i++) {
      const dx = -18 * i;
      const dy = 16 * i;
      const ox2 = player.x + dx;
      const oy2 = player.y + dy;
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.moveTo((ox2 + 8) * s, oy2 * s);
      ctx.lineTo(ox2 * s, (oy2 - 5) * s);
      ctx.lineTo((ox2 - 4) * s, oy2 * s);
      ctx.lineTo(ox2 * s, (oy2 + 5) * s);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, ox2 * s, oy2 * s, 8 * s, '#c084fc', 0.25);
    }
  }

  // Balas del jugador
  for (const b of bullets) {
    ctx.fillStyle = b.missile ? '#ffb800' : b.r > 4 ? '#00f0ff' : '#9ffcff';
    ctx.beginPath();
    ctx.arc(b.x * s, b.y * s, b.r * s * 0.8, 0, Math.PI * 2);
    ctx.fill();
    if (b.missile) drawGlow(ctx, b.x * s, b.y * s, 9 * s, '#ffb800', 0.35);
  }

  // Balas enemigas
  for (const m of mBullets) {
    ctx.fillStyle = m.color || '#ff2d78';
    ctx.beginPath();
    ctx.arc(m.x * s, m.y * s, m.r * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Enemigos
  for (const e of enemies) {
    if (e.type === 'diver') {
      ctx.save();
      ctx.translate(e.x * s, e.y * s);
      ctx.fillStyle = '#ff8a65';
      ctx.beginPath();
      ctx.moveTo(-12 * s, -8 * s);
      ctx.lineTo(10 * s, 0);
      ctx.lineTo(-12 * s, 8 * s);
      ctx.lineTo(-6 * s, 0);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, 0, 0, 13 * s, '#ff8a65', 0.25);
      ctx.restore();
    } else if (e.type === 'pod') {
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(e.x * s, e.y * s, 9 * s, 0, Math.PI * 2);
      ctx.fill();
      drawGlow(ctx, e.x * s, e.y * s, 11 * s, '#c084fc', 0.25);
    } else {
      ctx.save();
      ctx.translate(e.x * s, e.y * s);
      ctx.fillStyle = '#ff2d78';
      ctx.beginPath();
      ctx.moveTo(12 * s, -8 * s);
      ctx.lineTo(-10 * s, 0);
      ctx.lineTo(12 * s, 8 * s);
      ctx.lineTo(4 * s, 0);
      ctx.closePath();
      ctx.fill();
      drawGlow(ctx, 0, 0, 12 * s, '#ff2d78', 0.2);
      ctx.restore();
    }
  }

  // Power-ups
  for (const p of pickups) {
    ctx.fillStyle = '#00f0ff';
    ctx.beginPath();
    ctx.arc(p.x * s, p.y * s, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, p.x * s, p.y * s, 10 * s, '#00f0ff', 0.35);
    ctx.fillStyle = '#05060f';
    ctx.font = `bold ${8 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', p.x * s, p.y * s);
  }

  // Jefe
  if (boss) {
    ctx.save();
    ctx.translate(boss.x * s, boss.y * s);
    ctx.fillStyle = '#ff2d78';
    ctx.beginPath();
    ctx.arc(0, 0, 24 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a40b40';
    ctx.beginPath();
    ctx.arc(0, 0, 15 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(0, 0, 7 * s, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, 0, 0, 30 * s, '#ff2d78', 0.35);
    ctx.restore();
  }

  // Partículas
  drawParticles(ctx, ox, oy, s);

  // Banner de ronda
  if (state.phase === 'play' && introTimer > 0) {
    ctx.fillStyle = 'rgba(5, 6, 15, 0.55)';
    ctx.fillRect(0, 0, W * s, H * s);
    ctx.fillStyle = '#e6fdff';
    ctx.font = `${26 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SECTOR ${state.stage}`, W * s * 0.5, H * s * 0.45);
    ctx.fillStyle = '#7cffb2';
    ctx.font = `${14 * s}px 'Courier New', monospace`;
    ctx.fillText('Destruí a los enemigos y derrotá al jefe', W * s * 0.5, H * s * 0.55);
  }

  // Pausa
  if (state.paused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, W * s, H * s);
    ctx.fillStyle = '#fff';
    ctx.font = `${26 * s}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSA', W * s * 0.5, H * s * 0.5);
  }

  ctx.restore();

  // Overlay de menú (fondo con estrellas)
  if (state.phase === 'menu') {
    ctx.fillStyle = 'rgba(5, 6, 15, 0.6)';
    ctx.fillRect(ox, oy, W * s, H * s);
  }

  ctx.restore();
}

/* ── HUD ── */
const scoreValueEl = document.getElementById('scoreValue');
const bestValueEl = document.getElementById('bestValue');
const levelValueEl = document.getElementById('levelValue');
const livesValueEl = document.getElementById('livesValue');

function updateHUD() {
  scoreValueEl.textContent = String(state.score);
  bestValueEl.textContent = String(state.best);
  levelValueEl.textContent = String(state.stage);
  livesValueEl.textContent = String(Math.max(state.lives, 0));
}

/* ── Overlay / mensaje ── */
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const hintEl = document.getElementById('hintEl');
const finalScoreEl = document.getElementById('finalScore');
const announce = document.getElementById('announce');

function say(msg) {
  if (announce) announce.textContent = msg;
}

overlay.addEventListener('click', () => {
  if (state.phase === 'menu' || gameoverDone) startGame();
});

/* ── Bucle principal ── */
const loop = createGameLoop((dt) => {
  pollGamepad();
  if (state.phase === 'play') {
    updateGame(dt);
  }
  updateParticles(dt);
  updateHUD();
  draw();
});

initStars();
updateGauge();
state.boss = false;
removeBossBar();
updateHUD();

shell.onCleanup(() => loop.stop());
document.getElementById('loading').classList.add('hidden');
loop.start();
