// ============================================================
// Entity & Position Types
// ============================================================

export interface Vec2 {
  x: number;
  y: number;
}

export interface Position extends Vec2 {
  direction: Direction;
}

export enum Direction {
  N = 0,
  NE = 1,
  E = 2,
  SE = 3,
  S = 4,
  SW = 5,
  W = 6,
  NW = 7,
}

// ============================================================
// Zones
// ============================================================

export enum ZoneId {
  StarterPlains = 'starter-plains',
  DarkForest = 'dark-forest',
  AncientDungeon = 'ancient-dungeon',
}

export interface ZoneMetadata {
  id: ZoneId;
  name: string;
  width: number;
  height: number;
  levelRange: [number, number];
  tilePalette: string;
}

export interface Portal {
  position: Vec2;
  targetZone: ZoneId;
  targetSpawnPoint: Vec2;
}

// ============================================================
// Character Classes
// ============================================================

export enum ClassType {
  Warrior = 'warrior',
  Mage = 'mage',
  Rogue = 'rogue',
  Priest = 'priest',
}

export interface ClassStats {
  maxHealth: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  attackRange: number;
  attackSpeed: number; // attacks per second
}

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  manaCost: number;
  cooldown: number; // seconds
  range: number;
  damage: number;
  healAmount: number;
  castTime: number; // seconds, 0 = instant
  aoe: boolean;
  aoeRadius: number;
}

// ============================================================
// Entities
// ============================================================

export interface Entity {
  id: string;
  position: Position;
  type: EntityType;
}

export enum EntityType {
  Player = 'player',
  Mob = 'mob',
}

export interface PlayerState extends Entity {
  type: EntityType.Player;
  name: string;
  classType: ClassType;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  level: number;
  xp: number;
  xpToNextLevel: number;
  isDead: boolean;
  targetId: string | null;
  buffs: BuffState[];
  currentZone: ZoneId;
  equipment?: PlayerEquipment;
}

export enum MobType {
  Goblin = 'goblin',
  Skeleton = 'skeleton',
  Wolf = 'wolf',
  Spider = 'spider',
  Bandit = 'bandit',
  WolfAlpha = 'wolf-alpha',
  SkeletonMage = 'skeleton-mage',
  BoneLord = 'bone-lord',
}

export interface MobState extends Entity {
  type: EntityType.Mob;
  mobType: MobType;
  name: string;
  health: number;
  maxHealth: number;
  level: number;
  isDead: boolean;
  targetId: string | null;
  buffs: BuffState[];
}

// ============================================================
// Buffs & Debuffs
// ============================================================

export interface BuffDef {
  id: string;
  name: string;
  duration: number; // ms
  statModifiers: Partial<Record<'attack' | 'defense' | 'speed' | 'maxHealth' | 'maxMana', number>>; // multiplicative (1.5 = +50%)
  tickDamage: number; // damage per tick (DoT), 0 if none
  tickHeal: number; // heal per tick (HoT), 0 if none
  tickInterval: number; // ms between ticks
  isDebuff: boolean;
}

export interface BuffState {
  id: string;
  buffId: string;
  name: string;
  remainingMs: number;
  totalMs: number;
  isDebuff: boolean;
}

// ============================================================
// Combat
// ============================================================

export interface DamageEvent {
  sourceId: string;
  targetId: string;
  amount: number;
  abilityId: string | null; // null = auto-attack
  isCrit: boolean;
  isDodge: boolean;
  isMiss: boolean;
  isHeal: boolean;
}

export interface CooldownState {
  abilityId: string;
  remainingMs: number;
  totalMs: number;
}

// ============================================================
// Chat
// ============================================================

export enum ChatChannel {
  World = 'world',
  Say = 'say',
  System = 'system',
}

export interface ChatMessage {
  id: string;
  channel: ChatChannel;
  senderName: string;
  senderId: string;
  content: string;
  timestamp: number;
}

// ============================================================
// Map
// ============================================================

export enum TileType {
  Grass = 0,
  Dirt = 1,
  Stone = 2,
  Water = 3,
  Portal = 4,
}

export interface MapData {
  width: number;
  height: number;
  tiles: TileType[][];
  collisions: boolean[][];
  spawnPoints: SpawnPoint[];
  playerSpawn: Vec2;
  zone?: ZoneMetadata;
  portals?: Portal[];
}

export interface SpawnPoint {
  position: Vec2;
  mobType: MobType;
  respawnTime: number; // seconds
  count: number;
}

// ============================================================
// Auth & Characters
// ============================================================

export interface CharacterSummary {
  id: string;
  name: string;
  classType: ClassType;
  level: number;
}

