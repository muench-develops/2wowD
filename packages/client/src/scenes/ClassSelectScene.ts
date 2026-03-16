import Phaser from 'phaser';
import { ClassType, CLASS_STATS } from '@isoheim/shared';

const CLASSES = [ClassType.Warrior, ClassType.Mage, ClassType.Rogue, ClassType.Priest];

const CLASS_INFO: Record<ClassType, { role: string; color: string }> = {
  [ClassType.Warrior]: { role: 'Melee Tank / DPS', color: '#dd3333' },
  [ClassType.Mage]: { role: 'Ranged DPS', color: '#3366ff' },
  [ClassType.Rogue]: { role: 'Melee DPS', color: '#33cc55' },
  [ClassType.Priest]: { role: 'Healer / Ranged', color: '#eecc33' },
};

export class ClassSelectScene extends Phaser.Scene {
  private selectedClass: ClassType | null = null;

  constructor() {
    super({ key: 'ClassSelectScene' });
  }

  create(): void {
    this.add
      .text(640, 40, 'Isoheim', {
        fontFamily: 'monospace',
        fontSize: '42px',
        color: '#ffcc44',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.add
      .text(640, 90, 'Choose Your Class', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#aaaacc',
      })
      .setOrigin(0.5);

    const cardW = 240;
    const cardH = 260;
    const gap = 20;
    const totalW = CLASSES.length * cardW + (CLASSES.length - 1) * gap;
    const startX = (1280 - totalW) / 2;

    for (let i = 0; i < CLASSES.length; i++) {
      const ct = CLASSES[i];
      const stats = CLASS_STATS[ct];
      const info = CLASS_INFO[ct];
      const x = startX + i * (cardW + gap);
      const y = 140;

      // Card bg
      const card = this.add.graphics();
      card.fillStyle(0x1a1a2e, 0.9);
      card.fillRoundedRect(x, y, cardW, cardH, 8);
      card.lineStyle(2, 0x444466, 1);
      card.strokeRoundedRect(x, y, cardW, cardH, 8);

      // Sprite preview
      this.add.sprite(x + cardW / 2, y + 40, `player-${ct}`).setScale(2);

      // Class name
      this.add
        .text(x + cardW / 2, y + 70, ct.charAt(0).toUpperCase() + ct.slice(1), {
          fontFamily: 'monospace',
          fontSize: '18px',
          color: info.color,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      // Role
      this.add
        .text(x + cardW / 2, y + 92, info.role, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#8888aa',
        })
        .setOrigin(0.5);

      // Stats
      const statLines = [
        `HP:  ${stats.maxHealth}`,
        `MP:  ${stats.maxMana}`,
        `ATK: ${stats.attack}`,
        `DEF: ${stats.defense}`,
        `SPD: ${stats.speed}`,
      ];
      statLines.forEach((line, j) => {
        this.add.text(x + 30, y + 115 + j * 18, line, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ccccdd',
        });
      });

      // Clickable zone
      const zone = this.add
        .zone(x, y, cardW, cardH)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });

      zone.on('pointerdown', () => {
        this.selectedClass = ct;
        this.startGame();
      });

      zone.on('pointerover', () => {
        card.clear();
        card.fillStyle(0x222244, 0.95);
        card.fillRoundedRect(x, y, cardW, cardH, 8);
        card.lineStyle(2, 0x6666cc, 1);
        card.strokeRoundedRect(x, y, cardW, cardH, 8);
      });

      zone.on('pointerout', () => {
        card.clear();
        card.fillStyle(0x1a1a2e, 0.9);
        card.fillRoundedRect(x, y, cardW, cardH, 8);
        card.lineStyle(2, 0x444466, 1);
        card.strokeRoundedRect(x, y, cardW, cardH, 8);
      });
    }

    // Instructions
    this.add
      .text(640, 440, 'Click a class to begin', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#666688',
      })
      .setOrigin(0.5);
  }

  private startGame(): void {
    if (!this.selectedClass) return;

    const name = `Player${Math.floor(Math.random() * 9999)}`;

    this.scene.start('GameScene', {
      classType: this.selectedClass,
      playerName: name,
    });
  }
}
