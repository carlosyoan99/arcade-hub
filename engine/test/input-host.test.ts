import { afterEach, describe, expect, it, vi } from 'vitest';
import { createActionState } from '../src/input/actions.js';
import { createBindings } from '../src/input/bindings.js';
import {
  createInputHost,
  type InputEventLike,
  type InputEventTarget,
} from '../src/input/host.js';

class FakeTarget implements InputEventTarget {
  readonly added: string[] = [];
  readonly removed: string[] = [];
  private readonly listeners = new Map<string, ((event: InputEventLike) => void)[]>();

  addEventListener(type: string, listener: (event: InputEventLike) => void): void {
    this.added.push(type);
    const bucket = this.listeners.get(type) ?? [];
    bucket.push(listener);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: (event: InputEventLike) => void): void {
    this.removed.push(type);
    const bucket = this.listeners.get(type);
    if (!bucket) return;
    this.listeners.set(
      type,
      bucket.filter((candidate) => candidate !== listener),
    );
  }

  emit(type: string, event: InputEventLike = {}): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
  }
}

function fakeGamepad(axes: readonly number[], pressed: boolean): Gamepad {
  return {
    connected: true,
    index: 0,
    id: 'test-pad',
    mapping: 'standard',
    timestamp: 0,
    axes: [...axes],
    buttons: [{ pressed, value: pressed ? 1 : 0 }],
  } as unknown as Gamepad;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('host de entradas', () => {
  it('keydown/keyup mapean a acciones nombradas y solo previenen teclas mapeadas', () => {
    const target = new FakeTarget();
    const actions = createActionState(['up', 'primary', 'pause']);
    const bindings = createBindings({ KeyW: 'up', Space: 'primary', KeyP: 'pause' });
    const host = createInputHost({ actions, bindings, target });
    host.attach();

    let prevented = 0;
    const event = (code: string): InputEventLike => ({
      code,
      preventDefault: () => {
        prevented++;
      },
    });

    target.emit('keydown', event('KeyW'));
    expect(actions.isDown('up')).toBe(true);
    target.emit('keydown', event('KeyW')); // auto-repeat: no genera nueva pulsación
    expect(actions.wasPressed('up')).toBe(true);
    target.emit('keyup', event('KeyW'));
    expect(actions.isDown('up')).toBe(false);

    target.emit('keydown', event('KeyQ'));
    expect(prevented).toBe(2); // KeyQ no está mapeada; keyup nunca previene

    target.emit('keydown', event('KeyP'));
    expect(prevented).toBe(3);
    target.emit('keyup', event('KeyP'));
  });

  it('pointerup y pointercancel liberan el puntero y la acción de tap', () => {
    const target = new FakeTarget();
    const pointer = new FakeTarget();
    const actions = createActionState(['primary']);
    const host = createInputHost({
      actions,
      bindings: createBindings({}),
      target,
      pointer,
      tapAction: 'primary',
    });
    host.attach();

    pointer.emit('pointerdown', { clientX: 0.25, clientY: 0.75, pointerId: 7 });
    expect(actions.isDown('primary')).toBe(true);
    expect(actions.pointer).toEqual({ x: 0.25, y: 0.75, active: true });

    pointer.emit('pointermove', { clientX: 0.5, clientY: 0.5, pointerId: 7 });
    expect(actions.pointer).toEqual({ x: 0.5, y: 0.5, active: true });

    pointer.emit('pointerup', { clientX: 0.5, clientY: 0.5, pointerId: 7 });
    expect(actions.isDown('primary')).toBe(false);
    expect(actions.pointer.active).toBe(false);

    pointer.emit('pointerdown', { clientX: 0.1, clientY: 0.2, pointerId: 9 });
    pointer.emit('pointercancel', { clientX: 0.1, clientY: 0.2, pointerId: 9 });
    expect(actions.isDown('primary')).toBe(false);
    expect(actions.pointer.active).toBe(false);
  });

  it('no lanza sin navigator ni gamepad', () => {
    vi.stubGlobal('navigator', undefined);
    const actions = createActionState(['primary']);
    const host = createInputHost({ actions, bindings: createBindings({}) });
    host.attach();

    expect(() => host.poll(1)).not.toThrow();
    expect(actions.snapshot().down).toEqual([]);

    vi.stubGlobal('navigator', { userAgent: 'node' });
    expect(() => host.poll(2)).not.toThrow();

    vi.stubGlobal('navigator', { getGamepads: () => [null] });
    expect(() => host.poll(3)).not.toThrow();
    expect(host.lastPollTick).toBe(3);
  });

  it('detach quita todos los listeners registrados y suelta las acciones', () => {
    const target = new FakeTarget();
    const pointer = new FakeTarget();
    const actions = createActionState(['primary']);
    const host = createInputHost({
      actions,
      bindings: createBindings({ KeyW: 'primary' }),
      target,
      pointer,
    });
    host.attach();
    expect(target.added).toContain('keydown');
    expect(target.added).toContain('keyup');
    expect(target.added).toContain('gamepadconnected');
    expect(target.added).toContain('gamepaddisconnected');
    expect(pointer.added).toEqual(
      expect.arrayContaining(['pointerdown', 'pointermove', 'pointerup', 'pointercancel']),
    );

    target.emit('keydown', { code: 'KeyW' });
    expect(actions.isDown('primary')).toBe(true);
    host.detach();
    expect(actions.isDown('primary')).toBe(false);
    expect(actions.pointer.active).toBe(false);
    for (const type of ['keydown', 'keyup', 'gamepadconnected', 'gamepaddisconnected']) {
      expect(target.removed).toContain(type);
    }
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      expect(pointer.removed).toContain(type);
    }
    expect(host.attached).toBe(false);
    host.detach(); // idempotente
    expect(target.removed.filter((type) => type === 'keydown')).toHaveLength(1);
  });

  it('poll sondea gamepad y aplica deadzone a stick y botones', () => {
    const pads: (Gamepad | null)[] = [fakeGamepad([0.9, 0.1], true)];
    const getGamepads = vi.fn<() => (Gamepad | null)[]>(() => pads);
    vi.stubGlobal('navigator', { getGamepads });
    const actions = createActionState(['primary', 'left', 'right', 'up', 'down']);
    const host = createInputHost({
      actions,
      bindings: createBindings({}),
      deadzone: 0.25,
    });
    host.attach();

    host.poll(10);
    expect(getGamepads).toHaveBeenCalledTimes(1);
    expect(actions.isDown('primary')).toBe(true);
    expect(actions.isDown('right')).toBe(true);
    expect(actions.isDown('left')).toBe(false);

    pads[0] = fakeGamepad([0.1, -0.9], false);
    host.poll(11);
    expect(actions.isDown('right')).toBe(false); // 0.1 < deadzone
    expect(actions.isDown('primary')).toBe(false);
    expect(actions.isDown('up')).toBe(true);

    pads[0] = null;
    host.poll(12);
    expect(actions.isDown('up')).toBe(false);
    expect(host.frame().actions).toEqual([]);
  });

  it('nunca lanza por acciones no registradas por el juego', () => {
    const target = new FakeTarget();
    const actions = createActionState(['up']);
    const host = createInputHost({
      actions,
      bindings: createBindings({ KeyW: 'up', Space: 'primary', KeyP: 'pause' }),
      target,
      tapAction: 'primary',
    });
    host.attach();

    expect(() => target.emit('keydown', { code: 'Space' })).not.toThrow();
    expect(() => target.emit('keydown', { code: 'KeyP' })).not.toThrow();
    expect(() => target.emit('pointerdown', { clientX: 0.5, clientY: 0.5 })).not.toThrow();
    expect(actions.snapshot().down).toEqual([]);
    expect(actions.pointer.active).toBe(true); // el puntero vive aunque el tap no exista
  });
});
