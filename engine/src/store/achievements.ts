/** Logros versionados. Igual que los récords: la IA no desbloquea logros humanos. */

import { createStorage, type Store, type StorageSchema } from './storage.js';
import type { ScoreOwner } from './scores.js';

export const ACHIEVEMENTS_VERSION = 1;

export interface AchievementDefinition {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
}

export interface UnlockOptions {
  readonly owner?: ScoreOwner;
}

export interface Achievements {
  readonly gameId: string;
  readonly key: string;
  has(id: string): boolean;
  /** Devuelve true solo si es un logro humano nuevo y conocido. */
  unlock(id: string, options?: UnlockOptions): boolean;
  list(): readonly string[];
  reset(): void;
}

type UnlockedIds = string[];

export function achievementSchema(
  gameId: string,
  definitions: readonly AchievementDefinition[] = [],
): StorageSchema<UnlockedIds> {
  const known = new Set(definitions.map((definition) => definition.id));

  return {
    key: `arcade.achievements.${gameId}`,
    version: ACHIEVEMENTS_VERSION,
    validate(value: unknown): value is UnlockedIds {
      if (!Array.isArray(value)) return false;
      const seen = new Set<string>();
      for (const entry of value) {
        if (typeof entry !== 'string' || entry.length === 0) return false;
        if (known.size > 0 && !known.has(entry)) return false;
        if (seen.has(entry)) return false;
        seen.add(entry);
      }
      return true;
    },
    migrate(value: unknown): UnlockedIds | null {
      // v0 era un array plano sin sobre.
      return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
        ? (value as string[])
        : null;
    },
  };
}

export function createAchievements(options: {
  gameId: string;
  definitions?: readonly AchievementDefinition[];
  store?: Store;
}): Achievements {
  if (!options.gameId) throw new RangeError('createAchievements: gameId es obligatorio');
  const definitions = options.definitions ?? [];
  const store = options.store ?? createStorage();
  const schema = achievementSchema(options.gameId, definitions);
  const known = new Set(definitions.map((definition) => definition.id));

  function load(): UnlockedIds {
    const stored = store.load(schema);
    return Array.isArray(stored) ? [...stored] : [];
  }

  return {
    gameId: options.gameId,
    key: schema.key,
    has(id: string): boolean {
      return load().includes(id);
    },
    unlock(id: string, unlockOptions: UnlockOptions = {}): boolean {
      if ((unlockOptions.owner ?? 'human') === 'ai') return false;
      if (id.length === 0) return false;
      if (known.size > 0 && !known.has(id)) return false;
      const unlocked = load();
      if (unlocked.includes(id)) return false;
      unlocked.push(id);
      return store.save(schema, unlocked);
    },
    list(): readonly string[] {
      return load();
    },
    reset(): void {
      store.remove(schema.key);
    },
  };
}
