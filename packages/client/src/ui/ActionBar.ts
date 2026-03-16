import Phaser from 'phaser';
import { AbilityDef, CooldownState, ClientMessageType } from '@2wowd/shared';
import { NetworkManager } from '../network/NetworkManager';

const SLOT_SIZE = 52;
const SLOT_GAP = 6;
const SLOTS = 4;

export class ActionBar {
  private scene: Phaser.Scene;
  private abilities: AbilityDef[] = [];
  private cooldowns = new Map<string, CooldownState>();
  private slots: Phaser.GameObjects.Graphics[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private keyLabels: Phaser.GameObjects.Text[] = [];
  private cdOverlays: Phaser.GameObjects.Graphics[] = [];
  private targetId: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const totalW = SLOTS * SLOT_SIZE + (SLOTS - 1) * SLOT_GAP;
    const startX = (1280 - totalW) / 2;
    const y = 720 - SLOT_SIZE - 16;

    for (let i = 0; i < SLOTS; i++) {
      const x = startX + i * (SLOT_SIZE + SLOT_GAP);

      const slot = this.scene.add.graphics();
      slot.fillStyle(0x333344, 0.85);
      slot.fillRoundedRect(x, y, SLOT_SIZE, SLOT_SIZE, 4);
      slot.lineStyle(2, 0x6666aa, 1);
      slot.strokeRoundedRect(x, y, SLOT_SIZE, SLOT_SIZE, 4);
      slot.setInteractive(new Phaser.Geom.Rectangle(x, y, SLOT_SIZE, SLOT_SIZE), Phaser.Geom.Rectangle.Contains);
      slot.setDepth(100);
      this.slots.push(slot);

      const idx = i;
      slot.on('pointerdown', () => this.useAbility(idx));

      const label = this.scene.add.text(x + SLOT_SIZE / 2, y + SLOT_SIZE / 2, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 2,
      });
      label.setOrigin(0.5, 0.5).setDepth(102);
      this.labels.push(label);

      const keyLabel = this.scene.add.text(x + 4, y + 2, `${i + 1}`, {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#aaaacc',
      });
      keyLabel.setDepth(102);
      this.keyLabels.push(keyLabel);

      const overlay = this.scene.add.graphics();
      overlay.setDepth(101);
      this.cdOverlays.push(overlay);
    }
  }

  setAbilities(abilities: AbilityDef[]): void {
    this.abilities = abilities;
    for (let i = 0; i < SLOTS; i++) {
      if (i < abilities.length) {
        const ab = abilities[i];
        this.labels[i].setText(ab.name.substring(0, 6));
      } else {
        this.labels[i].setText('');
      }
    }
  }

  setTargetId(id: string | null): void {
    this.targetId = id;
  }

  updateCooldowns(cooldowns: CooldownState[]): void {
    this.cooldowns.clear();
    for (const cd of cooldowns) {
      this.cooldowns.set(cd.abilityId, cd);
    }
    this.drawCooldowns();
  }

  private drawCooldowns(): void {
    const totalW = SLOTS * SLOT_SIZE + (SLOTS - 1) * SLOT_GAP;
    const startX = (1280 - totalW) / 2;
    const y = 720 - SLOT_SIZE - 16;

    for (let i = 0; i < SLOTS; i++) {
      const overlay = this.cdOverlays[i];
      overlay.clear();
      if (i >= this.abilities.length) continue;

      const cd = this.cooldowns.get(this.abilities[i].id);
      if (!cd || cd.remainingMs <= 0) continue;

      const ratio = cd.remainingMs / cd.totalMs;
      const x = startX + i * (SLOT_SIZE + SLOT_GAP);

      overlay.fillStyle(0x000000, 0.6);
      overlay.fillRect(x, y, SLOT_SIZE, SLOT_SIZE * ratio);
    }
  }

  useAbility(index: number): void {
    if (index >= this.abilities.length) return;
    const ab = this.abilities[index];
    const cd = this.cooldowns.get(ab.id);
    if (cd && cd.remainingMs > 0) return;

    NetworkManager.instance.send({
      type: ClientMessageType.UseAbility,
      abilityId: ab.id,
      targetId: this.targetId,
      targetPosition: null,
    });
  }

  destroy(): void {
    this.slots.forEach((s) => s.destroy());
    this.labels.forEach((l) => l.destroy());
    this.keyLabels.forEach((l) => l.destroy());
    this.cdOverlays.forEach((o) => o.destroy());
  }
}
