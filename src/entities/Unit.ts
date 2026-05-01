import Phaser from 'phaser';
import { IEntity, newEntityId, HealthBar } from './Entity';
import { Side, UNIT, UnitKind, Race, VISUALS } from '../config';
import { Building } from './Building';
import { ResourceNode, ResourceType } from './ResourceNode';
import {
  UNIT_ART_DISPLAY,
  getUnitFacingFromVector,
  type UnitAnimState,
  type UnitFacing,
  unitAnimKey,
  unitAnimReady,
  unitArtReady,
  unitSheetKey
} from '../assets/artManifest';

export type UnitState =
  | 'idle'
  | 'move'
  | 'attack_move'
  | 'attack'
  | 'gather'
  | 'return_cargo'
  | 'build'
  | 'dead';

type WeaponRig = {
  ox: number;   // offset from unit center x (unflipped)
  oy: number;   // offset from unit center y
  originX: number;
  originY: number;
  baseRot: number;  // base rotation when idle
};

const WEAPON_RIG: Record<UnitKind, WeaponRig> = {
  worker:   { ox: 8,  oy: -2, originX: 0.1, originY: 0.9, baseRot: -0.5 },
  footman:  { ox: 9,  oy: 1,  originX: 0.1, originY: 0.85, baseRot: -0.25 },
  archer:   { ox: -2, oy: 0,  originX: 0.5, originY: 0.5,  baseRot: 0 },
  knight:   { ox: 10, oy: -8, originX: 0.05, originY: 0.5, baseRot: 0.1 },
  catapult: { ox: 0,  oy: 0,  originX: 0.5, originY: 0.5,  baseRot: 0 }
};

const SHADOW_KEY: Record<UnitKind, string> = {
  worker: 'unit_shadow_s',
  footman: 'unit_shadow_m',
  archer: 'unit_shadow_s',
  knight: 'unit_shadow_l',
  catapult: 'unit_shadow_xl'
};

const BODY_HEIGHT: Record<UnitKind, number> = {
  worker: 40, footman: 44, archer: 44, knight: 52, catapult: 48
};

const UNIT_ART_FRAME_SIZE = 128;

export class Unit implements IEntity {
  readonly id = newEntityId();
  readonly kind = 'unit' as const;
  readonly unitKind: UnitKind;
  readonly side: Side;
  readonly race: Race;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  readonly weapon: Phaser.GameObjects.Image | null;
  private cargoBadge: Phaser.GameObjects.Image | null = null;

  hp: number;
  maxHp: number;
  alive = true;
  sight: number;
  radius: number;
  speed: number;
  atk: number;
  range: number;
  cooldown: number;
  lastAttack = 0;
  food: number;

  state: UnitState = 'idle';
  path: { x: number; y: number }[] = [];
  pathRepathMs = 0;
  pathDest: { x: number; y: number } | null = null;
  attackMoveTo: { x: number; y: number } | null = null;
  targetUnit: IEntity | null = null;
  targetResource: ResourceNode | null = null;
  targetBuilding: Building | null = null;
  returnTo: Building | null = null;
  cargo: { type: ResourceType; amount: number } | null = null;
  gatherAccum = 0;
  autopilot = false;
  autopilotAnchor: { x: number; y: number } | null = null;
  autopilotNextThinkMs = 0;

  hb: HealthBar;

