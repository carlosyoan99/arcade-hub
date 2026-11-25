import type { ActionName } from '../core/types.js';

export interface ActionSnapshot {
  readonly down: readonly ActionName[];
  readonly pointer: PointerState;
}

export interface PointerState {
  readonly x: number;
  readonly y: number;
  readonly active: boolean;
}

/**
 * Acciones nombradas. Los juegos piden `jump`/`fire`; teclado, gamepad,
 * táctil, IA y red solo inyectan acciones. El motor resuelve el origen.
 */
export interface ActionState {
  readonly registered: readonly ActionName[];
  register(name: ActionName): void;
  setDown(name: ActionName, down: boolean): void;
  /** Puntero virtual (ratón, stick o táctil), con determinismo de replay. */
  readonly pointer: PointerState;
  setPointer(x: number, y: number, active?: boolean): void;
  /** -1 | 0 | 1 a partir de dos acciones opuestas. */
  axis(negative: ActionName, positive: ActionName): -1 | 0 | 1;
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
  let pointer: PointerState = { x: 0.5, y: 0.5, active: false };

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
    get pointer(): PointerState {
      return pointer;
    },
    setPointer(x: number, y: number, active = true): void {
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw new RangeError('ActionState.setPointer: coordenadas no finitas');
      }
      pointer = { x, y, active };
    },
    axis(negative: ActionName, positive: ActionName): -1 | 0 | 1 {
      const left = this.isDown(negative);
      const right = this.isDown(positive);
      return left === right ? 0 : left ? -1 : 1;
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
      return { down: [...down], pointer: { ...pointer } };
    },
    restore(snapshot: ActionSnapshot): void {
      const next = new Set(snapshot.down);
      for (const name of next) assertRegistered(name);
      down = next;
      pointer = { ...snapshot.pointer };
      pressed = new Set();
      released = new Set();
    },
  };
}
