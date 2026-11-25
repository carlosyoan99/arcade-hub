import type { RNG } from '../core/rng.js';
import type { InputFrame } from '../input/virtual.js';
import type { Brain } from './brain.js';
import { createMLP, type MLP } from './mlp.js';

/** Agentes: devuelven acciones nombradas compatibles con InputFrame. */

export interface Agent {
  act(obs: Float32Array): readonly string[];
}

function uniqueActions(actions: readonly string[]): readonly string[] {
  if (actions.length === 0) throw new RangeError('actions debe contener al menos una acción');
  const seen = new Set<string>();
  for (const action of actions) {
    if (typeof action !== 'string' || action.length === 0) {
      throw new TypeError('actions debe contener nombres no vacíos');
    }
    seen.add(action);
  }
  if (seen.size !== actions.length) throw new TypeError('actions no puede repetir nombres');
  return Object.freeze([...actions]);
}

/** Nivel 0: política por reglas inyectada; el motor no impone reglas de juego. */
export class RuleBot implements Agent {
  readonly actions: readonly string[] | undefined;

  constructor(
    private readonly policy: (obs: Float32Array) => readonly string[],
    actions?: readonly string[],
  ) {
    this.actions = actions === undefined ? undefined : uniqueActions(actions);
  }

  act(obs: Float32Array): readonly string[] {
    const result = this.policy(obs);
    return this.actions === undefined
      ? result
      : result.filter((action) => this.actions?.includes(action));
  }
}

export interface NeuralBotOptions {
  /** `pulse` emite una acción solo cuando cambia (útil para wasPressed). */
  readonly mode?: 'level' | 'pulse';
  /** Si se da, una salida por debajo de este valor significa "no pulsar". */
  readonly threshold?: number;
}

/** Nivel 1: red neuronal pequeña. Una salida por acción, gana la mayor. */
export class NeuralBot implements Agent {
  readonly brain: Brain;
  readonly actions: readonly string[];
  readonly mode: 'level' | 'pulse';
  private readonly network: MLP;
  private readonly threshold: number | undefined;
  private last: string | null = null;

  constructor(brain: Brain, actions: readonly string[], options: NeuralBotOptions = {}) {
    this.actions = uniqueActions(actions);
    if (brain.topology.outputs !== this.actions.length) {
      throw new RangeError('NeuralBot: el número de salidas debe igualar el de acciones');
    }
    if (options.threshold !== undefined && !Number.isFinite(options.threshold)) {
      throw new RangeError('threshold debe ser finito');
    }
    this.brain = brain;
    this.network = createMLP(brain.topology, brain.weights);
    this.mode = options.mode ?? 'pulse';
    this.threshold = options.threshold;
  }

  act(obs: Float32Array): readonly string[] {
    const outputs = this.network.forward(obs);
    let best = 0;
    for (let i = 1; i < outputs.length; i++) {
      if ((outputs[i] ?? 0) > (outputs[best] ?? 0)) best = i;
    }
    const value = outputs[best] ?? 0;
    const action = this.threshold === undefined || value > this.threshold ? this.actions[best] : undefined;
    if (action === undefined) {
      this.last = null;
      return [];
    }
    if (this.mode === 'pulse' && action === this.last) return [];
    this.last = action;
    return [action];
  }

  reset(): void {
    this.last = null;
  }
}

export interface SearchBotOptions {
  readonly actions: readonly string[];
  /** RNG inyectado: también se usa para desempatar y explorar. */
  readonly rng: RNG;
  /** Número de candidatos aleatorios adicionales además de los individuales. */
  readonly depth: number;
  /** Evaluador de un frame de una jugada. Lo aporta el host, no el agente. */
  readonly evaluate: (obs: Float32Array, frame: InputFrame) => number;
  /** Probabilidad de elegir un candidato al azar (error humano inyectable). */
  readonly errorRate?: number;
}

/**
 * Nivel 2 (placeholder honesto): búsqueda codiciosa de un solo paso sobre un
 * conjunto corto de frames. No simula el juego por dentro; `evaluate` decide.
 */
export class SearchBot implements Agent {
  readonly actions: readonly string[];
  private readonly rng: RNG;
  private readonly depth: number;
  private readonly evaluate: (obs: Float32Array, frame: InputFrame) => number;
  private readonly errorRate: number;

  constructor(options: SearchBotOptions) {
    this.actions = uniqueActions(options.actions);
    if (!Number.isInteger(options.depth) || options.depth < 0) {
      throw new RangeError('depth debe ser un entero >= 0');
    }
    const errorRate = options.errorRate ?? 0;
    if (!Number.isFinite(errorRate) || errorRate < 0 || errorRate > 1) {
      throw new RangeError('errorRate debe estar en [0, 1]');
    }
    this.rng = options.rng;
    this.depth = options.depth;
    this.evaluate = options.evaluate;
    this.errorRate = errorRate;
  }

  act(obs: Float32Array): readonly string[] {
    const candidates: InputFrame[] = [[]];
    for (const action of this.actions) candidates.push([action]);
    for (let i = 0; i < this.depth; i++) {
      const frame: string[] = [];
      const count = 1 + this.rng.int(this.actions.length);
      for (let j = 0; j < count; j++) {
        const action = this.actions[this.rng.int(this.actions.length)] as string;
        if (!frame.includes(action)) frame.push(action);
      }
      candidates.push(frame);
    }
    if (this.rng.next() < this.errorRate) {
      return candidates[this.rng.int(candidates.length)] as InputFrame;
    }
    let best = candidates[0] as InputFrame;
    let bestScore = -Infinity;
    for (const frame of candidates) {
      const value = this.evaluate(obs, frame);
      if (Number.isFinite(value) && value > bestScore) {
        best = frame;
        bestScore = value;
      }
    }
    return best;
  }
}

export function createRuleBot(
  policy: (obs: Float32Array) => readonly string[],
  actions?: readonly string[],
): RuleBot {
  return actions === undefined ? new RuleBot(policy) : new RuleBot(policy, actions);
}
