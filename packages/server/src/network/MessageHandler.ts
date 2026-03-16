import {
  ClientMessage,
  ClientMessageType,
  ServerMessageType,
  ChatChannel,
  ClassType,
  PickupItemMessage,
  DropItemMessage,
  MoveItemMessage,
  UseItemMessage,
  ITEM_DATABASE,
  LOOT_PICKUP_RANGE,
  distance,
  generateId,
  WorldLoot,
} from '@isoheim/shared';
import { Player } from '../entities/Player.js';
import { World } from '../core/World.js';
import { NetworkManager } from './NetworkManager.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { ChatSystem } from '../systems/ChatSystem.js';
import { LootSystem } from '../systems/LootSystem.js';
import { AuthManager } from '../auth/AuthManager.js';
import { Database } from '../database/Database.js';

export class MessageHandler {
  private world: World;
  private network: NetworkManager;
  private movementSystem: MovementSystem;
  private combatSystem: CombatSystem;
  private chatSystem: ChatSystem;
  private lootSystem: LootSystem;
  private authManager: AuthManager;
  private db: Database;

  /** Map session id → player id (they're the same in our case) */
  private sessions: Map<string, string> = new Map();

  constructor(
    world: World,
    network: NetworkManager,
    movementSystem: MovementSystem,
    combatSystem: CombatSystem,
    chatSystem: ChatSystem,
    lootSystem: LootSystem,
    authManager: AuthManager,
    db: Database,
  ) {
    this.world = world;
    this.network = network;
    this.movementSystem = movementSystem;
    this.combatSystem = combatSystem;
    this.chatSystem = chatSystem;
    this.lootSystem = lootSystem;
    this.authManager = authManager;
    this.db = db;
  }

