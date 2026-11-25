import { describe, expect, it } from 'vitest';
import { approach, clamp, dist2, lerp, manhattan, normalize2 } from '../src/core/math.js';
import { createSimulation } from '../src/core/simulation.js';
import { handleLifecycle } from '../src/game/lifecycle.js';
import { singlePlayerRules } from '../src/game/rules.js';
import { aabbOverlap, circleAabb, COLLISION_SERVICE, resolveCircleTile, type CollisionService } from '../src/sim/collision.js';
import { createGridService } from '../src/sim/grid.js';
import { createPathfindingService, PATHFINDING_SERVICE, type PathfindingService } from '../src/sim/pathfinding.js';

describe('servicios compartidos del motor', () => {
  it('math es determinista', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(dist2(0, 0, 3, 4)).toBe(25);
    expect(manhattan(0, 0, 3, 4)).toBe(7);
    expect(approach(0, 10, 3)).toBe(3);
    expect(normalize2(3, 4)).toEqual({ x: 0.6, y: 0.8 });
  });

  it('colisiones AABB y círculo', () => {
    expect(aabbOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(aabbOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 11, y: 0, w: 10, h: 10 })).toBe(false);
    expect(circleAabb({ x: 0, y: 0, r: 3 }, { x: 3, y: 0, w: 2, h: 2 })).toBe(true);
    const resolved = resolveCircleTile({ x: 1, y: 5, r: 2 }, { x: 0, y: 0, w: 4, h: 4 });
    expect(resolved.hit).toBe(true);
    expect(resolved.x).toBeLessThan(0);
  });

  it('grid y pathfinding con desempate determinista', () => {
    const gridService = createGridService();
    const map = [
      [0, 0, 0],
      [1, 1, 0],
      [0, 0, 0],
    ];
    expect(gridService.isSolid(map, 1, 1)).toBe(true);
    expect(gridService.toGrid(35, 12, 20)).toEqual({ col: 1, row: 0 });
    const pathfinding = createPathfindingService();
    const path = pathfinding.bfsPath(map, { col: 0, row: 0 }, { col: 2, row: 2 });
    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]).toEqual({ col: 2, row: 2 });
    expect(pathfinding.greedyStep(map, { col: 0, row: 0 }, { col: 2, row: 0 })).toEqual({ col: 1, row: 0 });
  });

  it('los servicios están disponibles en ctx.services', () => {
    const simulation = createSimulation({
      seed: 1,
      init: () => ({ value: 0 }),
      step: () => {},
    });
    expect(simulation.services.has(COLLISION_SERVICE)).toBe(true);
    expect(simulation.services.has(PATHFINDING_SERVICE)).toBe(true);
    expect(simulation.services.get<CollisionService>(COLLISION_SERVICE).aabbOverlap(
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0, y: 0, w: 1, h: 1 },
    )).toBe(true);
    expect(simulation.services.get<PathfindingService>(PATHFINDING_SERVICE).bfsStep(
      [[0, 0], [0, 0]],
      { col: 0, row: 0 },
      { col: 1, row: 1 },
    )).toEqual({ col: 1, row: 0 });
  });

  it('lifecycle centraliza pausa/reinicio/progreso', () => {
    const simulation = createSimulation({
      seed: 1,
      init: () => ({ paused: false, over: false, score: 0 }),
      step: (state, ctx) => {
        const skip = handleLifecycle(state, ctx, state.score, () => {
          state.score = 0;
          state.over = false;
        });
        if (skip) return;
        state.score++;
      },
    });
    simulation.actions.register('pause');
    simulation.actions.register('restart');
    simulation.tick([]);
    simulation.tick(['pause']);
    simulation.tick([]);
    expect(simulation.state.score).toBe(1);
    simulation.tick(['restart']);
    expect(simulation.state.score).toBe(0);
  });

  it('factory de reglas de un jugador', () => {
    const rules = singlePlayerRules<{ score: number; over: boolean; winner?: number | null }>(
      (state) => state.score * 2,
    );
    expect(rules.isOver({ score: 3, over: true })).toBe(true);
    expect(rules.winner({ score: 3, over: true })).toBe(0);
    expect(rules.score({ score: 3, over: false })).toBe(3);
    expect(rules.fitness({ score: 3, over: false })).toBe(6);
  });
});
