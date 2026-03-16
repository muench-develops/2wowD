import {
  PlayerState,
  EntityType,
  ClassType,
  Position,
  Direction,
  Vec2,
  ClassStats,
  AbilityDef,
  CooldownState,
  DamageEvent,
  BuffState,
  CharacterInfo,
  InventoryItem,
  CLASS_STATS,
  CLASS_ABILITIES,
  PLAYER_SPAWN_X,
  PLAYER_SPAWN_Y,
  RESPAWN_TIME,
  HEALTH_REGEN_RATE,
  MANA_REGEN_RATE,
  LEVEL_CAP,
  LEVEL_STAT_SCALING,
  INVENTORY_SIZE,
  ITEM_DATABASE,
  xpForLevel,
  generateId,
  distance,
} from '@isoheim/shared';
import type { BuffSystem } from '../systems/BuffSystem.js';

export class Player {
  readonly id: string;
  readonly name: string;
  readonly classType: ClassType;
  readonly stats: ClassStats;
  readonly abilities: AbilityDef[];

  characterId: string = '';

  position: Position;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  level: number;
  xp: number = 0;
  isDead: boolean;
  targetId: string | null;

  // Movement
  moveDirection: Vec2 | null = null;
  lastMoveSeq: number = 0;

  // Combat
  inCombat: boolean = false;
  lastCombatTime: number = 0;
  lastAutoAttackTime: number = 0;
  cooldowns: Map<string, { remaining: number; total: number }> = new Map();

  // Respawn
  respawnTimer: number = 0;

  // Inventory
  inventory: InventoryItem[] = [];

  constructor(id: string, name: string, classType: ClassType) {
    this.id = id;
    this.name = name;
    this.classType = classType;
    this.stats = CLASS_STATS[classType];
    this.abilities = CLASS_ABILITIES[classType];

    this.position = {
      x: PLAYER_SPAWN_X,
      y: PLAYER_SPAWN_Y,
      direction: Direction.S,
    };

    this.health = this.stats.maxHealth;
    this.maxHealth = this.stats.maxHealth;
    this.mana = this.stats.maxMana;
    this.maxMana = this.stats.maxMana;
    this.level = 1;
    this.isDead = false;
    this.targetId = null;
  }

  static fromCharacterInfo(sessionId: string, charInfo: CharacterInfo): Player {
    const player = new Player(sessionId, charInfo.name, charInfo.classType);
    player.characterId = charInfo.id;
    player.level = charInfo.level;
    player.xp = charInfo.xp;

    // Recalculate stats for level
    if (player.level > 1) {
      const scaling = LEVEL_STAT_SCALING[player.classType];
      const baseStats = CLASS_STATS[player.classType];
      player.maxHealth = baseStats.maxHealth + scaling.hp * (player.level - 1);
      player.maxMana = baseStats.maxMana + scaling.mp * (player.level - 1);
    }

    player.position.x = charInfo.posX;
    player.position.y = charInfo.posY;

    // Set health/mana (use max if stored as -1)
    if (charInfo.health > 0) {
      player.health = Math.min(charInfo.health, player.maxHealth);
    }
    if (charInfo.mana > 0) {
      player.mana = Math.min(charInfo.mana, player.maxMana);
    }

    return player;
  }

  toCharacterSaveData(): {
    id: string;
    level: number;
    xp: number;
    posX: number;
    posY: number;
    health: number;
    mana: number;
  } {
    return {
      id: this.characterId,
      level: this.level,
      xp: this.xp,
      posX: this.position.x,
      posY: this.position.y,
      health: this.health,
      mana: this.mana,
    };
  }

