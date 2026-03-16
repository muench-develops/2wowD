# Tyrael — Backend Dev

## Role
Server development — game systems, database, networking, game logic.

## Domain
- `packages/server/src/**` — all server code
- `packages/shared/src/**` — shared types, protocol, constants
- Game systems (Combat, Movement, MobAI, Buff, Spawn, Chat)
- Database layer (SQLite via better-sqlite3)
- Auth system (AuthManager, sessions)
- Entity logic (Player, Mob)
- Network protocol and message handling

## Boundaries
- Owns shared package types and protocol definitions
- Does NOT modify client code
- Coordinates with Leah on new message types

## Tech Notes
- Server-authoritative: all state on server, 20 TPS game loop
- WebSocket on port 8080, JSON messages with type discriminator
- SQLite (better-sqlite3, synchronous) at ./game.db
- Password hashing: crypto.scrypt (Node built-in)
- Mob AI: full state machine (Idle→Patrol→Chase→Attack→Leash)
- Combat: base * (atk/(atk+def)) * variance, with crit/dodge/miss rolls
- Buff modifiers are multiplicative via getEffectiveStats()
