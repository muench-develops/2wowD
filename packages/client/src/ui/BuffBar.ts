import Phaser from 'phaser';
import { type BuffState } from '@isoheim/shared';

const ICON_SIZE = 20;
const ICON_GAP = 3;
const BUFF_X = 32;
const BUFF_Y = 56;

interface BuffIcon {
  bg: Phaser.GameObjects.Rectangle;
  letter: Phaser.GameObjects.Text;
  timer: Phaser.GameObjects.Text;
}

export class BuffBar {
  private scene: Phaser.Scene;
  private icons: Map<string, BuffIcon> = new Map();
  private buffs: BuffState[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(buffs: BuffState[]): void {
    this.buffs = buffs;

    // Remove icons for buffs that no longer exist
    const currentIds = new Set(buffs.map((b) => b.buffId));
    for (const [id, icon] of this.icons) {
      if (!currentIds.has(id)) {
        icon.bg.destroy();
        icon.letter.destroy();
        icon.timer.destroy();
        this.icons.delete(id);
      }
    }

    // Update or create icons
    let idx = 0;
    for (const buff of buffs) {
      const x = BUFF_X + idx * (ICON_SIZE + ICON_GAP);
      const y = BUFF_Y;

      let icon = this.icons.get(buff.buffId);
      if (!icon) {
        const borderColor = buff.isDebuff ? 0xff4444 : 0x44ff44;
        const bgColor = buff.isDebuff ? 0x441111 : 0x114411;

        const bg = this.scene.add.rectangle(x, y, ICON_SIZE, ICON_SIZE, bgColor);
        bg.setOrigin(0, 0);
        bg.setStrokeStyle(2, borderColor);
        bg.setDepth(100);

        const letter = this.scene.add.text(x + ICON_SIZE / 2, y + ICON_SIZE / 2 - 2, buff.name.charAt(0).toUpperCase(), {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ffffff',
        });
        letter.setOrigin(0.5, 0.5);
        letter.setDepth(101);

        const timer = this.scene.add.text(x + ICON_SIZE / 2, y + ICON_SIZE + 1, '', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#cccccc',
        });
        timer.setOrigin(0.5, 0);
        timer.setDepth(101);

        icon = { bg, letter, timer };
        this.icons.set(buff.buffId, icon);
      }

      // Reposition
      icon.bg.setPosition(x, y);
      icon.letter.setPosition(x + ICON_SIZE / 2, y + ICON_SIZE / 2 - 2);
      icon.timer.setPosition(x + ICON_SIZE / 2, y + ICON_SIZE + 1);

      // Update timer text
      const remaining = Math.ceil(buff.remainingMs / 1000);
      icon.timer.setText(`${remaining}`);

      idx++;
    }
  }

  destroy(): void {
    for (const icon of this.icons.values()) {
      icon.bg.destroy();
      icon.letter.destroy();
      icon.timer.destroy();
    }
    this.icons.clear();
  }
}
