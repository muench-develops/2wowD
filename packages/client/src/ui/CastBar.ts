import Phaser from 'phaser';

export class CastBar {
  private bg: Phaser.GameObjects.Graphics;
  private fill: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private visible = false;
  private startTime = 0;
  private duration = 0;

  private readonly x: number;
  private readonly y: number;
  private readonly width = 240;
  private readonly height = 18;

  constructor(scene: Phaser.Scene) {
    this.x = (1280 - this.width) / 2;
    this.y = 720 - 100;

    this.bg = scene.add.graphics();
    this.bg.setDepth(100);
    this.fill = scene.add.graphics();
    this.fill.setDepth(101);

    this.label = scene.add.text(1280 / 2, this.y + this.height / 2, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.label.setOrigin(0.5, 0.5).setDepth(102);

    this.setVisible(false);
  }

  startCast(abilityName: string, durationMs: number): void {
    this.visible = true;
    this.startTime = Date.now();
    this.duration = durationMs;
    this.label.setText(abilityName);
    this.setVisible(true);
  }

  cancelCast(): void {
    this.visible = false;
    this.setVisible(false);
  }

  update(): void {
    if (!this.visible) return;

    const elapsed = Date.now() - this.startTime;
    const ratio = Math.min(1, elapsed / this.duration);

    this.bg.clear();
    this.bg.fillStyle(0x222233, 0.85);
    this.bg.fillRoundedRect(this.x, this.y, this.width, this.height, 4);
    this.bg.lineStyle(1, 0x6666aa, 1);
    this.bg.strokeRoundedRect(this.x, this.y, this.width, this.height, 4);

    this.fill.clear();
    this.fill.fillStyle(0x4488ff, 1);
    this.fill.fillRoundedRect(this.x + 1, this.y + 1, (this.width - 2) * ratio, this.height - 2, 3);

    if (ratio >= 1) {
      this.cancelCast();
    }
  }

  private setVisible(v: boolean): void {
    this.bg.setVisible(v);
    this.fill.setVisible(v);
    this.label.setVisible(v);
  }

  destroy(): void {
    this.bg.destroy();
    this.fill.destroy();
    this.label.destroy();
  }
}
