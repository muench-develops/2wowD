import { ClassStats, ClassType, AbilityDef, BuffDef, MobType } from './types.js';

// ============================================================
// Game Constants
// ============================================================

export const TICK_RATE = 20; // server ticks per second
export const TICK_INTERVAL = 1000 / TICK_RATE;
export const TILE_SIZE = 64; // pixels
export const MAP_WIDTH = 50; // tiles
export const MAP_HEIGHT = 50; // tiles

// Isometric tile dimensions
export const ISO_TILE_WIDTH = 64;
export const ISO_TILE_HEIGHT = 32;

// Player
export const PLAYER_SPAWN_X = 25;
export const PLAYER_SPAWN_Y = 25;
export const RESPAWN_TIME = 5000; // ms

// Combat
export const AUTO_ATTACK_RANGE_MELEE = 1.5;
export const AUTO_ATTACK_RANGE_RANGED = 8;
export const AGGRO_RANGE = 6;
export const LEASH_RANGE = 15;
export const MOB_PATROL_RANGE = 3;
export const HEALTH_REGEN_RATE = 0.02; // % of max per tick (out of combat)
export const MANA_REGEN_RATE = 0.03; // % of max per tick

// Chat
export const SAY_RANGE = 10;
export const MAX_CHAT_LENGTH = 200;
export const CHAT_RATE_LIMIT = 5; // messages per second

// Auth
export const MAX_CHARACTERS_PER_ACCOUNT = 4;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 20;
export const MIN_PASSWORD_LENGTH = 4;
export const MIN_CHARACTER_NAME_LENGTH = 2;
export const MAX_CHARACTER_NAME_LENGTH = 16;

// Network
export const SERVER_PORT = 8080;
export const MAX_PLAYERS = 100;

// ============================================================
// Class Definitions
// ============================================================

export const CLASS_STATS: Record<ClassType, ClassStats> = {
  [ClassType.Warrior]: {
    maxHealth: 200,
    maxMana: 50,
    attack: 25,
    defense: 15,
    speed: 3.0,
    attackRange: AUTO_ATTACK_RANGE_MELEE,
    attackSpeed: 1.5,
  },
  [ClassType.Mage]: {
    maxHealth: 100,
    maxMana: 200,
    attack: 35,
    defense: 5,
    speed: 2.8,
    attackRange: AUTO_ATTACK_RANGE_RANGED,
    attackSpeed: 1.0,
  },
  [ClassType.Rogue]: {
    maxHealth: 120,
    maxMana: 80,
    attack: 30,
    defense: 8,
    speed: 3.5,
    attackRange: AUTO_ATTACK_RANGE_MELEE,
    attackSpeed: 2.0,
  },
  [ClassType.Priest]: {
    maxHealth: 110,
    maxMana: 180,
    attack: 15,
    defense: 7,
    speed: 2.8,
    attackRange: AUTO_ATTACK_RANGE_RANGED,
    attackSpeed: 1.2,
  },
};

// ============================================================
// Combat Chances
// ============================================================

export const CLASS_COMBAT_CHANCES: Record<ClassType, { critChance: number; dodgeChance: number }> = {
  [ClassType.Warrior]: { critChance: 0.08, dodgeChance: 0.03 },
  [ClassType.Mage]: { critChance: 0.10, dodgeChance: 0.03 },
  [ClassType.Rogue]: { critChance: 0.15, dodgeChance: 0.10 },
  [ClassType.Priest]: { critChance: 0.05, dodgeChance: 0.03 },
};
export const CRIT_MULTIPLIER = 1.5;
export const RANGED_MISS_CHANCE = 0.05;

// ============================================================
// Ability Definitions
// ============================================================

