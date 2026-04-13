import { TileMap, TileType } from './TileMap';
import { MAP_W, MAP_H, TILE } from '../config';
import { hasWalkablePath } from './MapValidation';

export interface MapDecal {
  x: number;
  y: number;
  key: string;
  scale: number;
  rotation: number;
}

export interface MapLayout {
  map: TileMap;
  playerBase: { tx: number; ty: number };
  aiBase: { tx: number; ty: number };
  goldMines: { tx: number; ty: number }[];
  trees: { tx: number; ty: number }[];
  decals: MapDecal[];
}

export function generateMap(seed = 42): MapLayout {
  const rng = mulberry32(seed);
  const map = new TileMap();
  const playerBase = { tx: 9, ty: 10 };
  const aiBase = mirror(playerBase);
  const center = { tx: Math.floor(MAP_W / 2), ty: Math.floor(MAP_H / 2) };

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      map.set(x, y, rng() < 0.3 ? TileType.Grass2 : TileType.Grass);
    }
  }

  addDecorativeWater(rng, map);
  scatterStone(rng, 7, map);
  clusterForestMirrored(rng, 12, 4, map);

  carveLane(map, playerBase, center, 4);
  carveLane(map, center, aiBase, 4);
  carveLane(map, { tx: 10, ty: MAP_H - 13 }, { tx: MAP_W - 12, ty: 12 }, 3);
  clearArea(map, playerBase.tx, playerBase.ty, 8);
  clearArea(map, aiBase.tx, aiBase.ty, 8);
  clearArea(map, center.tx, center.ty, 6);

  const goldMines = mirroredPoints([
    { tx: playerBase.tx + 7, ty: playerBase.ty + 1 },
    { tx: playerBase.tx + 1, ty: playerBase.ty + 9 },
    { tx: center.tx - 4, ty: center.ty - 5 }
  ]);
  goldMines.push({ tx: center.tx + 2, ty: center.ty + 3 });
  for (const m of goldMines) clearArea(map, m.tx, m.ty, 4);

  if (!hasWalkablePath(map, playerBase, aiBase)) {
    carveLane(map, playerBase, center, 5);
    carveLane(map, center, aiBase, 5);
  }

  const trees = materializeTrees(map, playerBase, aiBase, goldMines);
  const decals = scatterDecals(rng, map);
  return { map, playerBase, aiBase, goldMines, trees, decals };
}

function scatterDecals(rng: () => number, map: TileMap): MapDecal[] {
  const decals: MapDecal[] = [];
  const flowerKeys = ['decal_flower_0', 'decal_flower_1', 'decal_flower_2', 'decal_flower_3', 'decal_flower_4'];
  const pebbleKeys = ['decal_pebble_0', 'decal_pebble_1'];
  const tuftKeys = ['decal_tuft_0', 'decal_tuft_1'];
  const mushroomKeys = ['decal_mushroom_0', 'decal_mushroom_1'];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = map.get(x, y);
      if (t === TileType.Water || t === TileType.Stone || t === TileType.Forest) continue;
      const roll = rng();
      let key: string | null = null;
      if (roll < 0.04) key = flowerKeys[Math.floor(rng() * flowerKeys.length)];
      else if (roll < 0.07) key = tuftKeys[Math.floor(rng() * tuftKeys.length)];
      else if (roll < 0.085) key = pebbleKeys[Math.floor(rng() * pebbleKeys.length)];
      else if (roll < 0.09 && t === TileType.Grass) key = mushroomKeys[Math.floor(rng() * mushroomKeys.length)];
      else if (roll < 0.095) key = 'decal_twig';
      if (!key) continue;
      decals.push({
        x: x * TILE + 4 + rng() * (TILE - 8),
        y: y * TILE + 4 + rng() * (TILE - 8),
        key,
        scale: 0.8 + rng() * 0.4,
        rotation: (rng() - 0.5) * 0.6
      });
    }
  }
  return decals;
}

function addDecorativeWater(rng: () => number, map: TileMap): void {
  const mirroredPond = (p: { tx: number; ty: number; r: number }): { tx: number; ty: number; r: number } => {
    const m = mirror(p);
    return { tx: m.tx, ty: m.ty, r: p.r };
  };
  const first = { tx: 18, ty: 45, r: 3 + Math.floor(rng() * 2) };
  const second = { tx: 30, ty: 14, r: 2 };
  const ponds = [
    first,
    mirroredPond(first),
    second,
    mirroredPond(second)
  ];
  for (const p of ponds) {
    for (let dy = -p.r; dy <= p.r; dy++) {
      for (let dx = -p.r; dx <= p.r; dx++) {
        const x = p.tx + dx, y = p.ty + dy;
        if (!map.inBounds(x, y)) continue;
        if (Math.hypot(dx, dy) <= p.r && rng() < 0.8) map.set(x, y, TileType.Water);
      }
    }
  }
}

