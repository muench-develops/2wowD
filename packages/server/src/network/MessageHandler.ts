import {
  ClientMessage,
  ClientMessageType,
  ServerMessageType,
  ChatChannel,
  ClassType,
  QuestState,
  PickupItemMessage,
  DropItemMessage,
  MoveItemMessage,
  UseItemMessage,
  EquipItemMessage,
  UnequipItemMessage,
  InteractNPCMessage,
  AcceptQuestMessage,
  AbandonQuestMessage,
  TurnInQuestMessage,
  ZoneId,
  NpcId,
  ITEM_DATABASE,
  LOOT_PICKUP_RANGE,
  PORTAL_USE_RANGE,
  NPC_INTERACTION_RANGE,
  NPC_DEFINITIONS,
  QUEST_DEFINITIONS,
  POTION_SHARED_COOLDOWN_MS,
  BANDAGE_COOLDOWN_MS,
  TP_SCROLL_COOLDOWN_MS,
  BANDAGE_HOT_DURATION_MS,
  BANDAGE_HOT_TOTAL_PERCENT,
  TICK_INTERVAL,
  ZONE_PLAYER_SPAWNS,
  distance,
  generateId,
  WorldLoot,
} from '@isoheim/shared';
import { Player } from '../entities/Player.js';
import { Npc } from '../entities/Npc.js';
import { World } from '../core/World.js';
import { NetworkManager } from './NetworkManager.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { ChatSystem } from '../systems/ChatSystem.js';
import { LootSystem } from '../systems/LootSystem.js';
import { QuestManager } from '../systems/QuestManager.js';
import { AuthManager } from '../auth/AuthManager.js';
import { Database } from '../database/Database.js';

export class MessageHandler {
  private world: World;
  private network: NetworkManager;
  private movementSystem: MovementSystem;
  private combatSystem: CombatSystem;
  private chatSystem: ChatSystem;
  private lootSystem: LootSystem;
  private questManager: QuestManager;
  private authManager: AuthManager;
  private db: Database;

  /** Map session id → player id (they're the same in our case) */
  private sessions: Map<string, string> = new Map();

  /** NPC instances keyed by NpcId */
  private npcs: Map<NpcId, Npc> = new Map();

