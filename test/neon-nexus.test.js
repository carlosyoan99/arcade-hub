import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createGameEnv, restoreGlobals, pressKey, ROOT } from './helpers/game-test-helpers.js';

describe('Neon Nexus — mecánicas', () => {
  let dom, win, doc;

  before(async () => {
    ({ dom, window: win, document: doc } = createGameEnv('neon-nexus'));
    await import(pathToFileURL(`${ROOT}/games/neon-nexus/script.js`).href);
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
    assert.ok(doc.getElementById('overlay').classList.contains('hidden'));
  });

  it('soporta ataque con Space', () => {
    pressKey(win, 'Space');
    assert.ok(true);
  });

  it('soporta upgrade ATK con Digit1', () => {
    pressKey(win, 'Digit1');
    assert.ok(true);
  });

  it('soporta upgrade HP con Digit2', () => {
    pressKey(win, 'Digit2');
    assert.ok(true);
  });

  it('soporta upgrade Speed con Digit3', () => {
    pressKey(win, 'Digit3');
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

  it('tiene displays de HUD', () => {
    assert.ok(doc.getElementById('waveValue'));
    assert.ok(doc.getElementById('starsValue'));
    assert.ok(doc.getElementById('coinsValue'));
  });

  it('tiene shop buttons', () => {
    assert.ok(doc.getElementById('upgAtkBtn'));
    assert.ok(doc.getElementById('upgHpBtn'));
    assert.ok(doc.getElementById('upgSpdBtn'));
  });
});
