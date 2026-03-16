import Phaser from 'phaser';
import {
  type InventoryItem,
  ITEM_DATABASE,
  ItemType,
  INVENTORY_SIZE,
  ServerMessageType,
  ClientMessageType,
} from '@isoheim/shared';
import { NetworkManager } from '../network/NetworkManager';

const COLS = 4;
const ROWS = 5;
const SLOT_SIZE = 48;
const SLOT_GAP = 4;
const PADDING = 12;
const HEADER_HEIGHT = 28;

const RARITY_COLORS: Record<string, number> = {
  common: 0x9d9d9d,
  uncommon: 0x1eff00,
  rare: 0x0070dd,
  epic: 0xa335ee,
};

const RARITY_TEXT_COLORS: Record<string, string> = {
  common: '#9d9d9d',
  uncommon: '#1eff00',
  rare: '#0070dd',
  epic: '#a335ee',
};

export class InventoryPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private slots: Phaser.GameObjects.Graphics[] = [];
  private itemIcons: Phaser.GameObjects.Text[] = [];
  private itemQuantities: Phaser.GameObjects.Text[] = [];
  private inventory: InventoryItem[] = [];
  private visible = false;
  private tooltip: Phaser.GameObjects.Container | null = null;
  private dragSlot: number = -1;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const panelW = COLS * SLOT_SIZE + (COLS - 1) * SLOT_GAP + PADDING * 2;
    const panelH = ROWS * SLOT_SIZE + (ROWS - 1) * SLOT_GAP + PADDING * 2 + HEADER_HEIGHT;

    const x = 1280 - panelW - 16;
    const y = (720 - panelH) / 2;

    this.container = this.scene.add.container(x, y);
    this.container.setDepth(1000);
    this.container.setVisible(false);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.92);
    bg.fillRoundedRect(0, 0, panelW, panelH, 8);
    bg.lineStyle(2, 0x4a4a6a);
    bg.strokeRoundedRect(0, 0, panelW, panelH, 8);
    this.container.add(bg);

    // Title
    const titleText = this.scene.add.text(panelW / 2, 14, 'Inventory', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#e0c070',
    }).setOrigin(0.5);
    this.container.add(titleText);

    // Slots
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const slotIdx = row * COLS + col;
        const sx = PADDING + col * (SLOT_SIZE + SLOT_GAP);
        const sy = HEADER_HEIGHT + PADDING + row * (SLOT_SIZE + SLOT_GAP);

        const slotGfx = this.scene.add.graphics();
        slotGfx.fillStyle(0x2a2a3e, 0.8);
        slotGfx.fillRoundedRect(sx, sy, SLOT_SIZE, SLOT_SIZE, 4);
        slotGfx.lineStyle(1, 0x3a3a5e);
        slotGfx.strokeRoundedRect(sx, sy, SLOT_SIZE, SLOT_SIZE, 4);
        this.container.add(slotGfx);
        this.slots.push(slotGfx);

        const icon = this.scene.add.text(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2 - 4, '', {
          fontSize: '22px',
        }).setOrigin(0.5);
        this.container.add(icon);
        this.itemIcons.push(icon);

        const qty = this.scene.add.text(sx + SLOT_SIZE - 4, sy + SLOT_SIZE - 4, '', {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#ffffff',
        }).setOrigin(1, 1);
        this.container.add(qty);
        this.itemQuantities.push(qty);

        const hitZone = this.scene.add.zone(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2, SLOT_SIZE, SLOT_SIZE)
          .setInteractive({ useHandCursor: true })
          .on('pointerover', () => this.showTooltip(slotIdx, sx, sy))
          .on('pointerout', () => this.hideTooltip())
          .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (pointer.rightButtonDown()) {
              this.useItem(slotIdx);
            } else {
              this.startDrag(slotIdx);
            }
          })
          .on('pointerup', () => this.endDrag(slotIdx));
        this.container.add(hitZone);
      }
    }
  }

  updateInventory(inventory: InventoryItem[]): void {
    this.inventory = inventory;
    this.refresh();
  }

  private refresh(): void {
    for (let i = 0; i < INVENTORY_SIZE; i++) {
      this.itemIcons[i].setText('');
      this.itemQuantities[i].setText('');

      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const sx = PADDING + col * (SLOT_SIZE + SLOT_GAP);
      const sy = HEADER_HEIGHT + PADDING + row * (SLOT_SIZE + SLOT_GAP);
      this.slots[i].clear();
      this.slots[i].fillStyle(0x2a2a3e, 0.8);
      this.slots[i].fillRoundedRect(sx, sy, SLOT_SIZE, SLOT_SIZE, 4);
      this.slots[i].lineStyle(1, 0x3a3a5e);
      this.slots[i].strokeRoundedRect(sx, sy, SLOT_SIZE, SLOT_SIZE, 4);
    }

    for (const item of this.inventory) {
      const def = ITEM_DATABASE[item.itemId];
      if (!def || item.slot >= INVENTORY_SIZE) continue;

      const idx = item.slot;
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const sx = PADDING + col * (SLOT_SIZE + SLOT_GAP);
      const sy = HEADER_HEIGHT + PADDING + row * (SLOT_SIZE + SLOT_GAP);

      const rarityColor = RARITY_COLORS[def.rarity] || 0x3a3a5e;
      this.slots[idx].clear();
      this.slots[idx].fillStyle(0x2a2a3e, 0.8);
      this.slots[idx].fillRoundedRect(sx, sy, SLOT_SIZE, SLOT_SIZE, 4);
      this.slots[idx].lineStyle(2, rarityColor);
      this.slots[idx].strokeRoundedRect(sx, sy, SLOT_SIZE, SLOT_SIZE, 4);

      this.itemIcons[idx].setText(def.icon);

      if (item.quantity > 1) {
        this.itemQuantities[idx].setText(`${item.quantity}`);
      }
    }
  }

  private showTooltip(slotIdx: number, sx: number, sy: number): void {
    const item = this.inventory.find(i => i.slot === slotIdx);
    if (!item) return;

    const def = ITEM_DATABASE[item.itemId];
    if (!def) return;

    this.hideTooltip();

    const rarityColor = RARITY_TEXT_COLORS[def.rarity] || '#ffffff';

    let text = `${def.icon} ${def.name}\n`;
    text += `${def.type} | ${def.rarity}\n`;
    if (def.description) text += `${def.description}\n`;

    const stats = def.stats;
    if (stats.attack) text += `+${stats.attack} Attack\n`;
    if (stats.defense) text += `+${stats.defense} Defense\n`;
    if (stats.health) text += `+${stats.health} Health\n`;
    if (stats.mana) text += `+${stats.mana} Mana\n`;
    if (stats.speed) text += `+${stats.speed} Speed\n`;
    if (stats.critChance) text += `+${(stats.critChance * 100).toFixed(0)}% Crit\n`;

    if (def.levelReq > 1) text += `Requires Level ${def.levelReq}\n`;
    if (def.classReq.length > 0 && def.classReq.length < 4) text += `${def.classReq.join(', ')} only\n`;

    this.tooltip = this.scene.add.container(sx - 160, sy);

    const tipBg = this.scene.add.graphics();
    const tipText = this.scene.add.text(8, 8, text.trim(), {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: rarityColor,
      wordWrap: { width: 180 },
    });

    const bounds = tipText.getBounds();
    tipBg.fillStyle(0x0a0a1e, 0.95);
    tipBg.fillRoundedRect(0, 0, bounds.width + 16, bounds.height + 16, 6);
    tipBg.lineStyle(1, 0x4a4a6a);
    tipBg.strokeRoundedRect(0, 0, bounds.width + 16, bounds.height + 16, 6);

    this.tooltip.add([tipBg, tipText]);
    this.tooltip.setDepth(1100);
    this.container.add(this.tooltip);
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  private useItem(slotIdx: number): void {
    const item = this.inventory.find(i => i.slot === slotIdx);
    if (!item) return;

    const def = ITEM_DATABASE[item.itemId];
    if (!def) return;

    if (def.type === ItemType.Consumable && def.useEffect) {
      NetworkManager.instance.send({
        type: ClientMessageType.UseItem,
        slot: slotIdx,
      });
    }
  }

  private startDrag(slotIdx: number): void {
    const item = this.inventory.find(i => i.slot === slotIdx);
    if (item) {
      this.dragSlot = slotIdx;
    }
  }

  private endDrag(targetSlot: number): void {
    if (this.dragSlot === -1 || this.dragSlot === targetSlot) {
      this.dragSlot = -1;
      return;
    }

    NetworkManager.instance.send({
      type: ClientMessageType.MoveItem,
      fromSlot: this.dragSlot,
      toSlot: targetSlot,
    });

    this.dragSlot = -1;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
    if (!this.visible) {
      this.hideTooltip();
    }
  }

  isOpen(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.hideTooltip();
    this.container.destroy();
  }
}
