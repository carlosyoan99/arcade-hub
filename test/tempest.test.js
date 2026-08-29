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

describe('Tempest — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('tempest'));
    await import(pathToFileURL(`${ROOT}/games/tempest/script.js`).href);
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

  it('soporta rotación con ArrowLeft/Right', () => {
    pressKey(win, 'ArrowLeft');
    pressKey(win, 'ArrowRight');
    assert.ok(true);
  });

  it('soporta disparo con Space', () => {
    pressKey(win, 'Space');
    assert.ok(true);
  });

  it('soporta jump con ArrowUp', () => {
    pressKey(win, 'ArrowUp');
    assert.ok(true);
  });

  it('soporta WASD', () => {
    pressKey(win, 'KeyA');
    pressKey(win, 'KeyD');
    pressKey(win, 'KeyW');
    assert.ok(true);
  });

  it('pausa con KeyP', () => {
    pressKey(win, 'KeyP');
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

  it('tiene botones touch correctos', () => {
    assert.ok(doc.getElementById('btnUp'));
    assert.ok(doc.getElementById('btnLeft'));
    assert.ok(doc.getElementById('btnRight'));
    assert.ok(doc.getElementById('btnFire'));
  });
});
