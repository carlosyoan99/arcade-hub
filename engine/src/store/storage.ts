/**
 * localStorage envuelto en try/catch, con clave + versión, validador y
 * migración. En Node (sin localStorage) todos los métodos hacen no-op.
 */

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface StorageAdapter {
  readonly available: boolean;
  get(key: string): string | null;
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

export interface Versioned<T> {
  readonly v: number;
  readonly data: T;
}

export interface StorageSchema<T> {
  readonly key: string;
  readonly version: number;
  validate(value: unknown): value is T;
  migrate?(value: unknown, fromVersion: number): T | null;
}

export interface Store {
  readonly available: boolean;
  load<T>(schema: StorageSchema<T>): T | null;
  save<T>(schema: StorageSchema<T>, data: T): boolean;
  remove(key: string): void;
  raw(key: string): string | null;
}

function browserAdapter(): StorageAdapter {
  let local: StorageLike | null = null;
  try {
    const candidate = (globalThis as { localStorage?: StorageLike }).localStorage;
    if (
      candidate &&
      typeof candidate.getItem === 'function' &&
      typeof candidate.setItem === 'function' &&
      typeof candidate.removeItem === 'function'
    ) {
      local = candidate;
    }
  } catch {
    // Modo privado / políticas corporativas: sin almacenamiento.
  }

  return {
    available: local !== null,
    get(key: string): string | null {
      if (!local) return null;
      try {
        return local.getItem(key);
      } catch {
        return null;
      }
    },
    set(key: string, value: string): boolean {
      if (!local) return false;
      try {
        local.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    },
    remove(key: string): void {
      if (!local) return;
      try {
        local.removeItem(key);
      } catch {
        // no-op
      }
    },
  };
}

/** Adaptador en memoria, útil para tests y para el modo headless. */
export function memoryStorage(initial: Readonly<Record<string, string>> = {}): StorageAdapter {
  const values = new Map<string, string>(Object.entries(initial));
  return {
    available: true,
    get(key: string): string | null {
      return values.get(key) ?? null;
    },
    set(key: string, value: string): boolean {
      values.set(key, value);
      return true;
    },
    remove(key: string): void {
      values.delete(key);
    },
  };
}

function noopAdapter(): StorageAdapter {
  return {
    available: false,
    get: () => null,
    set: () => false,
    remove: () => undefined,
  };
}

function resolve<T>(schema: StorageSchema<T>, data: unknown, version: number): T | null {
  if (version === schema.version) {
    return schema.validate(data) ? data : null;
  }
  if (!schema.migrate) return null;
  let migrated: T | null;
  try {
    migrated = schema.migrate(data, version);
  } catch {
    return null;
  }
  if (migrated === null || !schema.validate(migrated)) return null;
  return migrated;
}

export function createStorage(adapter: StorageAdapter | null = browserAdapter()): Store {
  const target = adapter ?? noopAdapter();

  return {
    get available(): boolean {
      return target.available;
    },
    raw(key: string): string | null {
      return target.get(key);
    },
    load<T>(schema: StorageSchema<T>): T | null {
      const raw = target.get(schema.key);
      if (raw === null) return null;

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        return null;
      }

      // Sin sobre: dato legacy de la versión 0, sujeto a migración.
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return resolve(schema, parsed, 0);
      }

      const envelope = parsed as { v?: unknown; data?: unknown };
      const version = envelope.v;
      if (version === undefined) {
        // Objeto legacy sin sobre: todo el valor es el dato de la versión 0.
        return resolve(schema, parsed, 0);
      }
      if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) return null;
      // Un dato de una versión futura se descarta: nunca se interpreta.
      if (version > schema.version) return null;
      return resolve(schema, envelope.data, version);
    },
    save<T>(schema: StorageSchema<T>, data: T): boolean {
      if (!schema.validate(data)) return false;
      const envelope: Versioned<T> = { v: schema.version, data };
      try {
        return target.set(schema.key, JSON.stringify(envelope));
      } catch {
        return false;
      }
    },
    remove(key: string): void {
      target.remove(key);
    },
  };
}
