import { describe, expect, it } from 'vitest';
import { createGameSimulation, gameSimulationOptions } from '../src/game/adapter.js';
import { runHeadless } from '../src/tools/headless.js';
import { PONG, pongGame } from '../src/games/pong/game.js';

const simulation = (seed = 1234) => createGameSimulation(pongGame, { seed });

describe('Pong sobre la API del motor', () => {
  it('el juego solo declara acciones y reglas', () => {
    expect(pongGame.id).toBe('pong');
    expect(pongGame.actions).toContain('serve');
    expect(pongGame.meta.modes).toEqual(['solo', 'local', 'vsAI', 'online']);
  });

  it('es determinista con la misma semilla y cinta de inputs', () => {
    const options = gameSimulationOptions(pongGame, { seed: 4321 });
    const inputsAt = (tick: number) => (tick === 1 ? ['serve'] : tick % 11 === 0 ? ['p1Up'] : []);
    const a = runHeadless({ ...options, ticks: 400, inputsAt });
    const b = runHeadless({ ...options, ticks: 400, inputsAt });
    expect(a.hash).toBe(b.hash);
  });

  it('saca la bola solo con la acción serve', () => {
    const sim = simulation();
    sim.tick([]);
    expect(sim.state.serving).toBe(true);
    sim.tick(['serve']);
    expect(sim.state.serving).toBe(false);
    expect(sim.state.ball.vx).not.toBe(0);
  });

  it('marca punto cuando la bola sale por la derecha', () => {
    const sim = simulation();
    sim.tick(['serve']);
    sim.state.ball.x = PONG.width + 30;
    sim.state.ball.vx = 400;
    sim.tick([]);
    expect(sim.state.score[0]).toBe(1);
    expect(sim.state.serving).toBe(true);
  });

  it('rebota en la pala izquierda', () => {
    const sim = simulation();
    sim.tick(['serve']);
    sim.state.ball.x = PONG.paddleInset + PONG.paddleWidth + PONG.ballRadius + 1;
    sim.state.ball.y = sim.state.left;
    sim.state.ball.vx = -400;
    sim.state.ball.vy = 0;
    sim.tick([]);
    expect(sim.state.ball.vx).toBeGreaterThan(0);
  });

  it('observación normalizada y reglas de fin de partida', () => {
    const sim = simulation();
    const observation = pongGame.observe?.(sim.state, 0);
    expect(observation).toBeInstanceOf(Float32Array);
    expect(observation?.length).toBe(7);
    expect([...(observation ?? [])].every((v) => v >= -1.01 && v <= 1.01)).toBe(true);
    expect(pongGame.rules.isOver(sim.state)).toBe(false);
    sim.state.over = true;
    sim.state.winner = 0;
    expect(pongGame.rules.isOver(sim.state)).toBe(true);
    expect(pongGame.rules.winner(sim.state)).toBe(0);
  });
});
