import {
  countWeights,
  deserializeWeights,
  parseTopology,
  serializeWeights,
  type Topology,
} from './mlp.js';

/** Cerebro versionado, validado y autenticado por checksum determinista. */

export const BRAIN_FORMAT_VERSION = 1;

export interface BrainMeta {
  /** Semilla del experimento que produjo el cerebro. */
  readonly seed: number;
  /** Aptitud observada (se recalcula al reevaluar). */
  readonly score: number;
}

export interface Brain {
  readonly v: number;
  readonly gameId: string;
  readonly gameVersion: string;
  readonly topology: Topology;
  readonly weights: Float32Array;
  readonly meta: BrainMeta;
  readonly checksum: string;
}

/** Formato de intercambio: pesos hexadecimales, sin Float32Array en JSON. */
export interface BrainJSON {
  readonly v: number;
  readonly gameId: string;
  readonly gameVersion: string;
  readonly topology: Topology;
  readonly weights: string;
  readonly meta: BrainMeta;
  readonly checksum: string;
}

export class BrainValidationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'BrainValidationError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  if (actual.length !== keys.length || actual.some((key, i) => key !== keys[i])) {
    throw new BrainValidationError(`${label}: claves incorrectas`);
  }
}

function assertText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0 || /[\u0000-\u001f]/.test(value)) {
    throw new BrainValidationError(`${label}: texto no válido`);
  }
  return value;
}

function assertMeta(value: unknown): BrainMeta {
  if (!isRecord(value)) throw new BrainValidationError('meta debe ser un objeto');
  assertKeys(value, ['score', 'seed'], 'meta');
  if (!Number.isInteger(value['seed'])) {
    throw new BrainValidationError('meta.seed debe ser un entero finito');
  }
  if (typeof value['score'] !== 'number' || !Number.isFinite(value['score'])) {
    throw new BrainValidationError('meta.score debe ser un número finito');
  }
  return { seed: value['seed'] as number, score: value['score'] as number };
}

