/* ═══════════════════════════════════════════════
   shared/effects.js — Efectos visuales compartidos
   Screen shake, partículas, flash, roundRect.
   ═══════════════════════════════════════════════ */

// ──────────────────────────────────────────────
// SCREEN SHAKE — modelo de trauma (suave, sin random por frame)
// ──────────────────────────────────────────────
// trauma 0..1, shake = trauma^2 * max_offset * sin(t), decay lineal.
// No usa Math.random() por frame — evita el "buzz" estático.

let _trauma = 0;
let _shakeTime = 0;
let _shakeScale = 1; // ← para accesibilidad (reduce-shake)
let _particleScale = 1; // ← para accesibilidad (reduce-motion): escala global de partículas

const MAX_OFFSET_X = 12;
const MAX_OFFSET_Y = 8;
const DECAY_RATE = 1.3; // trauma perdido por segundo

/**
 * Activa un screen shake con modelo de trauma (suave, auto-decreciente).
 * La intensidad se ACUMULA (no se reemplaza).
 * Normaliza valores legacy (~1-8) al rango trauma [0,1].
 * @param {number} intensity - 0..1 ideal (0.15=leve, 0.4=medio, 0.8=fuerte).
 *   También acepta valores legacy ~1-8 (se normalizan automáticamente).
 */
export function triggerShake(intensity) {
  // Normalizar: valores legacy ~1-8 → trauma [0,1]; valores <1 se usan directo
  const normalized = intensity <= 1 ? intensity : intensity * 0.12;
  _trauma = Math.min(1, _trauma + normalized);
}

/**
 * Actualiza el trauma y genera offset suave con ondas sinusoidales.
 * Llamar una vez por frame antes de renderizar.
 */
export function updateShake(dt) {
  if (_trauma <= 0) return;
  _trauma = Math.max(0, _trauma - DECAY_RATE * dt);
  _shakeTime += dt * 30;
  const shake = _trauma * _trauma * _shakeScale; // quadratic: golpes leves apenas se sienten
  // Ondas sinusoidales a frecuencias inconmensurables — suaves, no estáticas
  const _shakeX = MAX_OFFSET_X * shake * Math.sin(_shakeTime * 1.7);
  const _shakeY = MAX_OFFSET_Y * shake * Math.sin(_shakeTime * 2.3);
  return { x: _shakeX, y: _shakeY };
}

/**
 * Devuelve el offset actual del shake para aplicar con ctx.translate().
 * Uso: ctx.save(); const so = getShakeOffset(); ctx.translate(so.x, so.y);
 */
export function getShakeOffset() {
  if (_trauma <= 0) return { x: 0, y: 0 };
  const shake = _trauma * _trauma * _shakeScale;
  return {
    x: MAX_OFFSET_X * shake * Math.sin(_shakeTime * 1.7),
    y: MAX_OFFSET_Y * shake * Math.sin(_shakeTime * 2.3),
  };
}

/**
 * Escala global del screen shake (para accesibilidad).
 * @param {number} scale - 0 (sin shake) a 1 (100%)
 */
export function setShakeScale(scale) {
  _shakeScale = Math.max(0, Math.min(1, scale));
}

/**
 * Escala global de partículas (para accesibilidad prefers-reduced-motion).
 * @param {number} scale - 0 (sin partículas) a 1 (100%)
 */
export function setParticlesScale(scale) {
  _particleScale = Math.max(0, Math.min(1, scale));
}

// ──────────────────────────────────────────────
// HIT-STOP / FREEZE FRAME
// ──────────────────────────────────────────────
// Congela el juego por N ms (tiempo real) para "vender" impacto.
// NO usa random ni bloquea el event loop.

let _hitStopUntil = 0;

/**
 * Activa un freeze frame (hit-stop) con duración en tiempo real.
 * @param {number} duration - Segundos de pausa (0.04=leve, 0.08=medio, 0.15=fuerte)
 */
export function hitStop(duration = 0.08) {
  const end = performance.now() + duration * 1000;
  if (end > _hitStopUntil) _hitStopUntil = end;
}

/**
 * Verifica si el juego está congelado por hit-stop.
 * Si lo está, el bucle principal debe SALTAR el update() pero seguir renderizando.
 */
export function isHitStopped() {
  return performance.now() < _hitStopUntil;
}

// ──────────────────────────────────────────────
// FEEDBACK BUNDLE — jugosidad por tiers
// ──────────────────────────────────────────────
// Combina shake + hit-stop + partículas + flash + sonido en una llamada.
// Cada juego decide qué tier usar para cada evento.

