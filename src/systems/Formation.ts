import { UNIT } from '../config';
import type { UnitKind } from '../config';

export interface Point {
  x: number;
  y: number;
}

export interface FormationUnit extends Point {
  unitKind: UnitKind;
}

interface FormationSlot extends Point {
  localX: number;
  localY: number;
}

export function formationSlots(units: FormationUnit[], target: Point, spacing = 30): Point[] {
  if (units.length <= 1) return [{ x: target.x, y: target.y }];

  const center = centroid(units);
  const angle = Math.atan2(target.y - center.y, target.x - center.x);
  const gap = formationSpacing(units, spacing);

  if (units.length === 2) {
    return assignClosest(units, sideBySideSlots(target, angle, gap));
  }

  const hasMixedWorkers = units.some(u => u.unitKind === 'worker') && units.some(u => u.unitKind !== 'worker');
  const slots = gridSlots(units.length, target, angle, gap, hasMixedWorkers);
  return assignRoleAware(units, slots, center, angle, gap);
}

function formationSpacing(units: FormationUnit[], requested: number): number {
  const maxRadius = units.reduce((best, u) => Math.max(best, UNIT[u.unitKind].size / 2), 0);
  return Math.max(requested, maxRadius * 2 + 12);
}

function sideBySideSlots(target: Point, angle: number, spacing: number): FormationSlot[] {
  const half = spacing / 2;
  return [
    toSlot(target, 0, -half, angle),
    toSlot(target, 0, half, angle)
  ];
}

function gridSlots(count: number, target: Point, angle: number, spacing: number, extraRearSpace: boolean): FormationSlot[] {
  const cols = Math.ceil(Math.sqrt(count));
  const baseRows = Math.ceil(count / cols);
  const rows = extraRearSpace ? Math.max(baseRows, 3) : baseRows;
  const slots: FormationSlot[] = [];

  for (let row = 0; row < rows; row++) {
    const rowCount = extraRearSpace ? cols : Math.min(cols, count - row * cols);
    const localX = ((rows - 1) / 2 - row) * spacing;
    for (let col = 0; col < rowCount; col++) {
      const localY = (col - (rowCount - 1) / 2) * spacing;
      slots.push(toSlot(target, localX, localY, angle));
    }
  }

  return slots;
}

function assignRoleAware(
  units: FormationUnit[],
  slots: FormationSlot[],
  center: Point,
  angle: number,
  spacing: number
): Point[] {
  const hasMilitary = units.some(u => u.unitKind !== 'worker');
  const frontX = Math.max(...slots.map(s => s.localX));
  const rearX = Math.min(...slots.map(s => s.localX));
  const result = new Array<Point>(units.length);
  const remaining = slots.slice();

  const ordered = units.map((unit, index) => ({
    unit,
    index,
    local: toLocal(unit, center, angle),
    priority: rolePriority(unit.unitKind, hasMilitary)
  })).sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    if (a.local.y !== b.local.y) return a.local.y - b.local.y;
    return a.index - b.index;
  });

  for (const item of ordered) {
    let bestIdx = 0;
    let bestScore = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const slot = remaining[i];
      const moveCost = ((item.unit.x - slot.x) ** 2 + (item.unit.y - slot.y) ** 2) / (spacing * spacing);
      const score = roleSlotCost(item.unit.unitKind, slot, hasMilitary, frontX, rearX, spacing) + moveCost * 0.08;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    const [slot] = remaining.splice(bestIdx, 1);
    result[item.index] = { x: slot.x, y: slot.y };
  }

  return result;
}

function assignClosest(units: FormationUnit[], slots: FormationSlot[]): Point[] {
  const remaining = slots.slice();
  return units.map((u) => {
    let bestIdx = 0;
    let bestD = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const d = (u.x - s.x) ** 2 + (u.y - s.y) ** 2;
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    const [slot] = remaining.splice(bestIdx, 1);
    return { x: slot.x, y: slot.y };
  });
}

function rolePriority(kind: UnitKind, hasMilitary: boolean): number {
  if (kind === 'worker') return hasMilitary ? 3 : 0;
  if (kind === 'footman' || kind === 'knight') return 0;
  if (kind === 'catapult') return 1;
  return 2;
}

function roleSlotCost(
  kind: UnitKind,
  slot: FormationSlot,
  hasMilitary: boolean,
  frontX: number,
  rearX: number,
  spacing: number
): number {
  if (kind === 'footman' || kind === 'knight') {
    return (frontX - slot.localX) * 100 + Math.abs(slot.localY) * 0.5;
  }

  if (kind === 'catapult') {
    return (slot.localX - rearX) * 100 + Math.abs(slot.localY) * 1.4;
  }

  if (kind === 'worker') {
    if (hasMilitary) return (slot.localX - rearX) * 80 - Math.abs(slot.localY) * 0.2;
    return Math.abs(slot.localX) * 60 + Math.abs(slot.localY) * 0.6;
  }

  const span = Math.max(spacing, frontX - rearX);
  const rangedX = rearX + Math.min(spacing, span * 0.35);
  return Math.abs(slot.localX - rangedX) * 70 + Math.abs(slot.localY) * 0.6;
}

function centroid(points: Point[]): Point {
  let x = 0, y = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
  }
  return { x: x / points.length, y: y / points.length };
}

function toSlot(origin: Point, localX: number, localY: number, angle: number): FormationSlot {
  const rotated = rotate(origin, localX, localY, angle);
  return { ...rotated, localX, localY };
}

function rotate(origin: Point, lx: number, ly: number, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: origin.x + lx * cos - ly * sin,
    y: origin.y + lx * sin + ly * cos
  };
}

function toLocal(point: Point, origin: Point, angle: number): Point {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: dx * cos + dy * sin,
    y: -dx * sin + dy * cos
  };
}
