import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import {
  triggerShake,
  updateShake,
  getShakeOffset,
  roundRect,
  spawnParticles,
  updateParticles,
  drawParticles,
} from '../../shared/effects.js';
document.documentElement.dataset.theme = localStorage.getItem('arcadehub_theme') || 'dark';
/* ============================================================
   SPACE INVADERS 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const CW = 800,
  CH = 600,
  CPAD = 20;
const SHIP_Y = CH - 40,
  SHIP_W = 36,
  SHIP_H = 20;
const SHIP_SPEED = 400;
const INVADER_ROWS = 5,
  INVADER_COLS = 11;
const INVADER_W = 30,
  INVADER_H = 22,
  INVADER_GAP = 8;
const BULLET_SPEED = 500,
  INVADER_BULLET_SPEED = 220;
const FIRE_CD = 0.3;
const START_LIVES = 3;
const SHIELD_Y = CH - 95;
const SHIELDS = 4;

const ROW_COLORS = ['#ff6b6b', '#ff8a65', '#ffe066', '#6ee7b7', '#6ec6ff'];
const ROW_POINTS = [30, 20, 20, 10, 10];

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  score: 0,
  lives: START_LIVES,
  best: Number(localStorage.getItem('spaceinv2d_best') || 0),
  invincibleTimer: 0,
};

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('gameCanvas'),
  ctx = canvas.getContext('2d');
let canvasW = 0,
  canvasH = 0,
  scale = 1,
  offX = 0,
  offY = 0;
function resize() {
  canvasW = window.innerWidth;
  canvasH = window.innerHeight;
  canvas.width = canvasW;
  canvas.height = canvasH;
  const sx = (canvasW - CPAD * 2) / CW,
    sy = (canvasH - CPAD * 2) / CH;
  scale = Math.min(sx, sy);
  offX = (canvasW - CW * scale) / 2;
  offY = (canvasH - CH * scale) / 2;
}
window.addEventListener('resize', resize);
resize();

// SONIDO (usando shared/audio.js)
function playFire() {
  beep({ freq: 800, freqEnd: 1200, duration: 0.05, type: 'square', volume: 0.1 });
}
function playExplosion() {
  beep({ freq: 200, freqEnd: 40, duration: 0.18, type: 'sawtooth', volume: 0.16 });
  triggerShake(2);
}
function playDeath() {
  triggerShake(6);
  beep({ freq: 300, freqEnd: 30, duration: 0.4, type: 'sawtooth', volume: 0.2 });
}
function playMystery() {
  beep({ freq: 600, freqEnd: 900, duration: 0.08, type: 'triangle', volume: 0.12 });
}
function playWin() {
  [660, 880, 1100, 1320].forEach((f, i) =>
    setTimeout(() => beep({ freq: f, duration: 0.1, type: 'triangle', volume: 0.16 }), i * 90),
  );
}

// ============================================================
// ENTIDADES
// ============================================================
const ship = { x: CW / 2, y: SHIP_Y };
let invs = [],
  plyBullets = [],
  enBullets = [],
  shields = [];
let invDir = 1,
  invTimer = 0,
  fireTimer = 0;
let mysteryShip = null,
  mysteryTimer = 0;
let invaderAnimPhase = 0;

function buildInvaders() {
  invs = [];
  const tw = INVADER_COLS * INVADER_W + (INVADER_COLS - 1) * INVADER_GAP;
  const sx = (CW - tw) / 2 + INVADER_W / 2;
  for (let r = 0; r < INVADER_ROWS; r++) {
    for (let co = 0; co < INVADER_COLS; co++) {
      invs.push({
        x: sx + co * (INVADER_W + INVADER_GAP),
        y: 50 + r * (INVADER_H + INVADER_GAP),
        w: INVADER_W,
        h: INVADER_H,
        color: ROW_COLORS[r],
        points: ROW_POINTS[r],
        alive: true,
        row: r,
        col: co,
        animPhase: 0,
      });
    }
  }
  invDir = 1;
  invTimer = 0;
}

function buildShields() {
  shields = [];
  const sw = 60,
    gap = (CW - SHIELDS * sw) / (SHIELDS + 1);
  for (let i = 0; i < SHIELDS; i++) {
    const sx = gap + i * (sw + gap);
    // Shield: a grid of small blocks
    const blocks = [];
    for (let bx = 0; bx < 8; bx++) {
      for (let by = 0; by < 5; by++) {
        if (
          (by === 0 && bx > 0 && bx < 7) ||
          by === 1 ||
          by === 2 ||
          (by === 3 && bx > 1 && bx < 6)
        ) {
          blocks.push({ x: sx + bx * 7.5, y: SHIELD_Y + by * 6, w: 7.5, h: 6, hp: 4 });
        }
      }
    }
    shields.push({ blocks });
  }
}

// ============================================================
// GAME LOGIC
// ============================================================
let invadersReachedBottom = false;

function resetGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.gameOver = false;
  state.invincibleTimer = 0;
  ship.x = CW / 2;
  plyBullets = [];
  enBullets = [];
  fireTimer = 0;
  invaderAnimPhase = 0;
  invadersReachedBottom = false;
  mysteryShip = null;
  mysteryTimer = 3;
  buildInvaders();
  buildShields();
  document.getElementById('finalScore').style.display = 'none';
  updateHUD();
}
function startGame() {
  ensureAudio();
  startAmbient();
  if (state.best >= 2000) achievements.unlock('invaders_twothousand');
  resetGame();
  state.running = true;
  achievements.incrementPlays('space-invaders');
  document.getElementById('overlay').classList.add('hidden');
}

function loseLife() {
  state.lives--;
  playDeath();
  spawnParticles(ship.x, ship.y, '#6ec6ff', 30, { spd: 150, life: 0.7, smx: 5 });
  updateHUD();
  if (state.lives <= 0) {
    endGame();
    return;
  }
  state.invincibleTimer = 2;
  ship.x = CW / 2;
  plyBullets = [];
  enBullets = [];
}

function endGame(won) {
  state.running = false;
  state.gameOver = true;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('spaceinv2d_best', String(state.best));
    if (state.best >= 2000) achievements.unlock('invaders_twothousand');
  }
  const overlayText = document.getElementById('overlayText'),
    finalScore = document.getElementById('finalScore'),
    hintEl = document.getElementById('hintEl');
  overlayText.textContent = won ? '🎉 ¡Ganaste!' : '💥 ¡Game Over!';
  finalScore.style.display = 'block';
  finalScore.textContent = `Puntos: ${state.score} · Récord: ${state.best}`;
  hintEl.innerHTML = `<kbd>Espacio</kbd> / tocar para empezar · <kbd>R</kbd> reiniciar`;
  document.getElementById('overlay').classList.remove('hidden');
  updateHUD();
}

// ============================================================
// FÍSICA
// ============================================================
function updateShip(dt) {
  if (state.invincibleTimer > 0) state.invincibleTimer -= dt;
  ship.x += (input.left ? -SHIP_SPEED * dt : 0) + (input.right ? SHIP_SPEED * dt : 0);
  ship.x = Math.max(20, Math.min(CW - 20, ship.x));
  if (input.fire && fireTimer <= 0) {
    plyBullets.push({ x: ship.x - 1.5, y: ship.y - 12, vy: -BULLET_SPEED });
    plyBullets.push({ x: ship.x + 1.5, y: ship.y - 12, vy: -BULLET_SPEED });
    fireTimer = FIRE_CD;
    playFire();
  }
  if (fireTimer > 0) fireTimer -= dt;
}

function updateInvaders(dt) {
  invaderAnimPhase += dt * 3;
  if (invs.filter((i) => i.alive).length === 0) return;

  const speedMult = 1 + (INVADER_ROWS * INVADER_COLS - invs.filter((i) => i.alive).length) * 0.04;
  invTimer += dt * speedMult;
  const interval = 0.5 / (1 + state.score * 0.0005);

  while (invTimer >= interval) {
    invTimer -= interval;
    invDir = moveInvaders(invDir);
  }

  // Enemy fire
  const alive = invs.filter((i) => i.alive);
  if (alive.length > 0 && Math.random() < 0.008 * speedMult) {
    const shooter = alive[Math.floor(Math.random() * alive.length)];
    enBullets.push({ x: shooter.x, y: shooter.y + INVADER_H / 2, vy: INVADER_BULLET_SPEED });
  }

  // Mystery ship
  mysteryTimer -= dt;
  if (mysteryTimer <= 0 && !mysteryShip) {
    const fromLeft = Math.random() > 0.5;
    mysteryShip = { x: fromLeft ? -30 : CW + 30, y: 30, dir: fromLeft ? 1 : -1 };
  }
  if (mysteryShip) {
    mysteryShip.x += 120 * mysteryShip.dir * dt;
    if (mysteryShip.x < -40 || mysteryShip.x > CW + 40) {
      mysteryShip = null;
      mysteryTimer = 5 + Math.random() * 8;
    }
  }
}

function moveInvaders(dir) {
  let hitEdge = false;
  for (const i of invs) {
    if (!i.alive) continue;
    i.x += dir * 12;
    if (i.x > CW - 20 || i.x < 20) hitEdge = true;
    if (i.y + INVADER_H > SHIELD_Y + 20) invadersReachedBottom = true;
  }
  if (hitEdge) {
    for (const i of invs) {
      if (i.alive) i.y += 8;
    }
    return -dir;
  }
  return dir;
}

// (bullet logic is inline in the main tick loop)

// Input
const input = { left: false, right: false, fire: false };
window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    input.left = true;
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    input.right = true;
  } else if (e.code === 'Space') {
    e.preventDefault();
    if (!state.running) startGame();
    else input.fire = true;
  } else if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
  }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = false;
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = false;
  else if (e.code === 'Space') input.fire = false;
});

function bindHoldButton(id, onDown, onUp) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      el.classList.add('is-pressed');
      onDown();
    },
    { passive: false },
  );
  el.addEventListener(
    'touchend',
    (e) => {
      e.preventDefault();
      el.classList.remove('is-pressed');
      onUp?.();
    },
    { passive: false },
  );
  el.addEventListener('touchcancel', () => {
    el.classList.remove('is-pressed');
    onUp?.();
  });
  el.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onDown();
  });
  el.addEventListener('mouseup', () => onUp?.());
  el.addEventListener('mouseleave', () => onUp?.());
}
bindHoldButton(
  'btnLeft',
  () => (input.left = true),
  () => (input.left = false),
);
bindHoldButton(
  'btnRight',
  () => (input.right = true),
  () => (input.right = false),
);
const btnFire = document.getElementById('btnFire');
btnFire?.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    btnFire.classList.add('is-pressed');
    if (!state.running) startGame();
    else input.fire = true;
  },
  { passive: false },
);
btnFire?.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    btnFire.classList.remove('is-pressed');
    input.fire = false;
  },
  { passive: false },
);
btnFire?.addEventListener('touchcancel', () => {
  btnFire.classList.remove('is-pressed');
  input.fire = false;
});
btnFire?.addEventListener('mousedown', (e) => {
  e.preventDefault();
  if (!state.running) startGame();
  else input.fire = true;
});
btnFire?.addEventListener('mouseup', () => {
  input.fire = false;
});

document.getElementById('gameCanvas').addEventListener('pointerdown', () => {
  if (!state.running) startGame();
});
document.getElementById('overlay').addEventListener('click', () => {
  if (!state.running) startGame();
});

// Gamepad
let gamepadIndex = null,
  prevGamepad = { fire: false, start: false };
window.addEventListener('gamepadconnected', (e) => (gamepadIndex = e.gamepad.index));
window.addEventListener('gamepaddisconnected', (e) => {
  if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
});
function pollGamepad() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const gp = (gamepadIndex !== null ? pads[gamepadIndex] : null) || pads[0];
  if (!gp) return;
  const ax = gp.axes[0] ?? 0;
  input.left = !!gp.buttons[14]?.pressed || ax < -0.4;
  input.right = !!gp.buttons[15]?.pressed || ax > 0.4;
  const fH = !!(gp.buttons[0]?.pressed || gp.buttons[2]?.pressed);
  const sH = !!(gp.buttons[9]?.pressed || gp.buttons[8]?.pressed);
  if (fH && !prevGamepad.fire && !state.gameOver) {
    if (!state.running) startGame();
    else input.fire = true;
  }
  if (!fH && prevGamepad.fire) input.fire = false;
  if (sH && !prevGamepad.start && !state.running) startGame();
  prevGamepad = { fire: fH, start: sH };
}

// ============================================================
// RENDER
// ============================================================
function draw() {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);
  const s = scale,
    cx = offX,
    cy = offY,
    cw2 = CW * s,
    ch2 = CH * s;

  // Background
  const grad = ctx.createRadialGradient(
    cx + cw2 / 2,
    cy + ch2 / 2,
    0,
    cx + cw2 / 2,
    cy + ch2 / 2,
    cw2 * 0.7,
  );
  grad.addColorStop(0, '#0d1020');
  grad.addColorStop(1, '#0a0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(cx, cy, cw2, ch2);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 50; i++) {
    const x = (i * 97 + 33) % cw2,
      y = (i * 151 + 77) % ch2,
      r = 0.5 + (i % 3) * 0.5;
    ctx.beginPath();
    ctx.arc(cx + x, cy + y, r * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Border
  ctx.shadowColor = 'rgba(110,198,255,0.08)';
  ctx.shadowBlur = 15;
  ctx.strokeStyle = 'rgba(110,198,255,0.12)';
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeRect(cx, cy, cw2, ch2);
  ctx.shadowBlur = 0;

  // Shields
  for (const sh of shields) {
    for (const bl of sh.blocks) {
      const bx = cx + bl.x * s,
        by = cy + bl.y * s,
        bw = bl.w * s,
        bh = bl.h * s;
      ctx.fillStyle = `rgba(100,220,100,${0.3 + 0.15 * bl.hp})`;
      ctx.strokeStyle = 'rgba(100,220,100,0.15)';
      ctx.lineWidth = 0.5 * s;
      roundRect(ctx, bx, by, bw, bh, 1 * s);
      ctx.fill();
      ctx.stroke();
    }
  }

  // Invaders
  for (const inv of invs) {
    if (!inv.alive) continue;
    const ix = cx + inv.x * s,
      iy = cy + inv.y * s;
    const phase = Math.sin(invaderAnimPhase + inv.col * 0.5) * 3;
    drawInvader(ix, iy, INVADER_W * s, INVADER_H * s, inv.color, phase);
  }

  // Mystery ship
  if (mysteryShip) {
    const mx = cx + mysteryShip.x * s,
      my = cy + mysteryShip.y * s;
    ctx.fillStyle = '#ff8a65';
    ctx.shadowColor = '#ff8a65';
    ctx.shadowBlur = 10 * s;
    roundRect(ctx, mx - 15 * s, my - 6 * s, 30 * s, 12 * s, 3 * s);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(mx, my, 3 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player bullets
  for (const b of plyBullets) {
    const bx = cx + b.x * s,
      by = cy + b.y * s;
    ctx.fillStyle = '#ffdd88';
    ctx.shadowColor = '#ffdd88';
    ctx.shadowBlur = 8 * s;
    ctx.fillRect(bx, by, 3 * s, 10 * s);
    ctx.shadowBlur = 0;
  }

  // Enemy bullets
  for (const b of enBullets) {
    const bx = cx + b.x * s,
      by = cy + b.y * s;
    ctx.fillStyle = '#ff6666';
    ctx.shadowColor = '#ff6666';
    ctx.shadowBlur = 6 * s;
    ctx.beginPath();
    ctx.arc(bx, by, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Ship
  if (!state.gameOver) {
    const blink = state.invincibleTimer > 0 && Math.floor(state.invincibleTimer * 8) % 2 === 0;
    if (!blink) {
      const sx = cx + ship.x * s,
        sy = cy + SHIP_Y * s;
      ctx.fillStyle = '#6ec6ff';
      ctx.shadowColor = '#6ec6ff';
      ctx.shadowBlur = 12 * s;
      ctx.beginPath();
      ctx.moveTo(sx, sy - (SHIP_H / 2) * s);
      ctx.lineTo(sx - (SHIP_W / 2) * s, sy + (SHIP_H / 2) * s);
      ctx.lineTo(sx + (SHIP_W / 2) * s, sy + (SHIP_H / 2) * s);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      // Cockpit
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(sx, sy - (SHIP_H / 4) * s);
      ctx.lineTo(sx - 6 * s, sy);
      ctx.lineTo(sx + 6 * s, sy);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Particles
  drawParticles(ctx, offX, offY, scale);
  ctx.restore();
}

function drawInvader(x, y, w, h, color, phase) {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 8 * scale;
  // Body
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 3 * scale);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Eyes
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(x - w / 4, y - h / 4, 3 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + w / 4, y - h / 4, 3 * scale, 0, Math.PI * 2);
  ctx.fill();
  // Antennae with wave
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.moveTo(x - w / 4, y - h / 2);
  ctx.lineTo(x - w / 4 + phase * scale, y - h / 2 - 8 * scale);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w / 4, y - h / 2);
  ctx.lineTo(x + w / 4 - phase * scale, y - h / 2 - 8 * scale);
  ctx.stroke();
}

// ============================================================
// HUD
// ============================================================
const scoreEl = document.getElementById('sc'),
  livesEl = document.getElementById('lv'),
  bestEl = document.getElementById('bst');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent =
    '●'.repeat(Math.max(0, state.lives)) + '○'.repeat(Math.max(0, START_LIVES - state.lives));
  bestEl.textContent = String(state.best);
}

// ============================================================
// MAIN LOOP
// ============================================================
let animFrameId = null;
let lastTime = 0;
function tick(t) {
  const dt = Math.min((t - lastTime) / 1000, 0.05);
  lastTime = t;
  pollGamepad();
  updateShake(dt);
  if (state.running && !state.gameOver) {
    updateShip(dt);
    updateInvaders(dt);
    // Collision check for bullets
    for (let i = plyBullets.length - 1; i >= 0; i--) {
      const b = plyBullets[i];
      b.y += b.vy * dt;
      let removed = false;
      if (b.y < 0) {
        plyBullets.splice(i, 1);
        continue;
      }
      // Hit invaders
      for (const inv of invs) {
        if (!inv.alive) continue;
        if (Math.abs(b.x - inv.x) < INVADER_W / 2 && Math.abs(b.y - inv.y) < INVADER_H / 2) {
          inv.alive = false;
          state.score += inv.points;
          playExplosion();
          spawnParticles(inv.x, inv.y, inv.color, 12, { spd: 80, life: 0.35 });
          plyBullets.splice(i, 1);
          removed = true;
          updateHUD();
          if (invs.filter((x) => x.alive).length === 0) {
            playWin();
            buildInvaders();
          }
          break;
        }
      }
      if (removed) continue;
      // Hit shields
      for (const sh of shields) {
        for (let bi = sh.blocks.length - 1; bi >= 0; bi--) {
          const bl = sh.blocks[bi];
          if (b.x > bl.x && b.x < bl.x + bl.w && b.y > bl.y && b.y < bl.y + bl.h) {
            bl.hp--;
            if (bl.hp <= 0) sh.blocks.splice(bi, 1);
            plyBullets.splice(i, 1);
            removed = true;
            break;
          }
        }
        if (removed) break;
      }
      // Hit mystery ship
      if (
        !removed &&
        mysteryShip &&
        Math.abs(b.x - mysteryShip.x) < 25 &&
        Math.abs(b.y - mysteryShip.y) < 15
      ) {
        state.score += 100;
        playMystery();
        spawnParticles(mysteryShip.x, mysteryShip.y, '#ffd700', 20, { spd: 100, life: 0.5 });
        mysteryShip = null;
        mysteryTimer = 5 + Math.random() * 8;
        plyBullets.splice(i, 1);
        removed = true;
        updateHUD();
      }
    }
    // Enemy bullets
    for (let i = enBullets.length - 1; i >= 0; i--) {
      const b = enBullets[i];
      b.y += b.vy * dt;
      if (b.y > CH + 10) {
        enBullets.splice(i, 1);
        continue;
      }
      if (
        state.invincibleTimer <= 0 &&
        Math.abs(b.x - ship.x) < SHIP_W / 2 &&
        Math.abs(b.y - SHIP_Y) < SHIP_H / 2
      ) {
        enBullets.splice(i, 1);
        loseLife();
        break;
      }
      for (const sh of shields) {
        for (let bi = sh.blocks.length - 1; bi >= 0; bi--) {
          const bl = sh.blocks[bi];
          if (b.x > bl.x && b.x < bl.x + bl.w && b.y > bl.y && b.y < bl.y + bl.h) {
            bl.hp--;
            if (bl.hp <= 0) sh.blocks.splice(bi, 1);
            enBullets.splice(i, 1);
            break;
          }
        }
      }
    }
    // Invaders reached bottom?
    if (invadersReachedBottom) {
      invadersReachedBottom = false;
      loseLife();
    }

    // Invader collision with ship
    if (state.invincibleTimer <= 0) {
      for (const inv of invs) {
        if (!inv.alive) continue;
        if (
          Math.abs(inv.x - ship.x) < INVADER_W / 2 + SHIP_W / 2 &&
          Math.abs(inv.y - SHIP_Y) < INVADER_H / 2 + SHIP_H / 2
        ) {
          loseLife();
          break;
        }
      }
    }

    // Check win: all invaders destroyed in the last bullet tick
    if (state.running && invs.filter((i) => i.alive).length === 0) {
      playWin();
      endGame(true);
    }
  }
  updateParticles(dt);
  draw();
  animFrameId = requestAnimationFrame(tick);
}

updateHUD();

function cleanup() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
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
// Help button
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('space-invaders'));
