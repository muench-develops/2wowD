import {
  WorldLoot,
  LootItem,
  MOB_LOOT_TABLES,
  LOOT_EXPIRY_MS,
  LOOT_KILLER_ONLY_MS,
  ServerMessageType,
  generateId,
} from '@isoheim/shared';
import { Mob } from '../entities/Mob.js';
import { World } from '../core/World.js';
import { NetworkManager } from '../network/NetworkManager.js';

export class LootSystem {
  private network: NetworkManager;

  constructor(network: NetworkManager) {
    this.network = network;
  }

  /** Generate loot drops when a mob dies. */
  createLootFromMob(mob: Mob, world: World, killerId: string): void {
    const lootTable = MOB_LOOT_TABLES[mob.mobType];
    if (!lootTable) return;

    const items: LootItem[] = [];
    const now = Date.now();

    for (const entry of lootTable) {
      const roll = Math.random() * 100;
      if (roll < entry.weight) {
        const qty = entry.minQty + Math.floor(Math.random() * (entry.maxQty - entry.minQty + 1));
        items.push({ itemId: entry.itemId, quantity: qty });
      }
    }

    if (items.length === 0) return;

    const loot: WorldLoot = {
      id: generateId(),
      position: { x: mob.position.x, y: mob.position.y },
      items,
      killerId,
      killerOnlyUntil: now + LOOT_KILLER_ONLY_MS,
      expiresAt: now + LOOT_EXPIRY_MS,
    };

    world.addLoot(loot);

    this.network.broadcastToAll({
      type: ServerMessageType.LootSpawned,
      loot,
    });
  }

  /** Remove expired loot each tick. */
  update(world: World, _deltaMs: number): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, loot] of world.loots) {
      if (now >= loot.expiresAt) {
        expired.push(id);
      }
    }

    for (const id of expired) {
      world.removeLoot(id);
      this.network.broadcastToAll({
        type: ServerMessageType.LootDespawned,
        lootId: id,
      });
    }
  }

  /** Try to pick up an item from loot. Returns the item or null. */
  pickupItem(world: World, playerId: string, lootId: string, itemIndex: number): LootItem | null {
    const loot = world.loots.get(lootId);
    if (!loot) return null;

    const now = Date.now();
    if (now < loot.killerOnlyUntil && loot.killerId !== playerId) {
      return null;
    }

    if (itemIndex < 0 || itemIndex >= loot.items.length) return null;

    const item = loot.items[itemIndex];
    if (!item) return null;

    loot.items.splice(itemIndex, 1);

    // Broadcast pickup
    this.network.broadcastToAll({
      type: ServerMessageType.LootPickedUp,
      lootId: loot.id,
      itemIndex,
      playerId,
    });

    // If loot bag is now empty, remove it
    if (loot.items.length === 0) {
      world.removeLoot(loot.id);
      this.network.broadcastToAll({
        type: ServerMessageType.LootDespawned,
        lootId: loot.id,
      });
    }

    return item;
  }
}
