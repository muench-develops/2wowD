import { describe, it, expect, beforeEach } from 'vitest';
import {
  ZoneId,
  MobType,
  ClassType,
  TileType,
  MapData,
  ZONE_METADATA,
  ZONE_PORTALS,
  PORTAL_USE_RANGE,
} from '@isoheim/shared';
import { ZoneManager } from '../ZoneManager.js';
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

describe('ZoneManager', () => {
  let zm: ZoneManager;

  beforeEach(() => {
    zm = new ZoneManager();
    for (const zoneId of Object.values(ZoneId)) {
      const meta = ZONE_METADATA[zoneId];
      zm.registerZone(zoneId, createMapData(meta.width, meta.height));
    }
  });

  describe('Zone Registration and Lookup', () => {
    it('should register all three zones', () => {
      expect(zm.getZone(ZoneId.StarterPlains)).toBeDefined();
      expect(zm.getZone(ZoneId.DarkForest)).toBeDefined();
      expect(zm.getZone(ZoneId.AncientDungeon)).toBeDefined();
    });

    it('should store correct dimensions from ZONE_METADATA', () => {
      for (const zoneId of Object.values(ZoneId)) {
        const dims = zm.getZoneDimensions(zoneId);
        const meta = ZONE_METADATA[zoneId];
        expect(dims).toEqual({ width: meta.width, height: meta.height });
      }
    });

    it('should return undefined for unregistered zone', () => {
      expect(zm.getZone('invalid-zone' as ZoneId)).toBeUndefined();
    });

    it('should list all registered zones via getAllZones', () => {
      const zones = zm.getAllZones();
      expect(zones).toHaveLength(3);
      const ids = zones.map((z) => z.id);
      expect(ids).toContain(ZoneId.StarterPlains);
      expect(ids).toContain(ZoneId.DarkForest);
      expect(ids).toContain(ZoneId.AncientDungeon);
    });
  });

  describe('Zone-Scoped Player Queries', () => {
    it('should return only players added to a specific zone', () => {
      const p1 = new Player('p1', 'Alice', ClassType.Warrior);
      const p2 = new Player('p2', 'Bob', ClassType.Mage);
      p1.currentZone = ZoneId.StarterPlains;
      p2.currentZone = ZoneId.DarkForest;

      zm.getZone(ZoneId.StarterPlains)!.players.set(p1.id, p1);
      zm.getZone(ZoneId.DarkForest)!.players.set(p2.id, p2);

      const plainsPlayers = zm.getPlayersInZone(ZoneId.StarterPlains);
      expect(plainsPlayers).toHaveLength(1);
      expect(plainsPlayers[0].id).toBe('p1');

      const forestPlayers = zm.getPlayersInZone(ZoneId.DarkForest);
      expect(forestPlayers).toHaveLength(1);
      expect(forestPlayers[0].id).toBe('p2');
    });

    it('should return empty array for zone with no players', () => {
      expect(zm.getPlayersInZone(ZoneId.AncientDungeon)).toEqual([]);
    });

    it('should return player IDs via getPlayerIdsInZone', () => {
      const p1 = new Player('sess-1', 'Alice', ClassType.Warrior);
      zm.getZone(ZoneId.StarterPlains)!.players.set(p1.id, p1);

      const ids = zm.getPlayerIdsInZone(ZoneId.StarterPlains);
      expect(ids).toEqual(['sess-1']);
    });

    it('should return empty array for invalid zone ID', () => {
      expect(zm.getPlayersInZone('invalid' as ZoneId)).toEqual([]);
    });
  });

  describe('Zone-Scoped Mob Queries', () => {
    it('should return only mobs in specified zone', () => {
      const mob1 = new Mob(MobType.Goblin, { x: 10, y: 10 }, 30, ZoneId.StarterPlains);
      const mob2 = new Mob(MobType.Wolf, { x: 20, y: 20 }, 30, ZoneId.DarkForest);

      zm.getZone(ZoneId.StarterPlains)!.mobs.set(mob1.id, mob1);
      zm.getZone(ZoneId.DarkForest)!.mobs.set(mob2.id, mob2);

      expect(zm.getMobsInZone(ZoneId.StarterPlains)).toHaveLength(1);
      expect(zm.getMobsInZone(ZoneId.StarterPlains)[0].id).toBe(mob1.id);
      expect(zm.getMobsInZone(ZoneId.DarkForest)).toHaveLength(1);
      expect(zm.getMobsInZone(ZoneId.DarkForest)[0].id).toBe(mob2.id);
    });

    it('should return empty array for zone with no mobs', () => {
      expect(zm.getMobsInZone(ZoneId.AncientDungeon)).toEqual([]);
    });

    it('should return empty array for invalid zone ID', () => {
      expect(zm.getMobsInZone('invalid' as ZoneId)).toEqual([]);
    });
  });

  describe('Proximity Queries', () => {
    it('should find players near a position within the same zone', () => {
      const p1 = new Player('p1', 'Near', ClassType.Warrior);
      p1.position.x = 10;
      p1.position.y = 10;
      const p2 = new Player('p2', 'Far', ClassType.Mage);
      p2.position.x = 40;
      p2.position.y = 40;

      zm.getZone(ZoneId.StarterPlains)!.players.set(p1.id, p1);
      zm.getZone(ZoneId.StarterPlains)!.players.set(p2.id, p2);

      const nearby = zm.getPlayersNearInZone(ZoneId.StarterPlains, { x: 11, y: 11 }, 5);
      expect(nearby).toHaveLength(1);
      expect(nearby[0].id).toBe('p1');
    });

    it('should exclude dead players from proximity queries', () => {
      const p1 = new Player('p1', 'Dead', ClassType.Warrior);
      p1.position.x = 10;
      p1.position.y = 10;
      p1.isDead = true;

      zm.getZone(ZoneId.StarterPlains)!.players.set(p1.id, p1);
      const nearby = zm.getPlayersNearInZone(ZoneId.StarterPlains, { x: 10, y: 10 }, 5);
      expect(nearby).toHaveLength(0);
    });

    it('should find mobs near a position excluding dead mobs', () => {
      const mob1 = new Mob(MobType.Goblin, { x: 10, y: 10 }, 30, ZoneId.StarterPlains);
      const mob2 = new Mob(MobType.Wolf, { x: 11, y: 11 }, 30, ZoneId.StarterPlains);
      mob2.die();

      zm.getZone(ZoneId.StarterPlains)!.mobs.set(mob1.id, mob1);
      zm.getZone(ZoneId.StarterPlains)!.mobs.set(mob2.id, mob2);

      const nearby = zm.getMobsNearInZone(ZoneId.StarterPlains, { x: 10, y: 10 }, 5);
      expect(nearby).toHaveLength(1);
      expect(nearby[0].id).toBe(mob1.id);
    });
  });

  describe('Portal Lookup', () => {
    it('should return portals for each zone from ZONE_PORTALS', () => {
      const portals = zm.getPortalsForZone(ZoneId.StarterPlains);
      expect(portals).toHaveLength(1);
      expect(portals[0].targetZone).toBe(ZoneId.DarkForest);
    });

    it('should find nearest portal within maxDistance', () => {
      const portalPos = ZONE_PORTALS[ZoneId.StarterPlains][0].position;
      const portal = zm.findNearestPortal(ZoneId.StarterPlains, portalPos, PORTAL_USE_RANGE);
      expect(portal).not.toBeNull();
      expect(portal!.targetZone).toBe(ZoneId.DarkForest);
    });

    it('should return null when no portal is within range', () => {
      const portal = zm.findNearestPortal(ZoneId.StarterPlains, { x: 0, y: 0 }, PORTAL_USE_RANGE);
      expect(portal).toBeNull();
    });
  });

  describe('Loot Management', () => {
    it('should add and retrieve loot in a specific zone', () => {
      const loot = { id: 'loot-1', position: { x: 5, y: 5 }, items: [], killerId: 'p1', killerOnlyUntil: 0, expiresAt: 0 };
      zm.addLootToZone(ZoneId.StarterPlains, loot);

      const loots = zm.getLootsInZone(ZoneId.StarterPlains);
      expect(loots.size).toBe(1);
      expect(loots.get('loot-1')).toBe(loot);
    });

    it('should find loot across zones via getLoot', () => {
      const loot = { id: 'loot-2', position: { x: 5, y: 5 }, items: [], killerId: 'p1', killerOnlyUntil: 0, expiresAt: 0 };
      zm.addLootToZone(ZoneId.DarkForest, loot);

      const found = zm.getLoot('loot-2');
      expect(found).toBeDefined();
      expect(found!.zoneId).toBe(ZoneId.DarkForest);
    });

    it('should remove loot from zone', () => {
      const loot = { id: 'loot-3', position: { x: 5, y: 5 }, items: [], killerId: 'p1', killerOnlyUntil: 0, expiresAt: 0 };
      zm.addLootToZone(ZoneId.StarterPlains, loot);
      zm.removeLootFromZone(ZoneId.StarterPlains, 'loot-3');

      expect(zm.getLootsInZone(ZoneId.StarterPlains).size).toBe(0);
    });
  });

  describe('Collision Detection', () => {
    it('should return false for in-bounds non-collision tile', () => {
      expect(zm.isCollisionInZone(ZoneId.StarterPlains, 5, 5)).toBe(false);
    });

    it('should return true for out-of-bounds coordinates', () => {
      expect(zm.isCollisionInZone(ZoneId.StarterPlains, -1, -1)).toBe(true);
      expect(zm.isCollisionInZone(ZoneId.StarterPlains, 999, 999)).toBe(true);
    });

    it('should return true for unknown zone', () => {
      expect(zm.isCollisionInZone('invalid' as ZoneId, 5, 5)).toBe(true);
    });
  });
});
