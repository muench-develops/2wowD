import Phaser from 'phaser';
import { ChatMessage, ChatChannel, ClientMessageType, MAX_CHAT_LENGTH } from '@2wowd/shared';
import { NetworkManager } from '../network/NetworkManager';

const PANEL_W = 360;
const PANEL_H = 180;
const MAX_MESSAGES = 50;

export class ChatPanel {
  private scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Graphics;
  private messages: ChatMessage[] = [];
  private messageTexts: Phaser.GameObjects.Text[] = [];
  private inputBg: Phaser.GameObjects.Graphics;
  private inputText: Phaser.GameObjects.Text;
  private inputBuffer = '';
  private focused = false;
  private x: number;
  private y: number;

  get isFocused(): boolean {
    return this.focused;
  }

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.x = 8;
    this.y = 720 - PANEL_H - 8;

    this.bg = scene.add.graphics();
    this.bg.fillStyle(0x111122, 0.7);
    this.bg.fillRoundedRect(this.x, this.y, PANEL_W, PANEL_H - 24, 4);
    this.bg.setDepth(100);

    this.inputBg = scene.add.graphics();
    this.drawInputBg();
    this.inputBg.setDepth(100);

    this.inputText = scene.add.text(this.x + 6, this.y + PANEL_H - 20, 'Press Enter to chat...', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#888888',
    });
    this.inputText.setDepth(101);

    // Keyboard listener for typing
    scene.input.keyboard!.on('keydown', this.onKeyDown, this);
  }

  private drawInputBg(): void {
    this.inputBg.clear();
    this.inputBg.fillStyle(this.focused ? 0x222244 : 0x181830, 0.9);
    this.inputBg.fillRoundedRect(this.x, this.y + PANEL_H - 24, PANEL_W, 22, 3);
    this.inputBg.lineStyle(1, this.focused ? 0x6666cc : 0x444466, 1);
    this.inputBg.strokeRoundedRect(this.x, this.y + PANEL_H - 24, PANEL_W, 22, 3);
  }

  focus(): void {
    this.focused = true;
    this.updateInputDisplay();
    this.drawInputBg();
  }

  blur(): void {
    this.focused = false;
    this.inputBuffer = '';
    this.updateInputDisplay();
    this.drawInputBg();
  }

  toggleFocus(): void {
    if (this.focused) {
      if (this.inputBuffer.length > 0) {
        this.sendMessage();
      }
      this.blur();
    } else {
      this.focus();
    }
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.focused) return;

    if (event.key === 'Enter') {
      // Handled by toggleFocus from InputSystem
      return;
    }
    if (event.key === 'Escape') {
      this.blur();
      this.scene.events.emit('chatBlurred');
      return;
    }
    if (event.key === 'Backspace') {
      this.inputBuffer = this.inputBuffer.slice(0, -1);
      this.updateInputDisplay();
      return;
    }
    if (event.key.length === 1 && this.inputBuffer.length < MAX_CHAT_LENGTH) {
      this.inputBuffer += event.key;
      this.updateInputDisplay();
    }
  }

  private updateInputDisplay(): void {
    if (this.focused) {
      this.inputText.setText(this.inputBuffer.length > 0 ? this.inputBuffer + '|' : '|');
      this.inputText.setColor('#ffffff');
    } else {
      this.inputText.setText('Press Enter to chat...');
      this.inputText.setColor('#888888');
    }
  }

  private sendMessage(): void {
    const content = this.inputBuffer.trim();
    if (content.length === 0) return;

    NetworkManager.instance.send({
      type: ClientMessageType.Chat,
      channel: ChatChannel.Say,
      content,
    });

    this.inputBuffer = '';
  }

  addMessage(msg: ChatMessage): void {
    this.messages.push(msg);
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.shift();
    }
    this.renderMessages();
  }

  private renderMessages(): void {
    // Destroy old
    for (const t of this.messageTexts) t.destroy();
    this.messageTexts = [];

    const lineH = 13;
    const maxLines = Math.floor((PANEL_H - 32) / lineH);
    const start = Math.max(0, this.messages.length - maxLines);

    for (let i = start; i < this.messages.length; i++) {
      const msg = this.messages[i];
      const color = this.getChannelColor(msg.channel);
      const prefix = msg.channel === ChatChannel.System ? '[System] ' : `[${msg.senderName}] `;
      const txt = this.scene.add.text(
        this.x + 6,
        this.y + 4 + (i - start) * lineH,
        `${prefix}${msg.content}`,
        {
          fontFamily: 'monospace',
          fontSize: '10px',
          color,
          wordWrap: { width: PANEL_W - 16 },
        },
      );
      txt.setDepth(101);
      this.messageTexts.push(txt);
    }
  }

  private getChannelColor(channel: ChatChannel): string {
    switch (channel) {
      case ChatChannel.World:
        return '#ffffff';
      case ChatChannel.Say:
        return '#ffff88';
      case ChatChannel.System:
        return '#aaaaaa';
      default:
        return '#ffffff';
    }
  }

  destroy(): void {
    this.bg.destroy();
    this.inputBg.destroy();
    this.inputText.destroy();
    this.messageTexts.forEach((t) => t.destroy());
    this.scene.input.keyboard!.off('keydown', this.onKeyDown, this);
  }
}
