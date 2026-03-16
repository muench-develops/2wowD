import Phaser from 'phaser';
import {
  ClassType,
  TileType,
  MobType,
  ISO_TILE_WIDTH,
  ISO_TILE_HEIGHT,
} from '@isoheim/shared';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Nothing to load externally
  }

  create(): void {
    const loadText = this.add.text(640, 340, 'Generating assets...', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#aaaaff',
    });
    loadText.setOrigin(0.5);

    this.generatePlayerTextures();
    this.generateMobTextures();
    this.generateTileTextures();
    this.generateUITextures();

    loadText.setText('Ready!');

    this.time.delayedCall(300, () => {
      this.scene.start('LoginScene');
    });
  }

  private generatePlayerTextures(): void {
    const colors: Record<ClassType, number> = {
      [ClassType.Warrior]: 0xdd3333,
      [ClassType.Mage]: 0x3366ff,
      [ClassType.Rogue]: 0x33cc55,
      [ClassType.Priest]: 0xeecc33,
    };

    for (const [classType, color] of Object.entries(colors)) {
      const g = this.make.graphics({ x: 0, y: 0 });
      // Diamond shape
      g.fillStyle(color, 1);
      g.beginPath();
      g.moveTo(16, 2);
      g.lineTo(30, 16);
      g.lineTo(16, 30);
      g.lineTo(2, 16);
      g.closePath();
      g.fillPath();
      // Outline
      g.lineStyle(2, 0xffffff, 0.8);
      g.beginPath();
      g.moveTo(16, 2);
      g.lineTo(30, 16);
      g.lineTo(16, 30);
      g.lineTo(2, 16);
      g.closePath();
      g.strokePath();
      g.generateTexture(`player-${classType}`, 32, 32);
      g.destroy();
    }
  }

  private generateMobTextures(): void {
    // Goblin: small orange circle
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xff8833, 1);
      g.fillCircle(16, 16, 10);
      g.lineStyle(2, 0xcc6622, 1);
      g.strokeCircle(16, 16, 10);
      g.generateTexture(`mob-${MobType.Goblin}`, 32, 32);
      g.destroy();
    }
    // Skeleton: gray rectangle
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x999999, 1);
      g.fillRect(8, 6, 16, 20);
      g.lineStyle(2, 0xcccccc, 1);
      g.strokeRect(8, 6, 16, 20);
      // skull hint
      g.fillStyle(0xdddddd, 1);
      g.fillCircle(16, 10, 4);
      g.generateTexture(`mob-${MobType.Skeleton}`, 32, 32);
      g.destroy();
    }
    // Wolf: brown triangle
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0x8B5E3C, 1);
      g.beginPath();
      g.moveTo(16, 4);
      g.lineTo(28, 28);
      g.lineTo(4, 28);
      g.closePath();
      g.fillPath();
      g.lineStyle(2, 0x6b4226, 1);
      g.beginPath();
      g.moveTo(16, 4);
      g.lineTo(28, 28);
      g.lineTo(4, 28);
      g.closePath();
      g.strokePath();
      g.generateTexture(`mob-${MobType.Wolf}`, 32, 32);
      g.destroy();
    }
  }

  private generateTileTextures(): void {
    const tileColors: Record<TileType, { fill: number; stroke: number }> = {
      [TileType.Grass]: { fill: 0x4a8c3f, stroke: 0x3a7030 },
      [TileType.Dirt]: { fill: 0x8B7355, stroke: 0x6b5535 },
      [TileType.Stone]: { fill: 0x888888, stroke: 0x666666 },
      [TileType.Water]: { fill: 0x3366aa, stroke: 0x2255a0 },
    };

    const w = ISO_TILE_WIDTH;
    const h = ISO_TILE_HEIGHT;

    for (const [tileType, colors] of Object.entries(tileColors)) {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(colors.fill, 1);
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.lineTo(w, h / 2);
      g.lineTo(w / 2, h);
      g.lineTo(0, h / 2);
      g.closePath();
      g.fillPath();
      g.lineStyle(1, colors.stroke, 0.6);
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.lineTo(w, h / 2);
      g.lineTo(w / 2, h);
      g.lineTo(0, h / 2);
      g.closePath();
      g.strokePath();
      g.generateTexture(`tile-${tileType}`, w, h);
      g.destroy();
    }
  }

  private generateUITextures(): void {
    // Selection ring
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.lineStyle(2, 0xff4444, 0.8);
      g.strokeEllipse(20, 10, 40, 16);
      g.generateTexture('selection-ring', 40, 20);
      g.destroy();
    }
    // VFX particle (4×4 white circle)
    {
      const g = this.make.graphics({ x: 0, y: 0 });
      g.fillStyle(0xffffff, 1);
      g.fillCircle(2, 2, 2);
      g.generateTexture('particle', 4, 4);
      g.destroy();
    }
  }
}
