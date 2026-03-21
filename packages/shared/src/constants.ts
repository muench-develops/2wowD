import { ClassStats, ClassType, AbilityDef, BuffDef, MobType, ItemDef, ItemType, ItemRarity, ZoneId, ZoneMetadata, Portal, Vec2, EquipmentSlot } from './types.js';

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

// Consumables & Potions
export const POTION_SHARED_COOLDOWN_MS = 15000; // 15s shared potion cooldown
export const BANDAGE_COOLDOWN_MS = 30000; // 30s bandage cooldown
export const TP_SCROLL_COOLDOWN_MS = 60000; // 60s teleport scroll cooldown
export const BANDAGE_HOT_DURATION_MS = 8000; // 8s heal over time
export const BANDAGE_HOT_TOTAL_PERCENT = 50; // 50% max HP total

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
  [MobType.Spider]: {
    type: MobType.Spider,
    name: 'Spider',
    maxHealth: 80,
    attack: 12,
    defense: 5,
    speed: 2.8,
    attackRange: 1.5,
    attackSpeed: 1.8,
    level: 3,
    xpReward: 40,
  },
  [MobType.Bandit]: {
    type: MobType.Bandit,
    name: 'Bandit',
    maxHealth: 120,
    attack: 20,
    defense: 10,
    speed: 3.0,
    attackRange: 1.5,
    attackSpeed: 1.5,
    level: 4,
    xpReward: 50,
  },
  [MobType.WolfAlpha]: {
    type: MobType.WolfAlpha,
    name: 'Wolf Alpha',
    maxHealth: 150,
    attack: 25,
    defense: 12,
    speed: 3.8,
    attackRange: 1.5,
    attackSpeed: 2.0,
    level: 5,
    xpReward: 70,
  },
  [MobType.SkeletonMage]: {
    type: MobType.SkeletonMage,
    name: 'Skeleton Mage',
    maxHealth: 100,
    attack: 30,
    defense: 6,
    speed: 2.2,
    attackRange: 8.0,
    attackSpeed: 1.0,
    level: 6,
    xpReward: 80,
  },
  [MobType.BoneLord]: {
    type: MobType.BoneLord,
    name: 'Bone Lord',
    maxHealth: 400,
    attack: 40,
    defense: 20,
    speed: 2.5,
    attackRange: 1.5,
    attackSpeed: 1.2,
    level: 10,
    xpReward: 200,
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
  'buff-poison': {
    id: 'buff-poison',
    name: 'Poison',
    duration: 5000,
    statModifiers: {},
    tickDamage: 2,
    tickHeal: 0,
    tickInterval: 1000,
    isDebuff: true,
  },
  'buff-stun': {
    id: 'buff-stun',
    name: 'Stun',
    duration: 2000,
    statModifiers: { speed: 0.0 },
    tickDamage: 0,
    tickHeal: 0,
    tickInterval: 0,
    isDebuff: true,
  },
  'buff-fear': {
    id: 'buff-fear',
    name: 'Fear',
    duration: 3000,
    statModifiers: { speed: 0.5 },
    tickDamage: 0,
    tickHeal: 0,
    tickInterval: 0,
    isDebuff: true,
  },
};

/** Maps ability IDs to the buff they apply and whether it targets self or the ability target */
export const ABILITY_BUFF_MAP: Record<string, { buffId: string; targetSelf: boolean }> = {
  'warrior-shield-block': { buffId: 'buff-shield-block', targetSelf: true },
  'mage-frost-bolt':      { buffId: 'buff-frostbite',    targetSelf: false },
  'rogue-vanish':         { buffId: 'buff-vanish',       targetSelf: true },
  'priest-shield':        { buffId: 'buff-pw-shield',    targetSelf: false },
};

// ============================================================
// Mob Abilities
// ============================================================

export interface MobAbilityDef {
  id: string;
  name: string;
  damage: number;
  range: number;
  cooldown: number;
  buffId?: string;
}

