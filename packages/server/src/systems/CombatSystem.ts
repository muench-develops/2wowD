import {
  DamageEvent,
  ClassType,
  AbilityDef,
  CLASS_COMBAT_CHANCES,
  CRIT_MULTIPLIER,
  RANGED_MISS_CHANCE,
  AUTO_ATTACK_RANGE_MELEE,
  BUFF_DEFINITIONS,
  ABILITY_BUFF_MAP,
  distance,
} from '@isoheim/shared';
import { Player } from '../entities/Player.js';
import { Mob } from '../entities/Mob.js';
import { World } from '../core/World.js';
import { NetworkManager } from '../network/NetworkManager.js';
import { BuffSystem } from './BuffSystem.js';
import { LootSystem } from './LootSystem.js';
import { QuestManager } from './QuestManager.js';
import { ServerMessageType } from '@isoheim/shared';

export class CombatSystem {
  private network: NetworkManager;
  private buffSystem: BuffSystem;
  private lootSystem: LootSystem | null = null;
  private questManager: QuestManager | null = null;

  constructor(network: NetworkManager, buffSystem: BuffSystem) {
    this.network = network;
    this.buffSystem = buffSystem;
  }

  setLootSystem(lootSystem: LootSystem): void {
    this.lootSystem = lootSystem;
  }

  setQuestManager(questManager: QuestManager): void {
    this.questManager = questManager;
  }

  update(world: World, deltaMs: number, now: number): void {
    for (const zone of world.zoneManager.getAllZones()) {
      for (const player of zone.players.values()) {
        player.updateCooldowns(deltaMs);
        player.updateCombatState(now);
        player.regenerate();

        // Respawn timer
        if (player.isDead) {
          player.respawnTimer -= deltaMs;
          if (player.respawnTimer <= 0) {
            player.respawn();
            this.network.broadcastToZone(zone.id, {
              type: ServerMessageType.EntityRespawned,
              entityId: player.id,
              position: { ...player.position },
              health: player.health,
              maxHealth: player.maxHealth,
            });
          }
          continue;
        }

        // Auto-attack
        if (player.targetId && player.canAutoAttack(now)) {
          this.processAutoAttack(player, world, now);
        }
      }
    }
  }

  private processAutoAttack(player: Player, world: World, now: number): void {
    const targetId = player.targetId!;

    // Try mob target first
    const mob = world.getMob(targetId);
    if (mob && !mob.isDead) {
      const dist = distance(player.position, mob.position);
      if (dist <= player.stats.attackRange) {
        const isMelee = player.stats.attackRange <= AUTO_ATTACK_RANGE_MELEE;
        const outcome = this.rollCombatOutcome(player.classType, 0, isMelee);
        const effectiveStats = player.getEffectiveStats(this.buffSystem);
        const effectiveMobStats = mob.getEffectiveStats(this.buffSystem);

        player.lastAutoAttackTime = now;
        player.inCombat = true;
        player.lastCombatTime = now;

        let event: DamageEvent;
        if (outcome.isDodge || outcome.isMiss) {
          event = {
            sourceId: player.id,
            targetId: mob.id,
            amount: 0,
            abilityId: null,
            isCrit: false,
            isDodge: outcome.isDodge,
            isMiss: outcome.isMiss,
            isHeal: false,
          };
        } else {
          let rawDamage = this.calculateDamage(effectiveStats.attack, effectiveMobStats.defense);
          if (outcome.isCrit) {
            rawDamage = Math.round(rawDamage * CRIT_MULTIPLIER);
          }
          event = mob.takeDamage(rawDamage, player.id);
          event.isCrit = outcome.isCrit;
        }

        this.network.broadcastToZone(player.currentZone, {
          type: ServerMessageType.DamageDealt,
          event,
        });

        if (mob.isDead) {
          this.network.broadcastToZone(player.currentZone, {
            type: ServerMessageType.EntityDied,
            entityId: mob.id,
            killerName: player.name,
          });
          this.awardXp(player, mob);
          this.lootSystem?.createLootFromMob(mob, world, player.id);
          this.questManager?.onMobKill(player, mob.mobType);
        }
      }
      return;
    }

    // Try player target (PvP not implemented - clear target)
    const targetPlayer = world.getPlayer(targetId);
    if (!targetPlayer || targetPlayer.isDead) {
      player.targetId = null;
    }
  }