export const CLASS_ABILITIES: Record<ClassType, AbilityDef[]> = {
  [ClassType.Warrior]: [
    {
      id: 'warrior-charge',
      name: 'Charge',
      description: 'Rush to the target, dealing damage',
      manaCost: 15,
      cooldown: 8,
      range: 8,
      damage: 40,
      healAmount: 0,
      castTime: 0,
      aoe: false,
      aoeRadius: 0,
    },
    {
      id: 'warrior-whirlwind',
      name: 'Whirlwind',
      description: 'Spin and damage all nearby enemies',
      manaCost: 25,
      cooldown: 10,
      range: 0,
      damage: 30,
      healAmount: 0,
      castTime: 0,
      aoe: true,
      aoeRadius: 2,
    },
    {
      id: 'warrior-shield-block',
      name: 'Shield Block',
      description: 'Block incoming damage for 3 seconds',
      manaCost: 10,
      cooldown: 15,
      range: 0,
      damage: 0,
      healAmount: 0,
      castTime: 0,
      aoe: false,
      aoeRadius: 0,
    },
  ],
  [ClassType.Mage]: [
    {
      id: 'mage-fireball',
      name: 'Fireball',
      description: 'Hurl a ball of fire at the target',
      manaCost: 30,
      cooldown: 3,
      range: 10,
      damage: 60,
      healAmount: 0,
      castTime: 1.5,
      aoe: false,
      aoeRadius: 0,
    },
    {
      id: 'mage-frost-bolt',
      name: 'Frost Bolt',
      description: 'Launch a bolt of frost, slowing the target',
      manaCost: 20,
      cooldown: 2,
      range: 10,
      damage: 35,
      healAmount: 0,
      castTime: 1.0,
      aoe: false,
      aoeRadius: 0,
    },
    {
      id: 'mage-blizzard',
      name: 'Blizzard',
      description: 'Call down a blizzard on an area',
      manaCost: 50,
      cooldown: 15,
      range: 8,
      damage: 40,
      healAmount: 0,
      castTime: 2.0,
      aoe: true,
      aoeRadius: 3,
    },
  ],
  [ClassType.Rogue]: [
    {
      id: 'rogue-backstab',
      name: 'Backstab',
      description: 'Strike from behind for massive damage',
      manaCost: 20,
      cooldown: 6,
      range: 1.5,
      damage: 55,
      healAmount: 0,
      castTime: 0,
      aoe: false,
      aoeRadius: 0,
    },
    {
      id: 'rogue-eviscerate',
      name: 'Eviscerate',
      description: 'A vicious finishing move',
      manaCost: 25,
      cooldown: 8,
      range: 1.5,
      damage: 65,
      healAmount: 0,
      castTime: 0,
      aoe: false,
      aoeRadius: 0,
    },
    {
      id: 'rogue-vanish',
      name: 'Vanish',
      description: 'Disappear from sight, dropping aggro',
      manaCost: 30,
      cooldown: 20,
      range: 0,
      damage: 0,
      healAmount: 0,
      castTime: 0,
      aoe: false,
      aoeRadius: 0,
    },
  ],
  [ClassType.Priest]: [
    {
      id: 'priest-heal',
      name: 'Heal',
      description: 'Restore health to the target',
      manaCost: 30,
      cooldown: 2,
      range: 10,
      damage: 0,
      healAmount: 50,
      castTime: 1.5,
      aoe: false,
      aoeRadius: 0,
    },
    {
      id: 'priest-shield',
      name: 'Power Word: Shield',
      description: 'Shield the target, absorbing damage',
      manaCost: 25,
      cooldown: 12,
      range: 10,
      damage: 0,
      healAmount: 40,
      castTime: 0,
      aoe: false,
      aoeRadius: 0,
    },
    {
      id: 'priest-smite',
      name: 'Smite',
      description: 'Smite the enemy with holy fire',
      manaCost: 20,
      cooldown: 2,
      range: 10,
      damage: 35,
      healAmount: 0,
      castTime: 1.0,
      aoe: false,
      aoeRadius: 0,
    },
  ],
};

// ============================================================
// XP & Leveling
// ============================================================

