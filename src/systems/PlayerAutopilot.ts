import Phaser from 'phaser';
import { SIDE, TILE } from '../config';
import { Building } from '../entities/Building';
import { Unit } from '../entities/Unit';
import { IEntity } from '../entities/Entity';
import { ResourceNode } from '../entities/ResourceNode';
import type { GameScene } from '../scenes/GameScene';

const THINK_MS = { min: 650, max: 1050 };
const WORKER_BUILD_RADIUS = TILE * 16;
const WORKER_RESOURCE_RADIUS = TILE * 18;
const MILITARY_LEASH = TILE * 13;
const MILITARY_LEASH_GRACE = TILE * 2;
const BASE_DEFENSE_RADIUS = TILE * 9;

export function runPlayerAutopilot(scene: GameScene): void {
  if (!scene.isAutopilotAllowed()) return;

  const now = scene.time.now;
  for (const unit of scene.units) {
    if (!unit.alive || unit.side !== SIDE.player || !unit.autopilot) continue;
    if (!unit.autopilotAnchor) unit.autopilotAnchor = { x: unit.x, y: unit.y };
    if (now < unit.autopilotNextThinkMs) continue;

    unit.autopilotNextThinkMs = now + Phaser.Math.Between(THINK_MS.min, THINK_MS.max);
    if (unit.isWorker()) runWorkerAutopilot(scene, unit);
    else runMilitaryAutopilot(scene, unit);
  }
}

function runWorkerAutopilot(scene: GameScene, unit: Unit): void {
  if (unit.cargo) {
    if (unit.state !== 'return_cargo') {
      const hall = scene.findNearestHall(unit);
      if (hall) scene.orderReturnCargo(unit, hall);
    }
    return;
  }

  if (unit.state !== 'idle') return;

  const site = findNearestUnfinishedBuilding(scene, unit, WORKER_BUILD_RADIUS);
  if (site) {
    scene.orderBuild(unit, site);
    return;
  }

  const resource = findNearestResource(scene, unit, WORKER_RESOURCE_RADIUS);
  if (resource) scene.orderGather(unit, resource);
}

function runMilitaryAutopilot(scene: GameScene, unit: Unit): void {
  const anchor = unit.autopilotAnchor ?? { x: unit.x, y: unit.y };
  const activeTarget = activeCombatTarget(unit);

  if (activeTarget && !isAllowedMilitaryTarget(scene, unit, activeTarget, anchor)) {
    scene.orderMove(unit, anchor.x, anchor.y);
    return;
  }

  const distFromAnchor = Phaser.Math.Distance.Between(unit.x, unit.y, anchor.x, anchor.y);
  if (distFromAnchor > MILITARY_LEASH + MILITARY_LEASH_GRACE) {
    if (!isMovingToward(unit, anchor)) scene.orderMove(unit, anchor.x, anchor.y);
    return;
  }

  if (unit.state !== 'idle') return;

  const nearbyTarget = findNearestVisibleEnemy(scene, unit, unit.sight * TILE, anchor);
  if (nearbyTarget) {
    scene.orderAttack(unit, nearbyTarget);
    return;
  }

  const defenseTarget = findBaseDefenseTarget(scene, unit, anchor);
  if (defenseTarget) scene.orderAttack(unit, defenseTarget);
}

function findNearestUnfinishedBuilding(scene: GameScene, unit: Unit, maxRange: number): Building | null {
  let best: Building | null = null;
  let bestD = maxRange;
  for (const building of scene.buildings) {
    if (!building.alive || building.side !== unit.side || building.completed) continue;
    const d = Phaser.Math.Distance.Between(unit.x, unit.y, building.x, building.y);
    if (d < bestD) {
      best = building;
      bestD = d;
    }
  }
  return best;
}

function findNearestResource(scene: GameScene, unit: Unit, maxRange: number): ResourceNode | null {
  let best: ResourceNode | null = null;
  let bestD = maxRange;
  for (const resource of scene.resources) {
    if (!resource.alive) continue;
    const d = Phaser.Math.Distance.Between(unit.x, unit.y, resource.x, resource.y);
    if (d < bestD) {
      best = resource;
      bestD = d;
    }
  }
  return best;
}

