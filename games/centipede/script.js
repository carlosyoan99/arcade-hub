import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import {
  triggerShake,
  updateShake,
  getShakeOffset,
  spawnParticles,
  updateParticles,
  drawParticles,
  drawGlow,
} from '../../shared/effects.js';

injectCommonElements();

/* ============================================================
   CENTIPEDE 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const CW = 640,
  CH = 480;
const GS = 16; // grid cell size
const COLS = CW / GS; // 40
const ROWS = CH / GS; // 30
const START_LIVES = 3;
const NUM_MUSHROOMS_INIT = 40;

const PLAYER_SPEED = 280;
const BULLET_SPEED = 420;
const FIRE_CD = 0.18;
const SPIDER_SPEED = 140;

const SEGMENT_POINTS = 10;
const SPIDER_POINTS = 300;
const HEAD_POINTS = 100;
const FLEA_SPEED = 250;
const FLEA_POINTS = 200;
const SCORPION_SPEED = 120;
const SCORPION_POINTS = 500;

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  score: 0,
  lives: START_LIVES,
  best: Number(localStorage.getItem('centipede2d_best') || 0),
  wave: 1,
  fireTimer: 0,
  invincibleTimer: 0,
};

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('gameCanvas'),
  ctx = canvas.getContext('2d', { alpha: false });
const { w: cw, h: ch, s: sc, x: ox, y: oy } = setupCanvas(canvas, ctx, CW, CH, 20);

// ============================================================
// SONIDO
// ============================================================
function pFire() {
  beep({ freq: 800, freqEnd: 1200, duration: 0.03, type: 'square', volume: 0.06 });
}
function pHitSeg() {
  beep({ freq: 400, freqEnd: 100, duration: 0.08, type: 'sawtooth', volume: 0.12 });
  triggerShake(1.5);
}
function pDeath() {
  triggerShake(6);
  beep({ freq: 300, freqEnd: 40, duration: 0.4, type: 'sawtooth', volume: 0.2 });
}
function pSpider() {
  beep({ freq: 1200, freqEnd: 600, duration: 0.08, type: 'triangle', volume: 0.1 });
  triggerShake(2);
}
function pFlea() {
  beep({ freq: 400, freqEnd: 1000, duration: 0.06, type: 'square', volume: 0.08 });
  triggerShake(1);
}
function pScorpion() {
  beep({ freq: 200, freqEnd: 80, duration: 0.12, type: 'sawtooth', volume: 0.14 });
  triggerShake(2);
}
function pWin() {
  [660, 880, 1100, 1320].forEach((ff, i) =>
    setTimeout(() => beep({ freq: ff, duration: 0.08, type: 'triangle', volume: 0.14 }), i * 70),
  );
}

// ============================================================
// PARTÍCULAS
// ============================================================

// ============================================================
// ENTIDADES
// ============================================================
let segments = []; // centipede segments: {x,y,isHead}
let mushrooms = []; // {x,y} grid-aligned (center pixel coords)
let bullets = [];
let spider = null; // {x,y,vx,vy,alive}
let moveDir = 1; // 1=right, -1=left
let moveTimer = 0;
let moveInterval = 0.15;
let spiderTimer = 0;
let spiderInterval = 4;
let flea = null;
let fleaTimer = 0;
let fleaInterval = 6;
let scorpion = null;
let scorpionTimer = 0;
let scorpionInterval = 8;

function spawnMushrooms(count) {
  const placed = new Set();
  for (let i = 0; i < count; i++) {
    let tries = 0;
    while (tries < 50) {
      const cx = Math.floor(Math.random() * (COLS - 2)) + 1;
      const cy = Math.floor(Math.random() * (ROWS - 6)) + 1;
      const key = `${cx},${cy}`;
      if (!placed.has(key)) {
        placed.add(key);
        mushrooms.push({ x: cx * GS + GS / 2, y: cy * GS + GS / 2, poisoned: false });
        break;
      }
      tries++;
    }
  }
}

function spawnCentipede(len) {
  segments = [];
  moveDir = 1;
  const startCol = Math.floor(Math.random() * (COLS - len - 2)) + 1;
  for (let i = 0; i < len; i++) {
    segments.push({
      x: (startCol + i) * GS + GS / 2,
      y: GS + GS / 2,
      isHead: i === 0,
      dir: 1,
      prevX: (startCol + i) * GS + GS / 2,
      prevY: GS + GS / 2,
    });
  }
}

function spawnFlea() {
  if (flea) return;
  const gx = Math.floor(Math.random() * (COLS - 2)) + 1;
  flea = {
    x: gx * GS + GS / 2,
    y: GS + GS / 2,
    vy: FLEA_SPEED * (0.7 + Math.random() * 0.3),
    alive: true,
  };
}

function spawnScorpion() {
  if (scorpion) return;
  const fromLeft = Math.random() > 0.5;
  scorpion = {
    x: fromLeft ? -10 : CW + 10,
    y: (2 + Math.floor(Math.random() * (ROWS - 8))) * GS + GS / 2,
    vx: fromLeft ? SCORPION_SPEED : -SCORPION_SPEED,
    alive: true,
  };
}

function spawnSpider() {
  const areaTop = CH * 0.55;
  const areaBot = CH - 40;
  spider = {
    x: Math.random() * CW,
    y: areaTop + Math.random() * (areaBot - areaTop),
    vx: (Math.random() > 0.5 ? 1 : -1) * SPIDER_SPEED * (0.6 + Math.random() * 0.4),
    vy: (Math.random() > 0.5 ? 1 : -1) * SPIDER_SPEED * (0.3 + Math.random() * 0.3),
    alive: true,
  };
}

function resetGame() {
  state.score = 0;
  state.lives = START_LIVES;
  state.gameOver = false;
  state.wave = 1;
  state.fireTimer = 0;
  state.invincibleTimer = 0;
  state.running = false;
  mushrooms = [];
  bullets = [];
  spider = null;
  flea = null;
  scorpion = null;
  spiderTimer = spiderInterval;
  fleaTimer = fleaInterval;
  scorpionTimer = scorpionInterval;
  moveTimer = 0;
  spawnMushrooms(NUM_MUSHROOMS_INIT);
  spawnCentipede(12);
  document.getElementById('fs').style.display = 'none';
  updateHUD();
}

function startGame() {
  ensureAudio();
  startAmbient();
  resetGame();
  state.running = true;
  achievements.incrementPlays('centipede');
  document.getElementById('overlay').classList.add('hidden');
  document.addEventListener('keydown', trapTab);
  if (state.best >= 1000) achievements.unlock('centipede_thousand');
  say('Centipede: destruí el ciempiés y esquivá las arañas.');
}

function loseLife() {
  state.lives--;
  pDeath();
  triggerShake(6);
  spawnParticles((COLS * GS) / 2, CH - 20, '#6ec6ff', 15, { spd: 100, life: 0.5, smx: 4 });
  updateHUD();
  if (state.lives <= 0) {
    endGame();
    return;
  }
  state.invincibleTimer = 2;
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('centipede2d_best', String(state.best));
  }
  const ot = document.getElementById('ot'),
    fs = document.getElementById('fs'),
    he = document.getElementById('he');
  ot.textContent = '💥 ¡Game Over!' + (state.score >= 5000 ? ' 🏆' : '');
  fs.style.display = 'block';
  fs.textContent = `Puntaje: ${state.score} · Récord: ${state.best}`;
  he.innerHTML = `<kbd>Espacio</kbd> / tocar para empezar · <kbd>R</kbd> reiniciar`;
  document.getElementById('overlay').classList.remove('hidden');
  document.removeEventListener('keydown', trapTab);
  say('Centipede: game over.');
  updateHUD();
}

function nextWave() {
  state.wave++;
  pWin();
  spawnMushrooms(15);
  spawnCentipede(Math.min(8 + state.wave * 2, 20));
  moveInterval = Math.max(0.06, 0.15 - state.wave * 0.008);
  spiderInterval = Math.max(2, 4 - state.wave * 0.15);
  spiderTimer = spiderInterval * 0.5;
  fleaInterval = Math.max(2.5, 6 - state.wave * 0.2);
  scorpionInterval = Math.max(4, 8 - state.wave * 0.25);
  updateHUD();
}

// ============================================================
// ENTRADA
// ============================================================
const input = { left: false, right: false, up: false, down: false, fire: false };

window.addEventListener('keydown', (e) => {
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    e.preventDefault();
    input.left = true;
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    e.preventDefault();
    input.right = true;
  } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    input.up = true;
  } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    input.down = true;
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
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') input.up = false;
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') input.down = false;
  else if (e.code === 'Space') input.fire = false;
});

function bH(id, onDown, onUp) {
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
}
bH(
  'bL',
  () => (input.left = true),
  () => (input.left = false),
);
bH(
  'bR',
  () => (input.right = true),
  () => (input.right = false),
);
document.getElementById('bF')?.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    document.getElementById('bF').classList.add('is-pressed');
    if (!state.running) startGame();
    else input.fire = true;
  },
  { passive: false },
);
document.getElementById('bF')?.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    document.getElementById('bF').classList.remove('is-pressed');
    input.fire = false;
  },
  { passive: false },
);
document.getElementById('bF')?.addEventListener('touchcancel', () => {
  document.getElementById('bF').classList.remove('is-pressed');
  input.fire = false;
});

canvas.addEventListener('pointerdown', () => {
  if (!state.running) startGame();
});
const announce = document.getElementById('announce');
function say(msg) {
  if (announce) announce.textContent = msg;
}
function trapTab(e) {
  if (e.key === 'Tab') e.preventDefault();
}

document.getElementById('overlay').addEventListener('click', () => {
  if (!state.running) startGame();
});

// Gamepad
let gI = null;
const gP = { f: false, s: false };
window.addEventListener('gamepadconnected', (e) => (gI = e.gamepad.index));
window.addEventListener('gamepaddisconnected', (e) => {
  if (gI === e.gamepad.index) gI = null;
});
function pG() {
  if (!navigator.getGamepads) return;
  const pads = navigator.getGamepads();
  const gp = (gI !== null ? pads[gI] : null) || pads[0];
  if (!gp) return;
  const ax = gp.axes[0] ?? 0,
    ay = gp.axes[1] ?? 0;
  input.left = ax < -0.4 || !!gp.buttons[14]?.pressed;
  input.right = ax > 0.4 || !!gp.buttons[15]?.pressed;
  input.up = ay < -0.4 || !!gp.buttons[12]?.pressed;
  input.down = ay > 0.4 || !!gp.buttons[13]?.pressed;
  const fH = !!(gp.buttons[0]?.pressed || gp.buttons[2]?.pressed);
  const sH = !!gp.buttons[9]?.pressed;
  if (fH && !gP.f && !state.gameOver) {
    if (!state.running) startGame();
    else input.fire = true;
  }
  if (!fH && gP.f) input.fire = false;
  if (sH && !gP.s && !state.running) startGame();
  gP.f = fH;
  gP.s = sH;
}

// ============================================================
// FÍSICA / LÓGICA
// ============================================================
const player = { x: CW / 2, y: CH - 30 };

function hasMushroomAt(gx, gy) {
  const cx = gx * GS + GS / 2,
    cy = gy * GS + GS / 2;
  for (const m of mushrooms) {
    if (Math.abs(m.x - cx) < 1 && Math.abs(m.y - cy) < 1) return true;
  }
  return false;
}

function addMushroomAt(gx, gy, poisoned = false) {
  if (gy < 1 || gy >= ROWS - 1 || gx < 0 || gx >= COLS) return;
  if (!hasMushroomAt(gx, gy)) {
    mushrooms.push({ x: gx * GS + GS / 2, y: gy * GS + GS / 2, poisoned });
  }
}

function updateCentipede(dt) {
  if (segments.length === 0) return;

  moveTimer += dt;
  if (moveTimer < moveInterval) return;
  moveTimer = 0;

  const head = segments[0];
  const headGX = Math.round((head.x - GS / 2) / GS);
  const headGY = Math.round((head.y - GS / 2) / GS);

  // Save prev positions for follow-the-leader
  const prevPos = segments.map((s) => ({ x: s.x, y: s.y }));

  // Move head
  const nextGX = headGX + moveDir;
  const hitsEdge = nextGX < 0 || nextGX >= COLS;
  const hitsMushroom = hasMushroomAt(nextGX, headGY);

  if (hitsEdge || hitsMushroom) {
    // Check if mushroom is poisoned (scorpion-touched) → go straight down
    const mushroomHit = hitsMushroom && hasMushroomAt(nextGX, headGY);
    let mushroomPoisoned = false;
    if (mushroomHit) {
      const mx = nextGX * GS + GS / 2,
        my = headGY * GS + GS / 2;
      for (const m of mushrooms) {
        if (Math.abs(m.x - mx) < 1 && Math.abs(m.y - my) < 1 && m.poisoned) {
          mushroomPoisoned = true;
          break;
        }
      }
    }

    if (mushroomPoisoned) {
      // Drop straight down multiple rows
      const newGY = Math.min(headGY + 4, ROWS - 2);
      head.x = headGX * GS + GS / 2;
      head.y = newGY * GS + GS / 2;
      // Don't reverse direction — keep going the same way
    } else {
      // Normal: move down one row, reverse direction
      const newGY = headGY + 1;
      if (newGY >= ROWS - 1) {
        if (segments.length > 0) {
          segments = [];
          return;
        }
      }
      head.x = headGX * GS + GS / 2;
      head.y = newGY * GS + GS / 2;
      moveDir *= -1;
    }
  } else {
    head.x = nextGX * GS + GS / 2;
  }

  // Follow-the-leader: each segment moves to previous position of the one before
  for (let i = 1; i < segments.length; i++) {
    segments[i].x = prevPos[i - 1].x;
    segments[i].y = prevPos[i - 1].y;
  }

  // Collision with player
  if (state.invincibleTimer <= 0) {
    for (const seg of segments) {
      if (Math.abs(seg.x - player.x) < 12 && Math.abs(seg.y - player.y) < 12) {
        loseLife();
        break;
      }
    }
  }
}

function updateFlea(dt) {
  if (!flea) {
    // Only spawn when mushroom count is low
    fleaTimer -= dt;
    if (fleaTimer <= 0) {
      fleaTimer = fleaInterval;
      if (mushrooms.length < 25) spawnFlea();
    }
    return;
  }
  if (!flea.alive) return;

  flea.y += flea.vy * dt;

  // Leave mushroom trail every GS/2 pixels
  if (Math.random() < 0.15) {
    const gx = Math.round((flea.x - GS / 2) / GS);
    const gy = Math.round((flea.y - GS / 2) / GS);
    if (gy > 0 && gy < ROWS - 1) addMushroomAt(gx, gy);
  }

  if (flea.y > CH + 20) {
    flea = null;
    fleaTimer = fleaInterval;
    return;
  }

  // Collision with player
  if (
    state.invincibleTimer <= 0 &&
    Math.abs(flea.x - player.x) < 12 &&
    Math.abs(flea.y - player.y) < 12
  ) {
    loseLife();
  }
}

function updateScorpion(dt) {
  if (!scorpion) {
    scorpionTimer -= dt;
    if (scorpionTimer <= 0) {
      spawnScorpion();
    }
    return;
  }
  if (!scorpion.alive) return;

  scorpion.x += scorpion.vx * dt;

  // Poison mushrooms in path
  if (Math.random() < 0.08) {
    const gx = Math.round((scorpion.x - GS / 2) / GS);
    const gy = Math.round((scorpion.y - GS / 2) / GS);
    if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
      for (const m of mushrooms) {
        const mx = Math.round((m.x - GS / 2) / GS);
        const my = Math.round((m.y - GS / 2) / GS);
        if (mx === gx && my === gy) {
          m.poisoned = true;
          break;
        }
      }
    }
  }

  if (scorpion.x < -30 || scorpion.x > CW + 30) {
    scorpion = null;
    scorpionTimer = scorpionInterval;
    return;
  }

  // Collision with player
  if (
    state.invincibleTimer <= 0 &&
    Math.abs(scorpion.x - player.x) < 14 &&
    Math.abs(scorpion.y - player.y) < 14
  ) {
    loseLife();
  }
}

function updatePlayer(dt) {
  if (state.invincibleTimer > 0) state.invincibleTimer -= dt;
  let dx = 0,
    dy = 0;
  if (input.left) dx -= 1;
  if (input.right) dx += 1;
  if (input.up) dy -= 1;
  if (input.down) dy += 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
  }
  player.x += dx * PLAYER_SPEED * dt;
  player.y += dy * PLAYER_SPEED * dt;
  player.x = Math.max(10, Math.min(CW - 10, player.x));
  player.y = Math.max(CH * 0.55, Math.min(CH - 10, player.y));

  // Fire
  if (state.fireTimer > 0) state.fireTimer -= dt;
  if (input.fire && state.fireTimer <= 0) {
    bullets.push({ x: player.x, y: player.y - 10, vy: -BULLET_SPEED });
    state.fireTimer = FIRE_CD;
    pFire();
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];

    // Anti-tunneling: sub-pasos para balas rápidas
    const maxStep = BULLET_SPEED * dt;
    const minThickness = 16;
    if (maxStep > minThickness * 0.4) {
      const steps = Math.ceil(maxStep / (minThickness * 0.3));
      const subDt = dt / steps;
      for (let s = 0; s < steps; s++) {
        b.y += b.vy * subDt;
        if (b.y < 0) {
          bullets.splice(i, 1);
          break;
        }
        // Collision check in each sub-step (same logic as main loop)
        let hit = false;
        for (let si = 0; si < segments.length && !hit; si++) {
          const seg = segments[si];
          if (Math.abs(b.x - seg.x) < GS / 2 && Math.abs(b.y - seg.y) < GS / 2) {
            const gx = Math.round((seg.x - GS / 2) / GS);
            const gy = Math.round((seg.y - GS / 2) / GS);
            const points = seg.isHead ? HEAD_POINTS : SEGMENT_POINTS;
            state.score += points;
            pHitSeg();
            spawnParticles(seg.x, seg.y, '#6ee7b7', 8, { spd: 60, life: 0.3 });
            addMushroomAt(gx, gy);
            segments.splice(si, 1);
            if (segments.length > 0) segments[0].isHead = true;
            bullets.splice(i, 1);
            hit = true;
            updateHUD();
            if (segments.length === 0) {
              setTimeout(() => {
                if (state.running && !state.gameOver) nextWave();
              }, 500);
            }
            break;
          }
        }
        if (!bullets[i]) break;
      }
      if (!bullets[i]) continue;
    } else {
      b.y += b.vy * dt;
    }
    if (b.y < 0) {
      bullets.splice(i, 1);
      continue;
    }

    // Hit centipede segments
    let hit = false;
    for (let si = 0; si < segments.length && !hit; si++) {
      const seg = segments[si];
      if (Math.abs(b.x - seg.x) < GS / 2 && Math.abs(b.y - seg.y) < GS / 2) {
        const gx = Math.round((seg.x - GS / 2) / GS);
        const gy = Math.round((seg.y - GS / 2) / GS);
        const points = seg.isHead ? HEAD_POINTS : SEGMENT_POINTS;
        state.score += points;
        pHitSeg();
        spawnParticles(seg.x, seg.y, '#6ee7b7', 8, { spd: 60, life: 0.3 });

        // Add mushroom where segment was
        addMushroomAt(gx, gy);

        // Split the centipede: remove this segment and any trailing ones become new centipede
        // Actually in classic centipede, hitting a segment creates a mushroom and splits
        // Segments after it become a new centipede (but heading in same dir)
        // For simplicity: just remove this segment
        segments.splice(si, 1);

        if (segments.length > 0) {
          segments[0].isHead = true;
        }

        bullets.splice(i, 1);
        hit = true;
        updateHUD();

        // Check wave clear
        if (segments.length === 0) {
          // Wait briefly then next wave
          setTimeout(() => {
            if (state.running && !state.gameOver) nextWave();
          }, 500);
        }
        break;
      }
    }
    if (hit) continue;

    // Hit flea
    if (flea && flea.alive && !hit && Math.abs(b.x - flea.x) < 12 && Math.abs(b.y - flea.y) < 12) {
      state.score += FLEA_POINTS;
      pFlea();
      spawnParticles(flea.x, flea.y, '#ff8800', 10, { spd: 80, life: 0.3, smx: 4 });
      flea = null;
      fleaTimer = fleaInterval;
      bullets.splice(i, 1);
      hit = true;
      updateHUD();
      continue;
    }

    // Hit scorpion
    if (
      scorpion &&
      scorpion.alive &&
      !hit &&
      Math.abs(b.x - scorpion.x) < 12 &&
      Math.abs(b.y - scorpion.y) < 12
    ) {
      state.score += SCORPION_POINTS;
      pScorpion();
      spawnParticles(scorpion.x, scorpion.y, '#aa44ff', 12, { spd: 80, life: 0.4, smx: 4 });
      scorpion = null;
      scorpionTimer = scorpionInterval;
      bullets.splice(i, 1);
      hit = true;
      updateHUD();
      continue;
    }

    // Hit mushrooms (destroy them)
    for (let mi = mushrooms.length - 1; mi >= 0; mi--) {
      const m = mushrooms[mi];
      if (Math.abs(b.x - m.x) < 6 && Math.abs(b.y - m.y) < 6) {
        mushrooms.splice(mi, 1);
        spawnParticles(b.x, b.y, '#ffe066', 5, { spd: 40, life: 0.2 });
        bullets.splice(i, 1);
        hit = true;
        break;
      }
    }
  }
}

function updateSpider(dt) {
  if (!spider) {
    spiderTimer -= dt;
    if (spiderTimer <= 0) {
      spawnSpider();
    }
    return;
  }

  if (!spider.alive) return;

  spider.x += spider.vx * dt;
  spider.y += spider.vy * dt;

  // Bounce
  const areaTop = CH * 0.55,
    areaBot = CH - 40;
  if (spider.x < 5 || spider.x > CW - 5) {
    spider.vx *= -1;
  }
  if (spider.y < areaTop || spider.y > areaBot) {
    spider.vy *= -1;
  }
  spider.x = Math.max(5, Math.min(CW - 5, spider.x));
  spider.y = Math.max(areaTop, Math.min(areaBot, spider.y));

  // Random direction change
  if (Math.random() < 0.02) {
    spider.vx = (Math.random() > 0.5 ? 1 : -1) * SPIDER_SPEED * (0.6 + Math.random() * 0.4);
    spider.vy = (Math.random() > 0.5 ? 1 : -1) * SPIDER_SPEED * (0.3 + Math.random() * 0.3);
  }

  // Collision with player
  if (
    state.invincibleTimer <= 0 &&
    Math.abs(spider.x - player.x) < 14 &&
    Math.abs(spider.y - player.y) < 14
  ) {
    loseLife();
  }

  // Check bullet collision
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (Math.abs(b.x - spider.x) < 12 && Math.abs(b.y - spider.y) < 12) {
      state.score += SPIDER_POINTS;
      pSpider();
      spawnParticles(spider.x, spider.y, '#ff6b6b', 12, { spd: 80, life: 0.4, smx: 4 });
      spider.alive = false;
      spider = null;
      spiderTimer = spiderInterval;
      bullets.splice(i, 1);
      updateHUD();
      break;
    }
  }
}

// ============================================================
// RENDER
// ============================================================
function draw() {
  ctx.clearRect(0, 0, cw, ch);
  const so = getShakeOffset();
  ctx.save();
  ctx.translate(so.x, so.y);
  const s = sc,
    cx = ox,
    cy = oy;

  // Background
  const grad = ctx.createRadialGradient(
    cx + (CW * s) / 2,
    cy + (CH * s) / 2,
    0,
    cx + (CW * s) / 2,
    cy + (CH * s) / 2,
    CW * s * 0.7,
  );
  grad.addColorStop(0, '#0d1020');
  grad.addColorStop(1, '#0a0a14');
  ctx.fillStyle = grad;
  ctx.fillRect(cx, cy, CW * s, CH * s);

  // Grid lines (subtle)
  ctx.strokeStyle = 'rgba(255,255,255,0.02)';
  ctx.lineWidth = 0.5 * s;
  for (let gx = 0; gx <= COLS; gx++) {
    ctx.beginPath();
    ctx.moveTo(cx + gx * GS * s, cy);
    ctx.lineTo(cx + gx * GS * s, cy + CH * s);
    ctx.stroke();
  }
  for (let gy = 0; gy <= ROWS; gy++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + gy * GS * s);
    ctx.lineTo(cx + CW * s, cy + gy * GS * s);
    ctx.stroke();
  }

  // Separator line (bottom play area)
  ctx.strokeStyle = 'rgba(110,198,255,0.15)';
  ctx.lineWidth = 1.5 * s;
  ctx.setLineDash([4 * s, 6 * s]);
  const sepY = CH * 0.55;
  ctx.beginPath();
  ctx.moveTo(cx, cy + sepY * s);
  ctx.lineTo(cx + CW * s, cy + sepY * s);
  ctx.stroke();
  ctx.setLineDash([]);

  // Border
  ctx.shadowColor = 'rgba(110,231,183,0.06)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(110,231,183,0.1)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(cx, cy, CW * s, CH * s);
  ctx.shadowBlur = 0;

  // Mushrooms
  for (const m of mushrooms) {
    const mx = cx + m.x * s,
      my = cy + m.y * s,
      r = 5 * s;
    const isPoisoned = m.poisoned;
    const capColor = isPoisoned ? '#aa44ff' : '#6ee7b7';
    const glowColor = isPoisoned ? 'rgba(170,68,255,0.15)' : 'rgba(110,231,183,0.12)';
    // Stem
    ctx.fillStyle = isPoisoned ? 'rgba(200,150,255,0.15)' : 'rgba(255,255,255,0.1)';
    ctx.fillRect(mx - 1.5 * s, my - 2 * s, 3 * s, 6 * s);
    // Cap
    ctx.fillStyle = capColor;
    ctx.beginPath();
    ctx.arc(mx, my - 2 * s, r, r * 0.3, Math.PI * 1.7, false);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx, my - 2 * s, r * 0.7, 0, Math.PI, false);
    ctx.fill();
    // Glow
    drawGlow(ctx, mx, my - 2 * s, r * 0.4, glowColor, 0.08, 3);
    // Dots
    ctx.fillStyle = isPoisoned ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(mx - r * 0.2, my - r * 0.45, 1 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx + r * 0.25, my - r * 0.35, 0.7 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Centipede segments
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const sx = cx + seg.x * s,
      sy = cy + seg.y * s,
      r = GS * 0.4 * s;
    const isHead = seg.isHead;
    const color = isHead ? '#ff6b6b' : '#6ee7b7';
    const glow = isHead ? 'rgba(255,107,107,0.15)' : 'rgba(110,231,183,0.1)';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, sx, sy, r, glow, 0.08, 3);
    // Body detail
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.arc(sx - r * 0.25, sy - r * 0.25, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    if (isHead) {
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx - r * 0.3, sy - r * 0.15, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + r * 0.3, sy - r * 0.15, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(sx - r * 0.25, sy - r * 0.1, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + r * 0.35, sy - r * 0.1, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Antennae
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(sx - r * 0.5, sy - r * 0.7);
      ctx.lineTo(sx - r, sy - r * 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + r * 0.5, sy - r * 0.7);
      ctx.lineTo(sx + r, sy - r * 1.3);
      ctx.stroke();
    }
  }

  // Player ship
  if (!state.gameOver) {
    const blink = state.invincibleTimer > 0 && Math.floor(state.invincibleTimer * 8) % 2 === 0;
    if (!blink) {
      const px = cx + player.x * s,
        py = cy + player.y * s;
      ctx.shadowColor = '#6ec6ff';
      ctx.shadowBlur = 10 * s;
      // Ship body
      ctx.fillStyle = '#6ec6ff';
      ctx.beginPath();
      ctx.moveTo(px, py - 8 * s);
      ctx.lineTo(px - 10 * s, py + 6 * s);
      ctx.lineTo(px - 4 * s, py + 4 * s);
      ctx.lineTo(px, py + 8 * s);
      ctx.lineTo(px + 4 * s, py + 4 * s);
      ctx.lineTo(px + 10 * s, py + 6 * s);
      ctx.closePath();
      ctx.fill();
      // Cockpit
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.moveTo(px, py - 4 * s);
      ctx.lineTo(px - 3 * s, py + 2 * s);
      ctx.lineTo(px + 3 * s, py + 2 * s);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  // Bullets
  for (const b of bullets) {
    const bx = cx + b.x * s,
      by = cy + b.y * s;
    ctx.fillStyle = '#ffdd88';
    ctx.fillRect(bx - 1.5 * s, by, 3 * s, 8 * s);
    drawGlow(ctx, bx, by, 3 * s, '#ffdd88', 0.1, 4);
  }

  // Flea
  if (flea && flea.alive) {
    const fx = cx + flea.x * s,
      fy = cy + flea.y * s;
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(fx, fy, 4 * s, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, fx, fy, 4 * s, '#ff8800', 0.12, 3);
    // Wings
    ctx.fillStyle = 'rgba(255,200,100,0.3)';
    ctx.beginPath();
    ctx.ellipse(fx - 5 * s, fy - 2 * s, 4 * s, 2 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(fx + 5 * s, fy - 2 * s, 4 * s, 2 * s, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(fx - 1.5 * s, fy - 1.5 * s, 1.3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx + 1.5 * s, fy - 1.5 * s, 1.3 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(fx - 1 * s, fy - 1 * s, 0.7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx + 2 * s, fy - 1 * s, 0.7 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Scorpion
  if (scorpion && scorpion.alive) {
    const sx = cx + scorpion.x * s,
      sy = cy + scorpion.y * s;
    ctx.fillStyle = '#aa44ff';
    ctx.beginPath();
    ctx.ellipse(sx, sy, 5 * s, 3.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, sx, sy, 5 * s, '#aa44ff', 0.1, 3);
    // Tail
    ctx.strokeStyle = '#aa44ff';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(sx + 5 * s, sy);
    ctx.quadraticCurveTo(sx + 9 * s, sy - 4 * s, sx + 12 * s, sy - 2 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(sx + 12 * s, sy - 2 * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    // Pincers
    ctx.beginPath();
    ctx.moveTo(sx - 5 * s, sy - 2 * s);
    ctx.lineTo(sx - 8 * s, sy - 5 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx - 5 * s, sy + 2 * s);
    ctx.lineTo(sx - 8 * s, sy + 5 * s);
    ctx.stroke();
    // Eyes
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(sx - 2 * s, sy - 1 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 2 * s, sy - 1 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Spider
  if (spider && spider.alive) {
    const spx = cx + spider.x * s,
      spy = cy + spider.y * s;
    // Body
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.ellipse(spx, spy, 6 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, spx, spy, 6 * s, '#ff6b6b', 0.08, 3);
    // Legs (8)
    ctx.strokeStyle = 'rgba(255,107,107,0.5)';
    ctx.lineWidth = 1.5 * s;
    const legLen = 8 * s;
    for (let li = 0; li < 4; li++) {
      const ang = Math.PI * 0.15 + li * Math.PI * 0.17;
      ctx.beginPath();
      ctx.moveTo(spx - 5 * s, spy - 2 * s + li * 1.5 * s);
      ctx.lineTo(
        spx - 5 * s - Math.cos(ang) * legLen,
        spy - 2 * s + li * 1.5 * s + Math.sin(ang) * legLen * 0.5,
      );
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(spx + 5 * s, spy - 2 * s + li * 1.5 * s);
      ctx.lineTo(
        spx + 5 * s + Math.cos(ang) * legLen,
        spy - 2 * s + li * 1.5 * s + Math.sin(ang) * legLen * 0.5,
      );
      ctx.stroke();
    }
    // Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(spx - 2 * s, spy - 1 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(spx + 2 * s, spy - 1 * s, 1.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(spx - 1.5 * s, spy - 0.5 * s, 0.7 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(spx + 2.5 * s, spy - 0.5 * s, 0.7 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles
  drawParticles(ctx, ox, oy, sc);
  ctx.restore();
}

// ============================================================
// HUD
// ============================================================
const scoreEl = document.getElementById('scoreValue'),
  livesEl = document.getElementById('livesValue');
const bestEl = document.getElementById('bestValue');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  livesEl.textContent =
    '●'.repeat(Math.max(0, state.lives)) + '○'.repeat(Math.max(0, 3 - state.lives));
  bestEl.textContent = String(state.best);
}

// ============================================================
// MAIN LOOP
// ============================================================
let animFrameId = null;
let lt = 0;
function tick(t) {
  const dt = Math.min((t - lt) / 1000, 0.05);
  lt = t;
  pG();
  updateShake(dt);

  if (state.running && !state.gameOver) {
    updatePlayer(dt);
    updateCentipede(dt);
    updateFlea(dt);
    updateScorpion(dt);
    updateBullets(dt);
    updateSpider(dt);
  }

  updateParticles(dt);
  draw();
  animFrameId = requestAnimationFrame(tick);
}

resetGame();
updateHUD();

function cleanup() {
  if (animFrameId) cancelAnimationFrame(animFrameId);
  document.removeEventListener('keydown', trapTab);
  stopAmbient();
  closeAudio();
}
window.addEventListener('beforeunload', cleanup);
window.addEventListener('pagehide', cleanup);
document.getElementById('loading').classList.add('hidden');
animFrameId = requestAnimationFrame((t) => {
  lt = t;
  tick(t);
});

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

// Help button
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('centipede'));
