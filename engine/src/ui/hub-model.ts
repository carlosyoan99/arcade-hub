/** Modelo puro del HUB: filtrado, formato de tarjeta y rutas. Sin DOM ni reloj. */

import type { ActionName } from '../core/types.js';
import type { GameDefinition, GameMode } from '../game/contract.js';
import type { BindingMap } from '../input/bindings.js';
import type { StorageSchema } from '../store/storage.js';

export interface GameCardModel {
  readonly id: string;
  readonly title: string;
  readonly modes: readonly GameMode[];
  readonly players: readonly number[];
  /** Etiqueta corta para la vitrina: «1–2 jug · solo / local». */
  readonly label: string;
}

export type HubRoute =
  | { readonly view: 'game'; readonly id: string; readonly seed: number }
  | { readonly view: 'hub' };

/** Semilla por defecto: la misma de siempre, ahora compartible en la URL. */
export const DEFAULT_SEED = 12345;

/** Temas del HUB, con el mismo juego de tokens en los tres. */
export const THEMES = ['dark', 'light', 'retro'] as const;
export type Theme = (typeof THEMES)[number];
export const THEME_STORAGE_KEY = 'arcadehub_theme';

const MODE_LABELS: Readonly<Record<GameMode, string>> = {
  solo: 'solo',
  local: 'local',
  vsAI: 'vs IA',
  online: 'online',
  demo: 'demo',
};

/** `[1]` → «1 jug»; `[1, 2]` → «1–2 jug». */
export function formatPlayers(players: readonly number[]): string {
  if (players.length === 0) return '— jug';
  const min = Math.min(...players);
  const max = Math.max(...players);
  return min === max ? `${min} jug` : `${min}–${max} jug`;
}

/** Filtra por texto (todas las palabras) y, opcionalmente, por modo; ordena por título. */
export function filterGames<S extends object>(
  games: readonly GameDefinition<S>[],
  query: string,
  mode?: GameMode,
): readonly GameDefinition<S>[] {
  const tokens = query.trim().toLocaleLowerCase('es').split(/\s+/).filter(Boolean);
  return games
    .filter((game) => {
      if (mode !== undefined && !game.meta.modes.includes(mode)) return false;
      if (tokens.length === 0) return true;
      const haystack = [
        game.id,
        game.meta.title,
        ...game.meta.modes,
        formatPlayers(game.meta.players),
      ]
        .join(' ')
        .toLocaleLowerCase('es');
      return tokens.every((token) => haystack.includes(token));
    })
    .slice()
    .sort(
      (a, b) =>
        a.meta.title.localeCompare(b.meta.title, 'es', { sensitivity: 'base', numeric: true }) ||
        a.id.localeCompare(b.id, 'es'),
    );
}

/** Datos que necesita una tarjeta de la vitrina; nunca toca el DOM. */
export function gameCard<S extends object>(game: GameDefinition<S>): GameCardModel {
  const modes = game.meta.modes;
  const players = game.meta.players;
  return {
    id: game.id,
    title: game.meta.title,
    modes,
    players,
    label: `${formatPlayers(players)} · ${modes.map((mode) => MODE_LABELS[mode] ?? mode).join(' / ')}`,
  };
}

/** `#game/<id>?seed=<n>` → vista de juego; cualquier otra cosa → vitrina. */
export function parseRoute(hash: string): HubRoute {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path, query, ...extra] = raw.trim().replace(/^\/+|\/+$/g, '').split('?');
  if (extra.length > 0) return { view: 'hub' };
  const match = /^game\/(.+)$/i.exec(path ?? '');
  if (!match?.[1]) return { view: 'hub' };

  let id: string;
  try {
    id = decodeURIComponent(match[1]).trim().toLowerCase();
  } catch {
    return { view: 'hub' };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return { view: 'hub' };

  let seed = DEFAULT_SEED;
  const param = new URLSearchParams(query ?? '').get('seed');
  if (param !== null && /^\d+$/.test(param)) {
    const parsed = Number(param);
    // Semillas no enteras seguras no son reproducibles: se ignoran.
    if (Number.isSafeInteger(parsed)) seed = parsed;
  }
  return { view: 'game', id, seed };
}

