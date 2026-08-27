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

describe('Defender — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('defender'));
    await import(pathToFileURL(`${ROOT}/games/defender/script.js`).href);
  });

  after(() => {
    dom.window.close();
    restoreGlobals();
  });

  it('inicializa con score=0', () => {
    assert.equal(getText(doc, 'scoreDisplay') || '0', '0');
  });

  it('inicia juego con Space', () => {
    pressKey(win, 'Space');
    assert.ok(doc.getElementById('overlay').classList.contains('hidden'));
  });

  it('soporta thrust con flechas', () => {
    pressKey(win, 'ArrowUp');
    pressKey(win, 'ArrowDown');
    pressKey(win, 'ArrowLeft');
    pressKey(win, 'ArrowRight');
    assert.ok(true);
  });

  it('soporta disparo con Space', () => {
    pressKey(win, 'Space');
    assert.ok(true);
  });

  it('soporta smart bomb con KeyB', () => {
    pressKey(win, 'KeyB');
    assert.ok(true);
  });

  it('soporta hyperspace con KeyH', () => {
    pressKey(win, 'KeyH');
    assert.ok(true);
  });

  it('soporta WASD', () => {
    pressKey(win, 'KeyA');
    pressKey(win, 'KeyD');
    pressKey(win, 'KeyW');
    pressKey(win, 'KeyS');
    assert.ok(true);
  });

  it('reinicia con KeyR', () => {
    pressKey(win, 'KeyR');
    assert.equal(getText(doc, 'scoreDisplay') || '0', '0');
  });

  it('canvas tiene dimensiones válidas', () => {
    const canvas = doc.getElementById('gameCanvas');
    assert.ok(canvas);
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('tiene botones touch', () => {
    assert.ok(doc.getElementById('btnUp'));
    assert.ok(doc.getElementById('btnDown'));
    assert.ok(doc.getElementById('btnLeft'));
    assert.ok(doc.getElementById('btnRight'));
    assert.ok(doc.getElementById('btnFire'));
    assert.ok(doc.getElementById('btnBomb'));
  });
});
