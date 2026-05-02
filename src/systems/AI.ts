import Phaser from 'phaser';
import { GameScene } from '../scenes/GameScene';
import { SIDE, UNIT, BUILDING, TILE, BuildingKind, UnitKind, Difficulty, DIFFICULTY } from '../config';
import { Unit } from '../entities/Unit';
import { Building } from '../entities/Building';
import { Caravan } from '../entities/Caravan';
import { IEntity } from '../entities/Entity';

export interface AIState {
  phase: 'economy' | 'military' | 'defense' | 'attack' | 'regroup';
  nextCheckMs: number;
  armyTargetScore: number;
  regroupUntilMs: number;
  lastPressureMs: number;
  lastAttackOrderMs: number;
  lastDefenseOrderMs: number;
  lastCaravanOrderMs: number;
}

export function runAI(scene: GameScene, ai: AIState, difficulty: Difficulty): void {
  if (scene.time.now < ai.nextCheckMs) return;
  const tuning = DIFFICULTY[difficulty];
  ai.nextCheckMs = scene.time.now + tuning.aiDelayMs;

  const side = SIDE.ai;
  const buildings = scene.buildings.filter(b => b.side === side && b.alive);
  const units = scene.units.filter(u => u.side === side && u.alive);
  const workers = units.filter(u => u.unitKind === 'worker');
  const army = units.filter(u => u.unitKind !== 'worker');
  const econ = scene.economy.get(side);
  const hall = buildings.find(b => b.buildingKind === 'townhall' && b.completed);
  if (!hall) return;

  assignIdleWorkers(scene, workers);
  const pressure = enemyPressureNear(scene, hall, tuning.defenseRadiusTiles);
  if (pressure) ai.lastPressureMs = scene.time.now;

  const hasBarracks = buildings.some(b => b.buildingKind === 'barracks' && b.completed);
  const hasWorkshop = buildings.some(b => b.buildingKind === 'workshop' && b.completed);
  const barracks = buildings.find(b => b.buildingKind === 'barracks' && b.completed);
  const workshop = buildings.find(b => b.buildingKind === 'workshop' && b.completed);

  if (econ.food + 3 >= econ.foodCap && !isBuilding(scene, 'farm')) tryBuild(scene, 'farm', hall, workers);
  if (workers.length < tuning.targetWorkers && hall.queue.length < tuning.townhallQueueCap) tryTrain(scene, hall, 'worker');
  if (!hasBarracks && workers.length >= 4 && !isBuilding(scene, 'barracks')) tryBuild(scene, 'barracks', hall, workers);
  if (hasBarracks && !hasWorkshop && workers.length >= 7 && !isBuilding(scene, 'workshop')) tryBuild(scene, 'workshop', hall, workers);
  if ((pressure || recentlyPressured(scene, ai, tuning.defenseHoldMs)) && !nearbyTower(buildings, hall) && !isBuilding(scene, 'tower')) {
    tryBuild(scene, 'tower', hall, workers, 5);
  }

  if (barracks && barracks.queue.length < tuning.barracksQueueCap) {
    const pick = pickBarracksUnit(scene, hasWorkshop);
    if (pick) tryTrain(scene, barracks, pick);
    barracks.rally = rallyPoint(hall, -90, 0);
  }
  if (workshop && workshop.queue.length < tuning.workshopQueueCap) {
    tryTrain(scene, workshop, 'catapult');
    workshop.rally = rallyPoint(hall, -120, 35);
  }

  if (handleDefense(scene, ai, army, hall, pressure, tuning.defenseHoldMs)) {
    assignIdleWorkers(scene, workers);
    return;
  }

  if (handleCaravanOpportunity(scene, ai, army, hall, tuning.caravanOpportunityRadiusTiles)) {
    assignIdleWorkers(scene, workers);
    return;
  }

  const armyScore = army.reduce((sum, u) => sum + UNIT[u.unitKind].score, 0);
  if (ai.phase === 'regroup' && scene.time.now < ai.regroupUntilMs) {
    rallyArmy(scene, army, hall);
    assignIdleWorkers(scene, workers);
    return;
  }

  if (ai.phase === 'attack') {
    const attackingScore = army
      .filter(u => u.state === 'attack' || u.state === 'attack_move')
      .reduce((sum, u) => sum + UNIT[u.unitKind].score, 0);
    if (attackingScore < Math.max(3, ai.armyTargetScore * 0.45)) {
      startRegroup(scene, ai, difficulty);
    }
  } else if (armyScore >= ai.armyTargetScore && army.length >= tuning.attackWaveMinUnits) {
    const target = findAttackTarget(scene);
    if (target) {
      const attackers = army.filter(u => u.canAttack());
      scene.orderAttackMoveGroup(attackers, target.x, target.y);
      ai.phase = 'attack';
      ai.lastAttackOrderMs = scene.time.now;
    }
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
      scene.orderGather(w, node);
      if (node.resourceType === 'gold') goldWorkers++;
      else lumberWorkers++;
    }
  }
}

function tryBuild(scene: GameScene, kind: BuildingKind, hall: Building, workers: Unit[], preferredRadius = 4): boolean {
  const def = BUILDING[kind];
  if (!scene.economy.canAfford(SIDE.ai, def.cost.gold, def.cost.lumber)) return false;
  const spot = findBuildSpot(scene, hall, kind, preferredRadius);
  if (!spot) return false;
  const worker = workers.find(w => w.state === 'gather' || w.state === 'idle') ?? workers[0];
  if (!worker) return false;
  scene.economy.spend(SIDE.ai, def.cost.gold, def.cost.lumber);
  const b = scene.spawnBuilding(spot.tx, spot.ty, kind, SIDE.ai, hall.race, false);
  scene.orderBuild(worker, b);
  return true;
}

