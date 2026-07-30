import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import {
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
  clearSquashes,
} from '../../shared/effects.js';

document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';

/* ============================================================
   DEFENDER — Arcade Hub
   Canvas 2D side-scrolling shooter, sin dependencias.
   ============================================================ */

// ── CONSTANTES ──
const GAME_W = 600;
const GAME_H = 480;
const TERRAIN_H = 80;
const GROUND_Y = GAME_H - TERRAIN_H;
const WORLD_W = 6000;

const PLAYER_W = 24;
const PLAYER_H = 16;
const PLAYER_SPEED = 280;
const LASER_SPEED = 900;
const LASER_W = 4;
const LASER_H = 2;
const MAX_LASERS = 8;

const LANDER_SPEED = 80;
const BOMBER_SPEED = 150;
const BOMB_SPEED = 200;
const MUTANT_SPEED = 160;

const INITIAL_HUMANS = 10;
const INITIAL_BOMBS = 3;
const INITIAL_LIVES = 3;

// ── ESTADO ──
const state = {
  running: false,
  gameOver: false,
  score: 0,
  lives: INITIAL_LIVES,
  humans: INITIAL_HUMANS,
  smartBombs: INITIAL_BOMBS,
  level: 1,
  waveActive: false,
  waveTimer: 0,
  landerCount: 0,
  maxLanders: 3,
};

// Camera (side-scrolling position)
const camera = { x: 0, targetX: 0 };

// Player
const player = {
  x: GAME_W / 3,
  y: GAME_H / 2,
  vx: 0,
  vy: 0,
  w: PLAYER_W,
  h: PLAYER_H,
  fireCooldown: 0,
  invincible: 0,
  thrustFrames: 0,
};
const lasers = [];
const enemies = [];
const humans = [];
const enemyLasers = [];

// Terrain generation
let terrainPoints = [];
let enemiesKilled = 0;
let bombsUsed = 0;

// ── CANVAS SETUP ──
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const {
  w: canvasW,
  h: canvasH,
  s: scale,
  x: offX,
  y: offY,
} = setupCanvas(canvas, ctx, GAME_W, GAME_H, 8);

// ── GENERAR TERRENO ──
function generateTerrain() {
  terrainPoints = [];
  const step = 60;
  const numPoints = Math.ceil(WORLD_W / step) + 1;
  let prevH = 0;
  for (let i = 0; i < numPoints; i++) {
    const x = i * step;
    // Mountain ranges with smooth transitions
    const peak = Math.sin(i * 0.12) * 40 + Math.sin(i * 0.3) * 15 + Math.sin(i * 0.05) * 30;
    const h = Math.max(-50, Math.min(60, peak));
    // Smooth lerp from prev
    const smoothed = prevH + (h - prevH) * 0.4;
    terrainPoints.push({ x, h: smoothed });
    prevH = smoothed;
  }
}

function getTerrainHeight(px) {
  if (!terrainPoints.length) return 0;
  for (let i = 0; i < terrainPoints.length - 1; i++) {
    const a = terrainPoints[i];
    const b = terrainPoints[i + 1];
    if (px >= a.x && px <= b.x) {
      const t = (px - a.x) / (b.x - a.x);
      return a.h + (b.h - a.h) * t;
    }
  }
  return terrainPoints[terrainPoints.length - 1]?.h || 0;
}

function getGroundY(worldX) {
  return GROUND_Y + getTerrainHeight(worldX);
}

// ── SONIDOS ──
function playFire() {
  beep({ freq: 800, freqEnd: 400, duration: 0.05, type: 'square', volume: 0.08 });
}
function playHit() {
  beep({ freq: 200, freqEnd: 80, duration: 0.15, type: 'sawtooth', volume: 0.12 });
}
function playExplosion() {
  beep({ freq: 100, freqEnd: 30, duration: 0.3, type: 'sawtooth', volume: 0.15 });
}
function playRescue() {
  beep({ freq: 600, freqEnd: 1200, duration: 0.15, type: 'triangle', volume: 0.1 });
}
function playBomb() {
  feedbackBundle('large', ship.x, ship.y, {
    color: '#ff8a65',
    noFlash: true,
    onBeep: () => beep({ freq: 50, freqEnd: 20, duration: 0.5, type: 'sawtooth', volume: 0.2 }),
  });
}
function playDeath() {
  feedbackBundle('large', ship.x, ship.y, {
    color: '#ff4444',
    noFlash: true,
    onBeep: () => beep({ freq: 400, freqEnd: 60, duration: 0.4, type: 'sawtooth', volume: 0.15 }),
  });
}
function playGameOver() {
  [440, 350, 220, 110].forEach((f, i) =>
    setTimeout(() => beep({ freq: f, duration: 0.2, type: 'sawtooth', volume: 0.12 }), i * 150),
  );
}

// ── ENTRADA ──
const keys = { up: false, down: false, left: false, right: false, fire: false, bomb: false };
let firePressed = false;
let bombPressed = false;

