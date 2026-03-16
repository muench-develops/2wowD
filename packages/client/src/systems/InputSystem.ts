import Phaser from 'phaser';
import {
  Vec2,
  normalize,
  ClientMessageType,
} from '@isoheim/shared';
import { getTileAtScreen } from './IsometricHelper';
import { NetworkManager } from '../network/NetworkManager';
import { SoundManager } from './SoundManager';

export class InputSystem {
  private scene: Phaser.Scene;
  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    ONE: Phaser.Input.Keyboard.Key;
    TWO: Phaser.Input.Keyboard.Key;
    THREE: Phaser.Input.Keyboard.Key;
    FOUR: Phaser.Input.Keyboard.Key;
    ENTER: Phaser.Input.Keyboard.Key;
    ESC: Phaser.Input.Keyboard.Key;
    M: Phaser.Input.Keyboard.Key;
  };
  private moveSeq = 0;
  private lastDir: Vec2 = { x: 0, y: 0 };
  private _chatFocused = false;
  private _menuOpen = false;

  get chatFocused(): boolean {
    return this._chatFocused;
  }

  set chatFocused(v: boolean) {
    this._chatFocused = v;
  }

  get menuOpen(): boolean {
    return this._menuOpen;
  }

  set menuOpen(v: boolean) {
    this._menuOpen = v;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createKeys();
  }

  private createKeys(): void {
    const kb = this.scene.input.keyboard!;
    this.keys = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W, false),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S, false),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
      ONE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ONE, false),
      TWO: kb.addKey(Phaser.Input.Keyboard.KeyCodes.TWO, false),
      THREE: kb.addKey(Phaser.Input.Keyboard.KeyCodes.THREE, false),
      FOUR: kb.addKey(Phaser.Input.Keyboard.KeyCodes.FOUR, false),
      ENTER: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER, false),
      ESC: kb.addKey(Phaser.Input.Keyboard.KeyCodes.ESC, false),
      M: kb.addKey(Phaser.Input.Keyboard.KeyCodes.M, false),
    };
  }

  /** Returns the current WASD direction vector (may be zero) */
  getMovementDirection(): Vec2 {
    if (this._chatFocused || this._menuOpen) return { x: 0, y: 0 };

    let dx = 0;
    let dy = 0;
    if (this.keys.W.isDown) dy -= 1;
    if (this.keys.S.isDown) dy += 1;
    if (this.keys.A.isDown) dx -= 1;
    if (this.keys.D.isDown) dx += 1;

    if (dx === 0 && dy === 0) return { x: 0, y: 0 };
    return normalize({ x: dx, y: dy });
  }

  /** Call each frame – sends move / stop_move messages */
  update(): void {
    // ESC toggles game menu regardless of other input state
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      // Stop movement before opening menu
      const wasMoving = this.lastDir.x !== 0 || this.lastDir.y !== 0;
      if (wasMoving) {
        this.moveSeq++;
        this.scene.events.emit('requestStopMove', this.moveSeq);
        this.lastDir = { x: 0, y: 0 };
      }
      this.scene.events.emit('toggleEscMenu');
      return;
    }

    if (this._chatFocused || this._menuOpen) return;

    const dir = this.getMovementDirection();
    const isMoving = dir.x !== 0 || dir.y !== 0;
    const wasMoving = this.lastDir.x !== 0 || this.lastDir.y !== 0;

    if (isMoving && (dir.x !== this.lastDir.x || dir.y !== this.lastDir.y)) {
      this.moveSeq++;
      NetworkManager.instance.send({
        type: ClientMessageType.Move,
        direction: dir,
        seq: this.moveSeq,
      });
    } else if (!isMoving && wasMoving) {
      this.moveSeq++;
      // stop move – position will be filled by caller
      this.scene.events.emit('requestStopMove', this.moveSeq);
    }

    this.lastDir = dir;

    // Ability keys
    if (Phaser.Input.Keyboard.JustDown(this.keys.ONE)) this.scene.events.emit('abilityKey', 0);
    if (Phaser.Input.Keyboard.JustDown(this.keys.TWO)) this.scene.events.emit('abilityKey', 1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.THREE)) this.scene.events.emit('abilityKey', 2);
    if (Phaser.Input.Keyboard.JustDown(this.keys.FOUR)) this.scene.events.emit('abilityKey', 3);

    // Enter to toggle chat
    if (Phaser.Input.Keyboard.JustDown(this.keys.ENTER)) {
      this.scene.events.emit('toggleChat');
    }

    // M to toggle mute
    if (Phaser.Input.Keyboard.JustDown(this.keys.M)) {
      SoundManager.instance.init();
      SoundManager.instance.toggleMute();
      this.scene.events.emit('muteToggled');
    }
  }

  /** Convert a screen click to world tile coords taking camera into account */
  screenClickToWorld(pointer: Phaser.Input.Pointer): { col: number; row: number } {
    const cam = this.scene.cameras.main;
    const worldX = pointer.x + cam.scrollX;
    const worldY = pointer.y + cam.scrollY;
    return getTileAtScreen(worldX, worldY);
  }

  get currentSeq(): number {
    return this.moveSeq;
  }
}
