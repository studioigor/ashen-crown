export interface Point {
  x: number;
  y: number;
}

export function formationSlots(units: Point[], target: Point, spacing = 30): Point[] {
  if (units.length <= 1) return [{ x: target.x, y: target.y }];
  const center = centroid(units);
  const angle = Math.atan2(target.y - center.y, target.x - center.x);
  const cols = Math.ceil(Math.sqrt(units.length));
  const rows = Math.ceil(units.length / cols);
  const raw: Point[] = [];

  for (let i = 0; i < units.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const lx = (row - (rows - 1) / 2) * spacing;
    const ly = (col - (cols - 1) / 2) * spacing;
    raw.push(rotate(target, lx, ly, angle));
  }

  const remaining = raw.slice();
  return units.map((u) => {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const d = (u.x - s.x) ** 2 + (u.y - s.y) ** 2;
      if (d < bestD) { bestD = d; bestIdx = i; }
    }
    const [slot] = remaining.splice(bestIdx, 1);
    return slot;
  });
}

function centroid(points: Point[]): Point {
  let x = 0, y = 0;
  for (const p of points) { x += p.x; y += p.y; }
  return { x: x / points.length, y: y / points.length };
}

function rotate(origin: Point, lx: number, ly: number, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: origin.x + lx * cos - ly * sin,
    y: origin.y + lx * sin + ly * cos
  };
}
