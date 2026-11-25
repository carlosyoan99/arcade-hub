import { describe, expect, it } from 'vitest';
import { createActionState } from '../src/input/actions.js';
import { applyInputFrame, captureInputFrame } from '../src/input/virtual.js';

describe('acciones nombradas', () => {
  it('wasPressed solo es true el tick de la pulsación', () => {
    const actions = createActionState(['primary']);
    actions.setDown('primary', true);
    expect(actions.isDown('primary')).toBe(true);
    expect(actions.wasPressed('primary')).toBe(true);
    expect(actions.consume('primary')).toBe(true);
    expect(actions.consume('primary')).toBe(false);
    actions.endTick();
    expect(actions.wasPressed('primary')).toBe(false);
    actions.setDown('primary', false);
    expect(actions.wasReleased('primary')).toBe(true);
  });

  it('acepta la misma entrada desde una cinta virtual', () => {
    const human = createActionState(['up', 'primary']);
    const bot = createActionState(['up', 'primary']);
    human.setDown('up', true);
    applyInputFrame(bot, ['up']);
    expect(captureInputFrame(bot)).toEqual(captureInputFrame(human));
  });

  it('rechaza acciones no registradas', () => {
    const actions = createActionState(['up']);
    expect(() => actions.setDown('jump', true)).toThrow(/no registrada/);
  });
});
