import { showHelp } from '../../shared/help.js';
import { ensureAudio, beep, startAmbient, stopAmbient, closeAudio } from '../../shared/audio.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import { createGameLoop } from '../../shared/loop.js';
import {
  updateShake,
  getShakeOffset,
  spawnParticles,
  updateParticles,
  drawParticles,
  drawGlow,
  feedbackBundle,
  clearSquashes,
} from '../../shared/effects.js';

injectCommonElements();

/* ============================================================
   MISSILE COMMAND 2D — Arcade Hub
   Canvas 2D, sin dependencias externas.
   ============================================================ */

// ============================================================
// CONSTANTES
// ============================================================
const CW = 800,
  CH = 600;
const GROUND_Y = CH - 30;
const CITY_R = 10;
const NUM_CITIES = 6;
const NUM_BASES = 3;
const START_AMMO = 30;
const AMMO_PER_WAVE = 5;
const ABM_SPEED = 550;
const BLAST_RADIUS = 40;
const BLAST_DURATION = 0.4;
const CITY_PTS = 5; // bonus per city at wave end
const KILL_PTS = 25;
const SMART_PTS = 50;
const SAT_PTS = 100;
const GUIDED_KILLS = 8; // kills para obtener misil teledirigido
const GUIDED_SPEED = 420;
const GUIDED_RADIUS = 55;
const GUIDED_PTS = 150;
const MIN_AMMO_PER_BASE = 2;
const MIN_INCOMING_INTERVAL = 0.3;
const BASE_INCOMING_INTERVAL = 1.2;
const INCOMING_REDUCTION = 0.05;
const GUIDED_SLOW_DIST = 0.15;

// ============================================================
// ESTADO
// ============================================================
const state = {
  running: false,
  gameOver: false,
  score: 0,
  best: Number(localStorage.getItem('missile2d_best') || 0),
  wave: 1,
  ammo: START_AMMO,
  waveTimer: 0,
  waveActive: false,
  cityCount: NUM_CITIES,
  guidedKills: 0,
  guidedCharge: 0,
};

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('gameCanvas'),
  ctx = canvas.getContext('2d', { alpha: false });
const { w: cw, h: ch, s: sc, x: ox, y: oy } = setupCanvas(canvas, ctx, CW, CH, 10);

// ============================================================
// SONIDO
// ============================================================
function pLaunch() {
  beep({ freq: 800, freqEnd: 1200, duration: 0.05, type: 'square', volume: 0.06 });
}
function pExplode() {
  beep({ freq: 200, freqEnd: 50, duration: 0.12, type: 'sawtooth', volume: 0.12 });
}
function pHitCity() {
  feedbackBundle('large', CW / 2, CH / 2, {
    color: '#ff4444',
    noFlash: true,
    onBeep: () => beep({ freq: 300, freqEnd: 30, duration: 0.3, type: 'sawtooth', volume: 0.18 }),
  });
}
function pWaveStart() {
  beep({ freq: 220, freqEnd: 440, duration: 0.15, type: 'triangle', volume: 0.12 });
}
function pGuidedLaunch() {
  beep({ freq: 600, freqEnd: 1800, duration: 0.08, type: 'sine', volume: 0.1 });
}
function pGuidedHit(bx, by) {
  feedbackBundle('medium', bx, by, {
    color: '#44ff88',
    onBeep: () => beep({ freq: 800, freqEnd: 200, duration: 0.2, type: 'triangle', volume: 0.18 }),
  });
}

// ============================================================
// PARTÍCULAS (shared)
// ============================================================

// ============================================================
// ENTIDADES
// ============================================================
let missiles = []; // incoming enemy missiles
let abs = []; // anti-ballistic missiles (player's)
let blasts = []; // explosion circles
let smartMissiles = [];
let satellites = [];
let cities = [];
let bases = [];
let incomingTimer = 0;
let incomingInterval = 1.2;
let smartTimer = 0;
let satTimer = 0;
let guidedMissile = null;
const crosshair = { x: CW / 2, y: CH / 2 };

