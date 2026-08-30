import { ensureAudio, beep, startAmbient } from '../../shared/audio.js';
import { startMusic, stopMusic } from '../../shared/music.js';
import { achievements } from '../../shared/achievements.js';
import { injectCommonElements } from '../../shared/dom.js';
import { setupCanvas } from '../../shared/display.js';
import { setupGameShell } from '../../shared/shell.js';
import { loadBest, saveBest } from '../../shared/scores.js';
import { createGameLoop } from '../../shared/loop.js';
import { createGamepad, onKey, cleanupAll } from '../../shared/input.js';
import {
  spawnParticles,
  updateParticles,
  drawParticles,
  clearParticles,
  drawGlow,
} from '../../shared/effects.js';

injectCommonElements();

const shell = setupGameShell('qbert');

/* ============================================================
   Q*BERT — Arcade Hub
   Isometric pyramid: hop cubes to change their color, clear the
   level, dodge Coily and hunt Slick/Sam. Ambient only (no music).
   Canvas 2D, sin dependencias externas.
   ============================================================ */

// ── Pirámide 7×7 (k = fila desde arriba, i = columna 0..k) ──
const MAX_K = 6;
const STEP_X = 86;
const STEP_Y = 42;
const DW = 92; // ancho del rombo de la cara superior
const DH = 46; // alto del rombo
const CUBE_H = 44; // cuerpo del cubo
const W = 720;
const H = 540;
const X0 = W / 2;
const Y0 = 118;

const state = {
  phase: 'menu',
  paused: false,
  score: 0,
  best: loadBest('qbert2d'),
  level: 1,
  lives: 3,
};

const player = {
  k: 0,
  i: 0,
  x: 0,
  y: 0,
  hopping: false,
  landTimer: 0,
  hopT: 0,
  hopFrom: { x: 0, y: 0 },
  hopOver: null,
  inv: 0,
  alive: true,
  falls: false,
  turbo: 0,
};

let cubes = [];
let slick = [];
let coily = null;
let disc = null;
let jumpCount = 0;
let discCount = 0;
let levelTimer = 0;
let eggTimer = 0;
let slickTimer = 0;
let hitsThisLevel = false;
let gameoverDone = false;

/* ── Coordenadas ── */
function cubePos(k, i) {
  return { x: X0 + (i - k / 2) * STEP_X, y: Y0 + k * STEP_Y };
}

function inPyramid(k, i) {
  return k >= 0 && k <= MAX_K && i >= 0 && i <= k;
}

function initCubes() {
  cubes = [];
  for (let k = 0; k <= MAX_K; k++) {
    for (let i = 0; i <= k; i++) {
      cubes.push({ k, i, colored: false, pos: cubePos(k, i) });
    }
  }
}

function levelComplete() {
  return cubes.every((c) => c.colored);
}

/* ── Sonido ── */
function playHopSound() {
  beep({ freq: 540, freqEnd: 320, duration: 0.07, type: 'triangle', volume: 0.14 });
}
function playColorSound() {
  beep({ freq: 700, freqEnd: 1050, duration: 0.06, type: 'triangle', volume: 0.14 });
}
function playSlickSound() {
  beep({ freq: 500, freqEnd: 260, duration: 0.16, type: 'square', volume: 0.16 });
}
function playCoilySound() {
  beep({ freq: 900, freqEnd: 140, duration: 0.22, type: 'sawtooth', volume: 0.18 });
}
function playDeathSound() {
  beep({ freq: 380, freqEnd: 70, duration: 0.45, type: 'sawtooth', volume: 0.18 });
}
function playLevelSound() {
  beep({ freq: 500, freqEnd: 1100, duration: 0.22, type: 'triangle', volume: 0.18 });
}

/* ── Flujo ── */
function startGame() {
  ensureAudio();
  state.score = 0;
  state.level = 1;
  state.lives = 3;
  gameoverDone = false;
  state.phase = 'play';
  startLevel();
  startAmbient();
  startMusic('qbert');
  shell.enableTabTrap();
  overlay.style.display = 'none';
  updateHUD();
  say('Q*bert — ¡Empezó!');
}

