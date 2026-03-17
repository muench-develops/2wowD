import { describe, it, expect, beforeEach } from 'vitest';
import {
  ZoneId,
  ClassType,
  MobType,
  TileType,
  MapData,
  ZONE_METADATA,
  ZONE_PORTALS,
  PORTAL_USE_RANGE,
} from '@isoheim/shared';
import { ZoneManager } from '../ZoneManager.js';
import { World } from '../../core/World.js';
import { Player } from '../../entities/Player.js';
import { Mob } from '../../entities/Mob.js';

function createMapData(width: number, height: number): MapData {
  const tiles = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => TileType.Grass),
  );
  const collisions = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => false),
  );
  return {
    width,
    height,
    tiles,
    collisions,
    spawnPoints: [],
    playerSpawn: { x: Math.floor(width / 2), y: Math.floor(height / 2) },
  };
}

describe('PortalSystem', () => {
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

  describe('Portal Definitions', () => {
    it('should have portal definitions for all zone connections', () => {
      expect(ZONE_PORTALS[ZoneId.StarterPlains].length).toBeGreaterThan(0);
      expect(ZONE_PORTALS[ZoneId.DarkForest].length).toBeGreaterThan(0);
      expect(ZONE_PORTALS[ZoneId.AncientDungeon].length).toBeGreaterThan(0);
    });

    it('should have StarterPlains portal leading to DarkForest', () => {
      const portals = ZONE_PORTALS[ZoneId.StarterPlains];
      const toDark = portals.find((p) => p.targetZone === ZoneId.DarkForest);
      expect(toDark).toBeDefined();
    });

    it('should have DarkForest portals leading to both StarterPlains and AncientDungeon', () => {
      const portals = ZONE_PORTALS[ZoneId.DarkForest];
      expect(portals.find((p) => p.targetZone === ZoneId.StarterPlains)).toBeDefined();
      expect(portals.find((p) => p.targetZone === ZoneId.AncientDungeon)).toBeDefined();
    });
  });

  describe('Portal Symmetry', () => {
    it('should have bidirectional portals between StarterPlains and DarkForest', () => {
      const plainsToDark = ZONE_PORTALS[ZoneId.StarterPlains].find(
        (p) => p.targetZone === ZoneId.DarkForest,
      );
      const darkToPlains = ZONE_PORTALS[ZoneId.DarkForest].find(
        (p) => p.targetZone === ZoneId.StarterPlains,
      );
      expect(plainsToDark).toBeDefined();
      expect(darkToPlains).toBeDefined();
    });

    it('should have bidirectional portals between DarkForest and AncientDungeon', () => {
      const darkToDungeon = ZONE_PORTALS[ZoneId.DarkForest].find(
        (p) => p.targetZone === ZoneId.AncientDungeon,
      );
      const dungeonToDark = ZONE_PORTALS[ZoneId.AncientDungeon].find(
        (p) => p.targetZone === ZoneId.DarkForest,
      );
      expect(darkToDungeon).toBeDefined();
      expect(dungeonToDark).toBeDefined();
    });
  });

  describe('Portal Proximity Validation', () => {
    it('should find portal when player is exactly at portal position', () => {
      const portalPos = ZONE_PORTALS[ZoneId.StarterPlains][0].position;
      const found = zm.findNearestPortal(ZoneId.StarterPlains, portalPos, PORTAL_USE_RANGE);
      expect(found).not.toBeNull();
      expect(found!.targetZone).toBe(ZoneId.DarkForest);
    });

    it('should find portal when player is within PORTAL_USE_RANGE', () => {
      const portalPos = ZONE_PORTALS[ZoneId.StarterPlains][0].position;
      const nearPos = { x: portalPos.x + 1, y: portalPos.y };
      const found = zm.findNearestPortal(ZoneId.StarterPlains, nearPos, PORTAL_USE_RANGE);
      expect(found).not.toBeNull();
    });

    it('should NOT find portal when player is beyond PORTAL_USE_RANGE', () => {
      const portalPos = ZONE_PORTALS[ZoneId.StarterPlains][0].position;
      const farPos = { x: portalPos.x + 10, y: portalPos.y + 10 };
      const found = zm.findNearestPortal(ZoneId.StarterPlains, farPos, PORTAL_USE_RANGE);
      expect(found).toBeNull();
    });

    it('should select nearest portal when multiple exist (DarkForest)', () => {
      const portals = ZONE_PORTALS[ZoneId.DarkForest];
      const nearFirst = { x: portals[0].position.x, y: portals[0].position.y };
      const found = zm.findNearestPortal(ZoneId.DarkForest, nearFirst, PORTAL_USE_RANGE);
      expect(found).not.toBeNull();
      expect(found!.targetZone).toBe(portals[0].targetZone);
    });
  });

  describe('Zone Transition via World.changePlayerZone', () => {
    it('should move player to new zone and update position', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.StarterPlains;
      world.addPlayer(player);

      const portal = ZONE_PORTALS[ZoneId.StarterPlains][0];
      world.changePlayerZone(player, portal.targetZone, portal.targetSpawnPoint);

      expect(player.currentZone).toBe(ZoneId.DarkForest);
      expect(player.position.x).toBe(portal.targetSpawnPoint.x);
      expect(player.position.y).toBe(portal.targetSpawnPoint.y);
    });

    it('should remove player from old zone after transition', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.StarterPlains;
      world.addPlayer(player);

      world.changePlayerZone(player, ZoneId.DarkForest, { x: 5, y: 30 });

      expect(zm.getPlayersInZone(ZoneId.StarterPlains)).toHaveLength(0);
      expect(zm.getPlayersInZone(ZoneId.DarkForest)).toHaveLength(1);
    });

    it('should clear player target on zone change', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.StarterPlains;
      player.targetId = 'some-mob';
      world.addPlayer(player);

      world.changePlayerZone(player, ZoneId.DarkForest, { x: 5, y: 30 });
      expect(player.targetId).toBeNull();
    });

    it('should clear player moveDirection on zone change', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.StarterPlains;
      player.moveDirection = { x: 1, y: 0 };
      world.addPlayer(player);

      world.changePlayerZone(player, ZoneId.DarkForest, { x: 5, y: 30 });
      expect(player.moveDirection).toBeNull();
    });

    it('should clear mob aggro targeting the player in old zone', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.StarterPlains;
      world.addPlayer(player);

      const mob = new Mob(MobType.Goblin, { x: 10, y: 10 }, 30, ZoneId.StarterPlains);
      mob.targetId = 'p1';
      mob.threatTable.set('p1', 100);
      world.addMob(mob, ZoneId.StarterPlains);

      world.changePlayerZone(player, ZoneId.DarkForest, { x: 5, y: 30 });

      expect(mob.targetId).toBeNull();
      expect(mob.threatTable.has('p1')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should not crash when transitioning to invalid zone', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.StarterPlains;
      world.addPlayer(player);

      world.changePlayerZone(player, 'invalid' as ZoneId, { x: 0, y: 0 });
      // Player should remain in original zone
      expect(player.currentZone).toBe(ZoneId.StarterPlains);
    });

    it('should handle round-trip portal travel correctly', () => {
      const player = new Player('p1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.StarterPlains;
      world.addPlayer(player);

      // Go to Dark Forest
      world.changePlayerZone(player, ZoneId.DarkForest, { x: 5, y: 30 });
      expect(player.currentZone).toBe(ZoneId.DarkForest);

      // Return to Starter Plains
      world.changePlayerZone(player, ZoneId.StarterPlains, { x: 46, y: 25 });
      expect(player.currentZone).toBe(ZoneId.StarterPlains);
      expect(zm.getPlayersInZone(ZoneId.DarkForest)).toHaveLength(0);
      expect(zm.getPlayersInZone(ZoneId.StarterPlains)).toHaveLength(1);
    });
  });
});
