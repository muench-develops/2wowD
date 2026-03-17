import {
  MapData,
  Vec2,
  WorldLoot,
  ZoneId,
  distance,
} from '@isoheim/shared';
import { Player } from '../entities/Player.js';
import { Mob } from '../entities/Mob.js';
import { ZoneManager } from '../systems/ZoneManager.js';

export class World {
  readonly zoneManager: ZoneManager;

  /** Legacy - keep for backward compatibility with existing code that accesses world.mapData */
  mapData: MapData;

  constructor(zoneManager: ZoneManager, defaultZone: ZoneId = ZoneId.StarterPlains) {
    this.zoneManager = zoneManager;
    const zone = zoneManager.getZone(defaultZone);
    if (!zone) {
      throw new Error(`Zone ${defaultZone} not found in ZoneManager`);
    }
    this.mapData = zone.mapData;
  }

  /** Legacy getter - returns all players across all zones */
  get players(): Map<string, Player> {
    const allPlayers = new Map<string, Player>();
    for (const zone of this.zoneManager.getAllZones()) {
      for (const [id, player] of zone.players) {
        allPlayers.set(id, player);
      }
    }
    return allPlayers;
  }

  /** Legacy getter - returns all mobs across all zones */
  get mobs(): Map<string, Mob> {
    const allMobs = new Map<string, Mob>();
    for (const zone of this.zoneManager.getAllZones()) {
      for (const [id, mob] of zone.mobs) {
        allMobs.set(id, mob);
      }
    }
    return allMobs;
  }

  /** Returns all loots across all zones */
  get loots(): Map<string, WorldLoot> {
    const allLoots = new Map<string, WorldLoot>();
    for (const zone of this.zoneManager.getAllZones()) {
      for (const [id, loot] of zone.loots) {
        allLoots.set(id, loot);
      }
    }
    return allLoots;
  }

  addPlayer(player: Player): void {
    const zone = this.zoneManager.getZone(player.currentZone);
    if (zone) {
      zone.players.set(player.id, player);
    }
  }

  removePlayer(playerId: string): Player | undefined {
    for (const zone of this.zoneManager.getAllZones()) {
      const player = zone.players.get(playerId);
      if (player) {
        zone.players.delete(playerId);
        
        // Clear mob targets referencing this player in this zone
        for (const mob of zone.mobs.values()) {
          if (mob.targetId === playerId) {
            mob.targetId = null;
            mob.threatTable.delete(playerId);
          }
        }
        
        return player;
      }
    }
    return undefined;
  }

  changePlayerZone(player: Player, newZone: ZoneId, newPosition: Vec2): void {
    const oldZone = this.zoneManager.getZone(player.currentZone);
    const targetZone = this.zoneManager.getZone(newZone);
    
    if (!targetZone) {
      console.error(`[World] Cannot change player ${player.id} to invalid zone ${newZone}`);
      return;
    }

    // Remove from old zone
    if (oldZone) {
      oldZone.players.delete(player.id);
      
      // Clear mob aggro in old zone
      for (const mob of oldZone.mobs.values()) {
        if (mob.targetId === player.id) {
          mob.targetId = null;
          mob.threatTable.delete(player.id);
        }
      }
    }

    // Update player
    player.currentZone = newZone;
    player.position.x = newPosition.x;
    player.position.y = newPosition.y;
    player.targetId = null;
    player.moveDirection = null;

    // Add to new zone
    targetZone.players.set(player.id, player);
  }

  getPlayer(id: string): Player | undefined {
    for (const zone of this.zoneManager.getAllZones()) {
      const player = zone.players.get(id);
      if (player) return player;
    }
    return undefined;
  }

  getMob(id: string): Mob | undefined {
    for (const zone of this.zoneManager.getAllZones()) {
      const mob = zone.mobs.get(id);
      if (mob) return mob;
    }
    return undefined;
  }

