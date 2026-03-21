---
name: "server-system-wiring"
description: "Pattern for adding new game systems to the Isoheim server"
domain: "server"
confidence: "high"
source: "implementation"
---

## Context

When adding a new game system (like QuestManager, LootSystem, etc.) to the Isoheim server, follow this established wiring pattern.

## Patterns

### System Class Structure
- Create in `packages/server/src/systems/{SystemName}.ts`
- Constructor takes `NetworkManager` for sending messages to clients
- Use setter injection for cross-system dependencies (avoids circular deps)

```typescript
export class QuestManager {
  private network: NetworkManager;
  constructor(network: NetworkManager) { this.network = network; }
}
```

### Wiring Into CombatSystem (or other systems)
Use the `setXxx()` pattern established by LootSystem:
```typescript
// In CombatSystem:
private questManager: QuestManager | null = null;
setQuestManager(questManager: QuestManager): void { this.questManager = questManager; }

// In main.ts:
combatSystem.setQuestManager(questManager);
```

### MessageHandler Integration
1. Add the system to MessageHandler constructor params
2. Add case statements to handleMessage() switch
3. Create extracted private handler methods (not inline — Kormac requirement)
4. Add to saveAndRemovePlayer() and saveAllPlayers() for persistence

### Database Persistence
1. Add migration in Database.migrate() — use `CREATE TABLE IF NOT EXISTS` or `ALTER TABLE ADD COLUMN` with existence check
2. Add save/load methods using prepared statements and transactions
3. Wire save into saveAndRemovePlayer AND saveAllPlayers
4. Wire load into handleSelectCharacter

### Shared Types Order
Add in this order: types.ts → constants.ts → protocol.ts → index.ts

### Integration Checklist (from Kormac review)
- [ ] Every new ClientMessageType has a `case` in handleMessage()
- [ ] Every new entity state is in both saveAndRemovePlayer() AND handleSelectCharacter()
- [ ] New protocol messages are exported from shared/index.ts

## Anti-Patterns
- **Don't add logic to GameLoop unless it needs per-tick processing** — NPCs are stationary, no tick needed
- **Don't use magic numbers** — define named constants (NPC_INTERACTION_RANGE, not 3.0)
- **Don't inline handler logic** — extract to private methods on MessageHandler
