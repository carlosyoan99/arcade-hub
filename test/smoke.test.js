/**
 * Smoke tests del Arcade Hub — test/smoke.test.js
 *
 * Para cada juego del manifiesto:
 *   1. Carga su index.html en jsdom (DOM real con #gameCanvas, #overlay, etc.)
 *   2. Mockea getContext('2d') con un Proxy no-op (chainable)
 *   3. Copia window/document/navigator/localStorage a los globals de Node
 *   4. Mockea requestAnimationFrame a no-op (el game loop no corre)
 *   5. Importa dinámicamente el script.js del juego
 *
 * Detección de regresiones comunes: imports rotos, null sin chequear,
 * referencias a globals inexistentes, errores en init.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { games } from '../games.js';

// Guarda de los globals originales de Node (para restaurarlos tras los tests)
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

/**
 * Asigna un global que puede ser getter-only en Node (ej. navigator).
 * Node 22 define navigator como getter sin setter en globalThis.
 */
function setGlobal(name, value) {
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

/** Proxy no-op chainable para el contexto 2D (cualquier método/propiedad). */
function createCtxProxy() {
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

/** AudioContext fake (por si un juego toca audio al inicializar). */
class FakeAudioContext {
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

function makeMatchMedia() {
  return () => ({
    matches: false,
    media: '(prefers-reduced-motion: reduce)',
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });
}

for (const g of games) {
  test(`smoke: ${g.id} carga sin error y tiene canvas`, async () => {
    const htmlPath = path.join(ROOT, 'games', g.id, 'index.html');
    assert.ok(fs.existsSync(htmlPath), `index.html existe`);

    const html = fs.readFileSync(htmlPath, 'utf8');
    const dom = new JSDOM(html, {
      url: `http://localhost/games/${g.id}/index.html`,
      runScripts: 'outside-only',
    });
    const { window } = dom;

    // Mock de canvas 2D
    window.HTMLCanvasElement.prototype.getContext = () => createCtxProxy();

    // Mock de matchMedia en el window (effects.js llama window.matchMedia en su
    // initAccessibility — la versión de jsdom instalada no lo implementa).
    window.matchMedia = makeMatchMedia();

    // Globals del browser → Node (usa defineProperty para getter-only como navigator)
    setGlobal('window', window);
    setGlobal('document', window.document);
    setGlobal('navigator', window.navigator);
    setGlobal('localStorage', window.localStorage);
    // NO se sobreescribe performance: el Performance de jsdom delega al global
    // `performance` → asignarlo causaría recursión infinita. Node tiene su
    // propio performance.now() nativo que los juegos usan (hit-stop, etc.).
    setGlobal('matchMedia', makeMatchMedia());
    setGlobal('requestAnimationFrame', () => 1);
    setGlobal('cancelAnimationFrame', () => {});
    setGlobal('AudioContext', FakeAudioContext);
    setGlobal('webkitAudioContext', FakeAudioContext);

    // Import del script del juego (módulo ES real)
    const scriptUrl = pathToFileURL(path.join(ROOT, 'games', g.id, 'script.js')).href;
    await import(scriptUrl);

    // El canvas debe existir y haberse inicializado
    const canvas = window.document.getElementById('gameCanvas');
    assert.ok(canvas, '#gameCanvas existe');

    // El overlay de inicio debe existir (estructura base inyectada)
    const overlay = window.document.getElementById('overlay');
    assert.ok(overlay, '#overlay existe');

    // El botón de ayuda debe estar presente (dom.js lo inyecta)
    const helpBtn = window.document.getElementById('helpBtn');
    assert.ok(helpBtn, '#helpBtn existe');

    // Libera la ventana jsdom (evita acumular 19 windows abiertos en el proceso)
    dom.window.close();
  });
}

// Restaura los globals originales de Node (evita contaminación entre archivos de test)
after(() => {
  for (const [name, value] of Object.entries(ORIGINAL_GLOBALS)) {
    setGlobal(name, value);
  }
});
