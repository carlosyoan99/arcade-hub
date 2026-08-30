/**
 * Verificación de lógica de gameplay (nivel 1): HUD numérico en vivo.
 *
 * Extiende gameplay-frames.test.js (que solo pedía "no excepciones"): al
 * arrancar y tras decenas de frames de gameplay, los marcadores numéricos del
 * HUD deben contener valores parseables (scores, niveles, tiempos, bombas).
 * `livesValue` se excluye del parseo numérico porque muchos juegos muestran
 * iconos (p. ej. "●●●") en lugar de un número.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createGameEnv,
  createRafStepper,
  restoreGlobals,
  pressKey,
  clickOverlay,
  getText,
} from './helpers/game-test-helpers.js';
import { games } from '../games.js';

const ATTRACT_FRAMES = 3;
const GAMEPLAY_FRAMES = 40;

// Marcadores que, cuando existen, SIEMPRE deben ser numéricos.
const NUMERIC_IDS = ['scoreValue', 'levelValue', 'timeValue', 'bombsValue'];
// Vidas: casi siempre van como iconos (●●●), solo exigimos que existan.
const ICON_IDS = ['livesValue'];

after(() => restoreGlobals());

const parseHud = (doc) => {
  const numeric = {};
  for (const id of NUMERIC_IDS) {
    const text = getText(doc, id)?.trim() ?? '';
    if (text !== '') numeric[id] = text;
  }
  const icons = {};
  for (const id of ICON_IDS) {
    const text = getText(doc, id)?.trim() ?? '';
    if (text !== '') icons[id] = text;
  }
  return { numeric, icons };
};

const assertNumericHud = (doc, label) => {
  const { numeric, icons } = parseHud(doc);
  for (const [id, text] of Object.entries(numeric)) {
    assert.match(text, /^-?\d+(\.\d+)?$/, `${label}: ${id} debe ser numérico, se obtuvo '${text}'`);
    assert.ok(Number(text) >= 0, `${label}: ${id} no puede ser negativo ('${text}')`);
  }
  for (const [id, text] of Object.entries(icons)) {
    assert.ok(text.length > 0, `${label}: ${id} no puede estar vacío`);
  }
};

for (const g of games) {
  test(`logica-hud: ${g.id} muestra marcadores válidos en vivo`, async (t) => {
    const stepper = createRafStepper();
    const { dom, window: win, document: doc } = createGameEnv(g.id);
    t.after(() => {
      try {
        win.dispatchEvent(new win.Event('beforeunload'));
      } catch {
        /* cleanup best-effort en los tests */
      }
      dom.window.close();
    });

    const { raf, caf } = stepper;
    win.requestAnimationFrame = raf;
    win.cancelAnimationFrame = caf;
    globalThis.requestAnimationFrame = raf;
    globalThis.cancelAnimationFrame = caf;

    const moduleUrl = new URL(`../games/${g.id}/script.js`, import.meta.url).href;
    await import(moduleUrl);

    const runFrames = (n, action) => {
      for (let i = 0; i < n; i++) {
        if (action) action(i);
        stepper.step();
      }
    };
    const firstErrors = () => stepper.errors.slice(0, 3).map((e) => String(e.message ?? e));

    // Atract screen: draw() sobre el mundo aún vacío.
    runFrames(ATTRACT_FRAMES);
    assert.deepEqual(
      stepper.errors,
      [],
      `${g.id}: draw() crasheó en el atract screen ${JSON.stringify(firstErrors())}`,
    );

    // Arranque estándar (Space → Enter → click → R).
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

    // Marcadores válidos justo tras arrancar.
    assertNumericHud(doc, `${g.id} tras arrancar`);

    // Gameplay: frames de update+draw con entrada variada.
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

    // Marcadores SÍGUEN siendo válidos tras el gameplay (score/tiempo/nivel).
    assertNumericHud(doc, `${g.id} tras gameplay`);
  });
}
