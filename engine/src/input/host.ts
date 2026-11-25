import type { ActionName } from '../core/types.js';
import type { ActionState } from './actions.js';
import type { Bindings } from './bindings.js';
import { captureInputFrame, type InputFrameWithPointer } from './virtual.js';

/**
 * Evento mínimo que el host necesita de teclado y puntero. Es estructural:
 * sirve tanto para eventos del DOM como para objetivos falsos en tests.
 */
export interface InputEventLike {
  readonly code?: string;
  readonly clientX?: number;
  readonly clientY?: number;
  readonly pointerId?: number;
  preventDefault?(): void;
}

export interface InputEventTarget {
  addEventListener(type: string, listener: (event: InputEventLike) => void): void;
  removeEventListener(type: string, listener: (event: InputEventLike) => void): void;
}

export interface InputHostConfig {
  readonly actions: ActionState;
  readonly bindings: Bindings;
  /** Objetivo de teclado y eventos de gamepad. Por defecto, el global con addEventListener. */
  readonly target?: InputEventTarget;
  /** Objetivo de eventos de puntero/táctil (normalmente el canvas). */
  readonly pointer?: InputEventTarget;
  /** Acción que dispara un tap; por defecto `primary`. */
  readonly tapAction?: ActionName;
  /** Umbral del stick; por defecto 0.25. */
  readonly deadzone?: number;
  /** Candidatos adicionales por índice de botón de gamepad (se anteponen a los defaults). */
  readonly gamepadButtons?: Readonly<Record<number, readonly ActionName[]>>;
  /** Aviso de acción pulsada/soltada (útil para UI: pausa, selector...). */
  readonly onAction?: (action: ActionName, down: boolean) => void;
}

export interface InputHost {
  attach(): void;
  detach(): void;
  /** Sondea gamepads una vez por tick, antes de `step()`. */
  poll(tick: number): void;
  /** Cinta para `simulation.tick(frame.actions)`; el puntero ya está en `actions`. */
  frame(): InputFrameWithPointer;
  readonly attached: boolean;
  readonly lastPollTick: number;
}

/** Botones estándar (A, B, X, Y, select, start, D-pad) → acciones candidatas. */
const DEFAULT_GAMEPAD_BUTTONS: Readonly<Record<number, readonly ActionName[]>> = {
  0: ['primary', 'jump', 'flap', 'fire', 'serve', 'launch', 'pump', 'pepper', 'throw', 'split', 'boost'],
  1: ['secondary', 'bomb', 'eject', 'duck', 'softDrop', 'rotate', 'fire'],
  2: ['cancel', 'brake', 'rotateCCW', 'hardDrop', 'bomb'],
  3: ['confirm', 'accel', 'thrust', 'turbo', 'hold', 'power'],
  4: ['upLeft'],
  5: ['upRight'],
  6: ['brake', 'downLeft'],
  7: ['accel', 'turbo', 'upRight'],
  8: ['restart'],
  9: ['pause', 'confirm'],
  12: ['up', 'p1Up', 'aimUp'],
  13: ['down', 'p1Down', 'aimDown'],
  14: ['left', 'aimLeft'],
  15: ['right', 'aimRight'],
};

type AxisDirection = 'negX' | 'posX' | 'negY' | 'posY';
type Stick = 'left' | 'right';

/** Stick izquierdo = jugador 1 / movimiento; derecho = mirilla o jugador 2. */
const GAMEPAD_AXES: Readonly<
  Record<Stick, Readonly<Record<AxisDirection, readonly ActionName[]>>>
> = {
  left: {
    negX: ['left', 'aimLeft'],
    posX: ['right', 'aimRight'],
    negY: ['up', 'p1Up', 'aimUp'],
    posY: ['down', 'p1Down', 'aimDown'],
  },
  right: {
    negX: ['aimLeft', 'left'],
    posX: ['aimRight', 'right'],
    negY: ['aimUp', 'p2Up', 'up'],
    posY: ['aimDown', 'p2Down', 'down'],
  },
};

