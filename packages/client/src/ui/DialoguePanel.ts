import Phaser from 'phaser';
import {
  type NpcId,
  type QuestId,
  type QuestDef,
  type QuestObjective,
  NPC_DEFINITIONS,
  ClientMessageType,
} from '@isoheim/shared';
import { NetworkManager } from '../network/NetworkManager';

const PANEL_WIDTH = 500;
const PANEL_HEIGHT = 400;
const PADDING = 16;
const BUTTON_HEIGHT = 32;

export class DialoguePanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private visible = false;

  private npcNameText!: Phaser.GameObjects.Text;
  private dialogueText!: Phaser.GameObjects.Text;
  private contentContainer!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private maxScrollY = 0;

  private currentNpcId: NpcId | null = null;
  private availableQuests: QuestDef[] = [];
  private activeQuests: Array<{ questId: QuestId; objectives: QuestObjective[] }> = [];
  private completableQuests: QuestId[] = [];
  private selectedQuest: QuestDef | null = null;

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

    // NPC Name header
    this.npcNameText = this.scene.add.text(PADDING, PADDING, '', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#88ccff',
      fontStyle: 'bold',
    });
    this.container.add(this.npcNameText);

    // Close button
    const closeBtn = this.scene.add.text(PANEL_WIDTH - PADDING - 20, PADDING, 'X', {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#cc4444',
    })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close());
    this.container.add(closeBtn);

    // Scrollable content area
    const contentY = PADDING + 30;
    const contentHeight = PANEL_HEIGHT - contentY - PADDING;
    const maskShape = this.scene.make.graphics({});
    maskShape.fillRect(x + PADDING, y + contentY, PANEL_WIDTH - PADDING * 2, contentHeight);
    const mask = maskShape.createGeometryMask();

    this.contentContainer = this.scene.add.container(PADDING, contentY);
    this.contentContainer.setMask(mask);
    this.container.add(this.contentContainer);
  }

  show(
    npcId: NpcId,
    dialogue: string,
    availableQuests: QuestDef[],
    activeQuests: Array<{ questId: QuestId; objectives: QuestObjective[] }>,
    completableQuests: QuestId[]
  ): void {
    this.currentNpcId = npcId;
    this.availableQuests = availableQuests;
    this.activeQuests = activeQuests;
    this.completableQuests = completableQuests;
    this.selectedQuest = null;
    this.scrollY = 0;

    const npcDef = NPC_DEFINITIONS[npcId];
    this.npcNameText.setText(npcDef.name);

    this.renderContent(dialogue);

    this.visible = true;
    this.container.setVisible(true);
  }

  private renderContent(dialogue: string): void {
    this.contentContainer.removeAll(true);

    let yOffset = 0;

    // Dialogue text
    const dialogueTextObj = this.scene.add.text(0, yOffset, dialogue, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#cccccc',
      wordWrap: { width: PANEL_WIDTH - PADDING * 2 - 20 },
    });
    this.contentContainer.add(dialogueTextObj);
    yOffset += dialogueTextObj.height + 16;

    // Available Quests
    if (this.availableQuests.length > 0) {
      const header = this.scene.add.text(0, yOffset, '— Available Quests —', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#ffcc00',
      });
      this.contentContainer.add(header);
      yOffset += 20;

      for (const quest of this.availableQuests) {
        const questBtn = this.createQuestButton(quest, yOffset, 'available');
        this.contentContainer.add(questBtn);
        yOffset += 28;
      }
      yOffset += 8;
    }

    // Active Quests
    if (this.activeQuests.length > 0) {
      const header = this.scene.add.text(0, yOffset, '— Active Quests —', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#4488cc',
      });
      this.contentContainer.add(header);
      yOffset += 20;

      for (const activeQuest of this.activeQuests) {
        const questText = this.createActiveQuestDisplay(activeQuest, yOffset);
        this.contentContainer.add(questText);
        yOffset += questText.height + 8;
      }
      yOffset += 8;
    }

    // Completable Quests
    if (this.completableQuests.length > 0) {
      const header = this.scene.add.text(0, yOffset, '— Quest Ready to Turn In —', {
        fontSize: '13px',
        fontFamily: 'monospace',
        color: '#44cc44',
      });
      this.contentContainer.add(header);
      yOffset += 20;

      for (const questId of this.completableQuests) {
        const questBtn = this.createTurnInButton(questId, yOffset);
        this.contentContainer.add(questBtn);
        yOffset += 28;
      }
    }

    this.maxScrollY = Math.max(0, yOffset - (PANEL_HEIGHT - 100));
  }

  private createQuestButton(quest: QuestDef, yOffset: number, type: 'available'): Phaser.GameObjects.Container {
    const btnContainer = this.scene.add.container(0, yOffset);

    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(0x2a2a3e, 0.8);
    btnBg.fillRoundedRect(0, 0, PANEL_WIDTH - PADDING * 2 - 20, 24, 4);
    btnBg.lineStyle(1, 0xffcc00);
    btnBg.strokeRoundedRect(0, 0, PANEL_WIDTH - PADDING * 2 - 20, 24, 4);
    btnContainer.add(btnBg);

    const btnText = this.scene.add.text(8, 12, quest.name, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#ffcc00',
    }).setOrigin(0, 0.5);
    btnContainer.add(btnText);

    const hitZone = this.scene.add.zone(0, 0, PANEL_WIDTH - PADDING * 2 - 20, 24)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.showQuestDetails(quest));
    btnContainer.add(hitZone);

    return btnContainer;
  }

  private createActiveQuestDisplay(
    activeQuest: { questId: QuestId; objectives: QuestObjective[] },
    yOffset: number
  ): Phaser.GameObjects.Text {
    let text = `${activeQuest.questId}:\n`;
    for (const obj of activeQuest.objectives) {
      const progress = `${obj.current}/${obj.required}`;
      text += `  • ${obj.type} ${obj.target}: ${progress}\n`;
    }
    const questText = this.scene.add.text(8, yOffset, text, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#aaaacc',
    });
    return questText;
  }

  private createTurnInButton(questId: QuestId, yOffset: number): Phaser.GameObjects.Container {
    const btnContainer = this.scene.add.container(0, yOffset);

    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(0x2a4a2e, 0.8);
    btnBg.fillRoundedRect(0, 0, PANEL_WIDTH - PADDING * 2 - 20, 24, 4);
    btnBg.lineStyle(1, 0x44cc44);
    btnBg.strokeRoundedRect(0, 0, PANEL_WIDTH - PADDING * 2 - 20, 24, 4);
    btnContainer.add(btnBg);

    const btnText = this.scene.add.text(8, 12, `${questId} [COMPLETE]`, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#44cc44',
    }).setOrigin(0, 0.5);
    btnContainer.add(btnText);

    const hitZone = this.scene.add.zone(0, 0, PANEL_WIDTH - PADDING * 2 - 20, 24)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.turnInQuest(questId));
    btnContainer.add(hitZone);

    return btnContainer;
  }

  private showQuestDetails(quest: QuestDef): void {
    this.selectedQuest = quest;
    this.contentContainer.removeAll(true);

    let yOffset = 0;

    // Quest name
    const nameText = this.scene.add.text(0, yOffset, quest.name, {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffcc00',
      fontStyle: 'bold',
    });
    this.contentContainer.add(nameText);
    yOffset += 24;

    // Quest description
    const descText = this.scene.add.text(0, yOffset, quest.description, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#cccccc',
      wordWrap: { width: PANEL_WIDTH - PADDING * 2 - 20 },
    });
    this.contentContainer.add(descText);
    yOffset += descText.height + 16;

    // Objectives
    const objHeader = this.scene.add.text(0, yOffset, 'Objectives:', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#aaaacc',
    });
    this.contentContainer.add(objHeader);
    yOffset += 20;

    for (const obj of quest.objectives) {
      const objText = this.scene.add.text(8, yOffset, `• ${obj.type} ${obj.target}: 0/${obj.required}`, {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#aaaacc',
      });
      this.contentContainer.add(objText);
      yOffset += 18;
    }
    yOffset += 8;

    // Rewards
    const rewardHeader = this.scene.add.text(0, yOffset, 'Rewards:', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#aaaacc',
    });
    this.contentContainer.add(rewardHeader);
    yOffset += 20;

    const rewardText = this.scene.add.text(
      8,
      yOffset,
      `• ${quest.rewards.xp} XP\n• ${quest.rewards.gold} Gold`,
      {
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#ccaa44',
      }
    );
    this.contentContainer.add(rewardText);
    yOffset += rewardText.height + 16;

    // Buttons
    const acceptBtn = this.createButton('Accept Quest', 0, yOffset, 0x44cc44, () => this.acceptQuest());
    this.contentContainer.add(acceptBtn);

    const backBtn = this.createButton('Back', 150, yOffset, 0x4a4a6a, () => {
      this.selectedQuest = null;
      this.renderContent(NPC_DEFINITIONS[this.currentNpcId!].dialogue.greeting);
    });
    this.contentContainer.add(backBtn);
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
      fontSize: '12px',
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

  private acceptQuest(): void {
    if (!this.selectedQuest) return;

    NetworkManager.instance.send({
      type: ClientMessageType.AcceptQuest,
      questId: this.selectedQuest.id,
    });

    this.close();
  }

  private turnInQuest(questId: QuestId): void {
    NetworkManager.instance.send({
      type: ClientMessageType.TurnInQuest,
      questId,
    });

    this.close();
  }

  close(): void {
    this.visible = false;
    this.container.setVisible(false);
    this.selectedQuest = null;
    this.currentNpcId = null;
  }

  isOpen(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.container.destroy();
  }
}
