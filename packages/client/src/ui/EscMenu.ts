import Phaser from 'phaser';
import { ClientMessageType } from '@2wowd/shared';
import { NetworkManager } from '../network/NetworkManager';

const MENU_WIDTH = 280;
const MENU_HEIGHT = 300;
const BUTTON_WIDTH = 200;
const BUTTON_HEIGHT = 40;
const BUTTON_GAP = 12;

interface MenuButton {
  bg: Phaser.GameObjects.Graphics;
  text: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  baseColor: number;
  hoverColor: number;
}

export class EscMenu {
  private scene: Phaser.Scene;
  private gameScene: Phaser.Scene;
  private container: Phaser.GameObjects.Container | null = null;
  private _isOpen = false;

  get isOpen(): boolean {
    return this._isOpen;
  }

  constructor(scene: Phaser.Scene, gameScene: Phaser.Scene) {
    this.scene = scene;
    this.gameScene = gameScene;
  }

  toggle(): void {
    if (this._isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    if (this._isOpen) return;
    this._isOpen = true;
    this.gameScene.events.emit('menuStateChanged', true);
    this.build();
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.gameScene.events.emit('menuStateChanged', false);
    this.destroy();
  }

  private build(): void {
    this.container = this.scene.add.container(0, 0).setDepth(500);

    // Semi-transparent overlay
    const overlay = this.scene.make.graphics({});
    overlay.fillStyle(0x000000, 0.5);
    overlay.fillRect(0, 0, 1280, 720);
    this.container.add(overlay);

    // Click overlay to resume
    const overlayZone = this.scene.add
      .zone(0, 0, 1280, 720)
      .setOrigin(0)
      .setInteractive();
    this.container.add(overlayZone);
    overlayZone.on('pointerdown', () => this.close());

    // Menu panel
    const px = (1280 - MENU_WIDTH) / 2;
    const py = (720 - MENU_HEIGHT) / 2;

    const panel = this.scene.make.graphics({});
    panel.fillStyle(0x14142a, 0.95);
    panel.fillRoundedRect(px, py, MENU_WIDTH, MENU_HEIGHT, 10);
    panel.lineStyle(2, 0x555577, 1);
    panel.strokeRoundedRect(px, py, MENU_WIDTH, MENU_HEIGHT, 10);
    this.container.add(panel);

    // Block clicks through panel
    const panelZone = this.scene.add
      .zone(px, py, MENU_WIDTH, MENU_HEIGHT)
      .setOrigin(0)
      .setInteractive();
    this.container.add(panelZone);

    // Title
    const title = this.scene.add
      .text(640, py + 30, 'Game Menu', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffcc44',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.container.add(title);

    // Decorative separator line
    const separator = this.scene.make.graphics({});
    separator.lineStyle(1, 0x444466, 0.8);
    separator.lineBetween(px + 30, py + 56, px + MENU_WIDTH - 30, py + 56);
    this.container.add(separator);

    // Buttons
    const buttonStartY = py + 76;
    const centerX = 640;

    this.createButton(
      centerX, buttonStartY,
      'Resume', 0x333355, 0x444477,
      () => this.close(),
    );

    this.createButton(
      centerX, buttonStartY + BUTTON_HEIGHT + BUTTON_GAP,
      'Settings', 0x2a2a44, 0x3a3a55,
      () => { /* Placeholder — not yet implemented */ },
      true,
    );

    this.createButton(
      centerX, buttonStartY + (BUTTON_HEIGHT + BUTTON_GAP) * 2,
      'Logout', 0x661122, 0x882244,
      () => this.handleLogout(),
    );

    // Hint text
    const hint = this.scene.add
      .text(640, py + MENU_HEIGHT - 24, 'Press ESC to resume', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#555577',
      })
      .setOrigin(0.5);
    this.container.add(hint);
  }

  private createButton(
    cx: number, cy: number,
    label: string,
    baseColor: number, hoverColor: number,
    onClick: () => void,
    dimmed = false,
  ): MenuButton {
    const x = cx - BUTTON_WIDTH / 2;

    const bg = this.scene.make.graphics({});
    bg.fillStyle(baseColor, 1);
    bg.fillRoundedRect(x, cy, BUTTON_WIDTH, BUTTON_HEIGHT, 6);
    bg.lineStyle(1, 0x555577, 0.6);
    bg.strokeRoundedRect(x, cy, BUTTON_WIDTH, BUTTON_HEIGHT, 6);
    this.container!.add(bg);

    const text = this.scene.add
      .text(cx, cy + BUTTON_HEIGHT / 2, label, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: dimmed ? '#666688' : '#ddddee',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.container!.add(text);

    const zone = this.scene.add
      .zone(x, cy, BUTTON_WIDTH, BUTTON_HEIGHT)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.container!.add(zone);

    zone.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(hoverColor, 1);
      bg.fillRoundedRect(x, cy, BUTTON_WIDTH, BUTTON_HEIGHT, 6);
      bg.lineStyle(1, 0x7777aa, 0.8);
      bg.strokeRoundedRect(x, cy, BUTTON_WIDTH, BUTTON_HEIGHT, 6);
      text.setColor(dimmed ? '#8888aa' : '#ffffff');
    });

    zone.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(baseColor, 1);
      bg.fillRoundedRect(x, cy, BUTTON_WIDTH, BUTTON_HEIGHT, 6);
      bg.lineStyle(1, 0x555577, 0.6);
      bg.strokeRoundedRect(x, cy, BUTTON_WIDTH, BUTTON_HEIGHT, 6);
      text.setColor(dimmed ? '#666688' : '#ddddee');
    });

    zone.on('pointerdown', onClick);

    return { bg, text, zone, baseColor, hoverColor };
  }

  private handleLogout(): void {
    const net = NetworkManager.instance;

    // Tell server we're logging out
    net.send({ type: ClientMessageType.Logout });

    // Disconnect cleanly (prevents auto-reconnect)
    net.disconnect();

    // Stop game scenes
    this.scene.scene.stop('HUDScene');
    this.scene.scene.stop('GameScene');

    // Navigate to login
    this.scene.scene.start('LoginScene');
  }

  private destroy(): void {
    if (this.container) {
      this.container.destroy(true);
      this.container = null;
    }
  }
}
