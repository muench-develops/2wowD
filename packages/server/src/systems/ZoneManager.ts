import {
  ZoneId,
  MapData,
  Vec2,
  Portal,
  ZONE_METADATA,
  ZONE_PORTALS,
  distance,
} from '@isoheim/shared';
import { Player } from '../entities/Player.js';
import { Mob } from '../entities/Mob.js';

export interface Zone {
  id: ZoneId;
  mapData: MapData;
  players: Map<string, Player>;
  mobs: Map<string, Mob>;
}

export class ZoneManager {
  private zones: Map<ZoneId, Zone> = new Map();

  registerZone(zoneId: ZoneId, mapData: MapData): void {
    this.zones.set(zoneId, {
      id: zoneId,
      mapData,
      players: new Map(),
      mobs: new Map(),
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

    const MOB_SEPARATION = 0.4;
    const mobArray = Array.from(zone.mobs.values()).filter(m => !m.isDead);
    
    for (let i = 0; i < mobArray.length; i++) {
      for (let j = i + 1; j < mobArray.length; j++) {
        const a = mobArray[i];
        const b = mobArray[j];
        const dx = b.position.x - a.position.x;
        const dy = b.position.y - a.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < MOB_SEPARATION && dist > 0.001) {
          const pushX = (dx / dist) * (MOB_SEPARATION - dist) * 0.5;
          const pushY = (dy / dist) * (MOB_SEPARATION - dist) * 0.5;
          
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
}
