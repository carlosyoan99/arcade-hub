/** Ajustes: remapeo de teclas y prefers-reduced-motion. Persistencia versionada. */

import type { EnginePlugin } from '../core/plugins.js';
import type { BindingMap } from '../input/bindings.js';
import { createStorage, type Store, type StorageSchema } from '../store/storage.js';

export const SETTINGS_SERVICE = 'ui.settings';
export const SETTINGS_KEY = 'arcade.settings';

export interface SettingsData {
  readonly bindings: Record<string, string>;
  readonly reducedMotion: boolean;
}

export interface SettingsOptions {
  readonly store?: Store;
  readonly defaults?: BindingMap;
  readonly doc?: Document;
  /** Permite inyectar la preferencia en tests o en un renderer headless. */
  readonly reducedMotion?: boolean;
}

export interface Settings {
  readonly bindings: BindingMap;
  readonly reducedMotion: boolean;
  rebind(code: string, action: string): boolean;
  setReducedMotion(value: boolean): void;
  reset(): void;
  snapshot(): BindingMap;
  dispose(): void;
}

function isSettingsData(value: unknown): value is SettingsData {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as { bindings?: unknown; reducedMotion?: unknown };
  if (typeof candidate.bindings !== 'object' || candidate.bindings === null || Array.isArray(candidate.bindings)) {
    return false;
  }
  for (const [code, action] of Object.entries(candidate.bindings)) {
    if (code.length === 0 || typeof action !== 'string' || action.length === 0) return false;
  }
  return typeof candidate.reducedMotion === 'boolean';
}

export function settingsSchema(): StorageSchema<SettingsData> {
  return {
    key: SETTINGS_KEY,
    version: 1,
    validate: isSettingsData,
    migrate(value: unknown): SettingsData | null {
      // v0 era un plano code -> acción sin preferencias ni sobre.
      if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
      const bindings: Record<string, string> = {};
      for (const [code, action] of Object.entries(value)) {
        if (code.length === 0 || typeof action !== 'string' || action.length === 0) return null;
        bindings[code] = action;
      }
      return { bindings, reducedMotion: false };
    },
  };
}

function systemReducedMotion(doc: Document | null): boolean {
  const media = doc?.defaultView?.matchMedia ?? null;
  const query = typeof media === 'function' ? media : (
    (globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia ?? null
  );
  if (typeof query !== 'function') return false;
  try {
    return query('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

export function createSettings(options: SettingsOptions = {}): Settings {
  const store: Store = options.store ?? createStorage();
  const schema = settingsSchema();
  const defaults: BindingMap = options.defaults ?? {
    KeyP: 'pause',
    Escape: 'pause',
    Space: 'primary',
    Enter: 'confirm',
    KeyR: 'restart',
    ArrowUp: 'up',
    KeyW: 'up',
    ArrowDown: 'down',
    KeyS: 'down',
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
  };

  const loaded = store.load(schema);
  let bindings: Record<string, string> = {
    ...defaults,
    ...(loaded !== null ? loaded.bindings : {}),
  };
  let reducedMotion =
    options.reducedMotion ?? loaded?.reducedMotion ?? systemReducedMotion(options.doc ?? null);

  function persist(): void {
    store.save(schema, { bindings, reducedMotion });
  }

  return {
    get bindings(): BindingMap {
      return { ...bindings };
    },
    get reducedMotion(): boolean {
      return reducedMotion;
    },
    rebind(code: string, action: string): boolean {
      if (code.length === 0 || action.length === 0) return false;
      bindings = { ...bindings, [code]: action };
      persist();
      return true;
    },
    setReducedMotion(value: boolean): void {
      reducedMotion = value === true;
      persist();
    },
    reset(): void {
      bindings = { ...defaults };
      reducedMotion = systemReducedMotion(options.doc ?? null);
      persist();
    },
    snapshot(): BindingMap {
      return { ...bindings };
    },
    dispose(): void {
      // Sin listeners activos: no hay nada que liberar.
    },
  };
}

export function settingsPlugin(options: SettingsOptions = {}): EnginePlugin {
  let settings: Settings | undefined;

  return {
    id: SETTINGS_SERVICE,
    version: '1.0.0',
    install(api): void {
      const created = createSettings(options);
      settings = created;
      api.services.provide(SETTINGS_SERVICE, created);
    },
    dispose(): void {
      settings?.dispose();
    },
  };
}