function initLevel() {
  // Place cities
  cities = [];
  const spacing = CW / (NUM_CITIES + 1);
  for (let i = 0; i < NUM_CITIES; i++) {
    cities.push({ x: spacing * (i + 1), alive: true });
  }

  // Place bases
  bases = [];
  const bPositions = [CW * 0.15, CW * 0.5, CW * 0.85];
  for (const bx of bPositions) {
    bases.push({ x: bx, ammo: Math.max(MIN_AMMO_PER_BASE, Math.floor(START_AMMO / NUM_BASES)) });
  }

  missiles = [];
  abs = [];
  blasts = [];
  smartMissiles = [];
  satellites = [];
  guidedMissile = null;
  state.ammo = START_AMMO;
  state.cityCount = NUM_CITIES;
  state.guidedKills = 0;
  state.guidedCharge = 0;
  incomingTimer = 0;
  incomingInterval = Math.max(
    MIN_INCOMING_INTERVAL,
    BASE_INCOMING_INTERVAL - state.wave * INCOMING_REDUCTION,
  );
  smartTimer = 3 + Math.random() * 2;
  satTimer = 8 + Math.random() * 4;
}

function startWave() {
  state.waveActive = true;
  incomingInterval = Math.max(
    MIN_INCOMING_INTERVAL,
    BASE_INCOMING_INTERVAL - state.wave * INCOMING_REDUCTION,
  );
  state.ammo += AMMO_PER_WAVE;
  // Redistribute ammo to bases
  for (const b of bases) b.ammo = Math.max(MIN_AMMO_PER_BASE, Math.floor(state.ammo / NUM_BASES));
  updateHUD();
}

function fireABM(tx, ty) {
  if (!state.running || state.gameOver || !state.waveActive) return;
  // Find nearest base with ammo
  let bestBase = null,
    bestDist = Infinity;
  for (const b of bases) {
    if (b.ammo <= 0) continue;
    const d = Math.hypot(b.x - tx, GROUND_Y - ty);
    if (d < bestDist) {
      bestDist = d;
      bestBase = b;
    }
  }
  if (!bestBase) return;

  bestBase.ammo--;
  state.ammo--;
  const angle = Math.atan2(ty - GROUND_Y, tx - bestBase.x);
  abs.push({
    x: bestBase.x,
    y: GROUND_Y,
    vx: Math.cos(angle) * ABM_SPEED,
    vy: Math.sin(angle) * ABM_SPEED,
    targetX: tx,
    targetY: ty,
    trail: [],
    alive: true,
  });
  pLaunch();
  updateHUD();
}

function fireGuided() {
  if (
    !state.running ||
    state.gameOver ||
    !state.waveActive ||
    state.guidedCharge <= 0 ||
    guidedMissile
  )
    return;
  // Find nearest base with ammo
  let bestBase = null,
    bestDist = Infinity;
  for (const b of bases) {
    if (b.ammo <= 0) continue;
    const d = Math.hypot(b.x - crosshair.x, GROUND_Y - crosshair.y);
    if (d < bestDist) {
      bestDist = d;
      bestBase = b;
    }
  }
  if (!bestBase) return;
  bestBase.ammo--;
  state.ammo--;
  state.guidedCharge--;
  state.guidedKills = 0;
  guidedMissile = {
    x: bestBase.x,
    y: GROUND_Y,
    targetX: crosshair.x,
    targetY: crosshair.y,
    trail: [],
    life: 3.5, // segundos antes de autodestruirse
    alive: true,
  };
  pGuidedLaunch();
  updateHUD();
}

function spawnMissile() {
  const fromX = Math.random() * CW;
  const target = cities.filter((c) => c.alive);
  const targetY =
    target.length > 0 && Math.random() < 0.7
      ? target[Math.floor(Math.random() * target.length)].x
      : Math.random() * CW;
  const speed = 120 + state.wave * 8 + Math.random() * 40;
  const len = Math.hypot(targetY - fromX, GROUND_Y);
  missiles.push({
    x: fromX,
    y: 0,
    vx: ((targetY - fromX) / len) * speed,
    vy: (GROUND_Y / len) * speed,
    trail: [],
    alive: true,
    isSmart: false,
  });
}

