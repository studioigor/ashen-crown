export interface SpatialEntity {
  x: number;
  y: number;
  alive: boolean;
}

export class SpatialIndex<T extends SpatialEntity> {
  private cells = new Map<string, T[]>();

  constructor(private readonly cellSize: number) {}

  rebuild(items: T[]): void {
    this.cells.clear();
    for (const item of items) {
      if (!item.alive) continue;
      const key = this.keyFor(item.x, item.y);
      const cell = this.cells.get(key);
      if (cell) cell.push(item);
      else this.cells.set(key, [item]);
    }
  }

  queryRadius(x: number, y: number, radius: number, out: T[]): T[] {
    out.length = 0;
    const r2 = radius * radius;
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const cell = this.cells.get(this.key(cx, cy));
        if (!cell) continue;
        for (const item of cell) {
          const dx = item.x - x;
          const dy = item.y - y;
          if (dx * dx + dy * dy <= r2) out.push(item);
        }
      }
    }
    return out;
  }

  private keyFor(x: number, y: number): string {
    return this.key(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
  }

  private key(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }
}
