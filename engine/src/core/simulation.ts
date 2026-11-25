import { createClock, type Clock, type ClockState } from './clock.js';
import { createEvents, type EventBus } from './events.js';
import {
  createPluginRegistry,
  createServiceRegistry,
  type EnginePlugin,
  type PluginRegistry,
  type ServiceRegistry,
} from './plugins.js';
import { createRNG, type RNG } from './rng.js';
import { createScheduler, type Scheduler, type SchedulerSnapshot } from './scheduler.js';
import { createStateOps } from './state.js';
import type { TimerId } from './types.js';
import { createActionState, type ActionSnapshot, type ActionState } from '../input/actions.js';
import { applyInputFrame, type InputFrame } from '../input/virtual.js';
import { COLLISION_SERVICE, createCollisionService } from '../sim/collision.js';
import { createGridService, GRID_SERVICE } from '../sim/grid.js';
import { createPathfindingService, PATHFINDING_SERVICE } from '../sim/pathfinding.js';
import {
  defaultProgression,
  PROGRESSION_SERVICE,
  type ProgressionService,
  type ProgressionState,
} from '../progression/progression.js';

function namespaceHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Todo lo que un juego puede usar. Nada de DOM, ni reloj real, ni Math.random. */
export interface StepContext {
  readonly seed: number;
  readonly clock: Clock;
  readonly rng: RNG;
  readonly events: EventBus;
  readonly scheduler: Scheduler;
  readonly actions: ActionState;
  readonly services: ServiceRegistry;
  /** Curva de dificultad y variedad, con estado incluido en el snapshot. */
  readonly progression: ProgressionService;
  /** Stream de RNG derivado, aislado del RNG principal del juego. */
  rngFor(namespace: string): RNG;
  emit(type: string, payload?: unknown): void;
  schedule(ticks: number, fn: () => void): TimerId;
}

export interface SimulationOptions<S extends object> {
  readonly seed: number;
  readonly tickRate?: number;
  readonly plugins?: readonly EnginePlugin[];
  init(seed: number, ctx: StepContext): S;
  step(state: S, ctx: StepContext): void;
}

export interface SimulationSnapshot<S extends object> {
  readonly clock: ClockState;
  readonly rng: number;
  readonly scheduler: SchedulerSnapshot;
  readonly actions: ActionSnapshot;
  readonly progression: ProgressionState;
  readonly state: S;
}

export interface Simulation<S extends object> {
  readonly state: S;
  readonly clock: Clock;
  readonly rng: RNG;
  readonly events: EventBus;
  readonly scheduler: Scheduler;
  readonly actions: ActionState;
  readonly services: ServiceRegistry;
  readonly plugins: PluginRegistry;
  readonly ctx: StepContext;
  tick(inputs?: InputFrame): void;
  /** tick:rng:hash del estado. Cambia si el determinismo se rompe. */
  hash(): string;
  snapshot(): SimulationSnapshot<S>;
  restore(snapshot: SimulationSnapshot<S>): void;
}

export function createSimulation<S extends object>(options: SimulationOptions<S>): Simulation<S> {
  const clock = createClock(1 / (options.tickRate ?? 60));
  const rng = createRNG(options.seed);
  const events = createEvents(() => clock.tick);
  const scheduler = createScheduler(clock);
  const actions = createActionState();
  const services = createServiceRegistry();
  const stateOps = createStateOps<S>();

  const ctx: StepContext = {
    clock,
    rng,
    events,
    scheduler,
    actions,
    services,
    get seed(): number {
      return options.seed;
    },
    rngFor(namespace: string): RNG {
      return rng.fork(namespaceHash(namespace));
    },
    get progression(): ProgressionService {
      return services.get<ProgressionService>(PROGRESSION_SERVICE);
    },
    emit(type: string, payload: unknown = null): void {
      events.emit(type, payload);
    },
    schedule(ticks: number, fn: () => void): TimerId {
      return scheduler.schedule(ticks, fn);
    },
  };

  const plugins = createPluginRegistry(
    options.plugins ?? [],
    { clock, rng, events, scheduler, actions },
    services,
  );
  if (!services.has(PROGRESSION_SERVICE)) {
    services.provide(PROGRESSION_SERVICE, defaultProgression(rng.fork(0x44454641)));
  }
  if (!services.has(COLLISION_SERVICE)) {
    services.provide(COLLISION_SERVICE, createCollisionService());
  }
  if (!services.has(PATHFINDING_SERVICE)) {
    services.provide(PATHFINDING_SERVICE, createPathfindingService());
  }
  if (!services.has(GRID_SERVICE)) {
    services.provide(GRID_SERVICE, createGridService());
  }
  const progression = services.get<ProgressionService>(PROGRESSION_SERVICE);
  const state = options.init(options.seed, ctx);

  return {
    state,
    clock,
    rng,
    events,
    scheduler,
    actions,
    services,
    plugins,
    ctx,
    tick(inputs: InputFrame = []): void {
      clock.advance();
      applyInputFrame(actions, inputs);
      scheduler.advance();
      plugins.preStep();
      options.step(state, ctx);
      plugins.postStep();
      actions.endTick();
    },
    hash(): string {
      return `${clock.tick}:${rng.state}:${stateOps.hash(state)}`;
    },
    snapshot(): SimulationSnapshot<S> {
      return {
        clock: clock.snapshot(),
        rng: rng.snapshot(),
        scheduler: scheduler.snapshot(),
        actions: actions.snapshot(),
        progression: progression.snapshot(),
        state: stateOps.snapshot(state),
      };
    },
    restore(snapshot: SimulationSnapshot<S>): void {
      clock.restore(snapshot.clock);
      rng.restore(snapshot.rng);
      scheduler.restore(snapshot.scheduler);
      actions.restore(snapshot.actions);
      progression.restore(snapshot.progression);
      stateOps.restore(state, snapshot.state);
    },
  };
}
