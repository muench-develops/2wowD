import {
  ZoneId,
  MapData,
  Vec2,
  Portal,
  WorldLoot,
  ZONE_METADATA,
  ZONE_PORTALS,
  MOB_SEPARATION_DISTANCE,
  MOB_SEPARATION_EPSILON,
  MOB_SEPARATION_PUSH_FACTOR,
  distance,
} from '@isoheim/shared';
import { Player } from '../entities/Player.js';
import { Mob } from '../entities/Mob.js';

export interface Zone {
  id: ZoneId;
  mapData: MapData;
  players: Map<string, Player>;
  mobs: Map<string, Mob>;
  loots: Map<string, import('@isoheim/shared').WorldLoot>;
}

export class ZoneManager {
  private zones: Map<ZoneId, Zone> = new Map();

  registerZone(zoneId: ZoneId, mapData: MapData): void {
    this.zones.set(zoneId, {
      id: zoneId,
      mapData,
      players: new Map(),
      mobs: new Map(),
      loots: new Map(),
    });
    console.log(`[ZoneManager] Registered zone: ${ZONE_METADATA[zoneId].name} (${mapData.width}x${mapData.height})`);
  }

  getZone(zoneId: ZoneId): Zone | undefined {
    return this.zones.get(zoneId);
  }

  getAllZones(): Zone[] {
    return Array.from(this.zones.values());
  }

  getPortalsForZone(zoneId: ZoneId): Portal[] {
    return ZONE_PORTALS[zoneId] || [];
  }

  findNearestPortal(zoneId: ZoneId, position: Vec2, maxDistance: number): Portal | null {
    const portals = this.getPortalsForZone(zoneId);
    let nearest: Portal | null = null;
    let nearestDist = maxDistance;

    for (const portal of portals) {
      const dist = distance(position, portal.position);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = portal;
      }
    }

    return nearest;
  }

  getPlayersInZone(zoneId: ZoneId): Player[] {
    const zone = this.zones.get(zoneId);
    return zone ? Array.from(zone.players.values()) : [];
  }

  getMobsInZone(zoneId: ZoneId): Mob[] {
    const zone = this.zones.get(zoneId);
    return zone ? Array.from(zone.mobs.values()) : [];
  }

  getPlayersNearInZone(zoneId: ZoneId, pos: Vec2, range: number): Player[] {
    const zone = this.zones.get(zoneId);
    if (!zone) return [];

    const result: Player[] = [];
    for (const player of zone.players.values()) {
      if (!player.isDead && distance(player.position, pos) <= range) {
        result.push(player);
      }
    }
    return result;
  }

  getMobsNearInZone(zoneId: ZoneId, pos: Vec2, range: number): Mob[] {
    const zone = this.zones.get(zoneId);
    if (!zone) return [];

    const result: Mob[] = [];
    for (const mob of zone.mobs.values()) {
      if (!mob.isDead && distance(mob.position, pos) <= range) {
        result.push(mob);
      }
    }
    return result;
  }

  isCollisionInZone(zoneId: ZoneId, x: number, y: number): boolean {
    const zone = this.zones.get(zoneId);
    if (!zone) return true;

    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    const map = zone.mapData;
    
    if (tileX < 0 || tileX >= map.width || tileY < 0 || tileY >= map.height) {
      return true;
    }
    return map.collisions[tileY][tileX];
  }

  separateMobsInZone(zoneId: ZoneId): void {
    const zone = this.zones.get(zoneId);
    if (!zone) return;

    const mobArray = Array.from(zone.mobs.values()).filter(m => !m.isDead);
    
    for (let i = 0; i < mobArray.length; i++) {
      for (let j = i + 1; j < mobArray.length; j++) {
        const a = mobArray[i];
        const b = mobArray[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < MOB_SEPARATION_DISTANCE && dist > MOB_SEPARATION_EPSILON) {
          const pushX = (dx / dist) * (MOB_SEPARATION_DISTANCE - dist) * MOB_SEPARATION_PUSH_FACTOR;
          const pushY = (dy / dist) * (MOB_SEPARATION_DISTANCE - dist) * MOB_SEPARATION_PUSH_FACTOR;
          
          if (!this.isCollisionInZone(zoneId, a.position.x - pushX, a.position.y - pushY)) {
            a.position.x -= pushX;
            a.position.y -= pushY;
          }
          if (!this.isCollisionInZone(zoneId, b.position.x + pushX, b.position.y + pushY)) {
            b.position.x += pushX;
            b.position.y += pushY;
          }
        }
      }
    }
  }

  getPlayerIdsInZone(zoneId: ZoneId): string[] {
    const zone = this.zones.get(zoneId);
    return zone ? Array.from(zone.players.keys()) : [];
  }

  getZoneDimensions(zoneId: ZoneId): { width: number; height: number } | undefined {
    const zone = this.zones.get(zoneId);
    if (!zone) return undefined;
    return { width: zone.mapData.width, height: zone.mapData.height };
  }

  getLootsInZone(zoneId: ZoneId): Map<string, WorldLoot> {
    const zone = this.zones.get(zoneId);
    return zone ? zone.loots : new Map();
  }

  addLootToZone(zoneId: ZoneId, loot: WorldLoot): void {
    const zone = this.zones.get(zoneId);
    if (zone) {
      zone.loots.set(loot.id, loot);
    }
  }

  removeLootFromZone(zoneId: ZoneId, lootId: string): void {
    const zone = this.zones.get(zoneId);
    if (zone) {
      zone.loots.delete(lootId);
    }
  }

  getLoot(lootId: string): { loot: WorldLoot; zoneId: ZoneId } | undefined {
    for (const zone of this.zones.values()) {
      const loot = zone.loots.get(lootId);
      if (loot) return { loot, zoneId: zone.id };
    }
    return undefined;
  }
}
