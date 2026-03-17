import Phaser from 'phaser';
import { type AbilityDef, type CooldownState, type ChatMessage, type MapData, type BuffState, type InventoryItem, type WorldLoot } from '@isoheim/shared';
import { HealthBar } from '../ui/HealthBar';
import { ActionBar } from '../ui/ActionBar';
import { ChatPanel } from '../ui/ChatPanel';
import { TargetFrame } from '../ui/TargetFrame';
import { CastBar } from '../ui/CastBar';
import { BuffBar } from '../ui/BuffBar';
import { Minimap, type MinimapEntityData } from '../ui/Minimap';
import { EscMenu } from '../ui/EscMenu';
import { InventoryPanel } from '../ui/InventoryPanel';
import { LootWindow } from '../ui/LootWindow';
import { CharacterPanel, type CharacterStatsData } from '../ui/CharacterPanel';
import { GuideSystem } from '../ui/GuideSystem.js';
import { NetworkManager } from '../network/NetworkManager';
import { SoundManager } from '../systems/SoundManager';

export class HUDScene extends Phaser.Scene {
  private healthBar!: HealthBar;
  private manaBar!: HealthBar;
  private xpBar!: HealthBar;
  private actionBar!: ActionBar;
  private chatPanel!: ChatPanel;
  private targetFrame!: TargetFrame;
  private castBar!: CastBar;
  private buffBar!: BuffBar;
  private minimap!: Minimap;
  private escMenu!: EscMenu;
  private inventoryPanel!: InventoryPanel;
  private lootWindow!: LootWindow;
  private characterPanel!: CharacterPanel;
  private guideSystem!: GuideSystem;
  private helpButton!: Phaser.GameObjects.Text;
  private latencyText!: Phaser.GameObjects.Text;
  private muteIndicator!: Phaser.GameObjects.Text;
  private gameScene!: Phaser.Scene;
  private zoneNameText!: Phaser.GameObjects.Text;
  private tooltipText!: Phaser.GameObjects.Text;
  private _gameSceneListeners: Array<{ event: string; cb: (...args: any[]) => void }> = [];
  private _ownListeners: Array<{ event: string; cb: (...args: any[]) => void }> = [];

  constructor() {
    super({ key: 'HUDScene' });
  }

  create(): void {
    this.gameScene = this.scene.get('GameScene');

    // Player health bar (top left)
    this.add.text(12, 10, 'HP', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#cc4444',
    }).setDepth(101);
    this.healthBar = new HealthBar(this, 32, 8, 180, 18, 0xcc2222);
    this.healthBar.setDepth(100);

