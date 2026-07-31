import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import { createGameLoop } from '../../shared/loop.js';
import { createGamepad } from '../../shared/input.js';
import {
  triggerShake,
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
  clearParticles,
  drawGlow,
  feedbackBundle,
  triggerSquash,
  updateSquashes,
  getSquash,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();

document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';

/* ============================================================
   JOUST — Arcade Hub
   Canvas 2D game, sin dependencias.
   Basado en el clásico de 1982 de Williams Electronics.
   ============================================================ */

// ── CONSTANTES ──
const GAME_W = 480;
const GAME_H = 540;

// Plataformas: x, y, w, h (en píxeles)
const PLATFORMS = [
  { x: 0, y: 470, w: GAME_W, h: 12 }, // suelo / puente base
  { x: 40, y: 360, w: 160, h: 10 }, // plataforma baja izq
  { x: 280, y: 360, w: 160, h: 10 }, // plataforma baja der
  { x: 140, y: 260, w: 200, h: 10 }, // plataforma media
  { x: 20, y: 170, w: 130, h: 10 }, // plataforma alta izq
  { x: 330, y: 170, w: 130, h: 10 }, // plataforma alta der
  { x: 180, y: 80, w: 120, h: 10 }, // plataforma cima
];

const LAVA_Y = 500; // inicio visual de la lava
const PLAYER_W = 32;
const PLAYER_H = 36;
const PLAYER_MAX_SPEED = 200;
const PLAYER_ACCEL = 600;
const PLAYER_FRICTION = 0.92;
const FLAP_VEL = -280; // impulso vertical al aletear
const GRAVITY = 900;
const MAX_ENEMIES = 8;
const EGG_BOUNCE = 0.5;
const EGG_HATCH_TIME = 5; // segundos para eclosionar

// ── ESTADO ──
const state = {
  running: false,
  gameOver: false,
  score: 0,
  wave: 1,
  lives: 3,
  enemiesRemaining: 0,
  waveActive: false,
  combo: 0, // huevos consecutivos
  totalEggs: 0,
  firstJoustDone: false,
};

const player = {
  x: GAME_W / 2 - PLAYER_W / 2,
  y: 300,
  vx: 0,
  vy: 0,
  w: PLAYER_W,
  h: PLAYER_H,
  onGround: false,
  facing: 1,
  flapCooldown: 0,
  flapAnim: 0,
  invincible: 0,
  squashIdx: -1,
};

let enemies = [];
let eggs = [];
let enemySpawned = 0;
let animTime = 0;

// ── CANVAS SETUP ──
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const {
  w: canvasW,
  h: canvasH,
  s: scale,
  x: offX,
  y: offY,
} = setupCanvas(canvas, ctx, GAME_W, GAME_H, 12);

// ── SONIDOS ──
function playFlap() {
  beep({ freq: 400, freqEnd: 600, duration: 0.06, type: 'square', volume: 0.08 });
}
function playJoust(x, y) {
  player.squashIdx = triggerSquash(0.2, 0.6, 1.5);
  feedbackBundle('medium', x, y, {
    color: '#c084fc',
    onBeep: () =>
      beep({ freq: 600, freqEnd: 1200, duration: 0.12, type: 'triangle', volume: 0.12 }),
  });
}
function playDeath(x, y) {
  player.squashIdx = triggerSquash(0.25, 0.5, 1.6);
  feedbackBundle('large', x, y, {
    color: '#ff4444',
    noFlash: true,
    onBeep: () => beep({ freq: 200, freqEnd: 60, duration: 0.35, type: 'sawtooth', volume: 0.15 }),
  });
}
function playEgg(x, y) {
  feedbackBundle('small', x, y, {
    color: '#ffb800',
    onBeep: () => beep({ freq: 880, freqEnd: 1320, duration: 0.1, type: 'sine', volume: 0.1 }),
  });
}
function playWave() {
  triggerShake(3);
  [440, 554, 659, 880].forEach((f, i) =>
    setTimeout(() => beep({ freq: f, duration: 0.1, type: 'triangle', volume: 0.12 }), i * 100),
  );
}

// ── ENTRADA ──
const keys = { left: false, right: false, flap: false, flapPressed: false };
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'KeyA'].includes(e.code)) {
    e.preventDefault();
    keys.left = true;
  }
  if (['ArrowRight', 'KeyD'].includes(e.code)) {
    e.preventDefault();
    keys.right = true;
  }
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault();
    if (!state.running && !state.gameOver) startGame();
    else keys.flapPressed = true;
  }
  if (e.code === 'KeyR') {
    e.preventDefault();
    startGame();
  }
});
window.addEventListener('keyup', (e) => {
  if (['ArrowLeft', 'KeyA'].includes(e.code)) keys.left = false;
  if (['ArrowRight', 'KeyD'].includes(e.code)) keys.right = false;
});