function findNearestVisibleEnemy(
  scene: GameScene,
  unit: Unit,
  maxRange: number,
  anchor: { x: number; y: number }
): IEntity | null {
  let best: IEntity | null = null;
  let bestD = maxRange;

  for (const other of scene.units) {
    if (!isEnemyTarget(scene, unit, other)) continue;
    if (!withinLeash(other, anchor)) continue;
    const d = Phaser.Math.Distance.Between(unit.x, unit.y, other.x, other.y);
    if (d < bestD) {
      best = other;
      bestD = d;
    }
  }

  for (const building of scene.buildings) {
    if (!isEnemyTarget(scene, unit, building)) continue;
    if (!withinLeash(building, anchor)) continue;
    const d = Phaser.Math.Distance.Between(unit.x, unit.y, building.x, building.y);
    if (d < bestD) {
      best = building;
      bestD = d;
    }
  }

  return best;
}

function findBaseDefenseTarget(scene: GameScene, unit: Unit, anchor: { x: number; y: number }): IEntity | null {
  let best: Unit | null = null;
  let bestD = Infinity;

  for (const building of scene.buildings) {
    if (!building.alive || building.side !== unit.side) continue;
    if (Phaser.Math.Distance.Between(building.x, building.y, anchor.x, anchor.y) > MILITARY_LEASH) continue;

    for (const enemy of scene.units) {
      if (!isEnemyTarget(scene, unit, enemy)) continue;
      if (!withinLeash(enemy, anchor)) continue;
      const threatD = Phaser.Math.Distance.Between(enemy.x, enemy.y, building.x, building.y);
      if (threatD > building.radius + BASE_DEFENSE_RADIUS) continue;
      const unitD = Phaser.Math.Distance.Between(unit.x, unit.y, enemy.x, enemy.y);
      if (unitD < bestD) {
        best = enemy;
        bestD = unitD;
      }
    }
  }

  return best;
}

function activeCombatTarget(unit: Unit): IEntity | null {
  if (unit.targetUnit?.alive) return unit.targetUnit;
  if (unit.targetBuilding?.alive) return unit.targetBuilding;
  return null;
}

function isAllowedMilitaryTarget(
  scene: GameScene,
  unit: Unit,
  target: IEntity,
  anchor: { x: number; y: number }
): boolean {
  if (!isEnemyTarget(scene, unit, target)) return false;
  if (withinLeash(target, anchor)) return true;
  return isThreateningAnchoredBase(scene, unit, target, anchor);
}

function isThreateningAnchoredBase(
  scene: GameScene,
  unit: Unit,
  target: IEntity,
  anchor: { x: number; y: number }
): boolean {
  if (target.kind !== 'unit') return false;
  for (const building of scene.buildings) {
    if (!building.alive || building.side !== unit.side) continue;
    if (Phaser.Math.Distance.Between(building.x, building.y, anchor.x, anchor.y) > MILITARY_LEASH) continue;
    if (Phaser.Math.Distance.Between(target.x, target.y, building.x, building.y) <= building.radius + BASE_DEFENSE_RADIUS) return true;
  }
  return false;
}

function isEnemyTarget(scene: GameScene, unit: Unit, target: IEntity): boolean {
  if (!target.alive || target.side === unit.side || target.side === SIDE.neutral) return false;
  return isVisible(scene, target);
}

function isVisible(scene: GameScene, target: IEntity): boolean {
  if (target.side === SIDE.player) return true;
  const { tx, ty } = scene.map.worldToTile(target.x, target.y);
  return scene.fog.isVisible(tx, ty);
}

function withinLeash(target: IEntity, anchor: { x: number; y: number }): boolean {
  return Phaser.Math.Distance.Between(target.x, target.y, anchor.x, anchor.y) <= MILITARY_LEASH;
}

function isMovingToward(unit: Unit, point: { x: number; y: number }): boolean {
  if (unit.state !== 'move' || !unit.pathDest) return false;
  return Phaser.Math.Distance.Between(unit.pathDest.x, unit.pathDest.y, point.x, point.y) <= TILE;
}
