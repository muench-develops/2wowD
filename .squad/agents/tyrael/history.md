# Tyrael — History

## Learnings
- Project: 2wowD, 2D isometric MMO by muench-develops
- Server at packages/server/, entry point main.ts
- GameLoop orchestrates: Movement → Buff → Combat → MobAI → Spawn → broadcast
- World class holds Map<id, Player> and Map<id, Mob> with spatial queries
- MessageHandler routes all client messages, auth-gated (must login → select char → play)
- Database: accounts + characters tables, WAL mode, auto-save every 60s
- Player.fromCharacterInfo() factory loads persisted character state
- 3 mob types currently: Goblin (L1), Skeleton (L2), Wolf (L1)
- Abilities: 4 per class (12 total), mapped to buffs via ABILITY_BUFF_MAP

## Phase 1 Zone Types Implementation (2026-03-16)
- **Branch:** squad/3-zones-portals-dungeon
- **Implemented:** S1-S4 from Deckard's zones decomposition plan
- **Pattern learned:** Shared types must be added in correct order: types.ts → constants.ts → protocol.ts → index.ts
- **Zone architecture:** Zones are shared areas (not instanced), two-way portals with symmetric connections
- **New MobTypes:** Spider (poison DoT), Bandit (stun), WolfAlpha (AoE fear), SkeletonMage (ranged), BoneLord (3 abilities, boss)
- **Zone progression:** StarterPlains (L1-5) → DarkForest (L5-10) → AncientDungeon (L10-15)
- **Buff system extended:** poison (DoT 5s), stun (immobilize 2s), fear (speed debuff 3s)
- **Portal mechanics:** Position-based, targetZone + targetSpawnPoint for teleportation
- **Type safety:** All zone types use ZoneId enum, portal connections validated through constants

## Phase 2 Multi-Zone Backend Implementation (2026-03-17)
- **Branch:** squad/3-zones-portals-dungeon
- **Implemented:** T1-T8 (all backend tasks) from Deckard's zones decomposition
- **Critical learning:** Phase 1 types + test infrastructure already committed by Lyndon (test setup agent)
- **ZoneManager pattern:** Central registry for zones, zone-scoped spatial queries prevent cross-zone leaks
- **World refactor:** Backward-compatible wrapper around ZoneManager, legacy API preserved via getters
- **Zone isolation:** Each zone maintains separate player/mob maps, spatial queries respect zone boundaries
- **Database migration:** Added current_zone column with auto-migration for existing characters
- **Portal system:** 2.0 tile proximity validation, zone transition with PlayerLeft/PlayerJoined broadcasts
- **Mob abilities:** Cooldown tracking per mob, rotating abilities for Bone Lord (3-ability cycle)
- **AI integration:** Abilities integrated into Attack state, preferred over auto-attacks when available
- **Map generators:** 3 distinct zones with unique layouts, mob distributions, portal placements
- **Spawn system:** Zone-aware mob spawning, Bone Lord single-spawn with 600s respawn timer
- **Testing notes:** Lyndon already created comprehensive test suite (ZoneManager, Portal, Isolation, Persistence)

## ESLint Cleanup (2026-03-17)
- Fixed 3 errors (empty catch blocks in ZonePersistence.test.ts) and 46 warnings across 14 files
- Removals: unused imports (AGGRO_RANGE, LEASH_RANGE, BuffState, distance, Vec2, MobType, etc.)
- Prefixed unused function params with underscore (_world, _now)
- Replaced `as any` cast with `as CharacterInfo` in ZonePersistence.test.ts
- Dropped unused `accountId` assignments in tests (called createTestAccount() without capturing return)
- Removed dead `createMapData` helper and its now-unused imports (TileType, MapData) in MobAbilities.test.ts
- Also caught 3 pre-existing warnings in GameLoop.ts, BuffSystem.ts, MobAISystem.ts not in original list

## Potions & Consumables Implementation (2026-03-21)
- **Branch:** squad/5-potions-consumables
- **Implemented:** Full potions & consumables system (#5)
- **Shared types:** Added PotionCooldownState interface for tracking shared/per-item cooldowns
- **Protocol messages:** ConsumableUsed (confirmation), PotionCooldownUpdate (client UI sync)
- **Constants:** POTION_SHARED_COOLDOWN_MS (15s), BANDAGE_COOLDOWN_MS (30s), TP_SCROLL_COOLDOWN_MS (60s)
- **Server consumable logic:** Instant heal (30% max HP), mana restore (40% max MP), teleport to spawn, bandage HoT
- **Bandage mechanics:** 50% max HP over 8s (HoT), interrupted on damage via Player.takeDamage()
- **Cooldown tracking:** Player fields potionSharedCooldownUntil, itemCooldowns Map, canUseConsumable() validation
- **GameLoop integration:** processBandageHoT() ticks healing, respects duration and damage interrupts
- **Client VFX:** Green particles (heal), blue spiral (mana), purple swirl (teleport), cross+particles (bandage)
- **Event flow:** GameScene registers handlers for ConsumableUsed/PotionCooldownUpdate, emits to HUD for cooldown UI
- **Item updates:** Minor HP Potion = 30%, Minor MP Potion = 40%, Bandage = buff type (not heal), added scroll_of_town_portal
- **Pattern learned:** Consumables require both instant effect + client VFX + cooldown state synchronization

## Equipment Backend Implementation (2026-03-21)
- **Parallel work integration:** Leah simultaneously implemented equipment UI on same branch; coordinated by having Tyrael complete both backends first, then Leah build client on top
- **Collaborated with Leah:** Equipment bonus calculations, stat mapping (ITEM_STAT_TO_CLASS_STAT), ring auto-resolution logic
- **Leah's client deliverables:** Paper-doll CharacterPanel (7 slots, 3x4 grid), right-click equip/unequip, stat comparison tooltips, equipment bonus display in stats
- **Key integration:** Message exports (EquipItemMessage, UnequipItemMessage, EquipmentUpdateMessage) needed to be added to shared/index.ts by Leah for client consistency

