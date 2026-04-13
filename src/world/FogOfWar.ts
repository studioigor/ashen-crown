import Phaser from 'phaser';
import { MAP_W, MAP_H, TILE, WORLD_W, WORLD_H } from '../config';
import { TileMap } from './TileMap';

/**
 * Fog of war with three states per tile: 0 = unexplored, 1 = explored, 2 = visible.
 * Renders as two overlay layers (explored grey + unexplored black) above the world.
 */
export class FogOfWar {
  state: Uint8Array;
  private tex: Phaser.GameObjects.RenderTexture;
  private g: Phaser.GameObjects.Graphics;

  constructor(private scene: Phaser.Scene, _map: TileMap) {
    this.state = new Uint8Array(MAP_W * MAP_H);
    this.tex = scene.add.renderTexture(0, 0, WORLD_W, WORLD_H).setOrigin(0, 0);
    this.tex.setDepth(1000);
    this.tex.setScrollFactor(1);
    this.g = scene.add.graphics().setVisible(false);
  }

  idx(tx: number, ty: number): number { return ty * MAP_W + tx; }

  isVisible(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    return this.state[this.idx(tx, ty)] === 2;
  }

  isExplored(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
    return this.state[this.idx(tx, ty)] >= 1;
  }

  revealCircle(cx: number, cy: number, tiles: number): void {
    const minX = Math.max(0, cx - tiles), maxX = Math.min(MAP_W - 1, cx + tiles);
    const minY = Math.max(0, cy - tiles), maxY = Math.min(MAP_H - 1, cy + tiles);
    const r2 = tiles * tiles;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.state[this.idx(x, y)] = 2;
      }
    }
  }

  /** Call before each reveal pass to downgrade previously-visible tiles to explored. */
  dimVisible(): void {
    for (let i = 0; i < this.state.length; i++) {
      if (this.state[i] === 2) this.state[i] = 1;
    }
  }

  redraw(): void {
    this.tex.clear();
    this.g.clear();
    // Unexplored (pitch black)
    this.g.fillStyle(0x000000, 1);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (this.state[this.idx(x, y)] === 0) {
          this.g.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
    // Explored (partial shade — slightly softer and warmer than pitch-black)
    this.g.fillStyle(0x0a0c12, 0.55);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (this.state[this.idx(x, y)] === 1) {
          this.g.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
    this.tex.draw(this.g, 0, 0);
  }
}
