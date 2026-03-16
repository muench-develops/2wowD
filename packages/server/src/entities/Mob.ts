import {
  MobState,
  EntityType,
  MobType,
  Position,
  Direction,
  Vec2,
  DamageEvent,
  MobDef,
  MOB_DEFINITIONS,
  AGGRO_RANGE,
  LEASH_RANGE,
  MOB_PATROL_RANGE,
  distance,
  normalize,
  vectorToDirection,
  generateId,
} from '@2wowd/shared';
import type { BuffSystem } from '../systems/BuffSystem.js';

export enum MobAIState {
  Idle = 'idle',
  Patrol = 'patrol',
  Aggro = 'aggro',
  Chase = 'chase',
  Attack = 'attack',
  Leash = 'leash',
  Dead = 'dead',
}

export class Mob {
  readonly id: string;
  readonly mobType: MobType;
  readonly def: MobDef;
  readonly spawnOrigin: Vec2;

  position: Position;
  health: number;
  maxHealth: number;
  level: number;
  isDead: boolean;
  targetId: string | null;

  aiState: MobAIState = MobAIState.Idle;
  lastAutoAttackTime: number = 0;
  respawnTimer: number = 0;
  respawnTime: number; // in ms

  // Patrol
  patrolTarget: Vec2 | null = null;
  patrolCooldown: number = 0;

  // Threat
  threatTable: Map<string, number> = new Map();

  constructor(mobType: MobType, spawnPos: Vec2, respawnTimeSec: number) {
    this.id = generateId();
    this.mobType = mobType;
    this.def = MOB_DEFINITIONS[mobType];
    this.spawnOrigin = { ...spawnPos };
    this.respawnTime = respawnTimeSec * 1000;

    this.position = {
      x: spawnPos.x,
      y: spawnPos.y,
      direction: Direction.S,
    };

    this.health = this.def.maxHealth;
    this.maxHealth = this.def.maxHealth;
    this.level = this.def.level;
    this.isDead = false;
    this.targetId = null;
  }

  takeDamage(amount: number, sourceId: string): DamageEvent {
    const actualDamage = Math.max(1, Math.round(amount));
    this.health = Math.max(0, this.health - actualDamage);

    // Add/update threat
    const current = this.threatTable.get(sourceId) ?? 0;
    this.threatTable.set(sourceId, current + actualDamage);

    const event: DamageEvent = {
      sourceId,
      targetId: this.id,
      amount: actualDamage,
      abilityId: null,
      isCrit: false,
      isDodge: false,
      isMiss: false,
      isHeal: false,
    };

    if (this.health <= 0) {
      this.die();
    }

    return event;
  }

  canAutoAttack(now: number): boolean {
    if (this.isDead) return false;
    const interval = 1000 / this.def.attackSpeed;
    return now - this.lastAutoAttackTime >= interval;
  }

  die(): void {
    this.isDead = true;
    this.aiState = MobAIState.Dead;
    this.targetId = null;
    this.respawnTimer = this.respawnTime;
    this.threatTable.clear();
  }

  respawn(): void {
    this.isDead = false;
    this.health = this.maxHealth;
    this.position = {
      x: this.spawnOrigin.x,
      y: this.spawnOrigin.y,
      direction: Direction.S,
    };
    this.aiState = MobAIState.Idle;
    this.targetId = null;
    this.respawnTimer = 0;
    this.threatTable.clear();
    this.patrolTarget = null;
    this.patrolCooldown = 0;
  }

  leash(): void {
    this.aiState = MobAIState.Leash;
    this.targetId = null;
    this.health = this.maxHealth;
    this.threatTable.clear();
  }

  moveToward(target: Vec2, deltaSeconds: number): void {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.1) return;

    const dir = normalize({ x: dx, y: dy });
    const moveAmount = this.def.speed * deltaSeconds;
    const actualMove = Math.min(moveAmount, dist);

    this.position.x += dir.x * actualMove;
    this.position.y += dir.y * actualMove;
    this.position.direction = vectorToDirection(dir);
  }

  getEffectiveStats(buffSystem: BuffSystem): { attack: number; defense: number; speed: number } {
    const mods = buffSystem.getStatModifiers(this.id);
    return {
      attack: Math.round(this.def.attack * mods.attack),
      defense: Math.round(this.def.defense * mods.defense),
      speed: this.def.speed * mods.speed,
    };
  }

  toState(buffSystem?: BuffSystem): MobState {
    return {
      id: this.id,
      type: EntityType.Mob,
      position: { ...this.position },
      mobType: this.mobType,
      name: this.def.name,
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      level: this.level,
      isDead: this.isDead,
      targetId: this.targetId,
      buffs: buffSystem ? buffSystem.getBuffStates(this.id) : [],
    };
  }
}
