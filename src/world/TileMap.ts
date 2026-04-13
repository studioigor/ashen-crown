import { MAP_W, MAP_H, TILE } from '../config';

export const enum TileType {
  Grass = 0,
  Grass2 = 1,
  Forest = 2,
  Stone = 3,
  Water = 4,
  Dirt = 5
}

export class TileMap {
  readonly w = MAP_W;
  readonly h = MAP_H;
  private tiles: Uint8Array;
  /** Passability grid: true if walkable and not occupied by a static blocker. */
  private walkable: Uint8Array;

  constructor() {
    this.tiles = new Uint8Array(MAP_W * MAP_H);
    this.walkable = new Uint8Array(MAP_W * MAP_H);
    this.walkable.fill(1);
  }

  idx(tx: number, ty: number): number { return ty * MAP_W + tx; }
  inBounds(tx: number, ty: number): boolean { return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H; }

  get(tx: number, ty: number): TileType {
    return this.tiles[this.idx(tx, ty)] as TileType;
  }
  set(tx: number, ty: number, t: TileType): void {
    this.tiles[this.idx(tx, ty)] = t;
    if (t === TileType.Water || t === TileType.Stone) {
      this.walkable[this.idx(tx, ty)] = 0;
    }
  }

  isWalkable(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return false;
    return this.walkable[this.idx(tx, ty)] === 1;
  }
  setWalkable(tx: number, ty: number, v: boolean): void {
    if (!this.inBounds(tx, ty)) return;
    this.walkable[this.idx(tx, ty)] = v ? 1 : 0;
  }

  worldToTile(x: number, y: number): { tx: number; ty: number } {
    return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
  }
  tileToWorld(tx: number, ty: number): { x: number; y: number } {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  tileTextureKey(t: TileType): string {
    switch (t) {
      case TileType.Grass: return 'tile_grass';
      case TileType.Grass2: return 'tile_grass2';
      case TileType.Forest: return 'tile_forest';
      case TileType.Stone: return 'tile_stone';
      case TileType.Water: return 'tile_water';
      case TileType.Dirt: return 'tile_dirt';
    }
  }
}
