import {
  ClassType,
  PlayerState,
  MobState,
  DamageEvent,
  CooldownState,
  ChatMessage,
  ChatChannel,
  Vec2,
  Position,
  MapData,
  BuffState,
  CharacterSummary,
  InventoryItem,
  WorldLoot,
  ZoneId,
  EquipmentSlot,
  PlayerEquipment,
  PotionCooldownState,
  NpcId,
  QuestId,
  QuestDef,
  QuestObjective,
  QuestState,
  QuestReward,
} from './types.js';

// ============================================================
// Client → Server Messages
// ============================================================

export enum ClientMessageType {
  // Auth
  Register = 'register',
  Login = 'login',
  CreateCharacter = 'create_character',
  SelectCharacter = 'select_character',
  DeleteCharacter = 'delete_character',
  Logout = 'logout',
  // Game
  Join = 'join',
  Move = 'move',
  StopMove = 'stop_move',
  Attack = 'attack',
  UseAbility = 'use_ability',
  SelectTarget = 'select_target',
  Chat = 'chat',
  Ping = 'ping',
  TutorialComplete = 'tutorial_complete',
  // Items & Inventory
  PickupItem = 'pickupItem',
  DropItem = 'dropItem',
  MoveItem = 'moveItem',
  UseItem = 'useItem',
  UsePortal = 'use_portal',
  EquipItem = 'equip_item',
  UnequipItem = 'unequip_item',
  // NPCs & Quests
  InteractNPC = 'interact_npc',
  AcceptQuest = 'accept_quest',
  AbandonQuest = 'abandon_quest',
  TurnInQuest = 'turn_in_quest',
}

// --- Auth Messages (Client → Server) ---

export interface RegisterMessage {
  type: ClientMessageType.Register;
  username: string;
  password: string;
}

export interface LoginMessage {
  type: ClientMessageType.Login;
  username: string;
  password: string;
}

export interface CreateCharacterMessage {
  type: ClientMessageType.CreateCharacter;
  name: string;
  classType: ClassType;
}

export interface SelectCharacterMessage {
  type: ClientMessageType.SelectCharacter;
  characterId: string;
}

export interface DeleteCharacterMessage {
  type: ClientMessageType.DeleteCharacter;
  characterId: string;
}

export interface LogoutMessage {
  type: ClientMessageType.Logout;
}

// --- Game Messages (Client → Server) ---

export interface JoinMessage {
  type: ClientMessageType.Join;
  name: string;
  classType: ClassType;
}

export interface MoveMessage {
  type: ClientMessageType.Move;
  direction: Vec2; // normalized direction vector
  seq: number; // sequence number for reconciliation
}

export interface StopMoveMessage {
  type: ClientMessageType.StopMove;
  position: Vec2;
  seq: number;
}

export interface AttackMessage {
  type: ClientMessageType.Attack;
  targetId: string;
}

export interface UseAbilityMessage {
  type: ClientMessageType.UseAbility;
  abilityId: string;
  targetId: string | null;
  targetPosition: Vec2 | null; // for AoE targeting
}

export interface SelectTargetMessage {
  type: ClientMessageType.SelectTarget;
  targetId: string | null;
}

export interface ChatClientMessage {
  type: ClientMessageType.Chat;
  channel: ChatChannel;
  content: string;
}

export interface PingMessage {
  type: ClientMessageType.Ping;
  timestamp: number;
}

export interface TutorialCompleteMessage {
  type: ClientMessageType.TutorialComplete;
}

// --- Item Messages (Client → Server) ---

export interface PickupItemMessage {
  type: ClientMessageType.PickupItem;
  lootId: string;
  itemIndex: number;
}

export interface DropItemMessage {
  type: ClientMessageType.DropItem;
  slot: number;
}

export interface MoveItemMessage {
  type: ClientMessageType.MoveItem;
  fromSlot: number;
  toSlot: number;
}

export interface UseItemMessage {
  type: ClientMessageType.UseItem;
  slot: number;
}

export interface UsePortalMessage {
  type: ClientMessageType.UsePortal;
  targetZone: ZoneId;
}

export interface EquipItemMessage {
  type: ClientMessageType.EquipItem;
  slot: number;
  equipSlot: EquipmentSlot;
}

export interface UnequipItemMessage {
  type: ClientMessageType.UnequipItem;
  equipSlot: EquipmentSlot;
}

// --- NPC & Quest Messages (Client → Server) ---

export interface InteractNPCMessage {
  type: ClientMessageType.InteractNPC;
  npcId: NpcId;
}

export interface AcceptQuestMessage {
  type: ClientMessageType.AcceptQuest;
  questId: QuestId;
}

