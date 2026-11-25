export { createClock, type Clock, type ClockState } from './core/clock.js';
export { createEvents, type EventBus } from './core/events.js';
export {
  createPluginRegistry,
  createServiceRegistry,
  type EnginePlugin,
  type PluginAPI,
  type PluginEnvironment,
  type PluginRegistry,
  type ServiceRegistry,
  type StepHook,
} from './core/plugins.js';
export { createRNG, type RNG } from './core/rng.js';
export { createScheduler, type Scheduler, type SchedulerSnapshot } from './core/scheduler.js';
export { createSimulation, type Simulation, type SimulationOptions, type SimulationSnapshot, type StepContext } from './core/simulation.js';
export { createStateOps, type StateOps } from './core/state.js';
export { createLoop, type EngineLoop, type LoopOptions } from './core/loop.js';
export type { GameEvent, Tick, TimerId } from './core/types.js';
export {
  createActionState,
  type ActionSnapshot,
  type ActionState,
  type PointerState,
} from './input/actions.js';
export {
  createBindings,
  DEFAULT_BINDINGS,
  type BindingMap,
  type Bindings,
} from './input/bindings.js';
export {
  applyInputFrame,
  applyInputFrameWithPointer,
  captureInputFrame,
  createReplay,
  type InputFrame,
  type InputFrameWithPointer,
  type PointerFrame,
  type Replay,
} from './input/virtual.js';
export {
  createInputHost,
  type InputHost,
  type InputHostConfig,
} from './input/host.js';
export {
  defineGame,
  type GameDefinition,
  type GameMeta,
  type GameMode,
  type GameRules,
} from './game/contract.js';
export {
  createGameSimulation,
  gameSimulationOptions,
  type GameSimulationConfig,
} from './game/adapter.js';
export { demoGame, type DemoState } from './game/example.js';
export {
  GAMES,
  GAME_IDS,
  findGame,
  pongGame,
  PONG,
  type PongState,
  type PongBall,
  flappyGame,
  FLAPPY,
  type FlappyState,
  type FlappyPipe,
} from './games/index.js';
export { runHeadless, type HeadlessOptions, type HeadlessResult } from './tools/headless.js';
export { inputsFromReplay, recordReplay } from './tools/replay.js';

// Progresión: dificultad por niveles, DDA acotada y variedad sembrada.
export * from './progression/curve.js';
export * from './progression/variety.js';
export * from './progression/progression.js';

// IA (F3): misma simulación, sin DOM y sin Math.random.
export * from './ai/mlp.js';
export * from './ai/brain.js';
export * from './ai/evolution.js';
export * from './ai/agents.js';
export * from './ai/sensors.js';
export * from './ai/brain-store.js';
export * from './ai/trainer.js';
export * from './ai/difficulty.js';

// Servicios compartidos del motor (evitan duplicar lógica en los juegos).
export * from './core/math.js';
export * from './sim/grid.js';
export * from './sim/collision.js';
export * from './sim/pathfinding.js';
export {
  JUICE_EVENTS,
  isJuiceEvent,
  type JuiceEventType,
  type JuiceEventPayloads,
  type PositionPayload,
} from './game/events.js';
export { handleLifecycle, type LifecycleOptions, type PausableState } from './game/lifecycle.js';
export { singlePlayerRules, type SinglePlayerRulesState } from './game/rules.js';

// Presentación (F1): sistemas reutilizables, nunca dentro de los juegos.
export * from './render/canvas2d.js';
export * from './render/camera.js';
export * from './render/event-fanout.js';
export * from './render/sprites.js';
export * from './render/particles.js';
export * from './render/ui-draw.js';
export * from './audio/synth.js';
export * from './audio/music.js';
export * from './audio/manager.js';
export * from './ui/shell.js';
export * from './ui/hud.js';
export * from './ui/help.js';
export * from './ui/settings.js';
export * from './store/storage.js';
export * from './store/scores.js';
export * from './store/achievements.js';
