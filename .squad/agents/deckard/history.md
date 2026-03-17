# Deckard — History

## Learnings
- Project started 2026-03-16 by muench-develops
- Phase 1 (core game) and Wave 1 (XP, buffs, crits, minimap, sound) complete
- Auth system with SQLite persistence complete
- Key bug fixed: HUDScene launch order race condition (skills bar not showing)
- Build chain: build:shared first, then server+client parallel via concurrently
- Phaser renders to canvas — must use page.mouse for Playwright, not DOM events
- Client uses Vite with alias @2wowd/shared → ../shared/src
- **Architecture: Multi-Zone System (Issue #3 Analysis)**
  - World class currently single-zone; refactor needed for zone-scoped spatial queries
  - Zone isolation is critical: `getPlayersNear()` and `getMobsNear()` must not leak between zones
  - Portal system will use tile-based detection; recommend TileType.Portal = 4 enum value
  - Mob AI system allows per-mob-type ability logic; new mobs (Spider, Bandit, WolfAlpha, SkeletonMage, BoneLord) fit current CombatSystem pattern
  - Database schema extends with character.current_zone field; zone state itself not persisted (mobs respawn)
  - Client: GameScene caches MapData per zone; tileset switching via zone metadata; VFXManager used for portal animations
  - Message protocol adds ClientMessageType.UsePortal and ServerMessageType.ZoneChanged
  - Three zones (50×50, 60×60, 40×40) require 3 separate map generators; portal positions must be symmetric (both zones reference same exit/entry)
  - Estimated effort: ~40 hours (shared 2–3h, backend 15–18h, frontend 12–15h); critical path is shared types → backend T1–T3 → frontend L1
  - Stun mechanic will require MobAISystem halt during stun duration; test under load
  - Spatial query performance will scale with zone size; may need quadtree or similar for large dungeons (future optimization)
