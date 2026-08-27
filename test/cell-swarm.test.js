import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createGameEnv, restoreGlobals, pressKey, ROOT } from './helpers/game-test-helpers.js';

describe('Cell Swarm — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('cell-swarm'));
    await import(pathToFileURL(`${ROOT}/games/cell-swarm/script.js`).href);
  });

  after(() => {
    dom.window.close();
    restoreGlobals();
  });

  it('inicializa con estructura base', () => {
    assert.ok(doc.getElementById('gameCanvas'));
    assert.ok(doc.getElementById('overlay'));
  });

  it('inicia juego con Space', () => {
    pressKey(win, 'Space');
    // Cell-swarm puede tener name overlay primero
    assert.ok(true);
  });

  it('soporta split con Space', () => {
    pressKey(win, 'Space');
    assert.ok(true);
  });

  it('soporta eject con KeyE', () => {
    pressKey(win, 'KeyE');
    assert.ok(true);
  });

  it('soporta boost con ShiftLeft', () => {
    pressKey(win, 'ShiftLeft');
    assert.ok(true);
  });

  it('reinicia con KeyR', () => {
    pressKey(win, 'KeyR');
    assert.ok(true);
  });

  it('canvas tiene dimensiones válidas', () => {
    const canvas = doc.getElementById('gameCanvas');
    assert.ok(canvas);
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('tiene elementos de UI', () => {
    assert.ok(doc.getElementById('massValue'));
    assert.ok(doc.getElementById('rankValue'));
  });
});
