import Phaser from 'phaser';
import { VISUALS } from '../config';

/**
 * Pool of re-used particle emitters for combat VFX.
 * Each emitter is created once (in `create()` on GameScene) and burst via `explode()`.
 */
export class ParticleFX {
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private blood: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private dustBig: Phaser.GameObjects.Particles.ParticleEmitter;
  private flame: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeDark: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeLight: Phaser.GameObjects.Particles.ParticleEmitter;
  private debris: Phaser.GameObjects.Particles.ParticleEmitter;
  private goldSparkle: Phaser.GameObjects.Particles.ParticleEmitter;
  private woodChip: Phaser.GameObjects.Particles.ParticleEmitter;
  private leaves: Phaser.GameObjects.Particles.ParticleEmitter;
  private mist: Phaser.GameObjects.Particles.ParticleEmitter;
  private embers: Phaser.GameObjects.Particles.ParticleEmitter;
  private magic: Phaser.GameObjects.Particles.ParticleEmitter;
  private budgetWindowMs = 0;
  private budgetUsed = 0;

  constructor(private scene: Phaser.Scene) {
    this.sparks = this.createEmitter('px_spark', {
      speed: { min: 80, max: 220 },
      lifespan: 280,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 160,
      blendMode: Phaser.BlendModes.ADD,
      angle: { min: 0, max: 360 }
    });
    this.sparks.setDepth(220);

    this.blood = this.createEmitter('px_blood', {
      speed: { min: 60, max: 180 },
      lifespan: 500,
      scale: { start: 1, end: 0.2 },
      alpha: { start: 1, end: 0 },
      gravityY: 320,
      angle: { min: 0, max: 360 }
    });
    this.blood.setDepth(210);

    this.dust = this.createEmitter('px_dust', {
      speed: { min: 20, max: 70 },
      lifespan: 380,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.8, end: 0 },
      gravityY: -20,
      angle: { min: 0, max: 360 }
    });
    this.dust.setDepth(8);

    this.dustBig = this.createEmitter('px_dust', {
      speed: { min: 50, max: 160 },
      lifespan: 700,
      scale: { start: 1.3, end: 0 },
      alpha: { start: 0.85, end: 0 },
      gravityY: -30,
      angle: { min: 0, max: 360 }
    });
    this.dustBig.setDepth(200);

    this.flame = this.createEmitter('px_flame', {
      speed: { min: 40, max: 130 },
      lifespan: 500,
      scale: { start: 1, end: 0.2 },
      alpha: { start: 1, end: 0 },
      gravityY: -100,
      blendMode: Phaser.BlendModes.ADD,
      angle: { min: 240, max: 300 }
    });
    this.flame.setDepth(215);

    this.smokeDark = this.createEmitter('px_smoke_dark', {
      speed: { min: 20, max: 90 },
      lifespan: 1200,
      scale: { start: 0.8, end: 1.8 },
      alpha: { start: 0.8, end: 0 },
      gravityY: -60,
      angle: { min: 250, max: 290 }
    });
    this.smokeDark.setDepth(218);

    this.smokeLight = this.createEmitter('px_smoke_light', {
      speed: { min: 10, max: 40 },
      lifespan: 2200,
      scale: { start: 0.5, end: 1.4 },
      alpha: { start: 0.55, end: 0 },
      gravityY: -30,
      angle: { min: 250, max: 290 }
    });
    this.smokeLight.setDepth(40);

    // Debris uses three textures, pick randomly via "frame" — since they're separate keys, make 3 emitters chained.
    this.debris = this.createEmitter('px_debris_1', {
      speed: { min: 120, max: 280 },
      lifespan: 900,
      scale: { start: 1, end: 0.5 },
      alpha: { start: 1, end: 0 },
      gravityY: 480,
      rotate: { start: 0, end: 720 },
      angle: { min: 230, max: 310 }
    });
    this.debris.setDepth(219);

    this.goldSparkle = this.createEmitter('px_star', {
      speed: { min: 30, max: 90 },
      lifespan: 600,
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: 80,
      blendMode: Phaser.BlendModes.ADD,
      angle: { min: 230, max: 310 }
    });
    this.goldSparkle.setDepth(215);

    this.woodChip = this.createEmitter('px_debris_3', {
      speed: { min: 40, max: 120 },
      lifespan: 500,
      scale: { start: 0.7, end: 0.3 },
      alpha: { start: 1, end: 0 },
      gravityY: 300,
      rotate: { start: 0, end: 360 },
      angle: { min: 180, max: 360 }
    });
    this.woodChip.setDepth(210);

    this.leaves = this.createEmitter('px_leaf', {
      speed: { min: 8, max: 30 },
      lifespan: 4200,
      scale: { start: 1, end: 0.6 },
      alpha: { start: 0.75, end: 0 },
      gravityY: 8,
      rotate: { start: -60, end: 60 },
      angle: { min: 200, max: 340 }
    });
    this.leaves.setDepth(205);

    this.mist = this.createEmitter('px_mist', {
      speed: { min: 3, max: 12 },
      lifespan: 5000,
      scale: { start: 0.8, end: 1.6 },
      alpha: { start: 0.3, end: 0 },
      angle: { min: 0, max: 360 }
    });
    this.mist.setDepth(999);