export const MOB_ABILITIES: Record<string, MobAbilityDef> = {
  'spider-poison-bite': {
    id: 'spider-poison-bite',
    name: 'Poison Bite',
    damage: 8,
    range: 1.5,
    cooldown: 6,
    buffId: 'buff-poison',
  },
  'skeleton-mage-shadow-bolt': {
    id: 'skeleton-mage-shadow-bolt',
    name: 'Shadow Bolt',
    damage: 25,
    range: 8.0,
    cooldown: 4,
  },
  'bone-lord-fear': {
    id: 'bone-lord-fear',
    name: 'Fear',
    damage: 0,
    range: 5.0,
    cooldown: 12,
    buffId: 'buff-fear',
  },
  'bone-lord-bone-storm': {
    id: 'bone-lord-bone-storm',
    name: 'Bone Storm',
    damage: 35,
    range: 3.0,
    cooldown: 8,
  },
  'wolf-alpha-howl': {
    id: 'wolf-alpha-howl',
    name: 'Howl',
    damage: 0,
    range: 6.0,
    cooldown: 10,
    buffId: 'buff-stun',
  },
};

/** Maps mob types to their available ability IDs */
export const MOB_ABILITY_MAP: Partial<Record<MobType, string[]>> = {
  [MobType.Spider]: ['spider-poison-bite'],
  [MobType.SkeletonMage]: ['skeleton-mage-shadow-bolt'],
  [MobType.BoneLord]: ['bone-lord-fear', 'bone-lord-bone-storm'],
  [MobType.WolfAlpha]: ['wolf-alpha-howl'],
};

// ============================================================
// Zone Definitions
// ============================================================

export const ZONE_METADATA: Record<ZoneId, ZoneMetadata> = {
  [ZoneId.StarterPlains]: {
    id: ZoneId.StarterPlains,
    name: 'Starter Plains',
    width: 50,
    height: 50,
    levelRange: [1, 3],
    tilePalette: 'plains',
  },
  [ZoneId.DarkForest]: {
    id: ZoneId.DarkForest,
    name: 'Dark Forest',
    width: 60,
    height: 60,
    levelRange: [3, 6],
    tilePalette: 'forest',
  },
  [ZoneId.AncientDungeon]: {
    id: ZoneId.AncientDungeon,
    name: 'Ancient Dungeon',
    width: 40,
    height: 40,
    levelRange: [6, 10],
    tilePalette: 'dungeon',
  },
};

export const ZONE_PLAYER_SPAWNS: Record<ZoneId, Vec2> = {
  [ZoneId.StarterPlains]: { x: 25, y: 25 },
  [ZoneId.DarkForest]: { x: 5, y: 30 },
  [ZoneId.AncientDungeon]: { x: 20, y: 38 },
};

export const ZONE_PORTALS: Record<ZoneId, Portal[]> = {
  [ZoneId.StarterPlains]: [
    {
      position: { x: 48, y: 25 },
      targetZone: ZoneId.DarkForest,
      targetSpawnPoint: { x: 5, y: 30 },
    },
  ],
  [ZoneId.DarkForest]: [
    {
      position: { x: 2, y: 30 },
      targetZone: ZoneId.StarterPlains,
      targetSpawnPoint: { x: 46, y: 25 },
    },
    {
      position: { x: 55, y: 55 },
      targetZone: ZoneId.AncientDungeon,
      targetSpawnPoint: { x: 20, y: 38 },
    },
  ],
  [ZoneId.AncientDungeon]: [
    {
      position: { x: 20, y: 39 },
      targetZone: ZoneId.DarkForest,
      targetSpawnPoint: { x: 53, y: 53 },
    },
  ],
};

// ============================================================
// Item Constants
// ============================================================