/** FNV-1a sobre representación canónica estable (no JSON.stringify directo). */
function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, '0')}-${input.length.toString(16)}`;
}

function checksumOf(
  gameId: string,
  gameVersion: string,
  topology: Topology,
  weights: Float32Array,
  meta: BrainMeta,
): string {
  const canonical = JSON.stringify({
    v: BRAIN_FORMAT_VERSION,
    gameId,
    gameVersion,
    topology: [
      topology.inputs,
      topology.hidden,
      topology.outputs,
      topology.activation,
      topology.outputActivation,
    ],
    weights: serializeWeights(weights),
    meta: [meta.seed, meta.score],
  });
  return hashString(canonical);
}

export interface CreateBrainInput {
  readonly gameId: string;
  readonly gameVersion: string;
  readonly topology: Topology;
  readonly weights: Float32Array | readonly number[];
  readonly meta: BrainMeta;
}

/** Crea y sella un cerebro. Copia los pesos y valida toda la forma. */
export function createBrain(input: CreateBrainInput): Brain {
  const topology = parseTopology(input.topology);
  const gameId = assertText(input.gameId, 'gameId');
  const gameVersion = assertText(input.gameVersion, 'gameVersion');
  const meta = assertMeta(input.meta);
  const weights = Float32Array.from(input.weights);
  const expected = countWeights(topology);
  if (weights.length !== expected) {
    throw new BrainValidationError(`weights: se esperaban ${expected} pesos, hay ${weights.length}`);
  }
  for (let i = 0; i < weights.length; i++) {
    if (!Number.isFinite(weights[i])) {
      throw new BrainValidationError(`weights[${i}]: valor no finito`);
    }
  }
  return Object.freeze({
    v: BRAIN_FORMAT_VERSION,
    gameId,
    gameVersion,
    topology,
    weights,
    meta,
    checksum: checksumOf(gameId, gameVersion, topology, weights, meta),
  });
}

/** Copia el cerebro cambiando solo la puntuación (recalcula el checksum). */
export function withBrainScore(brain: Brain, score: number): Brain {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new BrainValidationError('score debe ser un número finito');
  }
  return createBrain({
    gameId: brain.gameId,
    gameVersion: brain.gameVersion,
    topology: brain.topology,
    weights: brain.weights,
    meta: { seed: brain.meta.seed, score },
  });
}

export function cloneBrain(brain: Brain): Brain {
  assertBrain(brain);
  return createBrain({
    gameId: brain.gameId,
    gameVersion: brain.gameVersion,
    topology: brain.topology,
    weights: brain.weights,
    meta: brain.meta,
  });
}

export function brainToJSON(brain: Brain): BrainJSON {
  return {
    v: brain.v,
    gameId: brain.gameId,
    gameVersion: brain.gameVersion,
    topology: brain.topology,
    weights: serializeWeights(brain.weights),
    meta: brain.meta,
    checksum: brain.checksum,
  };
}

export function serializeBrain(brain: Brain): string {
  return JSON.stringify(brainToJSON(brain));
}

/** Valida forma, finitud y checksum de un cerebro en memoria. */
export function assertBrain(brain: Brain): Brain {
  if (!isRecord(brain)) throw new BrainValidationError('cerebro: se esperaba un objeto');
  assertKeys(brain as unknown as Record<string, unknown>, [
    'checksum',
    'gameId',
    'gameVersion',
    'meta',
    'topology',
    'v',
    'weights',
  ], 'cerebro');
  if (brain.v !== BRAIN_FORMAT_VERSION) {
    throw new BrainValidationError(`cerebro: versión ${String(brain.v)} no soportada`);
  }
  assertText(brain.gameId, 'gameId');
  assertText(brain.gameVersion, 'gameVersion');
  if (!(brain.weights instanceof Float32Array)) {
    throw new BrainValidationError('weights debe ser Float32Array');
  }
  const topology = parseTopology(brain.topology);
  if (brain.weights.length !== countWeights(topology)) {
    throw new BrainValidationError('weights: longitud incompatible con topology');
  }
  for (let i = 0; i < brain.weights.length; i++) {
    if (!Number.isFinite(brain.weights[i])) {
      throw new BrainValidationError(`weights[${i}]: valor no finito`);
    }
  }
  assertMeta(brain.meta);
  if (typeof brain.checksum !== 'string') {
    throw new BrainValidationError('checksum debe ser una cadena');
  }
  const expected = checksumOf(
    brain.gameId,
    brain.gameVersion,
    topology,
    brain.weights,
    brain.meta,
  );
  if (brain.checksum !== expected) {
    throw new BrainValidationError('checksum no coincide: cerebro manipulado');
  }
  return brain;
}

/** Comprueba integridad sin lanzar; útil para descartar datos corruptos. */
export function verifyBrain(brain: Brain): boolean {
  try {
    assertBrain(brain);
    return true;
  } catch {
    return false;
  }
}

/** Valida un objeto ya parseado con forma y checksum estrictos. */
export function parseBrainJSON(value: unknown): Brain {
  if (!isRecord(value)) throw new BrainValidationError('cerebro: se esperaba un objeto');
  assertKeys(value, [
    'checksum',
    'gameId',
    'gameVersion',
    'meta',
    'topology',
    'v',
    'weights',
  ], 'cerebro');
  if (value['v'] !== BRAIN_FORMAT_VERSION) {
    throw new BrainValidationError(`cerebro: versión ${String(value['v'])} no soportada`);
  }
  const gameId = assertText(value['gameId'], 'gameId');
  const gameVersion = assertText(value['gameVersion'], 'gameVersion');
  let topology: Topology;
  try {
    topology = parseTopology(value['topology']);
  } catch (error) {
    throw new BrainValidationError(`topology no válida: ${String(error)}`, error);
  }
  const meta = assertMeta(value['meta']);
  if (typeof value['weights'] !== 'string') {
    throw new BrainValidationError('weights debe ser una cadena hexadecimal');
  }
  let weights: Float32Array;
  try {
    weights = deserializeWeights(value['weights'], countWeights(topology));
  } catch (error) {
    throw new BrainValidationError(`weights no válidos: ${String(error)}`, error);
  }
  for (let i = 0; i < weights.length; i++) {
    if (!Number.isFinite(weights[i])) {
      throw new BrainValidationError(`weights[${i}]: valor no finito`);
    }
  }
  if (typeof value['checksum'] !== 'string') {
    throw new BrainValidationError('checksum debe ser una cadena');
  }
  const brain = createBrain({ gameId, gameVersion, topology, weights, meta });
  if (brain.checksum !== value['checksum']) {
    throw new BrainValidationError('checksum no coincide: cerebro manipulado');
  }
  return brain;
}

export function parseBrain(text: string): Brain {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    throw new BrainValidationError('JSON del cerebro no válido', error);
  }
  return parseBrainJSON(value);
}
