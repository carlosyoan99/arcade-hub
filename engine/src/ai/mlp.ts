import type { RNG } from '../core/rng.js';

/** Redes pequeñas sin dependencias: solo aritmética y el RNG inyectado. */

export type Activation = 'tanh' | 'sigmoid' | 'relu';

export const ACTIVATIONS: readonly Activation[] = ['tanh', 'sigmoid', 'relu'];

/** Topología canónica. `hidden` son los tamaños de las capas ocultas. */
export interface Topology {
  readonly inputs: number;
  readonly hidden: readonly number[];
  readonly outputs: number;
  readonly activation: Activation;
  readonly outputActivation: Activation;
}

export interface MLP {
  readonly topology: Topology;
  /** Copia de los pesos en formato plano (por capa: matriz fila-mayor y sesgos). */
  readonly weights: Float32Array;
  forward(input: Float32Array): Float32Array;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertActivation(value: unknown, field: string): Activation {
  if (typeof value !== 'string' || !ACTIVATIONS.includes(value as Activation)) {
    throw new TypeError(`${field} debe ser una activación válida (tanh|sigmoid|relu)`);
  }
  return value as Activation;
}

function assertSize(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 4096) {
    throw new RangeError(`${field} debe ser un entero entre 1 y 4096`);
  }
  return value as number;
}

/**
 * Valida una topología que viene de JSON (forma estricta, sin claves extra).
 * La misma validación la usa el cerebro al cargar.
 */
export function parseTopology(value: unknown): Topology {
  if (!isRecord(value)) throw new TypeError('topology debe ser un objeto');
  const keys = Object.keys(value).sort();
  const expected = ['activation', 'hidden', 'inputs', 'outputActivation', 'outputs'];
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
    throw new TypeError('topology tiene claves incorrectas');
  }
  if (!Array.isArray(value['hidden']) || value['hidden'].length > 4) {
    throw new RangeError('topology.hidden debe ser un array de hasta 4 capas');
  }
  return {
    inputs: assertSize(value['inputs'], 'topology.inputs'),
    hidden: value['hidden'].map((size, i) => assertSize(size, `topology.hidden[${i}]`)),
    outputs: assertSize(value['outputs'], 'topology.outputs'),
    activation: assertActivation(value['activation'], 'topology.activation'),
    outputActivation: assertActivation(value['outputActivation'], 'topology.outputActivation'),
  };
}

/** Normaliza y valida una topología declarada en código. */
export function defineTopology(topology: {
  readonly inputs: number;
  readonly outputs: number;
  readonly hidden?: readonly number[];
  readonly activation?: Activation;
  readonly outputActivation?: Activation;
}): Topology {
  return parseTopology({
    inputs: topology.inputs,
    hidden: topology.hidden ?? [],
    outputs: topology.outputs,
    activation: topology.activation ?? 'tanh',
    outputActivation: topology.outputActivation ?? 'tanh',
  });
}

/** Número de escalares: por capa, `out * in` pesos más `out` sesgos. */
export function countWeights(topology: Topology): number {
  const sizes = [topology.inputs, ...topology.hidden, topology.outputs];
  let total = 0;
  for (let layer = 1; layer < sizes.length; layer++) {
    total += (sizes[layer] ?? 0) * ((sizes[layer - 1] ?? 0) + 1);
  }
  return total;
}

export function sameTopology(a: Topology, b: Topology): boolean {
  return (
    a.inputs === b.inputs &&
    a.outputs === b.outputs &&
    a.activation === b.activation &&
    a.outputActivation === b.outputActivation &&
    a.hidden.length === b.hidden.length &&
    a.hidden.every((size, i) => size === b.hidden[i])
  );
}

export function cloneWeights(weights: Float32Array): Float32Array {
  return Float32Array.from(weights);
}

