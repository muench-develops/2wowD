import Phaser from 'phaser';
import {
  ClassType,
  CLASS_STATS,
  MAX_CHARACTERS_PER_ACCOUNT,
  MIN_CHARACTER_NAME_LENGTH,
  MAX_CHARACTER_NAME_LENGTH,
  ClientMessageType,
  ServerMessageType,
  type CharacterSummary,
  type CharacterCreatedMessage,
  type CharacterCreateFailedMessage,
  type CharacterDeletedMessage,
  type WelcomeMessage,
} from '@isoheim/shared';
import { NetworkManager } from '../network/NetworkManager';

const CLASSES = [ClassType.Warrior, ClassType.Mage, ClassType.Rogue, ClassType.Priest];

const CLASS_INFO: Record<ClassType, { role: string; color: string; colorHex: number }> = {
  [ClassType.Warrior]: { role: 'Melee Tank / DPS', color: '#dd3333', colorHex: 0xdd3333 },
  [ClassType.Mage]: { role: 'Ranged DPS', color: '#3366ff', colorHex: 0x3366ff },
  [ClassType.Rogue]: { role: 'Melee DPS', color: '#33cc55', colorHex: 0x33cc55 },
  [ClassType.Priest]: { role: 'Healer / Ranged', color: '#eecc33', colorHex: 0xeecc33 },
};

interface SceneData {
  accountId: string;
  characters: CharacterSummary[];
}

