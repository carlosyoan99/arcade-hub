import type { ActionName } from '../core/types.js';
import type { ActionState } from './actions.js';

export type BindingMap = Readonly<Record<string, ActionName>>;

/** Enlaces comunes del motor. Los juegos pueden añadir los suyos. */
export const DEFAULT_BINDINGS: BindingMap = {
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

export interface Bindings {
  bind(code: string, action: ActionName): void;
  unbind(code: string): void;
  resolve(code: string): ActionName | undefined;
  /** Aplica un evento de teclado. Devuelve la acción generada, si la hay. */
  apply(code: string, isDown: boolean, actions: ActionState): ActionName | undefined;
  remap(code: string, action: ActionName): void;
  snapshot(): BindingMap;
}

export function createBindings(initial: BindingMap = DEFAULT_BINDINGS): Bindings {
  const map = new Map<string, ActionName>(Object.entries(initial));

  return {
    bind(code: string, action: ActionName): void {
      map.set(code, action);
    },
    unbind(code: string): void {
      map.delete(code);
    },
    resolve(code: string): ActionName | undefined {
      return map.get(code);
    },
    apply(code: string, isDown: boolean, actions: ActionState): ActionName | undefined {
      const action = map.get(code);
      if (!action) return undefined;
      actions.setDown(action, isDown);
      return action;
    },
    remap(code: string, action: ActionName): void {
      map.set(code, action);
    },
    snapshot(): BindingMap {
      return Object.fromEntries(map);
    },
  };
}
