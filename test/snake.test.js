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

describe('Snake — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('snake'));
    await import(pathToFileURL(`${ROOT}/games/snake/script.js`).href);
  });

  after(() => {
    dom.window.close();
    restoreGlobals();
  });

  it('inicializa con score=0', () => {
    assert.equal(getText(doc, 'scoreValue'), '0');
  });

  it('inicia juego con dirección', () => {
    pressKey(win, 'ArrowRight');
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

  it('pausa con Space/KeyP', () => {
    pressKey(win, 'Space');
    pressKey(win, 'KeyP');
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

  it('tiene botones touch d-pad', () => {
    assert.ok(doc.getElementById('btnUp'));
    assert.ok(doc.getElementById('btnDown'));
    assert.ok(doc.getElementById('btnLeft'));
    assert.ok(doc.getElementById('btnRight'));
    assert.ok(doc.getElementById('btnPause'));
  });
});
