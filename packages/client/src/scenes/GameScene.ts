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
  type WorldLoot,
} from '@isoheim/shared';
import { NetworkManager } from '../network/NetworkManager';
import { InputSystem } from '../systems/InputSystem';
import { CameraSystem } from '../systems/CameraSystem';
import { PlayerEntity } from '../entities/PlayerEntity';
import { MobEntity } from '../entities/MobEntity';
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

  private players = new Map<string, PlayerEntity>();
  private mobs = new Map<string, MobEntity>();

  private selectedTargetId: string | null = null;

  private worldLoots = new Map<string, WorldLoot>();
  private lootSprites = new Map<string, Phaser.GameObjects.Container>();

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
        if (entityId) {
          this.selectTarget(entityId);
          foundEntity = true;
          break;
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

    // Signal game is ready for tutorial
    this.events.emit('gameReady');
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
        for (const pm of this.pendingMoves) {
          const speed = CLASS_STATS[this.classType].speed;
          const dt = TICK_INTERVAL / 1000;
          this.localWorldX += pm.dx * speed * dt;
          this.localWorldY += pm.dy * speed * dt;
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
        loot.items.splice(msg.itemIndex, 1);
        if (loot.items.length === 0) {
          this.worldLoots.delete(msg.lootId);
          this.removeLootSprite(msg.lootId);
        }
      }
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

    for (let row = 0; row < data.height; row++) {
      for (let col = 0; col < data.width; col++) {
        const tileType = data.tiles[row]?.[col] ?? TileType.Grass;
        const screen = worldToScreen(col, row);

        const tile = this.add.image(screen.x, screen.y, `tile-${tileType}`);
        tile.setOrigin(0.5, 0.5);
        tile.setDepth(getDepthForPosition(col, row) - 1000);
        this.tileLayer.add(tile);
      }
    }

    this.events.emit('mapLoaded', data);
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
      if (isLocal) {
        this.localPlayer = pe;
      }
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

  update(_time: number, delta: number): void {
    this.inputSystem.update();

    // Client-side prediction for local player movement
    const dir = this.inputSystem.getMovementDirection();
    if ((dir.x !== 0 || dir.y !== 0) && this.localPlayer) {
      const speed = CLASS_STATS[this.classType].speed;
      const dt = delta / 1000;
      this.localWorldX += dir.x * speed * dt;
      this.localWorldY += dir.y * speed * dt;
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