export const INVENTORY_SIZE = 20;
export const LOOT_EXPIRY_MS = 60_000;
export const LOOT_KILLER_ONLY_MS = 30_000;
export const LOOT_PICKUP_RANGE = 2.0;
export const PORTAL_USE_RANGE = 2.0;

// Mob separation (prevents permanent overlap)
export const MOB_SEPARATION_DISTANCE = 0.4;
export const MOB_SEPARATION_EPSILON = 0.001;
export const MOB_SEPARATION_PUSH_FACTOR = 0.5;

// ============================================================
// Item Database
// ============================================================

const allClasses = [ClassType.Warrior, ClassType.Mage, ClassType.Rogue, ClassType.Priest];

export const ITEM_DATABASE: Record<string, ItemDef> = {
  // ── Weapons ──────────────────────────────────────────────────
  rusty_sword: {
    id: 'rusty_sword',
    name: 'Rusty Sword',
    description: 'A worn blade, still sharp enough to cut.',
    type: ItemType.Weapon,
    rarity: ItemRarity.Common,
    stackable: false,
    maxStack: 1,
    levelReq: 1,
    classReq: [ClassType.Warrior],
    stats: { attack: 3 },
    sellValue: 5,
    icon: '⚔️',
  },
  iron_sword: {
    id: 'iron_sword',
    name: 'Iron Sword',
    description: 'A sturdy iron blade forged by a competent smith.',
    type: ItemType.Weapon,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Warrior],
    stats: { attack: 6 },
    sellValue: 15,
    icon: '⚔️',
  },
  steel_sword: {
    id: 'steel_sword',
    name: 'Steel Sword',
    description: 'A finely crafted steel blade with a keen edge.',
    type: ItemType.Weapon,
    rarity: ItemRarity.Rare,
    stackable: false,
    maxStack: 1,
    levelReq: 6,
    classReq: [ClassType.Warrior],
    stats: { attack: 10 },
    sellValue: 40,
    icon: '⚔️',
  },
  apprentice_staff: {
    id: 'apprentice_staff',
    name: 'Apprentice Staff',
    description: 'A simple wooden staff humming with faint magic.',
    type: ItemType.Weapon,
    rarity: ItemRarity.Common,
    stackable: false,
    maxStack: 1,
    levelReq: 1,
    classReq: [ClassType.Mage],
    stats: { attack: 2, mana: 10 },
    sellValue: 5,
    icon: '🪄',
  },
  oak_staff: {
    id: 'oak_staff',
    name: 'Oak Staff',
    description: 'A sturdy oak staff inscribed with arcane runes.',
    type: ItemType.Weapon,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Mage],
    stats: { attack: 5, mana: 20 },
    sellValue: 15,
    icon: '🪄',
  },
  crystal_staff: {
    id: 'crystal_staff',
    name: 'Crystal Staff',
    description: 'A staff crowned with a glowing crystal.',
    type: ItemType.Weapon,
    rarity: ItemRarity.Rare,
    stackable: false,
    maxStack: 1,
    levelReq: 6,
    classReq: [ClassType.Mage],
    stats: { attack: 8, mana: 35 },
    sellValue: 40,
    icon: '🪄',
  },
  worn_dagger: {
    id: 'worn_dagger',
    name: 'Worn Dagger',
    description: 'A small, worn dagger. Quick and quiet.',
    type: ItemType.Weapon,
    rarity: ItemRarity.Common,
    stackable: false,
    maxStack: 1,
    levelReq: 1,
    classReq: [ClassType.Rogue],
    stats: { attack: 3, critChance: 0.05 },
    sellValue: 5,
    icon: '🗡️',
  },
  sharp_dagger: {
    id: 'sharp_dagger',
    name: 'Sharp Dagger',
    description: 'A well-honed dagger that finds weak spots.',
    type: ItemType.Weapon,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Rogue],
    stats: { attack: 6, critChance: 0.08 },
    sellValue: 15,
    icon: '🗡️',
  },
  shadow_blade: {
    id: 'shadow_blade',
    name: 'Shadow Blade',
    description: 'A blade that seems to absorb light itself.',
    type: ItemType.Weapon,
    rarity: ItemRarity.Rare,
    stackable: false,
    maxStack: 1,
    levelReq: 6,
    classReq: [ClassType.Rogue],
    stats: { attack: 10, critChance: 0.12 },
    sellValue: 40,
    icon: '🗡️',
  },
  holy_mace: {
    id: 'holy_mace',
    name: 'Holy Mace',
    description: 'A blessed mace that channels divine energy.',
    type: ItemType.Weapon,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Priest],
    stats: { attack: 4, mana: 15 },
    sellValue: 15,
    icon: '🔨',
  },

  // ── Armor – Head ─────────────────────────────────────────────
  leather_cap: {
    id: 'leather_cap',
    name: 'Leather Cap',
    description: 'A simple leather cap offering basic protection.',
    type: ItemType.ArmorHead,
    rarity: ItemRarity.Common,
    stackable: false,
    maxStack: 1,
    levelReq: 1,
    classReq: allClasses,
    stats: { defense: 1 },
    sellValue: 3,
    icon: '🎩',
  },
  iron_helm: {
    id: 'iron_helm',
    name: 'Iron Helm',
    description: 'A heavy iron helm that protects the skull.',
    type: ItemType.ArmorHead,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Warrior],
    stats: { defense: 3, health: 10 },
    sellValue: 12,
    icon: '⛑️',
  },
  mage_hood: {
    id: 'mage_hood',
    name: 'Mage Hood',
    description: 'A mystical hood woven with enchanted thread.',
    type: ItemType.ArmorHead,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Mage],
    stats: { defense: 1, mana: 15 },
    sellValue: 12,
    icon: '🧙',
  },
  shadow_cowl: {
    id: 'shadow_cowl',
    name: 'Shadow Cowl',
    description: 'A dark cowl that helps the wearer blend in.',
    type: ItemType.ArmorHead,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Rogue],
    stats: { defense: 2, critChance: 0.03 },
    sellValue: 12,
    icon: '🥷',
  },

  // ── Armor – Chest ────────────────────────────────────────────
  cloth_tunic: {
    id: 'cloth_tunic',
    name: 'Cloth Tunic',
    description: 'A simple cloth tunic. Better than nothing.',
    type: ItemType.ArmorChest,
    rarity: ItemRarity.Common,
    stackable: false,
    maxStack: 1,
    levelReq: 1,
    classReq: allClasses,
    stats: { defense: 1 },
    sellValue: 3,
    icon: '👕',
  },
  chainmail: {
    id: 'chainmail',
    name: 'Chainmail',
    description: 'Interlocking metal rings provide solid protection.',
    type: ItemType.ArmorChest,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Warrior],
    stats: { defense: 5, health: 15 },
    sellValue: 18,
    icon: '🛡️',
  },
  silk_robe: {
    id: 'silk_robe',
    name: 'Silk Robe',
    description: 'A fine silk robe imbued with arcane energy.',
    type: ItemType.ArmorChest,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Mage],
    stats: { defense: 2, mana: 25 },
    sellValue: 18,
    icon: '👘',
  },
  leather_vest: {
    id: 'leather_vest',
    name: 'Leather Vest',
    description: 'A lightweight leather vest allowing swift movement.',
    type: ItemType.ArmorChest,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Rogue],
    stats: { defense: 3, speed: 0.1 },
    sellValue: 18,
    icon: '🦺',
  },

  // ── Armor – Legs ─────────────────────────────────────────────
  cloth_pants: {
    id: 'cloth_pants',
    name: 'Cloth Pants',
    description: 'Simple cloth pants for basic coverage.',
    type: ItemType.ArmorLegs,
    rarity: ItemRarity.Common,
    stackable: false,
    maxStack: 1,
    levelReq: 1,
    classReq: allClasses,
    stats: { defense: 1 },
    sellValue: 3,
    icon: '👖',
  },
  plate_greaves: {
    id: 'plate_greaves',
    name: 'Plate Greaves',
    description: 'Heavy plate leg armor for maximum defense.',
    type: ItemType.ArmorLegs,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Warrior],
    stats: { defense: 4, health: 10 },
    sellValue: 15,
    icon: '🦿',
  },
  enchanted_leggings: {
    id: 'enchanted_leggings',
    name: 'Enchanted Leggings',
    description: 'Leggings shimmering with protective enchantments.',
    type: ItemType.ArmorLegs,
    rarity: ItemRarity.Rare,
    stackable: false,
    maxStack: 1,
    levelReq: 5,
    classReq: [ClassType.Mage],
    stats: { defense: 2, mana: 20 },
    sellValue: 30,
    icon: '✨',
  },

  // ── Armor – Boots ────────────────────────────────────────────
  sandals: {
    id: 'sandals',
    name: 'Sandals',
    description: 'Light sandals that make you slightly quicker.',
    type: ItemType.ArmorBoots,
    rarity: ItemRarity.Common,
    stackable: false,
    maxStack: 1,
    levelReq: 1,
    classReq: allClasses,
    stats: { speed: 0.05 },
    sellValue: 2,
    icon: '👡',
  },
  iron_boots: {
    id: 'iron_boots',
    name: 'Iron Boots',
    description: 'Heavy iron boots built for endurance.',
    type: ItemType.ArmorBoots,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: [ClassType.Warrior],
    stats: { defense: 2, health: 5 },
    sellValue: 10,
    icon: '🥾',
  },
  swift_boots: {
    id: 'swift_boots',
    name: 'Swift Boots',
    description: 'Enchanted boots that make you fleet of foot.',
    type: ItemType.ArmorBoots,
    rarity: ItemRarity.Rare,
    stackable: false,
    maxStack: 1,
    levelReq: 5,
    classReq: allClasses,
    stats: { speed: 0.15, defense: 1 },
    sellValue: 30,
    icon: '👟',
  },

  // ── Rings ────────────────────────────────────────────────────
  copper_ring: {
    id: 'copper_ring',
    name: 'Copper Ring',
    description: 'A plain copper ring with a faint warmth.',
    type: ItemType.Ring,
    rarity: ItemRarity.Common,
    stackable: false,
    maxStack: 1,
    levelReq: 1,
    classReq: allClasses,
    stats: { health: 5 },
    sellValue: 4,
    icon: '💍',
  },
  silver_ring: {
    id: 'silver_ring',
    name: 'Silver Ring',
    description: 'A polished silver ring that hums with energy.',
    type: ItemType.Ring,
    rarity: ItemRarity.Uncommon,
    stackable: false,
    maxStack: 1,
    levelReq: 3,
    classReq: allClasses,
    stats: { mana: 10, health: 5 },
    sellValue: 12,
    icon: '💍',
  },
  gold_ring: {
    id: 'gold_ring',
    name: 'Gold Ring',
    description: 'A gleaming gold ring radiating power.',
    type: ItemType.Ring,
    rarity: ItemRarity.Rare,
    stackable: false,
    maxStack: 1,
    levelReq: 5,
    classReq: allClasses,
    stats: { attack: 3, defense: 2, health: 10 },
    sellValue: 35,
    icon: '💍',
  },

  // ── Consumables ──────────────────────────────────────────────
  minor_health_potion: {
    id: 'minor_health_potion',
    name: 'Minor Health Potion',
    description: 'A small vial that restores a bit of health.',
    type: ItemType.Consumable,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 10,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    useEffect: { type: 'heal', value: 30 },
    sellValue: 2,
    icon: '🧪',
  },
  minor_mana_potion: {
    id: 'minor_mana_potion',
    name: 'Minor Mana Potion',
    description: 'A small vial that restores a bit of mana.',
    type: ItemType.Consumable,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 10,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    useEffect: { type: 'mana', value: 40 },
    sellValue: 2,
    icon: '🧪',
  },
  health_potion: {
    id: 'health_potion',
    name: 'Health Potion',
    description: 'A potion that restores a good amount of health.',
    type: ItemType.Consumable,
    rarity: ItemRarity.Uncommon,
    stackable: true,
    maxStack: 5,
    levelReq: 3,
    classReq: allClasses,
    stats: {},
    useEffect: { type: 'heal', value: 0.5 },
    sellValue: 5,
    icon: '🧪',
  },
  mana_potion: {
    id: 'mana_potion',
    name: 'Mana Potion',
    description: 'A potion that restores a good amount of mana.',
    type: ItemType.Consumable,
    rarity: ItemRarity.Uncommon,
    stackable: true,
    maxStack: 5,
    levelReq: 3,
    classReq: allClasses,
    stats: {},
    useEffect: { type: 'mana', value: 0.6 },
    sellValue: 5,
    icon: '🧪',
  },
  bandage: {
    id: 'bandage',
    name: 'Bandage',
    description: 'A cloth bandage that slowly heals wounds over 8s. Interrupted by damage.',
    type: ItemType.Consumable,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 20,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    useEffect: { type: 'buff', value: 50, duration: 8000 },
    sellValue: 1,
    icon: '🩹',
  },
  scroll_of_town_portal: {
    id: 'scroll_of_town_portal',
    name: 'Scroll of Town Portal',
    description: 'Teleports you to the current zone\'s spawn point.',
    type: ItemType.Consumable,
    rarity: ItemRarity.Uncommon,
    stackable: true,
    maxStack: 5,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    useEffect: { type: 'teleport', value: 0 },
    sellValue: 10,
    icon: '📜',
  },

  // ── Quest Items ──────────────────────────────────────────────
  goblin_ear: {
    id: 'goblin_ear',
    name: 'Goblin Ear',
    description: 'A severed goblin ear. Proof of a kill.',
    type: ItemType.QuestItem,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 99,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    sellValue: 0,
    icon: '👂',
  },
  wolf_pelt: {
    id: 'wolf_pelt',
    name: 'Wolf Pelt',
    description: 'A thick wolf pelt, valuable to tanners.',
    type: ItemType.QuestItem,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 99,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    sellValue: 0,
    icon: '🐺',
  },
  skeleton_bone: {
    id: 'skeleton_bone',
    name: 'Skeleton Bone',
    description: 'A bone from a reanimated skeleton.',
    type: ItemType.QuestItem,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 99,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    sellValue: 0,
    icon: '🦴',
  },

  // ── Misc ─────────────────────────────────────────────────────
  gold_coin: {
    id: 'gold_coin',
    name: 'Gold Coin',
    description: 'A shiny gold coin.',
    type: ItemType.Misc,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 999,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    sellValue: 1,
    icon: '🪙',
  },
  goblin_tooth: {
    id: 'goblin_tooth',
    name: 'Goblin Tooth',
    description: 'A sharp goblin tooth. Mildly disgusting.',
    type: ItemType.Misc,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 99,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    sellValue: 2,
    icon: '🦷',
  },
  wolf_fang: {
    id: 'wolf_fang',
    name: 'Wolf Fang',
    description: 'A razor-sharp wolf fang.',
    type: ItemType.Misc,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 99,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    sellValue: 3,
    icon: '🐺',
  },
  old_bone: {
    id: 'old_bone',
    name: 'Old Bone',
    description: 'A weathered bone of unknown origin.',
    type: ItemType.Misc,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 99,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    sellValue: 1,
    icon: '🦴',
  },
  torn_cloth: {
    id: 'torn_cloth',
    name: 'Torn Cloth',
    description: 'A scrap of torn cloth. Not very useful.',
    type: ItemType.Misc,
    rarity: ItemRarity.Common,
    stackable: true,
    maxStack: 99,
    levelReq: 1,
    classReq: allClasses,
    stats: {},
    sellValue: 1,
    icon: '🧵',
  },
};

