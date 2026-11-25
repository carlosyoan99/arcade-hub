import type { StepContext } from '../core/simulation.js';

export interface PausableState {
  paused: boolean;
  over: boolean;
}

export interface LifecycleOptions {
  readonly pauseAction?: string;
  readonly restartAction?: string;
}

/**
 * Ciclo de vida común: reinicio, pausa y actualización de progresión.
 * Lo usan todos los juegos para no repetir el mismo bloque en cada step().
 */
export function handleLifecycle<S extends PausableState>(
  state: S,
  ctx: StepContext,
  progress: number,
  reset: () => void,
  options: LifecycleOptions = {},
): boolean {
  const pauseAction = options.pauseAction ?? 'pause';
  const restartAction = options.restartAction ?? 'restart';

  if (ctx.actions.consume(restartAction)) {
    reset();
    return true;
  }
  if (ctx.actions.consume(pauseAction)) {
    state.paused = !state.paused;
  }
  ctx.progression.update(progress);
  return state.paused || state.over;
}
