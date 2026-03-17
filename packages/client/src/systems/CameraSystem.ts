import Phaser from 'phaser';
import { lerp, MAP_WIDTH, MAP_HEIGHT, worldToScreen } from '@isoheim/shared';

const BOUNDS_PADDING = 100;

export class CameraSystem {
  private scene: Phaser.Scene;
  private targetX = 0;
  private targetY = 0;
  private smoothing = 0.1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.updateBounds(MAP_WIDTH, MAP_HEIGHT);
  }

  /** Recalculate camera bounds for a given map size (in tiles) */
  updateBounds(mapWidth: number, mapHeight: number): void {
    const left = worldToScreen(0, mapHeight);
    const right = worldToScreen(mapWidth, 0);
    const top = worldToScreen(0, 0);
    const bottom = worldToScreen(mapWidth, mapHeight);

    const minX = left.x - BOUNDS_PADDING;
    const maxX = right.x + BOUNDS_PADDING;
    const minY = top.y - BOUNDS_PADDING;
    const maxY = bottom.y + BOUNDS_PADDING;

    this.scene.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);
  }

  /** Immediately center the camera on a screen-space position */
  snapTo(screenX: number, screenY: number): void {
    this.targetX = screenX;
    this.targetY = screenY;
    this.scene.cameras.main.centerOn(screenX, screenY);
  }

  /** Set the screen-space target for the camera to follow */
  setTarget(screenX: number, screenY: number): void {
    this.targetX = screenX;
    this.targetY = screenY;
  }

  update(): void {
    const cam = this.scene.cameras.main;
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;

    const newX = lerp(cx, this.targetX, this.smoothing);
    const newY = lerp(cy, this.targetY, this.smoothing);

    cam.setScroll(newX - cam.width / 2, newY - cam.height / 2);
  }
}
