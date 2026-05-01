import Phaser from 'phaser';
import { Side, COLORS } from '../config';

export type EntityKind = 'unit' | 'building' | 'resource' | 'projectile' | 'caravan';

export interface IEntity {
  readonly id: number;
  readonly kind: EntityKind;
  readonly side: Side;
  readonly sprite: Phaser.GameObjects.Sprite;
  hp: number;
  maxHp: number;
  alive: boolean;
  sight: number;
  x: number;
  y: number;
  radius: number;
  destroy(): void;
  takeDamage(amount: number, from?: IEntity): void;
}

let nextEntityId = 1;
export function newEntityId(): number { return nextEntityId++; }

export class HealthBar {
  private g: Phaser.GameObjects.Graphics;
  private visible = true;
  private displayHp: number;
  constructor(private scene: Phaser.Scene, private owner: IEntity, private widthPx: number) {
    this.g = scene.add.graphics();
    this.g.setDepth(100);
    this.displayHp = owner.hp;
  }
  setVisible(v: boolean): void {
    this.visible = v;
    this.g.setVisible(v);
  }
  update(): void {
    if (!this.owner.alive) {
      if (this.g.visible) { this.g.clear(); this.g.setVisible(false); }
      return;
    }
    if (this.owner.hp >= this.owner.maxHp) {
      if (this.g.visible) { this.g.clear(); this.g.setVisible(false); }
      return;
    }
    this.g.clear();
    this.g.setVisible(this.visible);
    
    // Smooth lerp
    this.displayHp += (this.owner.hp - this.displayHp) * 0.15;
    
    const w = this.widthPx;
    const h = 4;
    const x = this.owner.x - w / 2;
    const y = this.owner.y - this.owner.radius - 12;
    
    // Shadow
    this.g.fillStyle(0x000000, 0.4);
    this.g.fillRect(x, y + 2, w, h);
    // Background
    this.g.fillStyle(0x000000, 0.8);
    this.g.fillRect(x - 1, y - 1, w + 2, h + 2);
    
    const smoothedPct = Phaser.Math.Clamp(this.displayHp / this.owner.maxHp, 0, 1);
    const truePct = Phaser.Math.Clamp(this.owner.hp / this.owner.maxHp, 0, 1);
    const color = truePct > 0.5 ? COLORS.hpGreen : truePct > 0.25 ? COLORS.hpYellow : COLORS.hpRed;
    
    // Trailing damage flash
    if (smoothedPct > truePct) {
      this.g.fillStyle(0xffffff, 0.9);
      this.g.fillRect(x, y, w * smoothedPct, h);
    }
    
    this.g.fillStyle(color, 1);
    this.g.fillRect(x, y, w * truePct, h);
  }
  destroy(): void { this.g.destroy(); }
}