  processAbility(
    player: Player,
    abilityId: string,
    targetId: string | null,
    world: World,
    now: number,
  ): void {
    const check = player.canUseAbility(abilityId);
    if (!check.ok) {
      this.network.sendToPlayer(player.id, {
        type: ServerMessageType.Error,
        message: check.reason!,
      });
      return;
    }

    const ability = player.abilities.find((a) => a.id === abilityId)!;

    // Validate target for targeted abilities
    if (ability.range > 0 && !ability.aoe) {
      if (!targetId) {
        this.network.sendToPlayer(player.id, {
          type: ServerMessageType.Error,
          message: 'No target selected',
        });
        return;
      }
    }

    // Deduct mana and start cooldown
    player.mana -= ability.manaCost;
    player.startCooldown(abilityId);

    // Broadcast cast
    this.network.broadcastToZone(player.currentZone, {
      type: ServerMessageType.AbilityCast,
      casterId: player.id,
      abilityId,
      targetId,
      targetPosition: null,
    });

    // Send cooldown update to caster
    this.network.sendToPlayer(player.id, {
      type: ServerMessageType.CooldownUpdate,
      cooldowns: player.getCooldownStates(),
    });

    // Apply effects
    if (ability.healAmount > 0) {
      this.applyHeal(player, ability, targetId, world);
    } else if (ability.damage > 0) {
      if (ability.aoe) {
        this.applyAoeDamage(player, ability, world, now);
      } else {
        this.applySingleTargetDamage(player, ability, targetId!, world, now);
      }
    }

    // Apply buff/debuff if this ability has one
    const buffMapping = ABILITY_BUFF_MAP[abilityId];
    if (buffMapping) {
      const buffDef = BUFF_DEFINITIONS[buffMapping.buffId];
      if (buffDef) {
        if (buffMapping.targetSelf) {
          this.buffSystem.applyBuff(player.id, buffDef);

          // Vanish special: clear all mob aggro on this player in their zone
          if (buffDef.id === 'buff-vanish') {
            const zoneMobs = world.getZoneMobs(player.currentZone);
            for (const mob of zoneMobs.values()) {
              if (mob.targetId === player.id) {
                mob.targetId = null;
                mob.threatTable.delete(player.id);
              }
            }
          }
        } else if (targetId) {
          // Apply to ability target (player or mob)
          const targetPlayer = world.getPlayer(targetId);
          const targetMob = world.getMob(targetId);
          if (targetPlayer || targetMob) {
            this.buffSystem.applyBuff(targetId, buffDef);
          }
        }
      }
    }
  }

  private applyHeal(
    player: Player,
    ability: AbilityDef,
    targetId: string | null,
    world: World,
  ): void {
    // Heal self if no target or target is self
    const target = targetId ? world.getPlayer(targetId) ?? player : player;

    const critChance = CLASS_COMBAT_CHANCES[player.classType].critChance;
    const isCrit = Math.random() < critChance;
    const healAmount = isCrit ? Math.round(ability.healAmount * CRIT_MULTIPLIER) : ability.healAmount;

    const event = target.heal(healAmount, player.id, ability.id);
    event.isCrit = isCrit;
    this.network.broadcastToZone(player.currentZone, {
      type: ServerMessageType.DamageDealt,
      event,
    });
  }

  private applySingleTargetDamage(
    player: Player,
    ability: AbilityDef,
    targetId: string,
    world: World,
    now: number,
  ): void {
    const mob = world.getMob(targetId);
    if (!mob || mob.isDead) {
      this.network.sendToPlayer(player.id, {
        type: ServerMessageType.Error,
        message: 'Invalid target',
      });
      return;
    }

    const dist = distance(player.position, mob.position);
    if (dist > ability.range) {
      this.network.sendToPlayer(player.id, {
        type: ServerMessageType.Error,
        message: 'Out of range',
      });
      return;
    }

    const isMelee = ability.range <= AUTO_ATTACK_RANGE_MELEE;
    const outcome = this.rollCombatOutcome(player.classType, 0, isMelee);
    const effectiveStats = player.getEffectiveStats(this.buffSystem);
    const effectiveMobStats = mob.getEffectiveStats(this.buffSystem);

    player.inCombat = true;
    player.lastCombatTime = now;

    let event: DamageEvent;
    if (outcome.isDodge || outcome.isMiss) {
      event = {
        sourceId: player.id,
        targetId: mob.id,
        amount: 0,
        abilityId: ability.id,
        isCrit: false,
        isDodge: outcome.isDodge,
        isMiss: outcome.isMiss,
        isHeal: false,
      };
    } else {
      let rawDamage = this.calculateAbilityDamage(ability.damage, effectiveStats.attack, effectiveMobStats.defense);
      if (outcome.isCrit) {
        rawDamage = Math.round(rawDamage * CRIT_MULTIPLIER);
      }
      event = mob.takeDamage(rawDamage, player.id);
      event.abilityId = ability.id;
      event.isCrit = outcome.isCrit;
    }

    this.network.broadcastToZone(player.currentZone, {
      type: ServerMessageType.DamageDealt,
      event,
    });

    if (mob.isDead) {
      this.network.broadcastToZone(player.currentZone, {
        type: ServerMessageType.EntityDied,
        entityId: mob.id,
        killerName: player.name,
      });
      this.awardXp(player, mob);
      this.lootSystem?.createLootFromMob(mob, world, player.id);
    }
  }

