import {
  ClientMessage,
  ClientMessageType,
  ServerMessageType,
  ChatChannel,
  ClassType,
} from '@isoheim/shared';
import { Player } from '../entities/Player.js';
import { World } from '../core/World.js';
import { NetworkManager } from './NetworkManager.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { ChatSystem } from '../systems/ChatSystem.js';
import { AuthManager } from '../auth/AuthManager.js';
import { Database } from '../database/Database.js';

export class MessageHandler {
  private world: World;
  private network: NetworkManager;
  private movementSystem: MovementSystem;
  private combatSystem: CombatSystem;
  private chatSystem: ChatSystem;
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
    authManager: AuthManager,
    db: Database,
  ) {
    this.world = world;
    this.network = network;
    this.movementSystem = movementSystem;
    this.combatSystem = combatSystem;
    this.chatSystem = chatSystem;
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
    this.sessions.set(sessionId, player.id);
    this.world.addPlayer(player);

    // Send welcome with map data
    this.network.sendToPlayer(sessionId, {
      type: ServerMessageType.Welcome,
      playerId: player.id,
      player: player.toState(),
      mapData: this.world.mapData,
    });

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

  // ── Disconnect / Save helpers ──────────────────────────

  /** Save player state to DB and remove from world */
  private saveAndRemovePlayer(sessionId: string): void {
    const player = this.world.getPlayer(sessionId);
    if (player && player.characterId) {
      this.db.saveCharacter(player.toCharacterSaveData());
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
      }
    }
  }
}
