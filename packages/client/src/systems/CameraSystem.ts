import Phaser from 'phaser';
import { lerp, MAP_WIDTH, MAP_HEIGHT, worldToScreen } from '@isoheim/shared';

export class CameraSystem {
  private scene: Phaser.Scene;
  private targetX = 0;
  private targetY = 0;
  private smoothing = 0.1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Set world bounds based on map size
    const topLeft = worldToScreen(0, MAP_HEIGHT);
    const topRight = worldToScreen(MAP_WIDTH, 0);
    const bottomLeft = worldToScreen(0, 0);
    const bottomRight = worldToScreen(MAP_WIDTH, MAP_HEIGHT);

    const minX = topLeft.x - 100;
    const maxX = topRight.x + 100;
    const minY = bottomLeft.y - 100;
    const maxY = bottomRight.y + 100;

    this.scene.cameras.main.setBounds(minX, minY, maxX - minX, maxY - minY);
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
