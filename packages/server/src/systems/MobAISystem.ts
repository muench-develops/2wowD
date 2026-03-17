import {
  AGGRO_RANGE,
  LEASH_RANGE,
  MOB_PATROL_RANGE,
  distance,
  ServerMessageType,
  MOB_ABILITIES,
  MOB_ABILITY_MAP,
  BUFF_DEFINITIONS,
  MobType,
} from '@isoheim/shared';
import { Mob, MobAIState } from '../entities/Mob.js';
import { Player } from '../entities/Player.js';
import { World } from '../core/World.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { BuffSystem } from './BuffSystem.js';

// --- MobAISystem constants ---
const MS_PER_SECOND = 1000;
const PATROL_COOLDOWN_BASE_MS = 3000;
const PATROL_COOLDOWN_RANDOM_MS = 5000;
const PATROL_MAX_ATTEMPTS = 5;
const ARRIVAL_THRESHOLD_TILES = 0.3;
const PATROL_SPEED_MULTIPLIER = 0.5;
const LEASH_RETURN_SPEED_MULTIPLIER = 1.5;
const DAMAGE_VARIANCE_MIN = 0.85;
const DAMAGE_VARIANCE_RANGE = 0.30;

export class MobAISystem {
  private network: NetworkManager;
  private buffSystem: BuffSystem;

  constructor(network: NetworkManager, buffSystem: BuffSystem) {
    this.network = network;
    this.buffSystem = buffSystem;
  }

