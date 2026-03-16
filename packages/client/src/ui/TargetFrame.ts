import Phaser from 'phaser';
import { HealthBar } from './HealthBar';

export class TargetFrame {
  private bg: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private healthBar: HealthBar;
  private visible = false;

  constructor(scene: Phaser.Scene) {
    const cx = 640;
    const y = 8;
    const w = 220;
    const h = 52;
    const x = cx - w / 2;

    this.bg = scene.add.graphics();
    this.bg.fillStyle(0x222233, 0.85);
    this.bg.fillRoundedRect(x, y, w, h, 6);
    this.bg.lineStyle(2, 0xaa4444, 1);
    this.bg.strokeRoundedRect(x, y, w, h, 6);
    this.bg.setDepth(100);

    this.nameText = scene.add.text(cx, y + 6, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ff8888',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.nameText.setOrigin(0.5, 0).setDepth(101);

    this.healthBar = new HealthBar(scene, x + 10, y + 26, w - 20, 16, 0xcc2222);
    this.healthBar.setDepth(101);

    this.setVisible(false);
  }

  show(name: string, health: number, maxHealth: number): void {
    this.visible = true;
    this.nameText.setText(name);
    this.healthBar.setValue(health, maxHealth);
    this.setVisible(true);
  }

  updateHealth(health: number, maxHealth: number): void {
    this.healthBar.setValue(health, maxHealth);
  }

  hide(): void {
    this.visible = false;
    this.setVisible(false);
  }

  private setVisible(v: boolean): void {
    this.bg.setVisible(v);
    this.nameText.setVisible(v);
    this.healthBar.setVisible(v);
  }

  destroy(): void {
    this.bg.destroy();
    this.nameText.destroy();
    this.healthBar.destroy();
  }
}
