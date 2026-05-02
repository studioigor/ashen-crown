import Phaser from 'phaser';
import { IEntity, newEntityId, HealthBar } from './Entity';
import { Side, BUILDING, BuildingKind, RACE_COLOR, TILE, UnitKind, UNIT, Race } from '../config';
import {
  BUILDING_ART_DISPLAY,
  buildingArtReady,
  buildingDamageKey,
  buildingDestructionKey,
  buildingSheetKey,
  getBuildingStageFrame,
  legacyBuildingStageKey
} from '../assets/artManifest';

export interface ProductionItem {
  kind: UnitKind;
  remaining: number;
  total: number;
}

type Stage = 'stage1' | 'stage2' | 'final';
type ArtStage = Stage | 'destroying' | 'ruin';

export class Building implements IEntity {
  readonly id = newEntityId();
  readonly kind = 'building' as const;
  readonly side: Side;
  readonly buildingKind: BuildingKind;
  readonly race: Race;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly damageOverlay: Phaser.GameObjects.Image;
  readonly sizeTiles: number;
  hp: number;
  maxHp: number;
  alive = true;
  sight: number;
  radius: number;
  tx: number;
  ty: number;

  completed = false;
  buildProgress = 0;
  buildTotal: number;

  queue: ProductionItem[] = [];
  rally: { x: number; y: number } | null = null;
  attack = 0;
  range = 0;
  cooldown = 0;
  lastAttack = 0;

  hb: HealthBar;
  flag: Phaser.GameObjects.Graphics;
  private chimneySmoke: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private constructionDust: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private damageSmoke: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private productionGlow: Phaser.GameObjects.Graphics;
  private currentStage: Stage = 'final';
  private flagPhase = Math.random() * Math.PI * 2;
  private lastFlagRedraw = 0;
  private lastGlowRedraw = 0;
  private glowActive = false;

  constructor(scene: Phaser.Scene, tx: number, ty: number, kind: BuildingKind, side: Side, race: Race, instant = false) {
    this.tx = tx; this.ty = ty;
    this.buildingKind = kind;
    this.side = side;
    this.race = race;
    const def = BUILDING[kind];
    this.sizeTiles = def.size;
    this.maxHp = def.hp;
    this.hp = instant ? def.hp : Math.max(1, Math.floor(def.hp * 0.1));
    this.sight = def.sight;
    this.attack = def.attack ?? 0;
    this.range = def.range ?? 0;
    this.cooldown = def.cooldown ?? 0;
    this.buildTotal = def.build;
    this.completed = instant;
    this.buildProgress = instant ? this.buildTotal : 0;
    const cx = tx * TILE + (this.sizeTiles * TILE) / 2;
    const cy = ty * TILE + (this.sizeTiles * TILE) / 2;

    this.currentStage = instant ? 'final' : 'stage1';
    const initialTexture = this.stageTexture(scene, this.currentStage);
    this.sprite = scene.add.sprite(cx, cy, initialTexture.key, initialTexture.frame);
    this.applyArtDisplaySize(scene);
    this.sprite.setDepth(20);
    this.sprite.setData('entity', this);
    this.radius = (this.sizeTiles * TILE) / 2;
    this.shadow = this.createContactShadow(scene, cx, cy);

    const damageKey = this.damageTextureKey(scene, false) ?? `building_${kind}_${race}_damaged`;
    this.damageOverlay = scene.add.image(cx, cy, damageKey);
    this.applyDamageDisplaySize(scene);
    this.damageOverlay.setDepth(21);
    this.damageOverlay.setAlpha(0);
    this.damageOverlay.setBlendMode(Phaser.BlendModes.MULTIPLY);

    this.flag = scene.add.graphics();
    this.flag.setDepth(22);
    this.drawFlag(0);

    this.productionGlow = scene.add.graphics();
    this.productionGlow.setDepth(19);

    this.hb = new HealthBar(scene, this, Math.max(this.sizeTiles * TILE * 0.8, this.sprite.displayWidth * 0.64));
    this.updateDepths();

    // Start construction dust emitter if under construction
    if (!instant) {
      const anyScene = scene as any;
      if (anyScene.effects?.fx?.continuousSmoke) {
        this.constructionDust = anyScene.effects.fx.continuousSmoke(cx, cy + this.visualRadius * 0.55, false);
      }
    } else {
      this.maybeStartChimney();
    }
  }

  private stageKey(stage: Stage): string {
    return legacyBuildingStageKey(this.buildingKind, this.race, stage);
  }

