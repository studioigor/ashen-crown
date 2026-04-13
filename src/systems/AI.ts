import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene';
import { SIDE, UNIT, BUILDING, TILE, BuildingKind, UnitKind, Difficulty, DIFFICULTY } from '../config';
import { Unit } from '../entities/Unit';
import { Building } from '../entities/Building';

export interface AIState {
  phase: 'economy' | 'military' | 'attack' | 'regroup';
  nextCheckMs: number;
  armyTargetScore: number;
  regroupUntilMs: number;
  lastPressureMs: number;
}

export function runAI(scene: GameScene, ai: AIState, difficulty: Difficulty): void {
  if (scene.time.now < ai.nextCheckMs) return;
  ai.nextCheckMs = scene.time.now + DIFFICULTY[difficulty].aiDelayMs;

  const side = SIDE.ai;
  const buildings = scene.buildings.filter(b => b.side === side && b.alive);
  const units = scene.units.filter(u => u.side === side && u.alive);
  const workers = units.filter(u => u.unitKind === 'worker');
  const army = units.filter(u => u.unitKind !== 'worker');
  const econ = scene.economy.get(side);
  const hall = buildings.find(b => b.buildingKind === 'townhall' && b.completed);
  if (!hall) return;

  assignIdleWorkers(scene, workers);
  const pressure = enemyPressureNear(scene, hall);
  if (pressure) ai.lastPressureMs = scene.time.now;

  const hasBarracks = buildings.some(b => b.buildingKind === 'barracks' && b.completed);
  const hasWorkshop = buildings.some(b => b.buildingKind === 'workshop' && b.completed);
  const barracks = buildings.find(b => b.buildingKind === 'barracks' && b.completed);
  const workshop = buildings.find(b => b.buildingKind === 'workshop' && b.completed);

  if (econ.food + 3 >= econ.foodCap && !isBuilding(scene, 'farm')) tryBuild(scene, 'farm', hall, workers);
  if (workers.length < DIFFICULTY[difficulty].targetWorkers && hall.queue.length < 2) tryTrain(scene, hall, 'worker');
  if (!hasBarracks && workers.length >= 4 && !isBuilding(scene, 'barracks')) tryBuild(scene, 'barracks', hall, workers);
  if (hasBarracks && !hasWorkshop && workers.length >= 7 && !isBuilding(scene, 'workshop')) tryBuild(scene, 'workshop', hall, workers);
  if ((pressure || scene.time.now - ai.lastPressureMs < 12000) && !nearbyTower(buildings, hall) && !isBuilding(scene, 'tower')) {
    tryBuild(scene, 'tower', hall, workers, 5);
  }

  if (barracks && barracks.queue.length < 2) {
    const pick = pickBarracksUnit(scene, hasWorkshop);
    if (pick) tryTrain(scene, barracks, pick);
    barracks.rally = { x: hall.x - 90, y: hall.y };
  }
  if (workshop && workshop.queue.length < 1) {
    tryTrain(scene, workshop, 'catapult');
    workshop.rally = { x: hall.x - 120, y: hall.y + 35 };
  }

  const armyScore = army.reduce((sum, u) => sum + UNIT[u.unitKind].score, 0);
  if (ai.phase === 'regroup' && scene.time.now < ai.regroupUntilMs) {
    rallyArmy(scene, army, hall);
    assignIdleWorkers(scene, workers);
    return;
  }

  if (armyScore >= ai.armyTargetScore) {
    const target = findAttackTarget(scene);
    if (target) {
      for (const u of army) {
        if (u.state !== 'attack' && u.state !== 'attack_move') {
          u.clearOrders();
          u.state = 'attack_move';
          u.attackMoveTo = { x: target.x, y: target.y };
          scene.repath(u, target.x, target.y);
        }
      }
      ai.phase = 'attack';
    }
  } else if (ai.phase === 'attack') {
    ai.phase = 'regroup';
    ai.regroupUntilMs = scene.time.now + (difficulty === 'hard' ? 6500 : 9500);
    ai.armyTargetScore += difficulty === 'hard' ? 2 : 3;
  } else {
    ai.phase = hasBarracks ? 'military' : 'economy';
  }

  assignIdleWorkers(scene, workers);
}

function tryTrain(scene: GameScene, producer: Building, kind: UnitKind): boolean {
  const def = UNIT[kind];
  if (producer.buildingKind !== def.producer) return false;
  const requires = def.requires as BuildingKind | undefined;
  if (requires && !scene.buildings.some(b => b.alive && b.completed && b.side === SIDE.ai && b.buildingKind === requires)) return false;
  if (!scene.economy.hasFoodRoom(SIDE.ai, def.food)) {
    const hall = scene.buildings.find(b => b.side === SIDE.ai && b.alive && b.completed && b.buildingKind === 'townhall');
    const workers = scene.units.filter(u => u.side === SIDE.ai && u.alive && u.unitKind === 'worker');
    if (hall && !isBuilding(scene, 'farm')) tryBuild(scene, 'farm', hall, workers);
    return false;
  }
  if (producer.queue.length >= 4) return false;
  if (!scene.economy.canAfford(SIDE.ai, def.cost.gold, def.cost.lumber)) return false;
  scene.economy.spend(SIDE.ai, def.cost.gold, def.cost.lumber);
  producer.enqueue(kind);
  return true;
}