// Táctil
function bindTouch(btnId, onDown, onUp) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      onDown();
      btn.classList.add('is-pressed');
    },
    { passive: false },
  );
  btn.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      onUp();
      btn.classList.remove('is-pressed');
    },
    { passive: false },
  );
  btn.addEventListener('touchcancel', () => {
    onUp();
    btn.classList.remove('is-pressed');
  });
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onDown();
  });
  btn.addEventListener('mouseup', () => onUp());
  btn.addEventListener('mouseleave', () => onUp());
}
bindTouch(
  'btnLeft',
  () => (keys.left = true),
  () => (keys.left = false),
);
bindTouch(
  'btnRight',
  () => (keys.right = true),
  () => (keys.right = false),
);
bindTouch(
  'btnUp',
  () => {
    if (!state.running && !state.gameOver) startGame();
    else keys.flapPressed = true;
  },
  () => {},
);

// Gamepad
const gamepad = createGamepad();
let prevFlapBtn = false;

function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  const axis = gp.axes[0] ?? 0;
  if (axis < -0.3) keys.left = true;
  else if (!(gp.axes[0] < -0.3)) keys.left = false;
  if (axis > 0.3) keys.right = true;
  else if (!(gp.axes[0] > 0.3)) keys.right = false;
  const flapBtn = !!(gp.buttons[0]?.pressed || gp.buttons[12]?.pressed);
  if (flapBtn && !prevFlapBtn) {
    if (!state.running && !state.gameOver) startGame();
    else keys.flapPressed = true;
  }
  prevFlapBtn = flapBtn;
}

// ── OVERLAY ──
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const hintEl = document.getElementById('hintEl');
const finalScoreEl = document.getElementById('finalScore');
const announce = document.getElementById('announce');
overlay.addEventListener('click', () => {
  if (!state.running && !state.gameOver) startGame();
});

function say(msg) {
  if (announce) announce.textContent = msg;
}
function trapTab(e) {
  if (e.key === 'Tab') e.preventDefault();
}

// ── LÓGICA DEL JUEGO ──

function initPlayer() {
  player.x = GAME_W / 2 - PLAYER_W / 2;
  player.y = 300;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.facing = 1;
  player.flapCooldown = 0;
  player.flapAnim = 0;
  player.invincible = 0;
}

function startGame() {
  ensureAudio();
  startAmbient();
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.wave = 1;
  state.lives = 3;
  state.combo = 0;
  state.totalEggs = 0;
  state.firstJoustDone = false;
  enemies = [];
  eggs = [];
  clearParticles();
  clearSquashes();
  achievements.incrementPlays('joust');
  initPlayer();
  overlay.classList.add('hidden');
  document.addEventListener('keydown', trapTab);
  hintEl.innerHTML =
    '<kbd>←</kbd><kbd>→</kbd> mover · <kbd>Espacio</kbd> / <kbd>↑</kbd> aletear · <kbd>R</kbd> reiniciar';
  say(`Joust: oleada ${state.wave}. Sobreviví y derrotá a los enemigos.`);
  startWave();
  updateHUD();
}

function startWave() {
  state.waveActive = true;
  state.combo = 0;
  enemySpawned = 0;
  const count = Math.min(3 + state.wave, MAX_ENEMIES);
  state.enemiesRemaining = count;
  // Spawn inicial
  for (let i = 0; i < count; i++) {
    spawnEnemy();
  }
  playWave();
}

function spawnEnemy() {
  let type = 'bounder';
  const r = Math.random();
  if (state.wave >= 3 && r > 0.7) type = 'shadow-lord';
  else if (state.wave >= 2 && r > 0.5) type = 'hunter';

  const side = Math.random() > 0.5 ? 0 : GAME_W;
  const plat = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
  const e = {
    x: side,
    y: plat.y - 30,
    vx: (side === 0 ? 1 : -1) * (60 + state.wave * 10 + Math.random() * 30),
    vy: -100 - Math.random() * 100,
    w: 30,
    h: 34,
    type,
    facing: side === 0 ? 1 : -1,
    flapTimer: 0,
    flapInterval: 0.4 + Math.random() * 0.3 - state.wave * 0.01,
    onGround: false,
    active: true,
  };
  enemies.push(e);
  enemySpawned++;
}