  private stageTexture(scene: Phaser.Scene, stage: ArtStage): { key: string; frame?: number } {
    if (buildingArtReady(scene, this.buildingKind, this.race)) {
      return { key: buildingSheetKey(this.buildingKind, this.race), frame: getBuildingStageFrame(stage) };
    }
    if (stage === 'destroying' || stage === 'ruin') return { key: this.stageKey('final') };
    return { key: this.stageKey(stage) };
  }

  private setStageTexture(stage: ArtStage): void {
    const tex = this.stageTexture(this.sprite.scene, stage);
    this.sprite.setTexture(tex.key, tex.frame);
    this.applyArtDisplaySize(this.sprite.scene);
  }

  private applyArtDisplaySize(scene: Phaser.Scene): void {
    if (!buildingArtReady(scene, this.buildingKind, this.race)) return;
    const display = BUILDING_ART_DISPLAY[this.buildingKind];
    this.sprite.setDisplaySize(display.width, display.height);
  }

  private applyDamageDisplaySize(scene: Phaser.Scene): void {
    if (!buildingArtReady(scene, this.buildingKind, this.race)) return;
    const display = BUILDING_ART_DISPLAY[this.buildingKind];
    this.damageOverlay.setDisplaySize(display.width, display.height);
  }

  private createContactShadow(scene: Phaser.Scene, cx: number, cy: number): Phaser.GameObjects.Ellipse {
    const display = buildingArtReady(scene, this.buildingKind, this.race)
      ? BUILDING_ART_DISPLAY[this.buildingKind]
      : { width: this.sizeTiles * TILE, height: this.sizeTiles * TILE };
    return scene.add.ellipse(
      cx,
      cy + display.height * 0.32,
      display.width * 0.78,
      display.height * 0.2,
      0x000000,
      0.3
    );
  }

  private damageTextureKey(scene: Phaser.Scene, heavy: boolean): string | null {
    const artHeavyKey = buildingDestructionKey(this.buildingKind, this.race);
    const artLightKey = buildingDamageKey(this.buildingKind, this.race);
    const legacyLightKey = `building_${this.buildingKind}_${this.race}_damaged`;
    if (heavy && scene.textures.exists(artHeavyKey)) return artHeavyKey;
    if (scene.textures.exists(artLightKey)) return artLightKey;
    if (scene.textures.exists(legacyLightKey)) return legacyLightKey;
    return null;
  }

  private updateDamageOverlay(): void {
    const hpFrac = Phaser.Math.Clamp(this.hp / this.maxHp, 0, 1);
    if (this.completed && hpFrac < 0.42) this.maybeStartDamageSmoke();
    else this.stopDamageSmoke();

    if (hpFrac >= 0.75) {
      this.damageOverlay.setAlpha(0);
      return;
    }

    const scene = this.sprite.scene;
    const desiredDamageKey = this.damageTextureKey(scene, hpFrac < 0.35);
    if (desiredDamageKey && this.damageOverlay.texture.key !== desiredDamageKey) {
      this.damageOverlay.setTexture(desiredDamageKey);
      this.applyDamageDisplaySize(scene);
    }
    this.damageOverlay.setAlpha(Phaser.Math.Clamp((0.75 - hpFrac) * 1.4, 0, 0.9));
  }

  private stopEmitters(): void {
    if (this.chimneySmoke) {
      this.chimneySmoke.stop();
      this.chimneySmoke = null;
    }
    if (this.constructionDust) {
      this.constructionDust.stop();
      this.constructionDust = null;
    }
    if (this.damageSmoke) {
      this.damageSmoke.stop();
      this.damageSmoke = null;
    }
  }

  private maybeStartChimney(): void {
    if (this.chimneySmoke) return;
    // Only buildings with chimneys/fires
    if (this.buildingKind !== 'townhall' && this.buildingKind !== 'workshop' && this.buildingKind !== 'barracks') return;
    const anyScene = this.sprite.scene as any;
    if (!anyScene.effects?.fx?.continuousSmoke) return;
    // Chimney location per building kind (offset relative to center)
    const r = this.visualRadius;
    let ox = 0, oy = -r + 10;
    if (this.buildingKind === 'workshop') { ox = r - 28; oy = -r + 8; }
    else if (this.buildingKind === 'townhall') { ox = -r + 34; oy = -r + 12; }
    else if (this.buildingKind === 'barracks') { ox = -r + 24; oy = -r + 14; }
    this.chimneySmoke = anyScene.effects.fx.continuousSmoke(this.sprite.x + ox, this.sprite.y + oy, false);
  }