  takeDamage(amount: number, sourceId: string): DamageEvent {
    const actualDamage = Math.max(1, Math.round(amount));
    this.health = Math.max(0, this.health - actualDamage);
    this.inCombat = true;
    this.lastCombatTime = Date.now();

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

  heal(amount: number, sourceId: string, abilityId: string | null = null): DamageEvent {
    const actualHeal = Math.min(Math.round(amount), this.maxHealth - this.health);
    this.health = Math.min(this.maxHealth, this.health + actualHeal);

    return {
      sourceId,
      targetId: this.id,
      amount: actualHeal,
      abilityId,
      isCrit: false,
      isDodge: false,
      isMiss: false,
      isHeal: true,
    };
  }

  canAutoAttack(now: number): boolean {
    if (this.isDead) return false;
    const interval = 1000 / this.stats.attackSpeed;
    return now - this.lastAutoAttackTime >= interval;
  }

  canUseAbility(abilityId: string): { ok: boolean; reason?: string } {
    if (this.isDead) return { ok: false, reason: 'You are dead' };

    const ability = this.abilities.find((a) => a.id === abilityId);
    if (!ability) return { ok: false, reason: 'Unknown ability' };

    if (this.mana < ability.manaCost) return { ok: false, reason: 'Not enough mana' };

    const cd = this.cooldowns.get(abilityId);
    if (cd && cd.remaining > 0) return { ok: false, reason: 'Ability on cooldown' };

    return { ok: true };
  }

  startCooldown(abilityId: string): void {
    const ability = this.abilities.find((a) => a.id === abilityId);
    if (!ability) return;
    this.cooldowns.set(abilityId, {
      remaining: ability.cooldown * 1000,
      total: ability.cooldown * 1000,
    });
  }

  updateCooldowns(deltaMs: number): void {
    for (const [id, cd] of this.cooldowns) {
      cd.remaining = Math.max(0, cd.remaining - deltaMs);
      if (cd.remaining <= 0) {
        this.cooldowns.delete(id);
      }
    }
  }

  regenerate(): void {
    if (this.isDead || this.inCombat) return;

    if (this.health < this.maxHealth) {
      this.health = Math.min(
        this.maxHealth,
        this.health + this.maxHealth * HEALTH_REGEN_RATE,
      );
    }
    if (this.mana < this.maxMana) {
      this.mana = Math.min(
        this.maxMana,
        this.mana + this.maxMana * MANA_REGEN_RATE,
      );
    }
  }

  updateCombatState(now: number): void {
    if (this.inCombat && now - this.lastCombatTime > 5000) {
      this.inCombat = false;
    }
  }

  die(): void {
    this.isDead = true;
    this.respawnTimer = RESPAWN_TIME;
    this.targetId = null;
    this.moveDirection = null;
    this.inCombat = false;
  }

  respawn(): void {
    this.isDead = false;
    this.health = this.maxHealth;
    this.mana = this.maxMana;
    this.position = {
      x: PLAYER_SPAWN_X,
      y: PLAYER_SPAWN_Y,
      direction: Direction.S,
    };
    this.respawnTimer = 0;
    this.targetId = null;
  }

  addXp(amount: number): boolean {
    if (this.level >= LEVEL_CAP) return false;

    this.xp += amount;
    let leveled = false;

    while (this.xp >= xpForLevel(this.level) && this.level < LEVEL_CAP) {
      this.xp -= xpForLevel(this.level);
      this.level++;
      leveled = true;

      // Apply level-up stat scaling
      const scaling = LEVEL_STAT_SCALING[this.classType];
      const baseStats = CLASS_STATS[this.classType];
      this.maxHealth = baseStats.maxHealth + scaling.hp * (this.level - 1);
      this.maxMana = baseStats.maxMana + scaling.mp * (this.level - 1);

      // Restore to full on level-up
      this.health = this.maxHealth;
      this.mana = this.maxMana;
    }

    // Clamp XP at cap
    if (this.level >= LEVEL_CAP) {
      this.xp = 0;
    }

    return leveled;
  }

  getCooldownStates(): CooldownState[] {
    const states: CooldownState[] = [];
    for (const [id, cd] of this.cooldowns) {
      states.push({
        abilityId: id,
        remainingMs: cd.remaining,
        totalMs: cd.total,
      });
    }
    return states;
  }

  getEffectiveStats(buffSystem: BuffSystem): ClassStats {
    const mods = buffSystem.getStatModifiers(this.id);
    return {
      maxHealth: Math.round(this.maxHealth * mods.maxHealth),
      maxMana: Math.round(this.maxMana * mods.maxMana),
      attack: Math.round(this.stats.attack * mods.attack),
      defense: Math.round(this.stats.defense * mods.defense),
      speed: this.stats.speed * mods.speed,
      attackRange: this.stats.attackRange,
      attackSpeed: this.stats.attackSpeed,
    };
  }

  toState(buffSystem?: BuffSystem): PlayerState {
    return {
      id: this.id,
      type: EntityType.Player,
      position: { ...this.position },
      name: this.name,
      classType: this.classType,
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      mana: Math.round(this.mana),
      maxMana: this.maxMana,
      level: this.level,
      xp: this.xp,
      xpToNextLevel: this.level >= LEVEL_CAP ? 0 : xpForLevel(this.level),
      isDead: this.isDead,
      targetId: this.targetId,
      buffs: buffSystem ? buffSystem.getBuffStates(this.id) : [],
    };
  }

  // ── Inventory ────────────────────────────────────────────

  addToInventory(itemId: string, quantity: number): boolean {
    const itemDef = ITEM_DATABASE[itemId];
    if (!itemDef) return false;

    // Try to stack with existing item
    if (itemDef.stackable) {
      const existing = this.inventory.find(i => i.itemId === itemId && i.quantity < itemDef.maxStack);
      if (existing) {
        const canAdd = Math.min(quantity, itemDef.maxStack - existing.quantity);
        existing.quantity += canAdd;
        quantity -= canAdd;
        if (quantity <= 0) return true;
      }
    }

    // Find empty slot(s)
    const usedSlots = new Set(this.inventory.map(i => i.slot));
    for (let slot = 0; slot < INVENTORY_SIZE; slot++) {
      if (!usedSlots.has(slot)) {
        const addQty = itemDef.stackable ? Math.min(quantity, itemDef.maxStack) : 1;
        this.inventory.push({ itemId, quantity: addQty, slot });
        quantity -= addQty;
        if (quantity <= 0) return true;
      }
    }

    return quantity <= 0;
  }

  removeFromInventory(slot: number, quantity: number = 1): InventoryItem | null {
    const idx = this.inventory.findIndex(i => i.slot === slot);
    if (idx === -1) return null;

    const item = this.inventory[idx];
    if (quantity >= item.quantity) {
      this.inventory.splice(idx, 1);
      return item;
    }

    item.quantity -= quantity;
    return { ...item, quantity };
  }

  moveInventoryItem(fromSlot: number, toSlot: number): boolean {
    if (fromSlot === toSlot) return false;
    if (toSlot < 0 || toSlot >= INVENTORY_SIZE) return false;

    const fromIdx = this.inventory.findIndex(i => i.slot === fromSlot);
    if (fromIdx === -1) return false;

    const toIdx = this.inventory.findIndex(i => i.slot === toSlot);

    if (toIdx === -1) {
      this.inventory[fromIdx].slot = toSlot;
    } else {
      // Swap slots
      this.inventory[fromIdx].slot = toSlot;
      this.inventory[toIdx].slot = fromSlot;
    }

    return true;
  }

  isInventoryFull(): boolean {
    return this.inventory.length >= INVENTORY_SIZE;
  }
}
