import type { EnginePlugin, PluginAPI } from '../core/plugins.js';
import type { RNG } from '../core/rng.js';
import { createSimulation, type Simulation } from '../core/simulation.js';
import { gameSimulationOptions, type GameSimulationConfig } from '../game/adapter.js';
import type { GameDefinition } from '../game/contract.js';
import { createProgression, PROGRESSION_SERVICE } from '../progression/progression.js';
import type { ProgressionConfig } from '../progression/curve.js';
import { NeuralBot } from './agents.js';
import type { Brain } from './brain.js';

/** Dificultad por checkpoints y humanización inyectable, sin reentrenar. */

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyProfile {
  /** Fracción de generaciones entrenadas a la que corresponde el checkpoint. */
  readonly generationFraction: number;
  /** Ticks between decisions: el bot no piensa en cada tick. */
  readonly delayTicks: number;
  /** Probabilidad de sustituir la acción elegida por otra aleatoria. */
  readonly errorRate: number;
  /** Multiplicador de la velocidad de la curva de progresión. */
  readonly speedScale: number;
  /** Multiplicador del peligro (`hazard`) de la curva, acotado a [0, 1]. */
  readonly hazardScale: number;
  /** Multiplicador del intervalo de aparición: > 1 = más tiempo entre spawns. */
  readonly spawnIntervalScale: number;
}

export const DIFFICULTY_PROFILES: Readonly<Record<Difficulty, DifficultyProfile>> = Object.freeze({
  easy: {
    generationFraction: 0.15,
    delayTicks: 6,
    errorRate: 0.15,
    speedScale: 0.85,
    hazardScale: 0.5,
    spawnIntervalScale: 1.2,
  },
  normal: {
    generationFraction: 0.5,
    delayTicks: 3,
    errorRate: 0.06,
    speedScale: 1,
    hazardScale: 1,
    spawnIntervalScale: 1,
  },
  hard: {
    generationFraction: 1,
    delayTicks: 0,
    errorRate: 0,
    speedScale: 1.15,
    hazardScale: 1.5,
    spawnIntervalScale: 0.85,
  },
});

export interface BrainCheckpoint {
  readonly generation: number;
  readonly brain: Brain;
}

/**
 * Elige el checkpoint más reciente cuya generación no supere el objetivo.
 * `totalGenerations` permite expresar el objetivo como fracción del entrenamiento.
 */
export function selectCheckpoint(
  checkpoints: readonly BrainCheckpoint[],
  difficulty: Difficulty,
  totalGenerations?: number,
): Brain {
  if (checkpoints.length === 0) throw new RangeError('checkpoints no puede estar vacío');
  const profile = DIFFICULTY_PROFILES[difficulty];
  if (profile === undefined) throw new TypeError(`dificultad desconocida: ${String(difficulty)}`);
  const last = checkpoints[checkpoints.length - 1] as BrainCheckpoint;
  const total = totalGenerations ?? last.generation;
  if (!Number.isFinite(total) || total < 1) throw new RangeError('totalGenerations debe ser >= 1');
  const target = total * profile.generationFraction;
  let chosen = checkpoints[0] as BrainCheckpoint;
  for (const checkpoint of checkpoints) {
    if (checkpoint.generation <= target) chosen = checkpoint;
  }
  return chosen.brain;
}

export interface DifficultyAgentOptions {
  readonly actions: readonly string[];
  readonly totalGenerations?: number;
  readonly delayTicks?: number;
  readonly errorRate?: number;
}

export interface DifficultyAgent {
  readonly brain: Brain;
  readonly difficulty: Difficulty;
  /** El azar se inyecta en cada llamada; el agente no guarda estado aleatorio. */
  act(obs: Float32Array, rng: RNG): readonly string[];
  reset(): void;
}

