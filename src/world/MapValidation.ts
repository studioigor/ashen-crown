import { MAP_H, MAP_W } from '../config';
import { TileMap } from './TileMap';

export function hasWalkablePath(
  map: TileMap,
  start: { tx: number; ty: number },
  goal: { tx: number; ty: number }
): boolean {
  if (!map.isWalkable(start.tx, start.ty) || !map.isWalkable(goal.tx, goal.ty)) return false;
  const seen = new Uint8Array(MAP_W * MAP_H);
  const q: { tx: number; ty: number }[] = [start];
  seen[start.ty * MAP_W + start.tx] = 1;
  let head = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  while (head < q.length) {
    const cur = q[head++];
    if (cur.tx === goal.tx && cur.ty === goal.ty) return true;
    for (const [dx, dy] of dirs) {
      const nx = cur.tx + dx;
      const ny = cur.ty + dy;
      if (!map.inBounds(nx, ny) || !map.isWalkable(nx, ny)) continue;
      const idx = ny * MAP_W + nx;
      if (seen[idx]) continue;
      seen[idx] = 1;
      q.push({ tx: nx, ty: ny });
    }
  }
  return false;
}

export function nearestReachableWalkable(
  map: TileMap,
  start: { tx: number; ty: number },
  around: { tx: number; ty: number },
  maxRadius = 10
): { tx: number; ty: number } | null {
  for (let r = 0; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const tx = around.tx + dx;
        const ty = around.ty + dy;
        if (!map.isWalkable(tx, ty)) continue;
        if (hasWalkablePath(map, start, { tx, ty })) return { tx, ty };
      }
    }
  }
  return null;
}
