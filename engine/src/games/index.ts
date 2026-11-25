import type { GameDefinition } from '../game/contract.js';

import { asteroidsGame } from './asteroids/game.js';
import { bombermanGame } from './bomberman/game.js';
import { breakoutGame } from './breakout/game.js';
import { burgerTimeGame } from './burger-time/game.js';
import { cellSwarmGame } from './cell-swarm/game.js';
import { centipedeGame } from './centipede/game.js';
import { columnsGame } from './columns/game.js';
import { defenderGame } from './defender/game.js';
import { digDugGame } from './dig-dug/game.js';
import { dinoGame } from './dino-runner/game.js';
import { donkeyKongGame } from './donkey-kong/game.js';
import { doubleDragonGame } from './double-dragon/game.js';
import { flappyGame } from './flappy/game.js';
import { froggerGame } from './frogger/game.js';
import { galagaGame } from './galaga/game.js';
import { gradiusGame } from './gradius/game.js';
import { joustGame } from './joust/game.js';
import { missileCommandGame } from './missile-command/game.js';
import { moonPatrolGame } from './moon-patrol/game.js';
import { neonNexusGame } from './neon-nexus/game.js';
import { outRunGame } from './out-run/game.js';
import { pacmanGame } from './pac-man/game.js';
import { paperboyGame } from './paperboy/game.js';
import { polePositionGame } from './pole-position/game.js';
import { pongGame } from './pong/game.js';
import { puyoGame } from './puyo-puyo/game.js';
import { qbertGame } from './qbert/game.js';
import { raidenGame } from './raiden/game.js';
import { snakeGame } from './snake/game.js';
import { spaceInvadersGame } from './space-invaders/game.js';
import { tempestGame } from './tempest/game.js';
import { tetrisGame } from './tetris/game.js';

/** Catálogo completo de la v1: los 32 juegos del hub migrados al motor. */
export const GAMES: readonly GameDefinition<object>[] = [
  asteroidsGame,
  bombermanGame,
  breakoutGame,
  burgerTimeGame,
  cellSwarmGame,
  centipedeGame,
  columnsGame,
  defenderGame,
  digDugGame,
  dinoGame,
  donkeyKongGame,
  doubleDragonGame,
  flappyGame,
  froggerGame,
  galagaGame,
  gradiusGame,
  joustGame,
  missileCommandGame,
  moonPatrolGame,
  neonNexusGame,
  outRunGame,
  pacmanGame,
  paperboyGame,
  polePositionGame,
  pongGame,
  puyoGame,
  qbertGame,
  raidenGame,
  snakeGame,
  spaceInvadersGame,
  tempestGame,
  tetrisGame,
] as unknown as readonly GameDefinition<object>[];

export function findGame(id: string): GameDefinition<object> | undefined {
  return GAMES.find((game) => game.id === id);
}

export const GAME_IDS: readonly string[] = GAMES.map((game) => game.id);

export {
  asteroidsGame,
  bombermanGame,
  breakoutGame,
  burgerTimeGame,
  cellSwarmGame,
  centipedeGame,
  columnsGame,
  defenderGame,
  digDugGame,
  dinoGame,
  donkeyKongGame,
  doubleDragonGame,
  flappyGame,
  froggerGame,
  galagaGame,
  gradiusGame,
  joustGame,
  missileCommandGame,
  moonPatrolGame,
  neonNexusGame,
  outRunGame,
  pacmanGame,
  paperboyGame,
  polePositionGame,
  pongGame,
  puyoGame,
  qbertGame,
  raidenGame,
  snakeGame,
  spaceInvadersGame,
  tempestGame,
  tetrisGame,
};

export { PONG, type PongState, type PongBall } from './pong/game.js';
export { FLAPPY, type FlappyState, type FlappyPipe } from './flappy/game.js';
