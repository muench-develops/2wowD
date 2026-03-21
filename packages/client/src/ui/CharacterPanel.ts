import Phaser from 'phaser';
import {
  type ClassStats,
  type ClassType,
  type ItemStats,
  type PlayerEquipment,
  EquipmentSlot,
  CLASS_STATS,
  ITEM_DATABASE,
  ClientMessageType,
} from '@isoheim/shared';
import { NetworkManager } from '../network/NetworkManager';
import { formatItemStats } from './formatItemStats';

export interface CharacterStatsData {
  name: string;
  classType: ClassType;
  level: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  xp: number;
  xpToNextLevel: number;
}

// ── Layout Constants ──────────────────────────────────────────
const PANEL_WIDTH = 280;
const PADDING = 12;
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 20;
const XP_BAR_HEIGHT = 14;
const PANEL_DEPTH = 1000;
const PANEL_ALPHA = 0.9;

// ── Equipment Slot Layout ─────────────────────────────────────
const EQUIP_SLOT_SIZE = 40;
const EQUIP_SLOT_GAP = 4;
const EQUIP_AREA_WIDTH = PANEL_WIDTH - PADDING * 2;
const EQUIP_CENTER_X = EQUIP_AREA_WIDTH / 2;

// ── Colors ────────────────────────────────────────────────────
const LABEL_COLOR = '#aaaacc';
const VALUE_COLOR = '#ffffff';
const HEADER_COLOR = '#e0c070';
const STAT_HEADER_COLOR = '#ccaa44';
const BONUS_COLOR = '#44cc44';
const PANEL_BG_COLOR = 0x1a1a2e;
const PANEL_BORDER_COLOR = 0x4a4a6a;
const XP_BAR_BG_COLOR = 0x2a2a3e;
const XP_BAR_FILL_COLOR = 0xccaa22;
const EMPTY_SLOT_BG_COLOR = 0x2a2a3e;
const EMPTY_SLOT_BORDER_COLOR = 0x3a3a5e;

// ── Fonts ─────────────────────────────────────────────────────
const FONT_FAMILY = 'monospace';
const FONT_SIZE_HEADER = '14px';
const FONT_SIZE_NORMAL = '12px';
const FONT_SIZE_SMALL = '10px';

const RARITY_COLORS: Record<string, number> = {
  common: 0x9d9d9d,
  uncommon: 0x1eff00,
  rare: 0x0070dd,
  epic: 0xa335ee,
};

const STAT_LABELS: Array<{ key: keyof ClassStats; label: string }> = [
  { key: 'maxHealth', label: 'Max Health' },
  { key: 'maxMana', label: 'Max Mana' },
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'speed', label: 'Speed' },
  { key: 'attackRange', label: 'Range' },
  { key: 'attackSpeed', label: 'Atk Speed' },
];

// Maps ItemStats keys to ClassStats keys for bonus display
const ITEM_STAT_TO_CLASS_STAT: Record<keyof ItemStats, keyof ClassStats | null> = {
  attack: 'attack',
  defense: 'defense',
  health: 'maxHealth',
  mana: 'maxMana',
  speed: 'speed',
  critChance: null,
};

interface EquipSlotUI {
  slot: EquipmentSlot;
  label: string;
  graphics: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Text;
  slotLabel: Phaser.GameObjects.Text;
  hitZone: Phaser.GameObjects.Zone;
  x: number;
  y: number;
}

// Paper-doll slot positions relative to EQUIP_CENTER_X
// Layout: Head top center, Weapon left, Chest center, Ring1 right,
// Legs center, Ring2 right, Boots bottom center
const EQUIP_SLOT_LAYOUT: Array<{ slot: EquipmentSlot; label: string; col: number; row: number }> = [
  { slot: EquipmentSlot.Head,   label: 'Head',  col: 0,  row: 0 },
  { slot: EquipmentSlot.Weapon, label: 'Wep',   col: -1, row: 1 },
  { slot: EquipmentSlot.Chest,  label: 'Chest', col: 0,  row: 1 },
  { slot: EquipmentSlot.Ring1,  label: 'Ring',  col: 1,  row: 1 },
  { slot: EquipmentSlot.Legs,   label: 'Legs',  col: 0,  row: 2 },
  { slot: EquipmentSlot.Ring2,  label: 'Ring',  col: 1,  row: 2 },
  { slot: EquipmentSlot.Boots,  label: 'Boots', col: 0,  row: 3 },
];