function spawnSmartMissile() {
  const fromX = Math.random() * CW;
  const speed = 100 + state.wave * 5;
  smartMissiles.push({
    x: fromX,
    y: 0,
    vx: (Math.random() - 0.5) * speed * 0.3,
    vy: speed * 0.6,
    wobble: Math.random() * 3 + 1,
    wobbleOffset: Math.random() * 6,
    trail: [],
    alive: true,
  });
}

function spawnSatellite() {
  const fromLeft = Math.random() > 0.5;
  const speed = 60 + state.wave * 5;
  satellites.push({
    x: fromLeft ? -20 : CW + 20,
    y: 20 + Math.random() * (CH * 0.3),
    vx: fromLeft ? speed : -speed,
    alive: true,
  });
}

function resetGame() {
  state.score = 0;
  state.gameOver = false;
  state.wave = 1;
  state.ammo = START_AMMO;
  state.waveActive = false;
  state.waveTimer = 0;
  state.cityCount = NUM_CITIES;
  crosshair.x = CW / 2;
  crosshair.y = CH / 2;
  initLevel();
  document.getElementById('fs').style.display = 'none';
  updateHUD();
}

function startGame() {
  clearSquashes();
  ensureAudio();
  startAmbient();
  resetGame();
  state.running = true;
  achievements.incrementPlays('missile-command');
  startWave();
  document.getElementById('overlay').classList.add('hidden');
  document.addEventListener('keydown', trapTab);
  updateHUD();
  say('Missile Command: defendé tus ciudades de los misiles.');
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  stopAmbient();
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('missile2d_best', String(state.best));
  }
  const ot = document.getElementById('ot'),
    fs = document.getElementById('fs'),
    he = document.getElementById('he');
  ot.textContent = '💥 ¡Todas las ciudades destruidas!' + (state.score >= 5000 ? ' 🏆' : '');
  fs.style.display = 'block';
  fs.textContent = `Puntaje: ${state.score} · Récord: ${state.best}`;
  he.innerHTML = `<kbd>Espacio</kbd> / tocar para empezar · <kbd>R</kbd> reiniciar`;
  document.getElementById('overlay').classList.remove('hidden');
  document.removeEventListener('keydown', trapTab);
  say('Missile Command: game over.');
  updateHUD();
}

function nextWave() {
  state.wave++;
  pWaveStart();
  initLevel();
  startWave();
  updateHUD();
}

// ============================================================
// ENTRADA
// ============================================================

// Mouse / pointer
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  crosshair.x = (e.clientX - rect.left - ox) / sc;
  crosshair.y = (e.clientY - rect.top - oy) / sc;
});

canvas.addEventListener('click', (e) => {
  if (!state.running) {
    startGame();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const tx = (e.clientX - rect.left - ox) / sc;
  const ty = (e.clientY - rect.top - oy) / sc;
  crosshair.x = tx;
  crosshair.y = ty;
  if (state.guidedCharge > 0 && !guidedMissile) {
    fireGuided();
  } else {
    fireABM(tx, ty);
  }
});
canvas.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    if (!state.running) {
      startGame();
      return;
    }
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const tx = (touch.clientX - rect.left - ox) / sc;
    const ty = (touch.clientY - rect.top - oy) / sc;
    crosshair.x = tx;
    crosshair.y = ty;
    if (state.guidedCharge > 0 && !guidedMissile) {
      fireGuided();
    } else {
      fireABM(tx, ty);
    }
  },
  { passive: false },
);

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (!state.running) startGame();
  } else if (e.code === 'KeyR' && !state.running) {
    e.preventDefault();
    startGame();
  }
  // Crosshair movement with keyboard
  const step = 8;
  if (e.code === 'ArrowLeft') {
    crosshair.x = Math.max(0, crosshair.x - step);
    e.preventDefault();
  } else if (e.code === 'ArrowRight') {
    crosshair.x = Math.min(CW, crosshair.x + step);
    e.preventDefault();
  } else if (e.code === 'ArrowUp') {
    crosshair.y = Math.max(0, crosshair.y - step);
    e.preventDefault();
  } else if (e.code === 'ArrowDown') {
    crosshair.y = Math.min(CH, crosshair.y + step);
    e.preventDefault();
  }
  if (e.code === 'Space' && state.running) fireABM(crosshair.x, crosshair.y);
});

