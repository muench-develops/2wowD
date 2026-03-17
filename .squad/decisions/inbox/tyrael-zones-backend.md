# Backend Decisions: Multi-Zone System Implementation

**Date:** 2026-03-17  
**Agent:** Tyrael (Backend Dev)  
**Feature:** Issue #3 — Zones, Portals & Dungeon (Phase 2 Backend)  
**Branch:** squad/3-zones-portals-dungeon

## Implementation Summary

Completed all 8 backend tasks (T1-T8) for the multi-zone system. Phase 1 shared types were already implemented and committed by Lyndon during test setup.

## Architectural Decisions

### 1. ZoneManager as Central Registry
**Decision:** Create ZoneManager as single source of truth for all zone data  
**Rationale:**
- Centralized zone registration and lookup
- Zone-scoped spatial queries prevent cross-zone entity leaks
- Portal lookup and validation in one place
- Enables future zone-level features (weather, events, PvP rules)

**Files:** `packages/server/src/systems/ZoneManager.ts`

### 2. World as Backward-Compatible Wrapper
**Decision:** Refactor World to wrap ZoneManager, preserve legacy API  
**Rationale:**
- Existing systems (Combat, Movement, AI) expect World.players/mobs maps
- Legacy getters aggregate across all zones for compatibility
- New zone-aware methods (changePlayerZone) added alongside
- Minimal disruption to existing codebase
- Clear migration path: systems can opt-in to zone-awareness gradually

**Trade-offs:**
- Small performance cost from aggregating maps in getters
- Two ways to access entities (legacy vs zone-aware)
- Accepted for smoother migration

**Files:** `packages/server/src/core/World.ts`

### 3. Portal Interaction: Proximity + Validation
**Decision:** 2.0 tile proximity range, validate target zone matches portal  
**Rationale:**
- 2.0 tiles = comfortable interaction distance (tested value)
- Double validation (proximity + target zone) prevents exploits
- Client can request any zone, server enforces portal rules
- Prevents teleportation hacks

**Files:** `packages/server/src/network/MessageHandler.ts::handleUsePortal()`

### 4. Database Migration Strategy
**Decision:** Auto-add current_zone column with default 'starter-plains'  
**Rationale:**
- Graceful upgrade path for existing characters
- No manual migration scripts required
- SQLite ALTER TABLE safe for small datasets
- Default zone ensures all characters spawn in safe area

**Files:** `packages/server/src/database/Database.ts::migrate()`

### 5. Zone Broadcasts: Targeted, Not Global
**Decision:** PlayerJoined/PlayerLeft only sent to players in same zone  
**Rationale:**
- Players in different zones shouldn't see each other
- Reduces network traffic (no irrelevant messages)
- Enables zone-specific chat/events in future
- Critical for spatial isolation

**Files:** `packages/server/src/network/MessageHandler.ts::handleSelectCharacter(), handleUsePortal()`

### 6. Mob Abilities: Cooldown-Based, AI-Integrated
**Decision:** Abilities checked before auto-attacks in Attack state  
**Rationale:**
- More interesting combat (abilities prioritized)
- Per-mob cooldown tracking (Map<abilityId, remainingMs>)
- Bone Lord rotation: cycle through abilities (last index tracked)
- DoT/CC applied via BuffSystem (reuses existing infrastructure)
- Abilities feel responsive (no extra AI state needed)

**Files:** `packages/server/src/systems/MobAISystem.ts::tryUseAbility(), useBoneLordAbility()`

### 7. Map Generation: Procedural Layouts, Static Spawns
**Decision:** Hand-crafted zone layouts with defined spawn points  
**Rationale:**
- Full control over zone difficulty curves
- Portal positions must be symmetric (hand-placement ensures this)
- Boss spawn (Bone Lord) at center of dungeon
- Tile types define zone theme (grass/dirt/stone/water)
- Future: could add procedural variation within zones

**Files:**
- `packages/server/src/maps/StarterPlainsMap.ts`
- `packages/server/src/maps/DarkForestMap.ts`
- `packages/server/src/maps/AncientDungeonMap.ts`

### 8. Spawn System: Zone-Aware, Boss Respawn Timer
**Decision:** spawnInitialMobsForZone() + 600s Bone Lord respawn  
**Rationale:**
- Each zone spawns independently
- Bone Lord: single spawn, 10-minute respawn = world boss cadence
- Regular mobs: shorter timers (15-40s) for consistent action
- Spawn points tied to zone map data (no global spawn logic)

**Files:** `packages/server/src/systems/SpawnSystem.ts`

## Technical Highlights

### Zone Isolation Enforcement
- Every spatial query method accepts optional `zoneId` parameter
- Players/mobs stored in zone-specific maps (not global)
- World legacy API aggregates for compatibility, but new code uses zone-aware methods
- MessageHandler ensures broadcasts respect zone boundaries

### Database Schema Evolution
```sql
ALTER TABLE characters ADD COLUMN current_zone TEXT DEFAULT 'starter-plains';
```
- Idempotent migration (checks column existence)
- All existing characters default to starter zone
- Load/save cycle preserves zone across sessions

### Mob Ability System
- Abilities defined in shared constants (MOB_ABILITIES, MOB_ABILITY_MAP)
- BuffSystem applies debuffs (poison, stun, fear)
- Damage events broadcast with abilityId for client VFX
- Bone Lord rotates abilities to avoid spam

## Integration Notes

### For Frontend (Leah):
- ZoneChanged message includes full mapData + playerPosition
- Client must rebuild world on zone transition
- PlayerJoined/PlayerLeft messages now zone-scoped
- Portal tiles should be visually distinct (Phase 3)

### For Testing:
- Lyndon already created test suites (ZoneManager, Portal, Isolation)
- Integration tests should verify:
  - Players in different zones can't see each other
  - Portals work bidirectionally
  - Zone state persists across reconnect
  - Abilities trigger on correct mobs

### For PR Review (Kormac):
- No magic numbers: portal range (2.0), Bone Lord respawn (600s) extracted as constants
- Zone-aware methods clearly named (getPlayersInZone vs getPlayersNear)
- Legacy API preserved to avoid breaking existing systems
- Database migration safe and idempotent

## Performance Considerations

- Map aggregation in World getters: O(zones * entities) — acceptable for <100 players
- Zone lookups: O(1) via Map<ZoneId, Zone>
- Spatial queries now zone-scoped: much faster (fewer entities to check)
- Future optimization: cache aggregated maps if needed

## Future Improvements

- Zone instancing (dungeons per party)
- Zone-specific chat channels
- Zone events (invasions, weather)
- Dynamic portal opening/closing
- Zone-level PvP flags

## Dependencies

**Requires (already committed by Lyndon):**
- Phase 1 shared types (ZoneId, Portal, ZoneMetadata)
- Mob definitions (Spider, Bandit, WolfAlpha, SkeletonMage, BoneLord)
- Buff definitions (poison, stun, fear)
- Protocol messages (UsePortal, ZoneChanged)

**Enables (Phase 3 - Leah):**
- Frontend zone rendering
- Portal visual indicators
- Zone transition UI/UX
- New mob sprites

---

**Commit:** `f4ff4b2` — feat(server): implement Phase 2 multi-zone backend for Issue #3  
**Pushed to:** squad/3-zones-portals-dungeon
