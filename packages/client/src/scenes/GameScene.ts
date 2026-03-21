import Phaser from 'phaser';
import {
  ClassType,
  PlayerState,
  MobState,
  MapData,
  TileType,
  ServerMessageType,
  ClientMessageType,
  worldToScreen,
  CLASS_ABILITIES,
  CLASS_STATS,
  PLAYER_SPAWN_X,
  PLAYER_SPAWN_Y,
  TICK_INTERVAL,
  ZoneId,
  ZONE_METADATA,
  ZONE_PORTALS,
  type WelcomeMessage,
  type WorldStateMessage,
  type PlayerMovedMessage,
  type MobMovedMessage,
  type DamageDealtMessage,
  type EntityDiedMessage,
  type EntityRespawnedMessage,
  type AbilityCastMessage,
  type CooldownUpdateMessage,
  type BuffAppliedMessage,
  type BuffRemovedMessage,
  type ChatReceivedMessage,
  type LevelUpMessage,
  type MapDataMessage,
  type InventoryUpdateMessage,
  type LootSpawnedMessage,
  type LootDespawnedMessage,
  type LootPickedUpMessage,
  type ZoneChangedMessage,
  type EquipmentUpdateMessage,
  type NPCListMessage,
  type NPCDialogueMessage,
  type QuestUpdateMessage,
  type QuestCompletedMessage,
  type WorldLoot,
  type PlayerEquipment,
  NpcId,
} from '@isoheim/shared';
import { NetworkManager } from '../network/NetworkManager';
import { InputSystem } from '../systems/InputSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { PlayerEntity } from '../entities/PlayerEntity';
import { MobEntity } from '../entities/MobEntity';
import { NpcEntity } from '../entities/NpcEntity';
import { FloatingText } from '../entities/FloatingText';
import { getDepthForPosition } from '../systems/IsometricHelper';
import { SoundManager } from '../systems/SoundManager';
import { VFXManager } from '../systems/VFXManager';

export class GameScene extends Phaser.Scene {
  private net!: NetworkManager;
  private inputSystem!: InputSystem;
  private cameraSystem!: CameraSystem;

  private classType!: ClassType;
  private playerName!: string;
  private playerId: string | null = null;
  private localPlayer: PlayerEntity | null = null;
  private mapData: MapData | null = null;
  private currentZone: ZoneId = ZoneId.StarterPlains;

  private players = new Map<string, PlayerEntity>();
  private mobs = new Map<string, MobEntity>();
  private npcs = new Map<NpcId, NpcEntity>();

  private selectedTargetId: string | null = null;

  private worldLoots = new Map<string, WorldLoot>();
  private lootSprites = new Map<string, Phaser.GameObjects.Container>();

  private portalSprites = new Map<string, Phaser.GameObjects.Graphics>();

  // Client-side prediction
  private localWorldX = PLAYER_SPAWN_X;
  private localWorldY = PLAYER_SPAWN_Y;
  private pendingMoves: Array<{ seq: number; dx: number; dy: number }> = [];
  private lastAckSeq = 0;