window.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'ArrowUp':
    case 'KeyW':
      e.preventDefault();
      keys.up = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      e.preventDefault();
      keys.down = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      e.preventDefault();
      keys.left = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      e.preventDefault();
      keys.right = true;
      break;
    case 'Space':
      e.preventDefault();
      if (!state.running) startGame();
      else firePressed = true;
      break;
    case 'KeyB':
      e.preventDefault();
      bombPressed = true;
      break;
    case 'KeyR':
      e.preventDefault();
      startGame();
      break;
  }
});
window.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'ArrowUp':
    case 'KeyW':
      keys.up = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      keys.down = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      keys.left = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      keys.right = false;
      break;
  }
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
  btn.addEventListener('mouseup', () => {
    onUp();
  });
  btn.addEventListener('mouseleave', () => {
    onUp();
  });
}
bindTouch(
  'btnUp',
  () => (keys.up = true),
  () => (keys.up = false),
);
bindTouch(
  'btnDown',
  () => (keys.down = true),
  () => (keys.down = false),
);
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
  'btnFire',
  () => (firePressed = true),
  () => {},
);
bindTouch(
  'btnBomb',
  () => (bombPressed = true),
  () => {},
);

// Gamepad
let gamepadIndex = null;
let prevFireBtn = false;
let prevBombBtn = false;
window.addEventListener('gamepadconnected', (e) => {
  gamepadIndex = e.gamepad.index;
});
window.addEventListener('gamepaddisconnected', (e) => {
  if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
});

function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const gp = (gamepadIndex !== null ? pads[gamepadIndex] : null) || pads[0];
  if (!gp) return;

  // D-pad / stick para dirección
  keys.up = gp.buttons[12]?.pressed || (gp.axes[1] ?? 0) < -0.3;
  keys.down = gp.buttons[13]?.pressed || (gp.axes[1] ?? 0) > 0.3;
  keys.left = gp.buttons[14]?.pressed || (gp.axes[0] ?? 0) < -0.3;
  keys.right = gp.buttons[15]?.pressed || (gp.axes[0] ?? 0) > 0.3;

  // A = fire, B = bomb
  const fireBtn = !!gp.buttons[0]?.pressed;
  if (fireBtn && !prevFireBtn) {
    if (!state.running) startGame();
    else firePressed = true;
  }
  prevFireBtn = fireBtn;

  const bombBtn = !!gp.buttons[1]?.pressed;
  if (bombBtn && !prevBombBtn) bombPressed = true;
  prevBombBtn = bombBtn;
}

// ── OVERLAY ──
const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const hintEl = document.getElementById('hintEl');
const finalScoreEl = document.getElementById('finalScore');
overlay.addEventListener('click', () => {
  if (!state.running && !state.gameOver) startGame();
});

// ── HUMANOS ──
function generateHumans() {
  humans.length = 0;
  const spacing = Math.floor(WORLD_W / INITIAL_HUMANS);
  for (let i = 0; i < INITIAL_HUMANS; i++) {
    const wx = 100 + i * spacing + Math.random() * spacing * 0.6;
    const gy = getGroundY(wx);
    humans.push({
      x: wx,
      y: gy - 8,
      alive: true,
      grabbed: false,
      falling: false,
      saved: false,
      vy: 0,
      parachute: false,
      size: 6,
      id: i,
    });
  }
}

// ── LÓGICA DEL JUEGO ──
function startGame() {
  clearSquashes();
  ensureAudio();
  startAmbient();
  clearParticles();
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.lives = INITIAL_LIVES;
  enemiesKilled = 0;
  bombsUsed = 0;
  state.humans = INITIAL_HUMANS;
  state.smartBombs = INITIAL_BOMBS;
  state.level = 1;
  state.maxLanders = 3;
  state.waveActive = false;
  state.waveTimer = 2;
  state.landerCount = 0;

  player.x = GAME_W / 3;
  player.y = GAME_H / 2;
  player.vx = 0;
  player.vy = 0;
  player.fireCooldown = 0;
  player.invincible = 0;
  player.thrustFrames = 0;

  camera.x = 0;
  camera.targetX = 0;

  lasers.length = 0;
  enemies.length = 0;
  enemyLasers.length = 0;

  generateTerrain();
  generateHumans();
  achievements.incrementPlays('defender');
  overlay.classList.add('hidden');
  updateHUD();
}

function loseLife() {
  playDeath();
  state.lives -= 1;
  if (state.lives <= 0) {
    endGame();
    return;
  }
  player.x = camera.x + GAME_W / 3;
  player.y = GAME_H / 2;
  player.vx = 0;
  player.vy = 0;
  player.invincible = 1.5;
  spawnParticles(player.x - camera.x + player.w / 2, player.y, '#6ec6ff', 16);
  updateHUD();
}

function endGame() {
  stopAmbient();
  state.running = false;
  state.gameOver = true;
  playGameOver();
  overlayText.textContent = '¡Game Over! 💀';
  finalScoreEl.style.display = 'block';
  finalScoreEl.textContent = `Puntaje: ${state.score} · Nivel: ${state.level}`;
  hintEl.innerHTML = '<kbd>Espacio</kbd> / tocar para reintentar · <kbd>R</kbd> reiniciar';
  overlay.classList.remove('hidden');
}

