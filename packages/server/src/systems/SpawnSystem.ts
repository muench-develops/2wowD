import { MobType, ServerMessageType } from '@2wowd/shared';
import { Mob } from '../entities/Mob.js';
import { World } from '../core/World.js';
import { NetworkManager } from '../network/NetworkManager.js';

export class SpawnSystem {
  private network: NetworkManager;

  constructor(network: NetworkManager) {
    this.network = network;
  }

  /** Initial mob spawn based on map spawn points */
  spawnInitialMobs(world: World): void {
    for (const sp of world.mapData.spawnPoints) {
      for (let i = 0; i < sp.count; i++) {
        // Offset slightly so mobs don't stack
        const offset = {
          x: sp.position.x + (Math.random() - 0.5) * 2,
          y: sp.position.y + (Math.random() - 0.5) * 2,
        };
        const mob = new Mob(sp.mobType, offset, sp.respawnTime);
        world.addMob(mob);
      }
    }
  }

  /** Process dead mobs and their respawn timers */
  update(world: World, deltaMs: number): void {
    for (const mob of world.mobs.values()) {
      if (!mob.isDead) continue;

      mob.respawnTimer -= deltaMs;
      if (mob.respawnTimer <= 0) {
        mob.respawn();
        this.network.broadcastToAll({
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
