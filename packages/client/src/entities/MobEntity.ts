import Phaser from 'phaser';
import { MobState, BuffState, worldToScreen, lerp } from '@2wowd/shared';
import { getDepthForPosition } from '../systems/IsometricHelper';

export class MobEntity {
  readonly id: string;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  healthBarBg: Phaser.GameObjects.Graphics;
  healthBarFill: Phaser.GameObjects.Graphics;

  private targetScreenX = 0;
  private targetScreenY = 0;
  worldX: number;
  worldY: number;

  private currentHealth: number;
  private maxHealth: number;
  isDead = false;
  private activeBuffIds: Set<string> = new Set();

  constructor(scene: Phaser.Scene, state: MobState) {
    this.id = state.id;
    this.worldX = state.position.x;
    this.worldY = state.position.y;
    this.currentHealth = state.health;
    this.maxHealth = state.maxHealth;

    const screen = worldToScreen(state.position.x, state.position.y);
    const textureKey = `mob-${state.mobType}`;

    this.sprite = scene.add.sprite(screen.x, screen.y, textureKey);
    this.sprite.setOrigin(0.5, 0.75);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.setData('entityId', state.id);
    this.sprite.setData('entityType', 'mob');

    this.nameTag = scene.add.text(screen.x, screen.y - 36, `${state.name} Lv.${state.level}`, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ff8888',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.nameTag.setOrigin(0.5, 1);

    this.healthBarBg = scene.add.graphics();
    this.healthBarFill = scene.add.graphics();

    this.targetScreenX = screen.x;
    this.targetScreenY = screen.y;
    this.updateHealthBar(screen.x, screen.y);
    this.updateDepth();

    if (state.isDead) this.setDead(true);
  }

  updateFromState(state: MobState): void {
    const screen = worldToScreen(state.position.x, state.position.y);
    this.worldX = state.position.x;
    this.worldY = state.position.y;
    this.targetScreenX = screen.x;
    this.targetScreenY = screen.y;
    this.currentHealth = state.health;
    this.maxHealth = state.maxHealth;

    this.setDead(state.isDead);
  }

  update(_dt: number): void {
    const cx = this.sprite.x;
    const cy = this.sprite.y;
    const newX = lerp(cx, this.targetScreenX, 0.15);
    const newY = lerp(cy, this.targetScreenY, 0.15);
    this.sprite.setPosition(newX, newY);
    this.nameTag.setPosition(newX, newY - 36);
    this.updateHealthBar(newX, newY);
    this.updateDepth();
  }

  private updateHealthBar(x: number, y: number): void {
    const barW = 36;
    const barH = 4;
    const bx = x - barW / 2;
    const by = y - 28;

    this.healthBarBg.clear();
    this.healthBarBg.fillStyle(0x333333, 0.8);
    this.healthBarBg.fillRect(bx, by, barW, barH);

    const ratio = Math.max(0, this.currentHealth / this.maxHealth);
    this.healthBarFill.clear();
    this.healthBarFill.fillStyle(ratio > 0.3 ? 0xcc2222 : 0xff0000, 1);
    this.healthBarFill.fillRect(bx, by, barW * ratio, barH);

    const depth = getDepthForPosition(this.worldX, this.worldY);
    this.healthBarBg.setDepth(depth + 2);
    this.healthBarFill.setDepth(depth + 3);
  }

  private updateDepth(): void {
    const d = getDepthForPosition(this.worldX, this.worldY);
    this.sprite.setDepth(d + 1);
    this.nameTag.setDepth(d + 4);
  }

  setDead(dead: boolean): void {
    this.isDead = dead;
    if (dead) {
      this.sprite.setAlpha(0);
      this.nameTag.setAlpha(0);
      this.healthBarBg.setAlpha(0);
      this.healthBarFill.setAlpha(0);
      this.activeBuffIds.clear();
    } else {
      this.sprite.setAlpha(1);
      this.nameTag.setAlpha(1);
      this.healthBarBg.setAlpha(1);
      this.healthBarFill.setAlpha(1);
      this.applyBuffTint();
    }
  }

  updateBuffVisuals(buff: BuffState): void {
    this.activeBuffIds.add(buff.buffId);
    if (!this.isDead) this.applyBuffTint();
  }

  removeBuffVisual(buffId: string): void {
    this.activeBuffIds.delete(buffId);
    if (!this.isDead) this.applyBuffTint();
  }

  private applyBuffTint(): void {
    if (this.activeBuffIds.has('buff-frostbite')) {
      this.sprite.setTint(0x6688ff); // blue frost
    } else {
      this.sprite.setTint(0xffffff);
    }
  }

  destroy(): void {
    this.sprite.destroy();
    this.nameTag.destroy();
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
  }
}
