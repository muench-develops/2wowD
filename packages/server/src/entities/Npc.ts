import {
  NpcId,
  NpcDef,
  QuestId,
  QuestDef,
  QuestState,
  ZoneId,
  Vec2,
  Direction,
  Position,
  NPC_DEFINITIONS,
  QUEST_DEFINITIONS,
} from '@isoheim/shared';
import type { Player } from './Player.js';

export class Npc {
  readonly id: NpcId;
  readonly def: NpcDef;
  readonly position: Position;
  readonly zone: ZoneId;

  constructor(npcId: NpcId) {
    this.id = npcId;
    this.def = NPC_DEFINITIONS[npcId];
    this.zone = this.def.zone;
    this.position = {
      x: this.def.position.x,
      y: this.def.position.y,
      direction: Direction.S,
    };
  }

  getAvailableQuests(
    player: Player,
    playerQuestStates: Map<QuestId, { state: QuestState }>,
  ): QuestDef[] {
    return this.def.questIds
      .map((questId) => QUEST_DEFINITIONS[questId])
      .filter((quest) => {
        // Must meet level requirement
        if (player.level < quest.requiredLevel) return false;

        // Must not already be active, complete, or turned in
        const currentState = playerQuestStates.get(quest.id);
        if (currentState && currentState.state !== QuestState.Available) return false;

        // Must have completed prerequisite
        if (quest.prerequisiteQuest) {
          const prereqState = playerQuestStates.get(quest.prerequisiteQuest);
          if (!prereqState || prereqState.state !== QuestState.TurnedIn) return false;
        }

        return true;
      });
  }
}
