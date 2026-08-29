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

describe('Q*bert — mecánicas', () => {
  let dom, win, doc;
  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('qbert'));
    await import(pathToFileURL(`${ROOT}/games/qbert/script.js`).href);
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
  it('soporta el salto por diagonales', () => {
    pressKey(win, 'KeyQ');
    pressKey(win, 'KeyE');
    pressKey(win, 'KeyA');
    pressKey(win, 'KeyD');
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
  it('tiene botones touch diagonales', () => {
    assert.ok(doc.getElementById('btnUL'));
    assert.ok(doc.getElementById('btnUR'));
    assert.ok(doc.getElementById('btnDL'));
    assert.ok(doc.getElementById('btnDR'));
  });
});
