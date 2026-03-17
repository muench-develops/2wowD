import Phaser from 'phaser';
import { type ClassStats, type ClassType, CLASS_STATS } from '@isoheim/shared';

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

const PANEL_WIDTH = 240;
const PADDING = 12;
const HEADER_HEIGHT = 32;
const ROW_HEIGHT = 20;
const XP_BAR_HEIGHT = 14;
const LABEL_COLOR = '#aaaacc';
const VALUE_COLOR = '#ffffff';
const HEADER_COLOR = '#e0c070';
const STAT_HEADER_COLOR = '#ccaa44';
const PANEL_ALPHA = 0.9;
const PANEL_BG_COLOR = 0x1a1a2e;
const PANEL_BORDER_COLOR = 0x4a4a6a;
const XP_BAR_BG_COLOR = 0x2a2a3e;
const XP_BAR_FILL_COLOR = 0xccaa22;
const FONT_FAMILY = 'monospace';
const FONT_SIZE_HEADER = '14px';
const FONT_SIZE_NORMAL = '12px';
const FONT_SIZE_SMALL = '10px';
const PANEL_DEPTH = 1000;

const STAT_LABELS: Array<{ key: keyof ClassStats; label: string }> = [
  { key: 'maxHealth', label: 'Max Health' },
  { key: 'maxMana', label: 'Max Mana' },
  { key: 'attack', label: 'Attack' },
  { key: 'defense', label: 'Defense' },
  { key: 'speed', label: 'Speed' },
  { key: 'attackRange', label: 'Range' },
  { key: 'attackSpeed', label: 'Atk Speed' },
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

  private currentStats: CharacterStatsData | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const totalRows = 2 + 1 + STAT_LABELS.length; // health/mana + separator + class stats
    const panelH = HEADER_HEIGHT + PADDING
      + ROW_HEIGHT // name
      + ROW_HEIGHT // class + level
      + ROW_HEIGHT + XP_BAR_HEIGHT + 4 // XP section
      + ROW_HEIGHT * totalRows
      + PADDING;

    const panelX = 16;
    const panelY = (720 - panelH) / 2;

    this.container = this.scene.add.container(panelX, panelY);
    this.container.setDepth(PANEL_DEPTH);
    this.container.setVisible(false);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(PANEL_BG_COLOR, PANEL_ALPHA);
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, panelH, 8);
    bg.lineStyle(2, PANEL_BORDER_COLOR);
    bg.strokeRoundedRect(0, 0, PANEL_WIDTH, panelH, 8);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(PANEL_WIDTH / 2, 16, 'Character', {
      fontSize: FONT_SIZE_HEADER,
      fontFamily: FONT_FAMILY,
      color: HEADER_COLOR,
    }).setOrigin(0.5);
    this.container.add(title);

    let yOffset = HEADER_HEIGHT + PADDING;

    // Character name
    this.nameText = this.scene.add.text(PADDING, yOffset, '', {
      fontSize: FONT_SIZE_NORMAL,
      fontFamily: FONT_FAMILY,
      color: VALUE_COLOR,
    });
    this.container.add(this.nameText);
    yOffset += ROW_HEIGHT;

    // Class + Level
    this.classLevelText = this.scene.add.text(PADDING, yOffset, '', {
      fontSize: FONT_SIZE_NORMAL,
      fontFamily: FONT_FAMILY,
      color: LABEL_COLOR,
    });
    this.container.add(this.classLevelText);
    yOffset += ROW_HEIGHT + 4;

    // XP label + value
    this.xpText = this.scene.add.text(PADDING, yOffset, 'XP: 0 / 0', {
      fontSize: FONT_SIZE_SMALL,
      fontFamily: FONT_FAMILY,
      color: LABEL_COLOR,
    });
    this.container.add(this.xpText);
    yOffset += ROW_HEIGHT - 4;

    // XP bar background
    const xpBarBg = this.scene.add.graphics();
    xpBarBg.fillStyle(XP_BAR_BG_COLOR, 0.8);
    xpBarBg.fillRoundedRect(PADDING, yOffset, PANEL_WIDTH - PADDING * 2, XP_BAR_HEIGHT, 3);
    this.container.add(xpBarBg);

    // XP bar fill
    this.xpBarFill = this.scene.add.graphics();
    this.container.add(this.xpBarFill);
    yOffset += XP_BAR_HEIGHT + 8;

    // Separator line
    const separator = this.scene.add.graphics();
    separator.lineStyle(1, PANEL_BORDER_COLOR, 0.6);
    separator.lineBetween(PADDING, yOffset, PANEL_WIDTH - PADDING, yOffset);
    this.container.add(separator);
    yOffset += 8;

    // Current health/mana
    this.healthText = this.scene.add.text(PADDING, yOffset, '', {
      fontSize: FONT_SIZE_NORMAL,
      fontFamily: FONT_FAMILY,
      color: '#cc4444',
    });
    this.container.add(this.healthText);
    yOffset += ROW_HEIGHT;

    this.manaText = this.scene.add.text(PADDING, yOffset, '', {
      fontSize: FONT_SIZE_NORMAL,
      fontFamily: FONT_FAMILY,
      color: '#4488cc',
    });
    this.container.add(this.manaText);
    yOffset += ROW_HEIGHT + 4;

    // Stats header
    const statsHeader = this.scene.add.text(PADDING, yOffset, '— Base Stats —', {
      fontSize: FONT_SIZE_SMALL,
      fontFamily: FONT_FAMILY,
      color: STAT_HEADER_COLOR,
    });
    this.container.add(statsHeader);
    yOffset += ROW_HEIGHT;

    // Stat rows
    for (const statDef of STAT_LABELS) {
      const row = this.scene.add.text(PADDING, yOffset, `${statDef.label}: —`, {
        fontSize: FONT_SIZE_NORMAL,
        fontFamily: FONT_FAMILY,
        color: LABEL_COLOR,
      });
      this.container.add(row);
      this.statTexts.push(row);
      yOffset += ROW_HEIGHT;
    }
  }

  updateStats(data: CharacterStatsData): void {
    this.currentStats = data;
    if (!this.visible) return;
    this.refreshDisplay();
  }

  private refreshDisplay(): void {
    if (!this.currentStats) return;
    const data = this.currentStats;
    const classStats = CLASS_STATS[data.classType];

    const className = data.classType.charAt(0).toUpperCase() + data.classType.slice(1);
    this.nameText.setText(data.name);
    this.classLevelText.setText(`${className}  —  Level ${data.level}`);

    // XP
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

    // Health/Mana
    this.healthText.setText(`Health: ${data.health} / ${data.maxHealth}`);
    this.manaText.setText(`Mana: ${data.mana} / ${data.maxMana}`);

    // Class stats
    for (let i = 0; i < STAT_LABELS.length; i++) {
      const { key, label } = STAT_LABELS[i];
      const value = classStats[key];
      const formatted = Number.isInteger(value) ? `${value}` : value.toFixed(1);
      this.statTexts[i].setText(`${label}: ${formatted}`);
    }
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
    if (this.visible) {
      this.refreshDisplay();
    }
  }

  isOpen(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}
