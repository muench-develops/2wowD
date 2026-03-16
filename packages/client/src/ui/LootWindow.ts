import Phaser from 'phaser';
import { type WorldLoot, ITEM_DATABASE, ClientMessageType } from '@isoheim/shared';
import { NetworkManager } from '../network/NetworkManager';

const SLOT_SIZE = 40;
const SLOT_GAP = 4;
const PADDING = 10;

const RARITY_TEXT_COLORS: Record<string, string> = {
  common: '#9d9d9d',
  uncommon: '#1eff00',
  rare: '#0070dd',
  epic: '#a335ee',
};

export class LootWindow {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private currentLoot: WorldLoot | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(loot: WorldLoot): void {
    this.close();
    this.currentLoot = loot;

    const items = loot.items;
    const panelW = SLOT_SIZE + PADDING * 2 + 120;
    const panelH = items.length * (SLOT_SIZE + SLOT_GAP) + PADDING * 2 + 24;

    const x = 640 - panelW / 2;
    const y = 360 - panelH / 2;

    this.container = this.scene.add.container(x, y);
    this.container.setDepth(1050);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(0, 0, panelW, panelH, 8);
    bg.lineStyle(2, 0xe0c070);
    bg.strokeRoundedRect(0, 0, panelW, panelH, 8);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(panelW / 2, 12, 'Loot', {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#e0c070',
    }).setOrigin(0.5);
    this.container.add(title);

    // Items
    items.forEach((item, idx) => {
      const def = ITEM_DATABASE[item.itemId];
      if (!def) return;

      const iy = 28 + PADDING + idx * (SLOT_SIZE + SLOT_GAP);

      const slotBg = this.scene.add.graphics();
      slotBg.fillStyle(0x2a2a3e, 0.8);
      slotBg.fillRoundedRect(PADDING, iy, panelW - PADDING * 2, SLOT_SIZE, 4);
      this.container!.add(slotBg);

      const icon = this.scene.add.text(PADDING + 20, iy + SLOT_SIZE / 2, def.icon, {
        fontSize: '20px',
      }).setOrigin(0.5);
      this.container!.add(icon);

      const rarityColor = RARITY_TEXT_COLORS[def.rarity] || '#ffffff';
      const nameText = item.quantity > 1 ? `${def.name} x${item.quantity}` : def.name;
      const name = this.scene.add.text(PADDING + 44, iy + SLOT_SIZE / 2, nameText, {
        fontSize: '12px',
        fontFamily: 'monospace',
        color: rarityColor,
      }).setOrigin(0, 0.5);
      this.container!.add(name);

      const hitZone = this.scene.add.zone(panelW / 2, iy + SLOT_SIZE / 2, panelW - PADDING * 2, SLOT_SIZE)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          NetworkManager.instance.send({
            type: ClientMessageType.PickupItem,
            lootId: loot.id,
            itemIndex: idx,
          });
        });
      this.container!.add(hitZone);
    });
  }

  close(): void {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
    this.currentLoot = null;
  }

  isOpen(): boolean {
    return this.container !== null;
  }

  getCurrentLootId(): string | null {
    return this.currentLoot?.id ?? null;
  }

  removeItem(itemIndex: number): void {
    if (!this.currentLoot) return;
    this.currentLoot.items.splice(itemIndex, 1);
    if (this.currentLoot.items.length === 0) {
      this.close();
    } else {
      this.show(this.currentLoot);
    }
  }

  destroy(): void {
    this.close();
  }
}
