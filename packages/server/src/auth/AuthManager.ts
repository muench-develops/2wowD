import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';
import { Database, type CharacterRow } from '../database/Database.js';
import {
  CharacterSummary,
  CharacterInfo,
  ClassType,
  MAX_CHARACTERS_PER_ACCOUNT,
  MIN_USERNAME_LENGTH,
  MAX_USERNAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  MIN_CHARACTER_NAME_LENGTH,
  MAX_CHARACTER_NAME_LENGTH,
} from '@isoheim/shared';

interface SessionData {
  accountId: string;
  characterId: string | null;
}

export class AuthManager {
  private db: Database;
  /** Map<sessionId, SessionData> */
  private sessions = new Map<string, SessionData>();
  /** Map<accountId, sessionId> — prevent duplicate logins */
  private activeAccounts = new Map<string, string>();

  constructor(db: Database) {
    this.db = db;
  }

  // ── Public API ───────────────────────────────────────────

  register(
    username: string,
    password: string,
  ): { success: boolean; error?: string } {
    const usernameErr = this.validateUsername(username);
    if (usernameErr) return { success: false, error: usernameErr };

    const passwordErr = this.validatePassword(password);
    if (passwordErr) return { success: false, error: passwordErr };

    const existing = this.db.getAccountByUsername(username.toLowerCase());
    if (existing) return { success: false, error: 'Username already taken' };

    const salt = randomBytes(16).toString('hex');
    const hash = this.hashPassword(password, salt);
    this.db.createAccount(username.toLowerCase(), hash, salt);

    return { success: true };
  }

  login(
    sessionId: string,
    username: string,
    password: string,
  ): {
    success: boolean;
    accountId?: string;
    characters?: CharacterSummary[];
    error?: string;
  } {
    const account = this.db.getAccountByUsername(username.toLowerCase());
    if (!account) return { success: false, error: 'Invalid username or password' };

    if (!this.verifyPassword(password, account.password_hash, account.salt)) {
      return { success: false, error: 'Invalid username or password' };
    }

    // Kick previous session if account is already logged in
    const existingSession = this.activeAccounts.get(account.id);
    if (existingSession) {
      this.sessions.delete(existingSession);
    }

    this.sessions.set(sessionId, { accountId: account.id, characterId: null });
    this.activeAccounts.set(account.id, sessionId);

    const characters = this.getCharacterSummaries(account.id);

    return {
      success: true,
      accountId: account.id,
      characters,
    };
  }

  logout(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.activeAccounts.delete(session.accountId);
      this.sessions.delete(sessionId);
    }
  }

  createCharacter(
    sessionId: string,
    name: string,
    classType: ClassType,
  ): { success: boolean; character?: CharacterSummary; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: 'Not authenticated' };

    const nameErr = this.validateCharacterName(name);
    if (nameErr) return { success: false, error: nameErr };

    if (!Object.values(ClassType).includes(classType)) {
      return { success: false, error: 'Invalid class type' };
    }

    const count = this.db.countCharacters(session.accountId);
    if (count >= MAX_CHARACTERS_PER_ACCOUNT) {
      return { success: false, error: `Maximum ${MAX_CHARACTERS_PER_ACCOUNT} characters allowed` };
    }

    try {
      const charId = this.db.createCharacter(session.accountId, name, classType);
      const character: CharacterSummary = {
        id: charId,
        name,
        classType,
        level: 1,
      };
      return { success: true, character };
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'Character name already taken' };
      }
      throw err;
    }
  }

  deleteCharacter(
    sessionId: string,
    characterId: string,
  ): { success: boolean; error?: string } {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: 'Not authenticated' };

    // Can't delete a character that is currently in-game
    if (session.characterId === characterId) {
      return { success: false, error: 'Cannot delete a character that is currently in-game' };
    }

    const deleted = this.db.deleteCharacter(characterId, session.accountId);
    if (!deleted) return { success: false, error: 'Character not found' };

    return { success: true };
  }

  selectCharacter(sessionId: string, characterId: string): CharacterInfo | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const row = this.db.getCharacter(characterId);
    if (!row || row.account_id !== session.accountId) return null;

    session.characterId = characterId;

    return this.rowToCharacterInfo(row);
  }

  getSession(sessionId: string): SessionData | null {
    return this.sessions.get(sessionId) ?? null;
  }

  isAuthenticated(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  hasSelectedCharacter(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.characterId != null;
  }

  // ── Helpers ──────────────────────────────────────────────

  private getCharacterSummaries(accountId: string): CharacterSummary[] {
    const rows = this.db.getCharactersByAccount(accountId);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      classType: r.class_type as ClassType,
      level: r.level,
    }));
  }

  private rowToCharacterInfo(row: CharacterRow): CharacterInfo {
    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      classType: row.class_type as ClassType,
      level: row.level,
      xp: row.xp,
      posX: row.pos_x,
      posY: row.pos_y,
      health: row.health,
      mana: row.mana,
      createdAt: row.created_at,
      lastPlayed: row.last_played,
    };
  }

  // ── Validation ───────────────────────────────────────────

  private validateUsername(username: string): string | null {
    if (
      username.length < MIN_USERNAME_LENGTH ||
      username.length > MAX_USERNAME_LENGTH
    ) {
      return `Username must be between ${MIN_USERNAME_LENGTH} and ${MAX_USERNAME_LENGTH} characters`;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return 'Username may only contain letters, numbers, and underscores';
    }
    return null;
  }

  private validatePassword(password: string): string | null {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    return null;
  }

  private validateCharacterName(name: string): string | null {
    if (
      name.length < MIN_CHARACTER_NAME_LENGTH ||
      name.length > MAX_CHARACTER_NAME_LENGTH
    ) {
      return `Character name must be between ${MIN_CHARACTER_NAME_LENGTH} and ${MAX_CHARACTER_NAME_LENGTH} characters`;
    }
    if (!/^[a-zA-Z0-9 ]+$/.test(name)) {
      return 'Character name may only contain letters, numbers, and spaces';
    }
    return null;
  }

  // ── Password hashing ────────────────────────────────────

  private hashPassword(password: string, salt: string): string {
    return scryptSync(password, salt, 64).toString('hex');
  }

  private verifyPassword(
    password: string,
    hash: string,
    salt: string,
  ): boolean {
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, 'hex');
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  }
}