function loseLife() {
  playDeath(player.x + player.w / 2, player.y + player.h / 2);
  state.lives -= 1;
  if (state.lives <= 0) {
    endGame();
    return;
  }
  initPlayer();
  player.invincible = 1.5;
  // Reposicionar enemigos si es necesario
  updateHUD();
}

function endGame() {
  stopAmbient();
  state.running = false;
  state.gameOver = true;
  const best = parseInt(localStorage.getItem('joust_best') || '0');
  if (state.score > best) {
    localStorage.setItem('joust_best', String(state.score));
  }
  overlayText.textContent = '¡Game Over! 💀';
  finalScoreEl.style.display = 'block';
  finalScoreEl.textContent = `Puntaje: ${state.score} · Récord: ${Math.max(state.score, best)}`;
  hintEl.innerHTML = '<kbd>Espacio</kbd> / tocar para reintentar · <kbd>R</kbd> reiniciar';
  say(`Joust: Game Over. Puntaje final: ${state.score}.`);
  document.removeEventListener('keydown', trapTab);
  overlay.classList.remove('hidden');
}

function nextWave() {
  state.wave += 1;
  if (state.wave >= 5 && !achievements.has('joust_invincible')) {
    achievements.unlock('joust_invincible');
  }
  startWave();
  // Recuperar vida cada 3 oleadas
  if (state.wave % 3 === 0 && state.lives < 5) state.lives += 1;
  updateHUD();
}

