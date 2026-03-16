import {
  ChatChannel,
  ChatMessage,
  SAY_RANGE,
  MAX_CHAT_LENGTH,
  CHAT_RATE_LIMIT,
  ServerMessageType,
  generateId,
  distance,
} from '@isoheim/shared';
import { Player } from '../entities/Player.js';
import { World } from '../core/World.js';
import { NetworkManager } from '../network/NetworkManager.js';

export class ChatSystem {
  private network: NetworkManager;
  private rateLimits: Map<string, number[]> = new Map();

  constructor(network: NetworkManager) {
    this.network = network;
  }

  handleChat(player: Player, channel: ChatChannel, content: string, world: World): void {
    // Ignore system channel from clients
    if (channel === ChatChannel.System) return;

    // Validate content
    if (!content || content.trim().length === 0) return;
    const trimmed = content.substring(0, MAX_CHAT_LENGTH).trim();

    // Rate limiting
    if (!this.checkRateLimit(player.id)) {
      this.network.sendToPlayer(player.id, {
        type: ServerMessageType.Error,
        message: 'You are sending messages too fast',
      });
      return;
    }

    const message: ChatMessage = {
      id: generateId(),
      channel,
      senderName: player.name,
      senderId: player.id,
      content: trimmed,
      timestamp: Date.now(),
    };

    switch (channel) {
      case ChatChannel.World:
        this.network.broadcastToAll({
          type: ServerMessageType.ChatReceived,
          message,
        });
        break;

      case ChatChannel.Say: {
        const nearbyPlayers = world.getPlayersNear(player.position, SAY_RANGE);
        for (const nearby of nearbyPlayers) {
          this.network.sendToPlayer(nearby.id, {
            type: ServerMessageType.ChatReceived,
            message,
          });
        }
        // Also send to the speaking player if not in range list
        if (!nearbyPlayers.find((p) => p.id === player.id)) {
          this.network.sendToPlayer(player.id, {
            type: ServerMessageType.ChatReceived,
            message,
          });
        }
        break;
      }
    }
  }

  sendSystemMessage(content: string, world: World): void {
    const message: ChatMessage = {
      id: generateId(),
      channel: ChatChannel.System,
      senderName: 'System',
      senderId: 'system',
      content,
      timestamp: Date.now(),
    };

    this.network.broadcastToAll({
      type: ServerMessageType.ChatReceived,
      message,
    });
  }

  private checkRateLimit(playerId: string): boolean {
    const now = Date.now();
    let timestamps = this.rateLimits.get(playerId);
    if (!timestamps) {
      timestamps = [];
      this.rateLimits.set(playerId, timestamps);
    }

    // Remove old timestamps (older than 1 second)
    const cutoff = now - 1000;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= CHAT_RATE_LIMIT) {
      return false;
    }

    timestamps.push(now);
    return true;
  }

  removePlayer(playerId: string): void {
    this.rateLimits.delete(playerId);
  }
}
