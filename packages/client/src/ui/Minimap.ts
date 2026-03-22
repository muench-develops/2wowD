import Phaser from 'phaser';
import { type MapData, TileType } from '@isoheim/shared';

const SIZE = 150;
const SCALE = SIZE / 50; // 3px per tile
const DEPTH = 200;

const TILE_COLORS: Record<TileType, number> = {
  [TileType.Grass]: 0x2d5a1e,
  [TileType.Dirt]: 0x8b6914,
  [TileType.Stone]: 0x777788,
  [TileType.Water]: 0x2244aa,
  [TileType.Portal]: 0x00dddd,
};

export interface MinimapEntityData {
  playerId: string | null;
  players: Array<{ id: string; x: number; y: number }>;
  mobs: Array<{ x: number; y: number }>;
}

export class Minimap {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private visible = true;
  private dots: Phaser.GameObjects.Graphics;
  private mapImage: Phaser.GameObjects.Image | null = null;
  private bg: Phaser.GameObjects.Graphics;

  private originX: number;
  private originY: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    const cam = scene.cameras.main;
    const padding = 10;
    this.originX = cam.width - SIZE - padding;
    this.originY = padding;

    this.container = scene.add.container(this.originX, this.originY);
    this.container.setDepth(DEPTH);
    this.container.setScrollFactor(0);

    // Dark background
    this.bg = scene.add.graphics();
    this.bg.fillStyle(0x111122, 0.8);
    this.bg.fillRect(0, 0, SIZE, SIZE);
    this.bg.lineStyle(1, 0x444466, 1);
    this.bg.strokeRect(0, 0, SIZE, SIZE);
    this.container.add(this.bg);

    // Dots overlay drawn every frame
    this.dots = scene.add.graphics();
    this.container.add(this.dots);
  }

  /** Render the static tile map and cache it as a texture. */
  renderMap(mapData: MapData): void {
    const gfx = this.scene.add.graphics();

    for (let row = 0; row < mapData.height; row++) {
      for (let col = 0; col < mapData.width; col++) {
        const tileType = mapData.tiles[row]?.[col] ?? TileType.Grass;
        const color = TILE_COLORS[tileType] ?? 0x2d5a1e;
        gfx.fillStyle(color, 1);
        gfx.fillRect(col * SCALE, row * SCALE, SCALE, SCALE);
      }
    }

    const texKey = '__minimap_tiles';
    if (this.scene.textures.exists(texKey)) {
      this.scene.textures.remove(texKey);
    }
    gfx.generateTexture(texKey, SIZE, SIZE);
    gfx.destroy();

    if (this.mapImage) {
      this.mapImage.destroy();
    }
    this.mapImage = this.scene.add.image(0, 0, texKey);
    this.mapImage.setOrigin(0, 0);
    this.container.addAt(this.mapImage, 1);
  }

  /** Redraw entity dots. Called every frame. */
  updateEntities(data: MinimapEntityData): void {
    this.dots.clear();

    // Mobs (red, smallest — draw first so players render on top)
    for (const mob of data.mobs) {
      this.dots.fillStyle(0xff4444, 1);
      this.dots.fillCircle(mob.x * SCALE, mob.y * SCALE, 2);
    }

    // Other players (blue)
    for (const player of data.players) {
      if (player.id === data.playerId) continue;
      this.dots.fillStyle(0x4488ff, 1);
      this.dots.fillCircle(player.x * SCALE, player.y * SCALE, 3);
    }

    // Local player (white, on top)
    if (data.playerId) {
      const local = data.players.find((p) => p.id === data.playerId);
      if (local) {
        this.dots.fillStyle(0xffffff, 1);
        this.dots.fillCircle(local.x * SCALE, local.y * SCALE, 4);
      }
    }
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
