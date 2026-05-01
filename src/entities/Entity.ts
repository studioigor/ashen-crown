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

export interface HealthBarStats {
  calls: number;
  redraws: number;
  skippedFull: number;
  skippedHidden: number;
  skippedThrottle: number;
}

const healthBarStats: HealthBarStats = {
  calls: 0,
  redraws: 0,
  skippedFull: 0,
  skippedHidden: 0,
  skippedThrottle: 0
};

export function resetHealthBarStats(): void {
  healthBarStats.calls = 0;
  healthBarStats.redraws = 0;
  healthBarStats.skippedFull = 0;
  healthBarStats.skippedHidden = 0;
  healthBarStats.skippedThrottle = 0;
}

export function getHealthBarStats(): HealthBarStats {
  return { ...healthBarStats };
}

export class HealthBar {
  private g: Phaser.GameObjects.Graphics;
  private visible = true;
  private displayHp: number;
  private lastDrawAt = -Infinity;
  private lastDrawHp = -1;
  private lastDrawX = NaN;
  private lastDrawY = NaN;
  constructor(private scene: Phaser.Scene, private owner: IEntity, private widthPx: number) {
    this.g = scene.add.graphics();
    this.g.setDepth(100);
    this.displayHp = owner.hp;
  }
  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) this.g.setVisible(false);
  }
  update(force = false): void {
    healthBarStats.calls++;
    if (!this.owner.alive) {
      if (this.g.visible) { this.g.clear(); this.g.setVisible(false); }
      return;
    }
    if (!this.visible || !this.isNearCamera()) {
      healthBarStats.skippedHidden++;
      if (this.g.visible) this.g.setVisible(false);
      return;
    }
    if (this.owner.hp >= this.owner.maxHp) {
      healthBarStats.skippedFull++;
      if (this.g.visible) { this.g.clear(); this.g.setVisible(false); }
      return;
    }

    const now = this.scene.time.now;
    const x = this.owner.x - this.widthPx / 2;
    const y = this.owner.y - this.owner.radius - 12;
    const moved = Math.abs(x - this.lastDrawX) + Math.abs(y - this.lastDrawY) > 1.5;
    const hpChanged = Math.abs(this.owner.hp - this.lastDrawHp) >= 0.5;
    if (!force && !moved && !hpChanged && now - this.lastDrawAt < 100) {
      healthBarStats.skippedThrottle++;
      return;
    }

    this.g.clear();
    this.g.setVisible(true);
    
    // Smooth lerp
    this.displayHp += (this.owner.hp - this.displayHp) * 0.15;
    
    const w = this.widthPx;
    const h = 4;
    
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

    this.lastDrawAt = now;
    this.lastDrawHp = this.owner.hp;
    this.lastDrawX = x;
    this.lastDrawY = y;
    healthBarStats.redraws++;
  }
  destroy(): void { this.g.destroy(); }

  private isNearCamera(): boolean {
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const margin = 80;
    return this.owner.x >= view.x - margin
      && this.owner.x <= view.right + margin
      && this.owner.y >= view.y - margin
      && this.owner.y <= view.bottom + margin;
  }
}
