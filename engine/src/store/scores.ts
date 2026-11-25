/** Récords versionados, separados por modo. La IA nunca escribe récords humanos. */

import type { GameMode } from '../game/contract.js';
import { createStorage, type Store, type StorageSchema } from './storage.js';

export const SCORES_VERSION = 1;
export const SCORE_MODES: readonly GameMode[] = ['solo', 'local', 'vsAI', 'online', 'demo'];

export type ScoreOwner = 'human' | 'ai';

export interface ScoreSubmitOptions {
  readonly owner?: ScoreOwner;
}

export interface Scores {
  readonly gameId: string;
  readonly key: string;
  get(mode: GameMode): number;
  best(): Readonly<Partial<Record<GameMode, number>>>;
  /** Devuelve true solo si se escribe un récord humano nuevo. */
  submit(mode: GameMode, score: number, options?: ScoreSubmitOptions): boolean;
  reset(mode?: GameMode): void;
}

type ScoreTable = Record<string, number>;

function isScoreTable(value: unknown): value is ScoreTable {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  for (const [key, entry] of Object.entries(value)) {
    if (!SCORE_MODES.includes(key as GameMode)) return false;
    if (typeof entry !== 'number' || !Number.isFinite(entry) || entry < 0) return false;
  }
  return true;
}

export function scoreSchema(gameId: string): StorageSchema<ScoreTable> {
  return {
    key: `arcade.scores.${gameId}`,
    version: SCORES_VERSION,
    validate: isScoreTable,
    migrate(value: unknown): ScoreTable | null {
      // v0 guardaba la tabla sin sobre; se acepta solo si ya es válida.
      return isScoreTable(value) ? value : null;
    },
  };
}

export function createScores(options: { gameId: string; store?: Store }): Scores {
  if (!options.gameId) throw new RangeError('createScores: gameId es obligatorio');
  const store = options.store ?? createStorage();
  const schema = scoreSchema(options.gameId);

  function load(): ScoreTable {
    return { ...(store.load(schema) ?? {}) };
  }

  return {
    gameId: options.gameId,
    key: schema.key,
    get(mode: GameMode): number {
      if (!SCORE_MODES.includes(mode)) return 0;
      return load()[mode] ?? 0;
    },
    best(): Readonly<Partial<Record<GameMode, number>>> {
      return { ...load() };
    },
    submit(mode: GameMode, score: number, submitOptions: ScoreSubmitOptions = {}): boolean {
      if ((submitOptions.owner ?? 'human') === 'ai') return false;
      if (!SCORE_MODES.includes(mode)) return false;
      if (!Number.isFinite(score) || score < 0) return false;

      const table = load();
      if (score <= (table[mode] ?? 0)) return false;
      table[mode] = score;
      return store.save(schema, table);
    },
    reset(mode?: GameMode): void {
      if (mode === undefined) {
        store.remove(schema.key);
        return;
      }
      if (!SCORE_MODES.includes(mode)) return;
      const table = load();
      delete table[mode];
      if (Object.keys(table).length === 0) store.remove(schema.key);
      else store.save(schema, table);
    },
  };
}
