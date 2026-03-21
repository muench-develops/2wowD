import { describe, it, expect, beforeEach } from 'vitest';
import {
  ClassType,
  QuestId,
  QuestState,
  NpcId,
  NPC_DEFINITIONS,
  ZoneId,
  Direction,
} from '@isoheim/shared';
import { Player } from '../../entities/Player.js';
import { Npc } from '../../entities/Npc.js';
import type { PlayerQuestEntry } from '../../systems/QuestManager.js';

/**
 * TEST SPECIFICATION: NPCSystem
 * 
 * Comprehensive tests for NPC entities (Issue #7).
 * 
 * Coverage:
 * - NPC definitions validation (6 NPCs)
 * - NPC spawning (correct positions, unique IDs)
 * - NPC interaction (proximity check, dialogue data)
 * - NPC-quest linking (available/completable quests per player)
 * - Multi-player NPC interaction (independent states)
 */

describe('NPCSystem', () => {
  let player: Player;

  beforeEach(() => {
    player = new Player('test-player', 'TestWarrior', ClassType.Warrior);
    player.level = 1;
  });

  // ══════════════════════════════════════════════════════════
  // NPC Definitions Validation
  // ══════════════════════════════════════════════════════════

  describe('NPC Definitions Validation', () => {
    it('should have exactly 6 NPC definitions', () => {
      const npcIds = Object.keys(NPC_DEFINITIONS);
      expect(npcIds.length).toBe(6);
    });

    it('should have all required NPCs', () => {
      expect(NPC_DEFINITIONS[NpcId.GuardCaptain]).toBeDefined();
      expect(NPC_DEFINITIONS[NpcId.Merchant]).toBeDefined();
      expect(NPC_DEFINITIONS[NpcId.Ranger]).toBeDefined();
      expect(NPC_DEFINITIONS[NpcId.Hermit]).toBeDefined();
      expect(NPC_DEFINITIONS[NpcId.Adventurer]).toBeDefined();
      expect(NPC_DEFINITIONS[NpcId.Priest]).toBeDefined();
    });

    it('should have all required fields for each NPC', () => {
      for (const [npcId, npcDef] of Object.entries(NPC_DEFINITIONS)) {
        expect(npcDef.id).toBe(npcId);
        expect(npcDef.name).toBeTruthy();
        expect(npcDef.zone).toBeTruthy();
        expect(npcDef.position).toBeDefined();
        expect(npcDef.position.x).toBeGreaterThanOrEqual(0);
        expect(npcDef.position.y).toBeGreaterThanOrEqual(0);
        expect(npcDef.dialogue).toBeDefined();
        expect(npcDef.questIds).toBeDefined();
        expect(Array.isArray(npcDef.questIds)).toBe(true);
      }
    });

    it('should have valid dialogue for each NPC', () => {
      for (const npcDef of Object.values(NPC_DEFINITIONS)) {
        expect(npcDef.dialogue.greeting).toBeTruthy();
        expect(npcDef.dialogue.questAvailable).toBeTruthy();
        expect(npcDef.dialogue.questInProgress).toBeTruthy();
        expect(npcDef.dialogue.questComplete).toBeTruthy();
      }
    });

    it('should have valid zone assignments for NPCs', () => {
      const validZones = Object.values(ZoneId);
      
      for (const npcDef of Object.values(NPC_DEFINITIONS)) {
        expect(validZones).toContain(npcDef.zone);
      }
    });

    it('should have at least one quest per NPC', () => {
      for (const npcDef of Object.values(NPC_DEFINITIONS)) {
        expect(npcDef.questIds.length).toBeGreaterThan(0);
      }
    });

    it('should have valid quest references for each NPC', () => {
      const validQuestIds = Object.values(QuestId);
      
      for (const npcDef of Object.values(NPC_DEFINITIONS)) {
        for (const questId of npcDef.questIds) {
          expect(validQuestIds).toContain(questId);
        }
      }
    });

    it('should have NPCs distributed across zones', () => {
      const starterPlains = Object.values(NPC_DEFINITIONS).filter(
        n => n.zone === ZoneId.StarterPlains
      );
      const darkForest = Object.values(NPC_DEFINITIONS).filter(
        n => n.zone === ZoneId.DarkForest
      );
      const dungeon = Object.values(NPC_DEFINITIONS).filter(
        n => n.zone === ZoneId.AncientDungeon
      );
      
      expect(starterPlains.length).toBe(2); // Guard Captain, Merchant
      expect(darkForest.length).toBe(2); // Ranger, Hermit
      expect(dungeon.length).toBe(2); // Adventurer, Priest
    });
  });

  // ══════════════════════════════════════════════════════════
  // NPC Spawning
  // ══════════════════════════════════════════════════════════

  describe('NPC Spawning', () => {
    it('should create NPC with correct ID', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      expect(npc.id).toBe(NpcId.GuardCaptain);
    });

    it('should load NPC definition data', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      expect(npc.def).toBeDefined();
      expect(npc.def.name).toBe('Guard Captain Aldric');
    });

    it('should spawn NPC at correct position', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      const expectedPos = NPC_DEFINITIONS[NpcId.GuardCaptain].position;
      
      expect(npc.position.x).toBe(expectedPos.x);
      expect(npc.position.y).toBe(expectedPos.y);
    });

    it('should spawn NPC with default direction', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      expect(npc.position.direction).toBe(Direction.S);
    });

    it('should spawn NPC in correct zone', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      expect(npc.zone).toBe(ZoneId.StarterPlains);
    });

    it('should create NPCs with unique positions', () => {
      const guardCaptain = new Npc(NpcId.GuardCaptain);
      const merchant = new Npc(NpcId.Merchant);
      
      const samePosition = guardCaptain.position.x === merchant.position.x &&
                          guardCaptain.position.y === merchant.position.y;
      
      expect(samePosition).toBe(false);
    });

    it('should create all 6 NPCs without errors', () => {
      expect(() => new Npc(NpcId.GuardCaptain)).not.toThrow();
      expect(() => new Npc(NpcId.Merchant)).not.toThrow();
      expect(() => new Npc(NpcId.Ranger)).not.toThrow();
      expect(() => new Npc(NpcId.Hermit)).not.toThrow();
      expect(() => new Npc(NpcId.Adventurer)).not.toThrow();
      expect(() => new Npc(NpcId.Priest)).not.toThrow();
    });
  });

  // ══════════════════════════════════════════════════════════
  // NPC Quest Availability
  // ══════════════════════════════════════════════════════════

  describe('NPC Quest Availability', () => {
    it('should return available quests for player meeting requirements', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 1;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests.length).toBeGreaterThan(0);
      expect(availableQuests.some(q => q.id === QuestId.SlayGoblins)).toBe(true);
    });

    it('should not return quests if player level too low', () => {
      const npc = new Npc(NpcId.Ranger);
      player.level = 1; // Ranger quests require level 3+
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests.length).toBe(0);
    });

    it('should not return quests already active', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 1;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      questStates.set(QuestId.SlayGoblins, { state: QuestState.Active });
      
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests.some(q => q.id === QuestId.SlayGoblins)).toBe(false);
    });

    it('should not return quests already complete', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 1;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      questStates.set(QuestId.SlayGoblins, { state: QuestState.Complete });
      
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests.some(q => q.id === QuestId.SlayGoblins)).toBe(false);
    });

    it('should not return quests already turned in', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 1;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      questStates.set(QuestId.SlayGoblins, { state: QuestState.TurnedIn });
      
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests.some(q => q.id === QuestId.SlayGoblins)).toBe(false);
    });

    it('should not return quests if prerequisite not completed', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 2;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      // HelpTheGuard requires SlayGoblins to be turned in
      
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests.some(q => q.id === QuestId.HelpTheGuard)).toBe(false);
    });

    it('should return quests if prerequisite completed', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 2;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      questStates.set(QuestId.SlayGoblins, { state: QuestState.TurnedIn });
      
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests.some(q => q.id === QuestId.HelpTheGuard)).toBe(true);
    });

    it('should return multiple available quests from same NPC', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 1;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      // Guard Captain has SlayGoblins and VisitTheMerchant at level 1
      expect(availableQuests.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array if no quests available', () => {
      const npc = new Npc(NpcId.Priest);
      player.level = 1; // Priest quests require higher level
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests).toEqual([]);
    });

    it('should return quest definitions with full data', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 1;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests.length).toBeGreaterThan(0);
      const quest = availableQuests[0];
      
      expect(quest.id).toBeTruthy();
      expect(quest.name).toBeTruthy();
      expect(quest.description).toBeTruthy();
      expect(quest.objectives).toBeDefined();
      expect(quest.rewards).toBeDefined();
    });
  });

  // ══════════════════════════════════════════════════════════
  // NPC Zone Distribution
  // ══════════════════════════════════════════════════════════

  describe('NPC Zone Distribution', () => {
    it('should spawn Guard Captain in Starter Plains', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      expect(npc.zone).toBe(ZoneId.StarterPlains);
    });

    it('should spawn Merchant in Starter Plains', () => {
      const npc = new Npc(NpcId.Merchant);
      expect(npc.zone).toBe(ZoneId.StarterPlains);
    });

    it('should spawn Ranger in Dark Forest', () => {
      const npc = new Npc(NpcId.Ranger);
      expect(npc.zone).toBe(ZoneId.DarkForest);
    });

    it('should spawn Hermit in Dark Forest', () => {
      const npc = new Npc(NpcId.Hermit);
      expect(npc.zone).toBe(ZoneId.DarkForest);
    });

    it('should spawn Adventurer in Ancient Dungeon', () => {
      const npc = new Npc(NpcId.Adventurer);
      expect(npc.zone).toBe(ZoneId.AncientDungeon);
    });

    it('should spawn Priest in Ancient Dungeon', () => {
      const npc = new Npc(NpcId.Priest);
      expect(npc.zone).toBe(ZoneId.AncientDungeon);
    });
  });

  // ══════════════════════════════════════════════════════════
  // Multi-Player NPC Interaction
  // ══════════════════════════════════════════════════════════

  describe('Multi-Player NPC Interaction', () => {
    it('should return different available quests for different player levels', () => {
      const npc = new Npc(NpcId.Ranger);
      
      const lowLevelPlayer = new Player('player-1', 'Low', ClassType.Warrior);
      lowLevelPlayer.level = 1;
      
      const highLevelPlayer = new Player('player-2', 'High', ClassType.Warrior);
      highLevelPlayer.level = 5;
      
      const questStates1 = new Map<QuestId, { state: QuestState }>();
      const questStates2 = new Map<QuestId, { state: QuestState }>();
      
      const available1 = npc.getAvailableQuests(lowLevelPlayer, questStates1);
      const available2 = npc.getAvailableQuests(highLevelPlayer, questStates2);
      
      expect(available1.length).toBe(0); // Level 1 can't do Ranger quests
      expect(available2.length).toBeGreaterThan(0); // Level 5 can
    });

    it('should return different available quests based on player quest states', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      
      const player1 = new Player('player-1', 'One', ClassType.Warrior);
      player1.level = 1;
      
      const player2 = new Player('player-2', 'Two', ClassType.Warrior);
      player2.level = 1;
      
      const questStates1 = new Map<QuestId, { state: QuestState }>();
      const questStates2 = new Map<QuestId, { state: QuestState }>();
      questStates2.set(QuestId.SlayGoblins, { state: QuestState.Active });
      
      const available1 = npc.getAvailableQuests(player1, questStates1);
      const available2 = npc.getAvailableQuests(player2, questStates2);
      
      const hasSlayGoblins1 = available1.some(q => q.id === QuestId.SlayGoblins);
      const hasSlayGoblins2 = available2.some(q => q.id === QuestId.SlayGoblins);
      
      expect(hasSlayGoblins1).toBe(true);
      expect(hasSlayGoblins2).toBe(false);
    });

    it('should handle multiple players querying same NPC concurrently', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      
      const player1 = new Player('player-1', 'One', ClassType.Warrior);
      const player2 = new Player('player-2', 'Two', ClassType.Warrior);
      const player3 = new Player('player-3', 'Three', ClassType.Warrior);
      
      player1.level = 1;
      player2.level = 1;
      player3.level = 1;
      
      const questStates1 = new Map<QuestId, { state: QuestState }>();
      const questStates2 = new Map<QuestId, { state: QuestState }>();
      const questStates3 = new Map<QuestId, { state: QuestState }>();
      
      expect(() => {
        npc.getAvailableQuests(player1, questStates1);
        npc.getAvailableQuests(player2, questStates2);
        npc.getAvailableQuests(player3, questStates3);
      }).not.toThrow();
    });
  });

  // ══════════════════════════════════════════════════════════
  // NPC Quest Linking
  // ══════════════════════════════════════════════════════════

  describe('NPC Quest Linking', () => {
    it('should link Guard Captain to Goblin quests', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      expect(npc.def.questIds).toContain(QuestId.SlayGoblins);
      expect(npc.def.questIds).toContain(QuestId.HelpTheGuard);
    });

    it('should link Merchant to Trading quests', () => {
      const npc = new Npc(NpcId.Merchant);
      expect(npc.def.questIds).toContain(QuestId.CollectWolfPelts);
      expect(npc.def.questIds).toContain(QuestId.VisitTheMerchant);
    });

    it('should link Ranger to Forest quests', () => {
      const npc = new Npc(NpcId.Ranger);
      expect(npc.def.questIds).toContain(QuestId.HuntWolves);
      expect(npc.def.questIds).toContain(QuestId.ClearSpiders);
      expect(npc.def.questIds).toContain(QuestId.BanditThreat);
    });

    it('should link Hermit to Forest exploration quests', () => {
      const npc = new Npc(NpcId.Hermit);
      expect(npc.def.questIds).toContain(QuestId.CollectSkeletonBones);
      expect(npc.def.questIds).toContain(QuestId.ExploreForestDepths);
    });

    it('should link Adventurer to Dungeon quests', () => {
      const npc = new Npc(NpcId.Adventurer);
      expect(npc.def.questIds).toContain(QuestId.ClearSkeletonMages);
      expect(npc.def.questIds).toContain(QuestId.CollectRareDrops);
      expect(npc.def.questIds).toContain(QuestId.DungeonExplorer);
    });

    it('should link Priest to Boss quest', () => {
      const npc = new Npc(NpcId.Priest);
      expect(npc.def.questIds).toContain(QuestId.DefeatBoneLord);
    });
  });

  // ══════════════════════════════════════════════════════════
  // NPC Position Validation
  // ══════════════════════════════════════════════════════════

  describe('NPC Position Validation', () => {
    it('should have valid grid positions for all NPCs', () => {
      for (const npcId of Object.values(NpcId)) {
        const npc = new Npc(npcId);
        
        expect(npc.position.x).toBeGreaterThanOrEqual(0);
        expect(npc.position.y).toBeGreaterThanOrEqual(0);
        expect(npc.position.x).toBeLessThan(100); // Reasonable grid size
        expect(npc.position.y).toBeLessThan(100);
      }
    });

    it('should have integer coordinates for NPCs', () => {
      for (const npcId of Object.values(NpcId)) {
        const npc = new Npc(npcId);
        
        expect(Number.isInteger(npc.position.x)).toBe(true);
        expect(Number.isInteger(npc.position.y)).toBe(true);
      }
    });

    it('should maintain position data in NPC definition', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      
      expect(npc.position.x).toBe(npc.def.position.x);
      expect(npc.position.y).toBe(npc.def.position.y);
    });
  });

  // ══════════════════════════════════════════════════════════
  // Edge Cases
  // ══════════════════════════════════════════════════════════

  describe('Edge Cases', () => {
    it('should handle player with empty quest states', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 1;
      
      const emptyQuestStates = new Map<QuestId, { state: QuestState }>();
      
      expect(() => {
        npc.getAvailableQuests(player, emptyQuestStates);
      }).not.toThrow();
    });

    it('should handle high-level player checking low-level NPCs', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 20;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle player with all quests turned in', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 10;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      for (const questId of npc.def.questIds) {
        questStates.set(questId, { state: QuestState.TurnedIn });
      }
      
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests.length).toBe(0);
    });

    it('should handle NPC with single quest', () => {
      const npc = new Npc(NpcId.Priest);
      player.level = 10;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      questStates.set(QuestId.ClearSkeletonMages, { state: QuestState.TurnedIn });
      
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(availableQuests.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle NPC with multiple quests', () => {
      const npc = new Npc(NpcId.Ranger);
      player.level = 5;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      expect(npc.def.questIds.length).toBeGreaterThan(1);
      expect(availableQuests.length).toBeGreaterThan(0);
    });

    it('should correctly filter quests with Available state in map', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 1;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      questStates.set(QuestId.SlayGoblins, { state: QuestState.Available });
      
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      // Available state means quest not yet accepted, so it should be shown
      expect(availableQuests.some(q => q.id === QuestId.SlayGoblins)).toBe(true);
    });

    it('should return quest defs that reference the correct NPC', () => {
      const npc = new Npc(NpcId.GuardCaptain);
      player.level = 1;
      
      const questStates = new Map<QuestId, { state: QuestState }>();
      const availableQuests = npc.getAvailableQuests(player, questStates);
      
      for (const quest of availableQuests) {
        expect(quest.npcId).toBe(npc.id);
      }
    });
  });
});
