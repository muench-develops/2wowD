import Phaser from 'phaser';

export interface TutorialStep {
  id: string;
  text: string;
  highlightPosition?: { x: number; y: number };
  completionEvent: string;
  arrowDirection: 'up' | 'down' | 'left' | 'right' | 'none';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'move',
    text: 'Use W, A, S, D to move your character around the world.',
    highlightPosition: { x: 640, y: 400 },
    completionEvent: 'tutorial:moved',
    arrowDirection: 'none',
  },
  {
    id: 'target',
    text: 'Click on a mob to select it as your target.',
    highlightPosition: { x: 640, y: 360 },
    completionEvent: 'tutorial:targeted',
    arrowDirection: 'none',
  },
  {
    id: 'attack',
    text: 'Press 1 to use your first ability and attack!',
    highlightPosition: { x: 560, y: 680 },
    completionEvent: 'tutorial:attacked',
    arrowDirection: 'up',
  },
  {
    id: 'inventory',
    text: 'Press B to open your inventory bag.',
    highlightPosition: { x: 1050, y: 400 },
    completionEvent: 'tutorial:inventory',
    arrowDirection: 'right',
  },
  {
    id: 'character',
    text: 'Press C to view your character stats.',
    highlightPosition: { x: 200, y: 400 },
    completionEvent: 'tutorial:character',
    arrowDirection: 'left',
  },
  {
    id: 'chat',
    text: 'Press Enter to open the chat and talk to other players.',
    highlightPosition: { x: 200, y: 650 },
    completionEvent: 'tutorial:chatted',
    arrowDirection: 'down',
  },
  {
    id: 'explore',
    text: 'Explore the world! Defeat mobs, collect loot, and grow stronger.',
    highlightPosition: { x: 640, y: 360 },
    completionEvent: 'tutorial:explored',
    arrowDirection: 'none',
  },
];

const STORAGE_KEY = 'isoheim_tutorial_complete';
const STEP_KEY = 'isoheim_tutorial_step';

export class GuideSystem {
  private scene: Phaser.Scene;
  private gameScene: Phaser.Scene;
  private currentStep = 0;
  private isComplete = false;
  private isVisible = false;

  // UI elements
  private overlay: Phaser.GameObjects.Graphics | null = null;
  private textBox: Phaser.GameObjects.Container | null = null;
  private arrow: Phaser.GameObjects.Graphics | null = null;
  private skipButton: Phaser.GameObjects.Text | null = null;
  private stepText: Phaser.GameObjects.Text | null = null;
  private progressText: Phaser.GameObjects.Text | null = null;

  constructor(hudScene: Phaser.Scene, gameScene: Phaser.Scene) {
    this.scene = hudScene;
    this.gameScene = gameScene;
    this.loadProgress();
  }

  start(): void {
    if (this.isComplete) return;
    this.isVisible = true;
    this.registerCompletionListeners();
    this.showStep();
  }

  private loadProgress(): void {
    try {
      this.isComplete = localStorage.getItem(STORAGE_KEY) === 'true';
      const savedStep = localStorage.getItem(STEP_KEY);
      if (savedStep) {
        this.currentStep = Math.min(parseInt(savedStep, 10), TUTORIAL_STEPS.length - 1);
      }
    } catch {
      // localStorage unavailable
    }
  }

  private saveProgress(): void {
    try {
      localStorage.setItem(STEP_KEY, String(this.currentStep));
    } catch {
      // ignore
    }
  }