export interface AbandonQuestMessage {
  type: ClientMessageType.AbandonQuest;
  questId: QuestId;
}

export interface TurnInQuestMessage {
  type: ClientMessageType.TurnInQuest;
  questId: QuestId;
}

export type ClientMessage =
  | RegisterMessage
  | LoginMessage
  | CreateCharacterMessage
  | SelectCharacterMessage
  | DeleteCharacterMessage
  | LogoutMessage
  | JoinMessage
  | MoveMessage
  | StopMoveMessage
  | AttackMessage
  | UseAbilityMessage
  | SelectTargetMessage
  | ChatClientMessage
  | PingMessage
  | TutorialCompleteMessage
  | PickupItemMessage
  | DropItemMessage
  | MoveItemMessage
  | UseItemMessage
  | UsePortalMessage
  | EquipItemMessage
  | UnequipItemMessage
  | InteractNPCMessage
  | AcceptQuestMessage
  | AbandonQuestMessage
  | TurnInQuestMessage;

// ============================================================
// Server → Client Messages
// ============================================================

export enum ServerMessageType {
  // Auth
  RegisterSuccess = 'register_success',
  RegisterFailed = 'register_failed',
  LoginSuccess = 'login_success',
  LoginFailed = 'login_failed',
  CharacterCreated = 'character_created',
  CharacterCreateFailed = 'character_create_failed',
  CharacterDeleted = 'character_deleted',
  // Game
  Welcome = 'welcome',
  WorldState = 'world_state',
  PlayerJoined = 'player_joined',
  PlayerLeft = 'player_left',
  PlayerMoved = 'player_moved',
  MobMoved = 'mob_moved',
  DamageDealt = 'damage_dealt',
  EntityDied = 'entity_died',
  EntityRespawned = 'entity_respawned',
  AbilityCast = 'ability_cast',
  CooldownUpdate = 'cooldown_update',
  BuffApplied = 'buff_applied',
  BuffRemoved = 'buff_removed',
  ChatReceived = 'chat_received',
  MapData = 'map_data',
  LevelUp = 'level_up',
  Pong = 'pong',
  Error = 'error',
  // Items & Inventory
  InventoryUpdate = 'inventoryUpdate',
  LootSpawned = 'lootSpawned',
  LootDespawned = 'lootDespawned',
  LootPickedUp = 'lootPickedUp',
  ZoneChanged = 'zone_changed',
  ConsumableUsed = 'consumable_used',
  PotionCooldownUpdate = 'potion_cooldown_update',
  EquipmentUpdate = 'equipment_update',
  // NPCs & Quests
  NPCDialogue = 'npc_dialogue',
  QuestUpdate = 'quest_update',
  QuestCompleted = 'quest_completed',
  NPCList = 'npc_list',
}

// --- Auth Messages (Server → Client) ---

export interface RegisterSuccessMessage {
  type: ServerMessageType.RegisterSuccess;
}

export interface RegisterFailedMessage {
  type: ServerMessageType.RegisterFailed;
  reason: string;
}

export interface LoginSuccessMessage {
  type: ServerMessageType.LoginSuccess;
  accountId: string;
  characters: CharacterSummary[];
}

export interface LoginFailedMessage {
  type: ServerMessageType.LoginFailed;
  reason: string;
}

export interface CharacterCreatedMessage {
  type: ServerMessageType.CharacterCreated;
  character: CharacterSummary;
}

export interface CharacterCreateFailedMessage {
  type: ServerMessageType.CharacterCreateFailed;
  reason: string;
}

export interface CharacterDeletedMessage {
  type: ServerMessageType.CharacterDeleted;
  characterId: string;
}

// --- Game Messages (Server → Client) ---

export interface WelcomeMessage {
  type: ServerMessageType.Welcome;
  playerId: string;
  player: PlayerState;
  mapData: MapData;
  tutorialComplete?: boolean;
}

export interface WorldStateMessage {
  type: ServerMessageType.WorldState;
  players: PlayerState[];
  mobs: MobState[];
  tick: number;
}

export interface PlayerJoinedMessage {
  type: ServerMessageType.PlayerJoined;
  player: PlayerState;
}

export interface PlayerLeftMessage {
  type: ServerMessageType.PlayerLeft;
  playerId: string;
}

export interface PlayerMovedMessage {
  type: ServerMessageType.PlayerMoved;
  playerId: string;
  position: Position;
  seq: number;
}

export interface MobMovedMessage {
  type: ServerMessageType.MobMoved;
  mobId: string;
  position: Position;
}

export interface DamageDealtMessage {
  type: ServerMessageType.DamageDealt;
  event: DamageEvent;
}

export interface EntityDiedMessage {
  type: ServerMessageType.EntityDied;
  entityId: string;
  killerName: string;
}

