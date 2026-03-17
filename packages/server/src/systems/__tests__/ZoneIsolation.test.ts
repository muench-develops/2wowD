import { describe, it, expect, beforeEach } from 'vitest';
import {
  ZoneId,
  ClassType,
  MobType,
  TileType,
  MapData,
  ZONE_METADATA,
  AGGRO_RANGE,
} from '@isoheim/shared';
import { ZoneManager } from '../ZoneManager.js';
import { World } from '../../core/World.js';
import { Player } from '../../entities/Player.js';
import { Mob } from '../../entities/Mob.js';

function createMapData(width: number, height: number): MapData {
  return {
    width,
    height,
    tiles: Array.from({ length: height }, () => Array(width).fill(TileType.Grass)),
    collisions: Array.from({ length: height }, () => Array(width).fill(false)),
    spawnPoints: [],
    playerSpawn: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
  };
}

describe('ZoneIsolation', () => {
  let zm: ZoneManager;
  let world: World;

  beforeEach(() => {
    zm = new ZoneManager();
    for (const zoneId of Object.values(ZoneId)) {
      const meta = ZONE_METADATA[zoneId];
      zm.registerZone(zoneId, createMapData(meta.width, meta.height));
    }
    world = new World(zm);
  });

  describe('Player Visibility Between Zones', () => {
    it('should NOT include players from different zones in zone player list', () => {
      const p1 = new Player('p1', 'Alice', ClassType.Warrior);
      p1.currentZone = ZoneId.StarterPlains;
      const p2 = new Player('p2', 'Bob', ClassType.Mage);
      p2.currentZone = ZoneId.DarkForest;

      world.addPlayer(p1);
      world.addPlayer(p2);

      const plainsPlayers = zm.getPlayersInZone(ZoneId.StarterPlains);
      const forestPlayers = zm.getPlayersInZone(ZoneId.DarkForest);

      expect(plainsPlayers.map((p) => p.id)).toEqual(['p1']);
      expect(forestPlayers.map((p) => p.id)).toEqual(['p2']);
    });

    it('should show players in same zone to each other', () => {
      const p1 = new Player('p1', 'Alice', ClassType.Warrior);
      p1.currentZone = ZoneId.StarterPlains;
      const p2 = new Player('p2', 'Bob', ClassType.Mage);
      p2.currentZone = ZoneId.StarterPlains;

      world.addPlayer(p1);
      world.addPlayer(p2);

      const plainsPlayers = zm.getPlayersInZone(ZoneId.StarterPlains);
      expect(plainsPlayers).toHaveLength(2);
      expect(plainsPlayers.map((p) => p.id)).toContain('p1');
      expect(plainsPlayers.map((p) => p.id)).toContain('p2');
    });

    it('should update visibility when player changes zones', () => {
      const p1 = new Player('p1', 'Alice', ClassType.Warrior);
      p1.currentZone = ZoneId.StarterPlains;
      const p2 = new Player('p2', 'Bob', ClassType.Mage);
      p2.currentZone = ZoneId.DarkForest;

      world.addPlayer(p1);
      world.addPlayer(p2);

      // Move p2 to same zone as p1
      world.changePlayerZone(p2, ZoneId.StarterPlains, { x: 25, y: 25 });

      const plainsPlayers = zm.getPlayersInZone(ZoneId.StarterPlains);
      expect(plainsPlayers).toHaveLength(2);
      expect(zm.getPlayersInZone(ZoneId.DarkForest)).toHaveLength(0);
    });
  });

  describe('Mob Aggro Across Zones', () => {
    it('should only return mobs from their zone via getPlayersNearInZone', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.StarterPlains;
      player.position.x = 10;
      player.position.y = 10;
      world.addPlayer(player);

      const mob = new Mob(MobType.Goblin, { x: 11, y: 11 }, 30, ZoneId.DarkForest);
      world.addMob(mob, ZoneId.DarkForest);

      // Player is in StarterPlains, mob is in DarkForest — no aggro overlap
      const nearbyPlayersForMob = zm.getPlayersNearInZone(ZoneId.DarkForest, mob.position, AGGRO_RANGE);
      expect(nearbyPlayersForMob).toHaveLength(0);
    });

    it('should aggro on players in the same zone', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.DarkForest;
      player.position.x = 11;
      player.position.y = 11;
      world.addPlayer(player);

      const mob = new Mob(MobType.Wolf, { x: 10, y: 10 }, 30, ZoneId.DarkForest);
      world.addMob(mob, ZoneId.DarkForest);

      const nearbyPlayers = zm.getPlayersNearInZone(ZoneId.DarkForest, mob.position, AGGRO_RANGE);
      expect(nearbyPlayers).toHaveLength(1);
      expect(nearbyPlayers[0].id).toBe('p1');
    });

    it('should drop aggro when target changes zones', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.DarkForest;
      world.addPlayer(player);

      const mob = new Mob(MobType.Wolf, { x: 10, y: 10 }, 30, ZoneId.DarkForest);
      mob.targetId = 'p1';
      mob.threatTable.set('p1', 100);
      world.addMob(mob, ZoneId.DarkForest);

      // Player escapes via portal
      world.changePlayerZone(player, ZoneId.StarterPlains, { x: 25, y: 25 });

      expect(mob.targetId).toBeNull();
      expect(mob.threatTable.has('p1')).toBe(false);
    });

    it('should only consider same-zone players for proximity checks', () => {
      const p1 = new Player('p1', 'Same', ClassType.Warrior);
      p1.currentZone = ZoneId.DarkForest;
      p1.position.x = 11;
      p1.position.y = 11;

      const p2 = new Player('p2', 'Different', ClassType.Mage);
      p2.currentZone = ZoneId.StarterPlains;
      p2.position.x = 11;
      p2.position.y = 11;

      world.addPlayer(p1);
      world.addPlayer(p2);

      const near = zm.getPlayersNearInZone(ZoneId.DarkForest, { x: 10, y: 10 }, AGGRO_RANGE);
      expect(near).toHaveLength(1);
      expect(near[0].id).toBe('p1');
    });
  });

  describe('Loot Isolation Between Zones', () => {
    it('should isolate loot per zone', () => {
      const loot1 = { id: 'l1', position: { x: 5, y: 5 }, items: [], killerId: 'p1', killerOnlyUntil: 0, expiresAt: 0 };
      const loot2 = { id: 'l2', position: { x: 5, y: 5 }, items: [], killerId: 'p2', killerOnlyUntil: 0, expiresAt: 0 };

      world.addLoot(loot1, ZoneId.StarterPlains);
      world.addLoot(loot2, ZoneId.DarkForest);

      const plainsLoot = world.getLootsInZone(ZoneId.StarterPlains);
      const forestLoot = world.getLootsInZone(ZoneId.DarkForest);

      expect(plainsLoot.size).toBe(1);
      expect(plainsLoot.has('l1')).toBe(true);
      expect(forestLoot.size).toBe(1);
      expect(forestLoot.has('l2')).toBe(true);
    });

    it('should not show loot from one zone in another', () => {
      const loot = { id: 'l1', position: { x: 5, y: 5 }, items: [], killerId: 'p1', killerOnlyUntil: 0, expiresAt: 0 };
      world.addLoot(loot, ZoneId.AncientDungeon);

      expect(world.getLootsInZone(ZoneId.StarterPlains).size).toBe(0);
      expect(world.getLootsInZone(ZoneId.DarkForest).size).toBe(0);
      expect(world.getLootsInZone(ZoneId.AncientDungeon).size).toBe(1);
    });
  });

  describe('Combat Isolation', () => {
    it('should scope getPlayersNear to a specific zone', () => {
      const p1 = new Player('p1', 'Plains', ClassType.Warrior);
      p1.currentZone = ZoneId.StarterPlains;
      p1.position.x = 10;
      p1.position.y = 10;

      const p2 = new Player('p2', 'Forest', ClassType.Mage);
      p2.currentZone = ZoneId.DarkForest;
      p2.position.x = 10;
      p2.position.y = 10;

      world.addPlayer(p1);
      world.addPlayer(p2);

      // When querying with zone scope, should only find zone-local player
      const nearPlains = world.getPlayersNear({ x: 10, y: 10 }, 5, ZoneId.StarterPlains);
      expect(nearPlains).toHaveLength(1);
      expect(nearPlains[0].id).toBe('p1');

      const nearForest = world.getPlayersNear({ x: 10, y: 10 }, 5, ZoneId.DarkForest);
      expect(nearForest).toHaveLength(1);
      expect(nearForest[0].id).toBe('p2');
    });

    it('should scope getMobsNear to a specific zone', () => {
      const mob1 = new Mob(MobType.Goblin, { x: 10, y: 10 }, 30, ZoneId.StarterPlains);
      const mob2 = new Mob(MobType.Wolf, { x: 10, y: 10 }, 30, ZoneId.DarkForest);

      world.addMob(mob1, ZoneId.StarterPlains);
      world.addMob(mob2, ZoneId.DarkForest);

      const nearPlains = world.getMobsNear({ x: 10, y: 10 }, 5, ZoneId.StarterPlains);
      expect(nearPlains).toHaveLength(1);
      expect(nearPlains[0].id).toBe(mob1.id);

      const nearForest = world.getMobsNear({ x: 10, y: 10 }, 5, ZoneId.DarkForest);
      expect(nearForest).toHaveLength(1);
      expect(nearForest[0].id).toBe(mob2.id);
    });

    it('should use zone-specific collision maps', () => {
      // AncientDungeon is 40x40, so coordinate 45 is out of bounds
      expect(world.isCollision(45, 45, ZoneId.AncientDungeon)).toBe(true);
      // But 45,45 is valid in DarkForest (60x60)
      expect(world.isCollision(45, 45, ZoneId.DarkForest)).toBe(false);
    });
  });

  describe('Zone State Independence', () => {
    it('should maintain independent player maps per zone', () => {
      const p1 = new Player('p1', 'A', ClassType.Warrior);
      p1.currentZone = ZoneId.StarterPlains;
      const p2 = new Player('p2', 'B', ClassType.Mage);
      p2.currentZone = ZoneId.DarkForest;

      world.addPlayer(p1);
      world.addPlayer(p2);

      const plainsZone = zm.getZone(ZoneId.StarterPlains)!;
      const forestZone = zm.getZone(ZoneId.DarkForest)!;

      expect(plainsZone.players.size).toBe(1);
      expect(forestZone.players.size).toBe(1);
      expect(plainsZone.players.has('p2')).toBe(false);
      expect(forestZone.players.has('p1')).toBe(false);
    });

    it('should maintain independent mob maps per zone', () => {
      const mob1 = new Mob(MobType.Goblin, { x: 10, y: 10 }, 30, ZoneId.StarterPlains);
      const mob2 = new Mob(MobType.BoneLord, { x: 20, y: 20 }, 600, ZoneId.AncientDungeon);

      world.addMob(mob1, ZoneId.StarterPlains);
      world.addMob(mob2, ZoneId.AncientDungeon);

      expect(zm.getMobsInZone(ZoneId.StarterPlains)).toHaveLength(1);
      expect(zm.getMobsInZone(ZoneId.AncientDungeon)).toHaveLength(1);
      expect(zm.getMobsInZone(ZoneId.DarkForest)).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should track player in correct final zone after rapid transitions', () => {
      const player = new Player('p1', 'Speedster', ClassType.Rogue);
      player.currentZone = ZoneId.StarterPlains;
      world.addPlayer(player);

      world.changePlayerZone(player, ZoneId.DarkForest, { x: 5, y: 30 });
      world.changePlayerZone(player, ZoneId.AncientDungeon, { x: 20, y: 38 });

      expect(zm.getPlayersInZone(ZoneId.StarterPlains)).toHaveLength(0);
      expect(zm.getPlayersInZone(ZoneId.DarkForest)).toHaveLength(0);
      expect(zm.getPlayersInZone(ZoneId.AncientDungeon)).toHaveLength(1);
      expect(player.currentZone).toBe(ZoneId.AncientDungeon);
    });

    it('should correctly remove player from world across zones', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.DarkForest;
      world.addPlayer(player);

      const removed = world.removePlayer('p1');
      expect(removed).toBeDefined();
      expect(removed!.id).toBe('p1');
      expect(zm.getPlayersInZone(ZoneId.DarkForest)).toHaveLength(0);
    });

    it('should return correct zone for a player via getPlayerZone', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.AncientDungeon;
      world.addPlayer(player);

      expect(world.getPlayerZone('p1')).toBe(ZoneId.AncientDungeon);
      expect(world.getPlayerZone('nonexistent')).toBeUndefined();
    });

    it('should return correct zone for a mob via getMobZone', () => {
      const mob = new Mob(MobType.BoneLord, { x: 20, y: 20 }, 600, ZoneId.AncientDungeon);
      world.addMob(mob, ZoneId.AncientDungeon);

      expect(world.getMobZone(mob.id)).toBe(ZoneId.AncientDungeon);
      expect(world.getMobZone('nonexistent')).toBeUndefined();
    });
  });
});
