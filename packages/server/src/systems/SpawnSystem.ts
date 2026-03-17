import { ServerMessageType, ZoneId } from '@isoheim/shared';
import { Mob } from '../entities/Mob.js';
import { World } from '../core/World.js';
import { NetworkManager } from '../network/NetworkManager.js';

export class SpawnSystem {
  private network: NetworkManager;

  constructor(network: NetworkManager) {
    this.network = network;
  }

  /** Initial mob spawn for a specific zone */
  spawnInitialMobsForZone(world: World, zoneId: ZoneId): void {
    const zone = world.zoneManager.getZone(zoneId);
    if (!zone) {
      console.error(`[SpawnSystem] Cannot spawn mobs for unknown zone: ${zoneId}`);
      return;
    }

    for (const sp of zone.mapData.spawnPoints) {
      for (let i = 0; i < sp.count; i++) {
        const offset = {
          x: sp.position.x + (Math.random() - 0.5) * 2,
          y: sp.position.y + (Math.random() - 0.5) * 2,
        };
        const mob = new Mob(sp.mobType, offset, sp.respawnTime, zoneId);
        world.addMob(mob, zoneId);
      }
    }
  }

  /** Initial mob spawn based on map spawn points (legacy - spawns for all zones) */
  spawnInitialMobs(world: World): void {
    const zones = world.zoneManager.getAllZones();
    for (const zone of zones) {
      this.spawnInitialMobsForZone(world, zone.id);
    }
  }

  /** Process dead mobs and their respawn timers */
  update(world: World, deltaMs: number): void {
    for (const zone of world.zoneManager.getAllZones()) {
      for (const mob of zone.mobs.values()) {
        if (!mob.isDead) continue;

        mob.respawnTimer -= deltaMs;
        if (mob.respawnTimer <= 0) {
          mob.respawn();
          this.network.broadcastToZone(zone.id, {
            type: ServerMessageType.EntityRespawned,
            entityId: mob.id,
            position: { ...mob.position },
            health: mob.health,
            maxHealth: mob.maxHealth,
          });
        }
      }
    }
  }
}