// Touch fire button
document.getElementById('bF')?.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault();
    document.getElementById('bF').classList.add('is-pressed');
    if (!state.running) startGame();
    else fireABM(crosshair.x, crosshair.y);
  },
  { passive: false },
);
document.getElementById('bF')?.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault();
    document.getElementById('bF').classList.remove('is-pressed');
  },
  { passive: false },
);
document.getElementById('bF')?.addEventListener('touchcancel', () => {
  document.getElementById('bF').classList.remove('is-pressed');
});

const announce = document.getElementById('announce');
function say(msg) {
  if (announce) announce.textContent = msg;
}
function trapTab(e) {
  if (e.key === 'Tab') e.preventDefault();
}

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
  if (Math.abs(ax) > 0.15) crosshair.x = Math.max(0, Math.min(CW, crosshair.x + ax * 6));
  if (Math.abs(ay) > 0.15) crosshair.y = Math.max(0, Math.min(CH, crosshair.y + ay * 6));
  const fH = !!(gp.buttons[0]?.pressed || gp.buttons[2]?.pressed);
  const sH = !!gp.buttons[9]?.pressed;
  if (fH && !gP.f) {
    if (!state.running) startGame();
    else if (state.guidedCharge > 0 && !guidedMissile) fireGuided();
    else fireABM(crosshair.x, crosshair.y);
  }
  if (sH && !gP.s && !state.running) startGame();
  gP.f = fH;
  gP.s = sH;
}

// ============================================================
// FÍSICA / LÓGICA
// ============================================================

function updateMissiles(dt) {
  // Incoming missiles
  incomingTimer -= dt;
  if (incomingTimer <= 0 && state.waveActive) {
    spawnMissile();
    incomingTimer = incomingInterval * (0.5 + Math.random());
    // Extra missiles on higher waves
    if (state.wave > 3 && Math.random() < 0.3) spawnMissile();
  }

  for (let i = missiles.length - 1; i >= 0; i--) {
    const m = missiles[i];
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 20) m.trail.shift();
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    if (m.y >= GROUND_Y) {
      // Hit ground - check for city
      let hitCity = false;
      for (const city of cities) {
        if (city.alive && Math.abs(city.x - m.x) < CITY_R * 2) {
          city.alive = false;
          state.cityCount--;
          pHitCity();
          spawnParticles(city.x, GROUND_Y, '#ff6b6b', 20, { spd: 100, life: 0.5, smx: 5 });
          updateHUD();
          if (state.cityCount <= 0) {
            endGame();
            return;
          }
          hitCity = true;
          break;
        }
      }
      if (!hitCity) {
        spawnParticles(m.x, GROUND_Y, '#ff8844', 8, { spd: 60, life: 0.3 });
      }
      missiles.splice(i, 1);
    }
  }
}

