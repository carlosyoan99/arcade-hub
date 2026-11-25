/** Cuadrículas de juego: acceso acotado y conversiones deterministas. */

export const GRID_SERVICE = 'grid';

export type Cell = number | string;

export interface GridPosition {
  readonly col: number;
  readonly row: number;
}

export interface GridService {
  get(grid: readonly (readonly Cell[])[], col: number, row: number): Cell | null;
  isSolid(grid: readonly (readonly Cell[])[], col: number, row: number, solid?: (cell: Cell) => boolean): boolean;
  inBounds(grid: readonly (readonly Cell[])[], col: number, row: number): boolean;
  toWorld(col: number, row: number, size: number): { x: number; y: number };
  toGrid(x: number, y: number, size: number): GridPosition;
}

export const NEIGHBORS: readonly GridPosition[] = [
  { col: 0, row: -1 },
  { col: 1, row: 0 },
  { col: 0, row: 1 },
  { col: -1, row: 0 },
];

export function createGridService(): GridService {
  return {
    get(grid, col, row) {
      if (!Number.isInteger(col) || !Number.isInteger(row)) return null;
      const line = grid[row];
      if (line === undefined) return null;
      return line[col] ?? null;
    },
    isSolid(grid, col, row, solid = (cell) => cell !== 0 && cell !== '.') {
      const cell = this.get(grid, col, row);
      return cell !== null && solid(cell);
    },
    inBounds(grid, col, row) {
      return row >= 0 && row < grid.length && (grid[row]?.length ?? 0) > col && col >= 0;
    },
    toWorld(col, row, size) {
      return { x: col * size + size / 2, y: row * size + size / 2 };
    },
    toGrid(x, y, size) {
      return { col: Math.floor(x / size), row: Math.floor(y / size) };
    },
  };
}
