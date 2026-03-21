import Phaser from 'phaser';
import {
  type InventoryItem,
  type ItemStats,
  type PlayerEquipment,
  ITEM_DATABASE,
  ItemType,
  INVENTORY_SIZE,
  ClientMessageType,
  EquipmentSlot,
  EQUIPMENT_SLOT_FOR_ITEM_TYPE,
} from '@isoheim/shared';
import { NetworkManager } from '../network/NetworkManager';
import { formatItemStats } from './formatItemStats';

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

const STAT_DISPLAY_LABELS: Record<keyof ItemStats, string> = {
  attack: 'Attack',
  defense: 'Defense',
  health: 'Health',
  mana: 'Mana',
  speed: 'Speed',
  critChance: 'Crit',
};

const STAT_IMPROVE_COLOR = '#44cc44';
const STAT_WORSE_COLOR = '#cc4444';

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
  private currentEquipment: PlayerEquipment = {};

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
              this.handleRightClick(slotIdx);
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

  updateEquipment(equipment: PlayerEquipment): void {
    this.currentEquipment = equipment;
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
    const isEquippable = EQUIPMENT_SLOT_FOR_ITEM_TYPE[def.type] !== null;

    let text = `${def.icon} ${def.name}\n`;
    text += `${def.type} | ${def.rarity}\n`;
    if (def.description) text += `${def.description}\n`;

    text += formatItemStats(def.stats);

    if (def.levelReq > 1) text += `Requires Level ${def.levelReq}\n`;
    if (def.classReq.length > 0 && def.classReq.length < 4) text += `${def.classReq.join(', ')} only\n`;

    if (isEquippable) {
      text += '\n';
      text += this.buildComparisonText(def.type, def.stats);
      text += '\nRight-click to equip';
    } else if (def.type === ItemType.Consumable && def.useEffect) {
      text += '\nRight-click to use';
    }

    this.tooltip = this.scene.add.container(sx - 200, sy);

    const tipBg = this.scene.add.graphics();
    const tipText = this.scene.add.text(8, 8, text.trim(), {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: rarityColor,
      wordWrap: { width: 220 },
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

  private buildComparisonText(itemType: ItemType, newStats: ItemStats): string {
    const targetSlot = EQUIPMENT_SLOT_FOR_ITEM_TYPE[itemType];
    if (!targetSlot) return '';

    const equippedSlot = this.resolveEquipSlot(itemType);
    const equippedItemId = this.currentEquipment[equippedSlot];
    const equippedDef = equippedItemId ? ITEM_DATABASE[equippedItemId] : null;
    const equippedStats = equippedDef?.stats || {};

    const equippedLabel = equippedDef ? equippedDef.name : 'Empty';
    let comparison = `vs ${equippedLabel}:\n`;

    const allStatKeys = new Set<keyof ItemStats>([
      ...Object.keys(newStats) as Array<keyof ItemStats>,
      ...Object.keys(equippedStats) as Array<keyof ItemStats>,
    ]);

    for (const key of allStatKeys) {
      const newVal = newStats[key] || 0;
      const oldVal = equippedStats[key] || 0;
      const diff = newVal - oldVal;
      if (diff === 0) continue;

      const label = STAT_DISPLAY_LABELS[key] || key;
      const prefix = diff > 0 ? '+' : '';
      const formatted = key === 'critChance' ? `${(diff * 100).toFixed(0)}%` : `${diff}`;
      comparison += `  ${prefix}${formatted} ${label}\n`;
    }

    if (comparison.split('\n').length <= 2) {
      comparison += '  No stat change\n';
    }

    return comparison;
  }

  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.destroy();
      this.tooltip = null;
    }
  }

  private handleRightClick(slotIdx: number): void {
    const item = this.inventory.find(i => i.slot === slotIdx);
    if (!item) return;

    const def = ITEM_DATABASE[item.itemId];
    if (!def) return;

    const targetEquipSlot = EQUIPMENT_SLOT_FOR_ITEM_TYPE[def.type];
    if (targetEquipSlot !== null) {
      this.equipItem(slotIdx, def.type);
    } else if (def.type === ItemType.Consumable && def.useEffect) {
      this.useItem(slotIdx);
    }
  }

  private equipItem(slotIdx: number, itemType: ItemType): void {
    const equipSlot = this.resolveEquipSlot(itemType);

    NetworkManager.instance.send({
      type: ClientMessageType.EquipItem,
      slot: slotIdx,
      equipSlot,
    });
  }

  private resolveEquipSlot(itemType: ItemType): EquipmentSlot {
    const baseSlot = EQUIPMENT_SLOT_FOR_ITEM_TYPE[itemType];
    if (!baseSlot) return EquipmentSlot.Weapon;

    // For rings: if Ring1 is occupied, use Ring2
    if (baseSlot === EquipmentSlot.Ring1 && this.currentEquipment[EquipmentSlot.Ring1]) {
      if (!this.currentEquipment[EquipmentSlot.Ring2]) {
        return EquipmentSlot.Ring2;
      }
    }

    return baseSlot;
  }

  private useItem(slotIdx: number): void {
    NetworkManager.instance.send({
      type: ClientMessageType.UseItem,
      slot: slotIdx,
    });
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
