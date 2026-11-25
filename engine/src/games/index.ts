import type { GameDefinition } from '../game/contract.js';
import { flappyGame } from './flappy/game.js';
import { pongGame } from './pong/game.js';

/** Catálogo de la v1. Los juegos se añaden aquí cuando pasan sus tests. */
export const GAMES: readonly GameDefinition<object>[] = [
  pongGame as GameDefinition<object>,
  flappyGame as GameDefinition<object>,
];

export function findGame(id: string): GameDefinition<object> | undefined {
  return GAMES.find((game) => game.id === id);
}

export { pongGame, PONG } from './pong/game.js';
export type { PongState, PongBall } from './pong/game.js';
export { flappyGame, FLAPPY } from './flappy/game.js';
export type { FlappyState, FlappyPipe } from './flappy/game.js';