  private maybeStartDamageSmoke(): void {
    if (this.damageSmoke) return;
    const anyScene = this.sprite.scene as any;
    if (!anyScene.effects?.fx?.continuousSmoke) return;
    const r = this.visualRadius;
    this.damageSmoke = anyScene.effects.fx.continuousSmoke(
      this.sprite.x + r * 0.12,
      this.sprite.y - r * 0.32,
      true
    );
  }

  private stopDamageSmoke(): void {
    if (!this.damageSmoke) return;
    this.damageSmoke.stop();
    this.damageSmoke = null;
  }

  private drawFlag(phase: number): void {
    this.flag.clear();
    if (!this.completed) return;
    const color = RACE_COLOR[this.race];
    const r = this.visualRadius;
    const x = this.sprite.x + r - 9;
    const y = this.sprite.y - r + 6;
    // Pole
    this.flag.lineStyle(1.5, 0x1a1410, 1);
    this.flag.beginPath();
    this.flag.moveTo(x, y);
    this.flag.lineTo(x, y + 14);
    this.flag.strokePath();
    // Finial ball
    this.flag.fillStyle(0xe4b04a, 1);
    this.flag.fillCircle(x, y - 0.5, 1.2);
    // Waving flag — animate tip
    const wave = Math.sin(phase) * 2;
    this.flag.fillStyle(color, 1);
    this.flag.beginPath();
    this.flag.moveTo(x, y + 0.5);
    this.flag.lineTo(x + 8 + wave, y + 3);
    this.flag.lineTo(x + 7 + wave, y + 5);
    this.flag.lineTo(x + 9 + wave, y + 6.5);
    this.flag.lineTo(x, y + 7.5);
    this.flag.closePath();
    this.flag.fillPath();
    // Dark fold shadow
    this.flag.fillStyle(0x000000, 0.3);
    this.flag.beginPath();
    this.flag.moveTo(x, y + 4);
    this.flag.lineTo(x + 8 + wave, y + 5.5);
    this.flag.lineTo(x, y + 7.5);
    this.flag.closePath();
    this.flag.fillPath();
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get visualRadius(): number { return Math.max(this.sprite.displayWidth, this.sprite.displayHeight) / 2; }

  setVisible(v: boolean): void {
    this.shadow.setVisible(v);
    this.sprite.setVisible(v);
    this.damageOverlay.setVisible(v);
    this.flag.setVisible(v);
    this.productionGlow.setVisible(v);
    // Fully pause emitters when off-screen — saves a lot of particles
    if (this.chimneySmoke) {
      if (v) this.chimneySmoke.start();
      else this.chimneySmoke.stop();
    }
    if (this.constructionDust) {
      if (v) this.constructionDust.start();
      else this.constructionDust.stop();
    }
    if (this.damageSmoke) {
      if (v) this.damageSmoke.start();
      else this.damageSmoke.stop();
    }
  }

  centerTile(): { tx: number; ty: number } {
    return { tx: this.tx + Math.floor(this.sizeTiles / 2), ty: this.ty + Math.floor(this.sizeTiles / 2) };
  }

  addBuildProgress(ms: number): boolean {
    if (this.completed) return false;
    this.buildProgress += ms;
    const ratio = Phaser.Math.Clamp(this.buildProgress / this.buildTotal, 0, 1);
    this.hp = Math.max(1, Math.floor(this.maxHp * (0.1 + 0.9 * ratio)));
    this.updateDamageOverlay();

    if (this.buildProgress >= this.buildTotal) {
      this.completed = true;
      this.hp = this.maxHp;
      this.currentStage = 'final';
      this.sprite.scene.tweens.killTweensOf(this.sprite);
      this.setStageTexture('final');
      this.sprite.setAlpha(1);
      this.updateDamageOverlay();
      this.stopEmitters();
      this.maybeStartChimney();
      this.drawFlag(this.flagPhase);
      this.hb.update(true);
      return true;
    }

    const nextStage: Stage = ratio < 0.5 ? 'stage1' : 'stage2';
    if (nextStage !== this.currentStage) {
      this.currentStage = nextStage;
      const scene = this.sprite.scene;
      scene.tweens.killTweensOf(this.sprite);
      this.sprite.setAlpha(1);
      scene.tweens.add({
        targets: this.sprite,
        alpha: { from: 1, to: 0.3 },
        duration: 120,
        yoyo: true,
        onYoyo: () => {
          if (!this.completed && this.currentStage === nextStage) this.setStageTexture(nextStage);
        }
      });
    }
    this.hb.update(true);
    return false;
  }

  tickProduction(dtMs: number): UnitKind | null {
    if (!this.completed) return null;
    if (this.queue.length === 0) return null;
    const cur = this.queue[0];
    cur.remaining -= dtMs;
    if (cur.remaining <= 0) {
      this.queue.shift();
      return cur.kind;
    }
    return null;
  }

  enqueue(kind: UnitKind): void {
    this.queue.push({ kind, remaining: UNIT[kind].build, total: UNIT[kind].build });
  }

  canAttack(): boolean { return this.completed && this.attack > 0 && this.range > 0; }

  progressFraction(): number {
    if (!this.completed) return this.buildProgress / this.buildTotal;
    if (this.queue.length === 0) return 0;
    const cur = this.queue[0];
    return 1 - cur.remaining / cur.total;
  }

  takeDamage(n: number): void {
    if (!this.alive) return;
    this.hp -= n;
    this.updateDamageOverlay();
    this.hb.update(true);
    if (this.hp <= 0) this.destroy();
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    const scene = this.sprite.scene;
    scene.tweens.killTweensOf(this.sprite);
    scene.tweens.killTweensOf(this.shadow);
    scene.tweens.killTweensOf(this.damageOverlay);
    if (buildingArtReady(scene, this.buildingKind, this.race)) {
      this.damageOverlay.setAlpha(0);
      this.setStageTexture('destroying');
      scene.time.delayedCall(180, () => {
        if (!this.sprite.active) return;
        this.setStageTexture('ruin');
        this.sprite.setAlpha(0.95);
        scene.tweens.add({
          targets: this.sprite,
          alpha: { from: 0.95, to: 0 },
          duration: 900,
          delay: 2600,
          ease: 'Cubic.easeIn',
          onComplete: () => {
            this.sprite.destroy();
            this.damageOverlay.destroy();
          }
        });
        scene.tweens.add({
          targets: this.shadow,
          alpha: 0,
          duration: 900,
          delay: 2600,
          ease: 'Cubic.easeIn',
          onComplete: () => this.shadow.destroy()
        });
      });
      this.flag.destroy();
      this.productionGlow.destroy();
      this.stopEmitters();
      this.hb.destroy();
      return;
    }
    // Settle-fade for visuals
    scene.tweens.add({
      targets: this.sprite,
      scaleY: { from: 1, to: 0.25 },
      y: this.sprite.y + this.visualRadius * 0.35,
      alpha: { from: 1, to: 0 },
      duration: 520,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.sprite.destroy();
        this.damageOverlay.destroy();
      }
    });
    scene.tweens.add({
      targets: this.shadow,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeIn',
      onComplete: () => this.shadow.destroy()
    });
    scene.tweens.add({
      targets: this.damageOverlay,
      alpha: { to: 0 },
      y: this.damageOverlay.y + this.visualRadius * 0.35,
      scaleY: 0.25,
      duration: 520,
      ease: 'Cubic.easeIn'
    });
    this.flag.destroy();
    this.productionGlow.destroy();
    this.stopEmitters();
    this.hb.destroy();
  }

