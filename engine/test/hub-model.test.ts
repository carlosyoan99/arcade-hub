import { describe, expect, it } from 'vitest';
import { findGame, GAMES } from '../src/games/index.js';
import {
  filterGames,
  formatPlayers,
  gameCard,
  parseRoute,
  routeFor,
} from '../src/ui/hub-model.js';

describe('hub-model · filtrado', () => {
  it('devuelve los 32 juegos ordenados por título con la consulta vacía', () => {
    const all = filterGames(GAMES, '   ');
    expect(all).toHaveLength(32);
    const titles = all.map((game) => game.meta.title);
    expect([...titles].sort((a, b) => a.localeCompare(b, 'es'))).toEqual(titles);
  });

  it('busca por título/id sin distinguir mayúsculas ni espacios', () => {
    expect(filterGames(GAMES, 'SPACE INVADERS').map((game) => game.id)).toContain('space-invaders');
    expect(filterGames(GAMES, 'space-invaders').map((game) => game.id)).toEqual(['space-invaders']);
    expect(filterGames(GAMES, '  pong  ').map((game) => game.id)).toContain('pong');
  });

  it('exige todas las palabras y no muta el catálogo', () => {
    const before = GAMES.map((game) => game.id);
    const result = filterGames(GAMES, 'invaders space');
    expect(result.map((game) => game.id)).toEqual(['space-invaders']);
    expect(GAMES.map((game) => game.id)).toEqual(before);
  });

  it('filtra por modo cuando se pide', () => {
    const local = filterGames(GAMES, '', 'local');
    expect(local.length).toBeGreaterThan(0);
    for (const game of local) expect(game.meta.modes).toContain('local');
    expect(filterGames(GAMES, 'pong', 'demo').map((game) => game.id)).not.toContain('pong');
  });

  it('devuelve vacío si no hay coincidencias', () => {
    expect(filterGames(GAMES, 'no-existe')).toEqual([]);
  });
});

describe('hub-model · tarjetas', () => {
  it('formatea jugadores', () => {
    expect(formatPlayers([1])).toBe('1 jug');
    expect(formatPlayers([1, 2, 4])).toBe('1–4 jug');
    expect(formatPlayers([])).toBe('— jug');
  });

  it('describe un juego con id con guiones', () => {
    const game = findGame('space-invaders')!;
    expect(gameCard(game)).toEqual({
      id: 'space-invaders',
      title: game.meta.title,
      modes: game.meta.modes,
      players: game.meta.players,
      label: `1 jug · ${game.meta.modes.join(' / ').replace('vsAI', 'vs IA')}`,
    });
  });

  it('la etiqueta de Pong indica rango de jugadores y modos legibles', () => {
    const card = gameCard(findGame('pong')!);
    expect(card.players).toEqual([1, 2]);
    expect(card.label).toContain('1–2 jug');
    expect(card.label).toContain('vs IA');
  });
});

describe('hub-model · rutas #game/<id>', () => {
  it('genera y parsea ids con guiones', () => {
    expect(routeFor('space-invaders')).toBe('#game/space-invaders');
    expect(parseRoute(routeFor('space-invaders'))).toEqual({
      view: 'game',
      id: 'space-invaders',
    });
  });

  it('acepta prefijo opcional, mayúsculas y barras sobrantes', () => {
    expect(parseRoute('#game/pong/')).toEqual({ view: 'game', id: 'pong' });
    expect(parseRoute('#/GAME/PONG')).toEqual({ view: 'game', id: 'pong' });
    expect(parseRoute('game/space-invaders')).toEqual({
      view: 'game',
      id: 'space-invaders',
    });
  });

  it('cae a la vitrina con rutas vacías o inseguras', () => {
    expect(parseRoute('')).toEqual({ view: 'hub' });
    expect(parseRoute('#')).toEqual({ view: 'hub' });
    expect(parseRoute('#shelf')).toEqual({ view: 'hub' });
    expect(parseRoute('#game/')).toEqual({ view: 'hub' });
    expect(parseRoute('#game/<script>')).toEqual({ view: 'hub' });
    expect(parseRoute('#game/%')).toEqual({ view: 'hub' });
    expect(parseRoute('#game/../../etc')).toEqual({ view: 'hub' });
  });
});
