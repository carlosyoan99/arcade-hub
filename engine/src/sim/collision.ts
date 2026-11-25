import type { EnginePlugin, PluginAPI } from '../core/plugins.js';
import type { Cell } from './grid.js';

export const COLLISION_SERVICE = 'collision';

export interface AABB {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Circle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

export interface CollisionService {
  aabbOverlap(a: AABB, b: AABB): boolean;
  circleAabb(circle: Circle, rect: AABB): boolean;
  pointInTile(x: number, y: number, size: number, col: number, row: number): boolean;
  /** Empuja un círculo fuera de un tile; devuelve la posición corregida. */
  resolveCircleTile(circle: Circle, tile: AABB): { x: number; y: number; hit: boolean };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleAabb(circle: Circle, rect: AABB): boolean {
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

export function resolveCircleTile(circle: Circle, tile: AABB): { x: number; y: number; hit: boolean } {
  if (!circleAabb(circle, tile)) return { x: circle.x, y: circle.y, hit: false };
  const left = Math.abs(circle.x - tile.x);
  const right = Math.abs(tile.x + tile.w - circle.x);
  const top = Math.abs(circle.y - tile.y);
  const bottom = Math.abs(tile.y + tile.h - circle.y);
  const minimum = Math.min(left, right, top, bottom);
  if (minimum === left) return { x: tile.x - circle.r, y: circle.y, hit: true };
  if (minimum === right) return { x: tile.x + tile.w + circle.r, y: circle.y, hit: true };
  if (minimum === top) return { x: circle.x, y: tile.y - circle.r, hit: true };
  return { x: circle.x, y: tile.y + tile.h + circle.r, hit: true };
}

export function createCollisionService(): CollisionService {
  return {
    aabbOverlap,
    circleAabb,
    pointInTile(x, y, size, col, row): boolean {
      return (
        x >= col * size &&
        x < (col + 1) * size &&
        y >= row * size &&
        y < (row + 1) * size
      );
    },
    resolveCircleTile,
  };
}

export function collisionPlugin(): EnginePlugin {
  let service: CollisionService | undefined;
  return {
    id: COLLISION_SERVICE,
    install(api: PluginAPI): void {
      service = createCollisionService();
      api.services.provide(COLLISION_SERVICE, service);
    },
    dispose(): void {
      service = undefined;
    },
  };
}

export type GridCell = Cell;