function globalTarget(): InputEventTarget | undefined {
  const g = globalThis as unknown as {
    addEventListener?: unknown;
    removeEventListener?: unknown;
  };
  return typeof g.addEventListener === 'function' && typeof g.removeEventListener === 'function'
    ? (globalThis as unknown as InputEventTarget)
    : undefined;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function readGamepads(): readonly (Gamepad | null | undefined)[] | undefined {
  const nav = (globalThis as unknown as { navigator?: { getGamepads?: () => unknown } }).navigator;
  if (!nav || typeof nav.getGamepads !== 'function') return undefined;
  try {
    const pads = nav.getGamepads();
    return Array.isArray(pads) ? (pads as readonly (Gamepad | null | undefined)[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Host de entradas: único punto de contacto con DOM/gamepad. Los juegos solo
 * declaran acciones nombradas; aquí se resuelve el origen (teclado, mando o
 * puntero) y se escriben en `ActionState`.
 */
export function createInputHost(config: InputHostConfig): InputHost {
  const { actions, bindings } = config;
  const deadzone = clamp01(config.deadzone ?? 0.25);
  const tapAction = config.tapAction ?? 'primary';
  const keyboard = new Set<ActionName>();
  let padDown = new Set<ActionName>();
  const pointerDown = new Set<ActionName>();
  let pointerActive = false;
  let pointerId: number | undefined;
  let attached = false;
  let lastPollTick = 0;
  let keyTarget: InputEventTarget | undefined;
  let pointerTarget: InputEventTarget | undefined;

  function registered(name: ActionName): boolean {
    return actions.registered.includes(name);
  }

  /** Los tres orígenes se combinan: soltar uno no cancela lo que otro mantiene. */
  function sync(names: Iterable<ActionName>): void {
    for (const name of names) {
      if (!registered(name)) continue;
      const down = keyboard.has(name) || padDown.has(name) || pointerDown.has(name);
      if (actions.isDown(name) !== down) actions.setDown(name, down);
    }
  }

  const keyListeners: Readonly<Record<string, (event: InputEventLike) => void>> = {
    keydown: (event) => {
      const code = event.code;
      if (typeof code !== 'string') return;
      const action = bindings.resolve(code);
      if (action === undefined || !registered(action)) return;
      event.preventDefault?.();
      const already = keyboard.has(action);
      keyboard.add(action);
      // `bindings.apply` es la vía canónica del teclado; si otro origen mantiene
      // la acción, `sync` restaura el estado combinado justo después.
      if (!already && !padDown.has(action) && !pointerDown.has(action)) {
        bindings.apply(code, true, actions);
      }
      sync([action]);
      if (!already) config.onAction?.(action, true);
    },
    keyup: (event) => {
      const code = event.code;
      if (typeof code !== 'string') return;
      const action = bindings.resolve(code);
      if (action === undefined || !registered(action)) return;
      if (!keyboard.delete(action)) return;
      if (!padDown.has(action) && !pointerDown.has(action)) {
        bindings.apply(code, false, actions);
      }
      sync([action]);
      config.onAction?.(action, false);
    },
  };

  const gamepadListeners: Readonly<Record<string, (event: InputEventLike) => void>> = {
    gamepadconnected: () => poll(lastPollTick),
    gamepaddisconnected: () => poll(lastPollTick),
  };

  function pointerCoords(event: InputEventLike): readonly [number, number] {
    const target = pointerTarget as (InputEventTarget & {
      getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
    }) | undefined;
    const rect = target?.getBoundingClientRect?.();
    const x = typeof event.clientX === 'number' ? event.clientX : 0;
    const y = typeof event.clientY === 'number' ? event.clientY : 0;
    if (rect && rect.width > 0 && rect.height > 0) {
      return [
        clamp01((x - rect.left) / rect.width),
        clamp01((y - rect.top) / rect.height),
      ];
    }
    // Sin layout (tests, canvas libre): se esperan coordenadas ya normalizadas.
    return [clamp01(x), clamp01(y)];
  }

  function setPointerFrom(event: InputEventLike): void {
    const [x, y] = pointerCoords(event);
    actions.setPointer(x, y, pointerActive);
  }

  function releasePointer(event: InputEventLike): void {
    if (pointerActive && event.pointerId !== undefined && event.pointerId !== pointerId) return;
    if (!pointerActive) return;
    pointerActive = false;
    pointerId = undefined;
    setPointerFrom(event);
    pointerDown.delete(tapAction);
    sync([tapAction]);
    config.onAction?.(tapAction, false);
  }

  const pointerListeners: Readonly<Record<string, (event: InputEventLike) => void>> = {
    pointerdown: (event) => {
      if (pointerActive) return;
      pointerActive = true;
      pointerId = event.pointerId;
      setPointerFrom(event);
      if (registered(tapAction)) {
        pointerDown.add(tapAction);
        sync([tapAction]);
        config.onAction?.(tapAction, true);
      }
    },
    pointermove: (event) => {
      if (pointerId !== undefined && event.pointerId !== undefined && event.pointerId !== pointerId) {
        return;
      }
      setPointerFrom(event);
    },
    pointerup: releasePointer,
    pointercancel: releasePointer,
  };

  function resolveAction(candidates: readonly ActionName[]): ActionName | undefined {
    return candidates.find(registered);
  }

  function readPadActions(): Set<ActionName> {
    const next = new Set<ActionName>();
    const pads = readGamepads();
    if (!pads) return next;

    for (const pad of pads) {
      if (!pad || pad.connected === false) continue;

      for (const [rawIndex, extra] of Object.entries(config.gamepadButtons ?? {})) {
        const index = Number(rawIndex);
        const button = pad.buttons[index];
        if (button && (button.pressed || button.value > 0.5)) {
          const action = resolveAction([...extra, ...(DEFAULT_GAMEPAD_BUTTONS[index] ?? [])]);
          if (action !== undefined) next.add(action);
        }
      }

      for (const [rawIndex, candidates] of Object.entries(DEFAULT_GAMEPAD_BUTTONS)) {
        if (config.gamepadButtons?.[Number(rawIndex)] !== undefined) continue;
        const index = Number(rawIndex);
        const button = pad.buttons[index];
        if (button && (button.pressed || button.value > 0.5)) {
          const action = resolveAction(candidates);
          if (action !== undefined) next.add(action);
        }
      }

      for (const [stick, directions] of Object.entries(GAMEPAD_AXES) as [
        Stick,
        (typeof GAMEPAD_AXES)[Stick],
      ][]) {
        const base = stick === 'left' ? 0 : 2;
        const axes = [pad.axes[base], pad.axes[base + 1]];
        const signs = [axes[0] ?? 0, axes[1] ?? 0];
        const checks: readonly [AxisDirection, number][] = [
          ['negX', -signs[0]!],
          ['posX', signs[0]!],
          ['negY', -signs[1]!],
          ['posY', signs[1]!],
        ];
        for (const [direction, magnitude] of checks) {
          if (!Number.isFinite(magnitude) || magnitude <= deadzone) continue;
          const action = resolveAction(directions[direction]);
          if (action !== undefined) next.add(action);
        }
      }
    }
    return next;
  }

  function poll(tick: number): void {
    lastPollTick = tick;
    const next = readPadActions();
    const changed = new Set([...padDown, ...next]);
    padDown = next;
    sync(changed);
  }

  const host: InputHost = {
    attach(): void {
      if (attached) return;
      attached = true;
      keyTarget = config.target ?? globalTarget();
      pointerTarget = config.pointer ?? keyTarget;

      for (const [type, listener] of Object.entries(keyListeners)) {
        keyTarget?.addEventListener(type, listener);
      }
      for (const [type, listener] of Object.entries(gamepadListeners)) {
        keyTarget?.addEventListener(type, listener);
      }
      if (pointerTarget) {
        for (const [type, listener] of Object.entries(pointerListeners)) {
          pointerTarget.addEventListener(type, listener);
        }
      }
    },
    detach(): void {
      if (!attached) return;
      attached = false;
      for (const [type, listener] of Object.entries(keyListeners)) {
        keyTarget?.removeEventListener(type, listener);
      }
      for (const [type, listener] of Object.entries(gamepadListeners)) {
        keyTarget?.removeEventListener(type, listener);
      }
      if (pointerTarget) {
        for (const [type, listener] of Object.entries(pointerListeners)) {
          pointerTarget.removeEventListener(type, listener);
        }
      }

      const held = new Set([...keyboard, ...padDown, ...pointerDown]);
      keyboard.clear();
      padDown = new Set();
      pointerDown.clear();
      pointerActive = false;
      pointerId = undefined;
      sync(held);
      actions.setPointer(actions.pointer.x, actions.pointer.y, false);
    },
    poll,
    frame(): InputFrameWithPointer {
      return { actions: captureInputFrame(actions), pointer: { ...actions.pointer } };
    },
    get attached(): boolean {
      return attached;
    },
    get lastPollTick(): number {
      return lastPollTick;
    },
  };

  return host;
}