/** Envuelve un NeuralBot con retraso y error inyectables. */
export function createDifficultyAgent(
  checkpoints: readonly BrainCheckpoint[],
  difficulty: Difficulty,
  options: DifficultyAgentOptions,
): DifficultyAgent {
  const brain = selectCheckpoint(checkpoints, difficulty, options.totalGenerations);
  const profile = DIFFICULTY_PROFILES[difficulty];
  const delay = options.delayTicks ?? profile.delayTicks;
  const errorRate = options.errorRate ?? profile.errorRate;
  if (!Number.isInteger(delay) || delay < 0) {
    throw new RangeError('delayTicks debe ser un entero >= 0');
  }
  if (!Number.isFinite(errorRate) || errorRate < 0 || errorRate > 1) {
    throw new RangeError('errorRate debe estar en [0, 1]');
  }
  const bot = new NeuralBot(brain, options.actions);
  let cooldown = 0;

  return {
    brain,
    difficulty,
    act(obs: Float32Array, rng: RNG): readonly string[] {
      if (cooldown > 0) {
        cooldown--;
        return [];
      }
      cooldown = delay;
      const chosen = bot.act(obs);
      if (chosen.length === 0 || errorRate === 0 || rng.next() >= errorRate) return chosen;
      const current = chosen[0] as string;
      const count = options.actions.length;
      const start = rng.int(count);
      for (let offset = 0; offset < count; offset++) {
        const candidate = options.actions[(start + offset) % count] as string;
        if (candidate !== current) return [candidate];
      }
      return [];
    },
    reset(): void {
      cooldown = 0;
      bot.reset();
    },
  };
}

export function difficultyProfile(difficulty: Difficulty): DifficultyProfile {
  const profile = DIFFICULTY_PROFILES[difficulty];
  if (profile === undefined) throw new TypeError(`dificultad desconocida: ${String(difficulty)}`);
  return profile;
}

/** Escalado finito y estable: evita arrastrar binarios ambiguos entre niveles. */
function scale(value: number, factor: number): number {
  return Math.round(value * factor * 10_000) / 10_000;
}

/**
 * Deriva la curva declarativa de un juego a partir del perfil elegido.
 * No toca la definición original ni introduce azar: es una transformación pura.
 */
export function difficultyProgressionConfig(
  config: ProgressionConfig,
  difficulty: Difficulty,
): ProgressionConfig {
  const profile = difficultyProfile(difficulty);
  return {
    ...config,
    id: `${config.id ?? 'progression'}:${difficulty}`,
    levels: config.levels.map((level) => ({
      ...level,
      speed: scale(level.speed, profile.speedScale),
      ...(level.spawnInterval === undefined
        ? {}
        : { spawnInterval: Math.max(1, Math.round(level.spawnInterval * profile.spawnIntervalScale)) }),
      ...(level.hazard === undefined
        ? {}
        : { hazard: Math.min(1, Math.max(0, scale(level.hazard, profile.hazardScale))) }),
    })),
  };
}

/**
 * Plugin que instala la curva del perfil en el servicio `progression`.
 * `services.provide` solo admite un servicio por id: por eso quien lo use debe
 * omitir `game.progression` (ver `createDifficultySimulation`), no añadir este
 * plugin a una simulación que ya haya instalado la curva del juego.
 */
export function difficultyPlugin<S extends object>(
  game: GameDefinition<S>,
  difficulty: Difficulty,
): EnginePlugin {
  const config =
    game.progression === undefined
      ? undefined
      : difficultyProgressionConfig(game.progression, difficulty);
  return {
    id: `difficulty:${game.id}:${difficulty}`,
    install(api: PluginAPI): void {
      if (config === undefined) return;
      api.services.provide(PROGRESSION_SERVICE, createProgression(config, api.rng));
    },
  };
}

export interface DifficultySimulationConfig extends GameSimulationConfig {
  readonly difficulty: Difficulty;
}

/** Simulación de un juego real con la curva de dificultad del perfil aplicada. */
export function createDifficultySimulation<S extends object>(
  game: GameDefinition<S>,
  config: DifficultySimulationConfig,
): Simulation<S> {
  const { difficulty, ...rest } = config;
  // Se retira la curva del juego para que el plugin del perfil pueda proveer el
  // servicio antes de que `createSimulation` instale la curva por defecto.
  const { progression: _baseProgression, ...base } = game;
  return createSimulation(
    gameSimulationOptions(base as GameDefinition<S>, {
      ...rest,
      plugins: [difficultyPlugin(game, difficulty), ...(rest.plugins ?? [])],
    }),
  );
}
