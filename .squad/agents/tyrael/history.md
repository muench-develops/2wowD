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
