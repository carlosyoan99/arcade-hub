/** Modelo puro del HUB: filtrado, formato de tarjeta y rutas. Sin DOM ni reloj. */

import type { GameDefinition, GameMode } from '../game/contract.js';

export interface GameCardModel {
  readonly id: string;
  readonly title: string;
  readonly modes: readonly GameMode[];
  readonly players: readonly number[];
  /** Etiqueta corta para la vitrina: «1–2 jug · solo / local». */
  readonly label: string;
}

export type HubRoute = { readonly view: 'game'; readonly id: string } | { readonly view: 'hub' };

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

/** `#game/<id>` → vista de juego; cualquier otra cosa → vitrina. */
export function parseRoute(hash: string): HubRoute {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const clean = raw.trim().replace(/^\/+|\/+$/g, '');
  const match = /^game\/(.+)$/i.exec(clean);
  if (!match?.[1]) return { view: 'hub' };

  let id: string;
  try {
    id = decodeURIComponent(match[1]).trim().toLowerCase();
  } catch {
    return { view: 'hub' };
  }
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ? { view: 'game', id } : { view: 'hub' };
}

/** Enlace profundo canónico para un id de juego. */
export function routeFor(id: string): string {
  return `#game/${encodeURIComponent(id)}`;
}
