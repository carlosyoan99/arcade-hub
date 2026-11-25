import type { GameEvent, Tick } from './types.js';

/**
 * Cola de eventos de simulación. `step()` solo emite; render/audio consumen
 * la cola al final del tick, de modo que la simulación sigue siendo pura.
 */
export interface EventBus {
  emit(type: string, payload?: unknown): void;
  drain(): GameEvent[];
  peek(): readonly GameEvent[];
  clear(): void;
}

export function createEvents(getTick: () => Tick): EventBus {
  let queue: GameEvent[] = [];

  return {
    emit(type: string, payload: unknown = null): void {
      queue.push({ type, payload, tick: getTick() });
    },
    drain(): GameEvent[] {
      const drained = queue;
      queue = [];
      return drained;
    },
    peek(): readonly GameEvent[] {
      return queue;
    },
    clear(): void {
      queue = [];
    },
  };
}
