import { createRNG } from '../core/rng.js';
import { createSimulation } from '../core/simulation.js';
import { gameSimulationOptions } from '../game/adapter.js';
import type { GameDefinition } from '../game/contract.js';
import type { InputFrame } from '../input/virtual.js';
import { NeuralBot } from './agents.js';
import { withBrainScore, type Brain } from './brain.js';
import type { BrainCheckpoint } from './difficulty.js';
import { createEvolver } from './evolution.js';
import { defineTopology, serializeWeights, type Topology } from './mlp.js';

/**
 * Entrenador headless: corre el mismo step() del juego, sin DOM ni reloj real.
 * La evaluación final usa semillas nunca vistas durante el entrenamiento.
 */

export interface TrainOptions<S extends object> {
  readonly game: GameDefinition<S>;
  readonly seed: number;
  readonly generations: number;
  readonly population: number;
  readonly ticksPerEval?: number;
  readonly inputsAt?: (tick: number) => InputFrame;
  /** Sobrescribe `rules.fitness` si se desea; por defecto se usa la del juego. */
  readonly fitness?: (state: S) => number;
  readonly topology?: Topology;
  readonly playerId?: number;
  readonly validationSeeds?: number;
  readonly eliteCount?: number;
  readonly tournamentSize?: number;
  readonly mutationRate?: number;
  readonly mutationScale?: number;
  readonly crossoverRate?: number;
}

export interface ValidationReport {
  readonly seeds: readonly number[];
  readonly scores: readonly number[];
  readonly median: number;
  readonly worst: number;
}

export interface TrainingGeneration {
  readonly generation: number;
  readonly bestFitness: number;
  readonly medianFitness: number;
  readonly worstFitness: number;
  readonly bestChecksum: string;
}

export interface TrainResult {
  readonly gameId: string;
  readonly gameVersion: string;
  readonly champion: Brain;
  /** Semillas usadas durante el entrenamiento (nunca coinciden con validation.seeds). */
  readonly trainingSeeds: readonly number[];
  readonly validation: ValidationReport;
  readonly history: readonly TrainingGeneration[];
  readonly checkpoints: readonly BrainCheckpoint[];
  readonly generations: number;
  readonly population: number;
  readonly ticksPerEval: number;
}

function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('median: lista vacía');
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

