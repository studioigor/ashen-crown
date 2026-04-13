import { TileMap } from '../world/TileMap';
import { MAP_W } from '../config';

interface Node {
  tx: number;
  ty: number;
  g: number;
  f: number;
  parent: Node | null;
}

/** A* on tile grid with 8-direction movement. Returns array of tile coords (inclusive of goal, excluding start). */
export function findPath(
  map: TileMap,
  startX: number, startY: number,
  goalX: number, goalY: number
): { tx: number; ty: number }[] {
  if (!map.inBounds(goalX, goalY)) return [];
  if (startX === goalX && startY === goalY) return [];

  const actualGoal = nearestWalkable(map, goalX, goalY);
  if (!actualGoal) return [];

  const open = new Map<number, Node>();
  const closed = new Uint8Array(MAP_W * map.h);
  const startNode: Node = { tx: startX, ty: startY, g: 0, f: heur(startX, startY, actualGoal.tx, actualGoal.ty), parent: null };
  open.set(key(startX, startY), startNode);

  const DIRS: [number, number, number][] = [
    [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
    [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]
  ];

  let iterations = 0;
  const maxIter = 4000;

  while (open.size > 0) {
    if (++iterations > maxIter) break;
    let cur: Node | null = null;
    let curKey = 0;
    for (const [k, n] of open) {
      if (cur === null || n.f < cur.f) { cur = n; curKey = k; }
    }
    if (!cur) break;
    open.delete(curKey);
    closed[cur.ty * MAP_W + cur.tx] = 1;

    if (cur.tx === actualGoal.tx && cur.ty === actualGoal.ty) {
      return reconstruct(cur);
    }

    for (const [dx, dy, cost] of DIRS) {
      const nx = cur.tx + dx, ny = cur.ty + dy;
      if (!map.inBounds(nx, ny)) continue;
      if (closed[ny * MAP_W + nx]) continue;
      if (!map.isWalkable(nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        if (!map.isWalkable(cur.tx + dx, cur.ty) || !map.isWalkable(cur.tx, cur.ty + dy)) continue;
      }
      const g = cur.g + cost;
      const k = key(nx, ny);
      const existing = open.get(k);
      if (existing && existing.g <= g) continue;
      const f = g + heur(nx, ny, actualGoal.tx, actualGoal.ty);
      if (existing) { existing.g = g; existing.f = f; existing.parent = cur; }
      else open.set(k, { tx: nx, ty: ny, g, f, parent: cur });
    }
  }
  return [];
}

function key(tx: number, ty: number): number { return ty * MAP_W + tx; }

function heur(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
  return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
}

function reconstruct(end: Node): { tx: number; ty: number }[] {
  const out: { tx: number; ty: number }[] = [];
  let n: Node | null = end;
  while (n && n.parent) { out.unshift({ tx: n.tx, ty: n.ty }); n = n.parent; }
  return out;
}

function nearestWalkable(map: TileMap, tx: number, ty: number): { tx: number; ty: number } | null {
  if (map.isWalkable(tx, ty)) return { tx, ty };
  for (let r = 1; r < 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = tx + dx, ny = ty + dy;
        if (map.isWalkable(nx, ny)) return { tx: nx, ty: ny };
      }
    }
  }
  return null;
}
