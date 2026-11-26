/**
 * Lockstep determinista: una cinta de inputs por tick con delay local y
 * verificación periódica de hashes. No conoce sockets, render ni audio.
 */
import type { InputFrame } from '../input/virtual.js';
import { HASH_INTERVAL, type HashEntry } from './protocol.js';

export interface DesyncReport {
  readonly tick: number;
  readonly hashes: readonly HashEntry[];
}

export interface LockstepConfig {
  /** Participantes que deben aportar input en cada tick (jugadores, no espectadores). */
  readonly players: readonly string[];
  readonly localId: string;
  /** Un espectador arma la cinta pero no aporta input: false. Default true. */
  readonly requireLocalInput?: boolean;
  /** Delay local en ticks (2 o 3). Default 2. */
  readonly delay?: 2 | 3;
  readonly hashInterval?: number;
  onInput?(tick: number, actions: InputFrame): void;
  onDesync?(report: DesyncReport): void;
}

export interface LockstepController {
  readonly delay: 2 | 3;
  readonly hashInterval: number;
  readonly localId: string;
  players(): readonly string[];
  addPlayer(id: string, fromTick?: number): void;
  removePlayer(id: string): void;
  /** Registra el input local para currentTick + delay y lo publica vía onInput. */
  submitLocal(currentTick: number, actions: InputFrame): number;
  /** Registra el input de cualquier participante ya fechado en tick. */
  submit(playerId: string, tick: number, actions: InputFrame): InputFrame;
  hasFrame(tick: number): boolean;
  /** Entrega la cinta combinada de tick, o undefined si faltan inputs (stall). */
  advance(tick: number): InputFrame | undefined;
  recordHash(from: string, tick: number, value: string): void;
  /** Solo informa en ticks múltiplos de hashInterval; una vez por tick. */
  checkHashes(tick: number): DesyncReport | undefined;
  reset(): void;
}

function canonical(actions: InputFrame): InputFrame {
  return [...new Set(actions)].sort();
}

function requireTick(tick: number): void {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError(`tick inválido: ${String(tick)}`);
  }
}

export function createLockstep(config: LockstepConfig): LockstepController {
  const delay = config.delay ?? 2;
  const hashInterval = config.hashInterval ?? HASH_INTERVAL;
  if (!Number.isSafeInteger(hashInterval) || hashInterval <= 0) {
    throw new RangeError('hashInterval debe ser un entero positivo');
  }

  const ids = new Set<string>(config.players);
  if (config.requireLocalInput !== false) ids.add(config.localId);
  const joinedAt = new Map<string, number>();
  for (const id of ids) joinedAt.set(id, 0);

  const frames = new Map<number, Map<string, InputFrame>>();
  const hashes = new Map<number, Map<string, string>>();
  const reported = new Set<number>();
  let lastAdvanced = -1;
  let lastFrame: InputFrame | undefined;

  const activeAt = (tick: number): string[] =>
    [...ids].filter((id) => (joinedAt.get(id) ?? 0) <= tick).sort();

  return {
    delay,
    hashInterval,
    localId: config.localId,
    players(): readonly string[] {
      return [...ids].sort();
    },
    addPlayer(id: string, fromTick: number = lastAdvanced + 1): void {
      if (ids.has(id)) return;
      requireTick(fromTick);
      ids.add(id);
      joinedAt.set(id, fromTick);
    },
    removePlayer(id: string): void {
      ids.delete(id);
      joinedAt.delete(id);
      for (const byPlayer of frames.values()) byPlayer.delete(id);
      for (const byPlayer of hashes.values()) byPlayer.delete(id);
    },
    submitLocal(currentTick: number, actions: InputFrame): number {
      requireTick(currentTick);
      const tick = currentTick + delay;
      const frame = this.submit(config.localId, tick, actions);
      config.onInput?.(tick, frame);
      return tick;
    },
    submit(playerId: string, tick: number, actions: InputFrame): InputFrame {
      requireTick(tick);
      if (!ids.has(playerId)) throw new Error(`jugador desconocido: ${playerId}`);
      const frame = canonical(actions);
      let byPlayer = frames.get(tick);
      if (byPlayer === undefined) {
        byPlayer = new Map();
        frames.set(tick, byPlayer);
      }
      byPlayer.set(playerId, frame);
      return frame;
    },
    hasFrame(tick: number): boolean {
      const byPlayer = frames.get(tick);
      return byPlayer !== undefined && activeAt(tick).every((id) => byPlayer.has(id));
    },
    advance(tick: number): InputFrame | undefined {
      requireTick(tick);
      if (tick < lastAdvanced) throw new RangeError('tick fuera de orden');
      if (tick === lastAdvanced) return lastFrame;

      const byPlayer = frames.get(tick);
      const active = activeAt(tick);
      if (byPlayer === undefined || active.some((id) => !byPlayer.has(id))) return undefined;

      const tape = canonical(active.flatMap((id) => byPlayer.get(id) ?? []));
      for (const oldTick of frames.keys()) if (oldTick < tick) frames.delete(oldTick);
      frames.delete(tick);
      lastAdvanced = tick;
      lastFrame = tape;
      return tape;
    },
    recordHash(from: string, tick: number, value: string): void {
      requireTick(tick);
      if (!ids.has(from)) return;
      let byPlayer = hashes.get(tick);
      if (byPlayer === undefined) {
        byPlayer = new Map();
        hashes.set(tick, byPlayer);
      }
      byPlayer.set(from, value);
    },
    checkHashes(tick: number): DesyncReport | undefined {
      requireTick(tick);
      if (tick <= 0 || tick % hashInterval !== 0 || reported.has(tick)) return undefined;
      const byPlayer = hashes.get(tick);
      if (byPlayer === undefined) return undefined;
      const entries = activeAt(tick)
        .filter((id) => byPlayer.has(id))
        .map((id) => ({ from: id, value: byPlayer.get(id) ?? '' }));
      if (new Set(entries.map((entry) => entry.value)).size < 2) return undefined;

      const report: DesyncReport = { tick, hashes: entries };
      reported.add(tick);
      for (const oldTick of hashes.keys()) {
        if (oldTick < tick - 2 * hashInterval) hashes.delete(oldTick);
      }
      for (const oldTick of reported) {
        if (oldTick < tick - 2 * hashInterval) reported.delete(oldTick);
      }
      config.onDesync?.(report);
      return report;
    },
    reset(): void {
      frames.clear();
      hashes.clear();
      reported.clear();
      lastAdvanced = -1;
      lastFrame = undefined;
    },
  };
}