// ============================================================
// Mob Loot Tables
// ============================================================

export interface LootTableEntry {
  itemId: string;
  weight: number;
  minQty: number;
  maxQty: number;
}

export const MOB_LOOT_TABLES: Record<string, LootTableEntry[]> = {
  [MobType.Goblin]: [
    { itemId: 'gold_coin', weight: 80, minQty: 1, maxQty: 3 },
    { itemId: 'goblin_tooth', weight: 40, minQty: 1, maxQty: 1 },
    { itemId: 'goblin_ear', weight: 30, minQty: 1, maxQty: 1 },
    { itemId: 'rusty_sword', weight: 5, minQty: 1, maxQty: 1 },
    { itemId: 'leather_cap', weight: 3, minQty: 1, maxQty: 1 },
    { itemId: 'cloth_tunic', weight: 3, minQty: 1, maxQty: 1 },
    { itemId: 'minor_health_potion', weight: 15, minQty: 1, maxQty: 1 },
    { itemId: 'copper_ring', weight: 2, minQty: 1, maxQty: 1 },
  ],
  [MobType.Wolf]: [
    { itemId: 'gold_coin', weight: 70, minQty: 1, maxQty: 4 },
    { itemId: 'wolf_fang', weight: 50, minQty: 1, maxQty: 2 },
    { itemId: 'wolf_pelt', weight: 35, minQty: 1, maxQty: 1 },
    { itemId: 'worn_dagger', weight: 5, minQty: 1, maxQty: 1 },
    { itemId: 'leather_vest', weight: 3, minQty: 1, maxQty: 1 },
    { itemId: 'swift_boots', weight: 1, minQty: 1, maxQty: 1 },
    { itemId: 'minor_health_potion', weight: 10, minQty: 1, maxQty: 1 },
    { itemId: 'bandage', weight: 8, minQty: 1, maxQty: 2 },
  ],
  [MobType.Skeleton]: [
    { itemId: 'gold_coin', weight: 90, minQty: 2, maxQty: 5 },
    { itemId: 'old_bone', weight: 45, minQty: 1, maxQty: 2 },
    { itemId: 'skeleton_bone', weight: 30, minQty: 1, maxQty: 1 },
    { itemId: 'torn_cloth', weight: 25, minQty: 1, maxQty: 1 },
    { itemId: 'iron_sword', weight: 4, minQty: 1, maxQty: 1 },
    { itemId: 'iron_helm', weight: 3, minQty: 1, maxQty: 1 },
    { itemId: 'chainmail', weight: 2, minQty: 1, maxQty: 1 },
    { itemId: 'silver_ring', weight: 2, minQty: 1, maxQty: 1 },
    { itemId: 'minor_mana_potion', weight: 12, minQty: 1, maxQty: 1 },
    { itemId: 'health_potion', weight: 5, minQty: 1, maxQty: 1 },
  ],
};

// ============================================================
// Equipment Slot Mapping
// ============================================================

export const EQUIPMENT_SLOT_FOR_ITEM_TYPE: Record<ItemType, EquipmentSlot | null> = {
  [ItemType.Weapon]: EquipmentSlot.Weapon,
  [ItemType.ArmorHead]: EquipmentSlot.Head,
  [ItemType.ArmorChest]: EquipmentSlot.Chest,
  [ItemType.ArmorLegs]: EquipmentSlot.Legs,
  [ItemType.ArmorBoots]: EquipmentSlot.Boots,
  [ItemType.Ring]: EquipmentSlot.Ring1, // default to Ring1, server logic handles Ring2
  [ItemType.Consumable]: null,
  [ItemType.QuestItem]: null,
  [ItemType.Misc]: null,
};