  // Map tile layer
  private tileLayer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'GameScene' });
  }

  private welcomeData: WelcomeMessage | null = null;

  init(data: { classType: ClassType; playerName: string; welcomeData?: WelcomeMessage }): void {
    this.classType = data.classType;
    this.playerName = data.playerName;
    this.welcomeData = data.welcomeData ?? null;
  }

  create(): void {
    this.tileLayer = this.add.container(0, 0);

    this.net = NetworkManager.instance;
    this.inputSystem = new InputSystem(this);
    this.cameraSystem = new CameraSystem(this);
    VFXManager.instance.init(this);

    this.registerNetworkHandlers();
    this.registerInputHandlers();

    // Launch HUD overlay BEFORE applying welcome data so HUDScene listeners are ready
    this.scene.launch('HUDScene');

    // If we arrived via CharacterSelectScene with Welcome data, apply it directly.
    // Otherwise fall back to the legacy connect-and-join flow.
    if (this.welcomeData) {
      // Small delay so HUDScene.create() finishes registering event listeners
      this.time.delayedCall(100, () => {
        this.applyWelcome(this.welcomeData!);
        this.welcomeData = null;
      });
    } else {
      this.net.connect();
      this.net.on('connected', () => {
        this.net.send({
          type: ClientMessageType.Join,
          name: this.playerName,
          classType: this.classType,
        });
      });
    }

    // Initialize SoundManager on first user interaction (browser autoplay policy)
    this.input.once('pointerdown', () => {
      SoundManager.instance.init();
    });

    // Click handler for targeting
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.inputSystem.chatFocused) return;

      // Check if clicked on an entity sprite
      const hits = this.input.hitTestPointer(pointer);
      let foundEntity = false;

      for (const obj of hits) {
        const entityId = obj.getData('entityId') as string | undefined;
        const entityType = obj.getData('entityType') as string | undefined;
        
        if (entityId) {
          if (entityType === 'npc') {
            // Interact with NPC
            this.net.send({
              type: ClientMessageType.InteractNPC,
              npcId: entityId as NpcId,
            });
            foundEntity = true;
            break;
          } else {
            // Select target (player or mob)
            this.selectTarget(entityId);
            foundEntity = true;
            break;
          }
        }
      }

      if (!foundEntity) {
        this.selectTarget(null);
      }
    });
  }

  private applyWelcome(msg: WelcomeMessage): void {
    this.playerId = msg.playerId;
    this.localWorldX = msg.player.position.x;
    this.localWorldY = msg.player.position.y;

    if (msg.mapData) {
      this.loadMap(msg.mapData);
    }

    this.createOrUpdatePlayer(msg.player, true);

    const abilities = CLASS_ABILITIES[this.classType];
    this.events.emit('setAbilities', abilities);

    this.events.emit('updatePlayerHealth', msg.player.health, msg.player.maxHealth);
    this.events.emit('updatePlayerMana', msg.player.mana, msg.player.maxMana);
    this.events.emit('updateCharacterStats', {
      name: msg.player.name,
      classType: this.classType,
      level: msg.player.level,
      health: msg.player.health,
      maxHealth: msg.player.maxHealth,
      mana: msg.player.mana,
      maxMana: msg.player.maxMana,
      xp: msg.player.xp,
      xpToNextLevel: msg.player.xpToNextLevel,
    });

    // Snap camera to player immediately on join
    const zoneMeta = ZONE_METADATA[this.currentZone];
    this.cameraSystem.updateBounds(zoneMeta.width, zoneMeta.height);
    const screen = worldToScreen(this.localWorldX, this.localWorldY);
    this.cameraSystem.snapTo(screen.x, screen.y);

    // Signal game is ready for tutorial
    this.events.emit('gameReady', { tutorialComplete: msg.tutorialComplete ?? false });

    // Emit initial equipment state if present in PlayerState
    if (msg.player.equipment) {
      this.events.emit('equipmentUpdate', msg.player.equipment);
    }
  }

  private registerNetworkHandlers(): void {
    this.net.on(ServerMessageType.Welcome, (msg: WelcomeMessage) => {
      this.applyWelcome(msg);
    });

    this.net.on(ServerMessageType.MapData, (msg: MapDataMessage) => {
      this.loadMap(msg.mapData);
    });

    this.net.on(ServerMessageType.WorldState, (msg: WorldStateMessage) => {
      // Update/create players
      const seenPlayers = new Set<string>();
      for (const ps of msg.players) {
        seenPlayers.add(ps.id);
        const existing = this.players.get(ps.id);
        if (existing) {
          existing.updateFromState(ps);
        } else {
          this.createOrUpdatePlayer(ps, ps.id === this.playerId);
        }

        // Update local player HUD
        if (ps.id === this.playerId) {
          this.events.emit('updatePlayerHealth', ps.health, ps.maxHealth);
          this.events.emit('updatePlayerMana', ps.mana, ps.maxMana);
          this.events.emit('updatePlayerXp', ps.xp, ps.xpToNextLevel);
          this.events.emit('updateBuffs', ps.buffs ?? []);
          this.events.emit('updateCharacterStats', {
            name: ps.name,
            classType: this.classType,
            level: ps.level,
            health: ps.health,
            maxHealth: ps.maxHealth,
            mana: ps.mana,
            maxMana: ps.maxMana,
            xp: ps.xp,
            xpToNextLevel: ps.xpToNextLevel,
          });
        }

        // Update target frame if this is our target
        if (ps.id === this.selectedTargetId) {
          this.events.emit('updateTarget', ps.name, ps.health, ps.maxHealth);
        }
      }
      // Remove gone players
      for (const [id, pe] of this.players) {
        if (!seenPlayers.has(id)) {
          pe.destroy();
          this.players.delete(id);
        }
      }

      // Update/create mobs
      const seenMobs = new Set<string>();
      for (const ms of msg.mobs) {
        seenMobs.add(ms.id);
        const existing = this.mobs.get(ms.id);
        if (existing) {
          existing.updateFromState(ms);
        } else {
          this.createMob(ms);
        }

        if (ms.id === this.selectedTargetId) {
          this.events.emit('updateTarget', ms.name, ms.health, ms.maxHealth);
        }
      }
      for (const [id, me] of this.mobs) {
        if (!seenMobs.has(id)) {
          me.destroy();
          this.mobs.delete(id);
        }
      }
    });

    this.net.on(ServerMessageType.PlayerMoved, (msg: PlayerMovedMessage) => {
      if (msg.playerId === this.playerId) {
        // Reconcile: drop acknowledged moves
        this.lastAckSeq = msg.seq;
        this.pendingMoves = this.pendingMoves.filter((m) => m.seq > msg.seq);

        // Re-apply pending moves from server position
        this.localWorldX = msg.position.x;
        this.localWorldY = msg.position.y;
        const replayZoneMeta = ZONE_METADATA[this.currentZone];
        for (const pm of this.pendingMoves) {
          const speed = CLASS_STATS[this.classType].speed;
          const dt = TICK_INTERVAL / 1000;
          this.localWorldX = Math.max(1, Math.min(replayZoneMeta.width - 2, this.localWorldX + pm.dx * speed * dt));
          this.localWorldY = Math.max(1, Math.min(replayZoneMeta.height - 2, this.localWorldY + pm.dy * speed * dt));
        }
        if (this.localPlayer) {
          this.localPlayer.setWorldPosition(this.localWorldX, this.localWorldY);
        }
      } else {
        const pe = this.players.get(msg.playerId);
        if (pe) {
          pe.updateFromState({
            id: msg.playerId,
            position: msg.position,
          } as PlayerState);
        }
      }
    });

    this.net.on(ServerMessageType.MobMoved, (msg: MobMovedMessage) => {
      const me = this.mobs.get(msg.mobId);
      if (me) {
        me.updateFromState({
          id: msg.mobId,
          position: msg.position,
        } as MobState);
      }
    });

    this.net.on(ServerMessageType.DamageDealt, (msg: DamageDealtMessage) => {
      const evt = msg.event;
      // Find entity for floating text
      const targetEntity = this.players.get(evt.targetId) || this.mobs.get(evt.targetId);
      if (targetEntity) {
        const sx = targetEntity.sprite.x;
        const sy = targetEntity.sprite.y;
        if (evt.isDodge) {
          FloatingText.spawn(this, sx, sy - 16, 'Dodge!', '#ffffff', 18);
        } else if (evt.isMiss) {
          FloatingText.spawn(this, sx, sy - 16, 'Miss!', '#aaaaaa', 18);
        } else if (evt.isHeal) {
          FloatingText.spawn(this, sx, sy - 16, `+${evt.amount}`, '#44ff44', evt.isCrit ? 22 : 16);
          if (evt.targetId === this.playerId) {
            SoundManager.instance.playHeal();
          }
        } else {
          const color = evt.isCrit ? '#ffff00' : '#ff4444';
          FloatingText.spawn(this, sx, sy - 16, `${evt.amount}`, color, evt.isCrit ? 22 : 16);
          if (evt.sourceId === this.playerId) {
            SoundManager.instance.playHit();
          }
          if (this.mobs.has(evt.targetId)) {
            SoundManager.instance.playMobHit();
          }
        }
      }
    });

    this.net.on(ServerMessageType.EntityDied, (msg: EntityDiedMessage) => {
      if (msg.entityId === this.playerId) {
        SoundManager.instance.playDeath();
      }
    });

    this.net.on(ServerMessageType.EntityRespawned, (msg: EntityRespawnedMessage) => {
      const pe = this.players.get(msg.entityId);
      if (pe) {
        pe.setDead(false);
        if (msg.entityId === this.playerId) {
          this.localWorldX = msg.position.x;
          this.localWorldY = msg.position.y;
          pe.setWorldPosition(msg.position.x, msg.position.y);
        }
      }
      const me = this.mobs.get(msg.entityId);
      if (me) {
        me.setDead(false);
      }
    });

    this.net.on(ServerMessageType.AbilityCast, (msg: AbilityCastMessage) => {
      SoundManager.instance.playAbility();

      // Resolve caster / target screen positions for VFX
      const casterEntity = this.players.get(msg.casterId) || this.mobs.get(msg.casterId);
      if (casterEntity) {
        const cx = casterEntity.sprite.x;
        const cy = casterEntity.sprite.y;
        let tx: number | undefined;
        let ty: number | undefined;
        if (msg.targetId) {
          const targetEntity = this.players.get(msg.targetId) || this.mobs.get(msg.targetId);
          if (targetEntity) {
            tx = targetEntity.sprite.x;
            ty = targetEntity.sprite.y;
          }
        }
        VFXManager.instance.playAbilityEffect(msg.abilityId, cx, cy, tx, ty);
      }

      if (msg.casterId === this.playerId) {
        SoundManager.instance.playCast();
        const abilities = CLASS_ABILITIES[this.classType];
        const ab = abilities.find((a) => a.id === msg.abilityId);
        if (ab && ab.castTime > 0) {
          this.events.emit('startCast', ab.name, ab.castTime * 1000);
        }
      }
    });

    this.net.on(ServerMessageType.CooldownUpdate, (msg: CooldownUpdateMessage) => {
      this.events.emit('updateCooldowns', msg.cooldowns);
    });

    this.net.on(ServerMessageType.LevelUp, (msg: LevelUpMessage) => {
      if (msg.playerId === this.playerId && this.localPlayer) {
        const sx = this.localPlayer.sprite.x;
        const sy = this.localPlayer.sprite.y;
        FloatingText.spawn(this, sx, sy - 32, 'Level Up!', '#ffcc00', 24);
        SoundManager.instance.playLevelUp();
        this.events.emit('levelUp', msg.newLevel);
      }
      // Update nametag for any player who leveled
      const pe = this.players.get(msg.playerId);
      if (pe) {
        pe.setLevel(msg.newLevel);
      }
    });

    this.net.on(ServerMessageType.ChatReceived, (msg: ChatReceivedMessage) => {
      this.events.emit('chatMessage', msg.message);
    });

    this.net.on(ServerMessageType.BuffApplied, (msg: BuffAppliedMessage) => {
      // Update visual tint for buff/debuff
      const pe = this.players.get(msg.entityId);
      if (pe) pe.updateBuffVisuals(msg.buff);
      const me = this.mobs.get(msg.entityId);
      if (me) me.updateBuffVisuals(msg.buff);
    });

    this.net.on(ServerMessageType.BuffRemoved, (msg: BuffRemovedMessage) => {
      const pe = this.players.get(msg.entityId);
      if (pe) pe.removeBuffVisual(msg.buffId);
      const me = this.mobs.get(msg.entityId);
      if (me) me.removeBuffVisual(msg.buffId);
    });

    this.net.on(ServerMessageType.PlayerJoined, (_msg: unknown) => {
      // Handled in WorldState
    });

    this.net.on(ServerMessageType.PlayerLeft, (_msg: unknown) => {
      // Handled in WorldState
    });

    this.net.on(ServerMessageType.Error, (msg: { message: string }) => {
      console.error('[Server Error]', msg.message);
      this.events.emit('showErrorMessage', msg.message);
    });

    this.net.on(ServerMessageType.InventoryUpdate, (msg: InventoryUpdateMessage) => {
      this.events.emit('inventoryUpdated', msg.inventory);
    });

    this.net.on(ServerMessageType.LootSpawned, (msg: LootSpawnedMessage) => {
      this.worldLoots.set(msg.loot.id, msg.loot);
      this.createLootSprite(msg.loot);
    });

    this.net.on(ServerMessageType.LootDespawned, (msg: LootDespawnedMessage) => {
      this.worldLoots.delete(msg.lootId);
      this.removeLootSprite(msg.lootId);
      this.events.emit('lootDespawned', msg.lootId);
    });

    this.net.on(ServerMessageType.LootPickedUp, (msg: LootPickedUpMessage) => {
      const loot = this.worldLoots.get(msg.lootId);
      if (loot) {
        this.events.emit('lootItemRemoved', msg.lootId, msg.itemIndex);
        // LootWindow.removeItem() owns the splice on the shared items array
        if (loot.items.length === 0) {
          this.worldLoots.delete(msg.lootId);
          this.removeLootSprite(msg.lootId);
        }
      }
    });

    this.net.on(ServerMessageType.ZoneChanged, (msg: ZoneChangedMessage) => {
      this.handleZoneChange(msg);
    });

    this.net.on(ServerMessageType.ConsumableUsed, (msg: { playerId: string; itemId: string; effectType: 'heal' | 'mana' | 'teleport' | 'buff'; value: number }) => {
      const player = this.players.get(msg.playerId);
      if (player) {
        VFXManager.instance.playConsumableEffect(msg.effectType, player.sprite.x, player.sprite.y);
      }
    });

    this.net.on(ServerMessageType.PotionCooldownUpdate, (msg: { cooldownState: { sharedCooldownMs: number; itemCooldowns: Record<string, number> } }) => {
      this.events.emit('potionCooldownUpdate', msg.cooldownState);
    });

    this.net.on(ServerMessageType.EquipmentUpdate, (msg: EquipmentUpdateMessage) => {
      this.events.emit('equipmentUpdate', msg.equipment);
    });

    // NPC & Quest handlers
    this.net.on(ServerMessageType.NPCList, (msg: NPCListMessage) => {
      // Clear existing NPCs
      for (const npc of this.npcs.values()) {
        npc.destroy();
      }
      this.npcs.clear();

      // Spawn NPCs
      for (const npcData of msg.npcs) {
        const npc = new NpcEntity(
          this,
          npcData.id,
          npcData.position.x,
          npcData.position.y,
          npcData.hasQuest,
          npcData.questReady
        );
        this.npcs.set(npcData.id, npc);
      }
    });

    this.net.on(ServerMessageType.NPCDialogue, (msg: NPCDialogueMessage) => {
      this.events.emit('npcDialogue', msg);
    });

    this.net.on(ServerMessageType.QuestUpdate, (msg: QuestUpdateMessage) => {
      this.events.emit('questUpdate', msg);
    });

    this.net.on(ServerMessageType.QuestCompleted, (msg: QuestCompletedMessage) => {
      this.events.emit('questCompleted', msg);
    });
  }

  private registerInputHandlers(): void {
    this.events.on('requestStopMove', (seq: number) => {
      this.net.send({
        type: ClientMessageType.StopMove,
        position: { x: this.localWorldX, y: this.localWorldY },
        seq,
      });
    });

    this.events.on('abilityKey', (index: number) => {
      const abilities = CLASS_ABILITIES[this.classType];
      if (index < abilities.length) {
        this.net.send({
          type: ClientMessageType.UseAbility,
          abilityId: abilities[index].id,
          targetId: this.selectedTargetId,
          targetPosition: null,
        });
        this.events.emit('abilityUsed');
      }
    });

    this.events.on('toggleChat', () => {
      this.events.emit('toggleChatPanel');
    });

    this.events.on('toggleEscMenu', () => {
      this.events.emit('toggleGameMenu');
    });

    this.events.on('menuStateChanged', (open: boolean) => {
      this.inputSystem.menuOpen = open;
    });
  }

  private selectTarget(id: string | null): void {
    this.selectedTargetId = id;

    this.net.send({
      type: ClientMessageType.SelectTarget,
      targetId: id,
    });

    if (id) {
      this.events.emit('targetSelected');
      const pe = this.players.get(id);
      if (pe) {
        this.events.emit('showTarget', pe.nameTag.text, 0, 0);
      }
      const me = this.mobs.get(id);
      if (me) {
        this.events.emit('showTarget', me.nameTag.text, 0, 0);
      }
    } else {
      this.events.emit('hideTarget');
    }

    this.events.emit('targetChanged', id);
  }

  private loadMap(data: MapData): void {
    this.mapData = data;
    this.tileLayer.removeAll(true);
    this.clearPortals();

    const zoneMetadata = ZONE_METADATA[this.currentZone];
    const tilePalette = zoneMetadata.tilePalette;

    for (let row = 0; row < data.height; row++) {
      for (let col = 0; col < data.width; col++) {
        const tileType = data.tiles[row]?.[col] ?? TileType.Grass;
        const screen = worldToScreen(col, row);

        const tileTexture = `tile-${tilePalette}-${tileType}`;
        const tile = this.add.image(screen.x, screen.y, tileTexture);
        tile.setOrigin(0.5, 0.5);
        tile.setDepth(getDepthForPosition(col, row) - 1000);
        this.tileLayer.add(tile);
      }
    }

    this.renderPortals();
    this.events.emit('mapLoaded', data);
    this.events.emit('zoneChanged', zoneMetadata.name);
  }

  /** Current entity snapshots for HUD/minimap consumption. */
  getMinimapData(): {
    playerId: string | null;
    players: Array<{ id: string; x: number; y: number }>;
    mobs: Array<{ x: number; y: number }>;
  } {
    const players: Array<{ id: string; x: number; y: number }> = [];
    for (const [id, pe] of this.players) {
      if (pe.isDead) continue;
      const x = id === this.playerId ? this.localWorldX : pe.worldX;
      const y = id === this.playerId ? this.localWorldY : pe.worldY;
      players.push({ id, x, y });
    }

    const mobs: Array<{ x: number; y: number }> = [];
    for (const me of this.mobs.values()) {
      if (me.isDead) continue;
      mobs.push({ x: me.worldX, y: me.worldY });
    }

    return { playerId: this.playerId, players, mobs };
  }

  private createOrUpdatePlayer(state: PlayerState, isLocal: boolean): void {
    let pe = this.players.get(state.id);
    if (pe) {
      pe.updateFromState(state);
    } else {
      pe = new PlayerEntity(this, state, isLocal);
      this.players.set(state.id, pe);
    }
    if (isLocal) {
      this.localPlayer = pe;
    }
  }

  private createMob(state: MobState): void {
    const me = new MobEntity(this, state);
    this.mobs.set(state.id, me);
  }

  private createLootSprite(loot: WorldLoot): void {
    const screenPos = worldToScreen(loot.position.x, loot.position.y);

    const container = this.add.container(screenPos.x, screenPos.y);

    const gfx = this.add.graphics();
    gfx.fillStyle(0xe0c070, 0.6);
    gfx.fillCircle(0, 0, 12);
    gfx.lineStyle(2, 0xffd700, 0.8);
    gfx.strokeCircle(0, 0, 12);
    container.add(gfx);

    const icon = this.add.text(0, 0, '💰', { fontSize: '16px' }).setOrigin(0.5);
    container.add(icon);

    this.tweens.add({
      targets: container,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const hitZone = this.add.zone(0, 0, 32, 32).setInteractive({ useHandCursor: true });
    hitZone.on('pointerdown', () => {
      this.events.emit('showLoot', loot);
    });
    container.add(hitZone);

    container.setDepth(5);
    this.lootSprites.set(loot.id, container);
  }

  private removeLootSprite(lootId: string): void {
    const sprite = this.lootSprites.get(lootId);
    if (sprite) {
      sprite.destroy();
      this.lootSprites.delete(lootId);
    }
  }

  private renderPortals(): void {
    const portals = ZONE_PORTALS[this.currentZone] || [];

    for (const portal of portals) {
      const screen = worldToScreen(portal.position.x, portal.position.y);
      const portalKey = `${portal.position.x},${portal.position.y}`;

      const gfx = this.add.graphics();
      gfx.setDepth(getDepthForPosition(portal.position.x, portal.position.y) + 500);

      const pulseAnim = this.tweens.addCounter({
        from: 0,
        to: 1,
        duration: 2000,
        repeat: -1,
        yoyo: true,
        onUpdate: (tween) => {
          const value = tween.getValue() ?? 0;
          const radius = 16 + value * 6;
          const alpha = 0.4 + value * 0.3;

          gfx.clear();
          gfx.fillStyle(0x00ffff, alpha);
          gfx.fillCircle(screen.x, screen.y, radius);
          gfx.lineStyle(3, 0x44ddff, 0.8);
          gfx.strokeCircle(screen.x, screen.y, radius);
        },
      });

      const hitZone = this.add.zone(screen.x, screen.y, 48, 48);
      hitZone.setInteractive({ useHandCursor: true });
      hitZone.setDepth(getDepthForPosition(portal.position.x, portal.position.y) + 501);

      const targetZoneMeta = ZONE_METADATA[portal.targetZone];
      const tooltipText = `Portal to ${targetZoneMeta.name}`;

      hitZone.on('pointerover', () => {
        this.events.emit('showTooltip', tooltipText, screen.x, screen.y - 40);
      });

      hitZone.on('pointerout', () => {
        this.events.emit('hideTooltip');
      });

      hitZone.on('pointerdown', () => {
        this.net.send({
          type: ClientMessageType.UsePortal,
          targetZone: portal.targetZone,
        });
      });

      this.portalSprites.set(portalKey, gfx);
      gfx.setData('pulseAnim', pulseAnim);
      gfx.setData('hitZone', hitZone);
    }
  }

  private clearPortals(): void {
    for (const [key, gfx] of this.portalSprites) {
      const pulseAnim = gfx.getData('pulseAnim');
      const hitZone = gfx.getData('hitZone');
      if (pulseAnim) pulseAnim.destroy();
      if (hitZone) hitZone.destroy();
      gfx.destroy();
    }
    this.portalSprites.clear();
  }

  private handleZoneChange(msg: ZoneChangedMessage): void {
    this.showZoneTransition(msg.newZone, () => {
      this.currentZone = msg.newZone;
      this.localWorldX = msg.playerPosition.x;
      this.localWorldY = msg.playerPosition.y;

      this.clearEntities();
      this.selectedTargetId = null;
      this.events.emit('hideTarget');

      this.loadMap(msg.mapData);

      if (this.localPlayer) {
        this.localPlayer.setWorldPosition(msg.playerPosition.x, msg.playerPosition.y);
      }

      const zoneMeta = ZONE_METADATA[msg.newZone];
      this.cameraSystem.updateBounds(zoneMeta.width, zoneMeta.height);
      const screen = worldToScreen(msg.playerPosition.x, msg.playerPosition.y);
      this.cameraSystem.snapTo(screen.x, screen.y);
    });
  }

  private clearEntities(): void {
    for (const pe of this.players.values()) {
      if (pe !== this.localPlayer) {
        pe.destroy();
      }
    }
    this.players.clear();
    if (this.localPlayer && this.playerId) {
      this.players.set(this.playerId, this.localPlayer);
    }

    for (const me of this.mobs.values()) {
      me.destroy();
    }
    this.mobs.clear();

    for (const lootId of this.lootSprites.keys()) {
      this.removeLootSprite(lootId);
    }
    this.worldLoots.clear();
  }

  private showZoneTransition(newZone: ZoneId, onComplete: () => void): void {
    const zoneMetadata = ZONE_METADATA[newZone];
    const overlay = this.add.rectangle(640, 360, 1280, 720, 0x000000, 0);
    overlay.setDepth(20000);

    const zoneName = this.add.text(640, 340, zoneMetadata.name, {
      fontFamily: 'monospace',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    });
    zoneName.setOrigin(0.5);
    zoneName.setAlpha(0);
    zoneName.setDepth(20001);

    const subtitle = this.add.text(640, 380, `Level ${zoneMetadata.levelRange[0]}-${zoneMetadata.levelRange[1]}`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 3,
    });
    subtitle.setOrigin(0.5);
    subtitle.setAlpha(0);
    subtitle.setDepth(20001);

    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 500,
      onComplete: () => {
        this.tweens.add({
          targets: [zoneName, subtitle],
          alpha: 1,
          duration: 300,
          onComplete: () => {
            onComplete();
            this.time.delayedCall(1200, () => {
              this.tweens.add({
                targets: [zoneName, subtitle, overlay],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                  overlay.destroy();
                  zoneName.destroy();
                  subtitle.destroy();
                },
              });
            });
          },
        });
      },
    });
  }

  update(_time: number, delta: number): void {
    this.inputSystem.update();

    // Client-side prediction for local player movement
    const dir = this.inputSystem.getMovementDirection();
    if ((dir.x !== 0 || dir.y !== 0) && this.localPlayer) {
      const speed = CLASS_STATS[this.classType].speed;
      const dt = delta / 1000;
      const zoneMeta = ZONE_METADATA[this.currentZone];
      this.localWorldX = Math.max(1, Math.min(zoneMeta.width - 2, this.localWorldX + dir.x * speed * dt));
      this.localWorldY = Math.max(1, Math.min(zoneMeta.height - 2, this.localWorldY + dir.y * speed * dt));
      this.localPlayer.setWorldPosition(this.localWorldX, this.localWorldY);

      this.pendingMoves.push({
        seq: this.inputSystem.currentSeq,
        dx: dir.x,
        dy: dir.y,
      });
    }

    // Update all entities
    for (const pe of this.players.values()) {
      pe.update(delta);
    }
    for (const me of this.mobs.values()) {
      me.update(delta);
    }

    // Camera follow local player
    if (this.localPlayer) {
      const screen = worldToScreen(this.localWorldX, this.localWorldY);
      this.cameraSystem.setTarget(screen.x, screen.y);
    }
    this.cameraSystem.update();
  }
}