/** Enlace profundo canónico. Sin semilla se omite el parámetro (compatibilidad). */
export function routeFor(id: string, seed?: number): string {
  const path = `#game/${encodeURIComponent(id)}`;
  return seed === undefined || seed === DEFAULT_SEED ? path : `${path}?seed=${seed}`;
}

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value);
}

/** Esquema versionado de `store/`; la UI solo lo aplica, no persiste a mano. */
export const THEME_SCHEMA: StorageSchema<Theme> = {
  key: THEME_STORAGE_KEY,
  version: 1,
  validate: isTheme,
  migrate: (value) => (value === 'light' || value === 'dark' ? value : null),
};

export function nextTheme(current: Theme): Theme {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length] ?? 'dark';
}

/**
 * Enlaces de teclado por juego. Cada entrada es una lista ordenada de
 * candidatos: se elige la primera acción registrada por el juego, de modo que
 * nunca se envía una acción que `ActionState` rechazaría.
 */
type Candidates = Readonly<Record<string, readonly ActionName[]>>;

const GAME_BINDINGS: Readonly<Record<string, Candidates>> = {
  tetris: { Space: ['hardDrop'], KeyZ: ['rotateCCW', 'rotate'], KeyC: ['hold'], KeyX: ['rotate'] },
  columns: { Space: ['hardDrop'], KeyZ: ['rotateCCW', 'rotate'], KeyC: ['hold'], KeyX: ['rotate'] },
  'puyo-puyo': {
    Space: ['hardDrop'],
    KeyZ: ['rotateCCW', 'rotate'],
    KeyC: ['hold'],
    KeyX: ['rotate'],
  },
  snake: { Space: ['pause'] },
  'out-run': {
    Space: ['turbo', 'accel'],
    ArrowUp: ['accel'],
    KeyW: ['accel'],
    ArrowDown: ['brake'],
    KeyS: ['brake'],
  },
  'pole-position': {
    Space: ['turbo', 'accel'],
    ArrowUp: ['accel'],
    KeyW: ['accel'],
    ArrowDown: ['brake'],
    KeyS: ['brake'],
  },
  'cell-swarm': {
    Space: ['split'],
    KeyE: ['eject'],
    KeyQ: ['boost'],
    // Alias históricos: conservan la compatibilidad con la vitrina anterior.
    KeyZ: ['eject'],
    KeyX: ['boost'],
    ShiftLeft: ['boost'],
  },
  'double-dragon': { Space: ['punch'], KeyZ: ['punch'], KeyX: ['kick'], KeyC: ['combo'] },
  defender: { Space: ['fire'], KeyB: ['bomb'], KeyH: ['hyperspace'], KeyN: ['nuclear'] },
  'moon-patrol': { Space: ['fire'], ArrowUp: ['jump'], KeyW: ['fireUp'] },
  'neon-nexus': {
    Space: ['fire'],
    Digit1: ['card1'],
    Digit2: ['card2'],
    Digit3: ['card3'],
    // Mejoras entre oleadas, tienda permanente y cierre del overlay.
    Digit4: ['upgradeAtk'],
    Digit5: ['upgradeHp'],
    Digit6: ['upgradeSpd'],
    KeyB: ['shop'],
    Digit7: ['buyMaxHp'],
    Digit8: ['buyAtkBonus'],
    Digit9: ['buyStartShield'],
    Digit0: ['buyRegenBonus'],
    KeyC: ['closeShop'],
  },
  // Missile Command se apunta con el puntero del host; el teclado es auxiliar.
  'missile-command': {
    Space: ['fire'],
    ArrowLeft: ['aimLeft'],
    KeyA: ['aimLeft'],
    ArrowRight: ['aimRight'],
    KeyD: ['aimRight'],
    ArrowUp: ['aimUp'],
    KeyW: ['aimUp'],
    ArrowDown: ['aimDown'],
    KeyS: ['aimDown'],
  },
  qbert: {
    KeyQ: ['upLeft'],
    KeyE: ['upRight'],
    KeyA: ['downLeft'],
    KeyD: ['downRight'],
    ArrowUp: ['upLeft'],
    ArrowLeft: ['downRight'],
    ArrowRight: ['upRight'],
    ArrowDown: ['downLeft'],
    KeyW: ['upRight'],
    KeyS: ['downRight'],
  },
};

