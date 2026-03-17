import Phaser from 'phaser';

const VFX_DEPTH = 9000;

/**
 * Singleton that plays procedural ability visual effects.
 * All textures are generated via Phaser Graphics + Tweens — no external assets.
 */
export class VFXManager {
  private static _instance: VFXManager;
  private scene!: Phaser.Scene;

  static get instance(): VFXManager {
    if (!VFXManager._instance) {
      VFXManager._instance = new VFXManager();
    }
    return VFXManager._instance;
  }

  private constructor() {}

  /** Bind to the active GameScene. Call once from GameScene.create(). */
  init(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  /**
   * Play a visual effect for an ability cast.
   * All positions are in **screen** (pixel) space.
   */
  playAbilityEffect(
    abilityId: string,
    casterX: number,
    casterY: number,
    targetX?: number,
    targetY?: number,
  ): void {
    if (!this.scene) return;

    const tx = targetX ?? casterX;
    const ty = targetY ?? casterY;

    switch (abilityId) {
      // ── Warrior ───────────────────────────────────────────────
      case 'warrior-charge':
        this.playCharge(casterX, casterY, tx, ty);
        break;
      case 'warrior-shield-block':
        this.playShieldBlock(casterX, casterY);
        break;
      case 'warrior-whirlwind':
        this.playWhirlwind(casterX, casterY);
        break;

      // ── Mage ──────────────────────────────────────────────────
      case 'mage-fireball':
        this.playProjectile(casterX, casterY, tx, ty, 0xff6622, 0xffaa44);
        break;
      case 'mage-frost-bolt':
        this.playProjectile(casterX, casterY, tx, ty, 0x44aaff, 0x88ddff);
        break;
      case 'mage-blizzard':
        this.playBlizzard(casterX, casterY);
        break;

      // ── Rogue ─────────────────────────────────────────────────
      case 'rogue-backstab':
        this.playBackstab(casterX, casterY, tx, ty);
        break;
      case 'rogue-eviscerate':
        this.playEviscerate(tx, ty);
        break;
      case 'rogue-vanish':
        this.playVanish(casterX, casterY);
        break;

      // ── Priest ────────────────────────────────────────────────
      case 'priest-heal':
        this.playHeal(tx, ty);
        break;
      case 'priest-smite':
        this.playSmite(tx, ty);
        break;
      case 'priest-shield':
        this.playPWShield(tx, ty);
        break;

      default:
        // Unknown ability — silently ignore
        break;
    }
  }

  // ====================================================================
  // Warrior Effects
  // ====================================================================

  /** Charge: bright streak from caster to target */
  private playCharge(cx: number, cy: number, tx: number, ty: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(VFX_DEPTH);

    const dx = tx - cx;
    const dy = ty - cy;
    const angle = Math.atan2(dy, dx);
    const len = Math.sqrt(dx * dx + dy * dy);

    // Draw a tapered line (charge trail)
    g.lineStyle(4, 0xffdd44, 1);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(tx, ty);
    g.strokePath();

    // Slash arc at target
    const slash = this.scene.add.graphics();
    slash.setDepth(VFX_DEPTH);
    slash.lineStyle(3, 0xffffff, 1);
    slash.beginPath();
    slash.arc(tx, ty, 14, angle - 0.8, angle + 0.8, false);
    slash.strokePath();

    this.scene.tweens.add({
      targets: [g, slash],
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        g.destroy();
        slash.destroy();
      },
    });
  }