function updateSmartMissiles(dt) {
  smartTimer -= dt;
  if (smartTimer <= 0 && state.waveActive && state.wave >= 2) {
    spawnSmartMissile();
    smartTimer = 5 + Math.random() * 4 - state.wave * 0.2;
  }

  for (let i = smartMissiles.length - 1; i >= 0; i--) {
    const m = smartMissiles[i];
    m.trail.push({ x: m.x, y: m.y });
    if (m.trail.length > 25) m.trail.shift();
    m.x += m.vx * dt + Math.sin((Date.now() / 200) * m.wobble + m.wobbleOffset) * 2;
    m.y += m.vy * dt;
    if (m.y >= GROUND_Y) {
      let hitCity = false;
      for (const city of cities) {
        if (city.alive && Math.abs(city.x - m.x) < CITY_R * 2) {
          city.alive = false;
          state.cityCount--;
          pHitCity();
          spawnParticles(city.x, GROUND_Y, '#ff6b6b', 20, { spd: 100, life: 0.5, smx: 5 });
          updateHUD();
          if (state.cityCount <= 0) {
            endGame();
            return;
          }
          hitCity = true;
          break;
        }
      }
      if (!hitCity) spawnParticles(m.x, GROUND_Y, '#ff8844', 8, { spd: 60, life: 0.3 });
      smartMissiles.splice(i, 1);
    }
  }
}

function updateSatellites(dt) {
  satTimer -= dt;
  if (satTimer <= 0 && state.waveActive && state.wave >= 3) {
    spawnSatellite();
    satTimer = 10 + Math.random() * 5 - state.wave * 0.3;
  }

  for (let i = satellites.length - 1; i >= 0; i--) {
    const s = satellites[i];
    s.x += s.vx * dt;
    if (s.x < -40 || s.x > CW + 40) {
      satellites.splice(i, 1);
    }
  }
}

function updateABMs(dt) {
  for (let i = abs.length - 1; i >= 0; i--) {
    const a = abs[i];
    a.trail.push({ x: a.x, y: a.y });
    if (a.trail.length > 15) a.trail.shift();
    a.x += a.vx * dt;
    a.y += a.vy * dt;

    // Check if reached target (close enough) or past it
    const distToTarget = Math.hypot(a.x - a.targetX, a.y - a.targetY);
    if (distToTarget < 15 || a.y < 0 || a.x < 0 || a.x > CW) {
      // Explode
      a.alive = false;
      const bx = a.x,
        by = a.y;
      blasts.push({
        x: bx,
        y: by,
        radius: BLAST_RADIUS,
        timer: BLAST_DURATION,
        maxTimer: BLAST_DURATION,
      });
      pExplode();
      spawnParticles(bx, by, '#ffdd88', 10, { spd: 80, life: 0.3 });
      let killsThisBlast = 0;
      // Kill missiles in blast radius
      for (let mi = missiles.length - 1; mi >= 0; mi--) {
        const m = missiles[mi];
        if (Math.hypot(m.x - bx, m.y - by) < BLAST_RADIUS) {
          state.score += KILL_PTS;
          spawnParticles(m.x, m.y, '#ffdd88', 6, { spd: 50, life: 0.2 });
          missiles.splice(mi, 1);
          killsThisBlast++;
          updateHUD();
        }
      }
      for (let si = smartMissiles.length - 1; si >= 0; si--) {
        const m = smartMissiles[si];
        if (Math.hypot(m.x - bx, m.y - by) < BLAST_RADIUS) {
          state.score += SMART_PTS;
          spawnParticles(m.x, m.y, '#ffaa44', 8, { spd: 60, life: 0.3 });
          smartMissiles.splice(si, 1);
          killsThisBlast++;
          updateHUD();
        }
      }
      for (let si = satellites.length - 1; si >= 0; si--) {
        const s = satellites[si];
        if (Math.hypot(s.x - bx, s.y - by) < BLAST_RADIUS * 1.5) {
          state.score += SAT_PTS;
          spawnParticles(s.x, s.y, '#aaaaff', 12, { spd: 80, life: 0.4 });
          satellites.splice(si, 1);
          killsThisBlast++;
          updateHUD();
        }
      }
      // Grant guided charge if threshold reached
      if (killsThisBlast > 0) {
        state.guidedKills += killsThisBlast;
        if (state.guidedKills >= GUIDED_KILLS && state.guidedCharge < 1) {
          state.guidedCharge = 1;
          beep({ freq: 440, freqEnd: 880, duration: 0.15, type: 'triangle', volume: 0.12 });
          updateHUD();
        }
      }

      abs.splice(i, 1);
    }
  }
}

