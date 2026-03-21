import BetterSqlite3 from 'better-sqlite3';
import { InventoryItem, generateId, EquipmentSlot, createDefaultEquipmentMap, QuestId, QuestState, QuestObjective } from '@isoheim/shared';
import type { PlayerQuestEntry } from '../systems/QuestManager.js';

export interface CharacterRow {
  id: string;
  account_id: string;
  name: string;
  class_type: string;
  level: number;
  xp: number;
  pos_x: number;
  pos_y: number;
  health: number;
  mana: number;
  current_zone: string;
  tutorial_complete: number;
  gold: number;
  created_at: number;
  last_played: number;
}

export interface AccountRow {
  id: string;
  username: string;
  password_hash: string;
  salt: string;
  created_at: number;
}

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath: string = './game.db') {
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES accounts(id),
        name TEXT UNIQUE NOT NULL,
        class_type TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        pos_x REAL NOT NULL DEFAULT 25,
        pos_y REAL NOT NULL DEFAULT 25,
        health REAL NOT NULL DEFAULT -1,
        mana REAL NOT NULL DEFAULT -1,
        current_zone TEXT NOT NULL DEFAULT 'starter-plains',
        created_at INTEGER NOT NULL,
        last_played INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS inventory (
        character_id TEXT NOT NULL,
        slot INTEGER NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (character_id, slot)
      );

      CREATE TABLE IF NOT EXISTS equipment (
        character_id TEXT NOT NULL,
        slot TEXT NOT NULL,
        item_id TEXT NOT NULL,
        PRIMARY KEY (character_id, slot)
      );
    `);

    // Migration: Add current_zone column to existing characters
    const columns = this.db.pragma('table_info(characters)') as Array<{ name: string }>;
    const hasCurrentZone = columns.some(col => col.name === 'current_zone');
    
    if (!hasCurrentZone) {
      this.db.exec(`
        ALTER TABLE characters ADD COLUMN current_zone TEXT NOT NULL DEFAULT 'starter-plains';
      `);
      console.log('[DB] Migration: Added current_zone column to characters table');
    }

    // Migration: Add tutorial_complete column to existing characters
    const hasTutorialComplete = columns.some(col => col.name === 'tutorial_complete');
    
    if (!hasTutorialComplete) {
      this.db.exec(`
        ALTER TABLE characters ADD COLUMN tutorial_complete INTEGER NOT NULL DEFAULT 0;
      `);
      console.log('[DB] Migration: Added tutorial_complete column to characters table');
    }

    // Migration: Create quest_progress table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS quest_progress (
        character_id TEXT NOT NULL,
        quest_id TEXT NOT NULL,
        state TEXT NOT NULL,
        objectives_json TEXT NOT NULL,
        PRIMARY KEY (character_id, quest_id)
      );
    `);

    // Migration: Add gold column to existing characters
    const hasGold = columns.some(col => col.name === 'gold');
    if (!hasGold) {
      this.db.exec(`
        ALTER TABLE characters ADD COLUMN gold INTEGER NOT NULL DEFAULT 0;
      `);
      console.log('[DB] Migration: Added gold column to characters table');
    }
  }

  // ── Account methods ──────────────────────────────────────

  createAccount(username: string, passwordHash: string, salt: string): string {
    const id = generateId();
    const now = Date.now();
    this.db.prepare(
      'INSERT INTO accounts (id, username, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, username, passwordHash, salt, now);
    return id;
  }

  getAccountByUsername(username: string): AccountRow | null {
    return (
      (this.db
        .prepare('SELECT * FROM accounts WHERE username = ?')
        .get(username) as AccountRow | undefined) ?? null
    );
  }

  // ── Character methods ────────────────────────────────────

  createCharacter(accountId: string, name: string, classType: string): string {
    const id = generateId();
    const now = Date.now();
    this.db.prepare(
      `INSERT INTO characters
        (id, account_id, name, class_type, level, xp, pos_x, pos_y, health, mana, current_zone, created_at, last_played)
       VALUES (?, ?, ?, ?, 1, 0, 25, 25, -1, -1, 'starter-plains', ?, ?)`,
    ).run(id, accountId, name, classType, now, now);
    return id;
  }

  getCharactersByAccount(accountId: string): CharacterRow[] {
    return this.db
      .prepare('SELECT * FROM characters WHERE account_id = ? ORDER BY created_at ASC')
      .all(accountId) as CharacterRow[];
  }

  getCharacter(charId: string): CharacterRow | null {
    return (
      (this.db
        .prepare('SELECT * FROM characters WHERE id = ?')
        .get(charId) as CharacterRow | undefined) ?? null
    );
  }

  saveCharacter(data: {
    id: string;
    level: number;
    xp: number;
    posX: number;
    posY: number;
    health: number;
    mana: number;
    currentZone: string;
    gold: number;
  }): void {
    this.db.prepare(
      `UPDATE characters
       SET level = ?, xp = ?, pos_x = ?, pos_y = ?, health = ?, mana = ?, current_zone = ?, gold = ?, last_played = ?
       WHERE id = ?`,
    ).run(data.level, data.xp, data.posX, data.posY, data.health, data.mana, data.currentZone, data.gold, Date.now(), data.id);
  }

  deleteCharacter(charId: string, accountId: string): boolean {
    const result = this.db
      .prepare('DELETE FROM characters WHERE id = ? AND account_id = ?')
      .run(charId, accountId);
    return result.changes > 0;
  }

  countCharacters(accountId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM characters WHERE account_id = ?')
      .get(accountId) as { cnt: number };
    return row.cnt;
  }

  markTutorialComplete(characterId: string): void {
    this.db.prepare('UPDATE characters SET tutorial_complete = 1 WHERE id = ?').run(characterId);
  }

  isTutorialComplete(characterId: string): boolean {
    const row = this.db
      .prepare('SELECT tutorial_complete FROM characters WHERE id = ?')
      .get(characterId) as { tutorial_complete: number } | undefined;
    return row ? row.tutorial_complete === 1 : false;
  }

  // ── Inventory methods ─────────────────────────────────────

  saveInventory(characterId: string, inventory: InventoryItem[]): void {
    const deleteAll = this.db.prepare('DELETE FROM inventory WHERE character_id = ?');
    const insert = this.db.prepare(
      'INSERT INTO inventory (character_id, slot, item_id, quantity) VALUES (?, ?, ?, ?)',
    );
    const saveAll = this.db.transaction(() => {
      deleteAll.run(characterId);
      for (const item of inventory) {
        insert.run(characterId, item.slot, item.itemId, item.quantity);
      }
    });
    saveAll();
  }

  loadInventory(characterId: string): InventoryItem[] {
    const rows = this.db
      .prepare('SELECT item_id, quantity, slot FROM inventory WHERE character_id = ? ORDER BY slot')
      .all(characterId) as { item_id: string; quantity: number; slot: number }[];
    return rows.map(r => ({ itemId: r.item_id, quantity: r.quantity, slot: r.slot }));
  }

  // ── Equipment methods ─────────────────────────────────────

  saveEquipment(characterId: string, equipment: Map<EquipmentSlot, string | null>): void {
    const deleteAll = this.db.prepare('DELETE FROM equipment WHERE character_id = ?');
    const insert = this.db.prepare(
      'INSERT INTO equipment (character_id, slot, item_id) VALUES (?, ?, ?)',
    );
    const saveAll = this.db.transaction(() => {
      deleteAll.run(characterId);
      for (const [slot, itemId] of equipment) {
        if (itemId) {
          insert.run(characterId, slot, itemId);
        }
      }
    });
    saveAll();
  }

  loadEquipment(characterId: string): Map<EquipmentSlot, string | null> {
    const rows = this.db
      .prepare('SELECT slot, item_id FROM equipment WHERE character_id = ?')
      .all(characterId) as { slot: string; item_id: string }[];
    
    const equipment = createDefaultEquipmentMap();

    for (const row of rows) {
      equipment.set(row.slot as EquipmentSlot, row.item_id);
    }

    return equipment;
  }

  // ── Quest Progress methods ──────────────────────────────────

  saveQuestProgress(characterId: string, quests: Map<QuestId, PlayerQuestEntry>): void {
    const deleteAll = this.db.prepare('DELETE FROM quest_progress WHERE character_id = ?');
    const insert = this.db.prepare(
      'INSERT INTO quest_progress (character_id, quest_id, state, objectives_json) VALUES (?, ?, ?, ?)',
    );
    const saveAll = this.db.transaction(() => {
      deleteAll.run(characterId);
      for (const [questId, entry] of quests) {
        insert.run(characterId, questId, entry.state, JSON.stringify(entry.objectives));
      }
    });
    saveAll();
  }

  loadQuestProgress(characterId: string): Map<QuestId, PlayerQuestEntry> {
    const rows = this.db
      .prepare('SELECT quest_id, state, objectives_json FROM quest_progress WHERE character_id = ?')
      .all(characterId) as { quest_id: string; state: string; objectives_json: string }[];

    const quests = new Map<QuestId, PlayerQuestEntry>();
    for (const row of rows) {
      quests.set(row.quest_id as QuestId, {
        state: row.state as QuestState,
        objectives: JSON.parse(row.objectives_json) as QuestObjective[],
      });
    }
    return quests;
  }

  close(): void {
    this.db.close();
  }
}
