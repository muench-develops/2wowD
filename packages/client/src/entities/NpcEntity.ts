import Phaser from 'phaser';
import { type NpcId, worldToScreen, NPC_DEFINITIONS } from '@isoheim/shared';
import { getDepthForPosition } from '../systems/IsometricHelper';

const NPC_COLORS: Record<NpcId, number> = {
  'guard-captain': 0x4488cc, // blue
  'merchant': 0xccaa44, // gold
  'ranger': 0x44cc44, // green
  'hermit': 0x8844cc, // purple
  'adventurer': 0xcc8844, // orange
  'priest': 0xcccccc, // white
};

export class NpcEntity {
  readonly id: NpcId;
  sprite: Phaser.GameObjects.Sprite;
  nameTag: Phaser.GameObjects.Text;
  questIndicator: Phaser.GameObjects.Text;
  
  worldX: number;
  worldY: number;
  hasQuest = false;
  questReady = false;

  constructor(scene: Phaser.Scene, npcId: NpcId, x: number, y: number, hasQuest: boolean, questReady: boolean) {
    this.id = npcId;
    this.worldX = x;
    this.worldY = y;
    this.hasQuest = hasQuest;
    this.questReady = questReady;

    const screen = worldToScreen(x, y);
    const def = NPC_DEFINITIONS[npcId];
    const color = NPC_COLORS[npcId] || 0xffffff;

    // Create NPC sprite with procedural texture
    const textureKey = `npc-${npcId}`;
    if (!scene.textures.exists(textureKey)) {
      this.createNpcTexture(scene, textureKey, color);
    }

    this.sprite = scene.add.sprite(screen.x, screen.y, textureKey);
    this.sprite.setOrigin(0.5, 0.75);
    this.sprite.setInteractive({ useHandCursor: true });
    this.sprite.setData('entityId', npcId);
    this.sprite.setData('entityType', 'npc');

    this.nameTag = scene.add.text(screen.x, screen.y - 40, def.name, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#88ccff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.nameTag.setOrigin(0.5, 1);

    this.questIndicator = scene.add.text(screen.x, screen.y - 50, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.questIndicator.setOrigin(0.5, 1);

    this.updateQuestIndicator();
    this.updateDepth();
  }

  private createNpcTexture(scene: Phaser.Scene, key: string, color: number): void {
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
    
    // Draw NPC body (friendly humanoid shape)
    graphics.fillStyle(color, 1);
    graphics.fillCircle(16, 12, 6); // head
    graphics.fillRect(13, 18, 6, 10); // body
    graphics.fillRect(10, 22, 3, 6); // left arm
    graphics.fillRect(19, 22, 3, 6); // right arm
    graphics.fillRect(13, 28, 2, 8); // left leg
    graphics.fillRect(17, 28, 2, 8); // right leg

    // Add eyes
    graphics.fillStyle(0xffffff, 1);
    graphics.fillCircle(14, 11, 1.5);
    graphics.fillCircle(18, 11, 1.5);
    graphics.fillStyle(0x000000, 1);
    graphics.fillCircle(14, 11, 0.8);
    graphics.fillCircle(18, 11, 0.8);

    graphics.generateTexture(key, 32, 48);
    graphics.destroy();
  }

  updateQuestIndicator(): void {
    if (this.questReady) {
      this.questIndicator.setText('?');
      this.questIndicator.setColor('#cccccc'); // silver
    } else if (this.hasQuest) {
      this.questIndicator.setText('!');
      this.questIndicator.setColor('#ffcc00'); // yellow
    } else {
      this.questIndicator.setText('');
    }
  }

  updateFromServer(hasQuest: boolean, questReady: boolean): void {
    this.hasQuest = hasQuest;
    this.questReady = questReady;
    this.updateQuestIndicator();
  }

  private updateDepth(): void {
    const d = getDepthForPosition(this.worldX, this.worldY);
    this.sprite.setDepth(d + 1);
    this.nameTag.setDepth(d + 4);
    this.questIndicator.setDepth(d + 4);
  }

  destroy(): void {
    this.sprite.destroy();
    this.nameTag.destroy();
    this.questIndicator.destroy();
  }
}
