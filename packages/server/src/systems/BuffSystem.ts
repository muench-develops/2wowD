import {
  BuffDef,
  BuffState,
  DamageEvent,
  ServerMessageType,
  generateId,
} from '@2wowd/shared';
import { NetworkManager } from '../network/NetworkManager.js';

interface ActiveBuff {
  instanceId: string;
  def: BuffDef;
  remainingMs: number;
  totalMs: number;
  tickTimer: number; // ms until next tick
}

export class BuffSystem {
  private buffs: Map<string, ActiveBuff[]> = new Map();
  private network: NetworkManager;

  constructor(network: NetworkManager) {
    this.network = network;
  }

  applyBuff(entityId: string, buffDef: BuffDef): void {
    let entityBuffs = this.buffs.get(entityId);
    if (!entityBuffs) {
      entityBuffs = [];
      this.buffs.set(entityId, entityBuffs);
    }

    // Refresh if same buff already exists
    const existing = entityBuffs.find((b) => b.def.id === buffDef.id);
    if (existing) {
      existing.remainingMs = buffDef.duration;
      existing.totalMs = buffDef.duration;
      existing.tickTimer = buffDef.tickInterval;
    } else {
      entityBuffs.push({
        instanceId: generateId(),
        def: buffDef,
        remainingMs: buffDef.duration,
        totalMs: buffDef.duration,
        tickTimer: buffDef.tickInterval,
      });
    }

    // Broadcast buff applied
    const state = this.getBuffStateFor(entityId, buffDef.id);
    if (state) {
      this.network.broadcastToAll({
        type: ServerMessageType.BuffApplied,
        entityId,
        buff: state,
      });
    }
  }

  removeBuff(entityId: string, buffId: string): void {
    const entityBuffs = this.buffs.get(entityId);
    if (!entityBuffs) return;

    const idx = entityBuffs.findIndex((b) => b.def.id === buffId);
    if (idx !== -1) {
      entityBuffs.splice(idx, 1);
      this.network.broadcastToAll({
        type: ServerMessageType.BuffRemoved,
        entityId,
        buffId,
      });
    }

    if (entityBuffs.length === 0) {
      this.buffs.delete(entityId);
    }
  }

  /** Returns tick damage/heal events that need broadcasting */
  update(deltaMs: number): Array<{ entityId: string; damage: number; heal: number }> {
    const tickEffects: Array<{ entityId: string; damage: number; heal: number }> = [];

    for (const [entityId, entityBuffs] of this.buffs) {
      const toRemove: string[] = [];

      for (const buff of entityBuffs) {
        buff.remainingMs -= deltaMs;

        // Process tick effects (DoT/HoT)
        if (buff.def.tickInterval > 0 && (buff.def.tickDamage > 0 || buff.def.tickHeal > 0)) {
          buff.tickTimer -= deltaMs;
          if (buff.tickTimer <= 0) {
            buff.tickTimer += buff.def.tickInterval;
            tickEffects.push({
              entityId,
              damage: buff.def.tickDamage,
              heal: buff.def.tickHeal,
            });
          }
        }

        if (buff.remainingMs <= 0) {
          toRemove.push(buff.def.id);
        }
      }

      for (const buffId of toRemove) {
        this.removeBuff(entityId, buffId);
      }
    }

    return tickEffects;
  }

  getStatModifiers(entityId: string): Record<string, number> {
    const mods: Record<string, number> = {
      attack: 1,
      defense: 1,
      speed: 1,
      maxHealth: 1,
      maxMana: 1,
    };

    const entityBuffs = this.buffs.get(entityId);
    if (!entityBuffs) return mods;

    for (const buff of entityBuffs) {
      for (const [stat, multiplier] of Object.entries(buff.def.statModifiers)) {
        if (multiplier != null && stat in mods) {
          mods[stat] *= multiplier;
        }
      }
    }

    return mods;
  }

  getBuffStates(entityId: string): BuffState[] {
    const entityBuffs = this.buffs.get(entityId);
    if (!entityBuffs) return [];

    return entityBuffs.map((b) => ({
      id: b.instanceId,
      buffId: b.def.id,
      name: b.def.name,
      remainingMs: Math.max(0, b.remainingMs),
      totalMs: b.totalMs,
      isDebuff: b.def.isDebuff,
    }));
  }

  hasBuff(entityId: string, buffId: string): boolean {
    const entityBuffs = this.buffs.get(entityId);
    if (!entityBuffs) return false;
    return entityBuffs.some((b) => b.def.id === buffId);
  }

  /** Clean up all buffs for an entity (e.g., on death or disconnect) */
  clearBuffs(entityId: string): void {
    const entityBuffs = this.buffs.get(entityId);
    if (!entityBuffs) return;

    for (const buff of entityBuffs) {
      this.network.broadcastToAll({
        type: ServerMessageType.BuffRemoved,
        entityId,
        buffId: buff.def.id,
      });
    }
    this.buffs.delete(entityId);
  }

  private getBuffStateFor(entityId: string, buffId: string): BuffState | null {
    const entityBuffs = this.buffs.get(entityId);
    if (!entityBuffs) return null;

    const buff = entityBuffs.find((b) => b.def.id === buffId);
    if (!buff) return null;

    return {
      id: buff.instanceId,
      buffId: buff.def.id,
      name: buff.def.name,
      remainingMs: Math.max(0, buff.remainingMs),
      totalMs: buff.totalMs,
      isDebuff: buff.def.isDebuff,
    };
  }
}