  update(world: World, deltaMs: number, now: number): void {
    const deltaSeconds = deltaMs / MS_PER_SECOND;

    for (const zone of world.zoneManager.getAllZones()) {
      for (const mob of zone.mobs.values()) {
        if (mob.isDead) continue;

        this.updateAbilityCooldowns(mob, deltaMs);

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
            this.processLeash(mob, world, deltaSeconds);
            break;
        }
      }
    }
  }

  private updateAbilityCooldowns(mob: Mob, deltaMs: number): void {
    for (const [abilityId, cooldown] of mob.abilityCooldowns) {
      const remaining = Math.max(0, cooldown - deltaMs);
      if (remaining <= 0) {
        mob.abilityCooldowns.delete(abilityId);
      } else {
        mob.abilityCooldowns.set(abilityId, remaining);
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
      mob.patrolCooldown = PATROL_COOLDOWN_BASE_MS + Math.random() * PATROL_COOLDOWN_RANDOM_MS;
      for (let attempt = 0; attempt < PATROL_MAX_ATTEMPTS; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * MOB_PATROL_RANGE;
        const tx = mob.spawnOrigin.x + Math.cos(angle) * dist;
        const ty = mob.spawnOrigin.y + Math.sin(angle) * dist;
        if (!world.isCollision(tx, ty, mob.zoneId)) {
          mob.patrolTarget = { x: tx, y: ty };
          mob.aiState = MobAIState.Patrol;
          break;
        }
      }
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
    if (dist < ARRIVAL_THRESHOLD_TILES) {
      mob.patrolTarget = null;
      mob.aiState = MobAIState.Idle;
      return;
    }

    mob.moveToward(mob.patrolTarget, deltaSeconds * PATROL_SPEED_MULTIPLIER, world);
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

    mob.moveToward(target.position, deltaSeconds, world);
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

    // Try to use ability first (if mob has abilities)
    const usedAbility = this.tryUseAbility(mob, target, world, now);
    
    // Auto attack if not using ability and can attack
    if (!usedAbility && mob.canAutoAttack(now)) {
      this.processAutoAttack(mob, target, world, now);
    }
  }

  private processAutoAttack(mob: Mob, target: Player, world: World, now: number): void {
    const effectivePlayerStats = target.getEffectiveStats(this.buffSystem);
    const effectiveMobStats = mob.getEffectiveStats(this.buffSystem);
    const rawDamage = this.calculateDamage(effectiveMobStats.attack, effectivePlayerStats.defense);
    const event = target.takeDamage(rawDamage, mob.id);
    mob.lastAutoAttackTime = now;

    this.network.broadcastToZone(mob.zoneId, {
      type: ServerMessageType.DamageDealt,
      event,
    });

    if (target.isDead) {
      this.network.broadcastToZone(mob.zoneId, {
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

  private processLeash(mob: Mob, world: World, deltaSeconds: number): void {
    const dist = distance(mob.position, mob.spawnOrigin);
    if (dist < ARRIVAL_THRESHOLD_TILES) {
      mob.aiState = MobAIState.Idle;
      mob.health = mob.maxHealth;
      return;
    }

    mob.moveToward(mob.spawnOrigin, deltaSeconds * LEASH_RETURN_SPEED_MULTIPLIER, world);
  }

  private findAggroTarget(mob: Mob, world: World): Player | null {
    let closest: Player | null = null;
    let closestDist = AGGRO_RANGE;

    const zonePlayers = world.getZonePlayers(mob.zoneId);
    for (const player of zonePlayers.values()) {
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
    const zonePlayers = world.getZonePlayers(mob.zoneId);

    for (const [playerId, threat] of mob.threatTable) {
      const player = zonePlayers.get(playerId);
      if (player && !player.isDead && !this.buffSystem.hasBuff(playerId, 'buff-vanish') && threat > highestThreat) {
        highestThreat = threat;
        target = player;
      }
    }

    return target;
  }

  private calculateDamage(attack: number, defense: number): number {
    const base = attack * (attack / (attack + defense));
    const variance = DAMAGE_VARIANCE_MIN + Math.random() * DAMAGE_VARIANCE_RANGE;
    return Math.round(base * variance);
  }

  /** Try to use a mob ability if available and off cooldown */
  private tryUseAbility(mob: Mob, target: Player, world: World, now: number): boolean {
    const abilityIds = MOB_ABILITY_MAP[mob.mobType];
    if (!abilityIds || abilityIds.length === 0) return false;

    // For Bone Lord, rotate through abilities
    if (mob.mobType === MobType.BoneLord) {
      return this.useBoneLordAbility(mob, target, world, now, abilityIds);
    }

    // For other mobs, try each ability in order
    for (const abilityId of abilityIds) {
      if (this.canUseAbility(mob, abilityId, target)) {
        this.useAbility(mob, abilityId, target, world, now);
        return true;
      }
    }

    return false;
  }

  private useBoneLordAbility(mob: Mob, target: Player, world: World, now: number, abilityIds: string[]): boolean {
    // Try abilities in rotation
    for (let i = 0; i < abilityIds.length; i++) {
      const nextIndex = (mob.lastAbilityIndex + 1 + i) % abilityIds.length;
      const abilityId = abilityIds[nextIndex];
      
      if (this.canUseAbility(mob, abilityId, target)) {
        this.useAbility(mob, abilityId, target, world, now);
        mob.lastAbilityIndex = nextIndex;
        return true;
      }
    }
    return false;
  }

  private canUseAbility(mob: Mob, abilityId: string, target: Player): boolean {
    const ability = MOB_ABILITIES[abilityId];
    if (!ability) return false;

    // Check cooldown
    if (mob.abilityCooldowns.has(abilityId)) return false;

    // Check range
    const dist = distance(mob.position, target.position);
    return dist <= ability.range;
  }

  private useAbility(mob: Mob, abilityId: string, target: Player, _world: World, _now: number): void {
    const ability = MOB_ABILITIES[abilityId];
    if (!ability) return;

    // Apply cooldown
    mob.abilityCooldowns.set(abilityId, ability.cooldown * MS_PER_SECOND);

    // Deal damage if applicable
    if (ability.damage > 0) {
      const damage = this.calculateDamage(mob.def.attack, target.stats.defense);
      target.takeDamage(damage, mob.id);
      
      this.network.broadcastToZone(mob.zoneId, {
        type: ServerMessageType.DamageDealt,
        event: {
          sourceId: mob.id,
          targetId: target.id,
          amount: damage,
          abilityId,
          isCrit: false,
          isDodge: false,
          isMiss: false,
          isHeal: false,
        },
      });
    }

    // Apply buff if applicable
    if (ability.buffId) {
      const buffDef = BUFF_DEFINITIONS[ability.buffId];
      if (buffDef) {
        this.buffSystem.applyBuff(target.id, buffDef);
      }
    }

    console.log(`[MobAI] ${mob.def.name} used ${ability.name} on ${target.name}`);
  }
}