function startLevel() {
  initCubes();
  slick = [];
  coily = null;
  disc = null;
  jumpCount = 0;
  discCount = 0;
  eggTimer = 0;
  slickTimer = 0;
  hitsThisLevel = false;
  levelTimer = 0;
  player.k = 0;
  player.i = 0;
  player.hopping = false;
  player.hopT = 0;
  player.inv = 1.2;
  player.alive = true;
  player.falls = false;
  player.turbo = 0;
  const p = cubePos(0, 0);
  player.x = p.x;
  player.y = p.y;
  clearParticles();
  playLevelSound();
  updateHUD();
}

function nextLevel() {
  state.score += 1000 + state.level * 500;
  state.level++;
  updateHUD();
  startLevel();
}

function gameOver() {
  if (!gameoverDone) {
    gameoverDone = true;
    state.phase = 'menu';
    shell.disableTabTrap();
    stopMusic();
    if (state.score > state.best) {
      state.best = state.score;
      saveBest('qbert2d', state.best);
    }
    finalScoreEl.textContent = `Puntos: ${state.score}`;
    finalScoreEl.style.display = '';
    overlayText.textContent = '¡Q*bert cayó de la pirámide! ¡Reiniciá para volver a saltar!';
    hintEl.innerHTML =
      '<kbd>R</kbd> reiniciar &nbsp;·&nbsp; <kbd>Espacio</kbd> / tap para jugar de nuevo';
    overlay.style.display = '';
    updateHUD();
    say(`Fin de partida — Puntos: ${state.score}. Mejor: ${state.best}`);
  }
}

function colorCube(k, i) {
  if (!inPyramid(k, i)) return;
  const c = cubes.find((cu) => cu.k === k && cu.i === i);
  if (c && !c.colored) {
    c.colored = true;
    state.score += 25;
    playColorSound();
    updateHUD();
  }
}

/* ── Movimiento del jugador ── */
function hopDir(dir) {
  if (state.phase !== 'play' || !player.alive || player.hopping || state.paused) return;
  const JUMPS = {
    ul: { dk: -1, di: -1 },
    ur: { dk: -1, di: 0 },
    dl: { dk: 1, di: 0 },
    dr: { dk: 1, di: 1 },
  };
  const d = JUMPS[dir];
  const nk = player.k + d.dk;
  const ni = player.i + d.di;
  jumpCount++;
  if (!inPyramid(nk, ni)) {
    // ¡Cae fuera de la pirámide!
    player.falls = true;
    player.hopping = true;
    player.hopT = 0;
    player.hopFrom = { x: player.x, y: player.y };
    player.hopOver = { x: player.x, y: player.y + 420 };
    return;
  }
  const tgt = cubePos(nk, ni);
  player.hopping = true;
  player.hopT = 0;
  player.hopFrom = { x: player.x, y: player.y };
  player.k = nk;
  player.i = ni;
  player.hopOver = { x: tgt.x, y: tgt.y };
  playHopSound();
  if (jumpCount === 10 && !coily && state.level >= 1) {
    spawnEgg();
  }
}

function updatePlayer(dt) {
  if (!player.hopping) {
    const p = cubePos(player.k, player.i);
    player.x = p.x;
    player.y = p.y;
    return;
  }
  if (player.turbo > 0) player.turbo -= dt;
  const speed = player.turbo > 0 ? 0.11 : 0.22;
  player.hopT += dt;
  const t = Math.min(1, player.hopT / speed);
  player.x = player.hopFrom.x + (player.hopOver.x - player.hopFrom.x) * t;
  player.y =
    player.hopFrom.y + (player.hopOver.y - player.hopFrom.y) * t - Math.sin(t * Math.PI) * 70;
  if (t >= 1) {
    player.hopping = false;
    player.x = player.hopOver.x;
    player.y = player.hopOver.y;
    if (player.falls) {
      player.falls = false;
      playerDied(false);
      return;
    }
    playerLand();
  }
}