  private facingFlip = false;
  private walkPhase = 0;
  private attackBusy = false;
  private workBusy = false;
  private lastWorkSwing = 0;
  private lastStepDust = 0;
  private lastX = 0;
  private lastY = 0;
  private lastVisible = true;
  private usingArtSheet = false;
  private facing: UnitFacing = 'south';
  private currentArtAnim: UnitAnimState | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: UnitKind, side: Side, race: Race) {
    this.unitKind = kind; this.side = side; this.race = race;
    const def = UNIT[kind];
    this.hp = def.hp; this.maxHp = def.hp;
    this.sight = def.sight;
    this.speed = def.speed;
    this.atk = def.atk; this.range = def.range; this.cooldown = def.cooldown;
    this.food = def.food;
    this.radius = def.size / 2;

    this.shadow = scene.add.image(x, y + BODY_HEIGHT[kind] * 0.4, SHADOW_KEY[kind]).setDepth(28);
    this.shadow.setAlpha(0.85);

    this.usingArtSheet = unitArtReady(scene, kind, race);
    const texKey = this.usingArtSheet ? unitSheetKey(kind, race, 'idle') : `unit_${kind}_${race}`;
    this.sprite = scene.add.sprite(x, y, texKey, this.usingArtSheet ? 0 : undefined);
    this.sprite.setDepth(30);
    this.sprite.setOrigin(0.5, this.usingArtSheet ? 0.58 : 0.5);
    if (this.usingArtSheet) {
      const display = UNIT_ART_DISPLAY[kind];
      const renderSize = Math.max(display.width, display.height);
      this.sprite.setScale(renderSize / UNIT_ART_FRAME_SIZE);
    }
    this.sprite.setData('entity', this);

    if (this.usingArtSheet || kind === 'catapult') {
      this.weapon = null;
    } else {
      const rig = WEAPON_RIG[kind];
      this.weapon = scene.add.image(x + rig.ox, y + rig.oy, `unit_${kind}_${race}_weapon`);
      this.weapon.setOrigin(rig.originX, rig.originY);
      this.weapon.setRotation(rig.baseRot);
      this.weapon.setDepth(31);
    }

    this.hb = new HealthBar(scene, this, 22);
    if (this.usingArtSheet) this.playArtAnimation('idle', true);
    this.lastX = x; this.lastY = y;
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  set x(v: number) { this.sprite.x = v; }
  set y(v: number) { this.sprite.y = v; }

  setVisible(v: boolean): void {
    this.sprite.setVisible(v);
    this.shadow.setVisible(v);
    this.weapon?.setVisible(v);
    this.cargoBadge?.setVisible(v);
    this.lastVisible = v;
  }

  takeDamage(n: number, _from?: IEntity): void {
    if (!this.alive) return;
    this.hp -= n;
    this.hb.update();
    if (this.hp <= 0) this.die();
  }

  die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.state = 'dead';
    this.attackBusy = false;
    this.workBusy = false;
    if (this.usingArtSheet) {
      const scene = this.sprite.scene;
      const deathKey = this.playArtAnimation('death', true);
      if (deathKey) {
        this.hb.destroy();
        this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + deathKey, () => {
          const parts = [this.sprite, this.shadow, this.cargoBadge].filter((p): p is Phaser.GameObjects.Sprite | Phaser.GameObjects.Image => !!p);
          scene.tweens.add({
            targets: parts,
            alpha: 0,
            duration: 360,
            ease: 'Cubic.easeIn',
            onComplete: () => {
              this.sprite.destroy();
              this.shadow.destroy();
              this.cargoBadge?.destroy();
              this.cargoBadge = null;
            }
          });
        });
        return;
      }
    }
    // Death animation on sprite (then destroy all parts)
    const scene = this.sprite.scene;
    const parts = [this.sprite, this.shadow, this.weapon, this.cargoBadge].filter((p): p is Phaser.GameObjects.Sprite | Phaser.GameObjects.Image => !!p);
    scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.3,
      scaleY: 0.4,
      rotation: (Math.random() - 0.5) * 1.2,
      duration: 180,
      ease: 'Sine.easeOut'
    });
    scene.tweens.add({
      targets: parts,
      alpha: 0,
      duration: 420,
      delay: 120,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.sprite.destroy();
        this.shadow.destroy();
        this.weapon?.destroy();
        this.cargoBadge?.destroy();
        this.cargoBadge = null;
      }
    });
    this.hb.destroy();
  }

  destroy(): void {
    this.hp = 0;
    this.die();
  }

  clearOrders(): void {
    this.path = [];
    this.pathDest = null;
    this.attackMoveTo = null;
    this.targetUnit = null;
    this.targetResource = null;
    this.targetBuilding = null;
    this.returnTo = null;
    this.state = 'idle';
  }

  setPath(points: { x: number; y: number }[]): void {
    this.path = points;
    this.pathDest = points.length ? points[points.length - 1] : null;
  }

  canAttack(): boolean { return this.unitKind !== 'worker' || this.atk > 0; }
  isRanged(): boolean { return this.unitKind === 'archer' || this.unitKind === 'catapult'; }
  isSiege(): boolean { return this.unitKind === 'catapult'; }
  isWorker(): boolean { return this.unitKind === 'worker'; }

  /** Plays the attack swing — called by GameScene on the frame damage is dealt. */
  playAttackSwing(): void {
    if (!this.alive) return;
    const scene = this.sprite.scene;
    if (this.usingArtSheet) {
      if (this.attackBusy) return;
      this.faceTowardActiveTarget();
      const attackKey = this.playArtAnimation('attack', true);
      if (attackKey) {
        this.attackBusy = true;
        this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + attackKey, () => {
          this.attackBusy = false;
          if (this.alive) this.playArtAnimation('idle', true);
        });
        return;
      }
    }
    if (this.unitKind === 'catapult') {
      // Recoil: body scales and jumps back slightly
      scene.tweens.add({
        targets: this.sprite,
        scaleX: 0.92, scaleY: 1.08,
        x: this.sprite.x - (this.facingFlip ? -4 : 4),
        duration: 70,
        yoyo: true,
        ease: 'Sine.easeOut'
      });
      return;
    }
    if (this.unitKind === 'archer') {
      // Bow draw + release: scale pulse on body + weapon draw-back tween
      if (this.weapon) {
        scene.tweens.add({
          targets: this.weapon,
          scaleX: 1.25,
          duration: 150,
          yoyo: true,
          ease: 'Quad.easeOut'
        });
      }
      scene.tweens.add({
        targets: this.sprite,
        scaleX: this.facingFlip ? -1.02 : 1.02,
        scaleY: 0.96,
        duration: 120,
        yoyo: true,
        ease: 'Sine.easeOut'
      });
      return;
    }
    // Melee: knight / footman / worker — rotate weapon with windup + strike
    if (!this.weapon) return;
    if (this.attackBusy) return;
    this.attackBusy = true;
    const rig = WEAPON_RIG[this.unitKind];
    const sign = this.facingFlip ? -1 : 1;
    const base = rig.baseRot * sign;
    const wind = base - 0.8 * sign;
    const strike = base + 0.9 * sign;
    scene.tweens.chain({
      targets: this.weapon,
      tweens: [
        { rotation: wind, duration: 110, ease: 'Sine.easeOut' },
        { rotation: strike, duration: 70, ease: 'Cubic.easeIn' },
        { rotation: base, duration: 200, ease: 'Sine.easeInOut' }
      ],
      onComplete: () => { this.attackBusy = false; }
    });
    // Body "lean into" the strike
    scene.tweens.add({
      targets: this.sprite,
      x: this.sprite.x + sign * 2,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut'
    });
  }

  playWorkSwing(kind: 'gather' | 'build'): void {
    if (!this.alive) return;
    const scene = this.sprite.scene;
    const now = scene.time.now;
    if (this.workBusy || now - this.lastWorkSwing < 260) return;
    this.lastWorkSwing = now;
    this.workBusy = true;
    if (this.usingArtSheet) {
      this.faceTowardActiveTarget();
      const workKey = this.playArtAnimation(this.unitKind === 'worker' ? 'work' : 'attack', true);
      if (workKey) {
        this.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + workKey, () => {
          this.workBusy = false;
          if (this.alive) this.playArtAnimation('idle', true);
        });
        return;
      }
    }
    const sign = this.facingFlip ? -1 : 1;

    if (this.weapon) {
      const rig = WEAPON_RIG[this.unitKind];
      const base = rig.baseRot * sign;
      scene.tweens.chain({
        targets: this.weapon,
        tweens: [
          { rotation: base - 0.65 * sign, duration: 90, ease: 'Sine.easeOut' },
          { rotation: base + (kind === 'build' ? 0.85 : 0.55) * sign, duration: 80, ease: 'Cubic.easeIn' },
          { rotation: base, duration: 160, ease: 'Sine.easeInOut' }
        ],
        onComplete: () => { this.workBusy = false; }
      });
    } else {
      scene.time.delayedCall(180, () => { this.workBusy = false; });
    }

    scene.tweens.add({
      targets: this.sprite,
      scaleY: 0.94,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut'
    });
  }

  update(): void {
    this.hb.update();
    if (!this.alive) return;

    // Propagate visibility from body → parts
    if (this.sprite.visible !== this.lastVisible) {
      this.lastVisible = this.sprite.visible;
      this.shadow.setVisible(this.lastVisible);
      this.weapon?.setVisible(this.lastVisible);
      this.cargoBadge?.setVisible(this.lastVisible);
    }

    // Skip rig updates if off-screen — major perf win
    if (!this.lastVisible) return;

    const dx = this.sprite.x - this.lastX;
    const dy = this.sprite.y - this.lastY;
    const moving = Math.abs(dx) + Math.abs(dy) > 0.15;

    if (this.usingArtSheet) {
      if (moving) {
        this.facing = getUnitFacingFromVector(dx, dy, this.facing);
        if (!this.attackBusy && !this.workBusy) this.playArtAnimation('walk');
        const now = this.sprite.scene.time.now;
        if (now - this.lastStepDust > VISUALS.stepDustMs) {
          this.lastStepDust = now;
          const anyScene = this.sprite.scene as any;
          if (anyScene.effects?.stepDust) anyScene.effects.stepDust(this.sprite.x, this.sprite.y + BODY_HEIGHT[this.unitKind] * 0.35);
        }
      } else if (!this.attackBusy && !this.workBusy) {
        this.playArtAnimation('idle');
      }

      this.shadow.setPosition(this.sprite.x, this.sprite.y + BODY_HEIGHT[this.unitKind] * 0.42);
      this.updateCargoBadge();
      this.updateDepths();
      this.lastX = this.sprite.x;
      this.lastY = this.sprite.y;
      return;
    }

    if (Math.abs(dx) > 0.4) {
      const shouldFlip = dx < 0;
      if (shouldFlip !== this.facingFlip) {
        this.facingFlip = shouldFlip;
        this.sprite.setFlipX(shouldFlip);
        if (this.weapon) {
          this.weapon.setFlipX(shouldFlip);
          if (this.unitKind !== 'archer' && !this.attackBusy) {
            const rig = WEAPON_RIG[this.unitKind];
            this.weapon.setRotation(rig.baseRot * (shouldFlip ? -1 : 1));
          }
        }
      }
    }

    // Walk squash (scaleY only — no position mutation so pathfinding stays clean)
    if (moving) {
      this.walkPhase += 0.25;
      this.sprite.setScale(1, 1 + Math.abs(Math.sin(this.walkPhase * 2)) * 0.035);
      const now = this.sprite.scene.time.now;
      if (now - this.lastStepDust > VISUALS.stepDustMs) {
        this.lastStepDust = now;
        const anyScene = this.sprite.scene as any;
        if (anyScene.effects?.stepDust) anyScene.effects.stepDust(this.sprite.x, this.sprite.y + BODY_HEIGHT[this.unitKind] * 0.35);
      }
    } else if (this.walkPhase !== 0) {
      this.walkPhase = 0;
      this.sprite.setScale(1, 1);
    } else if (!this.attackBusy && !this.workBusy) {
      const pulse = 1 + Math.sin(this.sprite.scene.time.now / 540 + this.id) * 0.014;
      this.sprite.setScale(1, pulse);
    }

    // Position shadow under body
    this.shadow.setPosition(this.sprite.x, this.sprite.y + BODY_HEIGHT[this.unitKind] * 0.42);

    // Position weapon relative to body
    if (this.weapon) {
      const rig = WEAPON_RIG[this.unitKind];
      const sign = this.facingFlip ? -1 : 1;
      this.weapon.setPosition(this.sprite.x + rig.ox * sign, this.sprite.y + rig.oy);
    }

    this.updateCargoBadge();
    this.updateDepths();

    this.lastX = this.sprite.x;
    this.lastY = this.sprite.y;
  }

  private faceTowardActiveTarget(): void {
    const target = this.targetUnit ?? this.targetBuilding ?? this.targetResource;
    if (!target) return;
    this.facing = getUnitFacingFromVector(target.x - this.sprite.x, target.y - this.sprite.y, this.facing);
  }

  private playArtAnimation(anim: UnitAnimState, restart = false): string | null {
    if (!this.usingArtSheet) return null;
    let state = anim;
    if (state === 'work' && !unitAnimReady(this.sprite.scene, this.unitKind, this.race, 'work')) state = 'attack';
    if (!unitAnimReady(this.sprite.scene, this.unitKind, this.race, state)) return null;
    const key = unitAnimKey(this.unitKind, this.race, state, this.facing);
    if (!this.sprite.scene.anims.exists(key)) return null;
    if (!restart && this.currentArtAnim === state && this.sprite.anims.currentAnim?.key === key) return key;
    this.currentArtAnim = state;
    this.sprite.play(key, restart);
    return key;
  }

  private updateCargoBadge(): void {
    if (!this.cargo) {
      if (this.cargoBadge) {
        this.cargoBadge.destroy();
        this.cargoBadge = null;
      }
      return;
    }
    if (!this.cargoBadge) {
      const key = this.cargo.type === 'gold' ? 'px_star' : 'px_leaf';
      this.cargoBadge = this.sprite.scene.add.image(this.sprite.x, this.sprite.y - BODY_HEIGHT[this.unitKind] * 0.48, key)
        .setScale(this.cargo.type === 'gold' ? 0.72 : 0.9)
        .setAlpha(0.95)
        .setBlendMode(this.cargo.type === 'gold' ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
      if (this.cargo.type === 'gold') this.cargoBadge.setTint(0xffd36a);
    }
    this.cargoBadge.setVisible(this.lastVisible);
    this.cargoBadge.setPosition(
      this.sprite.x + Math.sin(this.sprite.scene.time.now / 180 + this.id) * 1.5,
      this.sprite.y - BODY_HEIGHT[this.unitKind] * 0.5
    );
    this.cargoBadge.setRotation(Math.sin(this.sprite.scene.time.now / 300 + this.id) * 0.2);
  }

  private updateDepths(): void {
    const base = 30 + this.sprite.y / 10000;
    this.shadow.setDepth(base - 2);
    this.sprite.setDepth(base);
    this.weapon?.setDepth(base + 1);
    this.cargoBadge?.setDepth(base + 2);
  }
}
