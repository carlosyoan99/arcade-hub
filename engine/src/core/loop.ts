import type { InputFrame } from '../input/virtual.js';
import type { Simulation } from './simulation.js';
import type { GameEvent } from './types.js';

export interface LoopOptions<S extends object> {
  readonly simulation: Simulation<S>;
  readonly getInputs?: () => InputFrame;
  readonly render?: (alpha: number, events: readonly GameEvent[]) => void;
  /** Máximo de ticks por frame. Evita la espiral de la muerte. */
  readonly maxSubSteps?: number;
  readonly maxFrameMs?: number;
}

export interface EngineLoop {
  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  /** Un tick sin reloj real: base de tests, replays y entrenamiento. */
  stepOnce(): void;
  advance(realDeltaMs: number): void;
  readonly alpha: number;
  readonly isRunning: boolean;
  readonly isPaused: boolean;
}

export function createLoop<S extends object>(options: LoopOptions<S>): EngineLoop {
  const dt = options.simulation.clock.dt;
  const maxSubSteps = options.maxSubSteps ?? 5;
  const maxFrameMs = options.maxFrameMs ?? 250;
  let accumulator = 0;
  let running = false;
  let paused = false;
  let rafId: number | null = null;
  let lastTime = 0;
  let frameEvents: GameEvent[] = [];

  function step(): void {
    options.simulation.tick(options.getInputs?.() ?? []);
    frameEvents.push(...options.simulation.events.drain());
    accumulator -= dt;
  }

  function render(): void {
    if (!options.render) return;
    options.render(accumulator / dt, frameEvents);
    frameEvents = [];
  }

  function advance(realDeltaMs: number): void {
    if (!Number.isFinite(realDeltaMs) || realDeltaMs < 0) return;
    accumulator += Math.min(realDeltaMs, maxFrameMs) / 1000;
    let steps = 0;
    while (accumulator >= dt && steps < maxSubSteps) {
      step();
      steps++;
    }
    if (steps === maxSubSteps && accumulator >= dt) {
      accumulator %= dt;
    }
  }

  function frame(time: number): void {
    if (!running || paused) return;
    const delta = time - lastTime;
    lastTime = time;
    advance(delta);
    render();
    rafId = requestAnimationFrame(frame);
  }

  return {
    start(): void {
      if (running) return;
      if (typeof requestAnimationFrame !== 'function') {
        throw new Error('createLoop.start() necesita requestAnimationFrame; usa el headless runner en Node');
      }
      running = true;
      paused = false;
      rafId = requestAnimationFrame((time: number) => {
        lastTime = time;
        frame(time);
      });
    },
    stop(): void {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      running = false;
      paused = false;
    },
    pause(): void {
      if (!running || paused) return;
      paused = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    },
    resume(): void {
      if (!running || !paused) return;
      paused = false;
      lastTime = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stepOnce(): void {
      options.simulation.tick(options.getInputs?.() ?? []);
      const events = options.simulation.events.drain();
      options.render?.(0, events);
    },
    advance,
    get alpha(): number {
      return accumulator / dt;
    },
    get isRunning(): boolean {
      return running;
    },
    get isPaused(): boolean {
      return paused;
    },
  };
}