export const XP_BASE = 100;
export const XP_EXPONENT = 1.5;
export const LEVEL_CAP = 20;

export function xpForLevel(level: number): number {
  return Math.floor(XP_BASE * Math.pow(level, XP_EXPONENT));
}

export interface LevelStatScaling {
  hp: number;
  mp: number;
  atk: number;
  def: number;
}

export const LEVEL_STAT_SCALING: Record<ClassType, LevelStatScaling> = {
  [ClassType.Warrior]: { hp: 20, mp: 3, atk: 2, def: 2 },
  [ClassType.Mage]:    { hp: 8,  mp: 15, atk: 3, def: 1 },
  [ClassType.Rogue]:   { hp: 10, mp: 5, atk: 3, def: 1 },
  [ClassType.Priest]:  { hp: 9,  mp: 12, atk: 1, def: 1 },
};

// ============================================================
// Mob Definitions
// ============================================================

export interface MobDef {
  type: MobType;
  name: string;
  maxHealth: number;
  attack: number;
  defense: number;
  speed: number;
  attackRange: number;
  attackSpeed: number;
  level: number;
  xpReward: number;
}

export const MOB_DEFINITIONS: Record<MobType, MobDef> = {
  [MobType.Goblin]: {
    type: MobType.Goblin,
    name: 'Goblin',
    maxHealth: 60,
    attack: 10,
    defense: 3,
    speed: 2.5,
    attackRange: 1.5,
    attackSpeed: 1.5,
    level: 1,
    xpReward: 20,
  },
  [MobType.Skeleton]: {
    type: MobType.Skeleton,
    name: 'Skeleton',
    maxHealth: 100,
    attack: 15,
    defense: 8,
    speed: 2.0,
    attackRange: 1.5,
    attackSpeed: 1.2,
    level: 2,
    xpReward: 35,
  },
  [MobType.Wolf]: {
    type: MobType.Wolf,
    name: 'Wolf',
    maxHealth: 50,
    attack: 18,
    defense: 4,
    speed: 3.5,
    attackRange: 1.5,
    attackSpeed: 2.0,
    level: 1,
    xpReward: 25,
  },
};

// ============================================================
// Buff Definitions
// ============================================================

export const BUFF_DEFINITIONS: Record<string, BuffDef> = {
  'buff-shield-block': {
    id: 'buff-shield-block',
    name: 'Shield Block',
    duration: 5000,
    statModifiers: { defense: 1.5 },
    tickDamage: 0,
    tickHeal: 0,
    tickInterval: 0,
    isDebuff: false,
  },
  'buff-frostbite': {
    id: 'buff-frostbite',
    name: 'Frostbite',
    duration: 3000,
    statModifiers: { speed: 0.7 },
    tickDamage: 0,
    tickHeal: 0,
    tickInterval: 0,
    isDebuff: true,
  },
  'buff-vanish': {
    id: 'buff-vanish',
    name: 'Vanish',
    duration: 3000,
    statModifiers: {},
    tickDamage: 0,
    tickHeal: 0,
    tickInterval: 0,
    isDebuff: false,
  },
  'buff-pw-shield': {
    id: 'buff-pw-shield',
    name: 'PW: Shield',
    duration: 10000,
    statModifiers: {},
    tickDamage: 0,
    tickHeal: 0,
    tickInterval: 0,
    isDebuff: false,
  },
};

/** Maps ability IDs to the buff they apply and whether it targets self or the ability target */
export const ABILITY_BUFF_MAP: Record<string, { buffId: string; targetSelf: boolean }> = {
  'warrior-shield-block': { buffId: 'buff-shield-block', targetSelf: true },
  'mage-frost-bolt':      { buffId: 'buff-frostbite',    targetSelf: false },
  'rogue-vanish':         { buffId: 'buff-vanish',       targetSelf: true },
  'priest-shield':        { buffId: 'buff-pw-shield',    targetSelf: false },
};
