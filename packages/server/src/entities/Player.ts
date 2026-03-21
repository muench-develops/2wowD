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
  CharacterInfo,
  InventoryItem,
  ZoneId,
  EquipmentSlot,
  PlayerEquipment,
  ItemStats,
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
  ZONE_PLAYER_SPAWNS,
  EQUIPMENT_SLOT_FOR_ITEM_TYPE,
  xpForLevel,
  createDefaultEquipmentMap,
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

  // Consumables
  potionSharedCooldownUntil: number = 0;
  itemCooldowns: Map<string, number> = new Map();
  bandageHoTActive: boolean = false;
  bandageHoTEndTime: number = 0;
  bandageHoTTicksRemaining: number = 0;
  bandageHealPerTick: number = 0;

  // Inventory
  inventory: InventoryItem[] = [];

  // Equipment
  equipment: Map<EquipmentSlot, string | null> = createDefaultEquipmentMap();

  // Zone
  currentZone: ZoneId = ZoneId.StarterPlains;

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

    // Load zone
    if (charInfo.currentZone) {
      player.currentZone = charInfo.currentZone;
    }

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
    currentZone: string;
  } {
    return {
      id: this.characterId,
      level: this.level,
      xp: this.xp,
      posX: this.position.x,
      posY: this.position.y,
      health: this.health,
      mana: this.mana,
      currentZone: this.currentZone,
    };
  }

  takeDamage(amount: number, sourceId: string): DamageEvent {
    const actualDamage = Math.max(1, Math.round(amount));
    this.health = Math.max(0, this.health - actualDamage);
    this.inCombat = true;
    this.lastCombatTime = Date.now();

    // Interrupt bandage HoT on damage
    if (this.bandageHoTActive) {
      this.bandageHoTActive = false;
      this.bandageHoTTicksRemaining = 0;
    }

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
    const spawn = ZONE_PLAYER_SPAWNS[this.currentZone];
    this.position = {
      x: spawn.x,
      y: spawn.y,
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

  canUseConsumable(itemId: string, now: number): { canUse: boolean; reason?: string } {
    const itemCd = this.itemCooldowns.get(itemId);
    if (itemCd && itemCd > now) {
      return { canUse: false, reason: 'Item on cooldown' };
    }
    if (this.potionSharedCooldownUntil > now) {
      return { canUse: false, reason: 'Potion cooldown active' };
    }
    return { canUse: true };
  }

  startPotionCooldown(now: number, sharedCooldownMs: number): void {
    this.potionSharedCooldownUntil = now + sharedCooldownMs;
  }

  setItemCooldown(itemId: string, now: number, cooldownMs: number): void {
    this.itemCooldowns.set(itemId, now + cooldownMs);
  }

  getPotionCooldownState(now: number): { sharedCooldownMs: number; itemCooldowns: Record<string, number> } {
    const sharedMs = Math.max(0, this.potionSharedCooldownUntil - now);
    const itemCds: Record<string, number> = {};
    for (const [itemId, expiry] of this.itemCooldowns) {
      const remaining = Math.max(0, expiry - now);
      if (remaining > 0) {
        itemCds[itemId] = remaining;
      }
    }
    return { sharedCooldownMs: sharedMs, itemCooldowns: itemCds };
  }

  getEffectiveStats(buffSystem: BuffSystem): ClassStats {
    const mods = buffSystem.getStatModifiers(this.id);
    const equipStats = this.getEquippedStats();
    
    // Recalculate max health/mana with equipment
    const baseMaxHealth = this.maxHealth;
    const baseMaxMana = this.maxMana;
    const equipMaxHealth = baseMaxHealth + (equipStats.health || 0);
    const equipMaxMana = baseMaxMana + (equipStats.mana || 0);

    return {
      maxHealth: Math.round(equipMaxHealth * mods.maxHealth),
      maxMana: Math.round(equipMaxMana * mods.maxMana),
      attack: Math.round((this.stats.attack + (equipStats.attack || 0)) * mods.attack),
      defense: Math.round((this.stats.defense + (equipStats.defense || 0)) * mods.defense),
      speed: (this.stats.speed + (equipStats.speed || 0)) * mods.speed,
      attackRange: this.stats.attackRange,
      attackSpeed: this.stats.attackSpeed,
    };
  }

  getEquippedStats(): ItemStats {
    const stats: ItemStats = {
      attack: 0,
      defense: 0,
      health: 0,
      mana: 0,
      speed: 0,
      critChance: 0,
    };

    for (const itemId of this.equipment.values()) {
      if (!itemId) continue;
      const itemDef = ITEM_DATABASE[itemId];
      if (!itemDef || !itemDef.stats) continue;

      if (itemDef.stats.attack) stats.attack! += itemDef.stats.attack;
      if (itemDef.stats.defense) stats.defense! += itemDef.stats.defense;
      if (itemDef.stats.health) stats.health! += itemDef.stats.health;
      if (itemDef.stats.mana) stats.mana! += itemDef.stats.mana;
      if (itemDef.stats.speed) stats.speed! += itemDef.stats.speed;
      if (itemDef.stats.critChance) stats.critChance! += itemDef.stats.critChance;
    }

    return stats;
  }

  equipItem(inventorySlot: number, equipSlot: EquipmentSlot): boolean {
    const invItem = this.inventory.find(i => i.slot === inventorySlot);
    if (!invItem) return false;

    const itemDef = ITEM_DATABASE[invItem.itemId];
    if (!itemDef) return false;

    // Check if item can be equipped in this slot
    const correctSlot = EQUIPMENT_SLOT_FOR_ITEM_TYPE[itemDef.type];
    if (!correctSlot) return false;

    // For rings, allow either Ring1 or Ring2
    if (itemDef.type === 'ring' && equipSlot !== EquipmentSlot.Ring1 && equipSlot !== EquipmentSlot.Ring2) {
      return false;
    } else if (itemDef.type !== 'ring' && correctSlot !== equipSlot) {
      return false;
    }

    // Check level requirement
    if (this.level < itemDef.levelReq) return false;

    // Check class requirement
    if (itemDef.classReq.length > 0 && !itemDef.classReq.includes(this.classType)) {
      return false;
    }

    // If slot is occupied, unequip current item first
    const currentItemId = this.equipment.get(equipSlot);
    if (currentItemId) {
      // Try to move to inventory
      if (!this.addToInventory(currentItemId, 1)) {
        return false; // Inventory full
      }
    }

    // Equip new item
    this.equipment.set(equipSlot, invItem.itemId);
    this.removeFromInventory(inventorySlot, 1);

    return true;
  }

  unequipItem(equipSlot: EquipmentSlot): boolean {
    const itemId = this.equipment.get(equipSlot);
    if (!itemId) return false;

    // Check inventory has space
    if (this.isInventoryFull()) return false;

    // Move to inventory
    if (!this.addToInventory(itemId, 1)) return false;

    // Remove from equipment
    this.equipment.set(equipSlot, null);

    return true;
  }

  getEquipmentState(): PlayerEquipment {
    return {
      [EquipmentSlot.Weapon]: this.equipment.get(EquipmentSlot.Weapon) || undefined,
      [EquipmentSlot.Head]: this.equipment.get(EquipmentSlot.Head) || undefined,
      [EquipmentSlot.Chest]: this.equipment.get(EquipmentSlot.Chest) || undefined,
      [EquipmentSlot.Legs]: this.equipment.get(EquipmentSlot.Legs) || undefined,
      [EquipmentSlot.Boots]: this.equipment.get(EquipmentSlot.Boots) || undefined,
      [EquipmentSlot.Ring1]: this.equipment.get(EquipmentSlot.Ring1) || undefined,
      [EquipmentSlot.Ring2]: this.equipment.get(EquipmentSlot.Ring2) || undefined,
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
      currentZone: this.currentZone,
      equipment: this.getEquipmentState(),
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