function clusterForestMirrored(rng: () => number, count: number, radius: number, map: TileMap): void {
  for (let i = 0; i < count; i++) {
    const cx = 5 + Math.floor(rng() * (MAP_W / 2 - 10));
    const cy = 5 + Math.floor(rng() * (MAP_H - 10));
    paintForestCluster(rng, map, cx, cy, radius);
    const m = mirror({ tx: cx, ty: cy });
    paintForestCluster(rng, map, m.tx, m.ty, radius);
  }
}

function paintForestCluster(rng: () => number, map: TileMap, cx: number, cy: number, radius: number): void {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx, y = cy + dy;
      if (!map.inBounds(x, y)) continue;
      const d = Math.hypot(dx, dy);
      if (d <= radius && rng() < 0.9 - d / (radius + 1)) map.set(x, y, TileType.Forest);
    }
  }
}

function scatterStone(rng: () => number, count: number, map: TileMap): void {
  for (let i = 0; i < count; i++) {
    const cx = 4 + Math.floor(rng() * (MAP_W / 2 - 8));
    const cy = 4 + Math.floor(rng() * (MAP_H - 8));
    paintStone(rng, map, cx, cy);
    const m = mirror({ tx: cx, ty: cy });
    paintStone(rng, map, m.tx, m.ty);
  }
}

function paintStone(rng: () => number, map: TileMap, cx: number, cy: number): void {
  const r = 1 + Math.floor(rng() * 2);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, y = cy + dy;
      if (!map.inBounds(x, y)) continue;
      if (Math.hypot(dx, dy) <= r && rng() < 0.65) map.set(x, y, TileType.Stone);
    }
  }
}

function carveLane(map: TileMap, from: { tx: number; ty: number }, to: { tx: number; ty: number }, radius: number): void {
  const steps = Math.max(Math.abs(to.tx - from.tx), Math.abs(to.ty - from.ty));
  for (let i = 0; i <= steps; i++) {
    const t = steps === 0 ? 0 : i / steps;
    const x = Math.round(lerp(from.tx, to.tx, t));
    const y = Math.round(lerp(from.ty, to.ty, t));
    clearArea(map, x, y, radius, TileType.Dirt);
  }
}

function clearArea(map: TileMap, cx: number, cy: number, r: number, tile: TileType = TileType.Grass): void {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const x = cx + dx, y = cy + dy;
      if (!map.inBounds(x, y)) continue;
      if (Math.hypot(dx, dy) <= r) {
        map.set(x, y, tile === TileType.Grass && (dx + dy) % 2 !== 0 ? TileType.Grass2 : tile);
        map.setWalkable(x, y, true);
      }
    }
  }
}

function materializeTrees(
  map: TileMap,
  playerBase: { tx: number; ty: number },
  aiBase: { tx: number; ty: number },
  goldMines: { tx: number; ty: number }[]
): { tx: number; ty: number }[] {
  const trees: { tx: number; ty: number }[] = [];
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (map.get(x, y) !== TileType.Forest) continue;
      if (!isFar(x, y, playerBase, 8) || !isFar(x, y, aiBase, 8) || goldMines.some(m => !isFar(x, y, m, 5))) {
        map.set(x, y, TileType.Grass);
        map.setWalkable(x, y, true);
        continue;
      }
      trees.push({ tx: x, ty: y });
      map.setWalkable(x, y, false);
    }
  }
  return trees;
}

function mirroredPoints(points: { tx: number; ty: number }[]): { tx: number; ty: number }[] {
  const out: { tx: number; ty: number }[] = [];
  for (const p of points) {
    out.push(p);
    out.push(mirror(p));
  }
  return out;
}

function mirror(p: { tx: number; ty: number }, offset = 0): { tx: number; ty: number } {
  return { tx: MAP_W - p.tx - 1 + offset, ty: MAP_H - p.ty - 1 + offset };
}

function isFar(x: number, y: number, p: { tx: number; ty: number }, r: number): boolean {
  return Math.hypot(x - p.tx, y - p.ty) > r;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