const GENERIC_BINDINGS: Candidates = {
  KeyP: ['pause'],
  KeyR: ['restart'],
  Space: [
    'primary', 'serve', 'flap', 'fire', 'launch', 'pump', 'pepper', 'throw', 'split', 'boost',
    'jump', 'rotate', 'hardDrop', 'bomb', 'confirm', 'eject', 'accel',
  ],
  Enter: ['confirm', 'primary', 'fire', 'serve', 'flap', 'launch'],
  ArrowUp: ['up', 'p1Up', 'thrust', 'accel', 'flap', 'jump', 'aimUp'],
  KeyW: ['up', 'p1Up', 'thrust', 'accel', 'flap', 'jump', 'aimUp'],
  ArrowDown: ['down', 'p1Down', 'brake', 'duck', 'softDrop', 'aimDown'],
  KeyS: ['down', 'p1Down', 'brake', 'duck', 'softDrop', 'aimDown'],
  ArrowLeft: ['left', 'aimLeft'],
  KeyA: ['left', 'aimLeft'],
  ArrowRight: ['right', 'aimRight'],
  KeyD: ['right', 'aimRight'],
  KeyZ: ['rotate'],
  KeyC: ['hold'],
  KeyI: ['p2Up'],
  KeyK: ['p2Down'],
};

function resolveCandidates(candidates: Candidates, registered: readonly ActionName[]): BindingMap {
  const bindings: Record<string, ActionName> = {};
  for (const [code, options] of Object.entries(candidates)) {
    const action = options.find((name) => registered.includes(name));
    if (action !== undefined) bindings[code] = action;
  }
  return bindings;
}

/** Mapa de teclado específico para las acciones que el juego realmente registra. */
export function bindingsFor(game: GameDefinition<object>): BindingMap {
  const registered = game.actions;
  const specific = GAME_BINDINGS[game.id] ?? {};
  const generic: Candidates = { ...GENERIC_BINDINGS, ...specific };
  // `Escape` queda reservado para salir de pantalla completa: nunca se enlaza.
  return resolveCandidates(generic, registered);
}

export interface TouchAction {
  readonly action: ActionName;
  readonly label: string;
}

/** Botones en pantalla cuando un tap simple no basta para llegar a todas las acciones. */
export function touchActionsFor(game: GameDefinition<object>): readonly TouchAction[] {
  const extra: Readonly<Record<string, readonly TouchAction[]>> = {
    'cell-swarm': [
      { action: 'split', label: 'Dividir' },
      { action: 'eject', label: 'Expulsar' },
      { action: 'boost', label: 'Impulso' },
    ],
    qbert: [
      { action: 'upLeft', label: '↖' },
      { action: 'upRight', label: '↗' },
      { action: 'downLeft', label: '↙' },
      { action: 'downRight', label: '↘' },
    ],
  };
  return (extra[game.id] ?? []).filter((entry) => game.actions.includes(entry.action));
}

/**
 * Acción que dispara un tap sobre el canvas. Devuelve `undefined` cuando no
 * hay una acción canónica: los juegos con varias acciones táctiles usan los
 * botones en pantalla en lugar de asignar arbitrariamente la primera acción.
 */
export function tapActionFor(game: GameDefinition<object>): ActionName | undefined {
  const preferred: readonly ActionName[] = [
    'primary', 'serve', 'flap', 'fire', 'launch', 'pump', 'pepper', 'throw', 'split', 'boost',
    'jump', 'rotate', 'hardDrop', 'confirm', 'bomb', 'punch',
  ];
  return preferred.find((name) => game.actions.includes(name));
}

/** Botones de gamepad que el host debe resolver antes que los defaults. */
export function gamepadButtonsFor(game: GameDefinition<object>): Readonly<Record<number, readonly ActionName[]>> {
  const extra: Readonly<Record<string, Readonly<Record<number, readonly ActionName[]>>>> = {
    // El botón 0 ya produce `split`; el 1, `eject`. El `boost` necesita ayuda.
    'cell-swarm': { 2: ['boost'], 3: ['boost'], 7: ['boost'] },
    qbert: { 4: ['upLeft'], 5: ['upRight'], 6: ['downLeft'], 7: ['downRight'] },
  };
  return extra[game.id] ?? {};
}
