import Phaser from 'phaser';
import { COLORS, FEEL, Side, SIDE, VISUALS } from '../config';
import { IEntity } from '../entities/Entity';
import { ParticleFX } from './ParticleFX';

type CommandKind = 'move' | 'attack' | 'build' | 'gather' | 'return' | 'rally';
type TrailKind = 'arrow' | 'siege' | 'magic';

export interface EffectsStats {
  floatingTexts: number;
  decals: number;
  pooledTexts: number;
  pooledImages: number;
}

export class EffectsSystem {
  readonly fx: ParticleFX;
  private hitPauseUntil = 0;
  private vignette: Phaser.GameObjects.Image | null = null;
  private decals: Phaser.GameObjects.Image[] = [];
  private floatingTexts = 0;
  private textPool: Phaser.GameObjects.Text[] = [];
  private imagePool: Phaser.GameObjects.Image[] = [];
  private ambientMs = 0;
  private readonly fxArtScale: number;

  constructor(private scene: Phaser.Scene) {
    this.fx = new ParticleFX(scene);
    this.fxArtScale = this.resolveTextureScale('px_spark', 16);
  }

  setupPostFX(): void {
    // Bloom disabled — expensive on low-end GPUs and caused overall darkening with vignette.
    // The warm warcraft feel now comes from sprite rim-lights and particle glows.
  }

  setupVignette(): void {
    if (this.vignette) return;
    const cam = this.scene.cameras.main;
    const w = cam.width, h = cam.height;
    const v = this.scene.add.image(w / 2, h / 2, 'vignette_overlay')
      .setScrollFactor(0)
      .setDepth(1500)
      .setAlpha(0.3);
    this.vignette = v;
  }

  getStats(): EffectsStats {
    return {
      floatingTexts: this.floatingTexts,
      decals: this.decals.length,
      pooledTexts: this.textPool.length,
      pooledImages: this.imagePool.length
    };
  }

  clickMarker(x: number, y: number, color: number, label?: string): void {
    this.commandMarker(x, y, color, 'move', label);
  }

  commandMarker(x: number, y: number, color: number, kind: CommandKind, label?: string): void {
    // Double expanding ring + arrow glyph
    const outer = this.scene.add.graphics();
    const radius = kind === 'attack' ? 22 : kind === 'build' ? 20 : 16;
    outer.lineStyle(kind === 'attack' ? 4 : 3, color, 0.88);
    if (kind === 'build') {
      outer.strokeRect(-radius, -radius, radius * 2, radius * 2);
    } else {
      outer.strokeCircle(0, 0, radius);
    }
    outer.setPosition(x, y).setDepth(220);
    this.scene.tweens.add({
      targets: outer,
      scale: { from: 0.4, to: 1.9 },
      alpha: { from: 1, to: 0 },
      duration: FEEL.commandPulseMs,
      ease: 'Cubic.easeOut',
      onComplete: () => outer.destroy()
    });

    const inner = this.scene.add.graphics();
    inner.lineStyle(2, color, 1);
    if (kind === 'attack') {
      inner.strokeCircle(0, 0, 12);
      inner.lineBetween(-22, 0, -7, 0);
      inner.lineBetween(22, 0, 7, 0);
      inner.lineBetween(0, -22, 0, -7);
      inner.lineBetween(0, 22, 0, 7);
      inner.lineStyle(1, 0xffffff, 0.75);
      inner.lineBetween(-10, -10, 10, 10);
      inner.lineBetween(10, -10, -10, 10);
    } else if (kind === 'gather' || kind === 'return') {
      inner.strokeCircle(0, 0, 10);
      inner.fillStyle(color, 0.9);
      inner.fillTriangle(0, -15, 8, -2, -8, -2);
      inner.fillTriangle(0, 15, 8, 2, -8, 2);
    } else if (kind === 'rally') {
      inner.lineBetween(0, -18, 0, 18);
      inner.fillTriangle(0, -18, 15, -12, 0, -6);
    } else {
      inner.strokeCircle(0, 0, 10);
      inner.lineBetween(-18, 0, -6, 0);
      inner.lineBetween(18, 0, 6, 0);
      inner.lineBetween(0, -18, 0, -6);
      inner.lineBetween(0, 18, 0, 6);
    }
    inner.strokePath();
    inner.setPosition(x, y).setDepth(221);
    this.scene.tweens.add({
      targets: inner,
      alpha: { from: 1, to: 0 },
      duration: 500,
      delay: 50,
      ease: 'Elastic.easeOut',
      easeParams: [1.2, 0.4],
      onComplete: () => inner.destroy()
    });

    if (label) this.floatText(x, y - 32, label, color, 800, -32);
    if (kind === 'attack') this.fx.emberBurst(x, y, 20);
    else if (kind === 'build' || kind === 'rally') this.fx.magicBurst(x, y, 20);
  }

