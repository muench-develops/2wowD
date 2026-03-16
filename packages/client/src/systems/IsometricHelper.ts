import {
  worldToScreen,
  screenToWorld,
  ISO_TILE_WIDTH,
  ISO_TILE_HEIGHT,
} from '@2wowd/shared';

export { worldToScreen, screenToWorld };

/** Depth value for z-sorting: higher values render on top */
export function getDepthForPosition(wx: number, wy: number): number {
  return (wx + wy) * ISO_TILE_HEIGHT;
}

/** Given screen-space pixel coords (world-camera-adjusted), return tile col/row */
export function getTileAtScreen(sx: number, sy: number): { col: number; row: number } {
  const world = screenToWorld(sx, sy);
  return { col: Math.floor(world.x), row: Math.floor(world.y) };
}

/** Render an isometric diamond tile path on a Graphics object */
export function drawIsoDiamond(
  graphics: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  w: number = ISO_TILE_WIDTH,
  h: number = ISO_TILE_HEIGHT,
): void {
  graphics.beginPath();
  graphics.moveTo(cx, cy - h / 2);
  graphics.lineTo(cx + w / 2, cy);
  graphics.lineTo(cx, cy + h / 2);
  graphics.lineTo(cx - w / 2, cy);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
}
