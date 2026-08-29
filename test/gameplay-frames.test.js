/**
 * Prueba de ejecución del loop real para todos los juegos del manifiesto.
 *
 * A diferencia de los smoke tests (que dejan `requestAnimationFrame` en no-op y
 * solo verifican el arranque), este test AVANZA los frames del game loop como
 * lo haría el navegador:
 *
 *   1. Atract screen: unos frames con el juego sin arrancar (ejercita `draw()`
 *      sobre el mundo todavía vacío — la clase de bug que congelaba los juegos).
 *   2. Arranque: Space / Enter / click en el overlay.
 *   3. Gameplay: decenas de frames de update+draw con inputs por teclado.
 *
 * Cualquier excepción lanzada dentro de un tick queda capturada y hace fallar
 * el test. El loop es irradiado por createRafStepper (rAF controlado).
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameEnv,
  createRafStepper,
  restoreGlobals,
  pressKey,
  clickOverlay,
} from './helpers/game-test-helpers.js';
import { games } from '../games.js';

const ATTRACT_FRAMES = 3;
const GAMEPLAY_FRAMES = 40;

after(() => restoreGlobals());

for (const g of games) {
  test(`frames: ${g.id} corre el loop real sin excepciones`, async (t) => {
    const stepper = createRafStepper();
    const { dom, window: win, document: doc } = createGameEnv(g.id);
    t.after(() => {
      // El shell registra cleanup en beforeunload/pagehide (stopMusic cierra el
      // setInterval del tema, loop.stop cancela el rAF). Sin esto, el intervalo
      // de música mantendría vivo el event loop y colgaría el runner de test.
      try {
        win.dispatchEvent(new win.Event('beforeunload'));
      } catch {
        /* el cleanup es best-effort en los tests */
      }
      dom.window.close();
    });

    // rAF controlado, tanto en el global como en el window jsdom.
    const { raf, caf } = stepper;
    win.requestAnimationFrame = raf;
    win.cancelAnimationFrame = caf;
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = caf;

    // Import módulo ES real (loop.start() se ejecuta al evaluar el módulo).
    const moduleUrl = new URL(`../games/${g.id}/script.js`, import.meta.url).href;
    await import(moduleUrl);

    const runFrames = (n, action) => {
      for (let i = 0; i < n; i++) {
        if (action) action(i);
        stepper.step();
      }
    };
    const firstErrors = () => stepper.errors.slice(0, 3).map((e) => String(e.message ?? e));

    // 1) Atract screen: draw() sobre el mundo aún vacío/semilla inicial.
    runFrames(ATTRACT_FRAMES);
    assert.deepEqual(
      stepper.errors,
      [],
      `${g.id}: draw() crasheó en el atract screen ${JSON.stringify(firstErrors())}`,
    );

    // 2) Arranque: Space → Enter → click en overlay → R (el binding varía por
    //    juego; algunos ocultan el overlay con classList `hidden`, otros con
    //    `style.display = 'none'`).
    const overlayEl = doc.getElementById('overlay');
    const started = () => {
      if (!overlayEl) return true;
      return overlayEl.classList.contains('hidden') || overlayEl.style.display === 'none';
    };
    pressKey(win, 'Space');
    runFrames(4);
    if (!started()) {
      pressKey(win, 'Enter');
      runFrames(4);
    }
    if (!started()) {
      clickOverlay(win);
      runFrames(4);
    }
    if (!started()) {
      pressKey(win, 'KeyR');
      runFrames(4);
    }
    assert.ok(started(), `${g.id}: el overlay no se ocultó tras arrancar`);

    // 3) Gameplay: frames de update+draw con entrada variada por teclado.
    const inputBatch1 = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
    const inputBatch2 = ['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'KeyP', 'KeyP'];
    runFrames(GAMEPLAY_FRAMES, () => {});
    for (const code of inputBatch1) pressKey(win, code);
    runFrames(GAMEPLAY_FRAMES);
    for (const code of inputBatch2) pressKey(win, code);
    runFrames(GAMEPLAY_FRAMES);

    assert.deepEqual(
      stepper.errors,
      [],
      `${g.id}: excepciones en el loop real ${JSON.stringify(firstErrors())}`,
    );

    // El canvas sigue vivo y con dimensiones válidas.
    const canvas = doc.getElementById('gameCanvas');
    assert.ok(canvas, `${g.id}: #gameCanvas sigue presente`);
    assert.ok(canvas.width > 0 && canvas.height > 0, `${g.id}: canvas inicializado`);
  });
}