/**
 * Dispara un bundle completo de feedback según el tier.
 *
 * @param {'small'|'medium'|'large'} tier
 * @param {number} x - Coordenada X para partículas
 * @param {number} y - Coordenada Y para partículas
 * @param {object} [opts]
 * @param {string} [opts.color='#ffffff'] - Color de partículas
 * @param {function} [opts.onBeep] - Callback para sonido: onBeep(freq, duration, type, volume)
 * @param {boolean} [opts.noFlash] - Omitir destello blanco incluso en tier large
 */
export function feedbackBundle(tier, x, y, opts = {}) {
  const { color = '#ffffff', onBeep, noFlash } = opts;

  switch (tier) {
    case 'small':
      triggerShake(0.15);
      spawnParticles(x, y, color, 4, { spd: 40, life: 0.2, sm: 1, smx: 2 });
      if (onBeep) onBeep(660, 0.06, 'square', 0.04);
      break;

    case 'medium':
      triggerShake(0.4);
      hitStop(0.05);
      spawnParticles(x, y, color, 10, { spd: 70, life: 0.3, sm: 1.5, smx: 3 });
      if (onBeep) onBeep(400, 0.08, 'sawtooth', 0.1);
      break;

    case 'large':
      triggerShake(0.8);
      hitStop(0.12);
      spawnParticles(x, y, color, 24, { spd: 120, life: 0.45, sm: 2, smx: 5 });
      if (!noFlash) triggerFlash(0.3);
      if (onBeep) onBeep(120, 0.15, 'sawtooth', 0.15);
      break;
  }
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
  const scaled = Math.max(0, Math.round(count * _particleScale));
  for (let i = 0; i < scaled; i++) {
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
// DRAW GLOW — glow sin shadowBlur
// ──────────────────────────────────────────────

/**
 * Dibuja un glow translúcido sin usar ctx.shadowBlur.
 * Técnica: círculo sólido + círculo 3x más grande con alpha bajo.
 * Misma técnica que usa drawParticles() para sus glows.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Centro X
 * @param {number} y - Centro Y
 * @param {number} r - Radio del círculo base
 * @param {string} color - Color CSS
 * @param {number} [glowAlpha=0.15] - Opacidad del círculo de glow (0-1)
 * @param {number} [glowMultiplier=3] - Tamaño del glow relativo al radio base
 */
export function drawGlow(ctx, x, y, r, color, glowAlpha = 0.15, glowMultiplier = 3) {
  // Círculo sólido principal
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // Glow translúcido (más grande, semitransparente)
  ctx.globalAlpha = glowAlpha;
  ctx.beginPath();
  ctx.arc(x, y, r * glowMultiplier, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ──────────────────────────────────────────────
// SQUASH & STRETCH — tween con overshoot
// ──────────────────────────────────────────────
// Sistema de animación de escala con overshoot (TRANS_BACK-like).
// Cada entidad puede tener un squash activo que decae en el tiempo.

const _squashItems = [];
const SQUASH_POOL_MAX = 100;

/**
 * Activa un squash & stretch en una posición.
 * @param {number} duration - Duración total en segundos (0.15-0.3 típico)
 * @param {number} scaleX - Escala horizontal objetivo inicial (ej: 1.3)
 * @param {number} scaleY - Escala vertical objetivo inicial (ej: 0.7)
 * @param {number} [overshoot=0.3] - Factor de overshoot al recuperar (0=sin overshoot)
 * @returns {number} Índice del squash (para tracking)
 */
export function triggerSquash(duration = 0.2, scaleX = 1.3, scaleY = 0.7, overshoot = 0.3) {
  for (let i = 0; i < _squashItems.length; i++) {
    if (!_squashItems[i].alive) {
      _squashItems[i].alive = true;
      _squashItems[i].timer = 0;
      _squashItems[i].duration = duration;
      _squashItems[i].startSX = scaleX;
      _squashItems[i].startSY = scaleY;
      _squashItems[i].overshoot = overshoot;
      _squashItems[i].done = false;
      return i;
    }
  }
  if (_squashItems.length >= SQUASH_POOL_MAX) return -1;
  const idx = _squashItems.length;
  _squashItems.push({
    alive: true,
    timer: 0,
    duration,
    startSX: scaleX,
    startSY: scaleY,
    overshoot,
    done: false,
  });
  return idx;
}

/**
 * Actualiza todos los squashes activos. Llamar una vez por frame.
 */
export function updateSquashes(dt) {
  for (let i = 0; i < _squashItems.length; i++) {
    const s = _squashItems[i];
    if (!s.alive) continue;
    s.timer += dt;
    if (s.timer >= s.duration) {
      s.alive = false;
      s.done = true;
    }
  }
}

/**
 * Obtiene la escala actual de un squash por su índice.
 * @param {number} index - Índice devuelto por triggerSquash()
 * @returns {{sx: number, sy: number} | null}
 */
export function getSquash(index) {
  if (index < 0 || index >= _squashItems.length) return null;
  const s = _squashItems[index];
  if (!s.alive) return null;
  const t = s.timer / s.duration; // 0..1
  // Ease-out con overshoot: back = 1 + overshoot * (1-t)^2 * t
  const back = 1 + s.overshoot * (1 - t * t) * (1 - t);
  const sx = 1 + (s.startSX - 1) * (1 - t) * back;
  const sy = 1 + (s.startSY - 1) * (1 - t) * back;
  return { sx, sy };
}

/**
 * Helper rápido: dibuja un círculo/arc con squash aplicado en ctx.
 * Aplica transform de escala centrada en (x, y) para el draw.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x - Centro X
 * @param {number} y - Centro Y
 * @param {number} r - Radio base
 * @param {number} squashIndex - Índice del squash activo
 * @param {function} drawFn - Función que dibuja (recibe ctx, radio escalado)
 */
export function drawWithSquash(ctx, x, y, r, squashIndex, drawFn) {
  const sq = getSquash(squashIndex);
  if (sq && (sq.sx !== 1 || sq.sy !== 1)) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sq.sx, sq.sy);
    ctx.translate(-x, -y);
    drawFn(ctx, r);
    ctx.restore();
  } else {
    drawFn(ctx, r);
  }
}

/**
 * Limpia todos los squashes activos (útil al reiniciar).
 */
export function clearSquashes() {
  for (let i = 0; i < _squashItems.length; i++) {
    _squashItems[i].alive = false;
  }
}

// ── AUTO-INIT: preferencias de accesibilidad (G6) ──
// Respeta prefers-reduced-motion del sistema al cargar
(function initAccessibility() {
  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mql.matches) {
    setShakeScale(0);
    setParticlesScale(0);
  }
  mql.addEventListener('change', (e) => {
    setShakeScale(e.matches ? 0 : 1);
    setParticlesScale(e.matches ? 0 : 1);
  });
})();

// ──────────────────────────────────────────────
// GLOW SIN SHADOWBLUR — helpers para relleno y trazo
// ──────────────────────────────────────────────
// Técnica: halo = mismo path dibujado con trazo grueso translúcido
// (o círculo 3x) debajo del elemento sólido. Sin ctx.shadowBlur.

/**
 * Rellena un path con halo translúcido alrededor (sin shadowBlur).
 * Dibuja el path 1) con trazo grueso y alpha bajo (halo) y 2) relleno sólido.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {function} pathFn - Callback que construye el path (debe incluir beginPath)
 * @param {string} fillColor - Color del relleno sólido
 * @param {number} [glowAlpha=0.35] - Opacidad del halo (0-1)
 * @param {number} [glowWidth=6] - Grosor del halo en px (ya escalado)
 * @param {string} [glowColor] - Color del halo (default: fillColor)
 */
export function fillWithGlow(ctx, pathFn, fillColor, glowAlpha = 0.35, glowWidth = 6, glowColor) {
  ctx.globalAlpha = glowAlpha;
  ctx.strokeStyle = glowColor || fillColor;
  ctx.lineWidth = glowWidth;
  ctx.lineJoin = 'round';
  pathFn(ctx);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = fillColor;
  pathFn(ctx);
  ctx.fill();
}

/**
 * Traza un path con halo translúcido (sin shadowBlur).
 * Dibuja 1) trazo grueso con alpha bajo (halo) y 2) trazo fino sólido.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {function} pathFn - Callback que construye el path (debe incluir beginPath)
 * @param {string} strokeColor - Color del trazo principal
 * @param {number} lineWidth - Grosor del trazo principal en px (ya escalado)
 * @param {number} [glowAlpha=0.4] - Opacidad del halo (0-1)
 * @param {number} [glowWidthMult=3] - Multiplicador del grosor del halo
 */
export function strokeWithGlow(
  ctx,
  pathFn,
  strokeColor,
  lineWidth,
  glowAlpha = 0.4,
  glowWidthMult = 3,
) {
  ctx.globalAlpha = glowAlpha;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth * glowWidthMult;
  ctx.lineJoin = 'round';
  pathFn(ctx);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  pathFn(ctx);
  ctx.stroke();
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