function useSmartBomb() {
  if (state.smartBombs <= 0) return;
  playBomb();
  state.smartBombs -= 1;
  bombsUsed++;
  if (bombsUsed >= 3) achievements.unlock('def_bomb_three');
  // Destroy all enemies
  for (const e of enemies) {
    state.score += e.type === 'lander' ? 50 : e.type === 'bomber' ? 100 : 150;
    const ex = e.x - camera.x;
    const ey = e.y;
    spawnParticles(ex, ey, '#ffb800', 20, { spd: 150, life: 0.5, sm: 2, smx: 5 });

    // If carrying a human, free them
    if (e.carriedHuman !== null) {
      const h = e.carriedHuman;
      h.grabbed = false;
      h.falling = true;
      h.vy = -60;
      h.parachute = true;
      h.y = e.y + 20;
      h.x = e.x;
      e.carriedHuman = null;
    }
  }
  enemies.length = 0;
  triggerFlash(0.6);
  updateHUD();
}

function levelUp() {
  state.level += 1;
  state.maxLanders = Math.min(state.maxLanders + 1, 14);
  state.waveTimer = 1;
  state.waveActive = false;
  // Bonus for remaining humans
  if (state.humans > 0) {
    state.score += state.humans * 100;
  }
  updateHUD();
}

// ── FÍSICA ──
function updatePlayer(dt) {
  // Movement
  let dx = 0,
    dy = 0;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;

  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
  }

  player.vx = dx * PLAYER_SPEED;
  player.vy = dy * PLAYER_SPEED;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // World bounds
  player.x = Math.max(30, Math.min(WORLD_W - 30, player.x));
  player.y = Math.max(30, Math.min(GAME_H - 30, player.y));

  // Camera follow
  camera.targetX = player.x - GAME_W / 3;
  camera.targetX = Math.max(0, Math.min(WORLD_W - GAME_W, camera.targetX));
  camera.x += (camera.targetX - camera.x) * 5 * dt;

  // Thrust particles
  if (dx !== 0 || dy !== 0) {
    player.thrustFrames += dt;
    if (player.thrustFrames > 0.06) {
      player.thrustFrames = 0;
      const tx = player.x - camera.x;
      const ty = player.y;
      spawnParticles(tx, ty, '#6ec6ff', 1, { spd: 30, life: 0.15, sm: 1, smx: 2 });
    }
  }

  // Fire
  if (player.fireCooldown > 0) player.fireCooldown -= dt;
  if (firePressed && player.fireCooldown <= 0 && lasers.length < MAX_LASERS) {
    lasers.push({
      x: player.x + player.w / 2,
      y: player.y,
      vx: LASER_SPEED,
    });
    player.fireCooldown = 0.15;
    playFire();
  }
  firePressed = false;

  // Smart bomb
  if (bombPressed) {
    useSmartBomb();
    bombPressed = false;
  }

  // Invincibility countdown
  if (player.invincible > 0) player.invincible -= dt;
}

function updateLasers(dt) {
  for (let i = lasers.length - 1; i >= 0; i--) {
    const l = lasers[i];

    // Anti-tunneling: sub-pasos para láseres rápidos
    const maxStep = LASER_SPEED * dt;
    const minThickness = 10;
    if (maxStep > minThickness * 0.4) {
      const steps = Math.ceil(maxStep / (minThickness * 0.3));
      const subDt = dt / steps;
      for (let s = 0; s < steps; s++) {
        l.x += l.vx * subDt;

        const sx = l.x - camera.x;
        if (sx > GAME_W + 20 || sx < -20) {
          lasers.splice(i, 1);
          break;
        }

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
          const e = enemies[j];
          const dist = Math.hypot(l.x - e.x, l.y - e.y);
          const hitRadius = e.type === 'mutant' ? 10 : 14;
          if (dist < hitRadius) {
            e.hp -= 1;
            lasers.splice(i, 1);
            hit = true;

            const dx = e.x - camera.x;
            spawnParticles(dx, e.y, '#ffb800', 6, { spd: 60, life: 0.2 });

            if (e.hp <= 0) {
              const scoreValue = e.type === 'lander' ? 150 : e.type === 'bomber' ? 250 : 300;
              state.score += scoreValue;
              enemiesKilled++;
              if (enemiesKilled === 1) achievements.unlock('def_first_kill');
              if (state.score >= 10000) achievements.unlock('def_commander');
              playExplosion();
              spawnParticles(e.x - camera.x, e.y, '#ff5e7a', 14, { spd: 100, life: 0.4 });

              if (e.carriedHuman !== null) {
                const h = e.carriedHuman;
                h.grabbed = false;
                h.falling = true;
                h.vy = -80;
                h.parachute = true;
                h.x = e.x;
                h.y = e.y + 10;
                e.carriedHuman = null;
                playRescue();
                spawnParticles(e.x - camera.x, e.y, '#39ff14', 10, { spd: 60, life: 0.3 });
              }

              enemies.splice(j, 1);
              state.landerCount -= 1;
              updateHUD();
            }

            if (hit) break;
          }
        }
        if (hit) break;
      }
    } else {
      l.x += l.vx * dt;

      const sx = l.x - camera.x;
      if (sx > GAME_W + 20 || sx < -20) {
        lasers.splice(i, 1);
        continue;
      }

      let hit = false;
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        const dist = Math.hypot(l.x - e.x, l.y - e.y);
        const hitRadius = e.type === 'mutant' ? 10 : 14;
        if (dist < hitRadius) {
          e.hp -= 1;
          lasers.splice(i, 1);
          hit = true;

          const dx = e.x - camera.x;
          spawnParticles(dx, e.y, '#ffb800', 6, { spd: 60, life: 0.2 });

          if (e.hp <= 0) {
            const scoreValue = e.type === 'lander' ? 150 : e.type === 'bomber' ? 250 : 300;
            state.score += scoreValue;
            enemiesKilled++;
            if (enemiesKilled === 1) achievements.unlock('def_first_kill');
            if (state.score >= 10000) achievements.unlock('def_commander');
            playExplosion();
            spawnParticles(e.x - camera.x, e.y, '#ff5e7a', 14, { spd: 100, life: 0.4 });

            if (e.carriedHuman !== null) {
              const h = e.carriedHuman;
              h.grabbed = false;
              h.falling = true;
              h.vy = -80;
              h.parachute = true;
              h.x = e.x;
              h.y = e.y + 10;
              e.carriedHuman = null;
              playRescue();
              spawnParticles(e.x - camera.x, e.y, '#39ff14', 10, { spd: 60, life: 0.3 });
            }

            enemies.splice(j, 1);
            state.landerCount -= 1;
            updateHUD();
          }

          if (hit) break;
        }
      }
    }
  }
}

