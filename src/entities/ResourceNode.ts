import Phaser from 'phaser';
import { IEntity, newEntityId, HealthBar } from './Entity';
import { Side, SIDE, RESOURCE, TILE } from '../config';

export type ResourceType = 'gold' | 'lumber';

const TREE_DISPLAY_SIZE = TILE * 1.5;
const TREE_LOG_SCALE = 1.22;

export class ResourceNode implements IEntity {
  readonly id = newEntityId();
  readonly kind = 'resource' as const;
  readonly side: Side = SIDE.neutral;
  readonly resourceType: ResourceType;
  readonly sprite: Phaser.GameObjects.Sprite;
  hp = 1;
  maxHp = 1;
  alive = true;
  sight = 0;
  radius: number;
  amount: number;
  tileW: number;
  tileH: number;
  tx: number;
  ty: number;
  hb: HealthBar;
  private logDecal: Phaser.GameObjects.Image | null = null;

  constructor(scene: Phaser.Scene, tx: number, ty: number, type: ResourceType) {
    this.resourceType = type;
    this.tx = tx;
    this.ty = ty;
    if (type === 'gold') {
      this.tileW = 3; this.tileH = 3;
      this.sprite = scene.add.sprite(tx * TILE + TILE * 1.5, ty * TILE + TILE * 1.5, 'goldmine');
      this.amount = RESOURCE.mineAmount;
      this.radius = TILE * 1.4;
      scene.tweens.add({
        targets: this.sprite,
        scaleX: { from: 1, to: 1.018 },
        scaleY: { from: 1, to: 1.012 },
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    } else {
      this.tileW = 1; this.tileH = 1;
      this.sprite = scene.add.sprite(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 'tree');
      this.amount = RESOURCE.treeAmount;
      this.radius = TILE * 0.45;
      // Origin at bottom so sway rotates the crown, not the base
      this.sprite.setOrigin(0.5, 0.9);
      this.sprite.setDisplaySize(TREE_DISPLAY_SIZE, TREE_DISPLAY_SIZE);
      // Gentle sway tween
      scene.tweens.add({
        targets: this.sprite,
        rotation: { from: -0.03, to: 0.03 },
        duration: 1800 + Math.random() * 1200,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 2000,
        ease: 'Sine.easeInOut'
      });
    }
    this.sprite.setDepth((type === 'gold' ? 5 : 6) + this.sprite.y / 10000);
    this.sprite.setData('entity', this);
    this.maxHp = this.amount;
    this.hp = this.amount;
    this.hb = new HealthBar(scene, this, type === 'gold' ? 64 : 30);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }
  get visualRadius(): number { return Math.max(this.sprite.displayWidth, this.sprite.displayHeight) / 2; }

  harvest(n: number): number {
    const got = Math.min(n, this.amount);
    this.amount -= got;
    this.hp = this.amount;
    this.updateResourceTexture();
    this.hb.update(true);
    if (this.amount <= 0) this.destroy();
    return got;
  }

  takeDamage(): void { /* invulnerable */ }

  private updateResourceTexture(): void {
    if (this.resourceType !== 'gold') return;
    const frac = this.amount / this.maxHp;
    const key = frac < 0.32 ? 'goldmine_depleted' : frac < 0.62 ? 'goldmine_damaged' : 'goldmine';
    if (this.sprite.scene.textures.exists(key) && this.sprite.texture.key !== key) {
      this.sprite.setTexture(key);
    }
  }

  private fadeOut(scene: Phaser.Scene, targets: Phaser.GameObjects.GameObject | Phaser.GameObjects.GameObject[], delay: number, duration: number): void {
    scene.tweens.add({
      targets,
      alpha: 0,
      duration,
      delay,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        for (const target of Array.isArray(targets) ? targets : [targets]) target.destroy();
      }
    });
  }

  private addTreeLogDecal(scene: Phaser.Scene): Phaser.GameObjects.Image | null {
    if (!scene.textures.exists('tree_log')) return null;
    const decal = scene.add.image(this.sprite.x + TILE * 0.22, this.sprite.y + TILE * 0.3, 'tree_log')
      .setScale(TREE_LOG_SCALE);
    decal.setDepth(this.sprite.depth + 0.01);
    decal.setRotation(-0.12);
    decal.setData('entity', null);
    return decal;
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.hb.destroy();
    const scene = this.sprite.scene;
    scene.tweens.killTweensOf(this.sprite);
    if (this.resourceType === 'gold' && scene.textures.exists('goldmine_depleted')) {
      this.sprite.setTexture('goldmine_depleted');
      this.sprite.setData('entity', null);
      this.sprite.setAlpha(1);
      this.fadeOut(scene, this.sprite, 6500, 900);
      return;
    }
    if (this.resourceType === 'lumber' && scene.textures.exists('tree_stump')) {
      this.sprite.setTexture('tree_stump');
      this.sprite.setOrigin(0.5, 0.8);
      this.sprite.setDisplaySize(TREE_DISPLAY_SIZE, TREE_DISPLAY_SIZE);
      this.sprite.setRotation(0);
      this.sprite.setAlpha(1);
      this.sprite.setData('entity', null);
      this.logDecal = this.addTreeLogDecal(scene);
      this.fadeOut(scene, this.logDecal ? [this.sprite, this.logDecal] : this.sprite, 4500, 700);
      return;
    }
    if (this.resourceType === 'lumber') {
      this.logDecal = this.addTreeLogDecal(scene);
      if (this.logDecal) {
        this.sprite.destroy();
        this.fadeOut(scene, this.logDecal, 4500, 700);
        return;
      }
    }
    this.sprite.destroy();
  }
}