function playerLand() {
  const k = player.k;
  const i = player.i;
  colorCube(k, i);

  // Power-ups sobre el cubo
  if (disc && disc.k === k && disc.i === i) {
    discCount++;
    killCoily(true);
    if (discCount >= 3) {
      achievements.unlock('qbert_coily_catcher');
    }
    disc = null;
  }
  if (turboHere(k, i)) {
    player.turbo = 8;
    consumeturbo();
  }

  // Enemigos en el cubo
  for (let idx = slick.length - 1; idx >= 0; idx--) {
    const s = slick[idx];
    if (s.k === k && s.i === i && !s.hopping) {
      killSlick(s);
    }
  }
  if (coily && coily.k === k && coily.i === i && coily.hopping === false) {
    playerHit();
  }

  if (levelComplete()) {
    const elapsed = levelTimer;
    if (elapsed < 30) {
      achievements.unlock('qbert_speed_cuber');
    }
    if (!hitsThisLevel) {
      achievements.unlock('qbert_perfect_level');
    }
    say(`¡Nivel ${state.level} completado!`);
    nextLevel();
  }
}

function playerHit() {
  if (!player.alive || player.inv > 0) return;
  hitsThisLevel = true;
  playerDied(true);
}

function playerDied(_fromHit) {
  player.alive = false;
  state.lives--;
  spawnParticles(player.x, player.y, 16, '#00f0ff', { spd: 150, life: 0.6 });
  playDeathSound();
  updateHUD();
  if (state.lives <= 0) {
    gameOver();
    return;
  }
  // Reinicio en la punta con invencibilidad
  player.k = 0;
  player.i = 0;
  const p = cubePos(0, 0);
  player.x = p.x;
  player.y = p.y;
  player.hopping = false;
  player.falls = false;
  player.inv = 2.2;
  player.alive = true;
}

/* ── Enemigos ── */
function spawnEgg() {
  if (coily) return;
  const at = cubePos(0, 0);
  eggTimer = 4;
  coily = {
    kind: 'egg',
    k: 0,
    i: 0,
    x: at.x,
    y: at.y,
    hopping: false,
    hopT: 0,
    hopFrom: null,
    hopOver: null,
    dead: false,
  };
}

function spawnSlick() {
  const maxSlick = state.level >= 4 ? 2 : state.level >= 2 ? 1 : 0;
  while (slick.length < maxSlick) {
    const k = 2 + Math.floor(Math.random() * 3);
    const i = Math.floor(Math.random() * (k + 1));
    const p = cubePos(k, i);
    slick.push({
      kind: Math.random() < 0.5 ? 'slick' : 'sam',
      k,
      i,
      x: p.x,
      y: p.y,
      hopping: false,
      hopT: 0,
      hopFrom: null,
      hopOver: null,
    });
  }
  spawnSlickTimer();
}

function spawnSlickTimer() {
  slickTimer = 14 + Math.random() * 8;
}

function killSlick(s) {
  state.score += 500;
  spawnParticles(s.x, s.y, 10, '#ffb800', { spd: 130, life: 0.5 });
  playSlickSound();
  const idx = slick.indexOf(s);
  if (idx !== -1) slick.splice(idx, 1);
  updateHUD();
}

function killCoily(fromDisc) {
  if (!coily) return;
  spawnParticles(coily.x, coily.y, 16, '#ff2d78', { spd: 160, life: 0.6 });
  playCoilySound();
  const bonus = fromDisc ? 1000 : 1500;
  state.score += bonus;
  coily = null;
  updateHUD();
}

function enemyHop(e, dir) {
  if (e.hopping) return;
  const JUMPS = {
    ul: { dk: -1, di: -1 },
    ur: { dk: -1, di: 0 },
    dl: { dk: 1, di: 0 },
    dr: { dk: 1, di: 1 },
  };
  const d = JUMPS[dir];
  const nk = e.k + d.dk;
  const ni = e.i + d.di;
  if (!inPyramid(nk, ni)) {
    // Cae fuera de la pirámide
    e.dead = true;
    e.hopping = true;
    e.hopT = 0;
    e.hopFrom = { x: e.x, y: e.y };
    e.hopOver = { x: e.x, y: e.y + 500 };
    return;
  }
  const tgt = cubePos(nk, ni);
  e.hopping = true;
  e.hopT = 0;
  e.hopFrom = { x: e.x, y: e.y };
  e.k = nk;
  e.i = ni;
  e.hopOver = { x: tgt.x, y: tgt.y };
}

