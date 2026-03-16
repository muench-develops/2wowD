import {
  MapData,
  Vec2,
  distance,
} from '@2wowd/shared';
import { Player } from '../entities/Player.js';
import { Mob } from '../entities/Mob.js';

export class World {
  readonly players: Map<string, Player> = new Map();
  readonly mobs: Map<string, Mob> = new Map();
  mapData: MapData;

  constructor(mapData: MapData) {
    this.mapData = mapData;
  }

  addPlayer(player: Player): void {
    this.players.set(player.id, player);
  }

  removePlayer(playerId: string): Player | undefined {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      // Clear mob targets referencing this player
      for (const mob of this.mobs.values()) {
        if (mob.targetId === playerId) {
          mob.targetId = null;
          mob.threatTable.delete(playerId);
        }
      }
    }
    return player;
  }

  getPlayer(id: string): Player | undefined {
    return this.players.get(id);
  }

  getMob(id: string): Mob | undefined {
    return this.mobs.get(id);
  }

  addMob(mob: Mob): void {
    this.mobs.set(mob.id, mob);
  }

  removeMob(mobId: string): void {
    this.mobs.delete(mobId);
  }

  getPlayersNear(pos: Vec2, range: number): Player[] {
    const result: Player[] = [];
    for (const player of this.players.values()) {
      if (!player.isDead && distance(player.position, pos) <= range) {
        result.push(player);
      }
    }
    return result;
  }

  getMobsNear(pos: Vec2, range: number): Mob[] {
    const result: Mob[] = [];
    for (const mob of this.mobs.values()) {
      if (!mob.isDead && distance(mob.position, pos) <= range) {
        result.push(mob);
      }
    }
    return result;
  }

  isCollision(x: number, y: number): boolean {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);
    if (tileX < 0 || tileX >= this.mapData.width || tileY < 0 || tileY >= this.mapData.height) {
      return true;
    }
    return this.mapData.collisions[tileY][tileX];
  }
}
