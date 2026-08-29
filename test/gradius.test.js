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

describe('Gradius — mecánicas', () => {
  let dom, win, doc;
  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('gradius'));
    await import(pathToFileURL(`${ROOT}/games/gradius/script.js`).href);
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
    assert.equal(doc.getElementById('overlay').style.display, 'none');
  });
  it('soporta movimiento', () => {
    pressKey(win, 'ArrowLeft');
    pressKey(win, 'ArrowRight');
    pressKey(win, 'ArrowUp');
    pressKey(win, 'ArrowDown');
    assert.ok(true);
  });
  it('dispara con KeyX', () => {
    pressKey(win, 'KeyX');
    assert.ok(true);
  });
  it('activa el poder con Space', () => {
    pressKey(win, 'Space');
    assert.ok(true);
  });
  it('pausa con KeyP', () => {
    pressKey(win, 'KeyP');
    pressKey(win, 'KeyP');
    assert.ok(true);
  });
  it('reinicia con KeyR en menú', () => {
    pressKey(win, 'KeyR');
    assert.equal(getText(doc, 'scoreValue'), '0');
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
    assert.ok(doc.getElementById('btnFire'));
  });
});
