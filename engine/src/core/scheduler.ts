import type { Clock } from './clock.js';
import type { Tick, TimerId } from './types.js';

interface Timer {
  readonly id: TimerId;
  readonly dueTick: Tick;
  readonly fn: () => void;
}

export interface SchedulerSnapshot {
  readonly nextId: TimerId;
  readonly timers: ReadonlyArray<{ readonly id: TimerId; readonly dueTick: Tick }>;
}

/**
 * Timers de simulación, medidos en ticks. Se pueden pausar (simplemente no
 * llamando a advance) y reiniciar (clear). Sustituyen a setTimeout de gameplay.
 */
export interface Scheduler {
  schedule(delayTicks: number, fn: () => void): TimerId;
  cancel(id: TimerId): void;
  advance(): void;
  clear(): void;
  pending(): number;
  snapshot(): SchedulerSnapshot;
  /** Restaura timers. Los handlers se recuperan por id del registro interno. */
  restore(snapshot: SchedulerSnapshot): void;
}

export function createScheduler(clock: Clock): Scheduler {
  let nextId = 1;
  let timers: Timer[] = [];
  const handlers = new Map<TimerId, () => void>();

  return {
    schedule(delayTicks: number, fn: () => void): TimerId {
      if (!Number.isInteger(delayTicks) || delayTicks < 0) {
        throw new RangeError('Scheduler.schedule: delayTicks debe ser un entero >= 0');
      }
      const id = nextId++;
      timers.push({ id, dueTick: clock.tick + delayTicks, fn });
      handlers.set(id, fn);
      return id;
    },
    cancel(id: TimerId): void {
      handlers.delete(id);
      timers = timers.filter((timer) => timer.id !== id);
    },
    advance(): void {
      const due = timers.filter((timer) => timer.dueTick <= clock.tick);
      if (due.length === 0) return;
      timers = timers.filter((timer) => timer.dueTick > clock.tick);
      for (const timer of due) {
        // Un callback puede cancelar otro timer de los que vencen este tick.
        if (handlers.has(timer.id)) timer.fn();
      }
    },
    clear(): void {
      // Se conserva el registro de handlers: así un snapshot tomado antes
      // del clear puede restaurarse con sus callbacks originales.
      timers = [];
    },
    pending(): number {
      return timers.length;
    },
    snapshot(): SchedulerSnapshot {
      return {
        nextId,
        timers: timers.map(({ id, dueTick }) => ({ id, dueTick })),
      };
    },
    restore(snapshot: SchedulerSnapshot): void {
      nextId = snapshot.nextId;
      timers = snapshot.timers.map(({ id, dueTick }) => {
        const fn = handlers.get(id);
        if (!fn) {
          throw new Error(`Scheduler.restore: falta el handler del timer ${id}`);
        }
        return { id, dueTick, fn };
      });
    },
  };
}
