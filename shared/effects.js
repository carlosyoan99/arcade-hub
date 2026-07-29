/* ═══════════════════════════════════════════════
   shared/effects.js — Efectos visuales compartidos
   Screen shake, partículas, flash, roundRect.
   ═══════════════════════════════════════════════ */

// ──────────────────────────────────────────────
// SCREEN SHAKE
// ──────────────────────────────────────────────
let shakeX = 0,
  shakeY = 0,
  shakeIntensity = 0;

/**
 * Activa un screen shake. La intensidad se acumula (se usa el máximo).
 * Llamar desde sonidos de impacto, colisiones, etc.
 */
export function triggerShake(intensity) {
  shakeIntensity = Math.max(shakeIntensity, intensity);
}

/**
 * Decae la intensidad del shake. Llamar una vez por frame en el bucle
 * principal antes de renderizar.
 */
export function updateShake(dt) {
  if (shakeIntensity > 0) {
    shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeIntensity *= Math.pow(0.001, dt);
    if (shakeIntensity < 0.3) {
      shakeIntensity = 0;
      shakeX = 0;
      shakeY = 0;
    }
  } else {
    shakeX = 0;
    shakeY = 0;
  }
}

/**
 * Devuelve el offset actual del shake para aplicar con ctx.translate().
 * Uso: ctx.save(); const so = getShakeOffset(); ctx.translate(so.x, so.y);
 */
export function getShakeOffset() {
  return { x: shakeX, y: shakeY };
}

// ──────────────────────────────────────────────
// PARTÍCULAS — Object Pool
// ──────────────────────────────────────────────
const POOL_MAX = 500;
const pool = [];

/**
 * Obtiene una partícula inactiva del pool, o crea una nueva si hace falta.
 */
function allocParticle() {
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i].alive) {
      pool[i].alive = true;
      return pool[i];
    }
  }
  if (pool.length >= POOL_MAX) return null;
  const p = { alive: true };
  pool.push(p);
  return p;
}

/**
 * Genera una explosión de partículas en (x, y).
 * Reutiliza objetos del pool en vez de crear nuevos.
 *
 * @param {number} x       - Coordenada X (lógica del juego, antes de escalar)
 * @param {number} y       - Coordenada Y (lógica del juego)
 * @param {string} color   - Color CSS para las partículas
 * @param {number} count   - Cantidad de partículas (default 10)
 * @param {object} opts    - Opciones: { spd, life, sm, smx, gravity, friction }
 */
export function spawnParticles(x, y, color, count = 10, opts = {}) {
  const { spd = 80, life = 0.35, sm = 1.5, smx = 3 } = opts;
  for (let i = 0; i < count; i++) {
    const p = allocParticle();
    if (!p) break;
    const a = Math.random() * Math.PI * 2;
    const s = spd * (0.4 + Math.random() * 0.6);
    p.x = x;
    p.y = y;
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.life = life + Math.random() * 0.2;
    p.ml = life + 0.2;
    p.color = color;
    p.size = sm + Math.random() * (smx - sm);
    p.friction = opts.friction;
    p.gravity = opts.gravity;
  }
}

/**
 * Actualiza todas las partículas (movimiento, fricción, decaimiento).
 * Marca las muertas como inactivas (sin splice). Llamar una vez por frame.
 */
export function updateParticles(dt) {
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (!p.alive) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const fric = p.friction ?? 0.96;
    if (p.gravity !== undefined) {
      p.vy += p.gravity * dt;
    } else {
      p.vx *= fric;
      p.vy *= fric;
    }
    p.life -= dt;
    if (p.life <= 0) {
      p.alive = false;
    }
  }
}

/**
 * Dibuja todas las partículas activas en el canvas.
 * @param {CanvasRenderingContext2D} ctx - Contexto del canvas
 * @param {number} ox - Offset X de la cancha escalada
 * @param {number} oy - Offset Y de la cancha escalada
 * @param {number} sc - Factor de escala
 */
export function drawParticles(ctx, ox = 0, oy = 0, sc = 1) {
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    if (!p.alive) continue;
    const a = Math.max(0, p.life / p.ml);
    const sx = ox + p.x * sc;
    const sy = oy + p.y * sc;
    const r = p.size * sc;
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a * 0.15;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/**
 * Vacía el pool de partículas. Útil al reiniciar un juego.
 */
export function clearParticles() {
  for (let i = 0; i < pool.length; i++) {
    pool[i].alive = false;
  }
}

// ──────────────────────────────────────────────
// FLASH (destello blanco)
// ──────────────────────────────────────────────
let flashAlpha = 0;

/**
 * Activa un destello blanco en pantalla. La intensidad (0–1) controla
 * la opacidad máxima del flash. Se desvanece en ~0.33s.
 * Útil para explosiones grandes, transiciones de nivel, muerte del jugador.
 */
export function triggerFlash(intensity = 0.5) {
  flashAlpha = Math.max(flashAlpha, Math.min(1, intensity));
}

/**
 * Actualiza el decaimiento del flash. Llamar una vez por frame.
 */
export function updateFlash(dt) {
  if (flashAlpha > 0) {
    flashAlpha -= dt * 3;
    if (flashAlpha < 0) flashAlpha = 0;
  }
}

/**
 * Dibuja el flash (un rectángulo blanco semitransparente sobre toda
 * la pantalla). Llamar después de dibujar el resto de la escena.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w - Ancho del canvas
 * @param {number} h - Alto del canvas
 */
export function drawFlash(ctx, w, h) {
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// ──────────────────────────────────────────────
// ROUND RECT
// ──────────────────────────────────────────────
/**
 * Dibuja un rectángulo con esquinas redondeadas en el contexto del canvas.
 */
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