function pickBarracksUnit(scene: GameScene, hasWorkshop: boolean): UnitKind | null {
  const econ = scene.economy.get(SIDE.ai);
  const army = scene.units.filter(u => u.side === SIDE.ai && u.alive && u.unitKind !== 'worker');
  const archers = army.filter(u => u.unitKind === 'archer').length;
  const footmen = army.filter(u => u.unitKind === 'footman').length;
  const knights = army.filter(u => u.unitKind === 'knight').length;

  if (hasWorkshop && knights < 3 && econ.gold >= UNIT.knight.cost.gold && econ.lumber >= UNIT.knight.cost.lumber) return 'knight';
  if (archers < footmen && econ.lumber >= UNIT.archer.cost.lumber) return 'archer';
  if (econ.gold >= UNIT.footman.cost.gold) return 'footman';
  return null;
}

function assignIdleWorkers(scene: GameScene, workers: Unit[]): void {
  let goldWorkers = workers.filter(w => w.targetResource?.resourceType === 'gold').length;
  let lumberWorkers = workers.filter(w => w.targetResource?.resourceType === 'lumber').length;
  for (const w of workers) {
    if (w.state !== 'idle' && !(w.state === 'gather' && !w.targetResource)) continue;
    const type: 'gold' | 'lumber' = goldWorkers < lumberWorkers + 2 ? 'gold' : 'lumber';
    const node = scene.findNearestResource(w, type) ?? scene.findNearestResource(w, type === 'gold' ? 'lumber' : 'gold');
    if (node) {
      w.targetResource = node;
      w.state = 'gather';
      if (node.resourceType === 'gold') goldWorkers++;
      else lumberWorkers++;
    }
  }
}

function tryBuild(scene: GameScene, kind: BuildingKind, hall: Building, workers: Unit[], preferredRadius = 4): boolean {
  const def = BUILDING[kind];
  if (!scene.economy.canAfford(SIDE.ai, def.cost.gold, def.cost.lumber)) return false;
  const spot = findBuildSpot(scene, hall, def.size, preferredRadius);
  if (!spot) return false;
  const worker = workers.find(w => w.state === 'gather' || w.state === 'idle') ?? workers[0];
  if (!worker) return false;
  scene.economy.spend(SIDE.ai, def.cost.gold, def.cost.lumber);
  const b = scene.spawnBuilding(spot.tx, spot.ty, kind, SIDE.ai, hall.race, false);
  scene.orderBuild(worker, b);
  return true;
}

function findBuildSpot(scene: GameScene, hall: Building, size: number, preferredRadius: number): { tx: number; ty: number } | null {
  const { tx: cx, ty: cy } = hall.centerTile();
  for (let r = preferredRadius; r < 15; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const tx = cx + dx, ty = cy + dy;
        if (scene.canPlace(tx, ty, sizeToKind(size))) return { tx, ty };
      }
    }
  }
  return null;
}

function sizeToKind(size: number): BuildingKind {
  return size === BUILDING.farm.size ? 'farm' : 'barracks';
}

function isBuilding(scene: GameScene, kind: BuildingKind): boolean {
  return scene.buildings.some(b => b.side === SIDE.ai && b.alive && b.buildingKind === kind && !b.completed);
}

function nearbyTower(buildings: Building[], hall: Building): boolean {
  return buildings.some(b => b.buildingKind === 'tower' && Phaser.Math.Distance.Between(b.x, b.y, hall.x, hall.y) < TILE * 10);
}

function enemyPressureNear(scene: GameScene, hall: Building): boolean {
  return scene.units.some(u => u.side === SIDE.player && u.alive && Phaser.Math.Distance.Between(u.x, u.y, hall.x, hall.y) < TILE * 13);
}

function rallyArmy(scene: GameScene, army: Unit[], hall: Building): void {
  for (const u of army) {
    if (u.state === 'idle' || u.state === 'attack_move') scene.orderMove(u, hall.x - 110, hall.y + 45);
  }
}

function findAttackTarget(scene: GameScene): Building | Unit | null {
  const hall = scene.buildings.find(b => b.alive && b.side === SIDE.player && b.buildingKind === 'townhall');
  if (hall) return hall;
  const anyBuilding = scene.buildings.find(b => b.alive && b.side === SIDE.player);
  if (anyBuilding) return anyBuilding;
  const anyUnit = scene.units.find(u => u.alive && u.side === SIDE.player);
  return anyUnit ?? null;
}
