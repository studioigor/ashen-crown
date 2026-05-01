import Phaser from 'phaser';
import { CARAVAN_CONFIG, SIDE } from '../config';
import { HealthBar, IEntity, newEntityId } from './Entity';
import {
  CARAVAN_ART_DISPLAY,
  caravanAnimKey,
  caravanAnimReady,
  caravanArtReady,
  caravanSheetKey,
  getUnitFacingFromVector,
  type FutureUnitAnimState,
  type UnitFacing
} from '../assets/artManifest';

export type CaravanDespawnReason = 'route-complete' | 'destroyed';

export class Caravan implements IEntity {
  readonly id = newEntityId();
  readonly kind = 'caravan' as const;
  readonly side = SIDE.neutral;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly hb: HealthBar;

  hp = CARAVAN_CONFIG.hp;
  maxHp = CARAVAN_CONFIG.hp;
  alive = true;
  sight = CARAVAN_CONFIG.sight;
  radius = CARAVAN_CONFIG.radius;
  speed = CARAVAN_CONFIG.speed;
  routeComplete = false;
  killedBy: IEntity | null = null;

  private route: { x: number; y: number }[];
  private routeIndex = 1;
  private facing: UnitFacing = 'south';
  private currentAnim: FutureUnitAnimState | null = null;
  private usingArtSheet = false;
  private lastStepDust = 0;

  constructor(scene: Phaser.Scene, route: { x: number; y: number }[]) {
    this.route = route;
    const start = route[0];
    this.usingArtSheet = caravanArtReady(scene);
    const key = scene.textures.exists(caravanSheetKey('idle')) ? caravanSheetKey('idle') : 'px_debris_1';

    this.shadow = scene.add.image(start.x, start.y + 24, 'unit_shadow_xl')
      .setDepth(27)
      .setAlpha(0.82)
      .setDisplaySize(92, 24);

    this.sprite = scene.add.sprite(start.x, start.y, key, this.usingArtSheet ? 0 : undefined)
      .setDepth(30)
      .setOrigin(0.5, 0.62);
    if (this.usingArtSheet) this.sprite.setDisplaySize(CARAVAN_ART_DISPLAY.width, CARAVAN_ART_DISPLAY.height);
    else this.sprite.setScale(1.2);
    this.sprite.setData('entity', this);

    this.hb = new HealthBar(scene, this, 54);
    this.faceTowardNext();
    this.playAnimation('walk', true);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  set x(v: number) { this.sprite.x = v; }
  set y(v: number) { this.sprite.y = v; }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
    this.hb.setVisible(v);
  }

  update(dt: number): void {
    this.hb.update();
    if (!this.alive || this.routeComplete) return;

    const next = this.route[this.routeIndex];
    if (!next) {
      this.completeRoute();
      return;
    }

    const step = (this.speed * dt) / 1000;
    const dx = next.x - this.x;
    const dy = next.y - this.y;
    const d = Math.hypot(dx, dy);

    if (d <= step) {
      this.x = next.x;
      this.y = next.y;
      this.routeIndex++;
      this.faceTowardNext();
    } else {
      this.facing = getUnitFacingFromVector(dx, dy, this.facing);
      this.x += (dx / d) * step;
      this.y += (dy / d) * step;
    }

    this.playAnimation('walk');
    this.updateDepths();
    this.shadow.setPosition(this.x, this.y + 24);
    this.maybeStepDust();
  }

  takeDamage(amount: number, from?: IEntity): void {
    if (!this.alive) return;
    this.hp -= amount;
    this.killedBy = from ?? this.killedBy;
    this.hb.update(true);
    if (this.hp <= 0) this.die(from);
  }

  destroy(): void {
    this.completeRoute();
  }

  private die(from?: IEntity): void {
    if (!this.alive) return;
    this.alive = false;
    this.killedBy = from ?? this.killedBy;
    this.sprite.setData('entity', null);
    this.hb.destroy();
    const scene = this.sprite.scene;
    const deathKey = this.playAnimation('death', true);
    if (deathKey) {
      this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + deathKey, () => this.fadeOut());
    } else {
      scene.tweens.add({
        targets: this.sprite,
        scaleY: 0.36,
        rotation: (Math.random() - 0.5) * 0.65,
        duration: 180,
        ease: 'Sine.easeOut',
        onComplete: () => this.fadeOut()
      });
    }
    scene.tweens.add({
      targets: this.shadow,
      alpha: 0,
      duration: 520,
      delay: 180,
      ease: 'Cubic.easeIn'
    });
  }

  private completeRoute(): void {
    if (this.routeComplete) return;
    this.routeComplete = true;
    this.alive = false;
    this.sprite.setData('entity', null);
    this.hb.destroy();
    this.fadeOut(0, 260);
  }

  private fadeOut(delay = 900, duration = 420): void {
    const scene = this.sprite.scene;
    scene.tweens.add({
      targets: [this.sprite, this.shadow],
      alpha: 0,
      delay,
      duration,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.sprite.destroy();
        this.shadow.destroy();
      }
    });
  }

  private faceTowardNext(): void {
    const next = this.route[this.routeIndex];
    if (!next) return;
    this.facing = getUnitFacingFromVector(next.x - this.x, next.y - this.y, this.facing);
  }

  private playAnimation(anim: FutureUnitAnimState, restart = false): string | null {
    if (!this.usingArtSheet) return null;
    if (!caravanAnimReady(this.sprite.scene, anim)) return null;
    const key = caravanAnimKey(anim, this.facing);
    if (!this.sprite.scene.anims.exists(key)) return null;
    if (!restart && this.currentAnim === anim && this.sprite.anims.currentAnim?.key === key) return key;
    this.currentAnim = anim;
    this.sprite.play(key, restart);
    return key;
  }

  private updateDepths(): void {
    const base = 30 + this.y / 10000;
    this.shadow.setDepth(base - 3);
    this.sprite.setDepth(base);
  }

  private maybeStepDust(): void {
    if (!this.sprite.visible) return;
    const now = this.sprite.scene.time.now;
    if (now - this.lastStepDust < 260) return;
    this.lastStepDust = now;
    const anyScene = this.sprite.scene as any;
    if (anyScene.effects?.stepDust) anyScene.effects.stepDust(this.x, this.y + 20);
  }
}