function updateGuidedMissile(dt) {
  if (!guidedMissile) return;
  const g = guidedMissile;
  g.life -= dt;

  // Steer towards current crosshair position
  const dx = crosshair.x - g.x;
  const dy = crosshair.y - g.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 1) {
    const speed = Math.min(GUIDED_SPEED, dist / GUIDED_SLOW_DIST);
    g.x += (dx / dist) * speed * dt;
    g.y += (dy / dist) * speed * dt;
  }

  // Trail
  g.trail.push({ x: g.x, y: g.y });
  if (g.trail.length > 30) g.trail.shift();

  // Check collision with enemy missiles
  let hitEnemy = false;
  let hitX = g.x,
    hitY = g.y;
  for (let mi = missiles.length - 1; mi >= 0; mi--) {
    const m = missiles[mi];
    if (Math.hypot(m.x - g.x, m.y - g.y) < GUIDED_RADIUS) {
      state.score += KILL_PTS + Math.floor(GUIDED_PTS / 2);
      spawnParticles(m.x, m.y, '#44ff88', 14, { spd: 100, life: 0.5, smx: 5 });
      missiles.splice(mi, 1);
      hitEnemy = true;
      hitX = m.x;
      hitY = m.y;
      break;
    }
  }
  if (!hitEnemy) {
    for (let si = smartMissiles.length - 1; si >= 0; si--) {
      const m = smartMissiles[si];
      if (Math.hypot(m.x - g.x, m.y - g.y) < GUIDED_RADIUS) {
        state.score += SMART_PTS + GUIDED_PTS;
        spawnParticles(m.x, m.y, '#44ff88', 14, { spd: 100, life: 0.5, smx: 5 });
        smartMissiles.splice(si, 1);
        hitEnemy = true;
        hitX = m.x;
        hitY = m.y;
        break;
      }
    }
  }
  if (!hitEnemy) {
    for (let si = satellites.length - 1; si >= 0; si--) {
      const s = satellites[si];
      if (Math.hypot(s.x - g.x, s.y - g.y) < GUIDED_RADIUS * 1.5) {
        state.score += SAT_PTS + GUIDED_PTS;
        spawnParticles(s.x, s.y, '#44ff88', 14, { spd: 100, life: 0.5, smx: 5 });
        satellites.splice(si, 1);
        hitEnemy = true;
        hitX = s.x;
        hitY = s.y;
        break;
      }
    }
  }

  // Explode on: hit enemy, near crosshair, or timeout
  const nearCrosshair = Math.hypot(g.x - crosshair.x, g.y - crosshair.y) < 20;
  if (hitEnemy || nearCrosshair || g.life <= 0 || g.y < 0 || g.x < 0 || g.x > CW) {
    guidedMissile = null;
    const bx = hitEnemy ? hitX : g.x;
    const by = hitEnemy ? hitY : g.y;
    blasts.push({
      x: bx,
      y: by,
      radius: GUIDED_RADIUS,
      timer: BLAST_DURATION * 1.5,
      maxTimer: BLAST_DURATION * 1.5,
    });
    pGuidedHit(bx, by);
    spawnParticles(bx, by, '#44ff88', 25, { spd: 120, life: 0.5, smx: 6 });
    updateHUD();
  }
}