function updateEnemyHop(e, dt, speed) {
  if (!e.hopping) return;
  const dur = speed || 0.46;
  e.hopT += dt;
  const t = Math.min(1, e.hopT / dur);
  e.x = e.hopFrom.x + (e.hopOver.x - e.hopFrom.x) * t;
  e.y = e.hopFrom.y + (e.hopOver.y - e.hopFrom.y) * t - Math.sin(t * Math.PI) * 56;
  if (t >= 1) {
    e.hopping = false;
    if (e.dead) return;
    e.x = e.hopOver.x;
    e.y = e.hopOver.y;
    enemyLanded(e);
  }
}

function enemyLanded(e) {
  if (e.kind === 'egg') return;
  // Slick/Sam revierten el color del cubo
  if (e.kind === 'slick' || e.kind === 'sam') {
    const c = cubes.find((cu) => cu.k === e.k && cu.i === e.i);
    if (c) c.colored = false;
  }
  // Colisiones
  if (player.alive && !player.hopping) {
    if (player.k === e.k && player.i === e.i) {
      if (e.kind === 'coily') {
        playerHit();
      } else if (e.kind === 'slick' || e.kind === 'sam') {
        killSlick(e);
      }
    }
  }
}

function updateCoily(dt) {
  if (!coily) return;
  if (coily.kind === 'egg') {
    // Puede deslizarse sin saltar por la punta
    if (!player.hopping && player.k === 0 && player.i === 0 && player.inv <= 0) {
      const c = cubes.find((cu) => cu.k === 0 && cu.i === 0);
      if (!c.colored) {
        hitsThisLevel = true;
        playerHit();
        return;
      }
    }
    eggTimer -= dt;
    if (eggTimer <= 0) {
      coily.kind = 'coily';
    } else {
      return;
    }
  }
  if (coily.dead) return;
  updateEnemyHop(coily, dt);
  if (coily.hopping) return;
  // Elije saltar hacia abajo (dl/dr), sesgado hacia el jugador
  const opts = [
    { d: 'dl', w: player.i === coily.i ? 3 : 1 },
    { d: 'dr', w: player.i + 1 === coily.i || player.k === 0 ? 3 : 1 },
  ];
  let total = 0;
  for (const o of opts) total += o.w;
  let roll = Math.random() * total;
  let picked = 'dl';
  for (const o of opts) {
    if (roll < o.w) {
      picked = o.d;
      break;
    }
    roll -= o.w;
  }
  if (player.k > coily.k && Math.random() < 0.25) {
    picked = coily.i > player.i ? 'dr' : 'dl';
  }
  enemyHop(coily, picked);
}

function updateSlicks(dt) {
  for (const s of slick) {
    updateEnemyHop(s, dt);
    if (!s.hopping && !s.dead) {
      const opts = ['ul', 'ur', 'dl', 'dr'].filter((d) => {
        const J = {
          ul: { dk: -1, di: -1 },
          ur: { dk: -1, di: 0 },
          dl: { dk: 1, di: 0 },
          dr: { dk: 1, di: 1 },
        };
        const dd = J[d];
        return inPyramid(s.k + dd.dk, s.i + dd.di);
      });
      enemyHop(s, opts[Math.floor(Math.random() * opts.length)]);
    }
  }
  slick = slick.filter((s) => !s.dead);
}

/* ── Power-ups en la pirámide ── */
function turboHere(k, i) {
  return boost && boost.k === k && boost.i === i;
}
let boost = null;
function consumeturbo() {
  boost = null;
}
let discTimer = 0;
let boostTimer = 0;

