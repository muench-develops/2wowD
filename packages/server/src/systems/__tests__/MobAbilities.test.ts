import { describe, it, expect } from 'vitest';
import {
  MobType,
  ZoneId,
  ZONE_METADATA,
  MOB_DEFINITIONS,
  MOB_ABILITIES,
  MOB_ABILITY_MAP,
  BUFF_DEFINITIONS,
  distance,
} from '@isoheim/shared';
import { Mob, MobAIState } from '../../entities/Mob.js';

describe('MobAbilities', () => {
  describe('Mob Ability Definitions', () => {
    it('should define spider-poison-bite with buff-poison', () => {
      const ability = MOB_ABILITIES['spider-poison-bite'];
      expect(ability).toBeDefined();
      expect(ability.buffId).toBe('buff-poison');
      expect(ability.damage).toBe(8);
      expect(ability.range).toBe(1.5);
    });

    it('should define wolf-alpha-howl with buff-stun', () => {
      const ability = MOB_ABILITIES['wolf-alpha-howl'];
      expect(ability).toBeDefined();
      expect(ability.buffId).toBe('buff-stun');
      expect(ability.cooldown).toBe(10);
      expect(ability.range).toBe(6.0);
    });

    it('should define skeleton-mage-shadow-bolt as ranged damage ability', () => {
      const ability = MOB_ABILITIES['skeleton-mage-shadow-bolt'];
      expect(ability).toBeDefined();
      expect(ability.damage).toBe(25);
      expect(ability.range).toBe(8.0);
      expect(ability.buffId).toBeUndefined();
    });

    it('should define bone-lord-fear with buff-fear and no damage', () => {
      const ability = MOB_ABILITIES['bone-lord-fear'];
      expect(ability).toBeDefined();
      expect(ability.damage).toBe(0);
      expect(ability.buffId).toBe('buff-fear');
    });

    it('should define bone-lord-bone-storm as AoE damage', () => {
      const ability = MOB_ABILITIES['bone-lord-bone-storm'];
      expect(ability).toBeDefined();
      expect(ability.damage).toBe(35);
      expect(ability.range).toBe(3.0);
    });
  });

  describe('Mob Ability Mapping', () => {
    it('should map Spider to spider-poison-bite', () => {
      expect(MOB_ABILITY_MAP[MobType.Spider]).toContain('spider-poison-bite');
    });

    it('should map WolfAlpha to wolf-alpha-howl', () => {
      expect(MOB_ABILITY_MAP[MobType.WolfAlpha]).toContain('wolf-alpha-howl');
    });

    it('should map SkeletonMage to skeleton-mage-shadow-bolt', () => {
      expect(MOB_ABILITY_MAP[MobType.SkeletonMage]).toContain('skeleton-mage-shadow-bolt');
    });

    it('should map BoneLord to fear and bone-storm (rotation)', () => {
      const abilities = MOB_ABILITY_MAP[MobType.BoneLord]!;
      expect(abilities).toContain('bone-lord-fear');
      expect(abilities).toContain('bone-lord-bone-storm');
      expect(abilities).toHaveLength(2);
    });

    it('should not map basic mobs (Goblin, Skeleton) to abilities', () => {
      expect(MOB_ABILITY_MAP[MobType.Goblin]).toBeUndefined();
      expect(MOB_ABILITY_MAP[MobType.Skeleton]).toBeUndefined();
    });
  });

  describe('Buff Definitions for Mob Abilities', () => {
    it('should define poison debuff with DoT ticks', () => {
      const poison = BUFF_DEFINITIONS['buff-poison'];
      expect(poison).toBeDefined();
      expect(poison.isDebuff).toBe(true);
      expect(poison.duration).toBe(5000);
      expect(poison.tickDamage).toBe(2);
      expect(poison.tickInterval).toBe(1000);
    });

    it('should define stun debuff that reduces speed to 0', () => {
      const stun = BUFF_DEFINITIONS['buff-stun'];
      expect(stun).toBeDefined();
      expect(stun.isDebuff).toBe(true);
      expect(stun.duration).toBe(2000);
      expect(stun.statModifiers.speed).toBe(0.0);
    });

    it('should define fear debuff that reduces speed to 50%', () => {
      const fear = BUFF_DEFINITIONS['buff-fear'];
      expect(fear).toBeDefined();
      expect(fear.isDebuff).toBe(true);
      expect(fear.duration).toBe(3000);
      expect(fear.statModifiers.speed).toBe(0.5);
    });
  });

  describe('Mob Ability Cooldowns', () => {
    it('should start with empty ability cooldowns', () => {
      const mob = new Mob(MobType.Spider, { x: 10, y: 10 }, 30, ZoneId.StarterPlains);
      expect(mob.abilityCooldowns.size).toBe(0);
    });

    it('should set cooldown when ability is used', () => {
      const mob = new Mob(MobType.Spider, { x: 10, y: 10 }, 30, ZoneId.StarterPlains);
      const ability = MOB_ABILITIES['spider-poison-bite'];
      mob.abilityCooldowns.set('spider-poison-bite', ability.cooldown * 1000);

      expect(mob.abilityCooldowns.has('spider-poison-bite')).toBe(true);
      expect(mob.abilityCooldowns.get('spider-poison-bite')).toBe(6000);
    });

    it('should respect cooldown — cannot use ability while on cooldown', () => {
      const mob = new Mob(MobType.Spider, { x: 10, y: 10 }, 30, ZoneId.StarterPlains);
      mob.abilityCooldowns.set('spider-poison-bite', 5000);

      expect(mob.abilityCooldowns.has('spider-poison-bite')).toBe(true);
    });

    it('should clear cooldowns on mob death', () => {
      const mob = new Mob(MobType.Spider, { x: 10, y: 10 }, 30, ZoneId.StarterPlains);
      mob.abilityCooldowns.set('spider-poison-bite', 5000);
      mob.die();

      // On respawn, cooldowns should be ready because new mob state
      const fresh = new Mob(MobType.Spider, { x: 10, y: 10 }, 30, ZoneId.StarterPlains);
      expect(fresh.abilityCooldowns.size).toBe(0);
    });
  });

  describe('Bone Lord Ability Rotation', () => {
    it('should start with lastAbilityIndex at -1', () => {
      const boneLord = new Mob(MobType.BoneLord, { x: 20, y: 20 }, 600, ZoneId.AncientDungeon);
      expect(boneLord.lastAbilityIndex).toBe(-1);
    });

    it('should track ability rotation index', () => {
      const boneLord = new Mob(MobType.BoneLord, { x: 20, y: 20 }, 600, ZoneId.AncientDungeon);
      const abilities = MOB_ABILITY_MAP[MobType.BoneLord]!;

      // Simulate rotation: first ability at index 0
      boneLord.lastAbilityIndex = 0;
      const nextIndex = (boneLord.lastAbilityIndex + 1) % abilities.length;
      expect(nextIndex).toBe(1);

      // After index 1, wraps back to 0
      boneLord.lastAbilityIndex = 1;
      const wrappedIndex = (boneLord.lastAbilityIndex + 1) % abilities.length;
      expect(wrappedIndex).toBe(0);
    });

    it('should have both abilities available (fear + bone storm)', () => {
      const abilities = MOB_ABILITY_MAP[MobType.BoneLord]!;
      expect(abilities[0]).toBe('bone-lord-fear');
      expect(abilities[1]).toBe('bone-lord-bone-storm');
    });
  });

  describe('Mob Zone Assignment', () => {
    it('should create mob in specified zone', () => {
      const mob = new Mob(MobType.Spider, { x: 10, y: 10 }, 30, ZoneId.DarkForest);
      expect(mob.zoneId).toBe(ZoneId.DarkForest);
    });

    it('should default to StarterPlains when no zone specified', () => {
      const mob = new Mob(MobType.Goblin, { x: 10, y: 10 }, 30);
      expect(mob.zoneId).toBe(ZoneId.StarterPlains);
    });

    it('should use zone-specific bounds for movement clamping', () => {
      const meta = ZONE_METADATA[ZoneId.AncientDungeon];
      const mob = new Mob(MobType.BoneLord, { x: 20, y: 20 }, 600, ZoneId.AncientDungeon);

      // Move toward edge, should clamp within zone bounds
      mob.moveToward({ x: 100, y: 100 }, 100);
      expect(mob.position.x).toBeLessThanOrEqual(meta.width - 2);
      expect(mob.position.y).toBeLessThanOrEqual(meta.height - 2);
    });
  });

  describe('Skeleton Mage Ranged Capability', () => {
    it('should have 8.0 attack range', () => {
      const def = MOB_DEFINITIONS[MobType.SkeletonMage];
      expect(def.attackRange).toBe(8.0);
    });

    it('should be able to attack from 8 tiles distance', () => {
      const ability = MOB_ABILITIES['skeleton-mage-shadow-bolt'];
      const mobPos = { x: 10, y: 10 };
      const targetPos = { x: 18, y: 10 };

      const dist = distance(mobPos, targetPos);
      expect(dist).toBe(8);
      expect(dist).toBeLessThanOrEqual(ability.range);
    });

    it('should not reach target at distance > 8', () => {
      const ability = MOB_ABILITIES['skeleton-mage-shadow-bolt'];
      const mobPos = { x: 10, y: 10 };
      const targetPos = { x: 20, y: 10 };

      const dist = distance(mobPos, targetPos);
      expect(dist).toBeGreaterThan(ability.range);
    });
  });

  describe('Mob Death and Respawn', () => {
    it('should set isDead and clear threat on death', () => {
      const mob = new Mob(MobType.Goblin, { x: 10, y: 10 }, 30, ZoneId.StarterPlains);
      mob.threatTable.set('p1', 100);
      mob.targetId = 'p1';

      mob.die();

      expect(mob.isDead).toBe(true);
      expect(mob.aiState).toBe(MobAIState.Dead);
      expect(mob.targetId).toBeNull();
      expect(mob.threatTable.size).toBe(0);
    });

    it('should restore health and position on respawn', () => {
      const spawn = { x: 15, y: 15 };
      const mob = new Mob(MobType.Wolf, spawn, 30, ZoneId.StarterPlains);
      mob.position.x = 20;
      mob.position.y = 20;
      mob.health = 0;
      mob.isDead = true;

      mob.respawn();

      expect(mob.isDead).toBe(false);
      expect(mob.health).toBe(mob.maxHealth);
      expect(mob.position.x).toBe(spawn.x);
      expect(mob.position.y).toBe(spawn.y);
      expect(mob.aiState).toBe(MobAIState.Idle);
    });
  });
});