/** Inicialización aleatoria using SIEMPRE el RNG inyectado. */
export function randomWeights(topology: Topology, rng: RNG): Float32Array {
  const weights = new Float32Array(countWeights(topology));
  for (let i = 0; i < weights.length; i++) {
    weights[i] = Math.fround(rng.range(-1, 1));
  }
  return weights;
}

function activate(value: number, activation: Activation): number {
  switch (activation) {
    case 'tanh':
      return Math.tanh(value);
    case 'sigmoid':
      return value >= 0 ? 1 / (1 + Math.exp(-value)) : Math.exp(value) / (1 + Math.exp(value));
    case 'relu':
      return value > 0 ? value : 0;
  }
}

/** Serialización determinista: 4 bytes little-endian por peso, en hexadecimal. */
export function serializeWeights(weights: Float32Array): string {
  const view = new DataView(new ArrayBuffer(weights.length * 4));
  for (let i = 0; i < weights.length; i++) {
    view.setFloat32(i * 4, weights[i] ?? 0, true);
  }
  let hex = '';
  for (let i = 0; i < view.byteLength; i++) {
    hex += view.getUint8(i).toString(16).padStart(2, '0');
  }
  return hex;
}

export function deserializeWeights(hex: string, expectedLength?: number): Float32Array {
  if (typeof hex !== 'string' || hex.length % 8 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new TypeError('weights debe ser una cadena hexadecimal de floats de 32 bits');
  }
  const bytes = hex.length / 2;
  const expectedBytes = expectedLength === undefined ? undefined : expectedLength * 4;
  if (expectedBytes !== undefined && bytes !== expectedBytes) {
    throw new RangeError(`weights: se esperaban ${expectedLength} pesos, hay ${bytes / 4}`);
  }
  const buffer = new ArrayBuffer(bytes);
  const bytesView = new Uint8Array(buffer);
  for (let i = 0; i < bytes; i++) {
    bytesView[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const view = new DataView(buffer);
  const weights = new Float32Array(weightsCount(bytes));
  for (let i = 0; i < weights.length; i++) {
    weights[i] = view.getFloat32(i * 4, true);
  }
  return weights;
}

function weightsCount(bytes: number): number {
  return bytes / 4;
}

/** Envuelve pesos ya validados. Nunca los comparte con el llamador. */
export function createMLP(topology: Topology, weights: Float32Array | readonly number[]): MLP {
  const shape = parseTopology(topology);
  const data = weights instanceof Float32Array ? cloneWeights(weights) : Float32Array.from(weights);
  if (data.length !== countWeights(shape)) {
    throw new RangeError(`createMLP: se esperaban ${countWeights(shape)} pesos, hay ${data.length}`);
  }
  for (let i = 0; i < data.length; i++) {
    if (!Number.isFinite(data[i])) throw new RangeError(`createMLP: peso ${i} no es finito`);
  }

  return {
    topology: shape,
    weights: data,
    forward(input: Float32Array): Float32Array {
      if (!(input instanceof Float32Array) || input.length !== shape.inputs) {
        throw new RangeError(`forward: se esperaban ${shape.inputs} entradas`);
      }
      let current = Float32Array.from(input);
      const sizes = [shape.inputs, ...shape.hidden, shape.outputs];
      let offset = 0;
      for (let layer = 1; layer < sizes.length; layer++) {
        const out = sizes[layer] ?? 0;
        const inCount = sizes[layer - 1] ?? 0;
        const next = new Float32Array(out);
        const activation = layer === sizes.length - 1 ? shape.outputActivation : shape.activation;
        for (let j = 0; j < out; j++) {
          let sum = weightsAt(data, offset + out * inCount + j);
          for (let i = 0; i < inCount; i++) {
            sum += weightsAt(data, offset + j * inCount + i) * (current[i] ?? 0);
          }
          next[j] = Math.fround(activate(sum, activation));
        }
        offset += out * inCount + out;
        current = next;
      }
      return current;
    },
  };
}

function weightsAt(weights: Float32Array, index: number): number {
  return weights[index] ?? 0;
}
