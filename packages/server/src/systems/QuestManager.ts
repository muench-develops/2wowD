import {
  QuestId,
  QuestState,
  QuestObjective,
  QuestObjectiveType,
  QuestDef,
  QuestReward,
  NpcId,
  NPC_DEFINITIONS,
  QUEST_DEFINITIONS,
} from '@isoheim/shared';
import type { Player } from '../entities/Player.js';
import type { NetworkManager } from '../network/NetworkManager.js';
import { ServerMessageType } from '@isoheim/shared';

export interface PlayerQuestEntry {
  state: QuestState;
  objectives: QuestObjective[];
}

export class QuestManager {
  /** playerId → questId → quest state */
  private playerQuests: Map<string, Map<QuestId, PlayerQuestEntry>> = new Map();
  private network: NetworkManager;

  constructor(network: NetworkManager) {
    this.network = network;
  }

  // ── Lifecycle ──────────────────────────────────────────────

  initPlayer(playerId: string, quests?: Map<QuestId, PlayerQuestEntry>): void {
    this.playerQuests.set(playerId, quests ?? new Map());
  }

  removePlayer(playerId: string): void {
    this.playerQuests.delete(playerId);
  }

  getPlayerQuests(playerId: string): Map<QuestId, PlayerQuestEntry> {
    return this.playerQuests.get(playerId) ?? new Map();
  }

  // ── Quest Actions ──────────────────────────────────────────

  acceptQuest(player: Player, questId: QuestId): boolean {
    const questDef = QUEST_DEFINITIONS[questId];
    if (!questDef) return false;

    const quests = this.getPlayerQuests(player.id);

    // Validate: not already active or turned in
    const existing = quests.get(questId);
    if (existing && existing.state !== QuestState.Available) return false;

    // Validate level requirement
    if (player.level < questDef.requiredLevel) return false;

    // Validate prerequisite
    if (questDef.prerequisiteQuest) {
      const prereq = quests.get(questDef.prerequisiteQuest);
      if (!prereq || prereq.state !== QuestState.TurnedIn) return false;
    }

    // Create fresh objectives from the quest definition
    const objectives: QuestObjective[] = questDef.objectives.map((obj) => ({
      type: obj.type,
      target: obj.target,
      required: obj.required,
      current: 0,
    }));

    quests.set(questId, { state: QuestState.Active, objectives });

    this.sendQuestUpdate(player.id, questId, objectives, QuestState.Active);
    return true;
  }

  abandonQuest(player: Player, questId: QuestId): boolean {
    const quests = this.getPlayerQuests(player.id);
    const entry = quests.get(questId);
    if (!entry || entry.state !== QuestState.Active) return false;

    quests.delete(questId);
    this.sendQuestUpdate(player.id, questId, [], QuestState.Available);
    return true;
  }

  turnInQuest(player: Player, questId: QuestId): boolean {
    const quests = this.getPlayerQuests(player.id);
    const entry = quests.get(questId);
    if (!entry || entry.state !== QuestState.Complete) return false;

    const questDef = QUEST_DEFINITIONS[questId];
    if (!questDef) return false;

    // Grant rewards
    const rewards = questDef.rewards;
    if (rewards.xp > 0) {
      const leveled = player.addXp(rewards.xp);
      if (leveled) {
        this.network.broadcastToZone(player.currentZone, {
          type: ServerMessageType.LevelUp,
          playerId: player.id,
          newLevel: player.level,
        });
      }
    }
    if (rewards.gold > 0) {
      player.addGold(rewards.gold);
    }
    if (rewards.items) {
      for (const rewardItem of rewards.items) {
        player.addToInventory(rewardItem.itemId, rewardItem.quantity);
      }
    }

    // Remove collected quest items from inventory
    this.removeQuestItemsOnTurnIn(player, questDef);

    entry.state = QuestState.TurnedIn;

    // Notify client
    this.network.sendToPlayer(player.id, {
      type: ServerMessageType.QuestCompleted,
      questId,
      rewards,
    });
    this.sendQuestUpdate(player.id, questId, entry.objectives, QuestState.TurnedIn);

    // Send inventory update after reward items are added
    this.network.sendToPlayer(player.id, {
      type: ServerMessageType.InventoryUpdate,
      inventory: player.inventory,
    });

    return true;
  }

