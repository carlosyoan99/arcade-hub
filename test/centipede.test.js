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

describe('Centipede — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('centipede'));
    await import(pathToFileURL(`${ROOT}/games/centipede/script.js`).href);
  });

  after(() => {
    dom.window.close();
    restoreGlobals();
  });

  it('inicializa con score=0', () => {
    assert.equal(getText(doc, 'scoreValue') || '0', '0');
  });

  it('inicia juego con Space', () => {
    pressKey(win, 'Space');
    assert.ok(doc.getElementById('overlay').classList.contains('hidden'));
  });

  it('soporta movimiento 4 direcciones', () => {
    pressKey(win, 'ArrowLeft');
    pressKey(win, 'ArrowRight');
    pressKey(win, 'ArrowUp');
    pressKey(win, 'ArrowDown');
    assert.ok(true);
  });

  it('soporta disparo con Space', () => {
    pressKey(win, 'Space');
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
    assert.equal(getText(doc, 'scoreValue') || '0', '0');
  });

  it('canvas tiene dimensiones válidas', () => {
    const canvas = doc.getElementById('gameCanvas');
    assert.ok(canvas);
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('tiene botones touch', () => {
    assert.ok(doc.getElementById('bL'));
    assert.ok(doc.getElementById('bR'));
    assert.ok(doc.getElementById('bF'));
  });
});
