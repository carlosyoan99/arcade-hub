/** Tipos base compartidos por todo el motor. Sin DOM, sin reloj real. */

export type Tick = number;
export type ActionName = string;
export type TimerId = number;

export interface GameEvent {
  readonly type: string;
  readonly payload: unknown;
  readonly tick: Tick;
}
