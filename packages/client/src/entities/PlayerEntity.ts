import Phaser from 'phaser';
import { PlayerState, BuffState, worldToScreen, lerp } from '@2wowd/shared';
import { getDepthForPosition } from '../systems/IsometricHelper';

export class PlayerEntity {
  readonly id: string;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  highlight: Phaser.GameObjects.Graphics | null = null;

  private targetScreenX = 0;
  private targetScreenY = 0;
  private isLocal: boolean;
  private baseName: string;
  private currentLevel: number;
  private activeBuffIds: Set<string> = new Set();

  // Client-side prediction
  worldX: number;
  worldY: number;
  isDead = false;

  constructor(scene: Phaser.Scene, state: PlayerState, isLocal: boolean) {
    this.id = state.id;
    this.isLocal = isLocal;
    this.worldX = state.position.x;
    this.worldY = state.position.y;
    this.baseName = state.name;
    this.currentLevel = state.level;

    const screen = worldToScreen(state.position.x, state.position.y);
    const textureKey = `player-${state.classType}`;

    this.sprite = scene.add.sprite(screen.x, screen.y, textureKey);
    this.sprite.setOrigin(0.5, 0.75);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.setData('entityId', state.id);
    this.sprite.setData('entityType', 'player');

    this.nameTag = scene.add.text(screen.x, screen.y - 28, this.formatName(), {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: isLocal ? '#00ff88' : '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.nameTag.setOrigin(0.5, 1);

    if (isLocal) {
      this.highlight = scene.add.graphics();
      this.drawHighlight(screen.x, screen.y);
    }

    this.targetScreenX = screen.x;
    this.targetScreenY = screen.y;
    this.updateDepth();

    if (state.isDead) this.setDead(true);
  }

  private drawHighlight(x: number, y: number): void {
    if (!this.highlight) return;
    this.highlight.clear();
    this.highlight.lineStyle(2, 0x00ff88, 0.6);
    this.highlight.strokeEllipse(x, y + 4, 40, 16);
  }

  updateFromState(state: PlayerState): void {
    const screen = worldToScreen(state.position.x, state.position.y);
    this.worldX = state.position.x;
    this.worldY = state.position.y;

    if (state.level !== undefined && state.level !== this.currentLevel) {
      this.currentLevel = state.level;
      this.nameTag.setText(this.formatName());
    }

    if (this.isLocal) {
      // For local player, snap to predicted position (already set via setWorldPosition)
      // but reconcile if needed
    } else {
      this.targetScreenX = screen.x;
      this.targetScreenY = screen.y;
    }

    this.setDead(state.isDead);
  }

  /** For local player: set world position directly from prediction */
  setWorldPosition(wx: number, wy: number): void {
    this.worldX = wx;
    this.worldY = wy;
    const screen = worldToScreen(wx, wy);
    this.sprite.setPosition(screen.x, screen.y);
    this.nameTag.setPosition(screen.x, screen.y - 28);
    if (this.highlight) this.drawHighlight(screen.x, screen.y);
    this.updateDepth();
  }

  update(dt: number): void {
    if (!this.isLocal) {
      // Interpolate remote players
      const cx = this.sprite.x;
      const cy = this.sprite.y;
      const newX = lerp(cx, this.targetScreenX, 0.15);
      const newY = lerp(cy, this.targetScreenY, 0.15);
      this.sprite.setPosition(newX, newY);
      this.nameTag.setPosition(newX, newY - 28);
      this.updateDepth();
    }
  }

  private updateDepth(): void {
    const d = getDepthForPosition(this.worldX, this.worldY);
    this.sprite.setDepth(d + 1);
    this.nameTag.setDepth(d + 2);
    if (this.highlight) this.highlight.setDepth(d);
  }

  setDead(dead: boolean): void {
    this.isDead = dead;
    if (dead) {
      this.sprite.setAlpha(0.3);
      this.sprite.setTint(0x666666);
      this.activeBuffIds.clear();
    } else {
      this.sprite.setAlpha(1);
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
    } else if (this.activeBuffIds.has('buff-vanish')) {
      this.sprite.setAlpha(0.3);
      this.sprite.setTint(0xffffff);
    } else if (this.activeBuffIds.has('buff-shield-block') || this.activeBuffIds.has('buff-pw-shield')) {
      this.sprite.setTint(0xffdd44); // golden
    } else {
      this.sprite.setTint(0xffffff);
      this.sprite.setAlpha(1);
    }
  }

  setLevel(level: number): void {
    this.currentLevel = level;
    this.nameTag.setText(this.formatName());
  }

  private formatName(): string {
    return `${this.baseName} [Lv ${this.currentLevel}]`;
  }

  destroy(): void {
    this.sprite.destroy();
    this.nameTag.destroy();
    if (this.highlight) this.highlight.destroy();
  }
}