function findBuildSpot(scene: GameScene, hall: Building, kind: BuildingKind, preferredRadius: number): { tx: number; ty: number } | null {
  const { tx: cx, ty: cy } = hall.centerTile();
  for (let r = preferredRadius; r < 15; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const tx = cx + dx, ty = cy + dy;
        if (scene.canPlace(tx, ty, kind)) return { tx, ty };
      }
    }
  }
  return null;
}

function isBuilding(scene: GameScene, kind: BuildingKind): boolean {
  return scene.buildings.some(b => b.side === SIDE.ai && b.alive && b.buildingKind === kind && !b.completed);
}

function nearbyTower(buildings: Building[], hall: Building): boolean {
  return buildings.some(b => b.buildingKind === 'tower' && Phaser.Math.Distance.Between(b.x, b.y, hall.x, hall.y) < TILE * 10);
}

function enemyPressureNear(scene: GameScene, hall: Building, radiusTiles: number): Unit | null {
  let best: Unit | null = null;
  let bestD = Infinity;
  const radius = radiusTiles * TILE;
  for (const u of scene.units) {
    if (u.side !== SIDE.player || !u.alive) continue;
    const d = Phaser.Math.Distance.Between(u.x, u.y, hall.x, hall.y);
    if (d < radius && d < bestD) {
      best = u;
      bestD = d;
    }
  }
  return best;
}

function rallyArmy(scene: GameScene, army: Unit[], hall: Building): void {
  const regrouping = army.filter(u => u.state === 'idle' || u.state === 'move' || u.state === 'attack_move');
  const point = rallyPoint(hall, -110, 45);
  scene.orderMoveGroup(regrouping, point.x, point.y);
}

function handleDefense(
  scene: GameScene,
  ai: AIState,
  army: Unit[],
  hall: Building,
  pressure: Unit | null,
  holdMs: number
): boolean {
  const underPressure = !!pressure || recentlyPressured(scene, ai, holdMs);
  if (!underPressure) return false;
  ai.phase = 'defense';

  if (pressure && scene.time.now - ai.lastDefenseOrderMs > 2500) {
    const defenders = army.filter(u => u.canAttack() && Phaser.Math.Distance.Between(u.x, u.y, hall.x, hall.y) < TILE * 18);
    if (defenders.length > 0) {
      scene.orderAttackMoveGroup(defenders, pressure.x, pressure.y);
      ai.lastDefenseOrderMs = scene.time.now;
    }
  } else if (scene.time.now - ai.lastDefenseOrderMs > 2500) {
    rallyArmy(scene, army.filter(u => u.state !== 'attack'), hall);
    ai.lastDefenseOrderMs = scene.time.now;
  }
  return true;
}

function handleCaravanOpportunity(
  scene: GameScene,
  ai: AIState,
  army: Unit[],
  hall: Building,
  radiusTiles: number
): boolean {
  if (ai.phase === 'attack' || ai.phase === 'defense') return false;
  if (scene.time.now - ai.lastCaravanOrderMs < 8000) return false;

  const radius = radiusTiles * TILE;
  const caravan = findCaravanOpportunity(scene, army, hall, radius);
  if (!caravan) return false;

  const hunters = army
    .filter(u => u.canAttack() && (u.state === 'idle' || u.state === 'move'))
    .filter(u => Phaser.Math.Distance.Between(u.x, u.y, caravan.x, caravan.y) < radius)
    .slice(0, 4);
  if (hunters.length < 2) return false;

  for (const hunter of hunters) scene.orderAttack(hunter, caravan);
  ai.lastCaravanOrderMs = scene.time.now;
  return true;
}

function findCaravanOpportunity(scene: GameScene, army: Unit[], hall: Building, radius: number): Caravan | null {
  let best: Caravan | null = null;
  let bestD = Infinity;
  for (const caravan of scene.caravans) {
    if (!caravan.alive) continue;
    const baseD = Phaser.Math.Distance.Between(caravan.x, caravan.y, hall.x, hall.y);
    const nearbyArmy = army.some(u => u.canAttack() && Phaser.Math.Distance.Between(u.x, u.y, caravan.x, caravan.y) < radius);
    if (baseD > radius && !nearbyArmy) continue;
    if (baseD < bestD) {
      best = caravan;
      bestD = baseD;
    }
  }
  return best;
}

function startRegroup(scene: GameScene, ai: AIState, difficulty: Difficulty): void {
  const tuning = DIFFICULTY[difficulty];
  ai.phase = 'regroup';
  ai.regroupUntilMs = scene.time.now + tuning.regroupMs;
  ai.armyTargetScore += tuning.regroupGrowth;
}

function rallyPoint(hall: Building, ox: number, oy: number): { x: number; y: number } {
  return { x: hall.x + ox, y: hall.y + oy };
}

function recentlyPressured(scene: GameScene, ai: AIState, holdMs: number): boolean {
  return Number.isFinite(ai.lastPressureMs) && scene.time.now - ai.lastPressureMs < holdMs;
}

function findAttackTarget(scene: GameScene): IEntity | null {
  const hall = scene.buildings.find(b => b.alive && b.side === SIDE.player && b.buildingKind === 'townhall');
  if (hall) return hall;
  const production = scene.buildings.find(b => b.alive && b.side === SIDE.player && (b.buildingKind === 'barracks' || b.buildingKind === 'workshop'));
  if (production) return production;
  const anyBuilding = scene.buildings.find(b => b.alive && b.side === SIDE.player);
  if (anyBuilding) return anyBuilding;
  const anyUnit = scene.units.find(u => u.alive && u.side === SIDE.player);
  return anyUnit ?? null;
}