// ── COLISIONES ──
function rectCollide(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function getPlayerRect() {
  return { x: player.x, y: player.y, w: player.w, h: player.h };
}

function getEnemyRect(e) {
  return { x: e.x, y: e.y, w: e.w, h: e.h };
}

function getEggRect(egg) {
  return { x: egg.x - 8, y: egg.y - 10, w: 16, h: 20 };
}

function checkPlatformCollision(entity, w, h) {
  for (const p of PLATFORMS) {
    if (
      entity.x + w > p.x + 2 &&
      entity.x < p.x + p.w - 2 &&
      entity.y + h > p.y &&
      entity.y + h < p.y + p.h + 12 &&
      entity.vy >= 0
    ) {
      entity.y = p.y - h;
      entity.vy = 0;
      entity.onGround = true;
      return true;
    }
  }
  return false;
}

// ── FÍSICA DEL JUGADOR ──
function updatePlayer(dt) {
  // Invincibilidad
  if (player.invincible > 0) player.invincible -= dt;

  // Movimiento horizontal
  let moveDir = 0;
  if (keys.left) moveDir -= 1;
  if (keys.right) moveDir += 1;

  if (moveDir !== 0) {
    player.vx += moveDir * PLAYER_ACCEL * dt;
    player.facing = moveDir;
  } else {
    player.vx *= PLAYER_FRICTION;
  }
  player.vx = Math.max(-PLAYER_MAX_SPEED, Math.min(PLAYER_MAX_SPEED, player.vx));

  // Aleteo
  if (keys.flapPressed && player.flapCooldown <= 0) {
    player.vy = FLAP_VEL;
    player.flapCooldown = 0.15;
    player.flapAnim = 0.3;
    player.onGround = false;
    player.squashIdx = triggerSquash(0.15, 0.7, 1.4);
    playFlap();
    spawnParticles(player.x + player.w / 2, player.y + player.h, 'rgba(192,132,252,0.5)', 3, {
      spd: 40,
      life: 0.3,
      sm: 2,
      smx: 3,
    });
    keys.flapPressed = false;
  }
  if (player.flapCooldown > 0) player.flapCooldown -= dt;
  if (player.flapAnim > 0) player.flapAnim -= dt;

  // Gravedad
  player.vy += GRAVITY * dt;
  player.vy = Math.min(player.vy, 600);

  // Mover X con wrapping
  player.x += player.vx * dt;
  if (player.x + player.w < 0) player.x = GAME_W;
  else if (player.x > GAME_W) player.x = -player.w;

  // Mover Y
  player.y += player.vy * dt;

  // Colisión con plataformas
  player.onGround = false;
  checkPlatformCollision(player, player.w, player.h);

  // Lava
  if (player.y + player.h > LAVA_Y) {
    if (!state.gameOver) loseLife();
  }
}

// ── IA DE ENEMIGOS ──
function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.active) continue;

    // Flapping automático según tipo
    e.flapTimer -= dt;
    if (e.flapTimer <= 0) {
      if (e.type === 'shadow-lord') {
        e.vy = -320 - Math.random() * 80;
      } else if (e.type === 'hunter') {
        e.vy = -250 - Math.random() * 60;
      } else {
        e.vy = -200 - Math.random() * 50;
      }
      e.flapTimer = e.flapInterval + Math.random() * 0.2;
    }

    // Gravedad
    e.vy += GRAVITY * dt;
    e.vy = Math.min(e.vy, 500);

    // Movimiento horizontal según tipo
    const targetX = player.x;

    if (e.type === 'shadow-lord') {
      // Agresivo: persigue al jugador activamente
      const dx = targetX - e.x;
      const dy = player.y - e.y;
      const speed = 100 + state.wave * 5;
      if (Math.abs(dx) > 20) e.vx += Math.sign(dx) * 200 * dt;
      if (dy < -50) e.vy = -350;
      e.vx = Math.max(-speed, Math.min(speed, e.vx));
    } else if (e.type === 'hunter') {
      // Persigue pero más lento
      const dx = targetX - e.x;
      const speed = 70 + state.wave * 4;
      if (Math.abs(dx) > 30) e.vx += Math.sign(dx) * 150 * dt;
      e.vx = Math.max(-speed, Math.min(speed, e.vx));
    } else {
      // Bounder: movimiento errático con cambios de dirección
      if (Math.random() < 0.01) e.vx = -e.vx;
      e.vx = Math.max(-60 - state.wave * 5, Math.min(60 + state.wave * 5, e.vx));
    }

    // Facing
    if (Math.abs(e.vx) > 10) e.facing = Math.sign(e.vx);

    // Mover X con wrapping
    e.x += e.vx * dt;
    if (e.x + e.w < 0) e.x = GAME_W;
    else if (e.x > GAME_W) e.x = -e.w;

    // Mover Y
    e.y += e.vy * dt;

    // Colisión con plataformas
    e.onGround = false;
    checkPlatformCollision(e, e.w, e.h);

    // Lava: enemigos mueren en lava también
    if (e.y + e.h > LAVA_Y) {
      enemies.splice(i, 1);
      state.enemiesRemaining--;
      continue;
    }

    // Jousting: colisión con el jugador
    if (player.invincible <= 0) {
      const pr = getPlayerRect();
      const er = getEnemyRect(e);
      if (rectCollide(pr, er)) {
        const playerCenter = pr.y + pr.h / 2;
        const enemyCenter = er.y + er.h / 2;
        // El que está más arriba gana
        if (playerCenter < enemyCenter - 6) {
          // Jugador gana
          e.active = false;
          const points = e.type === 'shadow-lord' ? 1500 : e.type === 'hunter' ? 750 : 500;
          state.score += points;
          if (!state.firstJoustDone) {
            state.firstJoustDone = true;
            achievements.unlock('joust_first_joust');
          }
          playJoust(e.x + e.w / 2, e.y + e.h / 2);
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#c084fc', 12, { spd: 100, life: 0.5 });
          // Crear huevo
          eggs.push({
            x: e.x + e.w / 2,
            y: e.y,
            vy: -150,
            vx: (Math.random() - 0.5) * 80,
            timer: EGG_HATCH_TIME,
            bounce: 0,
          });
          enemies.splice(i, 1);
          state.enemiesRemaining--;
          player.vy = -150; // pequeño rebote al ganar
          updateHUD();
        } else {
          // Enemigo gana
          loseLife();
        }
      }
    }

    // También revisar jousting entre enemigos (chocan entre sí)
    for (let j = i - 1; j >= 0; j--) {
      const e2 = enemies[j];
      if (!e2.active) continue;
      if (rectCollide(getEnemyRect(e), getEnemyRect(e2))) {
        const c1 = e.y + e.h / 2;
        const c2 = e2.y + e2.h / 2;
        if (c1 < c2 - 4) {
          e.vy = -120;
          e2.vy = 80;
        } else if (c2 < c1 - 4) {
          e2.vy = -120;
          e.vy = 80;
        }
      }
    }
  }
}