  update(): void {
    this.hb.update();
    if (!this.alive) return;
    this.updateDepths();
    // Skip visual updates for buildings outside the explored viewport
    if (!this.sprite.visible) return;

    const now = this.sprite.scene.time.now;

    // Throttle flag redraw to ~8 fps (flag wave is slow; 60fps redraw is pointless)
    if (now - this.lastFlagRedraw > 120) {
      this.lastFlagRedraw = now;
      this.flagPhase += 0.25;
      this.drawFlag(this.flagPhase);
    }

    // Production glow: only redraw when training, and every ~80ms
    const training = this.completed && this.queue.length > 0;
    if (training) {
      if (now - this.lastGlowRedraw > 80) {
        this.lastGlowRedraw = now;
        this.productionGlow.clear();
        const frac = this.progressFraction();
        const pulse = 0.5 + Math.sin(now / 220) * 0.3;
        this.productionGlow.fillStyle(RACE_COLOR[this.race], 0.16 * pulse);
        const r = this.visualRadius;
        this.productionGlow.fillCircle(this.sprite.x, this.sprite.y, r * (0.76 + frac * 0.22));
        this.productionGlow.lineStyle(2, RACE_COLOR[this.race], 0.45 * pulse);
        this.productionGlow.strokeCircle(this.sprite.x, this.sprite.y, r + 4);
        this.glowActive = true;
      }
    } else if (this.glowActive) {
      this.productionGlow.clear();
      this.glowActive = false;
    }
  }

  private updateDepths(): void {
    const base = 20 + this.sprite.y / 10000;
    this.shadow.setDepth(base - 2);
    this.productionGlow.setDepth(base - 1);
    this.sprite.setDepth(base);
    this.damageOverlay.setDepth(base + 1);
    this.flag.setDepth(base + 2);
  }
}
