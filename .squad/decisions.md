# Squad Decisions

## Active Decisions

### 2026-03-16: Architecture — Monorepo with npm workspaces
**By:** muench-develops
**What:** TypeScript monorepo: packages/shared (types+protocol), packages/server (Node+WS), packages/client (Phaser+Vite)
**Why:** Clean separation, shared types, single build command

### 2026-03-16: Auth — SQLite with scrypt
**By:** muench-develops
**What:** better-sqlite3 for persistence, Node crypto.scrypt for password hashing, max 4 characters per account
**Why:** Simple, no external deps, synchronous DB fits game loop

### 2026-03-16: Zones — Zone areas, not instancing
**By:** Coordinator
**What:** Dungeon zones are harder map areas shared with all players, not instanced per party
**Why:** More achievable for current scope

### 2026-03-16: Phase 3 scope
**By:** muench-develops
**What:** Items/inventory, potions, equipment, zones+dungeon, mob collision, NPCs+quests, guide, skill animations, Git repo, MegaLinter, Docker

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction
