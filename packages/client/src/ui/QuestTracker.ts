import Phaser from 'phaser';
import { type QuestId, type QuestObjective, QUEST_DEFINITIONS } from '@isoheim/shared';

const TRACKER_WIDTH = 250;
const TRACKER_X = 1280 - TRACKER_WIDTH - 16;
const TRACKER_Y = 120;
const PADDING = 8;

interface TrackedQuest {
  questId: QuestId;
  objectives: QuestObjective[];
  expanded: boolean;
}

export class QuestTracker {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private trackedQuests: Map<QuestId, TrackedQuest> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.create();
  }

  private create(): void {
    this.container = this.scene.add.container(TRACKER_X, TRACKER_Y);
    this.container.setDepth(1000);
  }

  updateQuest(questId: QuestId, objectives: QuestObjective[]): void {
    const existing = this.trackedQuests.get(questId);
    const expanded = existing ? existing.expanded : true;

    this.trackedQuests.set(questId, {
      questId,
      objectives,
      expanded,
    });

    this.refresh();
  }

  removeQuest(questId: QuestId): void {
    this.trackedQuests.delete(questId);
    this.refresh();
  }

  toggleQuestExpanded(questId: QuestId): void {
    const quest = this.trackedQuests.get(questId);
    if (quest) {
      quest.expanded = !quest.expanded;
      this.refresh();
    }
  }

  private refresh(): void {
    this.container.removeAll(true);

    if (this.trackedQuests.size === 0) return;

    let yOffset = 0;

    // Title
    const title = this.scene.add.text(0, yOffset, 'Quests', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#ffcc00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    });
    this.container.add(title);
    yOffset += 20;

    for (const quest of this.trackedQuests.values()) {
      yOffset = this.renderQuest(quest, yOffset);
      yOffset += 4;
    }
  }

  private renderQuest(quest: TrackedQuest, yOffset: number): number {
    const questDef = QUEST_DEFINITIONS[quest.questId];
    const questName = questDef ? questDef.name : quest.questId;

    // Quest name (clickable to expand/collapse)
    const expandIcon = quest.expanded ? '▼' : '▶';
    const nameText = this.scene.add.text(0, yOffset, `${expandIcon} ${questName}`, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 2,
    })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleQuestExpanded(quest.questId));
    this.container.add(nameText);
    yOffset += 16;

    if (quest.expanded) {
      for (const obj of quest.objectives) {
        const isComplete = obj.current >= obj.required;
        const color = isComplete ? '#44cc44' : '#aaaacc';
        const objText = this.scene.add.text(
          12,
          yOffset,
          `${obj.type} ${obj.target}: ${obj.current}/${obj.required}`,
          {
            fontSize: '10px',
            fontFamily: 'monospace',
            color,
            stroke: '#000000',
            strokeThickness: 2,
          }
        );
        this.container.add(objText);
        yOffset += 14;
      }
    }

    return yOffset;
  }

  destroy(): void {
    this.container.destroy();
  }
}
