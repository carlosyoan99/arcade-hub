import type { RNG } from '../core/rng.js';
import { createBrain, withBrainScore, type Brain } from './brain.js';
import { cloneWeights, countWeights, randomWeights, defineTopology, type Topology } from './mlp.js';

/** Neuroevolución: todo el azar viene del RNG inyectado. Sin Math.random. */

export interface EvolutionOptions {
  readonly rng: RNG;
  readonly topology: Topology;
  readonly populationSize: number;
  readonly seed: number;
  readonly gameId?: string;
  readonly gameVersion?: string;
  readonly eliteCount?: number;
  readonly tournamentSize?: number;
  readonly mutationRate?: number;
  readonly mutationScale?: number;
  readonly crossoverRate?: number;
}

export interface ScoredBrain {
  readonly brain: Brain;
  readonly fitness: number;
  readonly index: number;
}

export interface EvolutionResult {
  readonly generation: number;
  readonly best: Brain;
  readonly bestFitness: number;
  readonly ranked: readonly ScoredBrain[];
}

export interface Evolver {
  readonly generation: number;
  readonly population: readonly Brain[];
  readonly history: readonly EvolutionResult[];
  /** Evalúa la población, ordena, actualiza el historial y crea la siguiente generación. */
  step(fitness: (brain: Brain, index: number) => number): EvolutionResult;
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function assertRate(value: number | undefined, fallback: number, label: string): number {
  const rate = value ?? fallback;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new RangeError(`${label} debe estar en [0, 1]`);
  }
  return rate;
}

/** Mutación gaussiana acotada; cada decisión consume el RNG inyectado. */
export function mutateWeights(
  weights: Float32Array,
  rng: RNG,
  rate: number,
  scale: number,
): Float32Array {
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('mutationScale debe ser > 0');
  }
  const next = cloneWeights(weights);
  for (let i = 0; i < next.length; i++) {
    if (rng.next() < rate) {
      next[i] = Math.fround(clamp((next[i] ?? 0) + rng.range(-scale, scale), -1, 1));
    }
  }
  return next;
}

/** Crossover uniforme por gen sin alterar a los padres. */
export function crossoverWeights(a: Float32Array, b: Float32Array, rng: RNG, rate: number): Float32Array {
  if (a.length !== b.length) throw new RangeError('crossoverWeights: genomas de distinto tamaño');
  const child = new Float32Array(a.length);
  for (let i = 0; i < child.length; i++) {
    child[i] = rng.next() < rate ? (b[i] ?? 0) : (a[i] ?? 0);
  }
  return child;
}

export function createEvolver(options: EvolutionOptions): Evolver {
  const topology = defineTopology(options.topology);
  const size = options.populationSize;
  if (!Number.isInteger(size) || size < 2) {
    throw new RangeError('populationSize debe ser un entero >= 2');
  }
  if (!Number.isInteger(options.seed)) throw new RangeError('seed debe ser un entero');
  const gameId = options.gameId ?? 'unknown';
  const gameVersion = options.gameVersion ?? '0';
  const eliteCount = options.eliteCount ?? Math.max(1, Math.floor(size / 10));
  if (!Number.isInteger(eliteCount) || eliteCount < 1 || eliteCount > size) {
    throw new RangeError('eliteCount debe estar en [1, populationSize]');
  }
  const tournamentSize = options.tournamentSize ?? 3;
  if (!Number.isInteger(tournamentSize) || tournamentSize < 1) {
    throw new RangeError('tournamentSize debe ser un entero >= 1');
  }
  const mutationRate = assertRate(options.mutationRate, 0.12, 'mutationRate');
  const crossoverRate = assertRate(options.crossoverRate, 0.6, 'crossoverRate');
  const mutationScale = options.mutationScale ?? 0.25;
  if (!Number.isFinite(mutationScale) || mutationScale <= 0) {
    throw new RangeError('mutationScale debe ser > 0');
  }
  const rng = options.rng;
  const expected = countWeights(topology);

  let population: readonly Brain[] = Array.from({ length: size }, () =>
    createBrain({
      gameId,
      gameVersion,
      topology,
      weights: randomWeights(topology, rng),
      meta: { seed: options.seed, score: 0 },
    }),
  );
  let generation = 0;
  const history: EvolutionResult[] = [];

  function scoreOf(value: number, index: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`fitness devolvió un valor no finito en el individuo ${index}`);
    }
    return value;
  }

  function tournament(ranked: readonly ScoredBrain[]): ScoredBrain {
    let winner = ranked[rng.int(ranked.length)] as ScoredBrain;
    for (let i = 1; i < tournamentSize; i++) {
      const challenger = ranked[rng.int(ranked.length)] as ScoredBrain;
      if (
        challenger.fitness > winner.fitness ||
        (challenger.fitness === winner.fitness && challenger.index < winner.index)
      ) {
        winner = challenger;
      }
    }
    return winner;
  }

  function childOf(a: Brain, b: Brain): Brain {
    const source = rng.next() < crossoverRate ? crossoverWeights(a.weights, b.weights, rng, 0.5) : cloneWeights(a.weights);
    if (source.length !== expected) {
      throw new Error('genoma de tamaño inesperado');
    }
    return createBrain({
      gameId,
      gameVersion,
      topology,
      weights: mutateWeights(source, rng, mutationRate, mutationScale),
      meta: { seed: options.seed, score: 0 },
    });
  }

  return {
    get generation(): number {
      return generation;
    },
    get population(): readonly Brain[] {
      return population;
    },
    get history(): readonly EvolutionResult[] {
      return history;
    },
    step(fitness: (brain: Brain, index: number) => number): EvolutionResult {
      const scored: ScoredBrain[] = population.map((brain, index) => ({
        brain,
        fitness: scoreOf(fitness(brain, index), index),
        index,
      }));
      const ranked = scored.slice().sort((a, b) => b.fitness - a.fitness || a.index - b.index);
      const winner = ranked[0] as ScoredBrain;
      generation++;
      const result: EvolutionResult = {
        generation,
        best: withBrainScore(winner.brain, winner.fitness),
        bestFitness: winner.fitness,
        ranked: ranked.map((entry) => ({ ...entry })),
      };
      history.push(result);

      const next: Brain[] = [];
      for (let i = 0; i < eliteCount; i++) {
        const elite = ranked[i] as ScoredBrain;
        next.push(withBrainScore(elite.brain, elite.fitness));
      }
      while (next.length < size) {
        const a = tournament(ranked);
        const b = tournament(ranked);
        next.push(childOf(a.brain, b.brain));
      }
      population = next;
      return result;
    },
  };
}