export class CharacterSelectScene extends Phaser.Scene {
  private net!: NetworkManager;
  private accountId = '';
  private characters: CharacterSummary[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _listeners: Array<{ event: string; cb: (data: any) => void }> = [];

  // UI containers
  private slotsContainer!: Phaser.GameObjects.Container;
  private modalContainer: Phaser.GameObjects.Container | null = null;
  private modalDom: Phaser.GameObjects.DOMElement | null = null;
  private errorText!: Phaser.GameObjects.Text;

  // Delete confirmation state
  private pendingDeleteId: string | null = null;

  // Create character state
  private createSelectedClass: ClassType = ClassType.Warrior;

  constructor() {
    super({ key: 'CharacterSelectScene' });
  }

  init(data: SceneData): void {
    this.accountId = data.accountId;
    this.characters = data.characters ?? [];
    this.pendingDeleteId = null;
  }

  create(): void {
    this.net = NetworkManager.instance;

    // Title
    this.add
      .text(640, 36, 'Select Character', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ffcc44',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);

    this.slotsContainer = this.add.container(0, 0);
    this.errorText = this.add
      .text(640, 630, '', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ff4444',
      })
      .setOrigin(0.5);

    this.renderSlots();
    this.registerNetworkHandlers();

    // Logout button
    const logoutBtn = this.add
      .text(1220, 680, '[ Logout ]', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#888899',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    logoutBtn.on('pointerover', () => logoutBtn.setColor('#ccccdd'));
    logoutBtn.on('pointerout', () => logoutBtn.setColor('#888899'));
    logoutBtn.on('pointerdown', () => {
      this.net.send({ type: ClientMessageType.Logout });
      this.cleanupListeners();
      this.scene.start('LoginScene');
    });
  }

  // ── Slot rendering ──────────────────────────────────────────

  private renderSlots(): void {
    this.slotsContainer.removeAll(true);

    const slotW = 240;
    const slotH = 280;
    const gap = 20;
    const totalW = MAX_CHARACTERS_PER_ACCOUNT * slotW + (MAX_CHARACTERS_PER_ACCOUNT - 1) * gap;
    const startX = (1280 - totalW) / 2;
    const y = 100;

    for (let i = 0; i < MAX_CHARACTERS_PER_ACCOUNT; i++) {
      const char = this.characters[i] ?? null;
      const x = startX + i * (slotW + gap);

      if (char) {
        this.renderFilledSlot(x, y, slotW, slotH, char);
      } else {
        this.renderEmptySlot(x, y, slotW, slotH);
      }
    }
  }

  private renderFilledSlot(x: number, y: number, w: number, h: number, char: CharacterSummary): void {
    const info = CLASS_INFO[char.classType];

    // Card background
    const card = this.make.graphics({});
    card.fillStyle(0x1a1a2e, 0.9);
    card.fillRoundedRect(x, y, w, h, 8);
    card.lineStyle(2, 0x444466, 1);
    card.strokeRoundedRect(x, y, w, h, 8);
    this.slotsContainer.add(card);

    // Sprite
    const sprite = this.add.sprite(x + w / 2, y + 50, `player-${char.classType}`).setScale(2.5);
    this.slotsContainer.add(sprite);

    // Character name
    const nameText = this.add
      .text(x + w / 2, y + 90, char.name, {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.slotsContainer.add(nameText);

    // Level & class
    const levelText = this.add
      .text(x + w / 2, y + 112, `Lv ${char.level}  •  ${char.classType.charAt(0).toUpperCase() + char.classType.slice(1)}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: info.color,
      })
      .setOrigin(0.5);
    this.slotsContainer.add(levelText);

    // Stats preview
    const stats = CLASS_STATS[char.classType];
    const statsText = this.add
      .text(x + w / 2, y + 140, `HP: ${stats.maxHealth}  MP: ${stats.maxMana}`, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#8888aa',
      })
      .setOrigin(0.5);
    this.slotsContainer.add(statsText);

    // Role
    const roleText = this.add
      .text(x + w / 2, y + 158, info.role, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#666688',
      })
      .setOrigin(0.5);
    this.slotsContainer.add(roleText);

    // Play button
    const playBg = this.make.graphics({});
    playBg.fillStyle(0x228833, 1);
    playBg.fillRoundedRect(x + 20, y + h - 60, w - 40, 36, 6);
    this.slotsContainer.add(playBg);

    const playText = this.add
      .text(x + w / 2, y + h - 42, '▶  Play', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.slotsContainer.add(playText);

    const playZone = this.add
      .zone(x + 20, y + h - 60, w - 40, 36)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.slotsContainer.add(playZone);

    playZone.on('pointerover', () => {
      playBg.clear();
      playBg.fillStyle(0x33aa44, 1);
      playBg.fillRoundedRect(x + 20, y + h - 60, w - 40, 36, 6);
    });
    playZone.on('pointerout', () => {
      playBg.clear();
      playBg.fillStyle(0x228833, 1);
      playBg.fillRoundedRect(x + 20, y + h - 60, w - 40, 36, 6);
    });
    playZone.on('pointerdown', () => this.playCharacter(char.id));

    // Delete button (top-right corner)
    const delBg = this.make.graphics({});
    delBg.fillStyle(0x661111, 0.8);
    delBg.fillRoundedRect(x + w - 36, y + 6, 28, 20, 4);
    this.slotsContainer.add(delBg);

    const isConfirming = this.pendingDeleteId === char.id;
    const delText = this.add
      .text(x + w - 22, y + 16, isConfirming ? '!!' : '✕', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: isConfirming ? '#ffcc00' : '#cc4444',
      })
      .setOrigin(0.5);
    this.slotsContainer.add(delText);

    const delZone = this.add
      .zone(x + w - 36, y + 6, 28, 20)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.slotsContainer.add(delZone);

    delZone.on('pointerdown', () => this.handleDelete(char));
  }

  private renderEmptySlot(x: number, y: number, w: number, h: number): void {
    const card = this.make.graphics({});
    card.fillStyle(0x111122, 0.7);
    card.fillRoundedRect(x, y, w, h, 8);
    card.lineStyle(2, 0x333344, 0.6);
    card.strokeRoundedRect(x, y, w, h, 8);
    this.slotsContainer.add(card);

    const plus = this.add
      .text(x + w / 2, y + h / 2 - 16, '+', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#444466',
      })
      .setOrigin(0.5);
    this.slotsContainer.add(plus);

    const label = this.add
      .text(x + w / 2, y + h / 2 + 24, 'Create New', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#555577',
      })
      .setOrigin(0.5);
    this.slotsContainer.add(label);

    const zone = this.add
      .zone(x, y, w, h)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.slotsContainer.add(zone);

    zone.on('pointerover', () => {
      card.clear();
      card.fillStyle(0x1a1a30, 0.85);
      card.fillRoundedRect(x, y, w, h, 8);
      card.lineStyle(2, 0x555577, 0.8);
      card.strokeRoundedRect(x, y, w, h, 8);
    });
    zone.on('pointerout', () => {
      card.clear();
      card.fillStyle(0x111122, 0.7);
      card.fillRoundedRect(x, y, w, h, 8);
      card.lineStyle(2, 0x333344, 0.6);
      card.strokeRoundedRect(x, y, w, h, 8);
    });
    zone.on('pointerdown', () => this.showCreateModal());
  }

  // ── Actions ─────────────────────────────────────────────────

  private playCharacter(characterId: string): void {
    this.errorText.setText('');
    this.net.send({ type: ClientMessageType.SelectCharacter, characterId });
  }

  private handleDelete(char: CharacterSummary): void {
    if (this.pendingDeleteId === char.id) {
      // Second click — confirm
      this.net.send({ type: ClientMessageType.DeleteCharacter, characterId: char.id });
      this.pendingDeleteId = null;
    } else {
      // First click — show confirmation
      this.pendingDeleteId = char.id;
      this.errorText.setText(`Delete "${char.name}"? Click ✕ again to confirm.`);
      this.errorText.setColor('#ffcc00');
      this.renderSlots();
    }
  }

  // ── Create Character Modal ──────────────────────────────────

  private showCreateModal(): void {
    if (this.modalContainer) return;

    this.createSelectedClass = ClassType.Warrior;

    // Dim overlay
    this.modalContainer = this.add.container(0, 0);

    const overlay = this.make.graphics({});
    overlay.fillStyle(0x000000, 0.6);
    overlay.fillRect(0, 0, 1280, 720);
    this.modalContainer.add(overlay);

    const overlayZone = this.add.zone(0, 0, 1280, 720).setOrigin(0).setInteractive();
    this.modalContainer.add(overlayZone);
    overlayZone.on('pointerdown', () => this.closeCreateModal());

    // Modal panel
    const panelW = 720;
    const panelH = 400;
    const px = (1280 - panelW) / 2;
    const py = (720 - panelH) / 2;

    const panel = this.make.graphics({});
    panel.fillStyle(0x1a1a2e, 0.98);
    panel.fillRoundedRect(px, py, panelW, panelH, 12);
    panel.lineStyle(2, 0x555577, 1);
    panel.strokeRoundedRect(px, py, panelW, panelH, 12);
    this.modalContainer.add(panel);

    // Block clicks from propagating through panel to overlay
    const panelZone = this.add.zone(px, py, panelW, panelH).setOrigin(0).setInteractive();
    this.modalContainer.add(panelZone);

    // Title
    const title = this.add
      .text(640, py + 24, 'Create Character', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffcc44',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.modalContainer.add(title);

    // Class cards
    this.renderClassCards(px + 20, py + 60);

    // Name input via DOM
    const formHtml = `
      <div style="display:flex; align-items:center; gap:12px; font-family:monospace;">
        <label style="color:#aaaacc; font-size:13px; white-space:nowrap;">Name:</label>
        <input id="create-char-name" type="text" maxlength="${MAX_CHARACTER_NAME_LENGTH}"
          style="padding:8px 12px; background:#111122; border:1px solid #444466; color:#fff; font-family:monospace; border-radius:4px; width:200px;" />
        <button id="create-char-btn"
          style="padding:8px 20px; background:#3344aa; color:#fff; border:none; border-radius:4px; cursor:pointer; font-family:monospace; font-weight:bold;">Create</button>
        <button id="cancel-char-btn"
          style="padding:8px 16px; background:#333344; color:#aaa; border:1px solid #444466; border-radius:4px; cursor:pointer; font-family:monospace;">Cancel</button>
      </div>
      <div id="create-char-error" style="color:#ff4444; font-size:11px; margin-top:8px; text-align:center; display:none;"></div>
    `;
    this.modalDom = this.add.dom(640, py + panelH - 60).createFromHTML(formHtml);
    this.modalContainer.add(this.modalDom);

    const createBtn = this.modalDom.getChildByID('create-char-btn') as HTMLButtonElement;
    const cancelBtn = this.modalDom.getChildByID('cancel-char-btn') as HTMLButtonElement;
    const nameInput = this.modalDom.getChildByID('create-char-name') as HTMLInputElement;

    createBtn.addEventListener('click', () => this.submitCreateCharacter());
    cancelBtn.addEventListener('click', () => this.closeCreateModal());
    nameInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') this.submitCreateCharacter();
    });
  }

  private renderClassCards(startX: number, startY: number): void {
    if (!this.modalContainer) return;

    const cardW = 155;
    const cardH = 180;
    const gap = 14;

    for (let i = 0; i < CLASSES.length; i++) {
      const ct = CLASSES[i];
      const info = CLASS_INFO[ct];
      const stats = CLASS_STATS[ct];
      const x = startX + i * (cardW + gap);
      const y = startY;
      const isSelected = ct === this.createSelectedClass;

      const card = this.make.graphics({});
      card.fillStyle(isSelected ? 0x222244 : 0x151528, 0.95);
      card.fillRoundedRect(x, y, cardW, cardH, 6);
      card.lineStyle(2, isSelected ? 0x6666cc : 0x333355, 1);
      card.strokeRoundedRect(x, y, cardW, cardH, 6);
      this.modalContainer.add(card);

      const sprite = this.add.sprite(x + cardW / 2, y + 30, `player-${ct}`).setScale(2);
      this.modalContainer.add(sprite);

      const nameLabel = this.add
        .text(x + cardW / 2, y + 55, ct.charAt(0).toUpperCase() + ct.slice(1), {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: info.color,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.modalContainer.add(nameLabel);

      const roleLabel = this.add
        .text(x + cardW / 2, y + 72, info.role, {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#777799',
        })
        .setOrigin(0.5);
      this.modalContainer.add(roleLabel);

      const statLines = [
        `HP: ${stats.maxHealth}  MP: ${stats.maxMana}`,
        `ATK: ${stats.attack}  DEF: ${stats.defense}`,
        `SPD: ${stats.speed}`,
      ];
      statLines.forEach((line, j) => {
        const st = this.add.text(x + 14, y + 92 + j * 16, line, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#aaaacc',
        });
        this.modalContainer!.add(st);
      });

      if (isSelected) {
        const check = this.add
          .text(x + cardW - 12, y + 8, '✓', {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#44ff44',
          })
          .setOrigin(0.5);
        this.modalContainer.add(check);
      }

      const zone = this.add
        .zone(x, y, cardW, cardH)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      this.modalContainer.add(zone);

      zone.on('pointerdown', () => {
        this.createSelectedClass = ct;
        // Re-render modal content by closing and reopening
        const nameVal = this.modalDom
          ? (this.modalDom.getChildByID('create-char-name') as HTMLInputElement)?.value ?? ''
          : '';
        this.closeCreateModal();
        this.showCreateModal();
        // Restore name input value
        if (this.modalDom) {
          const inp = this.modalDom.getChildByID('create-char-name') as HTMLInputElement;
          if (inp) inp.value = nameVal;
        }
      });
    }
  }

  private submitCreateCharacter(): void {
    if (!this.modalDom) return;

    const nameInput = this.modalDom.getChildByID('create-char-name') as HTMLInputElement;
    const errorEl = this.modalDom.getChildByID('create-char-error') as HTMLDivElement;
    const name = nameInput.value.trim();

    if (name.length < MIN_CHARACTER_NAME_LENGTH) {
      errorEl.textContent = `Name must be at least ${MIN_CHARACTER_NAME_LENGTH} characters.`;
      errorEl.style.display = 'block';
      return;
    }
    if (name.length > MAX_CHARACTER_NAME_LENGTH) {
      errorEl.textContent = `Name must be at most ${MAX_CHARACTER_NAME_LENGTH} characters.`;
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';

    this.net.send({
      type: ClientMessageType.CreateCharacter,
      name,
      classType: this.createSelectedClass,
    });
  }

  private closeCreateModal(): void {
    if (this.modalContainer) {
      this.modalContainer.destroy(true);
      this.modalContainer = null;
    }
    if (this.modalDom) {
      this.modalDom.destroy();
      this.modalDom = null;
    }
  }

  // ── Network Handlers ────────────────────────────────────────

  private registerNetworkHandlers(): void {
    const onCharacterCreated = (msg: CharacterCreatedMessage) => {
      this.characters.push(msg.character);
      this.closeCreateModal();
      this.renderSlots();
    };

    const onCharacterCreateFailed = (msg: CharacterCreateFailedMessage) => {
      if (this.modalDom) {
        const errorEl = this.modalDom.getChildByID('create-char-error') as HTMLDivElement;
        errorEl.textContent = msg.reason;
        errorEl.style.display = 'block';
      } else {
        this.errorText.setText(msg.reason);
        this.errorText.setColor('#ff4444');
      }
    };

    const onCharacterDeleted = (msg: CharacterDeletedMessage) => {
      this.characters = this.characters.filter((c) => c.id !== msg.characterId);
      this.pendingDeleteId = null;
      this.errorText.setText('');
      this.renderSlots();
    };

    const onWelcome = (msg: WelcomeMessage) => {
      this.cleanupListeners();
      this.scene.start('GameScene', {
        classType: msg.player.classType,
        playerName: msg.player.name,
        welcomeData: msg,
      });
    };

    this.net.on(ServerMessageType.CharacterCreated, onCharacterCreated);
    this.net.on(ServerMessageType.CharacterCreateFailed, onCharacterCreateFailed);
    this.net.on(ServerMessageType.CharacterDeleted, onCharacterDeleted);
    this.net.on(ServerMessageType.Welcome, onWelcome);

    this._listeners = [
      { event: ServerMessageType.CharacterCreated, cb: onCharacterCreated },
      { event: ServerMessageType.CharacterCreateFailed, cb: onCharacterCreateFailed },
      { event: ServerMessageType.CharacterDeleted, cb: onCharacterDeleted },
      { event: ServerMessageType.Welcome, cb: onWelcome },
    ];
  }

  private cleanupListeners(): void {
    for (const { event, cb } of this._listeners) {
      this.net.off(event, cb);
    }
    this._listeners = [];
  }

  shutdown(): void {
    this.cleanupListeners();
    this.closeCreateModal();
  }
}