export interface EntityRespawnedMessage {
  type: ServerMessageType.EntityRespawned;
  entityId: string;
  position: Position;
  health: number;
  maxHealth: number;
}

export interface AbilityCastMessage {
  type: ServerMessageType.AbilityCast;
  casterId: string;
  abilityId: string;
  targetId: string | null;
  targetPosition: Vec2 | null;
}

export interface CooldownUpdateMessage {
  type: ServerMessageType.CooldownUpdate;
  cooldowns: CooldownState[];
}

export interface BuffAppliedMessage {
  type: ServerMessageType.BuffApplied;
  entityId: string;
  buff: BuffState;
}

export interface BuffRemovedMessage {
  type: ServerMessageType.BuffRemoved;
  entityId: string;
  buffId: string;
}

export interface ChatReceivedMessage {
  type: ServerMessageType.ChatReceived;
  message: ChatMessage;
}

export interface MapDataMessage {
  type: ServerMessageType.MapData;
  mapData: MapData;
}

export interface LevelUpMessage {
  type: ServerMessageType.LevelUp;
  playerId: string;
  newLevel: number;
}

export interface PongMessage {
  type: ServerMessageType.Pong;
  timestamp: number;
  serverTime: number;
}

export interface ErrorMessage {
  type: ServerMessageType.Error;
  message: string;
}

// --- Item Messages (Server → Client) ---

export interface InventoryUpdateMessage {
  type: ServerMessageType.InventoryUpdate;
  inventory: InventoryItem[];
}

export interface LootSpawnedMessage {
  type: ServerMessageType.LootSpawned;
  loot: WorldLoot;
}

export interface LootDespawnedMessage {
  type: ServerMessageType.LootDespawned;
  lootId: string;
}

export interface LootPickedUpMessage {
  type: ServerMessageType.LootPickedUp;
  lootId: string;
  itemIndex: number;
  playerId: string;
}

export interface ZoneChangedMessage {
  type: ServerMessageType.ZoneChanged;
  oldZone: ZoneId;
  newZone: ZoneId;
  mapData: MapData;
  playerPosition: Vec2;
}

export interface ConsumableUsedMessage {
  type: ServerMessageType.ConsumableUsed;
  playerId: string;
  itemId: string;
  effectType: 'heal' | 'mana' | 'teleport' | 'buff';
  value: number;
}

export interface PotionCooldownUpdateMessage {
  type: ServerMessageType.PotionCooldownUpdate;
  cooldownState: PotionCooldownState;
}

export interface EquipmentUpdateMessage {
  type: ServerMessageType.EquipmentUpdate;
  equipment: PlayerEquipment;
}

// --- NPC & Quest Messages (Server → Client) ---

export interface NPCDialogueMessage {
  type: ServerMessageType.NPCDialogue;
  npcId: NpcId;
  dialogue: string;
  availableQuests: QuestDef[];
  activeQuests: Array<{ questId: QuestId; objectives: QuestObjective[] }>;
  completableQuests: QuestId[];
}

export interface QuestUpdateMessage {
  type: ServerMessageType.QuestUpdate;
  questId: QuestId;
  objectives: QuestObjective[];
  state: QuestState;
}

export interface QuestCompletedMessage {
  type: ServerMessageType.QuestCompleted;
  questId: QuestId;
  rewards: QuestReward;
}

export interface NPCListMessage {
  type: ServerMessageType.NPCList;
  npcs: Array<{ id: NpcId; position: Vec2; hasQuest: boolean; questReady: boolean }>;
}

export type ServerMessage =
  | RegisterSuccessMessage
  | RegisterFailedMessage
  | LoginSuccessMessage
  | LoginFailedMessage
  | CharacterCreatedMessage
  | CharacterCreateFailedMessage
  | CharacterDeletedMessage
  | WelcomeMessage
  | WorldStateMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerMovedMessage
  | MobMovedMessage
  | DamageDealtMessage
  | EntityDiedMessage
  | EntityRespawnedMessage
  | AbilityCastMessage
  | CooldownUpdateMessage
  | BuffAppliedMessage
  | BuffRemovedMessage
  | ChatReceivedMessage
  | LevelUpMessage
  | MapDataMessage
  | PongMessage
  | ErrorMessage
  | InventoryUpdateMessage
  | LootSpawnedMessage
  | LootDespawnedMessage
  | LootPickedUpMessage
  | ZoneChangedMessage
  | ConsumableUsedMessage
  | PotionCooldownUpdateMessage
  | EquipmentUpdateMessage
  | NPCDialogueMessage
  | QuestUpdateMessage
  | QuestCompletedMessage
  | NPCListMessage;