// ── HUEVOS ──
function updateEggs(dt) {
  for (let i = eggs.length - 1; i >= 0; i--) {
    const egg = eggs[i];
    egg.vy += GRAVITY * dt;
    egg.x += egg.vx * dt;
    egg.y += egg.vy * dt;

    // Rebote en plataformas (con pérdida de energía)
    for (const p of PLATFORMS) {
      if (
        egg.x > p.x + 4 &&
        egg.x < p.x + p.w - 4 &&
        egg.y + 10 > p.y &&
        egg.y + 10 < p.y + p.h + 12 &&
        egg.vy >= 0
      ) {
        egg.y = p.y - 10;
        egg.vy = -egg.vy * EGG_BOUNCE;
        egg.bounce++;
        if (Math.abs(egg.vy) < 20) egg.vy = 0;
      }
    }

    // Wrapping horizontal
    if (egg.x < 0) egg.x = GAME_W;
    else if (egg.x > GAME_W) egg.x = 0;

    // Lava: huevos se destruyen en lava
    if (egg.y > LAVA_Y + 20) {
      eggs.splice(i, 1);
      continue;
    }

    // Temporizador de eclosión
    egg.timer -= dt;
    if (egg.timer <= 0) {
      // Eclosiona: spawn enemy
      const type = state.wave >= 3 && Math.random() > 0.6 ? 'hunter' : 'bounder';
      const newEnemy = {
        x: egg.x - 15,
        y: egg.y - 30,
        vx: (Math.random() > 0.5 ? 1 : -1) * (60 + state.wave * 8),
        vy: -180,
        w: 30,
        h: 34,
        type,
        facing: 1,
        flapTimer: 0,
        flapInterval: 0.5 + Math.random() * 0.3,
        onGround: false,
        active: true,
      };
      enemies.push(newEnemy);
      state.enemiesRemaining++;
      eggs.splice(i, 1);
      beep({ freq: 300, freqEnd: 600, duration: 0.15, type: 'sawtooth', volume: 0.08 });
      continue;
    }

    // Colisión con jugador (recolectar huevo)
    const pr = getPlayerRect();
    const er = getEggRect(egg);
    if (rectCollide(pr, er)) {
      state.combo++;
      state.totalEggs++;
      if (state.totalEggs >= 10 && !achievements.has('joust_egg_hunter')) {
        achievements.unlock('joust_egg_hunter');
      }
      const bonus = Math.min(state.combo, 4) * 250;
      state.score += bonus;
      playEgg(egg.x, egg.y);
      spawnParticles(egg.x, egg.y, '#ffb800', 8, { spd: 60, life: 0.4 });
      eggs.splice(i, 1);
      updateHUD();
    }
  }
}

// ── HUD ──
const scoreEl = document.getElementById('scoreDisplay');
const waveEl = document.getElementById('waveDisplay');
const livesEl = document.getElementById('livesDisplay');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  waveEl.textContent = String(state.wave);
  livesEl.textContent = String(state.lives);
}

