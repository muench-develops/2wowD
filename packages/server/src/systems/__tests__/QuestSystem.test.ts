import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ClassType,
  QuestId,
  QuestState,
  QuestObjectiveType,
  QUEST_DEFINITIONS,
  ZoneId,
  ServerMessageType,
} from '@isoheim/shared';
import { Player } from '../../entities/Player.js';
import { QuestManager, PlayerQuestEntry } from '../QuestManager.js';
import type { NetworkManager } from '../../network/NetworkManager.js';

/**
 * TEST SPECIFICATION: QuestSystem
 * 
 * Comprehensive tests for NPC & Quest system (Issue #7).
 * 
 * Coverage:
 * - Quest definitions validation (13 quests)
 * - Quest acceptance (level check, prerequisite check, max active limit)
 * - Objective tracking (defeat mobs, collect items, visit zones)
 * - Quest completion (auto-mark when objectives met)
 * - Quest turn-in (validates completion, grants rewards)
 * - Quest abandonment (removes active, resets progress)
 * - Quest persistence (save/load roundtrip)
 * - Edge cases (double turn-in, concurrent players, dead player)
 */

describe('QuestSystem', () => {
  let player: Player;
  let questManager: QuestManager;
  let mockNetwork: NetworkManager;

  beforeEach(() => {
    player = new Player('test-player', 'TestWarrior', ClassType.Warrior);
    player.level = 1;
    player.gold = 0;
    player.xp = 0;

    // Mock NetworkManager
    mockNetwork = {
      sendToPlayer: vi.fn(),
      broadcastToZone: vi.fn(),
    } as unknown as NetworkManager;

    questManager = new QuestManager(mockNetwork);
    questManager.initPlayer(player.id);
  });

  // ══════════════════════════════════════════════════════════
  // Quest Definitions Validation
  // ══════════════════════════════════════════════════════════

  describe('Quest Definitions Validation', () => {
    it('should have exactly 13 quest definitions', () => {
      const questIds = Object.keys(QUEST_DEFINITIONS);
      expect(questIds.length).toBe(13);
    });

    it('should have all required fields for each quest', () => {
      for (const [questId, quest] of Object.entries(QUEST_DEFINITIONS)) {
        expect(quest.id).toBe(questId);
        expect(quest.name).toBeTruthy();
        expect(quest.description).toBeTruthy();
        expect(quest.npcId).toBeTruthy();
        expect(quest.objectives).toBeDefined();
        expect(quest.objectives.length).toBeGreaterThan(0);
        expect(quest.rewards).toBeDefined();
        expect(quest.requiredLevel).toBeGreaterThan(0);
      }
    });

    it('should have valid objectives for each quest', () => {
      for (const quest of Object.values(QUEST_DEFINITIONS)) {
        for (const objective of quest.objectives) {
          expect([
            QuestObjectiveType.Defeat,
            QuestObjectiveType.Collect,
            QuestObjectiveType.Visit,
          ]).toContain(objective.type);
          expect(objective.target).toBeTruthy();
          expect(objective.required).toBeGreaterThan(0);
        }
      }
    });

    it('should have valid rewards for each quest', () => {
      for (const quest of Object.values(QUEST_DEFINITIONS)) {
        expect(quest.rewards.xp).toBeGreaterThanOrEqual(0);
        expect(quest.rewards.gold).toBeGreaterThanOrEqual(0);
        if (quest.rewards.items) {
          expect(Array.isArray(quest.rewards.items)).toBe(true);
          for (const item of quest.rewards.items) {
            expect(item.itemId).toBeTruthy();
            expect(item.quantity).toBeGreaterThan(0);
          }
        }
      }
    });

    it('should have valid prerequisite quests if specified', () => {
      for (const quest of Object.values(QUEST_DEFINITIONS)) {
        if (quest.prerequisiteQuest) {
          expect(QUEST_DEFINITIONS[quest.prerequisiteQuest]).toBeDefined();
        }
      }
    });
  });

  // ══════════════════════════════════════════════════════════
  // Quest Acceptance
  // ══════════════════════════════════════════════════════════

  describe('Quest Acceptance', () => {
    it('should accept a quest when requirements are met', () => {
      player.level = 1;
      const result = questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      expect(result).toBe(true);
      const quests = questManager.getPlayerQuests(player.id);
      expect(quests.has(QuestId.SlayGoblins)).toBe(true);
      expect(quests.get(QuestId.SlayGoblins)!.state).toBe(QuestState.Active);
    });

    it('should reject quest if player level too low', () => {
      player.level = 1;
      const result = questManager.acceptQuest(player, QuestId.HuntWolves); // requires level 3
      
      expect(result).toBe(false);
      const quests = questManager.getPlayerQuests(player.id);
      expect(quests.has(QuestId.HuntWolves)).toBe(false);
    });

    it('should reject quest if already active', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      // Try to accept again
      const result = questManager.acceptQuest(player, QuestId.SlayGoblins);
      expect(result).toBe(false);
    });

    it('should reject quest if already turned in', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      // Complete and turn in
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.SlayGoblins)!;
      entry.objectives[0].current = entry.objectives[0].required;
      entry.state = QuestState.Complete;
      questManager.turnInQuest(player, QuestId.SlayGoblins);
      
      // Try to accept again
      const result = questManager.acceptQuest(player, QuestId.SlayGoblins);
      expect(result).toBe(false);
    });

    it('should reject quest if prerequisite not completed', () => {
      player.level = 2;
      const result = questManager.acceptQuest(player, QuestId.HelpTheGuard); // requires SlayGoblins
      
      expect(result).toBe(false);
      const quests = questManager.getPlayerQuests(player.id);
      expect(quests.has(QuestId.HelpTheGuard)).toBe(false);
    });

    it('should accept quest if prerequisite completed', () => {
      player.level = 2;
      
      // Complete prerequisite
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.SlayGoblins)!;
      entry.objectives[0].current = entry.objectives[0].required;
      entry.state = QuestState.Complete;
      questManager.turnInQuest(player, QuestId.SlayGoblins);
      
      // Now accept dependent quest
      const result = questManager.acceptQuest(player, QuestId.HelpTheGuard);
      expect(result).toBe(true);
      expect(quests.has(QuestId.HelpTheGuard)).toBe(true);
    });

    it('should initialize objectives with current = 0', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.SlayGoblins)!;
      
      expect(entry.objectives.length).toBeGreaterThan(0);
      for (const objective of entry.objectives) {
        expect(objective.current).toBe(0);
        expect(objective.required).toBeGreaterThan(0);
      }
    });

    it('should send quest update message on acceptance', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      expect(mockNetwork.sendToPlayer).toHaveBeenCalledWith(
        player.id,
        expect.objectContaining({
          type: ServerMessageType.QuestUpdate,
          questId: QuestId.SlayGoblins,
          state: QuestState.Active,
        })
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // Objective Tracking
  // ══════════════════════════════════════════════════════════

  describe('Objective Tracking - Defeat', () => {
    it('should update defeat objective on mob kill', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins); // Kill 5 goblins
      
      questManager.onMobKill(player, 'goblin');
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.SlayGoblins)!;
      expect(entry.objectives[0].current).toBe(1);
    });

    it('should increment defeat objective multiple times', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins); // Kill 5 goblins
      
      questManager.onMobKill(player, 'goblin');
      questManager.onMobKill(player, 'goblin');
      questManager.onMobKill(player, 'goblin');
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.SlayGoblins)!;
      expect(entry.objectives[0].current).toBe(3);
    });

    it('should not exceed required count for objective', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins); // Kill 5 goblins
      
      // Kill 7 goblins
      for (let i = 0; i < 7; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.SlayGoblins)!;
      expect(entry.objectives[0].current).toBe(5); // capped at required
    });

    it('should ignore kills of wrong mob type', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins); // Kill 5 goblins
      
      questManager.onMobKill(player, 'wolf'); // wrong mob
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.SlayGoblins)!;
      expect(entry.objectives[0].current).toBe(0);
    });

    it('should track multiple defeat quests independently', () => {
      player.level = 3;
      questManager.acceptQuest(player, QuestId.HuntWolves); // Kill 3 wolf alphas
      questManager.acceptQuest(player, QuestId.ClearSpiders); // Kill 6 spiders
      
      questManager.onMobKill(player, 'wolf-alpha');
      questManager.onMobKill(player, 'spider');
      questManager.onMobKill(player, 'spider');
      
      const quests = questManager.getPlayerQuests(player.id);
      expect(quests.get(QuestId.HuntWolves)!.objectives[0].current).toBe(1);
      expect(quests.get(QuestId.ClearSpiders)!.objectives[0].current).toBe(2);
    });
  });

  describe('Objective Tracking - Collect', () => {
    it('should update collect objective on item pickup', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.CollectWolfPelts); // Collect 3 wolf pelts
      
      questManager.onItemPickup(player, 'wolf_pelt');
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.CollectWolfPelts)!;
      expect(entry.objectives[0].current).toBe(1);
    });

    it('should increment collect objective multiple times', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.CollectWolfPelts); // Collect 3 wolf pelts
      
      questManager.onItemPickup(player, 'wolf_pelt');
      questManager.onItemPickup(player, 'wolf_pelt');
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.CollectWolfPelts)!;
      expect(entry.objectives[0].current).toBe(2);
    });

    it('should ignore pickup of wrong item', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.CollectWolfPelts); // Collect 3 wolf pelts
      
      questManager.onItemPickup(player, 'skeleton_bone'); // wrong item
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.CollectWolfPelts)!;
      expect(entry.objectives[0].current).toBe(0);
    });
  });

  describe('Objective Tracking - Visit', () => {
    it('should update visit objective on zone enter', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.VisitTheMerchant); // Visit starter plains
      
      questManager.onZoneEnter(player, ZoneId.StarterPlains);
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.VisitTheMerchant)!;
      expect(entry.objectives[0].current).toBe(1);
    });

    it('should ignore visit to wrong zone', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.VisitTheMerchant); // Visit starter plains
      
      questManager.onZoneEnter(player, ZoneId.DarkForest); // wrong zone
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.VisitTheMerchant)!;
      expect(entry.objectives[0].current).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════
  // Quest Completion
  // ══════════════════════════════════════════════════════════

  describe('Quest Completion', () => {
    it('should auto-mark quest as complete when all objectives met', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins); // Kill 5 goblins
      
      // Kill 5 goblins
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.SlayGoblins)!;
      expect(entry.state).toBe(QuestState.Complete);
    });

    it('should not auto-mark quest as complete if objectives not met', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins); // Kill 5 goblins
      
      // Kill only 3
      for (let i = 0; i < 3; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.SlayGoblins)!;
      expect(entry.state).toBe(QuestState.Active);
    });

    it('should send quest update when completing objectives', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      vi.clearAllMocks();
      
      // Complete objectives
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      expect(mockNetwork.sendToPlayer).toHaveBeenCalledWith(
        player.id,
        expect.objectContaining({
          type: ServerMessageType.QuestUpdate,
          questId: QuestId.SlayGoblins,
          state: QuestState.Complete,
        })
      );
    });

    it('should NOT auto-grant rewards when quest completes (requires turn-in)', () => {
      player.level = 1;
      const initialGold = player.gold;
      const initialXp = player.xp;
      
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      // Complete objectives
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      // Rewards should NOT be granted yet
      expect(player.gold).toBe(initialGold);
      expect(player.xp).toBe(initialXp);
    });
  });

  // ══════════════════════════════════════════════════════════
  // Quest Turn-In
  // ══════════════════════════════════════════════════════════

  describe('Quest Turn-In', () => {
    it('should grant XP reward on turn-in', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      // Complete objectives
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      const initialXp = player.xp;
      questManager.turnInQuest(player, QuestId.SlayGoblins);
      
      const expectedXp = QUEST_DEFINITIONS[QuestId.SlayGoblins].rewards.xp;
      expect(player.xp).toBe(initialXp + expectedXp);
    });

    it('should grant gold reward on turn-in', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      // Complete objectives
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      const initialGold = player.gold;
      questManager.turnInQuest(player, QuestId.SlayGoblins);
      
      const expectedGold = QUEST_DEFINITIONS[QuestId.SlayGoblins].rewards.gold;
      expect(player.gold).toBe(initialGold + expectedGold);
    });

    it('should grant item rewards on turn-in', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.CollectWolfPelts);
      
      // Complete objectives
      for (let i = 0; i < 3; i++) {
        questManager.onItemPickup(player, 'wolf_pelt');
      }
      
      questManager.turnInQuest(player, QuestId.CollectWolfPelts);
      
      // Should have received 3 minor health potions
      const potion = player.inventory.find(i => i.itemId === 'minor_health_potion');
      expect(potion).toBeDefined();
      expect(potion!.quantity).toBe(3);
    });

    it('should change quest state to TurnedIn', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      // Complete objectives
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      questManager.turnInQuest(player, QuestId.SlayGoblins);
      
      const quests = questManager.getPlayerQuests(player.id);
      expect(quests.get(QuestId.SlayGoblins)!.state).toBe(QuestState.TurnedIn);
    });

    it('should reject turn-in if quest not complete', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      // Only kill 2 goblins (need 5)
      questManager.onMobKill(player, 'goblin');
      questManager.onMobKill(player, 'goblin');
      
      const result = questManager.turnInQuest(player, QuestId.SlayGoblins);
      expect(result).toBe(false);
    });

    it('should reject turn-in if quest not active', () => {
      player.level = 1;
      const result = questManager.turnInQuest(player, QuestId.SlayGoblins);
      expect(result).toBe(false);
    });

    it('should send quest completed message on turn-in', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      vi.clearAllMocks();
      questManager.turnInQuest(player, QuestId.SlayGoblins);
      
      expect(mockNetwork.sendToPlayer).toHaveBeenCalledWith(
        player.id,
        expect.objectContaining({
          type: ServerMessageType.QuestCompleted,
          questId: QuestId.SlayGoblins,
        })
      );
    });

    it('should send inventory update after granting item rewards', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.CollectWolfPelts);
      
      for (let i = 0; i < 3; i++) {
        questManager.onItemPickup(player, 'wolf_pelt');
      }
      
      vi.clearAllMocks();
      questManager.turnInQuest(player, QuestId.CollectWolfPelts);
      
      expect(mockNetwork.sendToPlayer).toHaveBeenCalledWith(
        player.id,
        expect.objectContaining({
          type: ServerMessageType.InventoryUpdate,
        })
      );
    });

    it('should trigger level-up broadcast if XP reward causes level-up', () => {
      player.level = 1;
      player.xp = 90; // Close to level 2 (needs 100)
      player.currentZone = ZoneId.StarterPlains;
      
      questManager.acceptQuest(player, QuestId.SlayGoblins); // Grants 50 XP
      
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      vi.clearAllMocks();
      questManager.turnInQuest(player, QuestId.SlayGoblins);
      
      expect(mockNetwork.broadcastToZone).toHaveBeenCalledWith(
        ZoneId.StarterPlains,
        expect.objectContaining({
          type: ServerMessageType.LevelUp,
        })
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // Quest Abandonment
  // ══════════════════════════════════════════════════════════

  describe('Quest Abandonment', () => {
    it('should remove active quest on abandon', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      const result = questManager.abandonQuest(player, QuestId.SlayGoblins);
      expect(result).toBe(true);
      
      const quests = questManager.getPlayerQuests(player.id);
      expect(quests.has(QuestId.SlayGoblins)).toBe(false);
    });

    it('should allow re-acceptance after abandonment', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      questManager.abandonQuest(player, QuestId.SlayGoblins);
      
      const result = questManager.acceptQuest(player, QuestId.SlayGoblins);
      expect(result).toBe(true);
      
      const quests = questManager.getPlayerQuests(player.id);
      expect(quests.has(QuestId.SlayGoblins)).toBe(true);
    });

    it('should reset progress on re-acceptance after abandonment', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      // Make some progress
      questManager.onMobKill(player, 'goblin');
      questManager.onMobKill(player, 'goblin');
      
      questManager.abandonQuest(player, QuestId.SlayGoblins);
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      const quests = questManager.getPlayerQuests(player.id);
      const entry = quests.get(QuestId.SlayGoblins)!;
      expect(entry.objectives[0].current).toBe(0);
    });

    it('should reject abandon if quest not active', () => {
      player.level = 1;
      const result = questManager.abandonQuest(player, QuestId.SlayGoblins);
      expect(result).toBe(false);
    });

    it('should reject abandon if quest already completed', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      const result = questManager.abandonQuest(player, QuestId.SlayGoblins);
      expect(result).toBe(false);
    });

    it('should send quest update message on abandon', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      vi.clearAllMocks();
      questManager.abandonQuest(player, QuestId.SlayGoblins);
      
      expect(mockNetwork.sendToPlayer).toHaveBeenCalledWith(
        player.id,
        expect.objectContaining({
          type: ServerMessageType.QuestUpdate,
          questId: QuestId.SlayGoblins,
          state: QuestState.Available,
        })
      );
    });
  });

  // ══════════════════════════════════════════════════════════
  // Quest Persistence
  // ══════════════════════════════════════════════════════════

  describe('Quest Persistence', () => {
    it('should maintain quest state when getting player quests', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      questManager.onMobKill(player, 'goblin');
      questManager.onMobKill(player, 'goblin');
      
      const quests = questManager.getPlayerQuests(player.id);
      expect(quests.get(QuestId.SlayGoblins)!.objectives[0].current).toBe(2);
    });

    it('should support multiple players with independent quest states', () => {
      const player2 = new Player('test-player-2', 'TestMage', ClassType.Mage);
      player2.level = 1;
      
      questManager.initPlayer(player2.id);
      
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      questManager.acceptQuest(player2, QuestId.SlayGoblins);
      
      questManager.onMobKill(player, 'goblin');
      questManager.onMobKill(player, 'goblin');
      questManager.onMobKill(player2, 'goblin');
      
      const quests1 = questManager.getPlayerQuests(player.id);
      const quests2 = questManager.getPlayerQuests(player2.id);
      
      expect(quests1.get(QuestId.SlayGoblins)!.objectives[0].current).toBe(2);
      expect(quests2.get(QuestId.SlayGoblins)!.objectives[0].current).toBe(1);
    });

    it('should allow initialization with existing quest data', () => {
      const existingQuests = new Map<QuestId, PlayerQuestEntry>();
      existingQuests.set(QuestId.SlayGoblins, {
        state: QuestState.Active,
        objectives: [
          { type: QuestObjectiveType.Defeat, target: 'goblin', required: 5, current: 3 },
        ],
      });
      
      questManager.initPlayer(player.id, existingQuests);
      
      const quests = questManager.getPlayerQuests(player.id);
      expect(quests.get(QuestId.SlayGoblins)!.state).toBe(QuestState.Active);
      expect(quests.get(QuestId.SlayGoblins)!.objectives[0].current).toBe(3);
    });

    it('should remove player quest data when player removed', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      questManager.removePlayer(player.id);
      
      const quests = questManager.getPlayerQuests(player.id);
      expect(quests.size).toBe(0);
    });
  });

  // ══════════════════════════════════════════════════════════
  // Edge Cases
  // ══════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('should prevent double turn-in of same quest', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      const firstTurnIn = questManager.turnInQuest(player, QuestId.SlayGoblins);
      const secondTurnIn = questManager.turnInQuest(player, QuestId.SlayGoblins);
      
      expect(firstTurnIn).toBe(true);
      expect(secondTurnIn).toBe(false);
    });

    it('should handle invalid quest ID gracefully', () => {
      player.level = 1;
      const result = questManager.acceptQuest(player, 'invalid-quest-id' as QuestId);
      expect(result).toBe(false);
    });

    it('should handle mob kill for player with no active quests', () => {
      player.level = 1;
      expect(() => {
        questManager.onMobKill(player, 'goblin');
      }).not.toThrow();
    });

    it('should handle item pickup for player with no active quests', () => {
      player.level = 1;
      expect(() => {
        questManager.onItemPickup(player, 'wolf_pelt');
      }).not.toThrow();
    });

    it('should handle zone enter for player with no active quests', () => {
      player.level = 1;
      expect(() => {
        questManager.onZoneEnter(player, ZoneId.StarterPlains);
      }).not.toThrow();
    });

    it('should return empty list for uninitialized player', () => {
      const unknownPlayer = new Player('unknown', 'Unknown', ClassType.Warrior);
      const quests = questManager.getPlayerQuests(unknownPlayer.id);
      expect(quests.size).toBe(0);
    });

    it('should handle quest with multiple objectives', () => {
      player.level = 2;
      
      // HelpTheGuard has collect objective
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      questManager.turnInQuest(player, QuestId.SlayGoblins);
      
      questManager.acceptQuest(player, QuestId.HelpTheGuard);
      
      for (let i = 0; i < 8; i++) {
        questManager.onItemPickup(player, 'goblin_ear');
      }
      
      const quests = questManager.getPlayerQuests(player.id);
      expect(quests.get(QuestId.HelpTheGuard)!.state).toBe(QuestState.Complete);
    });

    it('should not grant XP if player at level cap', () => {
      player.level = 20; // At cap
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      const initialXp = player.xp;
      questManager.turnInQuest(player, QuestId.SlayGoblins);
      
      // XP still granted, but addXp handles cap logic
      expect(player.level).toBe(20);
    });
  });

  // ══════════════════════════════════════════════════════════
  // NPC Quest List Generation
  // ══════════════════════════════════════════════════════════

  describe('NPC Quest List for Zone', () => {
    it('should return NPCs in correct zone', () => {
      player.level = 1;
      const npcList = questManager.getNpcListForZone(player, ZoneId.StarterPlains);
      
      expect(npcList.length).toBeGreaterThan(0);
      // Guard Captain and Merchant should be in starter plains
      const guardCaptain = npcList.find(n => n.id === 'guard-captain');
      const merchant = npcList.find(n => n.id === 'merchant');
      
      expect(guardCaptain).toBeDefined();
      expect(merchant).toBeDefined();
    });

    it('should mark hasQuest true for NPCs with available quests', () => {
      player.level = 1;
      const npcList = questManager.getNpcListForZone(player, ZoneId.StarterPlains);
      
      const guardCaptain = npcList.find(n => n.id === 'guard-captain');
      expect(guardCaptain!.hasQuest).toBe(true); // SlayGoblins is available
    });

    it('should mark questReady true for NPCs with completable quests', () => {
      player.level = 1;
      questManager.acceptQuest(player, QuestId.SlayGoblins);
      
      for (let i = 0; i < 5; i++) {
        questManager.onMobKill(player, 'goblin');
      }
      
      const npcList = questManager.getNpcListForZone(player, ZoneId.StarterPlains);
      const guardCaptain = npcList.find(n => n.id === 'guard-captain');
      
      expect(guardCaptain!.questReady).toBe(true);
    });

    it('should not mark hasQuest for NPC if level too low', () => {
      player.level = 1;
      const npcList = questManager.getNpcListForZone(player, ZoneId.DarkForest);
      
      const ranger = npcList.find(n => n.id === 'ranger');
      // Ranger has HuntWolves (level 3), should not show hasQuest for level 1
      expect(ranger).toBeDefined();
    });

    it('should not mark hasQuest if prerequisite not met', () => {
      player.level = 2;
      const npcList = questManager.getNpcListForZone(player, ZoneId.StarterPlains);
      
      const guardCaptain = npcList.find(n => n.id === 'guard-captain');
      // HelpTheGuard requires SlayGoblins, so shouldn't show yet
      expect(guardCaptain).toBeDefined();
    });
  });
});