function spawnDisc() {
  if (disc) return;
  const k = 1 + Math.floor(Math.random() * MAX_K);
  const i = Math.floor(Math.random() * (k + 1));
  const p = cubePos(k, i);
  disc = { k, i, x: p.x, y: p.y };
  discTimer = 16;
}

function spawnBoost() {
  if (boost) return;
  const k = 2 + Math.floor(Math.random() * 3);
  const i = Math.floor(Math.random() * (k + 1));
  const p = cubePos(k, i);
  boost = { k, i, x: p.x, y: p.y };
  boostTimer = 30;
}

/* ── Update ── */
function updateGame(dt) {
  if (state.paused) return;
  levelTimer += dt;

  if (discTimer > 0) discTimer -= dt;
  if (discTimer <= 0) spawnDisc();
  if (boostTimer > 0) boostTimer -= dt;
  if (boostTimer <= 0) spawnBoost();
  if (slickTimer > 0) slickTimer -= dt;
  if (slickTimer <= 0) spawnSlick();

  if (!player.hopping) {
    // Espera un tap para saltar
  }
  updatePlayer(dt);
  updateCoily(dt);
  updateSlicks(dt);
}

/* ── Render ── */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const { w: canvasW, h: canvasH, s: scale, x: offX, y: offY } = setupCanvas(canvas, ctx, W, H, 0);

const LEVEL_COLORS = ['#39ff14', '#00f0ff', '#ff2d78', '#ffb800', '#c084fc', '#ff8a65'];

