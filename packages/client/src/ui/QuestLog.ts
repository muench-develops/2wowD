import Phaser from 'phaser';
import {
  type QuestId,
  type QuestObjective,
  type QuestDef,
  QuestState,
  QUEST_DEFINITIONS,
  NPC_DEFINITIONS,
  ClientMessageType,
} from '@isoheim/shared';
import { NetworkManager } from '../network/NetworkManager';

const PANEL_WIDTH = 500;
const PANEL_HEIGHT = 500;
const PADDING = 16;
const TAB_HEIGHT = 32;
const BUTTON_HEIGHT = 28;

interface QuestLogEntry {
  questId: QuestId;
  objectives: QuestObjective[];
  state: QuestState;
}

type TabType = 'active' | 'completed';

export class QuestLog {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;

  private activeQuests: Map<QuestId, QuestLogEntry> = new Map();
  private completedQuests: Set<QuestId> = new Set();
  private currentTab: TabType = 'active';
  private selectedQuestId: QuestId | null = null;

  private contentContainer!: Phaser.GameObjects.Container;
  private listContainer!: Phaser.GameObjects.Container;
  private detailContainer!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    const x = (1280 - PANEL_WIDTH) / 2;
    const y = (720 - PANEL_HEIGHT) / 2;

    this.container = this.scene.add.container(x, y);
    this.container.setDepth(1000);
    this.container.setVisible(false);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 8);
    bg.lineStyle(2, 0x4a4a6a);
    bg.strokeRoundedRect(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 8);
    this.container.add(bg);

    // Title
    const title = this.scene.add.text(PANEL_WIDTH / 2, PADDING + 8, 'Quest Log', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#e0c070',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.container.add(title);

    // Close button
    const closeBtn = this.scene.add.text(PANEL_WIDTH - PADDING - 20, PADDING, 'X', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#cc4444',
    })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggle());
    this.container.add(closeBtn);

    // Tabs
    const tabY = PADDING + 32;
    this.createTabs(tabY);

    // Content area
    const contentY = tabY + TAB_HEIGHT + 8;
    const contentHeight = PANEL_HEIGHT - contentY - PADDING;

    this.contentContainer = this.scene.add.container(PADDING, contentY);
    this.container.add(this.contentContainer);

    // Quest list (left side)
    this.listContainer = this.scene.add.container(0, 0);
    this.contentContainer.add(this.listContainer);

    // Quest detail (right side)
    this.detailContainer = this.scene.add.container(220, 0);
    this.contentContainer.add(this.detailContainer);
  }

  private createTabs(yPos: number): void {
    const tabWidth = 100;
    const tab1X = PANEL_WIDTH / 2 - tabWidth - 4;
    const tab2X = PANEL_WIDTH / 2 + 4;

    const activeTab = this.createTab('Active', tab1X, yPos, tabWidth, () => this.switchTab('active'));
    const completedTab = this.createTab('Completed', tab2X, yPos, tabWidth, () => this.switchTab('completed'));

    this.container.add(activeTab);
    this.container.add(completedTab);
  }

  private createTab(
    label: string,
    x: number,
    y: number,
    width: number,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const tabContainer = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x2a2a3e, 0.8);
    bg.fillRoundedRect(0, 0, width, TAB_HEIGHT, 4);
    bg.lineStyle(1, 0x4a4a6a);
    bg.strokeRoundedRect(0, 0, width, TAB_HEIGHT, 4);
    tabContainer.add(bg);

    const text = this.scene.add.text(width / 2, TAB_HEIGHT / 2, label, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#cccccc',
    }).setOrigin(0.5);
    tabContainer.add(text);

    const hitZone = this.scene.add.zone(width / 2, TAB_HEIGHT / 2, width, TAB_HEIGHT)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', callback);
    tabContainer.add(hitZone);

    return tabContainer;
  }

  private switchTab(tab: TabType): void {
    this.currentTab = tab;
    this.selectedQuestId = null;
    this.refresh();
  }

  updateQuest(questId: QuestId, objectives: QuestObjective[], state: QuestState): void {
    if (state === QuestState.TurnedIn) {
      this.activeQuests.delete(questId);
      this.completedQuests.add(questId);
    } else if (state === QuestState.Active || state === QuestState.Complete) {
      this.activeQuests.set(questId, { questId, objectives, state });
    }

    if (this.visible) {
      this.refresh();
    }
  }

  removeQuest(questId: QuestId): void {
    this.activeQuests.delete(questId);
    if (this.selectedQuestId === questId) {
      this.selectedQuestId = null;
    }
    if (this.visible) {
      this.refresh();
    }
  }

  private refresh(): void {
    this.listContainer.removeAll(true);
    this.detailContainer.removeAll(true);

    if (this.currentTab === 'active') {
      this.renderActiveQuests();
    } else {
      this.renderCompletedQuests();
    }

    if (this.selectedQuestId) {
      this.renderQuestDetails(this.selectedQuestId);
    }
  }

  private renderActiveQuests(): void {
    let yOffset = 0;

    if (this.activeQuests.size === 0) {
      const emptyText = this.scene.add.text(0, yOffset, 'No active quests', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#888888',
      });
      this.listContainer.add(emptyText);
      return;
    }

    for (const entry of this.activeQuests.values()) {
      const questBtn = this.createQuestListItem(entry.questId, yOffset);
      this.listContainer.add(questBtn);
      yOffset += 28;
    }
  }

  private renderCompletedQuests(): void {
    let yOffset = 0;

    if (this.completedQuests.size === 0) {
      const emptyText = this.scene.add.text(0, yOffset, 'No completed quests', {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#888888',
      });
      this.listContainer.add(emptyText);
      return;
    }

    for (const questId of this.completedQuests) {
      const questBtn = this.createQuestListItem(questId, yOffset);
      this.listContainer.add(questBtn);
      yOffset += 28;
    }
  }

  private createQuestListItem(questId: QuestId, yOffset: number): Phaser.GameObjects.Container {
    const btnContainer = this.scene.add.container(0, yOffset);
    const questDef = QUEST_DEFINITIONS[questId];
    const questName = questDef ? questDef.name : questId;

    const isSelected = this.selectedQuestId === questId;
    const bgColor = isSelected ? 0x3a3a5e : 0x2a2a3e;

    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(bgColor, 0.8);
    btnBg.fillRoundedRect(0, 0, 200, 24, 4);
    btnBg.lineStyle(1, 0x4a4a6a);
    btnBg.strokeRoundedRect(0, 0, 200, 24, 4);
    btnContainer.add(btnBg);

    const btnText = this.scene.add.text(8, 12, questName, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#cccccc',
    }).setOrigin(0, 0.5);
    btnContainer.add(btnText);

    const hitZone = this.scene.add.zone(100, 12, 200, 24)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.selectedQuestId = questId;
        this.refresh();
      });
    btnContainer.add(hitZone);

    return btnContainer;
  }

  private renderQuestDetails(questId: QuestId): void {
    const questDef = QUEST_DEFINITIONS[questId];
    if (!questDef) return;

    const entry = this.activeQuests.get(questId);
    const isActive = entry !== undefined;

    let yOffset = 0;

    // Quest name
    const nameText = this.scene.add.text(0, yOffset, questDef.name, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#ffcc00',
      fontStyle: 'bold',
      wordWrap: { width: 240 },
    });
    this.detailContainer.add(nameText);
    yOffset += nameText.height + 8;

    // Quest description
    const descText = this.scene.add.text(0, yOffset, questDef.description, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#cccccc',
      wordWrap: { width: 240 },
    });
    this.detailContainer.add(descText);
    yOffset += descText.height + 12;

    // NPC info
    const npcDef = NPC_DEFINITIONS[questDef.npcId];
    const npcText = this.scene.add.text(0, yOffset, `Quest Giver: ${npcDef.name}`, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#88ccff',
    });
    this.detailContainer.add(npcText);
    yOffset += 16;

    // Objectives
    const objHeader = this.scene.add.text(0, yOffset, 'Objectives:', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#aaaacc',
    });
    this.detailContainer.add(objHeader);
    yOffset += 16;

    if (isActive && entry.objectives) {
      for (const obj of entry.objectives) {
        const isComplete = obj.current >= obj.required;
        const color = isComplete ? '#44cc44' : '#cccccc';
        const objText = this.scene.add.text(
          8,
          yOffset,
          `• ${obj.type} ${obj.target}: ${obj.current}/${obj.required}`,
          {
            fontSize: '10px',
            fontFamily: 'monospace',
            color,
          }
        );
        this.detailContainer.add(objText);
        yOffset += 14;
      }
    } else {
      for (const obj of questDef.objectives) {
        const objText = this.scene.add.text(8, yOffset, `• ${obj.type} ${obj.target}: 0/${obj.required}`, {
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#cccccc',
        });
        this.detailContainer.add(objText);
        yOffset += 14;
      }
    }
    yOffset += 8;

    // Rewards
    const rewardHeader = this.scene.add.text(0, yOffset, 'Rewards:', {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#aaaacc',
    });
    this.detailContainer.add(rewardHeader);
    yOffset += 16;

    const rewardText = this.scene.add.text(
      8,
      yOffset,
      `• ${questDef.rewards.xp} XP\n• ${questDef.rewards.gold} Gold`,
      {
        fontSize: '10px',
        fontFamily: 'monospace',
        color: '#ccaa44',
      }
    );
    this.detailContainer.add(rewardText);
    yOffset += rewardText.height + 16;

    // Abandon button (only for active quests)
    if (isActive) {
      const abandonBtn = this.createButton('Abandon Quest', 0, yOffset, 0xcc4444, () =>
        this.abandonQuest(questId)
      );
      this.detailContainer.add(abandonBtn);
    }
  }

  private createButton(
    label: string,
    x: number,
    y: number,
    color: number,
    callback: () => void
  ): Phaser.GameObjects.Container {
    const btnContainer = this.scene.add.container(x, y);

    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(color, 0.8);
    btnBg.fillRoundedRect(0, 0, 140, BUTTON_HEIGHT, 4);
    btnBg.lineStyle(1, 0xffffff);
    btnBg.strokeRoundedRect(0, 0, 140, BUTTON_HEIGHT, 4);
    btnContainer.add(btnBg);

    const btnText = this.scene.add.text(70, BUTTON_HEIGHT / 2, label, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#ffffff',
    }).setOrigin(0.5);
    btnContainer.add(btnText);

    const hitZone = this.scene.add.zone(70, BUTTON_HEIGHT / 2, 140, BUTTON_HEIGHT)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', callback);
    btnContainer.add(hitZone);

    return btnContainer;
  }

  private abandonQuest(questId: QuestId): void {
    NetworkManager.instance.send({
      type: ClientMessageType.AbandonQuest,
      questId,
    });
  }

  toggle(): void {
    this.visible = !this.visible;
    this.container.setVisible(this.visible);
    if (this.visible) {
      this.refresh();
    }
  }

  isOpen(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}