// ── RENDER ──
function draw() {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);
  const s = scale,
    ox = offX,
    oy = offY;

  // ── Fondo: cielo oscuro con estrellas ──
  const grad = ctx.createRadialGradient(
    ox + GAME_W * s * 0.5,
    oy + GAME_H * s * 0.2,
    0,
    ox + GAME_W * s * 0.5,
    oy + GAME_H * s * 0.5,
    GAME_W * s * 0.9,
  );
  grad.addColorStop(0, '#1a1030');
  grad.addColorStop(0.5, '#0e0820');
  grad.addColorStop(1, '#060410');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, GAME_W * s, GAME_H * s);

  // Estrellas
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  const seed = 42;
  for (let i = 0; i < 40; i++) {
    const sx = ox + ((i * 137 + seed) % GAME_W) * s;
    const sy = oy + ((i * 97 + seed) % (LAVA_Y - 60)) * s * 0.8;
    const sr = (1 + (i % 3) * 0.3) * s;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Lava ──
  const lavaGrad = ctx.createLinearGradient(0, oy + LAVA_Y * s, 0, oy + GAME_H * s);
  lavaGrad.addColorStop(0, '#ff4400');
  lavaGrad.addColorStop(0.3, '#cc2200');
  lavaGrad.addColorStop(0.7, '#881100');
  lavaGrad.addColorStop(1, '#440800');
  ctx.fillStyle = lavaGrad;
  ctx.shadowColor = 'rgba(255,68,0,0.3)';
  ctx.shadowBlur = 20 * s;
  roundRect(ctx, ox, oy + LAVA_Y * s, GAME_W * s, (GAME_H - LAVA_Y) * s, 0);
  ctx.fill();

  // Ondas de lava
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,120,40,0.15)';
  ctx.lineWidth = 2 * s;
  for (let i = 0; i < 4; i++) {
    const wy = oy + (LAVA_Y + 15 + i * 12 + Math.sin(animTime * 2 + i * 1.5) * 4) * s;
    ctx.beginPath();
    for (let wx = ox; wx < ox + GAME_W * s; wx += 4 * s) {
      const lx = (wx - ox) / s;
      const ly = wy + Math.sin(lx * 0.05 + animTime * 3 + i) * 3 * s;
      wx === ox ? ctx.moveTo(wx, ly) : ctx.lineTo(wx, ly);
    }
    ctx.stroke();
  }

  // Mano troll emergiendo de la lava (decorativa)
  ctx.fillStyle = 'rgba(255,68,0,0.2)';
  ctx.shadowBlur = 0;
  const trollX = ox + Math.sin(animTime * 0.5) * 60 * s + GAME_W * s * 0.5;
  const trollY = oy + (LAVA_Y - 10 + Math.sin(animTime * 1.2) * 6) * s;
  roundRect(ctx, trollX - 10 * s, trollY, 20 * s, 20 * s, 6 * s);
  ctx.fill();
  // Dedos
  for (let d = -1; d <= 1; d += 0.5) {
    ctx.beginPath();
    ctx.arc(trollX + d * 10 * s, trollY - 4 * s, 4 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Plataformas ──
  for (const p of PLATFORMS) {
    const px = ox + p.x * s;
    const py = oy + p.y * s;
    const pw = p.w * s;
    const ph = p.h * s;

    // Piedra principal
    const pg = ctx.createLinearGradient(px, py, px, py + ph);
    pg.addColorStop(0, '#6b5b8a');
    pg.addColorStop(0.4, '#4a3d6b');
    pg.addColorStop(1, '#2a2045');
    ctx.fillStyle = pg;
    roundRect(ctx, px, py, pw, ph, 3 * s);
    ctx.fill();

    drawGlow(ctx, px + pw / 2, py + ph / 2, pw * 0.5, 'rgba(192,132,252,0.08)', 0.06, 2.5);

    // Borde superior brillante
    ctx.fillStyle = 'rgba(192,132,252,0.15)';
    roundRect(ctx, px, py, pw, 3 * s, 2 * s);
    ctx.fill();

    // Textura de piedra
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    for (let tx = px + 8 * s; tx < px + pw - 8 * s; tx += 14 * s) {
      roundRect(ctx, tx, py + 2 * s, 6 * s, ph - 4 * s, 1 * s);
      ctx.fill();
    }
  }

  // ── Huevos ──
  for (const egg of eggs) {
    const ex = ox + egg.x * s;
    const ey = oy + egg.y * s;
    const r = 10 * s;
    const nearHatch = egg.timer < 1.5;

    // Sombra
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(ex, ey + r + 2 * s, r * 0.8, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Huevo
    const eggGlowColor = nearHatch ? 'rgba(255,50,50,0.3)' : 'rgba(192,132,252,0.12)';
    const eg = ctx.createRadialGradient(ex - r * 0.3, ey - r * 0.3, 0, ex, ey, r);
    if (nearHatch) {
      eg.addColorStop(0, '#ff6666');
      eg.addColorStop(0.5, '#cc3333');
      eg.addColorStop(1, '#881111');
    } else {
      eg.addColorStop(0, '#d4b8ff');
      eg.addColorStop(0.5, '#a078d8');
      eg.addColorStop(1, '#7a58b0');
    }
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(ex, ey, r, r * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();

    drawGlow(ctx, ex, ey, r * 0.6, eggGlowColor, 0.08, 3);

    // Brillito
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(ex - r * 0.3, ey - r * 0.3, r * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Grietas si está por eclosionar
    if (nearHatch) {
      ctx.strokeStyle = 'rgba(255,80,80,0.6)';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(ex - r * 0.4, ey);
      ctx.lineTo(ex + r * 0.1, ey - r * 0.2);
      ctx.lineTo(ex + r * 0.3, ey + r * 0.1);
      ctx.stroke();
    }
  }

  // ── Enemigos ──
  for (const e of enemies) {
    const ex = ox + e.x * s;
    const ey = oy + e.y * s;
    const ew = e.w * s;
    const eh = e.h * s;

    // Sombra
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(ex + ew / 2, ey + eh + 3 * s, ew * 0.5, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Color según tipo
    let bodyColor, bodyColor2, wingColor, glowColor;
    if (e.type === 'shadow-lord') {
      bodyColor = '#4a6a9a';
      bodyColor2 = '#2a3a6a';
      wingColor = '#5a7aaa';
      glowColor = 'rgba(74,106,154,0.4)';
    } else if (e.type === 'hunter') {
      bodyColor = '#7a7a8a';
      bodyColor2 = '#5a5a6a';
      wingColor = '#8a8a9a';
      glowColor = 'rgba(122,122,138,0.3)';
    } else {
      bodyColor = '#cc4444';
      bodyColor2 = '#992a2a';
      wingColor = '#dd6666';
      glowColor = 'rgba(204,68,68,0.3)';
    }

    // Cuerpo (buzzard)
    const bg = ctx.createLinearGradient(ex, ey, ex, ey + eh);
    bg.addColorStop(0, bodyColor);
    bg.addColorStop(1, bodyColor2);
    ctx.fillStyle = bg;
    roundRect(ctx, ex + 4 * s, ey + 10 * s, ew - 8 * s, eh - 14 * s, 4 * s);
    ctx.fill();

    drawGlow(ctx, ex + ew / 2, ey + eh / 2, ew * 0.6, glowColor, 0.08, 3);

    // Alas
    ctx.shadowBlur = 6 * s;
    ctx.fillStyle = wingColor;
    const wingFlap = Math.sin(animTime * 6 + e.x) * 0.3 + 0.6;
    const wingW = 14 * s;
    const wingH = 6 * s * wingFlap;
    // Ala izquierda
    roundRect(ctx, ex - wingW + 8 * s, ey + 12 * s, wingW, wingH, 2 * s);
    ctx.fill();
    // Ala derecha
    roundRect(ctx, ex + ew - 8 * s, ey + 12 * s, wingW, wingH, 2 * s);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Cabeza del jinete
    ctx.fillStyle =
      e.type === 'shadow-lord' ? '#6a8aba' : e.type === 'hunter' ? '#9a9aaa' : '#dd6666';
    ctx.beginPath();
    ctx.arc(ex + ew / 2 + e.facing * 4 * s, ey + 6 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();

    // Yelmo/casco
    ctx.fillStyle =
      e.type === 'shadow-lord' ? '#4a6a9a' : e.type === 'hunter' ? '#7a7a8a' : '#cc4444';
    roundRect(ctx, ex + ew / 2 + e.facing * 4 * s - 5 * s, ey + 2 * s, 10 * s, 5 * s, 2 * s);
    ctx.fill();

    // Lanza (si está en la dirección que mira)
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(ex + ew / 2 + e.facing * 8 * s, ey + 10 * s);
    ctx.lineTo(ex + ew / 2 + e.facing * 22 * s, ey + 2 * s);
    ctx.stroke();
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.arc(ex + ew / 2 + e.facing * 22 * s, ey + 2 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Jugador ──
  if (player.invincible <= 0 || Math.floor(animTime * 10) % 2 === 0) {
    const px = ox + player.x * s;
    const py = oy + player.y * s;
    const pw = player.w * s;
    const ph = player.h * s;

    const sq = getSquash(player.squashIdx);
    if (sq && (sq.sx !== 1 || sq.sy !== 1)) {
      const cx = px + pw / 2;
      const cy = py + ph / 2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sq.sx, sq.sy);
      ctx.translate(-cx, -cy);
    }

    // Sombra
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(px + pw / 2, py + ph + 3 * s, pw * 0.45, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glow del jugador
    ctx.shadowColor = 'rgba(192,132,252,0.2)';
    ctx.shadowBlur = 12 * s;

    // Cuerpo del avestruz
    ctx.fillStyle = '#8a6a4a';
    roundRect(ctx, px + 6 * s, py + 12 * s, pw - 12 * s, ph - 16 * s, 5 * s);
    ctx.fill();

    // Cuello
    ctx.fillStyle = '#9a7a5a';
    roundRect(ctx, px + 12 * s, py + 4 * s, 8 * s, 12 * s, 3 * s);
    ctx.fill();

    // Cabeza
    ctx.fillStyle = '#ba9a7a';
    ctx.beginPath();
    ctx.arc(px + pw / 2 + player.facing * 6 * s, py + 4 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();

    // Pico
    ctx.fillStyle = '#ff8c00';
    ctx.beginPath();
    ctx.moveTo(px + pw / 2 + player.facing * 12 * s, py + 3 * s);
    ctx.lineTo(px + pw / 2 + player.facing * 8 * s, py + 1 * s);
    ctx.lineTo(px + pw / 2 + player.facing * 8 * s, py + 5 * s);
    ctx.closePath();
    ctx.fill();

    // Ojo
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px + pw / 2 + player.facing * 7 * s, py + 2.5 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(px + pw / 2 + player.facing * 7.5 * s, py + 2.5 * s, 1 * s, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;

    // Alas del avestruz (animadas con el aleteo)
    const flapPhase = player.flapAnim > 0 ? Math.sin(animTime * 20) : 0;
    ctx.fillStyle = '#6a4a2a';
    const aw = 14 * s;
    const ah = 5 * s + flapPhase * 4 * s;
    // Ala izquierda
    roundRect(ctx, px - aw + 12 * s, py + 14 * s, aw, Math.max(ah, 2 * s), 2 * s);
    ctx.fill();
    // Ala derecha
    roundRect(ctx, px + pw - 12 * s, py + 14 * s, aw, Math.max(ah, 2 * s), 2 * s);
    ctx.fill();

    // Piernas
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(px + 10 * s, py + ph - 6 * s);
    ctx.lineTo(px + 8 * s, py + ph);
    ctx.moveTo(px + pw - 10 * s, py + ph - 6 * s);
    ctx.lineTo(px + pw - 8 * s, py + ph);
    ctx.stroke();

    // Jinete (knight sobre el avestruz)
    ctx.fillStyle = '#c0c0c0';
    roundRect(ctx, px + 8 * s, py + 6 * s, pw - 16 * s, 10 * s, 3 * s);
    ctx.fill();

    // Yelmo
    ctx.fillStyle = '#a0a0a0';
    ctx.beginPath();
    ctx.arc(px + pw / 2 + player.facing * 2 * s, py + 4 * s, 5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Visera del yelmo
    ctx.fillStyle = '#666';
    roundRect(ctx, px + pw / 2 + player.facing * 2 * s - 3 * s, py + 2 * s, 6 * s, 3 * s, 1 * s);
    ctx.fill();

    // Lanza del jugador
    ctx.strokeStyle = '#a0a0a0';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(px + pw / 2 + player.facing * 12 * s, py + 8 * s);
    ctx.lineTo(px + pw / 2 + player.facing * 30 * s, py + 1 * s);
    ctx.stroke();
    // Punta de lanza
    ctx.fillStyle = '#ddd';
    ctx.beginPath();
    ctx.arc(px + pw / 2 + player.facing * 30 * s, py + 1 * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  if (player.invincible <= 0 || Math.floor(animTime * 10) % 2 === 0) {
    const sq = getSquash(player.squashIdx);
    if (sq && (sq.sx !== 1 || sq.sy !== 1)) {
      ctx.restore();
    }
  }

  // Partículas
  drawParticles(ctx, offX, offY, scale);

  ctx.restore();
}

// ── BUCLE PRINCIPAL ──
const loop = createGameLoop((dt) => {
  animTime += dt;
  pollGamepad();
  updateShake(dt);

  if (state.running && !state.gameOver) {
    updatePlayer(dt);
    updateEnemies(dt);
    updateEggs(dt);

    // Reponer enemigos si hay espacio
    if (
      enemies.length < Math.min(3 + state.wave, MAX_ENEMIES) &&
      enemySpawned < state.wave * 2 + 3
    ) {
      if (Math.random() < 0.5 * dt) {
        spawnEnemy();
      }
    }

    // Avanzar oleada
    if (state.enemiesRemaining <= 0 && enemies.length === 0 && eggs.length === 0) {
      state.waveActive = false;
      nextWave();
    }
  }

  updateSquashes(dt);
  updateParticles(dt);
  draw();
});

// ── INIT ──
initPlayer();
updateHUD();

function cleanup() {
  loop.stop();
  document.removeEventListener('keydown', trapTab);
  stopAmbient();
  closeAudio();
}
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);
document.getElementById('loading').classList.add('hidden');
loop.start();

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
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('joust'));