    this.embers = this.createEmitter('px_ember', {
      speed: { min: 18, max: 70 },
      lifespan: 850,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      gravityY: -120,
      blendMode: Phaser.BlendModes.ADD,
      angle: { min: 225, max: 315 }
    });
    this.embers.setDepth(216);

    this.magic = this.createEmitter('px_rune', {
      speed: { min: 12, max: 46 },
      lifespan: 700,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.95, end: 0 },
      rotate: { start: -90, end: 90 },
      blendMode: Phaser.BlendModes.ADD,
      angle: { min: 0, max: 360 }
    });
    this.magic.setDepth(217);
  }

  private createEmitter(key: string, config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig): Phaser.GameObjects.Particles.ParticleEmitter {
    const emitter = this.scene.add.particles(0, 0, key, { ...config, emitting: false });
    return emitter;
  }

  private canSpend(count: number): boolean {
    return true; // Overhauled for MAXIMUM visual impact, bypass budget
  }

  // ---- public API ----

  // ---- public API ----

  meleeSparks(x: number, y: number): void {
    const n = Phaser.Math.Between(20, 35);
    if (this.canSpend(n)) this.sparks.explode(n, x, y);
  }

  bloodSplat(x: number, y: number, dirX = 0, dirY = -1): void {
    const n = Phaser.Math.Between(25, 45);
    if (!this.canSpend(n)) return;
    const ang = Math.atan2(dirY, dirX) * 180 / Math.PI;
    this.blood.setConfig({ angle: { min: ang - 70, max: ang + 70 }, scale: { start: 1.5, end: 0.2 } });
    this.blood.explode(n, x, y);
  }

  dustPuff(x: number, y: number, small = false): void {
    const n = small ? Phaser.Math.Between(8, 16) : Phaser.Math.Between(25, 45);
    if (this.canSpend(n)) (small ? this.dust : this.dustBig).explode(n, x, y);
  }

  stepDust(x: number, y: number): void {
    const n = Phaser.Math.Between(3, 7);
    if (this.canSpend(n)) this.dust.explode(n, x, y);
  }

  explosion(x: number, y: number): void {
    if (!this.canSpend(200)) return;
    this.flame.explode(70, x, y);
    this.embers.explode(50, x, y);
    this.smokeDark.explode(50, x, y);
    this.dustBig.explode(40, x, y);
    this.sparks.explode(45, x, y);
  }

  debrisBurst(x: number, y: number): void {
    if (this.canSpend(35)) this.debris.explode(35, x, y);
  }

  goldPop(x: number, y: number): void {
    const n = Phaser.Math.Between(15, 25);
    if (this.canSpend(n)) this.goldSparkle.explode(n, x, y);
  }

  lumberChips(x: number, y: number): void {
    const n = Phaser.Math.Between(12, 22);
    if (this.canSpend(n)) this.woodChip.explode(n, x, y);
  }

  /** Spawn a few ambient leaves at a viewport-drift position. */
  ambientLeaf(x: number, y: number): void {
    if (this.canSpend(2)) this.leaves.explode(2, x, y);
  }

  ambientMist(x: number, y: number): void {
    if (this.canSpend(2)) this.mist.explode(2, x, y);
  }

  emberBurst(x: number, y: number, count = 20): void {
    if (this.canSpend(count)) this.embers.explode(count, x, y);
  }

  magicBurst(x: number, y: number, count = 24): void {
    if (this.canSpend(count)) this.magic.explode(count, x, y);
  }

  /**
   * Creates a NEW persistent smoke emitter at (x, y). Caller owns lifecycle via stop().
   * Used for chimneys and construction dust — distinct emitters per building.
   */
  continuousSmoke(x: number, y: number, dark = false): Phaser.GameObjects.Particles.ParticleEmitter {
    const key = dark ? 'px_smoke_dark' : 'px_smoke_light';
    const e = this.scene.add.particles(x, y, key, {
      speed: { min: 8, max: 30 },
      lifespan: dark ? 1400 : 1800,
      scale: { start: 0.35, end: 1.2 },
      alpha: { start: dark ? 0.7 : 0.5, end: 0 },
      gravityY: -40,
      angle: { min: 250, max: 290 },
      frequency: dark ? 380 : 520,
      quantity: 1
    });
    e.setDepth(40);
    return e;
  }

  /** Stop a persistent emitter (chimney off). */
  stopEmitter(e: Phaser.GameObjects.Particles.ParticleEmitter): void {
    e.stop();
  }

  /** Attach an emitter that follows a sprite (for projectile trails). */
  trail(target: Phaser.GameObjects.GameObject, texture = 'px_smoke_light'): Phaser.GameObjects.Particles.ParticleEmitter {
    const e = this.scene.add.particles(0, 0, texture, {
      follow: target as any,
      frequency: 30,
      lifespan: 380,
      speed: { min: 5, max: 20 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.6, end: 0 },
      gravityY: -20
    });
    e.setDepth(39);
    return e;
  }
}
