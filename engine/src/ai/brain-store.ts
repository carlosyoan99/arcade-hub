import {
  BrainValidationError,
  parseBrain,
  serializeBrain,
  verifyBrain,
  type Brain,
} from './brain.js';

/** Persistencia de cerebros mediante adaptador inyectado (sin localStorage). */

export interface BrainStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys?(): readonly string[];
}

export interface BrainStore {
  readonly namespace: string;
  save(key: string, brain: Brain): void;
  /** Devuelve null si no existe; lanza BrainValidationError si está corrupto. */
  load(key: string): Brain | null;
  /** Como `load`, pero devuelve null también cuando los datos son inválidos. */
  tryLoad(key: string): Brain | null;
  has(key: string): boolean;
  remove(key: string): void;
  list(): readonly string[];
}

export function createMemoryStorage(): BrainStorage & { readonly entries: ReadonlyMap<string, string> } {
  const data = new Map<string, string>();
  return {
    entries: data,
    get(key: string): string | null {
      return data.get(key) ?? null;
    },
    set(key: string, value: string): void {
      data.set(key, value);
    },
    remove(key: string): void {
      data.delete(key);
    },
    keys(): readonly string[] {
      return [...data.keys()];
    },
  };
}

function assertKey(key: string): string {
  if (typeof key !== 'string' || key.length === 0 || /[\u0000-\u001f]/.test(key)) {
    throw new TypeError('key debe ser una cadena no vacía');
  }
  return key;
}

export function createBrainStore(storage: BrainStorage, namespace = 'arcade-ai'): BrainStore {
  const prefix = `${assertKey(namespace)}:`;
  const fullKey = (key: string): string => `${prefix}${assertKey(key)}`;

  return {
    namespace,
    save(key: string, brain: Brain): void {
      if (!verifyBrain(brain)) throw new BrainValidationError('cerebro no válido: no se guarda');
      storage.set(fullKey(key), serializeBrain(brain));
    },
    load(key: string): Brain | null {
      const raw = storage.get(fullKey(key));
      return raw === null ? null : parseBrain(raw);
    },
    tryLoad(key: string): Brain | null {
      try {
        return this.load(key);
      } catch {
        return null;
      }
    },
    has(key: string): boolean {
      return storage.get(fullKey(key)) !== null;
    },
    remove(key: string): void {
      storage.remove(fullKey(key));
    },
    list(): readonly string[] {
      const keys = storage.keys?.() ?? [];
      return keys.filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length));
    },
  };
}