  targetMarker(target: IEntity, color: number, label: string): void {
    const g = this.scene.add.graphics();
    g.lineStyle(3, color, 1);
    g.strokeCircle(0, 0, target.radius + 7);
    g.lineStyle(1.5, color, 0.6);
    g.strokeCircle(0, 0, target.radius + 12);
    g.setPosition(target.x, target.y).setDepth(220);
    this.scene.tweens.add({
      targets: g,
      scale: { from: 1.4, to: 0.85 },
      alpha: { from: 1, to: 0 },
      duration: 620,
      onComplete: () => g.destroy()
    });
    this.floatText(target.x, target.y - target.radius - 16, label, color, 760, -20);
  }

  damageText(x: number, y: number, amount: number, strong = false): void {
    if (!this.isInView(x, y)) return;
    this.floatText(x, y - 12, strong ? `-${amount}!` : `-${amount}`, strong ? 0xffd36a : 0xff7777, 620, -28, strong ? 18 : 14);
  }

  resourceText(x: number, y: number, text: string, type: 'gold' | 'lumber'): void {
    if (!this.isInView(x, y)) return;
    this.floatText(x, y - 8, text, type === 'gold' ? COLORS.goldMine : 0x8bd36a, 720, -30, 14);
  }

  statusText(x: number, y: number, text: string, color = 0xffffff): void {
    this.floatText(x, y, text, color, 800, -26, 13);
  }