  private markComplete(): void {
    this.isComplete = true;
    this.isVisible = false;
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
      localStorage.removeItem(STEP_KEY);
    } catch {
      // ignore
    }
    this.clearUI();
  }

  private registerCompletionListeners(): void {
    // Movement completion
    this.gameScene.events.on('requestStopMove', () => {
      if (this.getCurrentStepId() === 'move') this.advanceStep();
    });

    // Target completion
    this.gameScene.events.on('targetSelected', () => {
      if (this.getCurrentStepId() === 'target') this.advanceStep();
    });

    // Attack completion
    this.gameScene.events.on('abilityUsed', () => {
      if (this.getCurrentStepId() === 'attack') this.advanceStep();
    });

    // Inventory completion
    this.gameScene.events.on('toggleInventory', () => {
      if (this.getCurrentStepId() === 'inventory') this.advanceStep();
    });

    // Character panel
    this.gameScene.events.on('toggleCharacter', () => {
      if (this.getCurrentStepId() === 'character') this.advanceStep();
    });

    // Chat completion
    this.gameScene.events.on('toggleChat', () => {
      if (this.getCurrentStepId() === 'chat') this.advanceStep();
    });
  }

  private getCurrentStepId(): string {
    return TUTORIAL_STEPS[this.currentStep]?.id ?? '';
  }

  private advanceStep(): void {
    this.currentStep++;
    this.saveProgress();

    if (this.currentStep >= TUTORIAL_STEPS.length) {
      this.markComplete();
      return;
    }

    this.showStep();
  }

  private showStep(): void {
    this.clearUI();
    if (!this.isVisible || this.currentStep >= TUTORIAL_STEPS.length) return;

    const step = TUTORIAL_STEPS[this.currentStep];

    // Semi-transparent dark overlay (subtle, not blocking gameplay)
    this.overlay = this.scene.add.graphics();
    this.overlay.setDepth(900);

    // Text box at top center
    this.textBox = this.scene.add.container(640, 80);
    this.textBox.setDepth(950);

    const boxBg = this.scene.add.graphics();
    const boxW = 420;
    const boxH = 70;
    boxBg.fillStyle(0x1a1a2e, 0.92);
    boxBg.fillRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 10);
    boxBg.lineStyle(2, 0xe0c070);
    boxBg.strokeRoundedRect(-boxW / 2, -boxH / 2, boxW, boxH, 10);
    this.textBox.add(boxBg);

    // Step text
    this.stepText = this.scene.add.text(0, -10, step.text, {
      fontSize: '13px',
      fontFamily: 'monospace',
      color: '#ffffff',
      wordWrap: { width: boxW - 30 },
      align: 'center',
    }).setOrigin(0.5);
    this.textBox.add(this.stepText);

    // Progress indicator
    this.progressText = this.scene.add.text(0, 22, `Step ${this.currentStep + 1} of ${TUTORIAL_STEPS.length}`, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#a0a0c0',
    }).setOrigin(0.5);
    this.textBox.add(this.progressText);

    // Skip button
    this.skipButton = this.scene.add.text(boxW / 2 - 12, -boxH / 2 + 8, '✕', {
      fontSize: '16px',
      color: '#ff6666',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.skip());
    this.textBox.add(this.skipButton);

    // Arrow pointing at highlight position
    if (step.highlightPosition && step.arrowDirection !== 'none') {
      this.arrow = this.scene.add.graphics();
      this.arrow.setDepth(940);
      const hx = step.highlightPosition.x;
      const hy = step.highlightPosition.y;

      this.arrow.fillStyle(0xe0c070, 0.9);

      switch (step.arrowDirection) {
        case 'down':
          this.arrow.fillTriangle(hx - 10, hy - 30, hx + 10, hy - 30, hx, hy - 10);
          break;
        case 'up':
          this.arrow.fillTriangle(hx - 10, hy + 30, hx + 10, hy + 30, hx, hy + 10);
          break;
        case 'left':
          this.arrow.fillTriangle(hx + 30, hy - 10, hx + 30, hy + 10, hx + 10, hy);
          break;
        case 'right':
          this.arrow.fillTriangle(hx - 30, hy - 10, hx - 30, hy + 10, hx - 10, hy);
          break;
      }

      // Pulsing animation
      this.scene.tweens.add({
        targets: this.arrow,
        alpha: 0.4,
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }

    // Auto-advance explore step after 5 seconds
    if (step.id === 'explore') {
      this.scene.time.delayedCall(5000, () => {
        if (this.getCurrentStepId() === 'explore') {
          this.advanceStep();
        }
      });
    }
  }

  private skip(): void {
    this.markComplete();
  }

  private clearUI(): void {
    if (this.overlay) { this.overlay.destroy(); this.overlay = null; }
    if (this.textBox) { this.textBox.destroy(); this.textBox = null; }
    if (this.arrow) { this.arrow.destroy(); this.arrow = null; }
  }

  showCurrentTip(): void {
    if (this.isComplete) {
      this.currentStep = TUTORIAL_STEPS.length - 1;
      this.isComplete = false;
      this.isVisible = true;
      this.showStep();
    } else if (!this.isVisible) {
      this.isVisible = true;
      this.showStep();
    }
  }

  isActive(): boolean {
    return this.isVisible && !this.isComplete;
  }

  destroy(): void {
    this.clearUI();
  }
}