function spawnLander() {
  const side = Math.random() > 0.5 ? 'left' : 'right';
  const wx = side === 'left' ? camera.x - 20 : camera.x + GAME_W + 20;
  const wy = 20 + Math.random() * 80;
  const targetX = camera.x + 80 + Math.random() * (GAME_W - 160);

  enemies.push({
    type: 'lander',
    x: wx,
    y: wy,
    vx: 0,
    vy: 0,
    speed: LANDER_SPEED + state.level * 5,
    targetX,
    state: 'entering', // entering, hunting, carrying, escaping
    carriedHuman: null,
    hp: 1,
    size: 14,
    wobble: Math.random() * Math.PI * 2,
  });
}

function spawnBomber() {
  const side = Math.random() > 0.5 ? 'left' : 'right';
  const wx = side === 'left' ? camera.x - 30 : camera.x + GAME_W + 30;
  const wy = 30 + Math.random() * 100;

  enemies.push({
    type: 'bomber',
    x: wx,
    y: wy,
    vx: side === 'left' ? BOMBER_SPEED : -BOMBER_SPEED,
    vy: 0,
    speed: BOMBER_SPEED + state.level * 4,
    state: 'flying',
    carriedHuman: null,
    hp: 2,
    size: 16,
    bombTimer: 1 + Math.random() * 2,
  });
}

function spawnMutant(ex, ey) {
  enemies.push({
    type: 'mutant',
    x: ex,
    y: ey,
    vx: (Math.random() > 0.5 ? 1 : -1) * MUTANT_SPEED,
    vy: -20,
    speed: MUTANT_SPEED + state.level * 3,
    state: 'chasing',
    carriedHuman: null,
    hp: 1,
    size: 10,
    wobble: Math.random() * Math.PI * 2,
    targetX: 0,
  });
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];

    switch (e.type) {
      case 'lander': {
        // Entering: move toward target X, then descend to find humans
        if (e.state === 'entering') {
          const diff = e.targetX - e.x;
          e.vx = Math.sign(diff) * e.speed;
          e.vy = 30;
          if (Math.abs(diff) < 20) {
            e.state = 'hunting';
          }
        } else if (e.state === 'hunting') {
          // Move down toward ground looking for humans
          e.vx = Math.sin(e.wobble) * 40;
          e.wobble += dt * 2;
          e.vy = 60;

          // Check for nearby humans to grab
          if (e.carriedHuman === null) {
            for (const h of humans) {
              if (h.alive && !h.grabbed && !h.falling && !h.saved) {
                const dist = Math.hypot(e.x - h.x, e.y - h.y);
                if (dist < 60) {
                  // Grab the human!
                  h.grabbed = true;
                  e.carriedHuman = h;
                  e.state = 'escaping';
                  playHit();
                  break;
                }
              }
            }
          }
        } else if (e.state === 'escaping') {
          // Fly up and try to escape
          e.vy = -e.speed * 0.8;
          e.vx = Math.sin(e.wobble) * 50;
          e.wobble += dt * 3;

          // Carried human follows
          if (e.carriedHuman) {
            e.carriedHuman.x = e.x;
            e.carriedHuman.y = e.y + 16;
            e.carriedHuman.vy = 0;
          }

          // If they escape off top of visible area, human is lost
          if (e.y < -30) {
            if (e.carriedHuman) {
              e.carriedHuman.alive = false;
              state.humans -= 1;
              state.score = Math.max(0, state.score - 50);
              spawnParticles(e.x - camera.x, 0, '#ff5e7a', 12);
              // Spawn a mutant in rage
              if (Math.random() < 0.3) spawnMutant(e.x, 50);
            }
            enemies.splice(i, 1);
            state.landerCount -= 1;
            updateHUD();
            // Check game over
            if (state.humans <= 0) endGame();
            continue;
          }
        }

        e.x += e.vx * dt;
        e.y += e.vy * dt;
        break;
      }

      case 'bomber': {
        e.x += e.vx * dt;
        // Drop bombs
        e.bombTimer -= dt;
        if (e.bombTimer <= 0 && e.x > camera.x && e.x < camera.x + GAME_W) {
          enemyLasers.push({
            x: e.x,
            y: e.y + e.size,
            vy: BOMB_SPEED,
          });
          e.bombTimer = 1 + Math.random() * 2;
        }

        // Remove if way off-screen
        const bx = e.x - camera.x;
        if (bx < -100 || bx > GAME_W + 100) {
          enemies.splice(i, 1);
          state.landerCount -= 1;
        }
        break;
      }

      case 'mutant': {
        // Chase the player in world coordinates
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          e.vx = (dx / dist) * e.speed;
          e.vy = (dy / dist) * e.speed;
        }
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        e.wobble += dt * 5;

        // Remove if very far from player
        if (dist > 800) {
          enemies.splice(i, 1);
          state.landerCount -= 1;
        }
        break;
      }
    }
  }
}