  constructor(
    world: World,
    network: NetworkManager,
    movementSystem: MovementSystem,
    combatSystem: CombatSystem,
    chatSystem: ChatSystem,
    lootSystem: LootSystem,
    questManager: QuestManager,
    authManager: AuthManager,
    db: Database,
  ) {
    this.world = world;
    this.network = network;
    this.movementSystem = movementSystem;
    this.combatSystem = combatSystem;
    this.chatSystem = chatSystem;
    this.lootSystem = lootSystem;
    this.questManager = questManager;
    this.authManager = authManager;
    this.db = db;

    // Initialize NPC instances
    for (const npcId of Object.values(NpcId)) {
      this.npcs.set(npcId, new Npc(npcId));
    }
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

      case ClientMessageType.TutorialComplete:
        this.handleTutorialComplete(sessionId);
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

      case ClientMessageType.EquipItem:
        this.handleEquipItem(sessionId, message as EquipItemMessage);
        break;

      case ClientMessageType.UnequipItem:
        this.handleUnequipItem(sessionId, message as UnequipItemMessage);
        break;

      case ClientMessageType.UsePortal:
        this.handleUsePortal(sessionId, message.targetZone);
        break;

      case ClientMessageType.InteractNPC:
        this.handleInteractNPC(sessionId, message as InteractNPCMessage);
        break;

      case ClientMessageType.AcceptQuest:
        this.handleAcceptQuest(sessionId, message as AcceptQuestMessage);
        break;

      case ClientMessageType.AbandonQuest:
        this.handleAbandonQuest(sessionId, message as AbandonQuestMessage);
        break;

      case ClientMessageType.TurnInQuest:
        this.handleTurnInQuest(sessionId, message as TurnInQuestMessage);
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
    const savedEquipment = this.db.loadEquipment(charInfo.id);
    if (savedEquipment) {
      for (const [slot, itemId] of savedEquipment.entries()) {
        player.equipment.set(slot, itemId);
      }
    }
    this.sessions.set(sessionId, player.id);
    this.world.addPlayer(player);

    // Load quest progress
    const savedQuests = this.db.loadQuestProgress(charInfo.id);
    this.questManager.initPlayer(player.id, savedQuests);

    // Get map data for player's current zone
    const playerZone = this.world.zoneManager.getZone(player.currentZone);
    const mapData = playerZone ? playerZone.mapData : this.world.mapData;

    // Get tutorial completion status
    const tutorialComplete = this.db.isTutorialComplete(charInfo.id);

    // Send welcome with map data
    this.network.sendToPlayer(sessionId, {
      type: ServerMessageType.Welcome,
      playerId: player.id,
      player: player.toState(),
      mapData,
      tutorialComplete,
    });

    // Send initial inventory
    this.sendInventoryUpdate(sessionId, player);

    // Send current loot on the ground in player's zone
    for (const loot of this.world.getLootsInZone(player.currentZone).values()) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.LootSpawned,
        loot,
      });
    }

    // Send NPC list for current zone
    this.sendNpcList(sessionId, player);

    // Broadcast to others in the same zone
    const zonePlayers = this.world.zoneManager.getPlayersInZone(player.currentZone);
    for (const otherPlayer of zonePlayers) {
      if (otherPlayer.id !== player.id) {
        this.network.sendToPlayer(otherPlayer.id, {
          type: ServerMessageType.PlayerJoined,
          player: player.toState(),
        });
      }
    }

    this.chatSystem.sendSystemMessage(`${player.name} has joined the game.`, this.world);
    console.log(`[Game] Character selected: ${charInfo.name} (${charInfo.classType}) in zone ${player.currentZone} [${sessionId}]`);
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

  private handleTutorialComplete(sessionId: string): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || !player.characterId) return;

    this.db.markTutorialComplete(player.characterId);
    console.log(`[Tutorial] Tutorial completed for ${player.name} [${player.characterId}]`);
  }

  // ── Item handlers ─────────────────────────────────────────

  private handlePickupItem(sessionId: string, msg: PickupItemMessage): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    const lootResult = this.world.zoneManager.getLoot(msg.lootId);
    if (!lootResult) return;

    // Range check
    const dist = distance(player.position, lootResult.loot.position);
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

    // Track quest Collect objectives
    this.questManager.onItemPickup(player, item.itemId);
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

    this.world.addLoot(loot, player.currentZone);
    this.network.broadcastToZone(player.currentZone, {
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

    const now = Date.now();
    const effect = itemDef.useEffect;

    // Check cooldowns for consumables
    if (itemDef.type === 'consumable') {
      const cooldownCheck = player.canUseConsumable(invItem.itemId, now);
      if (!cooldownCheck.canUse) {
        this.network.sendToPlayer(sessionId, {
          type: ServerMessageType.Error,
          message: cooldownCheck.reason || 'Item on cooldown',
        });
        return;
      }
    }

    // Apply effect based on type
    if (effect.type === 'heal') {
      this.applyHealConsumable(player, now, effect.value);
    } else if (effect.type === 'mana') {
      this.applyManaConsumable(player, now, effect.value);
    } else if (effect.type === 'teleport') {
      this.applyTeleportConsumable(player, invItem.itemId, now);
    } else if (effect.type === 'buff') {
      this.applyBandageHoT(player, now);
      player.setItemCooldown(invItem.itemId, now, BANDAGE_COOLDOWN_MS);
    }

    // Send confirmation
    this.network.sendToPlayer(sessionId, {
      type: ServerMessageType.ConsumableUsed,
      playerId: player.id,
      itemId: invItem.itemId,
      effectType: effect.type,
      value: effect.value,
    });

    // Send cooldown update
    this.network.sendToPlayer(sessionId, {
      type: ServerMessageType.PotionCooldownUpdate,
      cooldownState: player.getPotionCooldownState(now),
    });

    // Consume one from stack
    player.removeFromInventory(msg.slot, 1);
    this.sendInventoryUpdate(sessionId, player);
  }

  private handleEquipItem(sessionId: string, msg: EquipItemMessage): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    const success = player.equipItem(msg.slot, msg.equipSlot);
    if (success) {
      this.sendInventoryUpdate(sessionId, player);
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.EquipmentUpdate,
        equipment: player.getEquipmentState(),
      });
    }
  }

  private handleUnequipItem(sessionId: string, msg: UnequipItemMessage): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    const success = player.unequipItem(msg.equipSlot);
    if (success) {
      this.sendInventoryUpdate(sessionId, player);
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.EquipmentUpdate,
        equipment: player.getEquipmentState(),
      });
    }
  }

  private applyHealConsumable(player: Player, now: number, value: number): void {
    const healAmount = Math.round((value / 100) * player.maxHealth);
    const event = player.heal(healAmount, player.id);
    this.network.broadcastToZone(player.currentZone, {
      type: ServerMessageType.DamageDealt,
      event,
    });
    player.startPotionCooldown(now, POTION_SHARED_COOLDOWN_MS);
  }

  private applyManaConsumable(player: Player, now: number, value: number): void {
    const manaAmount = Math.round((value / 100) * player.maxMana);
    player.mana = Math.min(player.maxMana, player.mana + manaAmount);
    player.startPotionCooldown(now, POTION_SHARED_COOLDOWN_MS);
  }

  private applyTeleportConsumable(player: Player, itemId: string, now: number): void {
    const spawn = ZONE_PLAYER_SPAWNS[player.currentZone];
    player.position.x = spawn.x;
    player.position.y = spawn.y;
    player.setItemCooldown(itemId, now, TP_SCROLL_COOLDOWN_MS);
    this.network.broadcastToZone(player.currentZone, {
      type: ServerMessageType.PlayerMoved,
      playerId: player.id,
      position: player.position,
      seq: 0,
    });
  }

  private applyBandageHoT(player: Player, now: number): void {
    const ticksCount = Math.floor(BANDAGE_HOT_DURATION_MS / TICK_INTERVAL);
    const totalHeal = Math.round((BANDAGE_HOT_TOTAL_PERCENT / 100) * player.maxHealth);
    const healPerTick = Math.floor(totalHeal / ticksCount);

    player.bandageHoTActive = true;
    player.bandageHoTEndTime = now + BANDAGE_HOT_DURATION_MS;
    player.bandageHoTTicksRemaining = ticksCount;

    // Store heal per tick in a simple way
    player.bandageHealPerTick = healPerTick;
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
      try {
        this.db.saveCharacter(player.toCharacterSaveData());
        this.db.saveInventory(player.characterId, player.inventory);
        this.db.saveEquipment(player.characterId, player.equipment);
        const quests = this.questManager.getPlayerQuests(player.id);
        this.db.saveQuestProgress(player.characterId, quests);
      } catch (error) {
        console.error(`[Game] Failed to save player ${player.name} on disconnect:`, error);
      }
    }

    this.questManager.removePlayer(sessionId);

    const removed = this.world.removePlayer(sessionId);
    if (removed) {
      this.sessions.delete(sessionId);
      this.chatSystem.removePlayer(sessionId);

      this.network.broadcastToZone(removed.currentZone, {
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
        try {
          this.db.saveCharacter(player.toCharacterSaveData());
          this.db.saveInventory(player.characterId, player.inventory);
          this.db.saveEquipment(player.characterId, player.equipment);
          const quests = this.questManager.getPlayerQuests(player.id);
          this.db.saveQuestProgress(player.characterId, quests);
        } catch (error) {
          console.error(`[Game] Failed to save player ${player.name}:`, error);
        }
      }
    }
  }

  // ── Zone/Portal handlers ──────────────────────────────────

  private handleUsePortal(sessionId: string, targetZone: ZoneId): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    const portal = this.world.zoneManager.findNearestPortal(
      player.currentZone,
      player.position,
      PORTAL_USE_RANGE,
    );

    if (!portal) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'No portal nearby',
      });
      return;
    }

    if (portal.targetZone !== targetZone) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Portal does not lead to that zone',
      });
      return;
    }

    const oldZone = player.currentZone;
    const newZone = portal.targetZone;
    const newPosition = portal.targetSpawnPoint;

    // Get zone data for client
    const targetZoneData = this.world.zoneManager.getZone(newZone);
    if (!targetZoneData) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Zone not found',
      });
      return;
    }

    // Notify old zone that player left
    const oldZonePlayers = this.world.zoneManager.getPlayersInZone(oldZone);
    for (const otherPlayer of oldZonePlayers) {
      if (otherPlayer.id !== player.id) {
        this.network.sendToPlayer(otherPlayer.id, {
          type: ServerMessageType.PlayerLeft,
          playerId: player.id,
        });
      }
    }

    // Change zone
    this.world.changePlayerZone(player, newZone, newPosition);

    // Persist zone change to DB immediately
    try {
      if (player.characterId) {
        this.db.saveCharacter(player.toCharacterSaveData());
      }
    } catch (error) {
      console.error(`[Portal] Failed to persist zone change for ${player.name}:`, error);
    }

    // Send zone changed message to player
    this.network.sendToPlayer(sessionId, {
      type: ServerMessageType.ZoneChanged,
      oldZone,
      newZone,
      mapData: targetZoneData.mapData,
      playerPosition: { x: newPosition.x, y: newPosition.y },
    });

    // Notify new zone that player joined
    const newZonePlayers = this.world.zoneManager.getPlayersInZone(newZone);
    for (const otherPlayer of newZonePlayers) {
      if (otherPlayer.id !== player.id) {
        this.network.sendToPlayer(otherPlayer.id, {
          type: ServerMessageType.PlayerJoined,
          player: player.toState(),
        });
      }
    }

    console.log(`[Portal] ${player.name} traveled from ${oldZone} to ${newZone}`);

    // Send NPC list for new zone
    this.sendNpcList(sessionId, player);

    // Trigger Visit quest objectives for new zone
    this.questManager.onZoneEnter(player, newZone);
  }

  // ── NPC & Quest handlers ─────────────────────────────────

  private handleInteractNPC(sessionId: string, msg: InteractNPCMessage): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    const npc = this.npcs.get(msg.npcId);
    if (!npc) return;

    // Verify NPC is in the same zone
    if (npc.zone !== player.currentZone) return;

    // Range check
    const dist = distance(player.position, npc.position);
    if (dist > NPC_INTERACTION_RANGE) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Too far away from NPC',
      });
      return;
    }

    const playerQuests = this.questManager.getPlayerQuests(player.id);
    const availableQuests = npc.getAvailableQuests(player, playerQuests);

    // Build active quests for this NPC
    const activeQuests: Array<{ questId: typeof QUEST_DEFINITIONS[keyof typeof QUEST_DEFINITIONS]['id']; objectives: typeof QUEST_DEFINITIONS[keyof typeof QUEST_DEFINITIONS]['objectives'] }> = [];
    const completableQuests: Array<typeof QUEST_DEFINITIONS[keyof typeof QUEST_DEFINITIONS]['id']> = [];

    for (const questId of npc.def.questIds) {
      const entry = playerQuests.get(questId);
      if (!entry) continue;

      if (entry.state === QuestState.Active) {
        activeQuests.push({ questId, objectives: entry.objectives });
      } else if (entry.state === QuestState.Complete) {
        completableQuests.push(questId);
      }
    }

    // Choose appropriate dialogue
    let dialogue = npc.def.dialogue.greeting;
    if (completableQuests.length > 0) {
      dialogue = npc.def.dialogue.questComplete;
    } else if (activeQuests.length > 0) {
      dialogue = npc.def.dialogue.questInProgress;
    } else if (availableQuests.length > 0) {
      dialogue = npc.def.dialogue.questAvailable;
    }

    this.network.sendToPlayer(sessionId, {
      type: ServerMessageType.NPCDialogue,
      npcId: npc.id,
      dialogue,
      availableQuests,
      activeQuests,
      completableQuests,
    });
  }

  private handleAcceptQuest(sessionId: string, msg: AcceptQuestMessage): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    const success = this.questManager.acceptQuest(player, msg.questId);
    if (!success) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Cannot accept this quest',
      });
    }
  }

  private handleAbandonQuest(sessionId: string, msg: AbandonQuestMessage): void {
    const player = this.world.getPlayer(sessionId);
    if (!player) return;

    const success = this.questManager.abandonQuest(player, msg.questId);
    if (!success) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Cannot abandon this quest',
      });
    }
  }

  private handleTurnInQuest(sessionId: string, msg: TurnInQuestMessage): void {
    const player = this.world.getPlayer(sessionId);
    if (!player || player.isDead) return;

    const success = this.questManager.turnInQuest(player, msg.questId);
    if (!success) {
      this.network.sendToPlayer(sessionId, {
        type: ServerMessageType.Error,
        message: 'Cannot turn in this quest',
      });
    }
  }

  private sendNpcList(sessionId: string, player: Player): void {
    const npcList = this.questManager.getNpcListForZone(player.id, player.currentZone);
    this.network.sendToPlayer(sessionId, {
      type: ServerMessageType.NPCList,
      npcs: npcList,
    });
  }

  /** Hook for CombatSystem to call when a mob is killed */
  onMobKill(player: Player, mobType: string): void {
    this.questManager.onMobKill(player, mobType);
  }

  /** Hook for item pickup quest tracking */
  onItemPickup(player: Player, itemId: string): void {
    this.questManager.onItemPickup(player, itemId);
  }

  /** Access the QuestManager (for CombatSystem integration) */
  getQuestManager(): QuestManager {
    return this.questManager;
  }
}
