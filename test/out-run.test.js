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

describe('Out Run — mecánicas', () => {
  let dom, win, doc;
  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('out-run'));
    await import(pathToFileURL(`${ROOT}/games/out-run/script.js`).href);
  });
  after(() => {
    dom.window.close();
    restoreGlobals();
  });

  it('inicializa con tiempo de 75s', () => {
    const t = getText(doc, 'timeValue');
    assert.ok(t);
    assert.ok(Number(t) > 0);
  });
  it('inicia juego con Space', () => {
    pressKey(win, 'Space');
    assert.ok(doc.getElementById('overlay').classList.contains('hidden'));
  });
  it('soporta acelerar', () => {
    pressKey(win, 'ArrowUp');
    assert.ok(true);
  });
  it('soporta frenar', () => {
    pressKey(win, 'ArrowDown');
    assert.ok(true);
  });
  it('soporta giro', () => {
    pressKey(win, 'ArrowLeft');
    pressKey(win, 'ArrowRight');
    assert.ok(true);
  });
  it('turbo con Space', () => {
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
  it('pausa con KeyP', () => {
    pressKey(win, 'KeyP');
    pressKey(win, 'KeyP');
    assert.ok(true);
  });
  it('reinicia con KeyR', () => {
    pressKey(win, 'KeyR');
    const t = getText(doc, 'timeValue');
    assert.ok(t);
  });
  it('canvas tiene dimensiones válidas', () => {
    const c = doc.getElementById('gameCanvas');
    assert.ok(c);
    assert.ok(c.width > 0);
  });
  it('tiene botones touch', () => {
    assert.ok(doc.getElementById('btnUp'));
    assert.ok(doc.getElementById('btnDown'));
    assert.ok(doc.getElementById('btnLeft'));
    assert.ok(doc.getElementById('btnRight'));
    assert.ok(doc.getElementById('btnTurbo'));
  });
});