function drawCube(ox, oy, s, c, color) {
  const x = ox + c.pos.x * s;
  const y = oy + c.pos.y * s;
  const W2 = (DW / 2) * s;
  const H2 = (DH / 2) * s;
  const C = CUBE_H * s;

  // Caras laterales (sombra)
  ctx.fillStyle = '#11132a';
  ctx.beginPath();
  ctx.moveTo(x - W2, y);
  ctx.lineTo(x, y + H2);
  ctx.lineTo(x, y + H2 + C);
  ctx.lineTo(x - W2, y + C);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0b0d1f';
  ctx.beginPath();
  ctx.moveTo(x + W2, y);
  ctx.lineTo(x, y + H2);
  ctx.lineTo(x, y + H2 + C);
  ctx.lineTo(x + W2, y + C);
  ctx.closePath();
  ctx.fill();

  // Cara superior (color)
  ctx.fillStyle = color;
  ctx.globalAlpha = c.colored ? 1 : 0.5;
  ctx.beginPath();
  ctx.moveTo(x, y - H2);
  ctx.lineTo(x + W2, y);
  ctx.lineTo(x, y + H2);
  ctx.lineTo(x - W2, y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.5 * s;
  ctx.stroke();
  if (c.colored) {
    drawGlow(ctx, x, y, H2 * 1.05, color, 0.14);
  }
}

function drawQbert(ox, oy, s, x, y, facing) {
  const blink = player.inv > 0 && Math.floor(player.inv * 10) % 2 === 0;
  const sx = ox + x * s;
  const sy = oy + y * s;
  if (blink) return;
  // Orejitas
  ctx.fillStyle = '#0a8f96';
  ctx.beginPath();
  ctx.arc(sx - 12 * s, sy - 8 * s, 7 * s, 0, Math.PI * 2);
  ctx.arc(sx + 12 * s, sy - 8 * s, 7 * s, 0, Math.PI * 2);
  ctx.fill();
  // Cuerpo
  ctx.fillStyle = '#00f0ff';
  ctx.beginPath();
  ctx.arc(sx, sy + 2 * s, 15 * s, 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, sx, sy + 2 * s, 18 * s, '#00f0ff', 0.35);
  // Nariz naranja
  ctx.fillStyle = '#ff8a65';
  ctx.beginPath();
  ctx.arc(sx + facing.x * 8 * s, sy + 2 * s + facing.y * 4 * s, 5 * s, 0, Math.PI * 2);
  ctx.fill();
  // Ojos
  ctx.fillStyle = '#0a0a1a';
  ctx.beginPath();
  ctx.arc(sx - 5 * s, sy - 2 * s, 2.6 * s, 0, Math.PI * 2);
  ctx.arc(sx + 5 * s, sy - 2 * s, 2.6 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoily(ox, oy, s, e) {
  const x = ox + e.x * s;
  const y = oy + e.y * s;
  if (e.kind === 'egg') {
    ctx.fillStyle = '#ffb800';
    ctx.beginPath();
    ctx.ellipse(x, y, 10 * s, 13 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    drawGlow(ctx, x, y, 13 * s, '#ffb800', 0.3);
    return;
  }
  ctx.fillStyle = '#ff2d78';
  ctx.beginPath();
  ctx.arc(x, y - 4 * s, 9 * s, 0, Math.PI * 2);
  ctx.arc(x - 8 * s, y + 6 * s, 6 * s, 0, Math.PI * 2);
  ctx.arc(x + 8 * s, y + 6 * s, 6 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0a1a';
  ctx.beginPath();
  ctx.arc(x - 3 * s, y - 6 * s, 2 * s, 0, Math.PI * 2);
  ctx.arc(x + 3 * s, y - 6 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, x, y, 14 * s, '#ff2d78', 0.3);
}

function drawSlick(ox, oy, s, e) {
  const x = ox + e.x * s;
  const y = oy + e.y * s;
  ctx.fillStyle = e.kind === 'slick' ? '#ffb800' : '#c084fc';
  ctx.beginPath();
  ctx.moveTo(x, y - 12 * s);
  ctx.lineTo(x + 9 * s, y + 4 * s);
  ctx.lineTo(x - 9 * s, y + 4 * s);
  ctx.closePath();
  ctx.fill();
  drawGlow(ctx, x, y, 11 * s, e.kind === 'slick' ? '#ffb800' : '#c084fc', 0.25);
}

function drawDisc(ox, oy, s) {
  if (!disc) return;
  const x = ox + disc.x * s;
  const y = oy + disc.y * s;
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.ellipse(x, y, 12 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff6d8';
  ctx.beginPath();
  ctx.arc(x, y - 4 * s, 4 * s, 0, Math.PI * 2);
  ctx.fill();
  drawGlow(ctx, x, y, 14 * s, '#39ff14', 0.35);
}

function drawBoost(ox, oy, s) {
  if (!boost) return;
  const x = ox + boost.x * s;
  const y = oy + boost.y * s;
  ctx.fillStyle = '#ffd166';
  ctx.font = `bold ${13 * s}px 'Courier New', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⚡', x, y - 2 * s);
  drawGlow(ctx, x, y, 12 * s, '#ffd166', 0.3);
}

function draw() {
  ctx.save();
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvasW, canvasH);
  const ox = offX;
  const oy = offY;
  const sx = scale;

  // Fondo: resplandor inferior
  const grad = ctx.createLinearGradient(0, 0, 0, H * sx);
  grad.addColorStop(0, 'rgba(20, 6, 30, 0.4)');
  grad.addColorStop(1, 'rgba(8, 8, 20, 0.9)');
  ctx.fillStyle = grad;
  ctx.fillRect(ox, oy, W * sx, H * sx);

  // Power-ups debajo de los cubos
  drawDisc(ox, oy, sx);
  drawBoost(ox, oy, sx);

  // Cubos (z-ordering: fila por fila)
  const color = LEVEL_COLORS[(state.level - 1) % LEVEL_COLORS.length];
  for (let k = 0; k <= MAX_K; k++) {
    for (let i = 0; i <= k; i++) {
      const c = cubes.find((cu) => cu.k === k && cu.i === i);
      drawCube(ox, oy, sx, c, color);
    }
  }

  // Personajes en su roca actual
  for (const e of slick) drawSlick(ox, oy, sx, e);
  if (coily) drawCoily(ox, oy, sx, coily);
  if (player.alive) drawQbert(ox, oy, sx, player.x, player.y, { x: 0, y: 0 });

  // Partículas
  drawParticles(ctx, ox, oy, sx);

  // Pausa
  if (state.paused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, W * sx, H * sx);
    ctx.fillStyle = '#fff';
    ctx.font = `${26 * sx}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSA', W * sx * 0.5, H * sx * 0.5);
  }

  ctx.restore();
}

/* ── HUD ── */
const scoreValueEl = document.getElementById('scoreValue');
const bestValueEl = document.getElementById('bestValue');
const levelValueEl = document.getElementById('levelValue');
const livesValueEl = document.getElementById('livesValue');
const enemiesValueEl = document.getElementById('enemiesValue');

function updateHUD() {
  scoreValueEl.textContent = String(state.score);
  bestValueEl.textContent = String(state.best);
  levelValueEl.textContent = String(state.level);
  livesValueEl.textContent = String(Math.max(state.lives, 0));
  enemiesValueEl.textContent = String((coily ? 1 : 0) + slick.length);
}

/* ── Input ── */
const KEY_DIRS = {
  KeyQ: 'ul',
  KeyE: 'ur',
  KeyA: 'dl',
  KeyD: 'dr',
};

onKey((e) => {
  if (e.code === 'KeyR' && (state.phase === 'menu' || gameoverDone)) {
    e.preventDefault();
    startGame();
    return;
  }
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (state.phase === 'menu' || gameoverDone) {
      startGame();
      return;
    }
  }
  if (e.code === 'KeyP') {
    if (state.phase === 'play') {
      state.paused = !state.paused;
      say(state.paused ? 'Pausa' : 'Reanudado');
    }
    return;
  }
  if (state.paused || state.phase !== 'play') return;
  const dir = KEY_DIRS[e.code];
  if (dir) {
    e.preventDefault();
    hopDir(dir);
  }
});

function bindBtn(id, onDown) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const fire = (e) => {
    e.preventDefault();
    btn.classList.add('is-pressed');
    onDown();
    setTimeout(() => btn.classList.remove('is-pressed'), 120);
  };
  btn.addEventListener('touchstart', fire, { passive: false });
  btn.addEventListener('mousedown', fire);
}

bindBtn('btnUL', () => {
  if (state.phase === 'menu' || gameoverDone) startGame();
  else hopDir('ul');
});
bindBtn('btnUR', () => {
  if (state.phase === 'menu' || gameoverDone) startGame();
  else hopDir('ur');
});
bindBtn('btnDL', () => {
  if (state.phase === 'menu' || gameoverDone) startGame();
  else hopDir('dl');
});
bindBtn('btnDR', () => {
  if (state.phase === 'menu' || gameoverDone) startGame();
  else hopDir('dr');
});

const gamepad = createGamepad();
let prevStart = false;
let prevA = false;
let prevDir = null;

function pollGamepad() {
  const gp = gamepad.pad;
  if (!gp) return;
  const dx = gp.axes[0] ?? 0;
  const dy = gp.axes[1] ?? 0; // positivo hacia abajo
  const startHeld = !!gp.buttons[9]?.pressed;
  if (startHeld && !prevStart) {
    if (state.phase === 'menu' || gameoverDone) startGame();
    else if (state.phase === 'play') state.paused = !state.paused;
  }
  prevStart = startHeld;
  const aHeld = !!gp.buttons[0]?.pressed;
  if (aHeld && !prevA) {
    if (state.phase === 'menu' || gameoverDone) startGame();
  }
  prevA = aHeld;

  // D-pad con diagonales como ejes sintéticos, o palanca
  let dir = null;
  if (Math.hypot(dx, dy) > 0.55) {
    if (dx > 0.2 && dy > 0.2) dir = 'dr';
    else if (dx > 0.2 && dy < -0.2) dir = 'ur';
    else if (dx < -0.2 && dy > 0.2) dir = 'dl';
    else if (dx < -0.2 && dy < -0.2) dir = 'ul';
  }
  if (dir && dir !== prevDir) {
    hopDir(dir);
  }
  prevDir = dir;
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

// Estado inicial
startLevel();
updateHUD();

shell.onCleanup(() => { cleanupAll(); loop.stop(); });
document.getElementById('loading').classList.add('hidden');
loop.start();