function updateBlasts(dt) {
  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i];
    b.timer -= dt;
    if (b.timer <= 0) blasts.splice(i, 1);
  }

  // Wave completion check
  if (state.waveActive && missiles.length === 0 && smartMissiles.length === 0) {
    // No more incoming, brief pause then next wave
    state.waveTimer += dt;
    if (state.waveTimer > 1.5) {
      state.waveTimer = 0;
      // Bonus for surviving cities
      let cityBonus = 0;
      for (const city of cities) {
        if (city.alive) cityBonus += CITY_PTS;
      }
      if (cityBonus > 0) {
        state.score += cityBonus * state.wave;
      }
      nextWave();
    }
  } else {
    state.waveTimer = 0;
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

  // Sky gradient
  const grad = ctx.createLinearGradient(cx, cy, cx, cy + CH * s);
  grad.addColorStop(0, '#0a1025');
  grad.addColorStop(0.5, '#141838');
  grad.addColorStop(0.8, '#1a2040');
  grad.addColorStop(1, '#0d1020');
  ctx.fillStyle = grad;
  ctx.fillRect(cx, cy, CW * s, CH * s);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 60; i++) {
    const x = (i * 53 + 37) % CW,
      y = (i * 97 + 43) % CH;
    ctx.beginPath();
    ctx.arc(cx + x * s, cy + y * s, (0.3 + (i % 3)) * s, 0, Math.PI * 2);
    ctx.fill();
  }

  // Border
  ctx.shadowColor = 'rgba(255,100,100,0.06)';
  ctx.shadowBlur = 12;
  ctx.strokeStyle = 'rgba(255,100,100,0.1)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(cx, cy, CW * s, CH * s);
  ctx.shadowBlur = 0;

  // Ground
  ctx.fillStyle = '#1a2a1a';
  ctx.fillRect(cx, cy + GROUND_Y * s, CW * s, CH * s - GROUND_Y * s);
  ctx.fillStyle = '#2a3a2a';
  for (let gx = 0; gx < CW; gx += 8) {
    ctx.fillRect(cx + gx * s, cy + (GROUND_Y - 2) * s, 4 * s, 2 * s);
  }

  // Cities
  for (const city of cities) {
    if (!city.alive) continue;
    const x = cx + city.x * s,
      y = cy + GROUND_Y * s;
    ctx.fillStyle = '#6ec6ff';
    ctx.fillRect(x - 6 * s, y - 12 * s, 12 * s, 12 * s);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x - 4 * s, y - 10 * s, 8 * s, 4 * s);
    ctx.fillStyle = '#44aadd';
    ctx.fillRect(x - 7 * s, y - 1 * s, 14 * s, 3 * s);
    drawGlow(ctx, x, y - 6 * s, 6 * s, '#6ec6ff', 0.04, 3);
  }

  // Bases
  for (const b of bases) {
    if (b.ammo <= 0) continue;
    const x = cx + b.x * s,
      y = cy + GROUND_Y * s;
    ctx.fillStyle = '#888';
    ctx.fillRect(x - 8 * s, y - 5 * s, 16 * s, 8 * s);
    ctx.fillStyle = '#aaa';
    ctx.fillRect(x - 4 * s, y - 4 * s, 8 * s, 3 * s);
  }

  // Missile trails
  for (const m of missiles) {
    for (let i = 0; i < m.trail.length; i++) {
      const a = (i / m.trail.length) * 0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ff6666';
      ctx.beginPath();
      ctx.arc(cx + m.trail[i].x * s, cy + m.trail[i].y * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Head
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.arc(cx + m.x * s, cy + m.y * s, 2.5 * s, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, cx + m.x * s, cy + m.y * s, 2.5 * s, '#ff4444', 0.08, 3);
  }

  // Smart missile trails
  for (const m of smartMissiles) {
    for (let i = 0; i < m.trail.length; i++) {
      const a = (i / m.trail.length) * 0.5;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(cx + m.trail[i].x * s, cy + m.trail[i].y * s, 2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.arc(cx + m.x * s, cy + m.y * s, 3 * s, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, cx + m.x * s, cy + m.y * s, 3 * s, '#ff8800', 0.08, 3);
  }

  // Satellites
  for (const s_ of satellites) {
    const sx = cx + s_.x * sc,
      sy = cy + s_.y * sc;
    ctx.fillStyle = '#8888ff';
    ctx.fillRect(sx - 6 * s, sy - 2 * s, 12 * s, 4 * s);
    ctx.fillRect(sx - 2 * s, sy - 6 * s, 4 * s, 12 * s);
    drawGlow(ctx, sx, sy, 6 * s, '#8888ff', 0.04, 3);
  }

  // ABM trails
  for (const a of abs) {
    for (let i = 0; i < a.trail.length; i++) {
      const a2 = (i / a.trail.length) * 0.8;
      ctx.globalAlpha = a2;
      ctx.fillStyle = '#ffdd88';
      ctx.beginPath();
      ctx.arc(cx + a.trail[i].x * s, cy + a.trail[i].y * s, 1.5 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffdd88';
    ctx.beginPath();
    ctx.arc(cx + a.x * s, cy + a.y * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, cx + a.x * s, cy + a.y * s, 2 * s, '#ffdd88', 0.08, 3);
  }

  // Explosions
  for (const b of blasts) {
    const a2 = Math.max(0, b.timer / b.maxTimer);
    const r = b.radius * s * (1 - a2 * 0.3);
    ctx.globalAlpha = a2 * 0.6;
    ctx.shadowColor = '#ffdd88';
    ctx.shadowBlur = 20 * s;
    ctx.fillStyle = `rgba(255,220,100,${a2 * 0.5})`;
    ctx.beginPath();
    ctx.arc(cx + b.x * s, cy + b.y * s, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `rgba(255,200,50,${a2 * 0.8})`;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(cx + b.x * s, cy + b.y * s, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Crosshair
  if (state.running && !state.gameOver) {
    const hx = cx + crosshair.x * s,
      hy = cy + crosshair.y * s;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(hx - 8 * s, hy);
    ctx.lineTo(hx - 3 * s, hy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx + 3 * s, hy);
    ctx.lineTo(hx + 8 * s, hy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx, hy - 8 * s);
    ctx.lineTo(hx, hy - 3 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hx, hy + 3 * s);
    ctx.lineTo(hx, hy + 8 * s);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.5 * s;
    ctx.beginPath();
    ctx.arc(hx, hy, 12 * s, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Guided missile
  if (guidedMissile) {
    const g = guidedMissile;
    // Trail
    for (let i = 0; i < g.trail.length; i++) {
      const a = (i / g.trail.length) * 0.7;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#44ff88';
      ctx.beginPath();
      ctx.arc(cx + g.trail[i].x * s, cy + g.trail[i].y * s, (1.5 + i * 0.05) * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Head with glow
    ctx.shadowColor = '#44ff88';
    ctx.shadowBlur = 14 * s;
    ctx.fillStyle = '#44ff88';
    ctx.beginPath();
    ctx.arc(cx + g.x * s, cy + g.y * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#88ffbb';
    ctx.beginPath();
    ctx.arc(cx + g.x * s, cy + g.y * s, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Particles
  drawParticles(ctx, ox, oy, sc);
  ctx.restore();
}

// ============================================================
// HUD
// ============================================================
const scoreEl = document.getElementById('scoreValue'),
  citiesEl = document.getElementById('citiesValue');
const ammoEl = document.getElementById('ammoValue'),
  waveEl = document.getElementById('waveValue');
const bestEl = document.getElementById('bestValue');
const gdEl = document.getElementById('gdBadge');
function updateHUD() {
  scoreEl.textContent = String(state.score);
  citiesEl.textContent = '●'.repeat(state.cityCount) + '○'.repeat(NUM_CITIES - state.cityCount);
  ammoEl.textContent = String(state.ammo);
  waveEl.textContent = String(state.wave);
  bestEl.textContent = String(state.best);
  if (gdEl) gdEl.style.display = state.guidedCharge > 0 ? 'inline-flex' : 'none';
  if (state.score >= 1000) achievements.unlock('missile_thousand');
}

// ============================================================
// MAIN LOOP
// ============================================================
const loop = createGameLoop((dt) => {
  pG();
  updateShake(dt);

  if (state.running && !state.gameOver) {
    updateMissiles(dt);
    updateSmartMissiles(dt);
    updateSatellites(dt);
    updateABMs(dt);
    updateGuidedMissile(dt);
    updateBlasts(dt);
  }

  updateParticles(dt);
  draw();
});

resetGame();
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
// Help button
document.getElementById('helpBtn')?.addEventListener('click', () => showHelp('missile-command'));
