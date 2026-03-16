import {
  TICK_INTERVAL,
  ServerMessageType,
} from '@2wowd/shared';
import { World } from './World.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { MobAISystem } from '../systems/MobAISystem.js';
import { SpawnSystem } from '../systems/SpawnSystem.js';
import { BuffSystem } from '../systems/BuffSystem.js';
import { NetworkManager } from '../network/NetworkManager.js';

export class GameLoop {
  private world: World;
  private movementSystem: MovementSystem;
  private combatSystem: CombatSystem;
  private mobAISystem: MobAISystem;
  private spawnSystem: SpawnSystem;
  private buffSystem: BuffSystem;
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
    network: NetworkManager,
  ) {
    this.world = world;
    this.movementSystem = movementSystem;
    this.combatSystem = combatSystem;
    this.mobAISystem = mobAISystem;
    this.spawnSystem = spawnSystem;
    this.buffSystem = buffSystem;
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
        const player = this.world.getPlayer(effect.entityId);
        const mob = this.world.getMob(effect.entityId);
        if (player && !player.isDead) {
          const event = player.takeDamage(effect.damage, 'buff');
          this.network.broadcastToAll({ type: ServerMessageType.DamageDealt, event });
          if (player.isDead) {
            this.network.broadcastToAll({
              type: ServerMessageType.EntityDied,
              entityId: player.id,
              killerName: 'DoT',
            });
          }
        } else if (mob && !mob.isDead) {
          const event = mob.takeDamage(effect.damage, 'buff');
          this.network.broadcastToAll({ type: ServerMessageType.DamageDealt, event });
          if (mob.isDead) {
            this.network.broadcastToAll({
              type: ServerMessageType.EntityDied,
              entityId: mob.id,
              killerName: 'DoT',
            });
          }
        }
      }
      if (effect.heal > 0) {
        const player = this.world.getPlayer(effect.entityId);
        if (player && !player.isDead) {
          const event = player.heal(effect.heal, 'buff');
          this.network.broadcastToAll({ type: ServerMessageType.DamageDealt, event });
        }
      }
    }

    // 3. Combat (auto-attacks, respawn timers)
    this.combatSystem.update(this.world, deltaMs, now);

    // 4. Mob AI
    this.mobAISystem.update(this.world, deltaMs, now);

    // 5. Spawn system (mob respawns)
    this.spawnSystem.update(this.world, deltaMs);

    // 6. Broadcast world state
    this.broadcastWorldState();
  }

  private broadcastWorldState(): void {
    if (this.world.players.size === 0) return;

    const players = Array.from(this.world.players.values()).map((p) => p.toState(this.buffSystem));
    const mobs = Array.from(this.world.mobs.values()).map((m) => m.toState(this.buffSystem));

    this.network.broadcastToAll({
      type: ServerMessageType.WorldState,
      players,
      mobs,
      tick: this.tick,
    });
  }
}
