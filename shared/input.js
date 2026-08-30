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
      return (
        (typeof _selectedGamepadIndex === 'number' ? pads[_selectedGamepadIndex] : null) ||
        pads[0] ||
        null
      );
    },
    /** Destruye la instancia; cuando quedan 0 referencias se remueven los listeners globales. */
    destroy() {
      _gamepadRefCount = Math.max(0, _gamepadRefCount - 1);
      if (_gamepadRefCount === 0 && _gamepadListenersInstalled) {
        try {
          window.removeEventListener('gamepadconnected', _onGamepadConnected);
          window.removeEventListener('gamepaddisconnected', _onGamepadDisconnected);
        } catch {
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

  /** Ejecuta un callback sin que un error rompa la UX. */
  function safeCall(fn, ...args) {
    try {
      fn?.(...args);
    } catch (err) {
      /* eslint-disable no-console */
      console.warn('bindHoldButton callback error', err);
      /* eslint-enable no-console */
    }
  }

  function handleTouchStart(e) {
    e.preventDefault();
    safeCall(onDown);
    btn.classList.add('is-pressed');
  }
  function handleTouchEnd(e) {
    if (e && e.preventDefault) e.preventDefault();
    safeCall(onUp);
    btn.classList.remove('is-pressed');
  }
  function handleTouchCancel() {
    safeCall(onUp);
    btn.classList.remove('is-pressed');
  }
  function handleMouseDown(e) {
    if (e && e.preventDefault) e.preventDefault();
    safeCall(onDown);
    // Note: mouse down does not add is-pressed class because :active handles it visually in many CSS setups
  }
  function handleMouseUp() {
    safeCall(onUp);
  }
  const handleMouseLeave = handleMouseUp;

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
    } catch {
      // Algunos navegadores ignoran opciones al remover; intentar sin opciones
      try {
        btn.removeEventListener('touchstart', handleTouchStart);
        btn.removeEventListener('touchend', handleTouchEnd);
      } catch {
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

/* ═══════════════════════════════════════════════════════════════
   Auto-cleanup event listener helpers
   ═══════════════════════════════════════════════════════════════
   Register listeners through these helpers instead of raw
   addEventListener(). All registered listeners are automatically
   removed when cleanupAll() is called (typically via
   shell.onCleanup()).
   ═══════════════════════════════════════════════════════════════ */

const _autoListeners = [];

/**
 * Register a keydown handler on window. Auto-removed on cleanupAll().
 * @param {function} handler
 * @param {AddEventListenerOptions|boolean} [options]
 */
export function onKey(handler, options) {
  window.addEventListener('keydown', handler, options);
  _autoListeners.push({ target: window, type: 'keydown', handler, options });
}

/**
 * Register a keyup handler on window. Auto-removed on cleanupAll().
 * @param {function} handler
 * @param {AddEventListenerOptions|boolean} [options]
 */
export function onKeyup(handler, options) {
  window.addEventListener('keyup', handler, options);
  _autoListeners.push({ target: window, type: 'keyup', handler, options });
}

/**
 * Register a touchstart handler on an element. Auto-removed on cleanupAll().
 * @param {EventTarget} el
 * @param {function} handler
 * @param {AddEventListenerOptions|boolean} [options]
 */
export function onTouchStart(el, handler, options) {
  el.addEventListener('touchstart', handler, options);
  _autoListeners.push({ target: el, type: 'touchstart', handler, options });
}

/**
 * Register a touchend handler on an element. Auto-removed on cleanupAll().
 * @param {EventTarget} el
 * @param {function} handler
 * @param {AddEventListenerOptions|boolean} [options]
 */
export function onTouchEnd(el, handler, options) {
  el.addEventListener('touchend', handler, options);
  _autoListeners.push({ target: el, type: 'touchend', handler, options });
}

/**
 * Register a touchcancel handler on an element. Auto-removed on cleanupAll().
 * @param {EventTarget} el
 * @param {function} handler
 * @param {AddEventListenerOptions|boolean} [options]
 */
export function onTouchCancel(el, handler, options) {
  el.addEventListener('touchcancel', handler, options);
  _autoListeners.push({ target: el, type: 'touchcancel', handler, options });
}

/**
 * Register a mousedown handler on an element. Auto-removed on cleanupAll().
 * @param {EventTarget} el
 * @param {function} handler
 * @param {AddEventListenerOptions|boolean} [options]
 */
export function onMouseDown(el, handler, options) {
  el.addEventListener('mousedown', handler, options);
  _autoListeners.push({ target: el, type: 'mousedown', handler, options });
}

/**
 * Register a click handler on an element. Auto-removed on cleanupAll().
 * @param {EventTarget} el
 * @param {function} handler
 * @param {AddEventListenerOptions|boolean} [options]
 */
export function onClick(el, handler, options) {
  el.addEventListener('click', handler, options);
  _autoListeners.push({ target: el, type: 'click', handler, options });
}

/**
 * Remove all listeners registered through onKey/onKeyup/etc.
 * Safe to call multiple times — second call is a no-op.
 */
export function cleanupAll() {
  for (const { target, type, handler, options } of _autoListeners) {
    try {
      target.removeEventListener(type, handler, options);
    } catch {
      /* target may have been removed from DOM */
    }
  }
  _autoListeners.length = 0;
}
