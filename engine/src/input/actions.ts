import type { ActionName } from '../core/types.js';

export interface ActionSnapshot {
  readonly down: readonly ActionName[];
}

/**
 * Acciones nombradas. Los juegos piden `jump`/`fire`; teclado, gamepad,
 * táctil, IA y red solo inyectan acciones. El motor resuelve el origen.
 */
export interface ActionState {
  readonly registered: readonly ActionName[];
  register(name: ActionName): void;
  setDown(name: ActionName, down: boolean): void;
  isDown(name: ActionName): boolean;
  wasPressed(name: ActionName): boolean;
  wasReleased(name: ActionName): boolean;
  /** Devuelve true una sola vez por pulsación y la consume. */
  consume(name: ActionName): boolean;
  /** Se llama al final de cada tick para limpiar pulsaciones/presiones. */
  endTick(): void;
  snapshot(): ActionSnapshot;
  restore(snapshot: ActionSnapshot): void;
}

export function createActionState(initial: readonly ActionName[] = []): ActionState {
  const registered = new Set<ActionName>(initial);
  let down = new Set<ActionName>();
  let pressed = new Set<ActionName>();
  let released = new Set<ActionName>();

  function assertRegistered(name: ActionName): void {
    if (!registered.has(name)) {
      throw new Error(`Acción "${name}" no registrada. Regístrala en el plugin del juego.`);
    }
  }

  return {
    get registered(): readonly ActionName[] {
      return [...registered];
    },
    register(name: ActionName): void {
      registered.add(name);
    },
    setDown(name: ActionName, value: boolean): void {
      assertRegistered(name);
      if (value && !down.has(name)) {
        down.add(name);
        pressed.add(name);
        released.delete(name);
      } else if (!value && down.has(name)) {
        down.delete(name);
        released.add(name);
        pressed.delete(name);
      }
    },
    isDown(name: ActionName): boolean {
      assertRegistered(name);
      return down.has(name);
    },
    wasPressed(name: ActionName): boolean {
      assertRegistered(name);
      return pressed.has(name);
    },
    wasReleased(name: ActionName): boolean {
      assertRegistered(name);
      return released.has(name);
    },
    consume(name: ActionName): boolean {
      assertRegistered(name);
      if (!pressed.has(name)) return false;
      pressed.delete(name);
      return true;
    },
    endTick(): void {
      pressed.clear();
      released.clear();
    },
    snapshot(): ActionSnapshot {
      return { down: [...down] };
    },
    restore(snapshot: ActionSnapshot): void {
      const next = new Set(snapshot.down);
      for (const name of next) assertRegistered(name);
      down = next;
      pressed = new Set();
      released = new Set();
    },
  };
}
