import type { ActionState } from '../input/actions.js';
import type { ActionName } from './types.js';
import type { Clock } from './clock.js';
import type { EventBus } from './events.js';
import type { RNG } from './rng.js';
import type { Scheduler } from './scheduler.js';

export type StepHook = () => void;

/** Registro de servicios compartidos: los juegos consumen, no reimplementan. */
export interface ServiceRegistry {
  provide<T>(id: string, service: T): void;
  get<T>(id: string): T;
  has(id: string): boolean;
}

export function createServiceRegistry(): ServiceRegistry {
  const services = new Map<string, unknown>();
  return {
    provide<T>(id: string, service: T): void {
      if (services.has(id)) throw new Error(`Servicio "${id}" ya registrado`);
      services.set(id, service);
    },
    get<T>(id: string): T {
      if (!services.has(id)) throw new Error(`Servicio "${id}" no registrado`);
      return services.get(id) as T;
    },
    has(id: string): boolean {
      return services.has(id);
    },
  };
}

/** API que recibe cada plugin al instalarse. */
export interface PluginAPI {
  readonly id: string;
  readonly clock: Clock;
  readonly rng: RNG;
  readonly events: EventBus;
  readonly scheduler: Scheduler;
  readonly actions: ActionState;
  readonly services: ServiceRegistry;
  onPreStep(hook: StepHook): void;
  onPostStep(hook: StepHook): void;
  registerAction(name: ActionName): void;
}

/**
 * Un plugin aporta sistemas reutilizables al motor. El orden se resuelve por
 * `requires` (topológico), nunca por orden de declaración: determinista.
 */
export interface EnginePlugin {
  readonly id: string;
  readonly version?: string;
  readonly requires?: readonly string[];
  install(api: PluginAPI): void;
  dispose?(): void;
}

export interface PluginRegistry {
  readonly plugins: readonly EnginePlugin[];
  preStep(): void;
  postStep(): void;
  dispose(): void;
}

export interface PluginEnvironment {
  readonly clock: Clock;
  readonly rng: RNG;
  readonly events: EventBus;
  readonly scheduler: Scheduler;
  readonly actions: ActionState;
}

function sortPlugins(plugins: readonly EnginePlugin[]): EnginePlugin[] {
  const byId = new Map<string, EnginePlugin>();
  for (const plugin of plugins) {
    if (byId.has(plugin.id)) throw new Error(`Plugin duplicado: ${plugin.id}`);
    byId.set(plugin.id, plugin);
  }

  const ordered: EnginePlugin[] = [];
  const visiting = new Set<string>();
  const done = new Set<string>();

  function visit(plugin: EnginePlugin): void {
    if (done.has(plugin.id)) return;
    if (visiting.has(plugin.id)) {
      throw new Error(`Dependencia circular entre plugins: ${plugin.id}`);
    }
    visiting.add(plugin.id);
    for (const dependency of plugin.requires ?? []) {
      const found = byId.get(dependency);
      if (!found) {
        throw new Error(`Plugin "${plugin.id}" requiere "${dependency}", que no está instalado`);
      }
      visit(found);
    }
    visiting.delete(plugin.id);
    done.add(plugin.id);
    ordered.push(plugin);
  }

  for (const plugin of plugins) visit(plugin);
  return ordered;
}

export function createPluginRegistry(
  plugins: readonly EnginePlugin[],
  environment: PluginEnvironment,
  services: ServiceRegistry,
): PluginRegistry {
  const ordered = sortPlugins(plugins);
  const preHooks: StepHook[] = [];
  const postHooks: StepHook[] = [];

  for (const plugin of ordered) {
    const api: PluginAPI = {
      id: plugin.id,
      clock: environment.clock,
      rng: environment.rng,
      events: environment.events,
      scheduler: environment.scheduler,
      actions: environment.actions,
      services,
      onPreStep(hook: StepHook): void {
        preHooks.push(hook);
      },
      onPostStep(hook: StepHook): void {
        postHooks.push(hook);
      },
      registerAction(name: ActionName): void {
        environment.actions.register(name);
      },
    };
    plugin.install(api);
  }

  return {
    plugins: ordered,
    preStep(): void {
      for (const hook of preHooks) hook();
    },
    postStep(): void {
      for (const hook of postHooks) hook();
    },
    dispose(): void {
      for (const plugin of [...ordered].reverse()) plugin.dispose?.();
    },
  };
}