export function trainHeadless<S extends object>(options: TrainOptions<S>): TrainResult {
  const game = options.game;
  const observe = game.observe;
  if (typeof observe !== 'function') {
    throw new TypeError('trainHeadless: el juego debe implementar observe(state, playerId)');
  }
  const readObservation: (state: S, playerId: number) => Float32Array = observe;
  if (!Number.isInteger(options.generations) || options.generations < 1) {
    throw new RangeError('generations debe ser un entero >= 1');
  }
  if (!Number.isInteger(options.seed)) throw new RangeError('seed debe ser un entero');
  const ticks = options.ticksPerEval ?? 240;
  if (!Number.isInteger(ticks) || ticks < 1) throw new RangeError('ticksPerEval debe ser >= 1');
  const playerId = options.playerId ?? 0;
  const validationCount = options.validationSeeds ?? 9;
  if (!Number.isInteger(validationCount) || validationCount < 1) {
    throw new RangeError('validationSeeds debe ser un entero >= 1');
  }

  // Un único generador de semillas: las de validación se apartan primero y
  // nunca se usan en el entrenamiento.
  const seedRng = createRNG(options.seed ^ 0x5eed1234);
  const usedSeeds = new Set<number>();
  function newSeed(): number {
    let candidate = 0;
    do {
      candidate = seedRng.int(0x7ffffffe) + 1;
    } while (usedSeeds.has(candidate));
    usedSeeds.add(candidate);
    return candidate;
  }
  const validationSeeds = Array.from({ length: validationCount }, () => newSeed());

  const probe = createSimulation(gameSimulationOptions(game, { seed: options.seed }));
  const inputs = readObservation(probe.state, playerId);
  if (!(inputs instanceof Float32Array) || inputs.length === 0) {
    throw new TypeError('trainHeadless: observe debe devolver un Float32Array no vacío');
  }
  const topology: Topology = defineTopology(
    options.topology ?? {
      inputs: inputs.length,
      hidden: [8],
      outputs: game.actions.length,
      activation: 'tanh',
      outputActivation: 'tanh',
    },
  );
  if (topology.inputs !== inputs.length || topology.outputs !== game.actions.length) {
    throw new RangeError('topology incompatible con observe() o con game.actions');
  }

  function evaluate(brain: Brain, evalSeed: number): number {
    const simulation = createSimulation(gameSimulationOptions(game, { seed: evalSeed }));
    const bot = new NeuralBot(brain, game.actions);
    for (let tick = 1; tick <= ticks; tick++) {
      const obs = readObservation(simulation.state, playerId);
      let frame: InputFrame = bot.act(obs);
      const extra = options.inputsAt?.(tick);
      if (extra !== undefined && extra.length > 0) {
        frame = [...new Set([...frame, ...extra])];
      }
      simulation.tick(frame);
      if (game.rules.isOver(simulation.state)) break;
    }
    const raw = options.fitness?.(simulation.state) ?? game.rules.fitness(simulation.state);
    return Number.isFinite(raw) ? raw : -Infinity;
  }

  const evolver = createEvolver({
    rng: createRNG(options.seed ^ 0x1a2b3c4d),
    topology,
    populationSize: options.population,
    seed: options.seed,
    gameId: game.id,
    gameVersion: '0',
    ...(options.eliteCount !== undefined ? { eliteCount: options.eliteCount } : {}),
    ...(options.tournamentSize !== undefined ? { tournamentSize: options.tournamentSize } : {}),
    ...(options.mutationRate !== undefined ? { mutationRate: options.mutationRate } : {}),
    ...(options.mutationScale !== undefined ? { mutationScale: options.mutationScale } : {}),
    ...(options.crossoverRate !== undefined ? { crossoverRate: options.crossoverRate } : {}),
  });

  const history: TrainingGeneration[] = [];
  const checkpoints: BrainCheckpoint[] = [];
  const trainingSeeds: number[] = [];
  for (let generation = 1; generation <= options.generations; generation++) {
    const scores: number[] = [];
    const result = evolver.step((brain) => {
      const seed = newSeed();
      trainingSeeds.push(seed);
      const fitness = evaluate(brain, seed);
      scores.push(fitness);
      return fitness;
    });
    history.push({
      generation: result.generation,
      bestFitness: result.bestFitness,
      medianFitness: median(scores),
      worstFitness: Math.min(...scores),
      bestChecksum: result.best.checksum,
    });
    checkpoints.push({ generation: result.generation, brain: result.best });
  }

  // Campeonato con semillas nuevas: gana la mediana, decide el peor caso.
  const candidates: Brain[] = [];
  const seen = new Set<string>();
  const add = (brain: Brain): void => {
    const key = serializeWeights(brain.weights);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(brain);
  };
  for (const checkpoint of checkpoints) add(checkpoint.brain);
  const last = evolver.history[evolver.history.length - 1];
  if (last !== undefined) {
    for (const entry of last.ranked.slice(0, 3)) add(entry.brain);
  }

  interface ValidationEntry {
    readonly brain: Brain;
    readonly scores: readonly number[];
    readonly median: number;
    readonly worst: number;
  }
  let winner: ValidationEntry | null = null;
  for (const candidate of candidates) {
    const scores = validationSeeds.map((seed) => evaluate(candidate, seed));
    const entry: ValidationEntry = {
      brain: candidate,
      scores,
      median: median(scores),
      worst: Math.min(...scores),
    };
    if (winner === null) {
      winner = entry;
      continue;
    }
    const better =
      entry.median > winner.median ||
      (entry.median === winner.median && entry.worst > winner.worst) ||
      (entry.median === winner.median &&
        entry.worst === winner.worst &&
        serializeWeights(entry.brain.weights) < serializeWeights(winner.brain.weights));
    if (better) winner = entry;
  }
  const champion = winner as ValidationEntry;
  const championMedian = champion.median;
  const championWorst = champion.worst;
  const championScores = champion.scores;

  return {
    gameId: game.id,
    gameVersion: '0',
    champion: withBrainScore(champion.brain, championMedian),
    trainingSeeds,
    validation: {
      seeds: validationSeeds,
      scores: championScores,
      median: championMedian,
      worst: championWorst,
    },
    history,
    checkpoints,
    generations: options.generations,
    population: options.population,
    ticksPerEval: ticks,
  };
}
