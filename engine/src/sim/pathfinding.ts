import type { EnginePlugin, PluginAPI } from '../core/plugins.js';
import { createGridService, NEIGHBORS, type Cell, type GridPosition } from './grid.js';

export const PATHFINDING_SERVICE = 'pathfinding';

export interface PathfindingService {
  /** Vecino siguiente en el camino más corto, o null si no hay ruta. */
  bfsStep(
    grid: readonly (readonly Cell[])[],
    from: GridPosition,
    to: GridPosition,
    isWalkable?: (cell: Cell) => boolean,
  ): GridPosition | null;
  /** Vecino que reduce la distancia, con desempate determinista. */
  greedyStep(
    grid: readonly (readonly Cell[])[],
    from: GridPosition,
    to: GridPosition,
    isWalkable?: (cell: Cell) => boolean,
  ): GridPosition | null;
  bfsPath(
    grid: readonly (readonly Cell[])[],
    from: GridPosition,
    to: GridPosition,
    isWalkable?: (cell: Cell) => boolean,
  ): GridPosition[];
}

export function createPathfindingService(): PathfindingService {
  const grid = createGridService();
  const walkable = (cell: Cell): boolean => cell === 0 || cell === '.';

  function key(position: GridPosition): string {
    return `${position.col},${position.row}`;
  }

  function canMove(
    map: readonly (readonly Cell[])[],
    at: GridPosition,
    isWalkableFn: (cell: Cell) => boolean,
  ): boolean {
    return grid.inBounds(map, at.col, at.row) && isWalkableFn(grid.get(map, at.col, at.row) ?? 1);
  }

  return {
    bfsPath(map, from, to, isWalkableFn = walkable): GridPosition[] {
      if (!canMove(map, to, isWalkableFn)) return [];
      const queue: GridPosition[] = [from];
      const visited = new Set<string>([key(from)]);
      const parent = new Map<string, string>();
      let head = 0;
      while (head < queue.length) {
        const current = queue[head++] as GridPosition;
        if (current.col === to.col && current.row === to.row) break;
        for (const offset of NEIGHBORS) {
          const next = { col: current.col + offset.col, row: current.row + offset.row };
          const nextKey = key(next);
          if (visited.has(nextKey) || !canMove(map, next, isWalkableFn)) continue;
          visited.add(nextKey);
          parent.set(nextKey, key(current));
          queue.push(next);
        }
      }
      const targetKey = key(to);
      if (!visited.has(targetKey)) return [];
      const path: GridPosition[] = [];
      let cursor: string | undefined = targetKey;
      while (cursor !== undefined) {
        const [col, row] = cursor.split(',').map(Number) as [number, number];
        path.unshift({ col, row });
        if (cursor === key(from)) break;
        cursor = parent.get(cursor);
      }
      return path;
    },
    bfsStep(map, from, to, isWalkableFn = walkable): GridPosition | null {
      const path = this.bfsPath(map, from, to, isWalkableFn);
      return path.length > 1 ? (path[1] as GridPosition) : null;
    },
    greedyStep(map, from, to, isWalkableFn = walkable): GridPosition | null {
      let best: GridPosition | null = null;
      let bestDistance = Infinity;
      for (const offset of NEIGHBORS) {
        const next = { col: from.col + offset.col, row: from.row + offset.row };
        if (!canMove(map, next, isWalkableFn)) continue;
        const distance =
          Math.abs(next.col - to.col) + Math.abs(next.row - to.row);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = next;
        }
      }
      return best;
    },
  };
}

export function pathfindingPlugin(): EnginePlugin {
  let service: PathfindingService | undefined;
  return {
    id: PATHFINDING_SERVICE,
    install(api: PluginAPI): void {
      service = createPathfindingService();
      api.services.provide(PATHFINDING_SERVICE, service);
    },
    dispose(): void {
      service = undefined;
    },
  };
}
