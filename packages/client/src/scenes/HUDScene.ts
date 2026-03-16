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
  private latencyText!: Phaser.GameObjects.Text;
  private muteIndicator!: Phaser.GameObjects.Text;
  private guideSystem!: GuideSystem;
  private helpButton!: Phaser.GameObjects.Text;
  private gameScene!: Phaser.Scene;

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

    // Latency display
    this.latencyText = this.add.text(1260, 4, '', {
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

    // Listen to GameScene events
    this.gameScene.events.on('updatePlayerHealth', (current: number, max: number) => {
      this.healthBar.setValue(current, max);
    });

    this.gameScene.events.on('updatePlayerMana', (current: number, max: number) => {
      this.manaBar.setValue(current, max);
    });

    this.gameScene.events.on('updatePlayerXp', (current: number, max: number) => {
      this.xpBar.setValue(current, max);
    });

    this.gameScene.events.on('updateBuffs', (buffs: BuffState[]) => {
      this.buffBar.update(buffs);
    });

    this.gameScene.events.on('setAbilities', (abilities: AbilityDef[]) => {
      this.actionBar.setAbilities(abilities);
    });

    this.gameScene.events.on('updateCooldowns', (cooldowns: CooldownState[]) => {
      this.actionBar.updateCooldowns(cooldowns);
    });

    this.gameScene.events.on('chatMessage', (msg: ChatMessage) => {
      this.chatPanel.addMessage(msg);
      SoundManager.instance.playChatPing();
    });

    this.gameScene.events.on('showTarget', (name: string, health: number, maxHealth: number) => {
      this.targetFrame.show(name, health, maxHealth);
    });

    this.gameScene.events.on('updateTarget', (name: string, health: number, maxHealth: number) => {
      this.targetFrame.show(name, health, maxHealth);
    });

    this.gameScene.events.on('hideTarget', () => {
      this.targetFrame.hide();
    });

    this.gameScene.events.on('targetChanged', (id: string | null) => {
      this.actionBar.setTargetId(id);
    });

    this.gameScene.events.on('startCast', (name: string, durationMs: number) => {
      this.castBar.startCast(name, durationMs);
    });

    this.gameScene.events.on('mapLoaded', (mapData: MapData) => {
      this.minimap.renderMap(mapData);
    });

    this.gameScene.events.on('toggleGameMenu', () => {
      this.escMenu.toggle();
    });

    this.gameScene.events.on('toggleChatPanel', () => {
      this.chatPanel.toggleFocus();
      const isFocused = this.chatPanel.isFocused;
      // Notify GameScene InputSystem
      this.gameScene.events.emit('chatFocusChanged', isFocused);
    });

    // Chat blur event
    this.events.on('chatBlurred', () => {
      this.gameScene.events.emit('chatFocusChanged', false);
    });

    // Guide system
    this.guideSystem = new GuideSystem(this, this.gameScene);

    // Help button (? icon top-right)
    this.helpButton = this.add.text(1260, 16, '❓', {
      fontSize: '20px',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .setDepth(800)
      .on('pointerdown', () => this.guideSystem.showCurrentTip());

    // Start tutorial on first game entry
    this.gameScene.events.on('gameReady', () => {
      this.guideSystem.start();
    });

    // Listen for mute toggle from GameScene (M key)
    this.gameScene.events.on('muteToggled', () => {
      this.updateMuteIndicator();
    });

    // Inventory toggle
    this.gameScene.events.on('toggleInventory', () => {
      this.inventoryPanel.toggle();
    });

    // Inventory data updates
    this.gameScene.events.on('inventoryUpdated', (inventory: InventoryItem[]) => {
      this.inventoryPanel.updateInventory(inventory);
    });

    // Loot window
    this.gameScene.events.on('showLoot', (loot: WorldLoot) => {
      this.lootWindow.show(loot);
    });

    this.gameScene.events.on('lootItemRemoved', (lootId: string, itemIndex: number) => {
      if (this.lootWindow.getCurrentLootId() === lootId) {
        this.lootWindow.removeItem(itemIndex);
      }
    });

    this.gameScene.events.on('lootDespawned', (lootId: string) => {
      if (this.lootWindow.getCurrentLootId() === lootId) {
        this.lootWindow.close();
      }
    });

    // Listen for chat focus changes in game scene's input system
    this.gameScene.events.on('chatFocusChanged', (focused: boolean) => {
      // The InputSystem in GameScene will read this
      const inputSystem = (this.gameScene as { inputSystem?: { chatFocused?: boolean } }).inputSystem;
      if (inputSystem && 'chatFocused' in inputSystem) {
        inputSystem.chatFocused = focused;
      }
    });
  }

  private updateMuteIndicator(): void {
    this.muteIndicator.setText(SoundManager.instance.muted ? '🔇' : '🔊');
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
}
