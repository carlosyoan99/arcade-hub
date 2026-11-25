import { describe, expect, it } from 'vitest';
import { createAchievements } from '../src/store/achievements.js';
import { createScores } from '../src/store/scores.js';
import { createStorage, memoryStorage, type StorageSchema } from '../src/store/storage.js';

interface Profile {
  readonly name: string;
  readonly level: number;
}

function isProfile(value: unknown): value is Profile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as { name?: unknown; level?: unknown };
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.level === 'number' &&
    Number.isFinite(candidate.level)
  );
}

const schema: StorageSchema<Profile> = {
  key: 'arcade.profile',
  version: 2,
  validate: isProfile,
  migrate(value: unknown, fromVersion: number): Profile | null {
    if ((fromVersion === 0 || fromVersion === 1) && typeof value === 'object' && value !== null) {
      const legacy = value as { name?: unknown; points?: unknown };
      if (
        typeof legacy.name === 'string' &&
        typeof legacy.points === 'number' &&
        Number.isFinite(legacy.points)
      ) {
        return { name: legacy.name, level: Math.floor(legacy.points / 100) };
      }
    }
    return null;
  },
};

describe('storage versionado', () => {
  it('guarda con clave y versión y carga datos válidos', () => {
    const store = createStorage(memoryStorage());
    expect(store.available).toBe(true);
    expect(store.save(schema, { name: 'Neo', level: 3 })).toBe(true);
    expect(JSON.parse(store.raw('arcade.profile') ?? '{}')).toEqual({
      v: 2,
      data: { name: 'Neo', level: 3 },
    });
    expect(store.load(schema)).toEqual({ name: 'Neo', level: 3 });
  });

  it('migra versiones antiguas (sobre y dato legacy sin sobre)', () => {
    const store = createStorage(
      memoryStorage({
        'arcade.profile': JSON.stringify({ v: 1, data: { name: 'Legacy', points: 250 } }),
      }),
    );
    expect(store.load(schema)).toEqual({ name: 'Legacy', level: 2 });

    const legacy = createStorage(
      memoryStorage({ 'arcade.profile': JSON.stringify({ name: 'Plano', points: 99 }) }),
    );
    expect(legacy.load(schema)).toEqual({ name: 'Plano', level: 0 });
  });

  it('rechaza datos inválidos, corruptos y de versiones futuras', () => {
    const cases = [
      JSON.stringify({ v: 2, data: { name: 7, level: 1 } }),
      '{json roto',
      JSON.stringify({ v: 3, data: { name: 'Futuro', level: 1 } }),
      JSON.stringify({ v: 1, data: { name: 'Mal', points: 'x' } }),
      JSON.stringify({ data: { name: 'Sin versión', level: 1 } }),
    ];
    for (const raw of cases) {
      const store = createStorage(memoryStorage({ 'arcade.profile': raw }));
      expect(store.load(schema)).toBeNull();
    }
  });

  it('save valida antes de escribir', () => {
    const adapter = memoryStorage();
    const store = createStorage(adapter);
    expect(store.save(schema, { name: 'Bad', level: Number.NaN })).toBe(false);
    expect(adapter.get('arcade.profile')).toBeNull();
  });

  it('sin localStorage todo es no-op', () => {
    const store = createStorage(null);
    expect(store.available).toBe(false);
    expect(store.load(schema)).toBeNull();
    expect(store.save(schema, { name: 'X', level: 1 })).toBe(false);
    expect(() => store.remove('arcade.profile')).not.toThrow();
  });
});

describe('récords por modo', () => {
  it('separa modos y nunca escribe récords de IA', () => {
    const store = createStorage(memoryStorage());
    const scores = createScores({ gameId: 'pong', store });
    expect(scores.key).toBe('arcade.scores.pong');

    expect(scores.submit('solo', 10)).toBe(true);
    expect(scores.submit('local', 5)).toBe(true);
    expect(scores.submit('solo', 8)).toBe(false);
    expect(scores.submit('solo', 999, { owner: 'ai' })).toBe(false);

    expect(scores.get('solo')).toBe(10);
    expect(scores.get('local')).toBe(5);
    expect(scores.get('vsAI')).toBe(0);
    expect(scores.best()).toEqual({ solo: 10, local: 5 });
  });

  it('rechaza puntuaciones inválidas y modos desconocidos', () => {
    const scores = createScores({
      gameId: 'snake',
      store: createStorage(memoryStorage()),
    });
    expect(scores.submit('solo', -1)).toBe(false);
    expect(scores.submit('solo', Number.NaN)).toBe(false);
    expect(scores.submit('otro' as 'solo', 100)).toBe(false);
    expect(scores.get('solo')).toBe(0);
  });

  it('descarta tablas corruptas y permite reset por modo', () => {
    const store = createStorage(
      memoryStorage({ 'arcade.scores.pong': JSON.stringify({ v: 1, data: { solo: -5 } }) }),
    );
    const scores = createScores({ gameId: 'pong', store });
    expect(scores.get('solo')).toBe(0);
    scores.submit('solo', 12);
    scores.submit('demo', 3);
    scores.reset('solo');
    expect(scores.get('solo')).toBe(0);
    expect(scores.get('demo')).toBe(3);
    scores.reset();
    expect(scores.best()).toEqual({});
  });
});

describe('logros', () => {
  const definitions = [
    { id: 'first_win', title: 'Primera victoria' },
    { id: 'perfect', title: 'Perfecto' },
  ];

  it('desbloquea logros humanos conocidos una sola vez', () => {
    const achievements = createAchievements({
      gameId: 'pong',
      definitions,
      store: createStorage(memoryStorage()),
    });
    expect(achievements.unlock('first_win')).toBe(true);
    expect(achievements.unlock('first_win')).toBe(false);
    expect(achievements.unlock('first_win', { owner: 'ai' })).toBe(false);
    expect(achievements.unlock('inventado')).toBe(false);
    expect(achievements.has('first_win')).toBe(true);
    expect(achievements.list()).toEqual(['first_win']);
    achievements.reset();
    expect(achievements.has('first_win')).toBe(false);
  });

  it('ignora logros desconocidos almacenados', () => {
    const store = createStorage(
      memoryStorage({
        'arcade.achievements.pong': JSON.stringify({
          v: 1,
          data: ['first_win', 'inventado'],
        }),
      }),
    );
    const achievements = createAchievements({ gameId: 'pong', definitions, store });
    expect(achievements.list()).toEqual([]);
  });
});