  addMob(mob: Mob, zoneId: ZoneId): void {
    const zone = this.zoneManager.getZone(zoneId);
    if (zone) {
      zone.mobs.set(mob.id, mob);
    }
  }

  removeMob(mobId: string): void {
    for (const zone of this.zoneManager.getAllZones()) {
      if (zone.mobs.has(mobId)) {
        zone.mobs.delete(mobId);
        return;
      }
    }
  }

  getZonePlayers(zoneId: ZoneId): Map<string, Player> {
    const zone = this.zoneManager.getZone(zoneId);
    return zone ? zone.players : new Map();
  }

  getZoneMobs(zoneId: ZoneId): Map<string, Mob> {
    const zone = this.zoneManager.getZone(zoneId);
    return zone ? zone.mobs : new Map();
  }

  getPlayerZone(playerId: string): ZoneId | undefined {
    for (const zone of this.zoneManager.getAllZones()) {
      if (zone.players.has(playerId)) return zone.id;
    }
    return undefined;
  }

  getMobZone(mobId: string): ZoneId | undefined {
    for (const zone of this.zoneManager.getAllZones()) {
      if (zone.mobs.has(mobId)) return zone.id;
    }
    return undefined;
  }

  addLoot(loot: WorldLoot, zoneId?: ZoneId): void {
    const targetZone = zoneId ?? this.findZoneForPosition(loot.position);
    this.zoneManager.addLootToZone(targetZone, loot);
  }

  removeLoot(id: string): void {
    for (const zone of this.zoneManager.getAllZones()) {
      if (zone.loots.has(id)) {
        zone.loots.delete(id);
        return;
      }
    }
  }

  getLoot(lootId: string): WorldLoot | undefined {
    const result = this.zoneManager.getLoot(lootId);
    return result?.loot;
  }

  getLootsInZone(zoneId: ZoneId): Map<string, WorldLoot> {
    return this.zoneManager.getLootsInZone(zoneId);
  }

  private findZoneForPosition(position: Vec2): ZoneId {
    // Check which zone a mob/entity at this position belongs to by checking nearby players
    // Default to first zone if we can't determine
    for (const zone of this.zoneManager.getAllZones()) {
      for (const player of zone.players.values()) {
        if (distance(player.position, position) < 100) {
          return zone.id;
        }
      }
    }
    return this.zoneManager.getAllZones()[0]?.id ?? ZoneId.StarterPlains;
  }

  getPlayersNear(pos: Vec2, range: number, zoneId?: ZoneId): Player[] {
    if (zoneId) {
      return this.zoneManager.getPlayersNearInZone(zoneId, pos, range);
    }
    
    // Legacy: search all zones if no zone specified
    const result: Player[] = [];
    for (const zone of this.zoneManager.getAllZones()) {
      result.push(...this.zoneManager.getPlayersNearInZone(zone.id, pos, range));
    }
    return result;
  }

  getMobsNear(pos: Vec2, range: number, zoneId?: ZoneId): Mob[] {
    if (zoneId) {
      return this.zoneManager.getMobsNearInZone(zoneId, pos, range);
    }
    
    // Legacy: search all zones if no zone specified
    const result: Mob[] = [];
    for (const zone of this.zoneManager.getAllZones()) {
      result.push(...this.zoneManager.getMobsNearInZone(zone.id, pos, range));
    }
    return result;
  }

  separateMobs(): void {
    for (const zone of this.zoneManager.getAllZones()) {
      this.zoneManager.separateMobsInZone(zone.id);
    }
  }

  isCollision(x: number, y: number, zoneId?: ZoneId): boolean {
    if (zoneId) {
      return this.zoneManager.isCollisionInZone(zoneId, x, y);
    }
    
    // Legacy: use first zone's collision data
    const firstZone = this.zoneManager.getAllZones()[0];
    if (!firstZone) return true;
    return this.zoneManager.isCollisionInZone(firstZone.id, x, y);
  }
}
