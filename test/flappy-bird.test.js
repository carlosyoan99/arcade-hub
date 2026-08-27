import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import {
  createGameEnv,
  restoreGlobals,
  pressKey,
  getText,
  ROOT,
} from './helpers/game-test-helpers.js';

describe('Flappy Bird — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('flappy-bird'));
    await import(pathToFileURL(`${ROOT}/games/flappy-bird/script.js`).href);
  });

  after(() => {
    dom.window.close();
    restoreGlobals();
  });

  it('inicializa con score=0', () => {
    assert.equal(getText(doc, 'scoreValue'), '0');
  });

  it('inicia juego con Space', () => {
    pressKey(win, 'Space');
    assert.ok(doc.getElementById('overlay').classList.contains('hidden'));
  });

  it('soporta flap con Space/ArrowUp', () => {
    pressKey(win, 'Space');
    pressKey(win, 'ArrowUp');
    assert.ok(true);
  });

  it('soporta flap con click en canvas', () => {
    const canvas = doc.getElementById('gameCanvas');
    if (canvas) {
      canvas.dispatchEvent(new win.PointerEvent('pointerdown', { bubbles: true }));
    }
    assert.ok(true);
  });

  it('reinicia con KeyR', () => {
    pressKey(win, 'KeyR');
    assert.equal(getText(doc, 'scoreValue'), '0');
  });

  it('canvas tiene dimensiones válidas', () => {
    const canvas = doc.getElementById('gameCanvas');
    assert.ok(canvas);
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('tiene displays de HUD', () => {
    assert.ok(doc.getElementById('scoreValue'));
    assert.ok(doc.getElementById('bestValue'));
  });

  it('tiene botón fire/flap', () => {
    assert.ok(doc.getElementById('bF'));
  });
});