  handleMessage(sessionId: string, message: ClientMessage): void {
    // ── Auth messages (no character required) ──────────────
    switch (message.type) {
      case ClientMessageType.Register:
        this.handleRegister(sessionId, message.username, message.password);
        return;

      case ClientMessageType.Login:
        this.handleLogin(sessionId, message.username, message.password);
        return;

      case ClientMessageType.CreateCharacter:
        this.handleCreateCharacter(sessionId, message.name, message.classType);
        return;

      case ClientMessageType.SelectCharacter:
        this.handleSelectCharacter(sessionId, message.characterId);
        return;

      case ClientMessageType.DeleteCharacter:
        this.handleDeleteCharacter(sessionId, message.characterId);
        return;

      case ClientMessageType.Logout:
        this.handleLogout(sessionId);
        return;
    }

    // ── Game messages (require selected character) ─────────
    if (!this.authManager.hasSelectedCharacter(sessionId)) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'You must select a character first',
      });
      return;
    }

    switch (message.type) {
      case ClientMessageType.Join:
        // Legacy: ignored when auth is active — use SelectCharacter
        break;

      case ClientMessageType.Move:
        this.handleMove(sessionId, message.direction, message.seq);
        break;

      case ClientMessageType.StopMove:
        this.handleStopMove(sessionId, message.position, message.seq);
        break;

      case ClientMessageType.Attack:
        this.handleAttack(sessionId, message.targetId);
        break;

      case ClientMessageType.UseAbility:
        this.handleUseAbility(sessionId, message.abilityId, message.targetId);
        break;

      case ClientMessageType.SelectTarget:
        this.handleSelectTarget(sessionId, message.targetId);
        break;

      case ClientMessageType.Chat:
        this.handleChat(sessionId, message.channel, message.content);
        break;

      case ClientMessageType.Ping:
        this.network.sendToPlayer(sessionId, {
          type: ServerMessageType.Pong,
          timestamp: message.timestamp,
          serverTime: Date.now(),
        });
        break;

      case ClientMessageType.PickupItem:
        this.handlePickupItem(sessionId, message as PickupItemMessage);
        break;

      case ClientMessageType.DropItem:
        this.handleDropItem(sessionId, message as DropItemMessage);
        break;

      case ClientMessageType.MoveItem:
        this.handleMoveItem(sessionId, message as MoveItemMessage);
        break;

      case ClientMessageType.UseItem:
        this.handleUseItem(sessionId, message as UseItemMessage);
        break;
    }
  }

  // ── Auth handlers ──────────────────────────────────────

  private handleRegister(sessionId: string, username: string, password: string): void {
    const result = this.authManager.register(username, password);
    if (result.success) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.RegisterSuccess,
      });
      console.log(`[Auth] Account registered: ${username}`);
    } else {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.RegisterFailed,
        reason: result.error!,
      });
    }
  }

  private handleLogin(sessionId: string, username: string, password: string): void {
    const result = this.authManager.login(sessionId, username, password);
    if (result.success) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.LoginSuccess,
        accountId: result.accountId!,
        characters: result.characters!,
      });
      console.log(`[Auth] Login: ${username} [${sessionId}]`);
    } else {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.LoginFailed,
        reason: result.error!,
      });
    }
  }

  private handleCreateCharacter(sessionId: string, name: string, classType: ClassType): void {
    if (!this.authManager.isAuthenticated(sessionId)) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.CharacterCreateFailed,
        reason: 'Not authenticated',
      });
      return;
    }

    const result = this.authManager.createCharacter(sessionId, name, classType);
    if (result.success) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.CharacterCreated,
        character: result.character!,
      });
      console.log(`[Auth] Character created: ${name} (${classType}) [${sessionId}]`);
    } else {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.CharacterCreateFailed,
        reason: result.error!,
      });
    }
  }

  private handleSelectCharacter(sessionId: string, characterId: string): void {
    if (!this.authManager.isAuthenticated(sessionId)) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Not authenticated',
      });
      return;
    }

    // Prevent double-select
    if (this.sessions.has(sessionId)) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Character already selected',
      });
      return;
    }

    const charInfo = this.authManager.selectCharacter(sessionId, characterId);
    if (!charInfo) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Character not found',
      });
      return;
    }

    const player = Player.fromCharacterInfo(sessionId, charInfo);
    player.inventory = this.db.loadInventory(charInfo.id);
    this.sessions.set(sessionId, player.id);
    this.world.addPlayer(player);

    // Send welcome with map data
    this.network.sendToPlayer(sessionId, {
      type: ServerMessageType.Welcome,
      playerId: player.id,
      player: player.toState(),
      mapData: this.world.mapData,
    });

    // Send initial inventory
    this.sendInventoryUpdate(sessionId, player);

    // Send current loot on the ground
    for (const loot of this.world.loots.values()) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.LootSpawned,
        loot,
      });
    }

    // Broadcast to others
    this.network.broadcastToAll({
      type: ServerMessageType.PlayerJoined,
      player: player.toState(),
    });

    this.chatSystem.sendSystemMessage(`${player.name} has joined the game.`, this.world);
    console.log(`[Game] Character selected: ${charInfo.name} (${charInfo.classType}) [${sessionId}]`);
  }

  private handleDeleteCharacter(sessionId: string, characterId: string): void {
    if (!this.authManager.isAuthenticated(sessionId)) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Not authenticated',
      });
      return;
    }

    const result = this.authManager.deleteCharacter(sessionId, characterId);
    if (result.success) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.CharacterDeleted,
        characterId,
      });
      console.log(`[Auth] Character deleted: ${characterId} [${sessionId}]`);
    } else {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: result.error!,
      });
    }
  }

  private handleLogout(sessionId: string): void {
    this.saveAndRemovePlayer(sessionId);
    this.authManager.logout(sessionId);
    console.log(`[Auth] Logout [${sessionId}]`);
  }

  // ── Game handlers ──────────────────────────────────────

  private handleMove(sessionId: string, direction: { x: number; y: number }, seq: number): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    player.moveDirection = direction;
    player.lastMoveSeq = seq;
  }

  private handleStopMove(sessionId: string, position: { x: number; y: number }, seq: number): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    player.moveDirection = null;
    player.lastMoveSeq = seq;
  }

  private handleAttack(sessionId: string, targetId: string): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    player.targetId = targetId;
  }

  private handleUseAbility(sessionId: string, abilityId: string, targetId: string | null): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    this.combatSystem.processAbility(player, abilityId, targetId, this.world, Date.now());
  }

  private handleSelectTarget(sessionId: string, targetId: string | null): void {
    const player = this.world.getPlayer(sessionId);
    if (!player) return;

    player.targetId = targetId;
  }

  private handleChat(sessionId: string, channel: ChatChannel, content: string): void {
    const player = this.world.getPlayer(sessionId);
    if (!player) return;

    this.chatSystem.handleChat(player, channel, content, this.world);
  }

  // ── Item handlers ─────────────────────────────────────────

  private handlePickupItem(sessionId: string, msg: PickupItemMessage): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    const loot = this.world.loots.get(msg.lootId);
    if (!loot) return;

    // Range check
    const dist = distance(player.position, loot.position);
    if (dist > LOOT_PICKUP_RANGE) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Too far away',
      });
      return;
    }

    // Inventory space check
    if (player.isInventoryFull()) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Inventory is full',
      });
      return;
    }

    const item = this.lootSystem.pickupItem(this.world, player.id, msg.lootId, msg.itemIndex);
    if (!item) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Cannot pick up that item',
      });
      return;
    }

    player.addToInventory(item.itemId, item.quantity);
    this.sendInventoryUpdate(sessionId, player);
  }

  private handleDropItem(sessionId: string, msg: DropItemMessage): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    const removed = player.removeFromInventory(msg.slot);
    if (!removed) return;

    // Create world loot at player position
    const loot: WorldLoot = {
      id: generateId(),
      position: { x: player.position.x, y: player.position.y },
      items: [{ itemId: removed.itemId, quantity: removed.quantity }],
      killerId: player.id,
      killerOnlyUntil: 0, // anyone can pick up dropped items
      expiresAt: Date.now() + 60_000,
    };

    this.world.addLoot(loot);
    this.network.broadcastToAll({
      type: ServerMessageType.LootSpawned,
      loot,
    });

    this.sendInventoryUpdate(sessionId, player);
  }

  private handleMoveItem(sessionId: string, msg: MoveItemMessage): void {
    const player = this.world.getPlayer(sessionId);
    if (!player) return;

    const moved = player.moveInventoryItem(msg.fromSlot, msg.toSlot);
    if (moved) {
      this.sendInventoryUpdate(sessionId, player);
    }
  }

  private handleUseItem(sessionId: string, msg: UseItemMessage): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    const invItem = player.inventory.find(i => i.slot === msg.slot);
    if (!invItem) return;

    const itemDef = ITEM_DATABASE[invItem.itemId];
    if (!itemDef || !itemDef.useEffect) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'This item cannot be used',
      });
      return;
    }

    const effect = itemDef.useEffect;
    if (effect.type === 'heal') {
      const event = player.heal(effect.value, player.id);
      this.network.broadcastToAll({
        type: ServerMessageType.DamageDealt,
        event,
      });
    } else if (effect.type === 'mana') {
      player.mana = Math.min(player.maxMana, player.mana + effect.value);
    }

    // Consume one from stack
    player.removeFromInventory(msg.slot, 1);
    this.sendInventoryUpdate(sessionId, player);
  }

  private sendInventoryUpdate(sessionId: string, player: Player): void {
    this.network.sendToPlayer(sessionId, {
      type: ServerMessageType.InventoryUpdate,
      inventory: player.inventory,
    });
  }

  // ── Disconnect / Save helpers ──────────────────────────

  /** Save player state to DB and remove from world */
  private saveAndRemovePlayer(sessionId: string): void {
    const player = this.world.getPlayer(sessionId);
    if (player && player.characterId) {
      this.db.saveCharacter(player.toCharacterSaveData());
      this.db.saveInventory(player.characterId, player.inventory);
    }

    const removed = this.world.removePlayer(sessionId);
    if (removed) {
      this.sessions.delete(sessionId);
      this.chatSystem.removePlayer(sessionId);

      this.network.broadcastToAll({
        type: ServerMessageType.PlayerLeft,
        playerId: sessionId,
      });

      this.chatSystem.sendSystemMessage(`${removed.name} has left the game.`, this.world);
      console.log(`[Game] Player left: ${removed.name} [${sessionId}]`);
    }
  }

  handleDisconnect(sessionId: string): void {
    this.saveAndRemovePlayer(sessionId);
    this.authManager.logout(sessionId);
  }

  /** Save all online players (called periodically and on shutdown) */
  saveAllPlayers(): void {
    for (const player of this.world.players.values()) {
      if (player.characterId) {
        this.db.saveCharacter(player.toCharacterSaveData());
        this.db.saveInventory(player.characterId, player.inventory);
      }
    }
  }
}