    // Player mana bar
    this.add.text(12, 32, 'MP', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#4444cc',
    }).setDepth(101);
    this.manaBar = new HealthBar(this, 32, 30, 180, 18, 0x2244cc);
    this.manaBar.setDepth(100);

    // Player XP bar
    this.add.text(12, 54, 'XP', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#ccaa22',
    }).setDepth(101);
    this.xpBar = new HealthBar(this, 32, 52, 180, 18, 0xccaa22);
    this.xpBar.setDepth(100);

    // Action bar
    this.actionBar = new ActionBar(this);

    // Chat panel
    this.chatPanel = new ChatPanel(this);

    // Target frame
    this.targetFrame = new TargetFrame(this);

    // Cast bar
    this.castBar = new CastBar(this);

    // Buff bar (below XP bar area)
    this.buffBar = new BuffBar(this);

    // Minimap
    this.minimap = new Minimap(this);

    // ESC menu
    this.escMenu = new EscMenu(this, this.gameScene);

    // Inventory panel
    this.inventoryPanel = new InventoryPanel(this);

    // Loot window
    this.lootWindow = new LootWindow(this);

    // Character panel
    this.characterPanel = new CharacterPanel(this);

    // Guide system
    this.guideSystem = new GuideSystem(this, this.gameScene);
    this.helpButton = this.add.text(1260, 16, '❓', { fontSize: '20px' })
      .setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(800)
      .on('pointerdown', () => this.guideSystem.showCurrentTip());
    this.onGameScene('gameReady', (data: { tutorialComplete?: boolean }) => {
      if (data?.tutorialComplete) {
        this.guideSystem.setServerComplete(true);
      }
      this.guideSystem.start();
    });

    // Latency display
    this.latencyText = this.add.text(1230, 4, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#666688',
    });
    this.latencyText.setOrigin(1, 0).setDepth(100);

    // Mute indicator (top-right, next to latency)
    this.muteIndicator = this.add.text(1260, 18, '🔊', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#aaaaaa',
    });
    this.muteIndicator.setOrigin(1, 0).setDepth(100).setInteractive({ useHandCursor: true });
    this.muteIndicator.on('pointerdown', () => {
      SoundManager.instance.init();
      SoundManager.instance.toggleMute();
      this.updateMuteIndicator();
    });

    // Zone name display (top center)
    this.zoneNameText = this.add.text(640, 8, 'Starter Plains', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ffdd88',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.zoneNameText.setOrigin(0.5, 0).setDepth(100);

    // Tooltip text (initially hidden)
    this.tooltipText = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#ffffff',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 4 },
    });
    this.tooltipText.setOrigin(0.5, 1).setDepth(10000).setVisible(false);

    // Listen to GameScene events
    this.onGameScene('updatePlayerHealth', (current: number, max: number) => {
      this.healthBar.setValue(current, max);
    });

    this.onGameScene('updatePlayerMana', (current: number, max: number) => {
      this.manaBar.setValue(current, max);
    });

    this.onGameScene('updatePlayerXp', (current: number, max: number) => {
      this.xpBar.setValue(current, max);
    });

    this.onGameScene('updateBuffs', (buffs: BuffState[]) => {
      this.buffBar.update(buffs);
    });

    this.onGameScene('setAbilities', (abilities: AbilityDef[]) => {
      this.actionBar.setAbilities(abilities);
    });

    this.onGameScene('updateCooldowns', (cooldowns: CooldownState[]) => {
      this.actionBar.updateCooldowns(cooldowns);
    });

    this.onGameScene('chatMessage', (msg: ChatMessage) => {
      this.chatPanel.addMessage(msg);
      SoundManager.instance.playChatPing();
    });

    this.onGameScene('showTarget', (name: string, health: number, maxHealth: number) => {
      this.targetFrame.show(name, health, maxHealth);
    });

    this.onGameScene('updateTarget', (name: string, health: number, maxHealth: number) => {
      this.targetFrame.show(name, health, maxHealth);
    });

    this.onGameScene('hideTarget', () => {
      this.targetFrame.hide();
    });

    this.onGameScene('targetChanged', (id: string | null) => {
      this.actionBar.setTargetId(id);
    });

    this.onGameScene('startCast', (name: string, durationMs: number) => {
      this.castBar.startCast(name, durationMs);
    });

    this.onGameScene('mapLoaded', (mapData: MapData) => {
      this.minimap.renderMap(mapData);
    });

    this.onGameScene('toggleGameMenu', () => {
      this.escMenu.toggle();
    });

    this.onGameScene('toggleChatPanel', () => {
      this.chatPanel.toggleFocus();
      const isFocused = this.chatPanel.isFocused;
      // Notify GameScene InputSystem
      this.gameScene.events.emit('chatFocusChanged', isFocused);
    });

    // Chat blur event
    this.onOwn('chatBlurred', () => {
      this.gameScene.events.emit('chatFocusChanged', false);
    });

    // Listen for mute toggle from GameScene (M key)
    this.onGameScene('muteToggled', () => {
      this.updateMuteIndicator();
    });

    // Inventory toggle
    this.onGameScene('toggleInventory', () => {
      this.inventoryPanel.toggle();
    });

    // Inventory data updates
    this.onGameScene('inventoryUpdated', (inventory: InventoryItem[]) => {
      this.inventoryPanel.updateInventory(inventory);
    });

    // Character panel toggle
    this.onGameScene('toggleCharacter', () => {
      this.characterPanel.toggle();
    });

    // Character stats updates
    this.onGameScene('updateCharacterStats', (data: CharacterStatsData) => {
      this.characterPanel.updateStats(data);
    });

    // Server error messages — show as floating notification
    this.onGameScene('showErrorMessage', (message: string) => {
      this.showErrorNotification(message);
    });

    // Loot window
    this.onGameScene('showLoot', (loot: WorldLoot) => {
      this.lootWindow.show(loot);
    });

    this.onGameScene('lootItemRemoved', (lootId: string, itemIndex: number) => {
      if (this.lootWindow.getCurrentLootId() === lootId) {
        this.lootWindow.removeItem(itemIndex);
      }
    });

    this.onGameScene('lootDespawned', (lootId: string) => {
      if (this.lootWindow.getCurrentLootId() === lootId) {
        this.lootWindow.close();
      }
    });

    // Listen for chat focus changes in game scene's input system
    this.onGameScene('chatFocusChanged', (focused: boolean) => {
      // The InputSystem in GameScene will read this
      const inputSystem = (this.gameScene as { inputSystem?: { chatFocused?: boolean } }).inputSystem;
      if (inputSystem && 'chatFocused' in inputSystem) {
        inputSystem.chatFocused = focused;
      }
    });

    this.onGameScene('zoneChanged', (zoneName: string) => {
      this.zoneNameText.setText(zoneName);
    });

    this.onGameScene('showTooltip', (text: string, x: number, y: number) => {
      this.tooltipText.setText(text);
      this.tooltipText.setPosition(x, y);
      this.tooltipText.setVisible(true);
    });

    this.onGameScene('hideTooltip', () => {
      this.tooltipText.setVisible(false);
    });
  }

  private updateMuteIndicator(): void {
    this.muteIndicator.setText(SoundManager.instance.muted ? '🔇' : '🔊');
  }

  private showErrorNotification(message: string): void {
    const errorText = this.add.text(640, 80, message, {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#ff6644',
      stroke: '#000000',
      strokeThickness: 3,
    });
    errorText.setOrigin(0.5).setDepth(2000).setAlpha(1);

    this.tweens.add({
      targets: errorText,
      alpha: 0,
      y: 60,
      duration: 2500,
      ease: 'Power2',
      onComplete: () => {
        errorText.destroy();
      },
    });
  }

  update(): void {
    this.castBar.update();

    // Update minimap entity dots
    const gs = this.gameScene as { getMinimapData?: () => MinimapEntityData };
    if (typeof gs.getMinimapData === 'function') {
      this.minimap.updateEntities(gs.getMinimapData());
    }

    // Update latency display
    const nm = NetworkManager.instance;
    if (nm) {
      this.latencyText.setText(`${nm.latency}ms`);
    }
  }

  private onGameScene(event: string, cb: (...args: any[]) => void): void {
    this.gameScene.events.on(event, cb);
    this._gameSceneListeners.push({ event, cb });
  }

  private onOwn(event: string, cb: (...args: any[]) => void): void {
    this.events.on(event, cb);
    this._ownListeners.push({ event, cb });
  }

  private cleanupListeners(): void {
    for (const { event, cb } of this._gameSceneListeners) {
      this.gameScene.events.off(event, cb);
    }
    this._gameSceneListeners = [];

    for (const { event, cb } of this._ownListeners) {
      this.events.off(event, cb);
    }
    this._ownListeners = [];
  }

  shutdown(): void {
    this.cleanupListeners();
  }
}
