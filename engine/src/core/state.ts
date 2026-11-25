/**
 * Snapshot/restore/hash determinista de estado de juego.
 * El estado debe ser datos planos (sin funciones, sin referencias al DOM).
 */

export interface StateOps<S extends object> {
  snapshot(state: S): S;
  /** Restaura `state` in place para no romper referencias de los sistemas. */
  restore(state: S, snapshot: S): void;
  /** Hash FNV-1a sobre serialización estable. No usar JSON.stringify directo. */
  hash(state: S): string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function stableStringify(value: unknown): string {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return '"NaN"';
    if (value === Infinity) return '"Infinity"';
    if (value === -Infinity) return '"-Infinity"';
    return String(value);
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, '0')}-${input.length.toString(16)}`;
}

function assignInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(target)) {
    if (!(key in source)) delete target[key];
  }
  for (const key of Object.keys(source)) {
    const value = source[key];
    const current = target[key];
    if (isRecord(value) && isRecord(current)) {
      assignInto(current, value);
    } else {
      target[key] = clone(value);
    }
  }
}

export function createStateOps<S extends object>(): StateOps<S> {
  return {
    snapshot(state: S): S {
      return clone(state);
    },
    restore(state: S, snapshot: S): void {
      assignInto(state as Record<string, unknown>, snapshot as Record<string, unknown>);
    },
    hash(state: S): string {
      return hashString(stableStringify(state));
    },
  };
}
