import {
  AGGRO_RANGE,
  LEASH_RANGE,
  MOB_PATROL_RANGE,
  distance,
  ServerMessageType,
} from '@isoheim/shared';
import { Mob, MobAIState } from '../entities/Mob.js';
import { Player } from '../entities/Player.js';
import { World } from '../core/World.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { BuffSystem } from './BuffSystem.js';

export class MobAISystem {
  private network: NetworkManager;
  private buffSystem: BuffSystem;

  constructor(network: NetworkManager, buffSystem: BuffSystem) {
    this.network = network;
    this.buffSystem = buffSystem;
  }

  update(world: World, deltaMs: number, now: number): void {
    const deltaSeconds = deltaMs / 1000;

    for (const mob of world.mobs.values()) {
      if (mob.isDead) continue;

      switch (mob.aiState) {
        case MobAIState.Idle:
          this.processIdle(mob, world, deltaMs);
          break;
        case MobAIState.Patrol:
          this.processPatrol(mob, world, deltaSeconds);
          break;
        case MobAIState.Chase:
          this.processChase(mob, world, deltaSeconds);
          break;
        case MobAIState.Attack:
          this.processAttack(mob, world, now);
          break;
        case MobAIState.Leash:
          this.processLeash(mob, deltaSeconds);
          break;
      }
    }
  }

  private processIdle(mob: Mob, world: World, deltaMs: number): void {
    // Check for aggro
    const target = this.findAggroTarget(mob, world);
    if (target) {
      mob.targetId = target.id;
      mob.aiState = MobAIState.Chase;
      return;
    }

    // Occasionally patrol
    mob.patrolCooldown -= deltaMs;
    if (mob.patrolCooldown <= 0) {
      mob.patrolCooldown = 3000 + Math.random() * 5000;
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * MOB_PATROL_RANGE;
      mob.patrolTarget = {
        x: mob.spawnOrigin.x + Math.cos(angle) * dist,
        y: mob.spawnOrigin.y + Math.sin(angle) * dist,
      };
      mob.aiState = MobAIState.Patrol;
    }
  }

  private processPatrol(mob: Mob, world: World, deltaSeconds: number): void {
    // Check for aggro
    const target = this.findAggroTarget(mob, world);
    if (target) {
      mob.targetId = target.id;
      mob.aiState = MobAIState.Chase;
      mob.patrolTarget = null;
      return;
    }

    if (!mob.patrolTarget) {
      mob.aiState = MobAIState.Idle;
      return;
    }

    const dist = distance(mob.position, mob.patrolTarget);
    if (dist < 0.3) {
      mob.patrolTarget = null;
      mob.aiState = MobAIState.Idle;
      return;
    }

    mob.moveToward(mob.patrolTarget, deltaSeconds * 0.5); // Patrol at half speed
  }

  private processChase(mob: Mob, world: World, deltaSeconds: number): void {
    // Check leash distance
    const distFromSpawn = distance(mob.position, mob.spawnOrigin);
    if (distFromSpawn > LEASH_RANGE) {
      mob.leash();
      return;
    }

    const target = mob.targetId ? world.getPlayer(mob.targetId) : null;
    if (!target || target.isDead || this.buffSystem.hasBuff(target.id, 'buff-vanish')) {
      // Pick new target from threat table or go idle
      const newTarget = this.findHighestThreat(mob, world);
      if (newTarget) {
        mob.targetId = newTarget.id;
      } else {
        mob.leash();
      }
      return;
    }

    const dist = distance(mob.position, target.position);
    if (dist <= mob.def.attackRange) {
      mob.aiState = MobAIState.Attack;
      return;
    }

    mob.moveToward(target.position, deltaSeconds);
  }

  private processAttack(mob: Mob, world: World, now: number): void {
    const target = mob.targetId ? world.getPlayer(mob.targetId) : null;
    if (!target || target.isDead || this.buffSystem.hasBuff(target.id, 'buff-vanish')) {
      const newTarget = this.findHighestThreat(mob, world);
      if (newTarget) {
        mob.targetId = newTarget.id;
      } else {
        mob.leash();
      }
      return;
    }

    const dist = distance(mob.position, target.position);
    if (dist > mob.def.attackRange) {
      mob.aiState = MobAIState.Chase;
      return;
    }

    // Check leash
    const distFromSpawn = distance(mob.position, mob.spawnOrigin);
    if (distFromSpawn > LEASH_RANGE) {
      mob.leash();
      return;
    }

    if (mob.canAutoAttack(now)) {
      const effectivePlayerStats = target.getEffectiveStats(this.buffSystem);
      const effectiveMobStats = mob.getEffectiveStats(this.buffSystem);
      const rawDamage = this.calculateDamage(effectiveMobStats.attack, effectivePlayerStats.defense);
      const event = target.takeDamage(rawDamage, mob.id);
      mob.lastAutoAttackTime = now;

      this.network.broadcastToAll({
        type: ServerMessageType.DamageDealt,
        event,
      });

      if (target.isDead) {
        this.network.broadcastToAll({
          type: ServerMessageType.EntityDied,
          entityId: target.id,
          killerName: mob.def.name,
        });
        mob.targetId = null;
        const newTarget = this.findHighestThreat(mob, world);
        if (newTarget) {
          mob.targetId = newTarget.id;
          mob.aiState = MobAIState.Chase;
        } else {
          mob.leash();
        }
      }
    }
  }

  private processLeash(mob: Mob, deltaSeconds: number): void {
    const dist = distance(mob.position, mob.spawnOrigin);
    if (dist < 0.3) {
      mob.aiState = MobAIState.Idle;
      mob.health = mob.maxHealth;
      return;
    }

    mob.moveToward(mob.spawnOrigin, deltaSeconds * 1.5); // Faster return
  }

  private findAggroTarget(mob: Mob, world: World): Player | null {
    let closest: Player | null = null;
    let closestDist = AGGRO_RANGE;

    for (const player of world.players.values()) {
      if (player.isDead) continue;
      // Skip players who are vanished
      if (this.buffSystem.hasBuff(player.id, 'buff-vanish')) continue;
      const dist = distance(mob.position, player.position);
      if (dist < closestDist) {
        closest = player;
        closestDist = dist;
      }
    }

    return closest;
  }

  private findHighestThreat(mob: Mob, world: World): Player | null {
    let highestThreat = 0;
    let target: Player | null = null;

    for (const [playerId, threat] of mob.threatTable) {
      const player = world.getPlayer(playerId);
      if (player && !player.isDead && !this.buffSystem.hasBuff(playerId, 'buff-vanish') && threat > highestThreat) {
        highestThreat = threat;
        target = player;
      }
    }

    return target;
  }

  private calculateDamage(attack: number, defense: number): number {
    const base = attack * (attack / (attack + defense));
    const variance = 0.85 + Math.random() * 0.30;
    return Math.round(base * variance);
  }
}