export class CharacterPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;

  private nameText!: Phaser.GameObjects.Text;
  private classLevelText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;
  private xpBarFill!: Phaser.GameObjects.Graphics;
  private healthText!: Phaser.GameObjects.Text;
  private manaText!: Phaser.GameObjects.Text;
  private statTexts: Phaser.GameObjects.Text[] = [];
  private equipSlotUIs: EquipSlotUI[] = [];
  private equipTooltip: Phaser.GameObjects.Container | null = null;

  private currentStats: CharacterStatsData | null = null;
  private currentEquipment: PlayerEquipment = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const equipRows = 4;
    const equipAreaHeight = equipRows * (EQUIP_SLOT_SIZE + EQUIP_SLOT_GAP) + EQUIP_SLOT_GAP;
    const totalStatRows = 2 + 1 + STAT_LABELS.length;
    const panelH = HEADER_HEIGHT + PADDING
      + ROW_HEIGHT      // name
      + ROW_HEIGHT       // class+level
      + ROW_HEIGHT + XP_BAR_HEIGHT + 4 // XP
      + 8                // separator
      + equipAreaHeight + 8 // equipment area
      + 8                // separator
      + ROW_HEIGHT * totalStatRows // health/mana + stats
      + PADDING;

    const panelX = 16;
    const panelY = Math.max(4, (720 - panelH) / 2);

    this.container = this.scene.add.container(panelX, panelY);
    this.container.setDepth(PANEL_DEPTH);
    this.container.setVisible(false);

    const background = this.scene.add.graphics();
    background.fillStyle(PANEL_BG_COLOR, PANEL_ALPHA);
    background.fillRoundedRect(0, 0, PANEL_WIDTH, panelH, 8);
    background.lineStyle(2, PANEL_BORDER_COLOR);
    background.strokeRoundedRect(0, 0, PANEL_WIDTH, panelH, 8);
    this.container.add(background);

    const title = this.scene.add.text(PANEL_WIDTH / 2, 16, 'Character', {
      fontSize: FONT_SIZE_HEADER, fontFamily: FONT_FAMILY, color: HEADER_COLOR,
    }).setOrigin(0.5);
    this.container.add(title);

    let yOffset = HEADER_HEIGHT + PADDING;
    yOffset = this.createCharacterInfo(yOffset);
    yOffset = this.createXpSection(yOffset);
    yOffset = this.addSeparator(yOffset);
    yOffset = this.createEquipmentSlots(yOffset);
    yOffset = this.addSeparator(yOffset);
    this.createStatsSection(yOffset);
  }

  private createCharacterInfo(yOffset: number): number {
    this.nameText = this.scene.add.text(PADDING, yOffset, '', {
      fontSize: FONT_SIZE_NORMAL, fontFamily: FONT_FAMILY, color: VALUE_COLOR,
    });
    this.container.add(this.nameText);
    yOffset += ROW_HEIGHT;

    this.classLevelText = this.scene.add.text(PADDING, yOffset, '', {
      fontSize: FONT_SIZE_NORMAL, fontFamily: FONT_FAMILY, color: LABEL_COLOR,
    });
    this.container.add(this.classLevelText);
    return yOffset + ROW_HEIGHT + 4;
  }

  private createXpSection(yOffset: number): number {
    this.xpText = this.scene.add.text(PADDING, yOffset, 'XP: 0 / 0', {
      fontSize: FONT_SIZE_SMALL, fontFamily: FONT_FAMILY, color: LABEL_COLOR,
    });
    this.container.add(this.xpText);
    yOffset += ROW_HEIGHT - 4;

    const xpBarBg = this.scene.add.graphics();
    xpBarBg.fillStyle(XP_BAR_BG_COLOR, 0.8);
    xpBarBg.fillRoundedRect(PADDING, yOffset, PANEL_WIDTH - PADDING * 2, XP_BAR_HEIGHT, 3);
    this.container.add(xpBarBg);

    this.xpBarFill = this.scene.add.graphics();
    this.container.add(this.xpBarFill);
    return yOffset + XP_BAR_HEIGHT + 8;
  }

  private addSeparator(yOffset: number): number {
    const separator = this.scene.add.graphics();
    separator.lineStyle(1, PANEL_BORDER_COLOR, 0.6);
    separator.lineBetween(PADDING, yOffset, PANEL_WIDTH - PADDING, yOffset);
    this.container.add(separator);
    return yOffset + 8;
  }

  private createEquipmentSlots(yOffset: number): number {
    const equipHeader = this.scene.add.text(PADDING, yOffset, '— Equipment —', {
      fontSize: FONT_SIZE_SMALL, fontFamily: FONT_FAMILY, color: STAT_HEADER_COLOR,
    });
    this.container.add(equipHeader);
    yOffset += ROW_HEIGHT;

    const baseX = PADDING + EQUIP_CENTER_X;
    const colSpacing = EQUIP_SLOT_SIZE + EQUIP_SLOT_GAP;

    for (const layout of EQUIP_SLOT_LAYOUT) {
      const slotX = baseX + layout.col * colSpacing - EQUIP_SLOT_SIZE / 2;
      const slotY = yOffset + layout.row * (EQUIP_SLOT_SIZE + EQUIP_SLOT_GAP);
      const slotUI = this.createSingleEquipSlot(layout.slot, layout.label, slotX, slotY);
      this.equipSlotUIs.push(slotUI);
    }

    const equipRows = 4;
    return yOffset + equipRows * (EQUIP_SLOT_SIZE + EQUIP_SLOT_GAP) + EQUIP_SLOT_GAP;
  }

  private createSingleEquipSlot(slot: EquipmentSlot, label: string, x: number, y: number): EquipSlotUI {
    const graphics = this.scene.add.graphics();
    this.drawEmptySlot(graphics, x, y);
    this.container.add(graphics);

    const icon = this.scene.add.text(x + EQUIP_SLOT_SIZE / 2, y + EQUIP_SLOT_SIZE / 2 - 2, '', {
      fontSize: '20px',
    }).setOrigin(0.5);
    this.container.add(icon);

    const slotLabel = this.scene.add.text(x + EQUIP_SLOT_SIZE / 2, y + EQUIP_SLOT_SIZE + 1, label, {
      fontSize: '8px', fontFamily: FONT_FAMILY, color: '#666688',
    }).setOrigin(0.5, 0);
    this.container.add(slotLabel);

    const hitZone = this.scene.add.zone(x + EQUIP_SLOT_SIZE / 2, y + EQUIP_SLOT_SIZE / 2, EQUIP_SLOT_SIZE, EQUIP_SLOT_SIZE)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onEquipSlotClick(slot))
      .on('pointerover', () => this.showEquipTooltip(slot, x, y))
      .on('pointerout', () => this.hideEquipTooltip());
    this.container.add(hitZone);

    return { slot, label, graphics, icon, slotLabel, hitZone, x, y };
  }

  private drawEmptySlot(graphics: Phaser.GameObjects.Graphics, x: number, y: number): void {
    graphics.clear();
    graphics.fillStyle(EMPTY_SLOT_BG_COLOR, 0.8);
    graphics.fillRoundedRect(x, y, EQUIP_SLOT_SIZE, EQUIP_SLOT_SIZE, 4);
    graphics.lineStyle(1, EMPTY_SLOT_BORDER_COLOR);
    graphics.strokeRoundedRect(x, y, EQUIP_SLOT_SIZE, EQUIP_SLOT_SIZE, 4);
  }

  private drawEquippedSlot(graphics: Phaser.GameObjects.Graphics, x: number, y: number, rarityColor: number): void {
    graphics.clear();
    graphics.fillStyle(EMPTY_SLOT_BG_COLOR, 0.8);
    graphics.fillRoundedRect(x, y, EQUIP_SLOT_SIZE, EQUIP_SLOT_SIZE, 4);
    graphics.lineStyle(2, rarityColor);
    graphics.strokeRoundedRect(x, y, EQUIP_SLOT_SIZE, EQUIP_SLOT_SIZE, 4);
  }

  private createStatsSection(yOffset: number): void {
    this.healthText = this.scene.add.text(PADDING, yOffset, '', {
      fontSize: FONT_SIZE_NORMAL, fontFamily: FONT_FAMILY, color: '#cc4444',
    });
    this.container.add(this.healthText);
    yOffset += ROW_HEIGHT;

    this.manaText = this.scene.add.text(PADDING, yOffset, '', {
      fontSize: FONT_SIZE_NORMAL, fontFamily: FONT_FAMILY, color: '#4488cc',
    });
    this.container.add(this.manaText);
    yOffset += ROW_HEIGHT + 4;

    const statsHeader = this.scene.add.text(PADDING, yOffset, '— Stats —', {
      fontSize: FONT_SIZE_SMALL, fontFamily: FONT_FAMILY, color: STAT_HEADER_COLOR,
    });
    this.container.add(statsHeader);
    yOffset += ROW_HEIGHT;

    for (const statDef of STAT_LABELS) {
      const row = this.scene.add.text(PADDING, yOffset, `${statDef.label}: —`, {
        fontSize: FONT_SIZE_NORMAL, fontFamily: FONT_FAMILY, color: LABEL_COLOR,
      });
      this.container.add(row);
      this.statTexts.push(row);
      yOffset += ROW_HEIGHT;
    }
  }

  // ── Public API ──────────────────────────────────────────────

  updateStats(data: CharacterStatsData): void {
    this.currentStats = data;
    if (!this.visible) return;
    this.refreshDisplay();
  }

  updateEquipment(equipment: PlayerEquipment): void {
    this.currentEquipment = equipment;
    if (!this.visible) return;
    this.refreshEquipmentSlots();
    this.refreshDisplay();
  }

  getEquipment(): PlayerEquipment {
    return this.currentEquipment;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
    if (this.visible) {
      this.refreshEquipmentSlots();
      this.refreshDisplay();
    } else {
      this.hideEquipTooltip();
    }
  }

  isOpen(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.hideEquipTooltip();
    this.container.destroy();
  }

  // ── Refresh Logic ───────────────────────────────────────────

  private refreshDisplay(): void {
    if (!this.currentStats) return;
    const data = this.currentStats;
    const classStats = CLASS_STATS[data.classType];
    const equipBonuses = this.calculateEquipmentBonuses();

    const className = data.classType.charAt(0).toUpperCase() + data.classType.slice(1);
    this.nameText.setText(data.name);
    this.classLevelText.setText(`${className}  —  Level ${data.level}`);

    this.refreshXpBar(data);
    this.healthText.setText(`Health: ${data.health} / ${data.maxHealth}`);
    this.manaText.setText(`Mana: ${data.mana} / ${data.maxMana}`);

    for (let i = 0; i < STAT_LABELS.length; i++) {
      const { key, label } = STAT_LABELS[i];
      const baseValue = classStats[key];
      const bonus = equipBonuses[key] || 0;
      const formatted = Number.isInteger(baseValue) ? `${baseValue}` : baseValue.toFixed(1);
      const bonusText = bonus > 0 ? ` (+${bonus})` : '';
      this.statTexts[i].setText(`${label}: ${formatted}${bonusText}`);
      this.statTexts[i].setColor(bonus > 0 ? BONUS_COLOR : LABEL_COLOR);
    }
  }

  private refreshXpBar(data: CharacterStatsData): void {
    this.xpText.setText(`XP: ${data.xp} / ${data.xpToNextLevel}`);
    const xpBarWidth = PANEL_WIDTH - PADDING * 2;
    const xpFraction = data.xpToNextLevel > 0 ? data.xp / data.xpToNextLevel : 0;
    const fillWidth = Math.max(0, Math.min(xpBarWidth, xpFraction * xpBarWidth));
    this.xpBarFill.clear();
    if (fillWidth > 0) {
      this.xpBarFill.fillStyle(XP_BAR_FILL_COLOR, 1);
      const xpBarY = this.xpText.y + 16;
      this.xpBarFill.fillRoundedRect(PADDING, xpBarY, fillWidth, XP_BAR_HEIGHT, 3);
    }
  }

  private refreshEquipmentSlots(): void {
    for (const slotUI of this.equipSlotUIs) {
      const equippedItemId = this.currentEquipment[slotUI.slot];
      if (equippedItemId) {
        const itemDef = ITEM_DATABASE[equippedItemId];
        if (itemDef) {
          const rarityColor = RARITY_COLORS[itemDef.rarity] || EMPTY_SLOT_BORDER_COLOR;
          this.drawEquippedSlot(slotUI.graphics, slotUI.x, slotUI.y, rarityColor);
          slotUI.icon.setText(itemDef.icon);
          continue;
        }
      }
      this.drawEmptySlot(slotUI.graphics, slotUI.x, slotUI.y);
      slotUI.icon.setText('');
    }
  }

  // ── Equipment Interactions ──────────────────────────────────

  private onEquipSlotClick(equipSlot: EquipmentSlot): void {
    const equippedItemId = this.currentEquipment[equipSlot];
    if (!equippedItemId) return;

    NetworkManager.instance.send({
      type: ClientMessageType.UnequipItem,
      equipSlot,
    });
  }

  private showEquipTooltip(equipSlot: EquipmentSlot, slotX: number, slotY: number): void {
    const itemId = this.currentEquipment[equipSlot];
    if (!itemId) return;
    const def = ITEM_DATABASE[itemId];
    if (!def) return;

    this.hideEquipTooltip();

    let text = `${def.icon} ${def.name}\n`;
    text += `${def.type} | ${def.rarity}\n`;
    if (def.description) text += `${def.description}\n`;
    text += formatItemStats(def.stats);
    text += '\nClick to unequip';

    this.equipTooltip = this.scene.add.container(slotX + EQUIP_SLOT_SIZE + 4, slotY);
    const tipBg = this.scene.add.graphics();
    const tipText = this.scene.add.text(8, 8, text.trim(), {
      fontSize: '11px', fontFamily: FONT_FAMILY, color: '#ffffff',
      wordWrap: { width: 180 },
    });
    const bounds = tipText.getBounds();
    tipBg.fillStyle(0x0a0a1e, 0.95);
    tipBg.fillRoundedRect(0, 0, bounds.width + 16, bounds.height + 16, 6);
    tipBg.lineStyle(1, PANEL_BORDER_COLOR);
    tipBg.strokeRoundedRect(0, 0, bounds.width + 16, bounds.height + 16, 6);
    this.equipTooltip.add([tipBg, tipText]);
    this.equipTooltip.setDepth(1100);
    this.container.add(this.equipTooltip);
  }

  private hideEquipTooltip(): void {
    if (this.equipTooltip) {
      this.equipTooltip.destroy();
      this.equipTooltip = null;
    }
  }

  // ── Equipment Bonus Calculation ─────────────────────────────

  private calculateEquipmentBonuses(): Partial<Record<keyof ClassStats, number>> {
    const bonuses: Partial<Record<keyof ClassStats, number>> = {};

    for (const slotKey of Object.values(EquipmentSlot)) {
      const itemId = this.currentEquipment[slotKey];
      if (!itemId) continue;
      const def = ITEM_DATABASE[itemId];
      if (!def) continue;

      for (const [statKey, value] of Object.entries(def.stats) as Array<[keyof ItemStats, number | undefined]>) {
        if (!value) continue;
        const classStatKey = ITEM_STAT_TO_CLASS_STAT[statKey];
        if (!classStatKey) continue;
        bonuses[classStatKey] = (bonuses[classStatKey] || 0) + value;
      }
    }

    return bonuses;
  }
}
