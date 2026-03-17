import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ZoneId, ClassType, CharacterInfo, ZONE_PLAYER_SPAWNS } from '@isoheim/shared';
import { Player } from '../../entities/Player.js';
import { AuthManager } from '../../auth/AuthManager.js';
import { Database } from '../../database/Database.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('ZonePersistence', () => {
  let db: Database;
  let auth: AuthManager;
  let dbPath: string;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    db = new Database(dbPath);
    auth = new AuthManager(db);
  });

  afterEach(() => {
    db.close();
    try { fs.unlinkSync(dbPath); } catch { /* no-op */ }
    try { fs.unlinkSync(dbPath + '-wal'); } catch { /* no-op */ }
    try { fs.unlinkSync(dbPath + '-shm'); } catch { /* no-op */ }
  });

  function createTestAccount(username = 'testuser'): string {
    auth.register(username, 'password1234');
    const result = auth.login('session-1', username, 'password1234');
    return result.accountId!;
  }

  describe('Zone Saving to Database', () => {
    it('should save player currentZone via toCharacterSaveData', () => {
      const player = new Player('sess-1', 'Alice', ClassType.Warrior);
      player.characterId = 'char-1';
      player.currentZone = ZoneId.DarkForest;

      const saveData = player.toCharacterSaveData();
      expect(saveData.currentZone).toBe(ZoneId.DarkForest);
    });

    it('should persist zone change via db.saveCharacter', () => {
      createTestAccount();
      const result = auth.createCharacter('session-1', 'TestWarrior', ClassType.Warrior);
      const charId = result.character!.id;

      // Create player object and change zone
      const charInfo = auth.selectCharacter('session-1', charId)!;
      const player = Player.fromCharacterInfo('sess-1', charInfo);
      player.currentZone = ZoneId.DarkForest;
      player.position.x = 5;
      player.position.y = 30;
      db.saveCharacter(player.toCharacterSaveData());

      // Reload and verify
      const row = db.getCharacter(charId);
      expect(row).not.toBeNull();
      expect(row!.current_zone).toBe(ZoneId.DarkForest);
    });

    it('should save position along with zone', () => {
      createTestAccount();
      auth.createCharacter('session-1', 'TestMage', ClassType.Mage);
      const chars = auth.login('session-2', 'testuser', 'password1234').characters!;
      const charId = chars[0].id;

      const charInfo = auth.selectCharacter('session-2', charId)!;
      const player = Player.fromCharacterInfo('sess-1', charInfo);
      player.currentZone = ZoneId.AncientDungeon;
      player.position.x = 20;
      player.position.y = 38;
      db.saveCharacter(player.toCharacterSaveData());

      const row = db.getCharacter(charId);
      expect(row!.pos_x).toBe(20);
      expect(row!.pos_y).toBe(38);
      expect(row!.current_zone).toBe(ZoneId.AncientDungeon);
    });
  });

  describe('Zone Loading from Database', () => {
    it('should load player into correct zone on character select', () => {
      createTestAccount();
      auth.createCharacter('session-1', 'LoadTest', ClassType.Warrior);
      const chars = auth.login('session-load', 'testuser', 'password1234').characters!;
      const charId = chars[0].id;

      // Save with Dark Forest
      const charInfo = auth.selectCharacter('session-load', charId)!;
      const player = Player.fromCharacterInfo('s1', charInfo);
      player.currentZone = ZoneId.DarkForest;
      db.saveCharacter(player.toCharacterSaveData());

      // Reload via selectCharacter
      auth.login('session-load2', 'testuser', 'password1234');
      const reloaded = auth.selectCharacter('session-load2', charId)!;
      expect(reloaded.currentZone).toBe(ZoneId.DarkForest);
    });

    it('should restore zone in Player.fromCharacterInfo', () => {
      createTestAccount();
      auth.createCharacter('session-1', 'FromChar', ClassType.Rogue);
      const chars = auth.login('session-fc', 'testuser', 'password1234').characters!;
      const charId = chars[0].id;

      const charInfo = auth.selectCharacter('session-fc', charId)!;
      const player = Player.fromCharacterInfo('s1', charInfo);
      player.currentZone = ZoneId.AncientDungeon;
      db.saveCharacter(player.toCharacterSaveData());

      // Reload
      auth.login('session-fc2', 'testuser', 'password1234');
      const reloadedInfo = auth.selectCharacter('session-fc2', charId)!;
      const reloadedPlayer = Player.fromCharacterInfo('s2', reloadedInfo);
      expect(reloadedPlayer.currentZone).toBe(ZoneId.AncientDungeon);
    });

    it('should handle multiple characters with different zones', () => {
      createTestAccount();
      auth.createCharacter('session-1', 'Char1', ClassType.Warrior);
      auth.createCharacter('session-1', 'Char2', ClassType.Mage);

      const loginResult = auth.login('session-multi', 'testuser', 'password1234');
      const char1Id = loginResult.characters![0].id;
      const char2Id = loginResult.characters![1].id;

      // Save char1 to DarkForest, char2 to AncientDungeon
      const info1 = auth.selectCharacter('session-multi', char1Id)!;
      const p1 = Player.fromCharacterInfo('s1', info1);
      p1.currentZone = ZoneId.DarkForest;
      db.saveCharacter(p1.toCharacterSaveData());

      auth.login('session-multi2', 'testuser', 'password1234');
      const info2 = auth.selectCharacter('session-multi2', char2Id)!;
      const p2 = Player.fromCharacterInfo('s2', info2);
      p2.currentZone = ZoneId.AncientDungeon;
      db.saveCharacter(p2.toCharacterSaveData());

      // Reload both
      auth.login('session-verify', 'testuser', 'password1234');
      const r1 = auth.selectCharacter('session-verify', char1Id)!;
      const r2 = auth.selectCharacter('session-verify', char2Id)!;
      expect(r1.currentZone).toBe(ZoneId.DarkForest);
      expect(r2.currentZone).toBe(ZoneId.AncientDungeon);
    });
  });

  describe('Default Zone for New Characters', () => {
    it('should spawn new characters in starter-plains', () => {
      createTestAccount();
      auth.createCharacter('session-1', 'NewWarrior', ClassType.Warrior);
      const chars = auth.login('session-new', 'testuser', 'password1234').characters!;

      const info = auth.selectCharacter('session-new', chars[0].id)!;
      expect(info.currentZone).toBe(ZoneId.StarterPlains);
    });

    it('should use default spawn position (25,25) for new characters', () => {
      createTestAccount();
      auth.createCharacter('session-1', 'NewRogue', ClassType.Rogue);
      const chars = auth.login('session-pos', 'testuser', 'password1234').characters!;

      const row = db.getCharacter(chars[0].id);
      expect(row!.pos_x).toBe(25);
      expect(row!.pos_y).toBe(25);
    });

    it('should create all new characters in same default zone', () => {
      createTestAccount();
      auth.createCharacter('session-1', 'C1', ClassType.Warrior);
      auth.createCharacter('session-1', 'C2', ClassType.Mage);
      auth.createCharacter('session-1', 'C3', ClassType.Rogue);

      const chars = auth.login('session-all', 'testuser', 'password1234').characters!;
      for (const c of chars) {
        const info = auth.selectCharacter('session-all', c.id)!;
        expect(info.currentZone).toBe(ZoneId.StarterPlains);
      }
    });
  });

  describe('Invalid Zone Handling', () => {
    it('should default to StarterPlains for invalid zone in DB', () => {
      createTestAccount();
      auth.createCharacter('session-1', 'CorruptChar', ClassType.Priest);
      const chars = auth.login('session-corrupt', 'testuser', 'password1234').characters!;
      const charId = chars[0].id;

      // Manually corrupt zone in DB
      const info = auth.selectCharacter('session-corrupt', charId)!;
      const player = Player.fromCharacterInfo('s1', info);
      player.currentZone = 'invalid-zone' as ZoneId;
      db.saveCharacter(player.toCharacterSaveData());

      // AuthManager.rowToCharacterInfo should fallback to StarterPlains
      auth.login('session-recover', 'testuser', 'password1234');
      const recovered = auth.selectCharacter('session-recover', charId)!;
      expect(recovered.currentZone).toBe(ZoneId.StarterPlains);
    });

    it('should handle null-like zone via fromCharacterInfo', () => {
      // CharacterInfo with undefined zone should default to StarterPlains
      const charInfo = {
        id: 'c1',
        accountId: 'a1',
        name: 'Test',
        classType: ClassType.Warrior,
        level: 1,
        xp: 0,
        posX: 25,
        posY: 25,
        health: 200,
        mana: 50,
        createdAt: Date.now(),
        lastPlayed: Date.now(),
        currentZone: undefined,
      };

      const player = Player.fromCharacterInfo('s1', charInfo as CharacterInfo);
      expect(player.currentZone).toBe(ZoneId.StarterPlains);
    });
  });

  describe('Zone Survives Save/Load Cycle', () => {
    it('should preserve zone data across DB close/reopen', () => {
      createTestAccount();
      auth.createCharacter('session-1', 'PersistChar', ClassType.Warrior);
      const chars = auth.login('session-persist', 'testuser', 'password1234').characters!;
      const charId = chars[0].id;

      // Save to Dark Forest
      const info = auth.selectCharacter('session-persist', charId)!;
      const player = Player.fromCharacterInfo('s1', info);
      player.currentZone = ZoneId.DarkForest;
      player.position.x = 5;
      player.position.y = 30;
      db.saveCharacter(player.toCharacterSaveData());

      // Close and reopen
      db.close();
      db = new Database(dbPath);
      auth = new AuthManager(db);

      // Verify persisted
      auth.register('testuser2', 'password1234');
      // Use direct DB query since we recreated the auth manager
      const row = db.getCharacter(charId);
      expect(row).not.toBeNull();
      expect(row!.current_zone).toBe(ZoneId.DarkForest);
      expect(row!.pos_x).toBe(5);
      expect(row!.pos_y).toBe(30);
    });

    it('should handle rapid zone updates (last write wins)', () => {
      createTestAccount();
      auth.createCharacter('session-1', 'RapidChar', ClassType.Rogue);
      const chars = auth.login('session-rapid', 'testuser', 'password1234').characters!;
      const charId = chars[0].id;

      const info = auth.selectCharacter('session-rapid', charId)!;
      const player = Player.fromCharacterInfo('s1', info);

      // Rapid zone changes
      player.currentZone = ZoneId.StarterPlains;
      db.saveCharacter(player.toCharacterSaveData());
      player.currentZone = ZoneId.DarkForest;
      db.saveCharacter(player.toCharacterSaveData());
      player.currentZone = ZoneId.AncientDungeon;
      db.saveCharacter(player.toCharacterSaveData());

      const row = db.getCharacter(charId);
      expect(row!.current_zone).toBe(ZoneId.AncientDungeon);
    });
  });

  describe('Player Respawn Uses Zone Spawn Point', () => {
    it('should respawn player at current zone spawn point', () => {
      const player = new Player('s1', 'Alice', ClassType.Warrior);
      player.currentZone = ZoneId.DarkForest;
      player.position.x = 30;
      player.position.y = 40;
      player.die();
      player.respawn();

      const spawn = ZONE_PLAYER_SPAWNS[ZoneId.DarkForest];
      expect(player.position.x).toBe(spawn.x);
      expect(player.position.y).toBe(spawn.y);
      expect(player.isDead).toBe(false);
    });

    it('should respawn at correct spawn for each zone', () => {
      for (const zoneId of Object.values(ZoneId)) {
        const player = new Player('s1', 'Test', ClassType.Mage);
        player.currentZone = zoneId;
        player.die();
        player.respawn();

        const expectedSpawn = ZONE_PLAYER_SPAWNS[zoneId];
        expect(player.position.x).toBe(expectedSpawn.x);
        expect(player.position.y).toBe(expectedSpawn.y);
      }
    });
  });
});
