/**
 * Un único drenaje de eventos por tick, distribuido a varios consumidores
 * (audio, partículas...). Evita que dos plugins hagan drain() de la misma cola
 * y se roben los eventos entre sí.
 */

import type { EnginePlugin, PluginAPI } from '../core/plugins.js';
import type { GameEvent } from '../core/types.js';

export const EVENT_FANOUT_SERVICE = 'presentation.events';
export const EVENT_FANOUT_PLUGIN_ID = 'presentation.events';

export type EventListener = (events: readonly GameEvent[]) => void;

export interface EventFanout {
  subscribe(listener: EventListener): () => void;
  publish(events: readonly GameEvent[]): void;
  readonly listenerCount: number;
}

export function createEventFanout(): EventFanout {
  const listeners = new Set<EventListener>();

  return {
    subscribe(listener: EventListener): () => void {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
    publish(events: readonly GameEvent[]): void {
      for (const listener of [...listeners]) {
        try {
          listener(events);
        } catch {
          // Un consumidor defectuoso no debe romper a los demás.
        }
      }
    },
    get listenerCount(): number {
      return listeners.size;
    },
  };
}

export function eventFanoutPlugin(): EnginePlugin {
  return {
    id: EVENT_FANOUT_PLUGIN_ID,
    version: '1.0.0',
    install(api: PluginAPI): void {
      const fanout = createEventFanout();
      api.services.provide(EVENT_FANOUT_SERVICE, fanout);
      api.onPostStep(() => {
        fanout.publish(api.events.drain());
      });
    },
  };
}