function updateEnemyLasers(dt) {
  for (let i = enemyLasers.length - 1; i >= 0; i--) {
    const b = enemyLasers[i];
    b.y += b.vy * dt;
    const sx = b.x - camera.x;
    if (sx < -20 || sx > GAME_W + 20 || b.y > GAME_H + 20) {
      enemyLasers.splice(i, 1);
      continue;
    }
    // Hit player?
    const px = player.x - camera.x;
    const py = player.y;
    if (Math.abs(sx - px) < PLAYER_W / 2 + 3 && Math.abs(b.y - py) < PLAYER_H / 2 + 3) {
      enemyLasers.splice(i, 1);
      if (player.invincible <= 0) loseLife();
      if (state.lives <= 0) endGame();
    }
  }
}

function updateHumans(dt) {
  for (const h of humans) {
    if (!h.alive || h.saved) continue;

    if (h.falling) {
      // Parachuting down
      h.vy += 120 * dt;
      h.y += h.vy * dt;
      const gy = getGroundY(h.x);
      if (h.y >= gy - 8) {
        h.y = gy - 8;
        h.falling = false;
        h.parachute = false;
        h.grabbed = false;
        h.vy = 0;
        playRescue();
        spawnParticles(h.x - camera.x, h.y, '#39ff14', 8);
        state.score += 100;
        updateHUD();
      }
    } else if (!h.grabbed) {
      // Grounded - just stand there
      const gy = getGroundY(h.x);
      h.y = gy - 8;
    }
  }
}

function checkPlayerCollisions() {
  if (player.invincible > 0) return;
  const px = player.x;
  const py = player.y;
  for (const e of enemies) {
    const dist = Math.hypot(px - e.x, py - e.y);
    if (dist < e.size + 10) {
      // Collision with enemy
      loseLife();
      if (state.lives <= 0) endGame();
      return;
    }
  }
}

// ── WAVE SPAWNER ──
function updateWaves(dt) {
  if (!state.running || state.gameOver) return;

  state.waveTimer -= dt;
  if (state.waveTimer <= 0 && !state.waveActive) {
    state.waveActive = true;
    // Spawn a wave of landers
    const count = Math.min(state.maxLanders, 3 + Math.floor(state.level / 2));
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        if (state.running && enemies.length < 20) {
          spawnLander();
          state.landerCount += 1;
        }
      }, i * 600);
    }
    // Maybe spawn a bomber
    if (state.level >= 2 && Math.random() < 0.5) {
      setTimeout(
        () => {
          if (state.running) {
            spawnBomber();
            state.landerCount += 1;
          }
        },
        count * 600 + 300,
      );
    }
    state.waveTimer = Math.max(5, 12 - state.level * 0.5);
    state.waveActive = false;
  }

  // Gradually spawn additional enemies to keep pressure
  if (enemies.length < state.maxLanders + 1 && Math.random() < 0.3 * dt) {
    if (Math.random() < 0.7) {
      spawnLander();
      state.landerCount += 1;
    } else if (state.level >= 2) {
      spawnBomber();
      state.landerCount += 1;
    }
  }
}

// ── HUD ──
const scoreEl = document.getElementById('scoreDisplay');
const livesEl = document.getElementById('livesDisplay');
const humansEl = document.getElementById('humansDisplay');
const bombsEl = document.getElementById('bombsDisplay');

function updateHUD() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent = String(state.lives);
  humansEl.textContent = String(state.humans);
  bombsEl.textContent = String(state.smartBombs);
}

