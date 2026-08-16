/* ═══════════════════════════════════
   shared/input.js — Entrada compartida
   Gamepad (tracking + resolución del pad
   activo) y táctil (botones hold).
   Mejoras: listeners idempotentes para gamepad
   y unbind retornado por bindHoldButton para cleanup
   ═══════════════════════════════════ */

// Módulo-level state para listeners de gamepad compartidos
let _gamepadListenersInstalled = false;
let _gamepadRefCount = 0;
let _selectedGamepadIndex = null;
let _onGamepadConnected = null;
let _onGamepadDisconnected = null;

/**
 * Crea un tracker de gamepad con resolución del pad activo.
 * Registra los listeners gamepadconnected/disconnected la primera vez
 * y mantiene un recuento de referencias; cuando todas las instancias
 * se destruyen, los listeners se eliminan.
 *
 * @returns {{ pad: Gamepad | null, destroy: () => void }}
 */
export function createGamepad() {
  if (!_gamepadListenersInstalled) {
    _onGamepadConnected = (e) => {
      // Seleccionamos el último gamepad conectado como por defecto
      _selectedGamepadIndex = e.gamepad.index;
    };
    _onGamepadDisconnected = (e) => {
      if (_selectedGamepadIndex === e.gamepad.index) _selectedGamepadIndex = null;
    };
    window.addEventListener('gamepadconnected', _onGamepadConnected);
    window.addEventListener('gamepaddisconnected', _onGamepadDisconnected);
    _gamepadListenersInstalled = true;
  }

  _gamepadRefCount++;

  return {
    /** Devuelve el pad conectado, o el primero disponible (null si no hay). */
    get pad() {
      if (!navigator.getGamepads) return null;
      const pads = navigator.getGamepads();
      return (typeof _selectedGamepadIndex === 'number' ? pads[_selectedGamepadIndex] : null) || pads[0] || null;
    },
    /** Destruye la instancia; cuando quedan 0 referencias se remueven los listeners globales. */
    destroy() {
      _gamepadRefCount = Math.max(0, _gamepadRefCount - 1);
      if (_gamepadRefCount === 0 && _gamepadListenersInstalled) {
        try {
          window.removeEventListener('gamepadconnected', _onGamepadConnected);
          window.removeEventListener('gamepaddisconnected', _onGamepadDisconnected);
        } catch (e) {
          // no-op
        }
        _gamepadListenersInstalled = false;
        _onGamepadConnected = null;
        _onGamepadDisconnected = null;
        _selectedGamepadIndex = null;
      }
    },
  };
}

/**
 * Vincula un botón táctil con feedback visual `.is-pressed`.
 * Acepta el elemento directamente o su id (string).
 * Cubre touch (start/end/cancel) y mouse (down/up/leave).
 *
 * Devuelve una función `unbind()` que elimina los listeners creados y limpia la clase.
 *
 * @param {HTMLElement|string} target - Botón o id del botón (#touchControls)
 * @param {() => void} onDown - Callback al presionar
 * @param {() => void} [onUp] - Callback al soltar (opcional)
 * @returns {() => void} unbind function
 */
export function bindHoldButton(target, onDown, onUp) {
  const btn = typeof target === 'string' ? document.getElementById(target) : target;
  if (!btn) return () => {};

  function handleTouchStart(e) {
    e.preventDefault();
    try {
      onDown();
    } catch (err) {
      // silenciar errores del callback para no romper la UX
      console.warn('bindHoldButton onDown error', err);
    }
    btn.classList.add('is-pressed');
  }
  function handleTouchEnd(e) {
    if (e && e.preventDefault) e.preventDefault();
    try {
      onUp?.();
    } catch (err) {
      console.warn('bindHoldButton onUp error', err);
    }
    btn.classList.remove('is-pressed');
  }
  function handleTouchCancel() {
    try {
      onUp?.();
    } catch (err) {
      console.warn('bindHoldButton onUp error', err);
    }
    btn.classList.remove('is-pressed');
  }
  function handleMouseDown(e) {
    if (e && e.preventDefault) e.preventDefault();
    try {
      onDown();
    } catch (err) {
      console.warn('bindHoldButton onDown error', err);
    }
    // Note: mouse down does not add is-pressed class because :active handles it visually in many CSS setups
  }
  function handleMouseUp() {
    try {
      onUp?.();
    } catch (err) {
      console.warn('bindHoldButton onUp error', err);
    }
  }
  function handleMouseLeave() {
    try {
      onUp?.();
    } catch (err) {
      console.warn('bindHoldButton onUp error', err);
    }
  }

  btn.addEventListener('touchstart', handleTouchStart, { passive: false });
  btn.addEventListener('touchend', handleTouchEnd, { passive: false });
  btn.addEventListener('touchcancel', handleTouchCancel);
  btn.addEventListener('mousedown', handleMouseDown);
  btn.addEventListener('mouseup', handleMouseUp);
  btn.addEventListener('mouseleave', handleMouseLeave);

  // Devuelve función para desenganchar los listeners y limpiar estado visual
  return function unbind() {
    try {
      btn.removeEventListener('touchstart', handleTouchStart, { passive: false });
      btn.removeEventListener('touchend', handleTouchEnd, { passive: false });
    } catch (e) {
      // Algunos navegadores ignoran opciones al remover; intentar sin opciones
      try {
        btn.removeEventListener('touchstart', handleTouchStart);
        btn.removeEventListener('touchend', handleTouchEnd);
      } catch (err) {
        // ignore
      }
    }
    btn.removeEventListener('touchcancel', handleTouchCancel);
    btn.removeEventListener('mousedown', handleMouseDown);
    btn.removeEventListener('mouseup', handleMouseUp);
    btn.removeEventListener('mouseleave', handleMouseLeave);
    btn.classList.remove('is-pressed');
  };
}
