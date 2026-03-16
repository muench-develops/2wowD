import Phaser from 'phaser';

export class FloatingText {
  static spawn(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    color: string = '#ff4444',
    fontSize: number = 16,
  ): void {
    const txt = scene.add.text(x, y, text, {
      fontFamily: 'monospace',
      fontSize: `${fontSize}px`,
      color,
      stroke: '#000000',
      strokeThickness: 3,
      fontStyle: 'bold',
    });
    txt.setOrigin(0.5, 1);
    txt.setDepth(10000);

    scene.tweens.add({
      targets: txt,
      y: y - 50,
      alpha: 0,
      duration: 1200,
      ease: 'Cubic.easeOut',
      onComplete: () => txt.destroy(),
    });
  }
}