// ── RENDER ──
function drawTerrain() {
  const s = scale,
    ox = offX,
    oy = offY;
  const startX = Math.max(0, Math.floor(camera.x / 60) - 1);
  const endX = Math.min(terrainPoints.length - 1, Math.ceil((camera.x + GAME_W) / 60) + 1);

  // Draw ground fill with mountain shapes
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ox, oy + GROUND_Y * s);

  // Draw the terrain surface
  for (let i = startX; i <= endX; i++) {
    const p = terrainPoints[i];
    const wx = p.x;
    const sx = ox + (wx - camera.x) * s;
    const sy = oy + (GROUND_Y + p.h) * s;
    ctx.lineTo(sx, sy);
  }

  ctx.lineTo(ox + GAME_W * s, oy + GAME_H * s);
  ctx.lineTo(ox, oy + GAME_H * s);
  ctx.closePath();

  // Gradient ground fill
  const gg = ctx.createLinearGradient(0, oy + GROUND_Y * s, 0, oy + GAME_H * s);
  gg.addColorStop(0, 'rgba(30, 60, 80, 0.6)');
  gg.addColorStop(0.3, 'rgba(20, 40, 60, 0.7)');
  gg.addColorStop(1, 'rgba(10, 20, 35, 0.9)');
  ctx.fillStyle = gg;
  ctx.fill();

  // Terrain outline (glowing)
  ctx.shadowColor = 'rgba(110, 198, 255, 0.08)';
  ctx.shadowBlur = 6 * s;
  ctx.strokeStyle = 'rgba(110, 198, 255, 0.15)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  for (let i = startX; i <= endX; i++) {
    const p = terrainPoints[i];
    const wx = p.x;
    const sx = ox + (wx - camera.x) * s;
    const sy = oy + (GROUND_Y + p.h) * s;
    if (i === startX) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // Draw surface buildings / structures
  for (let i = startX; i <= endX; i += 3) {
    const p = terrainPoints[i];
    if (p.x < camera.x - 50 || p.x > camera.x + GAME_W + 50) continue;
    const sx = ox + (p.x - camera.x) * s;
    const sy = oy + (GROUND_Y + p.h) * s;
    const bh = (20 + Math.sin(p.x * 0.1) * 15) * s;
    const bw = 6 * s;

    ctx.fillStyle = 'rgba(110, 198, 255, 0.04)';
    ctx.fillRect(sx - bw / 2, sy - bh, bw, bh);
    ctx.strokeStyle = 'rgba(110, 198, 255, 0.06)';
    ctx.lineWidth = 0.5 * s;
    ctx.strokeRect(sx - bw / 2, sy - bh, bw, bh);
  }
}

