import { Vec2, Direction, EquipmentSlot } from './types.js';
import { ISO_TILE_WIDTH, ISO_TILE_HEIGHT } from './constants.js';

// ============================================================
// Isometric Coordinate Conversion
// ============================================================

/** Convert world (tile) coordinates to screen (pixel) coordinates */
export function worldToScreen(wx: number, wy: number): Vec2 {
  return {
    x: (wx - wy) * (ISO_TILE_WIDTH / 2),
    y: (wx + wy) * (ISO_TILE_HEIGHT / 2),
  };
}

/** Convert screen (pixel) coordinates to world (tile) coordinates */
export function screenToWorld(sx: number, sy: number): Vec2 {
  return {
    x: (sx / (ISO_TILE_WIDTH / 2) + sy / (ISO_TILE_HEIGHT / 2)) / 2,
    y: (sy / (ISO_TILE_HEIGHT / 2) - sx / (ISO_TILE_WIDTH / 2)) / 2,
  };
}

// ============================================================
// Distance & Vector Utilities
// ============================================================

/** Euclidean distance between two points */
export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Normalize a vector to unit length */
export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

/** Get direction enum from a direction vector */
export function vectorToDirection(v: Vec2): Direction {
  if (v.x === 0 && v.y === 0) return Direction.S;
  const angle = Math.atan2(v.y, v.x) * (180 / Math.PI);
  if (angle >= -22.5 && angle < 22.5) return Direction.E;
  if (angle >= 22.5 && angle < 67.5) return Direction.SE;
  if (angle >= 67.5 && angle < 112.5) return Direction.S;
  if (angle >= 112.5 && angle < 157.5) return Direction.SW;
  if (angle >= 157.5 || angle < -157.5) return Direction.W;
  if (angle >= -157.5 && angle < -112.5) return Direction.NW;
  if (angle >= -112.5 && angle < -67.5) return Direction.N;
  return Direction.NE;
}

/** Lerp between two values */
export function lerp(a: number, b: number, t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return a + (b - a) * clamped;
}

/** Clamp-safe Math extension */
declare global {
  interface Math {
    clamp01(value: number): number;
  }
}

Math.clamp01 = function (value: number): number {
  return Math.max(0, Math.min(1, value));
};

/** Generate a simple unique ID */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/** Create a new equipment map with all 7 slots set to null */
export function createDefaultEquipmentMap(): Map<EquipmentSlot, string | null> {
  return new Map<EquipmentSlot, string | null>([
    [EquipmentSlot.Weapon, null],
    [EquipmentSlot.Head, null],
    [EquipmentSlot.Chest, null],
    [EquipmentSlot.Legs, null],
    [EquipmentSlot.Boots, null],
    [EquipmentSlot.Ring1, null],
    [EquipmentSlot.Ring2, null],
  ]);
}