export interface CharacterInfo {
  id: string;
  accountId: string;
  name: string;
  classType: ClassType;
  level: number;
  xp: number;
  posX: number;
  posY: number;
  health: number;
  mana: number;
  createdAt: number;
  lastPlayed: number;
  currentZone?: ZoneId;
}

// ============================================================
// Item System
// ============================================================

export enum ItemType {
  Weapon = 'weapon',
  ArmorHead = 'armor_head',
  ArmorChest = 'armor_chest',
  ArmorLegs = 'armor_legs',
  ArmorBoots = 'armor_boots',
  Ring = 'ring',
  Consumable = 'consumable',
  QuestItem = 'quest_item',
  Misc = 'misc',
}

export enum ItemRarity {
  Common = 'common',
  Uncommon = 'uncommon',
  Rare = 'rare',
  Epic = 'epic',
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  rarity: ItemRarity;
  stackable: boolean;
  maxStack: number;
  levelReq: number;
  classReq: ClassType[];
  stats: ItemStats;
  useEffect?: ItemUseEffect;
  sellValue: number;
  icon: string;
}

export interface ItemStats {
  attack?: number;
  defense?: number;
  health?: number;
  mana?: number;
  speed?: number;
  critChance?: number;
}

export interface ItemUseEffect {
  type: 'heal' | 'mana' | 'teleport' | 'buff';
  value: number;
  duration?: number;
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
  slot: number;
}

export interface LootItem {
  itemId: string;
  quantity: number;
}

export interface WorldLoot {
  id: string;
  position: Vec2;
  items: LootItem[];
  killerId: string;
  killerOnlyUntil: number;
  expiresAt: number;
}

// ============================================================
// Consumables & Cooldowns
// ============================================================

export interface PotionCooldownState {
  sharedCooldownMs: number;
  itemCooldowns: Record<string, number>;
}

// ============================================================
// Equipment System
// ============================================================

// ============================================================
// NPC & Quest System
// ============================================================

export enum NpcId {
  GuardCaptain = 'guard-captain',
  Merchant = 'merchant',
  Ranger = 'ranger',
  Hermit = 'hermit',
  Adventurer = 'adventurer',
  Priest = 'priest',
}

export enum QuestId {
  // Starter Plains (level 1-3)
  SlayGoblins = 'slay-goblins',
  CollectWolfPelts = 'collect-wolf-pelts',
  HelpTheGuard = 'help-the-guard',
  VisitTheMerchant = 'visit-the-merchant',
  // Dark Forest (level 3-6)
  HuntWolves = 'hunt-wolves',
  ClearSpiders = 'clear-spiders',
  CollectSkeletonBones = 'collect-skeleton-bones',
  ExploreForestDepths = 'explore-forest-depths',
  BanditThreat = 'bandit-threat',
  // Ancient Dungeon (level 5-10)
  ClearSkeletonMages = 'clear-skeleton-mages',
  DefeatBoneLord = 'defeat-bone-lord',
  CollectRareDrops = 'collect-rare-drops',
  DungeonExplorer = 'dungeon-explorer',
}

export enum QuestObjectiveType {
  Defeat = 'defeat',
  Collect = 'collect',
  Visit = 'visit',
}

export enum QuestState {
  Available = 'available',
  Active = 'active',
  Complete = 'complete',
  TurnedIn = 'turned_in',
}

export interface QuestObjective {
  type: QuestObjectiveType;
  target: string;
  required: number;
  current: number;
}

export interface QuestReward {
  xp: number;
  gold: number;
  items?: Array<{ itemId: string; quantity: number }>;
}

export interface QuestDef {
  id: QuestId;
  name: string;
  description: string;
  npcId: NpcId;
  objectives: QuestObjective[];
  rewards: QuestReward;
  requiredLevel: number;
  prerequisiteQuest?: QuestId;
}

export interface NpcDef {
  id: NpcId;
  name: string;
  zone: ZoneId;
  position: Vec2;
  dialogue: {
    greeting: string;
    questAvailable: string;
    questInProgress: string;
    questComplete: string;
  };
  questIds: QuestId[];
}

export enum EquipmentSlot {
  Weapon = 'weapon',
  Head = 'head',
  Chest = 'chest',
  Legs = 'legs',
  Boots = 'boots',
  Ring1 = 'ring1',
  Ring2 = 'ring2',
}

export interface PlayerEquipment {
  [EquipmentSlot.Weapon]?: string;
  [EquipmentSlot.Head]?: string;
  [EquipmentSlot.Chest]?: string;
  [EquipmentSlot.Legs]?: string;
  [EquipmentSlot.Boots]?: string;
  [EquipmentSlot.Ring1]?: string;
  [EquipmentSlot.Ring2]?: string;
}
