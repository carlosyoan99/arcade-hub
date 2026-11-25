import type { RNG } from '../core/rng.js';
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
}

export const DIFFICULTY_PROFILES: Readonly<Record<Difficulty, DifficultyProfile>> = Object.freeze({
  easy: { generationFraction: 0.15, delayTicks: 6, errorRate: 0.15 },
  normal: { generationFraction: 0.5, delayTicks: 3, errorRate: 0.06 },
  hard: { generationFraction: 1, delayTicks: 0, errorRate: 0 },
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
