import {
  TICK_INTERVAL,
  ServerMessageType,
  type ServerMessage,
} from '@isoheim/shared';
import { World } from './World.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { MobAISystem } from '../systems/MobAISystem.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { BuffSystem } from '../systems/BuffSystem.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { LootSystem } from '../systems/LootSystem.js';

export class GameLoop {
  private world: World;
  private movementSystem: MovementSystem;
  private combatSystem: CombatSystem;
  private mobAISystem: MobAISystem;
  private spawnSystem: SpawnSystem;
  private buffSystem: BuffSystem;
  private lootSystem: LootSystem;
  private network: NetworkManager;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private tick: number = 0;
  private lastTime: number = 0;

  constructor(
    world: World,
    movementSystem: MovementSystem,
    combatSystem: CombatSystem,
    mobAISystem: MobAISystem,
    spawnSystem: SpawnSystem,
    buffSystem: BuffSystem,
    lootSystem: LootSystem,
    network: NetworkManager,
  ) {
    this.world = world;
    this.movementSystem = movementSystem;
    this.combatSystem = combatSystem;
    this.mobAISystem = mobAISystem;
    this.spawnSystem = spawnSystem;
    this.buffSystem = buffSystem;
    this.lootSystem = lootSystem;
    this.network = network;
  }

  start(): void {
    this.lastTime = Date.now();
    this.intervalId = setInterval(() => this.processTick(), TICK_INTERVAL);
    console.log(`[GameLoop] Started at ${1000 / TICK_INTERVAL} ticks/sec`);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[GameLoop] Stopped');
  }

  private processTick(): void {
    const now = Date.now();
    const deltaMs = now - this.lastTime;
    this.lastTime = now;
    this.tick++;

    // 1. Movement
    this.movementSystem.update(this.world, deltaMs);

    // 2. Buffs (tick DoT/HoT and expire)
    const tickEffects = this.buffSystem.update(deltaMs);
    for (const effect of tickEffects) {
      if (effect.damage > 0) {
        this.processBuffDamage(effect.entityId, effect.damage);
      }
      if (effect.heal > 0) {
        this.processBuffHeal(effect.entityId, effect.heal);
      }
    }

    // 2.5. Bandage HoT processing
    this.processBandageHoT(now);

    // 3. Combat (auto-attacks, respawn timers)
    this.combatSystem.update(this.world, deltaMs, now);

    // 4. Mob AI
    this.mobAISystem.update(this.world, deltaMs, now);

    // 5. Mob separation (prevent permanent overlap)
    this.world.separateMobs();

    // 6. Spawn system (mob respawns)
    this.spawnSystem.update(this.world, deltaMs);

    // 7. Loot system (expire old loot)
    this.lootSystem.update(this.world, deltaMs);

    // 8. Broadcast world state
    this.broadcastWorldState();
  }

  private broadcastWorldState(): void {
    for (const zone of this.world.zoneManager.getAllZones()) {
      if (zone.players.size === 0) continue;

      const players = Array.from(zone.players.values()).map((p) => p.toState(this.buffSystem));
      const mobs = Array.from(zone.mobs.values()).map((m) => m.toState(this.buffSystem));

      const message: ServerMessage = {
        type: ServerMessageType.WorldState,
        players,
        mobs,
        tick: this.tick,
      };

      for (const player of zone.players.values()) {
        this.network.sendToPlayer(player.id, message);
      }
    }
  }

  private processBuffDamage(entityId: string, damage: number): void {
    const player = this.world.getPlayer(entityId);
    const mob = this.world.getMob(entityId);
    if (player && !player.isDead) {
      const event = player.takeDamage(damage, 'buff');
      this.network.broadcastToZone(player.currentZone, { type: ServerMessageType.DamageDealt, event });
      if (player.isDead) {
        this.network.broadcastToZone(player.currentZone, {
          type: ServerMessageType.EntityDied,
          entityId: player.id,
          killerName: 'DoT',
        });
      }
    } else if (mob && !mob.isDead) {
      const event = mob.takeDamage(damage, 'buff');
      this.network.broadcastToZone(mob.zoneId, { type: ServerMessageType.DamageDealt, event });
      if (mob.isDead) {
        this.network.broadcastToZone(mob.zoneId, {
          type: ServerMessageType.EntityDied,
          entityId: mob.id,
          killerName: 'DoT',
        });
      }
    }
  }

  private processBuffHeal(entityId: string, heal: number): void {
    const player = this.world.getPlayer(entityId);
    if (player && !player.isDead) {
      const event = player.heal(heal, 'buff');
      this.network.broadcastToZone(player.currentZone, { type: ServerMessageType.DamageDealt, event });
    }
  }

  private processBandageHoT(now: number): void {
    for (const zone of this.world.zoneManager.getAllZones()) {
      for (const player of zone.players.values()) {
        if (player.bandageHoTActive && player.bandageHoTTicksRemaining > 0) {
          if (now >= player.bandageHoTEndTime) {
            player.bandageHoTActive = false;
            player.bandageHoTTicksRemaining = 0;
          } else {
            const healAmount = (player as any).bandageHealPerTick || 0;
            if (healAmount > 0) {
              const event = player.heal(healAmount, player.id);
              this.network.broadcastToZone(player.currentZone, {
                type: ServerMessageType.DamageDealt,
                event,
              });
            }
            player.bandageHoTTicksRemaining--;
          }
        }
      }
    }
  }
}
