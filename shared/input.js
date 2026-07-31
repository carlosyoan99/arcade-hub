/* ═══════════════════════════════════
   shared/input.js — Entrada compartida
   Gamepad (tracking + resolución del pad
   activo) y táctil (botones hold).
   ═══════════════════════════════════ */

/**
 * Crea un tracker de gamepad con resolución del pad activo.
 * Registra los listeners gamepadconnected/disconnected internamente.
 *
 * Uso típico en pollGamepad() de cada juego:
 *   const gp = gamepad.pad;
 *   if (!gp) return;
 *   // ...mapping de ejes y botones específico del juego
 *
 * @returns {{ pad: Gamepad | null }}
 */
export function createGamepad() {
  let index = null;
  window.addEventListener('gamepadconnected', (e) => {
    index = e.gamepad.index;
  });
  window.addEventListener('gamepaddisconnected', (e) => {
    if (index === e.gamepad.index) index = null;
  });
  return {
    /** Devuelve el pad conectado, o el primero disponible (null si no hay). */
    get pad() {
      if (!navigator.getGamepads) return null;
      const pads = navigator.getGamepads();
      return (index !== null ? pads[index] : null) || pads[0] || null;
    },
  };
}

/**
 * Vincula un botón táctil con feedback visual `.is-pressed`.
 * Acepta el elemento directamente o su id (string).
 * Cubre touch (start/end/cancel) y mouse (down/up/leave).
 *
 * @param {HTMLElement|string} target - Botón o id del botón (#touchControls)
 * @param {() => void} onDown - Callback al presionar
 * @param {() => void} [onUp] - Callback al soltar (opcional)
 */
export function bindHoldButton(target, onDown, onUp) {
  const btn = typeof target === 'string' ? document.getElementById(target) : target;
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
      onUp?.();
      btn.classList.remove('is-pressed');
    },
    { passive: false },
  );
  btn.addEventListener('touchcancel', () => {
    onUp?.();
    btn.classList.remove('is-pressed');
  });
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onDown();
  });
  btn.addEventListener('mouseup', () => {
    onUp?.();
  });
  btn.addEventListener('mouseleave', () => {
    onUp?.();
  });
}
