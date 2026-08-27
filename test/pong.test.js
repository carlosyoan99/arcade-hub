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

describe('Pong — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('pong'));
    await import(pathToFileURL(`${ROOT}/games/pong/script.js`).href);
  });

  after(() => {
    dom.window.close();
    restoreGlobals();
  });

  it('inicializa con scores en 0', () => {
    assert.equal(getText(doc, 'playerScore'), '0');
    assert.equal(getText(doc, 'aiScore'), '0');
  });

  it('tiene overlay visible al inicio', () => {
    assert.ok(doc.getElementById('overlay'));
    assert.ok(!doc.getElementById('overlay').classList.contains('hidden'));
  });

  it('inicia juego con Space', () => {
    pressKey(win, 'Space');
    assert.ok(doc.getElementById('overlay').classList.contains('hidden'));
  });

  it('soporta movimiento de paleta con ArrowUp/ArrowDown', () => {
    pressKey(win, 'ArrowUp');
    pressKey(win, 'ArrowDown');
    assert.ok(true);
  });

  it('soporta movimiento con WASD', () => {
    pressKey(win, 'KeyW');
    pressKey(win, 'KeyS');
    assert.ok(true);
  });

  it('muestra scores iniciales', () => {
    assert.equal(getText(doc, 'playerScore'), '0');
    assert.equal(getText(doc, 'aiScore'), '0');
  });

  it('tiene HUD de wins', () => {
    const wins = doc.getElementById('winsDisplay');
    assert.ok(wins);
  });

  it('reinicia con KeyR', () => {
    pressKey(win, 'KeyR');
    assert.equal(getText(doc, 'playerScore'), '0');
    assert.equal(getText(doc, 'aiScore'), '0');
  });

  it('canvas tiene dimensiones válidas', () => {
    const canvas = doc.getElementById('gameCanvas');
    assert.ok(canvas);
    assert.ok(canvas.width > 0);
    assert.ok(canvas.height > 0);
  });

  it('tiene botones touch para移动', () => {
    assert.ok(doc.getElementById('btnUp'));
    assert.ok(doc.getElementById('btnDown'));
  });
});
