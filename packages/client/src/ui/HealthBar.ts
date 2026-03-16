import Phaser from 'phaser';

export class HealthBar {
  private bg: Phaser.GameObjects.Graphics;
  private fill: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private x: number;
  private y: number;
  private width: number;
  private height: number;
  private fillColor: number;
  private current = 0;
  private max = 1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    fillColor: number = 0xcc2222,
  ) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.fillColor = fillColor;

    this.bg = scene.add.graphics();
    this.fill = scene.add.graphics();
    this.label = scene.add.text(x + width / 2, y + height / 2, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.label.setOrigin(0.5, 0.5);

    this.draw();
  }

  setValue(current: number, max: number): void {
    this.current = current;
    this.max = max;
    this.draw();
  }

  private draw(): void {
    this.bg.clear();
    this.bg.fillStyle(0x222222, 0.9);
    this.bg.fillRect(this.x, this.y, this.width, this.height);
    this.bg.lineStyle(1, 0x555555, 1);
    this.bg.strokeRect(this.x, this.y, this.width, this.height);

    const ratio = this.max > 0 ? Math.max(0, this.current / this.max) : 0;
    this.fill.clear();
    this.fill.fillStyle(this.fillColor, 1);
    this.fill.fillRect(this.x, this.y, this.width * ratio, this.height);

    this.label.setText(`${Math.floor(this.current)} / ${Math.floor(this.max)}`);
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.label.setPosition(x + this.width / 2, y + this.height / 2);
    this.draw();
  }

  setDepth(d: number): void {
    this.bg.setDepth(d);
    this.fill.setDepth(d);
    this.label.setDepth(d);
  }

  setVisible(v: boolean): void {
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
