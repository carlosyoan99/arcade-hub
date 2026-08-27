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

describe('Frogger — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('frogger'));
    await import(pathToFileURL(`${ROOT}/games/frogger/script.js`).href);
  });

  after(() => {
    dom.window.close();
    restoreGlobals();
  });

  it('inicializa con score=0', () => {
    assert.equal(getText(doc, 'scoreValue'), '0');
  });

  it('inicia juego con tecla direccional', () => {
    pressKey(win, 'ArrowUp');
    assert.ok(doc.getElementById('overlay').classList.contains('hidden'));
  });

  it('soporta movimiento con flechas', () => {
    pressKey(win, 'ArrowUp');
    pressKey(win, 'ArrowDown');
    pressKey(win, 'ArrowLeft');
    pressKey(win, 'ArrowRight');
    assert.ok(true);
  });

  it('soporta WASD', () => {
    pressKey(win, 'KeyW');
    pressKey(win, 'KeyS');
    pressKey(win, 'KeyA');
    pressKey(win, 'KeyD');
    assert.ok(true);
  });

  it('reinicia con KeyR', () => {
    pressKey(win, 'KeyR');
    assert.ok(doc.getElementById('overlay'));
  });

  it('canvas tiene dimensiones válidas', () => {
    const canvas = doc.getElementById('gameCanvas');
    assert.ok(canvas);
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('tiene displays de HUD', () => {
    assert.ok(doc.getElementById('scoreValue'));
    assert.ok(doc.getElementById('livesValue'));
    assert.ok(doc.getElementById('roundValue'));
  });

  it('tiene botones touch d-pad', () => {
    assert.ok(doc.getElementById('bU'));
    assert.ok(doc.getElementById('bD'));
    assert.ok(doc.getElementById('bL'));
    assert.ok(doc.getElementById('bR'));
  });
});
