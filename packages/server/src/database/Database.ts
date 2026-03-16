import BetterSqlite3 from 'better-sqlite3';
import { generateId } from '@isoheim/shared';

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
        created_at INTEGER NOT NULL,
        last_played INTEGER NOT NULL
      );
    `);
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
        (id, account_id, name, class_type, level, xp, pos_x, pos_y, health, mana, created_at, last_played)
       VALUES (?, ?, ?, ?, 1, 0, 25, 25, -1, -1, ?, ?)`,
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
  }): void {
    this.db.prepare(
      `UPDATE characters
       SET level = ?, xp = ?, pos_x = ?, pos_y = ?, health = ?, mana = ?, last_played = ?
       WHERE id = ?`,
    ).run(data.level, data.xp, data.posX, data.posY, data.health, data.mana, Date.now(), data.id);
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

  close(): void {
    this.db.close();
  }
}
