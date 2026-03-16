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
