import { describe, expect, it } from 'vitest';
import { createClock } from '../src/core/clock.js';
import { createEvents } from '../src/core/events.js';
import { createPluginRegistry, createServiceRegistry, type EnginePlugin } from '../src/core/plugins.js';
import { createRNG } from '../src/core/rng.js';
import { createScheduler } from '../src/core/scheduler.js';
import { createActionState } from '../src/input/actions.js';

function environment() {
  const clock = createClock(1 / 60);
  return {
    clock,
    rng: createRNG(1),
    events: createEvents(() => clock.tick),
    scheduler: createScheduler(clock),
    actions: createActionState(),
  };
}

describe('plugins nativos', () => {
  it('instala en orden topológico por requires', () => {
    const order: string[] = [];
    const make = (id: string, requires?: readonly string[]): EnginePlugin => ({
      id,
      ...(requires !== undefined ? { requires } : {}),
      install(): void {
        order.push(id);
      },
    });
    const registry = createPluginRegistry(
      [make('c', ['b']), make('a'), make('b', ['a'])],
      environment(),
      createServiceRegistry(),
    );
    expect(registry.plugins.map((plugin) => plugin.id)).toEqual(['a', 'b', 'c']);
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('permite compartir servicios sin duplicar lógica en los juegos', () => {
    const env = environment();
    const services = createServiceRegistry();
    let preStepCalls = 0;
    const physics: EnginePlugin = {
      id: 'physics',
      install(api): void {
        api.registerAction('jump');
        api.services.provide('collide', (a: number, b: number) => a + b);
        api.onPreStep(() => {
          preStepCalls++;
        });
      },
    };
    const registry = createPluginRegistry([physics], env, services);
    registry.preStep();
    expect(preStepCalls).toBe(1);
    expect(services.get<(a: number, b: number) => number>('collide')(1, 2)).toBe(3);
    expect(env.actions.isDown('jump')).toBe(false);
  });

  it('falla con dependencias faltantes, duplicados y ciclos', () => {
    const env = environment();
    const services = createServiceRegistry();
    expect(() =>
      createPluginRegistry([{ id: 'a', requires: ['missing'], install: () => {} }], env, services),
    ).toThrow(/no está instalado/);
    expect(() =>
      createPluginRegistry(
        [
          { id: 'a', install: () => {} },
          { id: 'a', install: () => {} },
        ],
        env,
        services,
      ),
    ).toThrow(/duplicado/);
    expect(() =>
      createPluginRegistry(
        [
          { id: 'a', requires: ['b'], install: () => {} },
          { id: 'b', requires: ['a'], install: () => {} },
        ],
        env,
        services,
      ),
    ).toThrow(/circular/);
  });
});
