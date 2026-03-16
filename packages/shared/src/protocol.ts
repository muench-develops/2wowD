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
  | PingMessage;

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
  | ErrorMessage;
