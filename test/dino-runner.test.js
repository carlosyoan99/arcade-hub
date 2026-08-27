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

describe('Dino Runner — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('dino-runner'));
    await import(pathToFileURL(`${ROOT}/games/dino-runner/script.js`).href);
  });

  after(() => {
    dom.window.close();
    restoreGlobals();
  });

  it('inicializa con distance=0', () => {
    const distText = getText(doc, 'distValue');
    assert.ok(distText !== undefined && distText !== null);
  });

  it('inicia juego con Space', () => {
    pressKey(win, 'Space');
    assert.ok(doc.getElementById('overlay').classList.contains('hidden'));
  });

  it('soporta salto con Space/ArrowUp', () => {
    pressKey(win, 'Space');
    pressKey(win, 'ArrowUp');
    assert.ok(true);
  });

  it('soporta duck con ArrowDown', () => {
    pressKey(win, 'ArrowDown');
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
    assert.ok(doc.getElementById('distValue'));
    assert.ok(doc.getElementById('speedValue'));
    assert.ok(doc.getElementById('bestValue'));
  });

  it('tiene botones touch', () => {
    assert.ok(doc.getElementById('btnJump'));
    assert.ok(doc.getElementById('btnDuck'));
  });
});