  /** Shield Block: expanding golden ring around caster */
  private playShieldBlock(cx: number, cy: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(VFX_DEPTH);

    const ring = { radius: 8, alpha: 1 };

    this.scene.tweens.add({
      targets: ring,
      radius: 30,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        g.clear();
        g.lineStyle(3, 0xffcc33, ring.alpha);
        g.strokeCircle(cx, cy, ring.radius);
        g.lineStyle(1, 0xffffff, ring.alpha * 0.5);
        g.strokeCircle(cx, cy, ring.radius * 0.7);
      },
      onComplete: () => g.destroy(),
    });
  }

  /** Whirlwind: spinning slash arcs around caster */
  private playWhirlwind(cx: number, cy: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(VFX_DEPTH);

    const state = { angle: 0, radius: 12, alpha: 1 };
    const segments = 4;

    this.scene.tweens.add({
      targets: state,
      angle: Math.PI * 2,
      radius: 32,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        g.clear();
        for (let i = 0; i < segments; i++) {
          const a = state.angle + (i * Math.PI * 2) / segments;
          g.lineStyle(3, 0xffffff, state.alpha);
          g.beginPath();
          g.arc(cx, cy, state.radius, a, a + 0.6, false);
          g.strokePath();
        }
      },
      onComplete: () => g.destroy(),
    });
  }

  // ====================================================================
  // Mage Effects
  // ====================================================================

  /** Fireball / Frost Bolt: projectile with trailing particles, burst on impact */
  private playProjectile(
    cx: number,
    cy: number,
    tx: number,
    ty: number,
    color: number,
    trailColor: number,
  ): void {
    const projectile = this.scene.add.graphics();
    projectile.setDepth(VFX_DEPTH);
    projectile.fillStyle(color, 1);
    projectile.fillCircle(0, 0, 5);
    projectile.lineStyle(1, 0xffffff, 0.6);
    projectile.strokeCircle(0, 0, 5);
    projectile.setPosition(cx, cy);

    const dx = tx - cx;
    const dy = ty - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Math.max(200, (dist / 300) * 400);

    // Trail particles spawned during flight
    const trailTimer = this.scene.time.addEvent({
      delay: 40,
      repeat: Math.floor(duration / 40),
      callback: () => {
        this.spawnParticle(projectile.x, projectile.y, trailColor, 3, 200);
      },
    });

    this.scene.tweens.add({
      targets: projectile,
      x: tx,
      y: ty,
      duration,
      ease: 'Linear',
      onComplete: () => {
        projectile.destroy();
        trailTimer.destroy();
        // Impact burst
        this.burstParticles(tx, ty, color, 10, 18, 350);
      },
    });
  }

  /** Blizzard: expanding blue/purple ring + scattered ice particles */
  private playBlizzard(cx: number, cy: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(VFX_DEPTH);

    const ring = { radius: 6, alpha: 1 };

    this.scene.tweens.add({
      targets: ring,
      radius: 48,
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        g.clear();
        g.lineStyle(3, 0x6688ff, ring.alpha);
        g.strokeCircle(cx, cy, ring.radius);
      },
      onComplete: () => g.destroy(),
    });

    // Scatter ice particles
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 36;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      this.scene.time.delayedCall(Math.random() * 300, () => {
        this.spawnParticle(px, py, 0x88ccff, 3, 400 + Math.random() * 200);
      });
    }
  }

  // ====================================================================
  // Rogue Effects
  // ====================================================================

  /** Backstab: dark dash streak + slash marks at target */
  private playBackstab(cx: number, cy: number, tx: number, ty: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(VFX_DEPTH);

    g.lineStyle(5, 0x333344, 0.7);
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(tx, ty);
    g.strokePath();

    // Slash marks at target
    const slash = this.scene.add.graphics();
    slash.setDepth(VFX_DEPTH);
    slash.lineStyle(2, 0xffcccc, 1);
    slash.beginPath();
    slash.moveTo(tx - 8, ty - 10);
    slash.lineTo(tx + 8, ty + 2);
    slash.moveTo(tx + 6, ty - 8);
    slash.lineTo(tx - 6, ty + 4);
    slash.strokePath();

    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 200,
      onComplete: () => g.destroy(),
    });
    this.scene.tweens.add({
      targets: slash,
      alpha: 0,
      duration: 250,
      delay: 50,
      onComplete: () => slash.destroy(),
    });
  }

  /** Eviscerate: 3 quick red slash lines in sequence */
  private playEviscerate(tx: number, ty: number): void {
    const slashData = [
      { x1: -10, y1: -8, x2: 10, y2: 4 },
      { x1: 8, y1: -10, x2: -8, y2: 6 },
      { x1: -6, y1: 2, x2: 10, y2: -6 },
    ];

    slashData.forEach((s, i) => {
      this.scene.time.delayedCall(i * 50, () => {
        const g = this.scene.add.graphics();
        g.setDepth(VFX_DEPTH);
        g.lineStyle(3, 0xff4444, 1);
        g.beginPath();
        g.moveTo(tx + s.x1, ty + s.y1);
        g.lineTo(tx + s.x2, ty + s.y2);
        g.strokePath();

        this.scene.tweens.add({
          targets: g,
          alpha: 0,
          duration: 200,
          onComplete: () => g.destroy(),
        });
      });
    });
  }

  /** Vanish: gray smoke puff (expanding particles) */
  private playVanish(cx: number, cy: number): void {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 20 + Math.random() * 30;
      const ex = cx + Math.cos(angle) * speed;
      const ey = cy + Math.sin(angle) * speed;

      const g = this.scene.add.graphics();
      g.setDepth(VFX_DEPTH);
      const size = 2 + Math.random() * 3;
      const gray = 0x80 + Math.floor(Math.random() * 0x40);
      const col = (gray << 16) | (gray << 8) | gray;
      g.fillStyle(col, 0.7);
      g.fillCircle(0, 0, size);
      g.setPosition(cx, cy);

      this.scene.tweens.add({
        targets: g,
        x: ex,
        y: ey,
        alpha: 0,
        duration: 400 + Math.random() * 200,
        ease: 'Cubic.easeOut',
        onComplete: () => g.destroy(),
      });
    }
  }

  // ====================================================================
  // Priest Effects
  // ====================================================================

  /** Heal: green/golden particles rising upward */
  private playHeal(tx: number, ty: number): void {
    for (let i = 0; i < 10; i++) {
      const ox = (Math.random() - 0.5) * 20;
      const startY = ty + 4;
      const delay = Math.random() * 200;

      this.scene.time.delayedCall(delay, () => {
        const g = this.scene.add.graphics();
        g.setDepth(VFX_DEPTH);
        const isGold = Math.random() > 0.5;
        g.fillStyle(isGold ? 0xffdd44 : 0x44ff88, 0.9);
        g.fillCircle(0, 0, 2 + Math.random() * 2);
        g.setPosition(tx + ox, startY);

        this.scene.tweens.add({
          targets: g,
          y: startY - 30 - Math.random() * 20,
          alpha: 0,
          duration: 600 + Math.random() * 300,
          ease: 'Cubic.easeOut',
          onComplete: () => g.destroy(),
        });
      });
    }
  }

  /** Smite: vertical light beam dropping from above */
  private playSmite(tx: number, ty: number): void {
    const beam = this.scene.add.graphics();
    beam.setDepth(VFX_DEPTH);

    const topY = ty - 120;
    beam.lineStyle(4, 0xffffaa, 0.9);
    beam.beginPath();
    beam.moveTo(tx, topY);
    beam.lineTo(tx, ty);
    beam.strokePath();

    // Wider glow line
    beam.lineStyle(10, 0xffff88, 0.3);
    beam.beginPath();
    beam.moveTo(tx, topY);
    beam.lineTo(tx, ty);
    beam.strokePath();

    // Flash at impact
    const flash = this.scene.add.graphics();
    flash.setDepth(VFX_DEPTH);
    flash.fillStyle(0xffffff, 0.8);
    flash.fillCircle(tx, ty, 12);

    this.scene.tweens.add({
      targets: beam,
      alpha: 0,
      duration: 350,
      ease: 'Power2',
      onComplete: () => beam.destroy(),
    });
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 250,
      onComplete: () => flash.destroy(),
    });
  }

  /** Power Word: Shield: translucent bubble that pulses */
  private playPWShield(tx: number, ty: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(VFX_DEPTH);

    const state = { radius: 4, alpha: 0.6, phase: 0 };

    // Expand phase
    this.scene.tweens.add({
      targets: state,
      radius: 18,
      duration: 200,
      ease: 'Back.easeOut',
      onUpdate: () => {
        g.clear();
        g.lineStyle(2, 0xffdd44, state.alpha);
        g.strokeCircle(tx, ty, state.radius);
        g.fillStyle(0xffdd44, state.alpha * 0.15);
        g.fillCircle(tx, ty, state.radius);
      },
      onComplete: () => {
        // Pulse phase
        this.scene.tweens.add({
          targets: state,
          alpha: 0.3,
          duration: 250,
          yoyo: true,
          repeat: 1,
          onUpdate: () => {
            g.clear();
            g.lineStyle(2, 0xffdd44, state.alpha);
            g.strokeCircle(tx, ty, state.radius);
            g.fillStyle(0xffdd44, state.alpha * 0.15);
            g.fillCircle(tx, ty, state.radius);
          },
          onComplete: () => {
            // Fade out
            this.scene.tweens.add({
              targets: g,
              alpha: 0,
              duration: 200,
              onComplete: () => g.destroy(),
            });
          },
        });
      },
    });
  }

  // ====================================================================
  // Shared helpers
  // ====================================================================

  /** Spawn a single fading particle (small filled circle) */
  private spawnParticle(x: number, y: number, color: number, size: number, lifeMs: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(VFX_DEPTH);
    g.fillStyle(color, 0.8);
    g.fillCircle(0, 0, size);
    g.setPosition(x, y);

    const ox = (Math.random() - 0.5) * 8;
    const oy = (Math.random() - 0.5) * 8;

    this.scene.tweens.add({
      targets: g,
      x: x + ox,
      y: y + oy,
      alpha: 0,
      duration: lifeMs,
      ease: 'Cubic.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  /** Burst N particles outward from a point */
  private burstParticles(
    x: number,
    y: number,
    color: number,
    count: number,
    spread: number,
    lifeMs: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * spread;
      const ex = x + Math.cos(a) * r;
      const ey = y + Math.sin(a) * r;
      const size = 1.5 + Math.random() * 2;

      const g = this.scene.add.graphics();
      g.setDepth(VFX_DEPTH);
      g.fillStyle(color, 0.9);
      g.fillCircle(0, 0, size);
      g.setPosition(x, y);

      this.scene.tweens.add({
        targets: g,
        x: ex,
        y: ey,
        alpha: 0,
        duration: lifeMs,
        ease: 'Cubic.easeOut',
        onComplete: () => g.destroy(),
      });
    }
  }

  // ====================================================================
  // Mob-specific Effects
  // ====================================================================

  /** Skeleton Mage projectile: purple bolt */
  playSkeletonMageProjectile(casterX: number, casterY: number, targetX: number, targetY: number): void {
    this.playProjectile(casterX, casterY, targetX, targetY, 0x9966ff, 0xccaaff);
  }

  /** Bone Lord aura: pulsing red energy field */
  playBoneLordAura(centerX: number, centerY: number): void {
    const g = this.scene.add.graphics();
    g.setDepth(VFX_DEPTH);

    const state = { radius: 40, alpha: 0.6 };
    this.scene.tweens.add({
      targets: state,
      radius: 60,
      alpha: 0.2,
      duration: 1500,
      yoyo: true,
      repeat: 2,
      onUpdate: () => {
        g.clear();
        g.lineStyle(3, 0xff0000, state.alpha);
        g.strokeCircle(centerX, centerY, state.radius);
        g.fillStyle(0xff0000, state.alpha * 0.1);
        g.fillCircle(centerX, centerY, state.radius);
      },
      onComplete: () => {
        this.scene.tweens.add({
          targets: g,
          alpha: 0,
          duration: 300,
          onComplete: () => g.destroy(),
        });
      },
    });
  }
}
