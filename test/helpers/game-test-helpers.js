/**
 * Shared test helpers for Arcade Hub game mechanic tests.
 *
 * Provides jsdom setup, canvas mocking, and input simulation utilities
 * for testing game mechanics in a Node.js environment.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '..', '..');

const ORIGINAL_GLOBALS = {
  window: globalThis.window,
  document: globalThis.document,
  navigator: globalThis.navigator,
  localStorage: globalThis.localStorage,
  matchMedia: globalThis.matchMedia,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  cancelAnimationFrame: globalThis.cancelAnimationFrame,
  AudioContext: globalThis.AudioContext,
  webkitAudioContext: globalThis.webkitAudioContext,
};

export function setGlobal(name, value) {
  try {
    globalThis[name] = value;
  } catch {
    Object.defineProperty(globalThis, name, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
}

export function createCtxProxy() {
  const makeProxy = () =>
    new Proxy(function () {}, {
      get: (target, prop) => {
        if (prop === Symbol.toPrimitive) return () => 0;
        return makeProxy();
      },
      apply: () => makeProxy(),
      set: () => true,
      has: () => true,
    });
  return makeProxy();
}

export class FakeAudioContext {
  constructor() {
    this.destination = {};
    this.currentTime = 0;
  }
  createGain() {
    return { connect: () => {}, gain: { setValueAtTime: () => {}, value: 1 } };
  }
  createOscillator() {
    return {
      connect: () => {},
      start: () => {},
      stop: () => {},
      frequency: { setValueAtTime: () => {}, value: 440 },
      type: 'sine',
    };
  }
  createBuffer() {
    return { duration: 0 };
  }
}

export function makeMatchMedia() {
  return () => ({
    matches: false,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
}

/**
 * Create a jsdom environment with all necessary mocks for a game.
 * Returns { dom, window, document } and sets up global state.
 */
export function createGameEnv(gameId) {
  const htmlPath = path.join(ROOT, 'games', gameId, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const dom = new JSDOM(html, {
    url: `http://localhost/games/${gameId}/index.html`,
    runScripts: 'outside-only',
  });
  const { window } = dom;

  window.HTMLCanvasElement.prototype.getContext = () => createCtxProxy();
  window.matchMedia = makeMatchMedia();

  setGlobal('window', window);
  setGlobal('document', window.document);
  setGlobal('navigator', window.navigator);
  setGlobal('localStorage', window.localStorage);
  setGlobal('matchMedia', makeMatchMedia());
  setGlobal('requestAnimationFrame', () => 1);
  setGlobal('cancelAnimationFrame', () => {});
  setGlobal('AudioContext', FakeAudioContext);
  setGlobal('webkitAudioContext', FakeAudioContext);

  return { dom, window, document: window.document };
}

/**
 * Restore original Node globals after tests complete.
 */
export function restoreGlobals() {
  for (const [name, value] of Object.entries(ORIGINAL_GLOBALS)) {
    // Skip undefined originals — game loops may still reference window/document
    // asynchronously after the test ends, so don't wipe them back to undefined.
    if (value === undefined) continue;
    setGlobal(name, value);
  }
  // Keep AudioContext/webkitAudioContext available — game loops started by
  // startGame() may still be ticking and need them for sounds.
  if (!globalThis.AudioContext) setGlobal('AudioContext', FakeAudioContext);
  if (!globalThis.webkitAudioContext) setGlobal('webkitAudioContext', FakeAudioContext);
}

/**
 * Dispatch a keyboard event on the window.
 */
export function pressKey(window, code) {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code, bubbles: true }));
}

/**
 * Dispatch a keyboard up event on the window.
 */
export function releaseKey(window, code) {
  window.dispatchEvent(new window.KeyboardEvent('keyup', { code, bubbles: true }));
}

/**
 * Simulate holding a key for a duration (dispatches down then up).
 */
export function holdKey(window, code, _duration = 50) {
  pressKey(window, code);
  releaseKey(window, code);
}

/**
 * Simulate clicking the overlay to start the game.
 */
export function clickOverlay(window) {
  const overlay = window.document.getElementById('overlay');
  if (overlay) overlay.click();
}

/**
 * Get the text content of an element by ID.
 */
export function getText(document, id) {
  const el = document.getElementById(id);
  return el ? el.textContent : null;
}

/**
 * Check if an element has a CSS class.
 */
export function hasClass(document, id, className) {
  const el = document.getElementById(id);
  return el ? el.classList.contains(className) : false;
}

/**
 * Stepper de requestAnimationFrame controlable.
 *
 * Permite avanzar el game loop frame a frame en jsdom: cada `step()` ejecuta
 * todos los callbacks de rAF pendientes con un `performance.now()` simulado,
 * tal como los correría el navegador. Las excepciones que un juego arroje
 * dentro de su tick (por ejemplo en `update`/`draw`) quedan capturadas en
 * `errors` en lugar de tumbar el proceso.
 */
export function createRafStepper() {
  const queue = new Map();
  const errors = [];
  let nextId = 1;
  let now = 0;
  function raf(cb) {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  }
  function caf(id) {
    queue.delete(id);
  }
  function step(stepMs = 16.67) {
    now += stepMs;
    const cbs = [...queue.values()];
    queue.clear();
    for (const cb of cbs) {
      try {
        cb(now);
      } catch (err) {
        errors.push(err);
      }
    }
    return errors;
  }
  return {
    raf,
    caf,
    step,
    get errors() {
      return errors;
    },
    get now() {
      return now;
    },
  };
}