  // ── Progress Hooks ─────────────────────────────────────────

  onMobKill(player: Player, mobType: string): void {
    this.updateProgress(player, QuestObjectiveType.Defeat, mobType, 1);
  }

  onItemPickup(player: Player, itemId: string): void {
    this.updateProgress(player, QuestObjectiveType.Collect, itemId, 1);
  }

  onZoneEnter(player: Player, zoneId: string): void {
    this.updateProgress(player, QuestObjectiveType.Visit, zoneId, 1);
  }

  private updateProgress(
    player: Player,
    objectiveType: QuestObjectiveType,
    target: string,
    count: number,
  ): void {
    const quests = this.getPlayerQuests(player.id);

    for (const [questId, entry] of quests) {
      if (entry.state !== QuestState.Active) continue;

      let updated = false;

      for (const objective of entry.objectives) {
        if (objective.type === objectiveType && objective.target === target) {
          objective.current = Math.min(objective.current + count, objective.required);
          updated = true;
        }
      }

      if (updated) {
        // Check if all objectives are met
        const allComplete = entry.objectives.every((obj) => obj.current >= obj.required);
        if (allComplete) {
          entry.state = QuestState.Complete;
        }

        this.sendQuestUpdate(player.id, questId, entry.objectives, entry.state);
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  private sendQuestUpdate(
    playerId: string,
    questId: QuestId,
    objectives: QuestObjective[],
    state: QuestState,
  ): void {
    this.network.sendToPlayer(playerId, {
      type: ServerMessageType.QuestUpdate,
      questId,
      objectives,
      state,
    });
  }

  private removeQuestItemsOnTurnIn(player: Player, questDef: QuestDef): void {
    for (const objective of questDef.objectives) {
      if (objective.type !== QuestObjectiveType.Collect) continue;

      let remaining = objective.required;
      // Remove from inventory, iterating slots
      for (const invItem of [...player.inventory]) {
        if (invItem.itemId === objective.target && remaining > 0) {
          const toRemove = Math.min(invItem.quantity, remaining);
          player.removeFromInventory(invItem.slot, toRemove);
          remaining -= toRemove;
        }
      }
    }
  }

  /** Build the NPC list payload for a specific zone, tailored to a player */
  getNpcListForZone(
    player: Player,
    zoneId: string,
  ): Array<{ id: NpcId; position: { x: number; y: number }; hasQuest: boolean; questReady: boolean }> {
    const quests = this.getPlayerQuests(player.id);
    const result: Array<{ id: NpcId; position: { x: number; y: number }; hasQuest: boolean; questReady: boolean }> = [];

    for (const npcDef of Object.values(NPC_DEFINITIONS)) {
      if (npcDef.zone !== zoneId) continue;

      let hasQuest = false;
      let questReady = false;

      for (const questId of npcDef.questIds) {
        const entry = quests.get(questId);

        if (entry && entry.state === QuestState.Complete) {
          questReady = true;
        }

        const availableCheck = this.isQuestAvailableForPlayer(player, questId, quests);
        if (availableCheck.hasQuest) {
          hasQuest = true;
        }
      }

      result.push({
        id: npcDef.id,
        position: npcDef.position,
        hasQuest,
        questReady,
      });
    }

    return result;
  }

  private isQuestAvailableForPlayer(
    player: Player,
    questId: QuestId,
    playerQuests: Map<QuestId, PlayerQuestEntry>,
  ): { hasQuest: boolean; questReady: boolean } {
    const entry = playerQuests.get(questId);
    const questDef = QUEST_DEFINITIONS[questId];

    if (!entry || entry.state === QuestState.Available) {
      // Not yet taken - check eligibility
      if (questDef) {
        const meetsPrereq = !questDef.prerequisiteQuest ||
          (playerQuests.get(questDef.prerequisiteQuest)?.state === QuestState.TurnedIn);
        const meetsLevel = player.level >= questDef.requiredLevel;
        if (meetsPrereq && meetsLevel) {
          return { hasQuest: true, questReady: false };
        }
      }
    }

    return { hasQuest: false, questReady: false };
  }
}