  hitFlash(entity: IEntity): void {
    const sprite = entity.sprite;
    if (!sprite.active || !sprite.visible) return;
    sprite.setBlendMode(Phaser.BlendModes.ADD);
    sprite.setTint(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (!sprite.active) return;
      sprite.setBlendMode(Phaser.BlendModes.NORMAL);
      sprite.clearTint();
    });
  }

  deathPuff(x: number, y: number, side: Side): void {
    if (!this.isInView(x, y)) return;
    // Blood splash (living) + dust — we can't know here if it was a unit or building, caller decides
    const color = side === SIDE.player ? 0x9bd8ff : side === SIDE.ai ? 0xff9a88 : 0xb8d48c;
    this.fx.dustPuff(x, y, false);
    this.fx.bloodSplat(x, y, 0, -1);
    this.battlefieldDecal(x, y, side === SIDE.neutral ? 0x263018 : 0x3b0a0a, side === SIDE.neutral ? 'px_leaf' : 'px_blood', 0.8);
    // Keep existing sparkle burst as tinted accent
    this.burst(x, y, color, 6, 40, 360);
  }

  /** Melee contact — sparks + blood/chips + small shake + hit flash. */
  meleeImpact(x: number, y: number, targetIsBuilding: boolean, dirX = 0, dirY = -1): void {
    if (!this.isInView(x, y)) return;
    this.fx.meleeSparks(x, y);
    if (targetIsBuilding) {
      this.fx.dustPuff(x, y, true);
      this.fx.lumberChips(x, y);
      this.battlefieldDecal(x, y, 0x1a1410, 'px_crater', 0.55);
    } else {
      this.fx.bloodSplat(x, y, dirX, dirY);
      this.battlefieldDecal(x, y, 0x5a0a0a, 'px_blood', 0.65);
    }
    this.screenShake(120, 0.005);
    this.hitPause(30);
  }

  /** Projectile lands — small impact. */
  projectileImpact(x: number, y: number, targetIsBuilding: boolean, dirX = 0, dirY = -1): void {
    if (!this.isInView(x, y)) return;
    this.fx.meleeSparks(x, y);
    if (targetIsBuilding) {
      this.fx.dustPuff(x, y, true);
      this.battlefieldDecal(x, y, 0x1d1812, 'px_crater', 0.42);
    } else {
      this.fx.bloodSplat(x, y, dirX, dirY);
    }
    this.screenShake(100, 0.004);
  }

  /** Huge catapult explosion with shockwave + hit-pause. */
  explosion(x: number, y: number): void {
    if (!this.isInView(x, y, 160)) return;
    this.fx.explosion(x, y);
    this.fx.debrisBurst(x, y);
    this.shockwave(x, y, 0xffdc88);
    this.battlefieldDecal(x, y, 0x1a1410, 'px_crater', 1.35);
    this.screenShake(400, 0.025);
    this.hitPause(150);
  }

  /** Kicked up dust from a worker's step. */
  stepDust(x: number, y: number): void {
    if (!this.isInView(x, y, 80)) return;
    this.fx.stepDust(x, y);
  }

  /** Sparkle at resource gather position. */
  gatherSparkle(x: number, y: number, type: 'gold' | 'lumber'): void {
    this.gatherImpact(x, y, type);
  }

  gatherImpact(x: number, y: number, type: 'gold' | 'lumber'): void {
    if (!this.isInView(x, y)) return;
    if (type === 'gold') {
      this.fx.goldPop(x, y);
      this.fx.magicBurst(x, y, 3);
    } else {
      this.fx.lumberChips(x, y);
      this.fx.ambientLeaf(x, y);
    }
  }

  buildProgressPulse(x: number, y: number, radius: number): void {
    if (!this.isInView(x, y, radius + 80)) return;
    this.fx.dustPuff(x, y + radius * 0.45, true);
    if (Math.random() < 0.35) this.fx.emberBurst(x, y - radius * 0.25, 2);
  }

  buildingComplete(x: number, y: number, color: number): void {
    this.fx.dustPuff(x, y + 28, false);
    this.fx.magicBurst(x, y, 14);
    this.shockwave(x, y, color);
    this.floatText(x, y - 38, 'Готово', color, 900, -26, 15);
  }

  unitSpawn(x: number, y: number, color: number): void {
    if (!this.isInView(x, y)) return;
    this.fx.dustPuff(x, y + 8, true);
    this.fx.magicBurst(x, y, 7);
    this.commandMarker(x, y, color, 'rally');
  }

  projectileTrail(x: number, y: number, rotation: number, kind: TrailKind): void {
    if (!this.isInView(x, y, 80)) return;
    if (kind === 'siege') {
      this.fx.emberBurst(x, y, 1);
      if (Math.random() < 0.5) this.fx.dustPuff(x, y, true);
      return;
    }
    const key = kind === 'magic' ? 'px_rune' : 'px_arrow_trail';
    const img = this.acquireImage(key)
      .setPosition(x, y)
      .setDepth(39)
      .setRotation(rotation)
      .setBlendMode(kind === 'magic' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
      .setAlpha(kind === 'magic' ? 0.8 : 0.55)
      .setScale(this.fxArtScale);
    this.scene.tweens.add({
      targets: img,
      alpha: 0,
      scaleX: { from: (kind === 'magic' ? 1 : 0.8) * this.fxArtScale, to: 0.1 * this.fxArtScale },
      duration: kind === 'magic' ? 260 : 180,
      onComplete: () => this.releaseImage(img)
    });
  }

  ambientViewportTick(dt: number, view: Phaser.Geom.Rectangle): void {
    this.ambientMs += dt;
    if (this.ambientMs < VISUALS.ambientEveryMs) return;
    this.ambientMs = 0;
    if (Math.random() < VISUALS.ambientLeafChance) {
      this.fx.ambientLeaf(view.x + Math.random() * view.width, view.y + 20 + Math.random() * view.height * 0.45);
    }
    if (Math.random() < VISUALS.ambientMistChance) {
      this.fx.ambientMist(view.x + Math.random() * view.width, view.y + view.height * (0.55 + Math.random() * 0.35));
    }
  }

  /** Big destruction for buildings. */
  buildingDestroyed(x: number, y: number, color: number): void {
    if (!this.isInView(x, y, 180)) return;
    this.fx.explosion(x, y);
    this.fx.debrisBurst(x, y);
    this.fx.debrisBurst(x - 10, y + 6);
    this.fx.debrisBurst(x + 8, y - 4);
    this.shockwave(x, y, color);
    this.battlefieldDecal(x, y, 0x100b08, 'px_crater', 1.65);
    this.screenShake(500, 0.035);
    this.hitPause(200);
  }

  shockwave(x: number, y: number, color: number): void {
    if (!this.isInView(x, y, 180)) return;
    const g = this.acquireImage('px_shockwave').setDepth(225);
    g.setPosition(x, y).setScale(this.fxArtScale).setAlpha(1).clearTint();
    g.setBlendMode(Phaser.BlendModes.ADD);
    g.setTint(color);
    this.scene.tweens.add({
      targets: g,
      scale: { from: 0.2 * this.fxArtScale, to: 3.2 * this.fxArtScale },
      alpha: { from: 1, to: 0 },
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => this.releaseImage(g)
    });
  }

  alertPulse(x: number, y: number): void {
    const g = this.scene.add.graphics();
    g.lineStyle(4, COLORS.warning, 1);
    g.strokeCircle(0, 0, 34);
    g.setPosition(x, y).setDepth(240);
    this.scene.tweens.add({
      targets: g,
      scale: { from: 0.75, to: 2.4 },
      alpha: { from: 0.95, to: 0 },
      duration: 900,
      onComplete: () => g.destroy()
    });
  }

  battlefieldDecal(x: number, y: number, color: number, key: string, scale = 1): void {
    if (!this.scene.textures.exists(key)) return;
    if (!this.isInView(x, y, 120)) return;
    const decal = this.acquireImage(key).setPosition(
      x + Phaser.Math.Between(-5, 5),
      y + Phaser.Math.Between(-4, 4)
    )
      .setDepth(7)
      .setTint(color)
      .setAlpha(0.55)
      .setScale(scale * this.fxArtScale * (0.8 + Math.random() * 0.35))
      .setRotation(Math.random() * Math.PI * 2);
    this.decals.push(decal);
    while (this.decals.length > VISUALS.maxPersistentDecals) {
      const old = this.decals.shift();
      if (old) {
        this.scene.tweens.killTweensOf(old);
        this.releaseImage(old);
      }
    }
    this.scene.tweens.add({
      targets: decal,
      alpha: 0,
      delay: VISUALS.battleDecalFadeMs * 0.55,
      duration: VISUALS.battleDecalFadeMs * 0.45,
      onComplete: () => {
        const idx = this.decals.indexOf(decal);
        if (idx >= 0) this.decals.splice(idx, 1);
        this.releaseImage(decal);
      }
    });
  }

  /**
   * Freezes tweens briefly (hit-pause). Restores state after duration.
   */
  hitPause(durationMs: number): void {
    const now = this.scene.time.now;
    if (now < this.hitPauseUntil) return; // already paused, don't stack
    this.hitPauseUntil = now + durationMs;
    const prevTS = this.scene.tweens.timeScale;
    this.scene.tweens.timeScale = 0.05;
    this.scene.time.delayedCall(durationMs, () => {
      this.scene.tweens.timeScale = prevTS;
    });
  }

  /** Legacy API — still used by a few call sites. */
  impact(x: number, y: number, color = 0xffd36a, large = false): void {
    if (large) {
      this.explosion(x, y);
    } else {
      this.fx.meleeSparks(x, y);
      this.fx.magicBurst(x, y, 4);
      this.burst(x, y, color, 6, 40, 280);
    }
  }

  private screenShake(duration: number, intensity: number): void {
    this.scene.cameras.main.shake(duration, intensity * VISUALS.shakeScale);
  }

  private burst(x: number, y: number, color: number, count: number, radius: number, duration: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5);
      const dist = radius * (0.35 + Math.random() * 0.85);
      const size = 3 + Math.random() * 3;
      const dot = this.scene.add.circle(x, y, size, color, 0.95).setDepth(210);
      this.scene.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: { from: 1, to: 0 },
        scale: { from: 1, to: 0 },
        duration: duration * (0.8 + Math.random() * 0.4),
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy()
      });
    }
  }

  private floatText(x: number, y: number, text: string, color: number, duration: number, dy: number, size = 13): void {
    if (this.floatingTexts >= VISUALS.maxFloatingTexts) return;
    if (!this.isInView(x, y)) return;
    this.floatingTexts++;
    const t = this.acquireText(x, y, text, color, size);
    this.scene.tweens.add({
      targets: t,
      y: y + dy,
      alpha: { from: 1, to: 0 },
      duration,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.floatingTexts--;
        this.releaseText(t);
      }
    });
  }

  private acquireText(x: number, y: number, text: string, color: number, size: number): Phaser.GameObjects.Text {
    const t = this.textPool.pop() ?? this.scene.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    });
    this.scene.tweens.killTweensOf(t);
    t.setText(text);
    t.setStyle({
      fontFamily: 'monospace',
      fontSize: `${size}px`,
      color: Phaser.Display.Color.IntegerToColor(color).rgba,
      stroke: '#000000',
      strokeThickness: 3
    });
    t.setPosition(x, y).setOrigin(0.5).setDepth(230).setAlpha(1).setScale(1).setVisible(true).setActive(true);
    return t;
  }

  private releaseText(t: Phaser.GameObjects.Text): void {
    t.setVisible(false).setActive(false);
    if (this.textPool.length < VISUALS.maxFloatingTexts) this.textPool.push(t);
    else t.destroy();
  }

  private acquireImage(key: string): Phaser.GameObjects.Image {
    const img = this.imagePool.pop() ?? this.scene.add.image(0, 0, key);
    this.scene.tweens.killTweensOf(img);
    img.setTexture(key);
    img.clearTint();
    img.setBlendMode(Phaser.BlendModes.NORMAL);
    img.setVisible(true).setActive(true).setAlpha(1).setScale(1).setRotation(0);
    return img;
  }

  private resolveTextureScale(key: string, expectedWidth: number): number {
    const source = this.scene.textures.get(key).getSourceImage() as { width?: number };
    if (!source.width || source.width <= expectedWidth * 1.5) return 1;
    return expectedWidth / source.width;
  }

  private releaseImage(img: Phaser.GameObjects.Image): void {
    img.setVisible(false).setActive(false);
    if (this.imagePool.length < VISUALS.maxPersistentDecals + 48) this.imagePool.push(img);
    else img.destroy();
  }

  private isInView(x: number, y: number, margin = 120): boolean {
    const view = this.scene.cameras.main.worldView;
    return x >= view.x - margin
      && x <= view.right + margin
      && y >= view.y - margin
      && y <= view.bottom + margin;
  }
}