function drawStarfield() {
  const s = scale,
    ox = offX,
    oy = offY;
  // Parallax stars
  for (let i = 0; i < 60; i++) {
    const starX = (i * 137.5 + 50) % GAME_W;
    const starY = (i * 97.3 + 120) % (GROUND_Y - 20);
    const size = 0.5 + ((i * 7) % 3) * 0.5;
    const parallax = (i % 3) * 0.15;
    const sx = ox + ((starX - camera.x * parallax) % (GAME_W * 2));
    const actualX = (((sx % (GAME_W * s + 20)) + GAME_W * s + 20) % (GAME_W * s + 20)) - 10;
    ctx.fillStyle = `rgba(255,255,255,${0.15 + ((i * 13) % 5) * 0.05})`;
    ctx.beginPath();
    ctx.arc(actualX, oy + starY * s, size * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  const s = scale,
    ox = offX,
    oy = offY;
  const px = ox + (player.x - camera.x) * s;
  const py = oy + player.y * s;
  const pw = player.w * s;
  const ph = player.h * s;

  // Blinking when invincible
  if (player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0) return;

  // Thrust glow
  if (keys.left || keys.right || keys.up || keys.down) {
    const gx = px - (keys.left ? pw * 0.5 : 0) + (keys.right ? pw * 1.5 : pw * 0.5);
    const gy = py + ph / 2;
    ctx.shadowColor = 'rgba(110, 198, 255, 0.3)';
    ctx.shadowBlur = 20 * s;
    ctx.fillStyle = 'rgba(110, 198, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(gx, gy, pw * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Ship body (diamond/arrow shape)
  ctx.shadowColor = 'rgba(110, 198, 255, 0.4)';
  ctx.shadowBlur = 16 * s;

  // Main body
  const g = ctx.createLinearGradient(px - pw / 2, py, px + pw / 2, py);
  g.addColorStop(0, '#1a3a5a');
  g.addColorStop(0.5, '#4a9aff');
  g.addColorStop(1, '#1a3a5a');
  ctx.fillStyle = g;

  ctx.beginPath();
  ctx.moveTo(px + pw / 2, py);
  ctx.lineTo(px + pw * 0.3, py - ph / 2);
  ctx.lineTo(px - pw / 2, py - ph * 0.3);
  ctx.lineTo(px - pw / 2, py + ph * 0.3);
  ctx.lineTo(px + pw * 0.3, py + ph / 2);
  ctx.closePath();
  ctx.fill();

  // Cockpit glow
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.beginPath();
  ctx.arc(px + pw * 0.25, py, ph * 0.2 * s, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
}

function drawEnemies() {
  const s = scale,
    ox = offX,
    oy = offY;

  for (const e of enemies) {
    const ex = ox + (e.x - camera.x) * s;
    const ey = oy + e.y * s;
    const es = e.size * s;

    // Skip if off visible area
    if (ex < -50 || ex > canvasW + 50) continue;

    switch (e.type) {
      case 'lander': {
        // Diamond alien shape
        ctx.fillStyle = '#cc3355';
        ctx.beginPath();
        ctx.moveTo(ex, ey - es);
        ctx.lineTo(ex + es, ey);
        ctx.lineTo(ex, ey + es);
        ctx.lineTo(ex - es, ey);
        ctx.closePath();
        ctx.fill();

        // Glow
        drawGlow(ctx, ex, ey, es * 0.6, 'rgba(255, 94, 122, 0.3)', 0.2, 3);

        // Inner glow

        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex, ey - es * 0.15, es * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'bomber': {
        // Wider, flatter alien ship
        ctx.fillStyle = '#aa8800';
        roundRect(ctx, ex - es * 1.2, ey - es * 0.5, es * 2.4, es, es * 0.3);
        ctx.fill();

        drawGlow(ctx, ex, ey, es * 0.6, 'rgba(255, 184, 0, 0.3)', 0.15, 3);

        ctx.fillStyle = 'rgba(255, 184, 0, 0.3)';
        roundRect(ctx, ex - es * 0.8, ey - es * 0.3, es * 1.6, es * 0.6, es * 0.2);
        ctx.fill();

        // Cockpit
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        ctx.arc(ex, ey, es * 0.25, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'mutant': {
        // Small fast orb with glow
        const mg = ctx.createRadialGradient(ex - es * 0.3, ey - es * 0.3, 0, ex, ey, es);
        mg.addColorStop(0, '#ff5e7a');
        mg.addColorStop(0.6, '#cc2244');
        mg.addColorStop(1, '#881122');
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(ex, ey, es, 0, Math.PI * 2);
        ctx.fill();

        drawGlow(ctx, ex, ey, es, 'rgba(255, 94, 122, 0.4)', 0.12, 3.5);

        // Angry eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex - es * 0.3, ey - es * 0.2, es * 0.2, 0, Math.PI * 2);
        ctx.arc(ex + es * 0.3, ey - es * 0.2, es * 0.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.shadowBlur = 0;
  }
}

function drawHumans() {
  const s = scale,
    ox = offX,
    oy = offY;

  for (const h of humans) {
    if (!h.alive || h.grabbed) continue;

    const sx = ox + (h.x - camera.x) * s;
    const sy = oy + h.y * s;
    const hs = h.size * s;

    if (sx < -20 || sx > canvasW + 20) continue;

    if (h.parachute) {
      // Parachute: small canopy
      ctx.fillStyle = 'rgba(57, 255, 20, 0.25)';
      ctx.beginPath();
      ctx.arc(sx, sy - hs * 2, hs * 1.5, Math.PI, 0);
      ctx.fill();

      ctx.strokeStyle = 'rgba(57, 255, 20, 0.15)';
      ctx.lineWidth = 0.5 * s;
      ctx.beginPath();
      ctx.moveTo(sx - hs * 1.4, sy - hs * 1.5);
      ctx.lineTo(sx, sy);
      ctx.moveTo(sx + hs * 1.4, sy - hs * 1.5);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }

    // Body
    ctx.fillStyle = h.saved ? 'rgba(57, 255, 20, 0.14)' : 'rgba(57, 255, 20, 0.25)';
    ctx.beginPath();
    ctx.arc(sx, sy, hs, 0, Math.PI * 2);
    ctx.fill();

    drawGlow(ctx, sx, sy, hs, 'rgba(57, 255, 20, 0.15)', 0.12, 2.5);

    // Head
    ctx.fillStyle = h.saved ? 'rgba(57, 255, 20, 0.18)' : 'rgba(57, 255, 20, 0.35)';
    ctx.beginPath();
    ctx.arc(sx, sy - hs * 0.5, hs * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLasers() {
  const s = scale,
    ox = offX,
    oy = offY;

  for (const l of lasers) {
    const sx = ox + (l.x - camera.x) * s;
    const sy = oy + l.y * s;
    const lw = LASER_W * s;
    const lh = LASER_H * s;

    ctx.shadowColor = 'rgba(110, 198, 255, 0.6)';
    ctx.shadowBlur = 14 * s;
    ctx.fillStyle = '#6ec6ff';
    ctx.fillRect(sx, sy - lh / 2, lw * 4, lh);

    // Core
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx, sy - lh / 4, lw * 4, lh / 2);
  }
  ctx.shadowBlur = 0;
}

function drawEnemyLasers() {
  const s = scale,
    ox = offX,
    oy = offY;

  for (const b of enemyLasers) {
    const sx = ox + (b.x - camera.x) * s;
    const sy = oy + b.y * s;
    const br = 3 * s;

    ctx.fillStyle = '#ff5e7a';
    ctx.beginPath();
    ctx.arc(sx, sy, br, 0, Math.PI * 2);
    ctx.fill();

    drawGlow(ctx, sx, sy, br, 'rgba(255, 94, 122, 0.4)', 0.15, 2.5);
  }
  ctx.shadowBlur = 0;
}

function drawUI() {
  const s = scale,
    ox = offX,
    oy = offY;

  // Mini radar at bottom-left
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  roundRect(ctx, ox + 8, oy + GAME_H * s - 28 * s, 80 * s, 22 * s, 4 * s);
  ctx.fill();

  ctx.strokeStyle = 'rgba(110, 198, 255, 0.1)';
  ctx.lineWidth = 0.5 * s;
  ctx.stroke();

  // Radar dots for enemies in range
  const radarScale = 80 / GAME_W;
  for (const e of enemies) {
    const rx = ox + 8 + (e.x - (camera.x - GAME_W * 0.3)) * radarScale * s;
    if (rx > ox + 8 && rx < ox + 88 * s) {
      ctx.fillStyle = 'rgba(255, 94, 122, 0.4)';
      ctx.beginPath();
      ctx.arc(rx, oy + GAME_H * s - 17 * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Human dots
  for (const h of humans) {
    if (!h.alive || h.saved || h.grabbed) continue;
    const rx = ox + 8 + (h.x - (camera.x - GAME_W * 0.3)) * radarScale * s;
    if (rx > ox + 8 && rx < ox + 88 * s) {
      ctx.fillStyle = 'rgba(57, 255, 20, 0.4)';
      ctx.beginPath();
      ctx.arc(rx, oy + GAME_H * s - 17 * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Level indicator at top center
  ctx.fillStyle = 'rgba(110, 198, 255, 0.08)';
  ctx.textAlign = 'center';
  ctx.font = `bold ${10 * s}px "Courier New", monospace`;
  ctx.fillStyle = 'rgba(110, 198, 255, 0.3)';
  ctx.fillText(`NIVEL ${state.level}`, ox + (GAME_W * s) / 2, oy + 24 * s);

  // Human count warning if low
  if (state.humans <= 3 && state.running) {
    const pulse = 0.7 + Math.sin(Date.now() * 0.005) * 0.3;
    ctx.font = `bold ${14 * s}px "Courier New", monospace`;
    ctx.fillStyle = `rgba(255, 94, 122, ${pulse * 0.6})`;
    ctx.fillText('⚠ HUMANOS BAJOS', ox + (GAME_W * s) / 2, oy + 40 * s);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);

  // Background
  const grad = ctx.createRadialGradient(
    canvasW / 2,
    canvasH * 0.3,
    0,
    canvasW / 2,
    canvasH / 2,
    canvasW * 0.8,
  );
  grad.addColorStop(0, '#0a1628');
  grad.addColorStop(0.6, '#060d1a');
  grad.addColorStop(1, '#020408');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvasW, canvasH);

  drawStarfield();
  drawTerrain();
  drawHumans();
  drawLasers();
  drawEnemyLasers();
  drawEnemies();
  drawPlayer();
  drawParticles(ctx, 0, 0, 1);
  drawUI();

  ctx.restore();
}

// ── FLASH ──
let flashAlpha = 0;
function triggerFlash(intensity = 0.5) {
  flashAlpha = Math.max(flashAlpha, Math.min(1, intensity));
}
function updateFlash(dt) {
  if (flashAlpha > 0) {
    flashAlpha -= dt * 3;
    if (flashAlpha < 0) flashAlpha = 0;
  }
}
function drawFlash() {
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    ctx.fillRect(0, 0, canvasW, canvasH);
  }
}

// ── BUCLE PRINCIPAL ──
let animFrameId = null;
let lastTime = 0;

function tick(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;

  pollGamepad();
  updateShake(dt);
  updateFlash(dt);

  if (state.running && !state.gameOver) {
    updateWaves(dt);
    updatePlayer(dt);
    updateLasers(dt);
    updateEnemies(dt);
    updateEnemyLasers(dt);
    updateHumans(dt);
    checkPlayerCollisions();

    // Level up: when enough enemies defeated in this level
    // (auto-level based on time surviving)
    // Actually, Defender levels progress naturally as waves come.
    // We'll level up based on score thresholds
    const nextLevelThreshold = state.level * 2000;
    if (state.score >= nextLevelThreshold) {
      levelUp();
    }
  }

  updateSquashes(dt);
  updateParticles(dt);
  draw();

  // Draw flash overlay
  drawFlash();

  animFrameId = requestAnimationFrame(tick);
}

// ── INIT ──
generateTerrain();
generateHumans();
updateHUD();

function cleanup() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  stopAmbient();
  closeAudio();
}
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);
document.getElementById('loading').classList.add('hidden');
animFrameId = requestAnimationFrame((t) => {
  lastTime = t;
  tick(t);
});

// Game Bar
document.getElementById('hubBtn')?.addEventListener('click', () => {
  window.location.href = '../../index.html';
});
document.getElementById('fsBtn')?.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen().catch(() => {});
});
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('defender'));