  private applyAoeDamage(
    player: Player,
    ability: AbilityDef,
    world: World,
    now: number,
  ): void {
    const center = player.position;
    const mobs = world.getMobsNear(center, ability.aoeRadius, player.currentZone);
    const isMelee = ability.range <= AUTO_ATTACK_RANGE_MELEE;

    player.inCombat = true;
    player.lastCombatTime = now;

    for (const mob of mobs) {
      const outcome = this.rollCombatOutcome(player.classType, 0, isMelee);
      const effectiveStats = player.getEffectiveStats(this.buffSystem);
      const effectiveMobStats = mob.getEffectiveStats(this.buffSystem);

      let event: DamageEvent;
      if (outcome.isDodge || outcome.isMiss) {
        event = {
          sourceId: player.id,
          targetId: mob.id,
          amount: 0,
          abilityId: ability.id,
          isCrit: false,
          isDodge: outcome.isDodge,
          isMiss: outcome.isMiss,
          isHeal: false,
        };
      } else {
        let rawDamage = this.calculateAbilityDamage(ability.damage, effectiveStats.attack, effectiveMobStats.defense);
        if (outcome.isCrit) {
          rawDamage = Math.round(rawDamage * CRIT_MULTIPLIER);
        }
        event = mob.takeDamage(rawDamage, player.id);
        event.abilityId = ability.id;
        event.isCrit = outcome.isCrit;
      }

      this.network.broadcastToZone(player.currentZone, {
        type: ServerMessageType.DamageDealt,
        event,
      });

      if (mob.isDead) {
        this.network.broadcastToZone(player.currentZone, {
          type: ServerMessageType.EntityDied,
          entityId: mob.id,
          killerName: player.name,
        });
        this.awardXp(player, mob);
        this.lootSystem?.createLootFromMob(mob, world, player.id);
        this.questManager?.onMobKill(player, mob.mobType);
      }
    }
  }

  private awardXp(player: Player, mob: Mob): void {
    const xpReward = mob.def.xpReward;
    const leveled = player.addXp(xpReward);
    if (leveled) {
      this.network.broadcastToZone(player.currentZone, {
        type: ServerMessageType.LevelUp,
        playerId: player.id,
        newLevel: player.level,
      });
    }
  }

  calculateDamage(attack: number, defense: number): number {
    const base = attack * (attack / (attack + defense));
    const variance = 0.85 + Math.random() * 0.30; // ±15%
    return Math.round(base * variance);
  }

  calculateAbilityDamage(baseDamage: number, attack: number, defense: number): number {
    const scaled = baseDamage * (attack / (attack + defense));
    const variance = 0.85 + Math.random() * 0.30;
    return Math.round(scaled * variance);
  }

  private rollCombatOutcome(
    attackerClass: ClassType,
    targetDodgeChance: number,
    isMelee: boolean,
  ): { isCrit: boolean; isDodge: boolean; isMiss: boolean } {
    if (isMelee && Math.random() < targetDodgeChance) {
      return { isCrit: false, isDodge: true, isMiss: false };
    }
    if (!isMelee && Math.random() < RANGED_MISS_CHANCE) {
      return { isCrit: false, isDodge: false, isMiss: true };
    }
    const critChance = CLASS_COMBAT_CHANCES[attackerClass].critChance;
    if (Math.random() < critChance) {
      return { isCrit: true, isDodge: false, isMiss: false };
    }
    return { isCrit: false, isDodge: false, isMiss: false };
  }
}
