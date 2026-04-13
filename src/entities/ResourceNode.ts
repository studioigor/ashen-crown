import Phaser from 'phaser';
import { IEntity, newEntityId, HealthBar } from './Entity';
import { Side, SIDE, RESOURCE, TILE } from '../config';

export type ResourceType = 'gold' | 'lumber';

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
    this.hb = new HealthBar(scene, this, type === 'gold' ? 60 : 24);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  harvest(n: number): number {
    const got = Math.min(n, this.amount);
    this.amount -= got;
    this.hp = this.amount;
    this.hb.update();
    if (this.amount <= 0) this.destroy();
    return got;
  }

  takeDamage(): void { /* invulnerable */ }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.destroy();
    this.hb.destroy();
  }
}
