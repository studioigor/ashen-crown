import type {
  StoryArea,
  StoryBuildingSnapshot,
  StoryCondition,
  StoryControllerGameApi,
  StoryEvent,
  StoryFlag,
  StoryMapDefinition,
  StoryObjective,
  StoryObjectiveStatus,
  StoryObjectiveView,
  StoryPhase,
  StoryPhaseId,
  StoryRestrictions,
  StoryRuntimeEvent,
  StoryTrigger,
  StoryUnitSnapshot
} from './types';
import type { BuildingKind, UnitKind } from '../config';

const STATE_EVAL_MS = 350;

export class StoryController {
  private currentPhaseId: StoryPhaseId;
  private objectives = new Map<string, StoryObjective>();
  private flags = new Map<StoryFlag, boolean>();
  private firedTriggers = new Set<string>();
  private enteredAreas = new Set<string>();
  private phaseStartedAtMs = 0;
  private nextStateEvalMs = 0;
  private started = false;

  constructor(
    private readonly definition: StoryMapDefinition,
    private readonly game: StoryControllerGameApi
  ) {
    this.currentPhaseId = definition.initialPhase;
  }

  start(timeMs = 0): void {
    if (this.started) return;
    this.started = true;
    this.enterPhase(this.definition.initialPhase, timeMs);
  }

  update(timeMs: number, _dtMs: number): void {
    if (!this.started) return;
    this.evaluateTimerTriggers(timeMs);
    this.evaluateAreaTriggers(timeMs);
    if (timeMs >= this.nextStateEvalMs) {
      this.nextStateEvalMs = timeMs + STATE_EVAL_MS;
      this.evaluateTriggers({ type: 'state' }, timeMs);
      this.publishObjectives();
    }
  }

  handle(event: StoryRuntimeEvent, timeMs = this.phaseStartedAtMs): void {
    if (!this.started) return;
    this.evaluateTriggers(event, timeMs);
    this.evaluateTriggers({ type: 'state' }, timeMs);
    this.publishObjectives();
  }

  canBuild(kind: BuildingKind): boolean {
    return !this.buildRestrictionReason(kind);
  }

  canTrain(kind: UnitKind): boolean {
    return !this.trainRestrictionReason(kind);
  }

  buildRestrictionReason(kind: BuildingKind): string | null {
    return restrictionReason(this.currentPhase()?.restrictions, 'build', kind);
  }

  trainRestrictionReason(kind: UnitKind): string | null {
    return restrictionReason(this.currentPhase()?.restrictions, 'train', kind);
  }

  getState(): {
    phase: StoryPhaseId;
    flags: Record<StoryFlag, boolean>;
    objectives: StoryObjectiveView[];
  } {
    return {
      phase: this.currentPhaseId,
      flags: Object.fromEntries(this.flags.entries()),
      objectives: this.objectiveViews()
    };
  }

  setFlag(flag: StoryFlag, value: boolean): void {
    this.flags.set(flag, value);
  }

  private enterPhase(phaseId: StoryPhaseId, timeMs: number): void {
    const phase = this.phaseById(phaseId);
    if (!phase) return;
    this.currentPhaseId = phaseId;
    this.phaseStartedAtMs = timeMs;
    this.nextStateEvalMs = timeMs;
    this.objectives.clear();
    for (const objective of phase.objectives) {
      this.objectives.set(objective.id, {
        ...objective,
        status: objective.status ?? 'active',
        subObjectives: objective.subObjectives?.map((sub) => ({ ...sub }))
      });
    }
    this.publishObjectives();
    this.runEvents(phase.enterEvents ?? [], timeMs);
    this.publishObjectives();
  }

  private evaluateTimerTriggers(timeMs: number): void {
    for (const trigger of this.definition.triggers) {
      if (trigger.on !== 'timer') continue;
      if (!this.isTriggerAvailable(trigger)) continue;
      const delay = trigger.delayMs ?? 0;
      if (timeMs - this.phaseStartedAtMs < delay) continue;
      if (trigger.condition && !this.conditionMet(trigger.condition, { type: 'state' }, timeMs)) continue;
      this.runTrigger(trigger, { type: 'state' }, timeMs);
    }
  }

  private evaluateAreaTriggers(timeMs: number): void {
    const units = this.game.getUnits();
    for (const trigger of this.definition.triggers) {
      if (trigger.on !== 'areaEntered' || !trigger.area) continue;
      if (!this.isTriggerAvailable(trigger)) continue;
      const unit = firstUnitInArea(units, trigger.area);
      if (!unit) continue;
      const areaKey = `${this.currentPhaseId}:${trigger.area.id}:${unit.side}`;
      if (this.enteredAreas.has(areaKey) && trigger.once !== false) continue;
      this.enteredAreas.add(areaKey);
      const event: StoryRuntimeEvent = {
        type: 'areaEntered',
        areaId: trigger.area.id,
        unitId: unit.id,
        side: unit.side
      };
      if (trigger.condition && !this.conditionMet(trigger.condition, event, timeMs)) continue;
      this.runTrigger(trigger, event, timeMs);
    }
  }

  private evaluateTriggers(event: StoryRuntimeEvent, timeMs: number): void {
    for (const trigger of this.definition.triggers) {
      if (trigger.on !== event.type) continue;
      if (!this.isTriggerAvailable(trigger)) continue;
      if (trigger.delayMs !== undefined && timeMs - this.phaseStartedAtMs < trigger.delayMs) continue;
      if (trigger.condition && !this.conditionMet(trigger.condition, event, timeMs)) continue;
      this.runTrigger(trigger, event, timeMs);
    }
  }

  private isTriggerAvailable(trigger: StoryTrigger): boolean {
    if (trigger.phase && trigger.phase !== this.currentPhaseId) return false;
    return trigger.once === false || !this.firedTriggers.has(trigger.id);
  }

  private runTrigger(trigger: StoryTrigger, event: StoryRuntimeEvent, timeMs: number): void {
    if (trigger.once !== false) this.firedTriggers.add(trigger.id);
    this.runEvents(trigger.events, timeMs, event);
  }

  private runEvents(events: StoryEvent[], timeMs: number, _source?: StoryRuntimeEvent): void {
    for (const event of events) {
      switch (event.type) {
        case 'setPhase':
          this.enterPhase(event.phase, timeMs);
          break;
        case 'setFlag':
          this.setFlag(event.flag, event.value);
          break;
        case 'setObjectiveStatus':
          this.setObjectiveStatus(event.objectiveId, event.status);
          break;
        case 'showDialogue':
          this.game.emitDialogue({ lines: event.lines });
          break;
        case 'focusCamera':
          this.game.focusCamera(event.beat);
          break;
        case 'showMessage':
          this.game.showMessage(event.text);
          break;
        case 'playFx':
          this.game.playFx(event.kind, event.x, event.y, event.label);
          break;
        case 'spawnCaravan':
          this.game.spawnCaravan(event.route);
          break;
        case 'endGame':
          this.game.endGame(event.win);
          break;
      }
    }
  }

  private setObjectiveStatus(objectiveId: string, status: StoryObjectiveStatus): void {
    const objective = this.objectives.get(objectiveId);
    if (objective) objective.status = status;
    for (const candidate of this.objectives.values()) {
      const sub = candidate.subObjectives?.find((item) => item.id === objectiveId);
      if (sub) sub.status = status;
    }
  }

  private conditionMet(condition: StoryCondition, event: StoryRuntimeEvent, timeMs: number): boolean {
    if ('all' in condition) return condition.all.every((child) => this.conditionMet(child, event, timeMs));
    if ('any' in condition) return condition.any.some((child) => this.conditionMet(child, event, timeMs));
    if ('not' in condition) return !this.conditionMet(condition.not, event, timeMs);

    switch (condition.type) {
      case 'flag':
        return (this.flags.get(condition.flag) ?? false) === (condition.value ?? true);
      case 'objectiveStatus':
        return this.objectives.get(condition.objectiveId)?.status === condition.status;
      case 'buildingCount':
        return countBuildings(this.game.getBuildings(), condition) >= condition.count;
      case 'unitCount':
        return countUnits(this.game.getUnits(), condition) >= condition.count;
      case 'elapsedMs':
        return timeMs - this.phaseStartedAtMs >= condition.ms;
      case 'event':
        return eventMatches(condition, event);
    }
  }

  private objectiveViews(): StoryObjectiveView[] {
    return [...this.objectives.values()]
      .filter((objective) => (objective.status ?? 'active') !== 'hidden')
      .map((objective) => ({
        id: objective.id,
        title: objective.title,
        description: objective.description,
        optional: !!objective.optional,
        status: objective.status ?? 'active',
        subObjectives: (objective.subObjectives ?? [])
          .filter((sub) => (sub.status ?? 'active') !== 'hidden')
          .map((sub) => ({
            id: sub.id,
            title: sub.title,
            status: sub.condition && this.conditionMet(sub.condition, { type: 'state' }, this.phaseStartedAtMs)
              ? 'completed'
              : sub.status ?? 'active'
          }))
      }));
  }

  private publishObjectives(): void {
    this.game.emitObjectives({ objectives: this.objectiveViews() });
  }

  private currentPhase(): StoryPhase | null {
    return this.phaseById(this.currentPhaseId);
  }

  private phaseById(phaseId: StoryPhaseId): StoryPhase | null {
    return this.definition.phases.find((phase) => phase.id === phaseId) ?? null;
  }
}

function restrictionReason(
  restrictions: StoryRestrictions | undefined,
  type: 'build' | 'train',
  kind: BuildingKind | UnitKind
): string | null {
  if (!restrictions) return null;
  if (type === 'build') {
    const buildKind = kind as BuildingKind;
    if (!restrictions.buildAllowed || restrictions.buildAllowed.includes(buildKind)) return null;
    return restrictions.buildReasons?.[buildKind] ?? restrictions.defaultBuildReason ?? 'Недоступно в текущей сюжетной фазе';
  }
  const unitKind = kind as UnitKind;
  if (!restrictions.trainAllowed || restrictions.trainAllowed.includes(unitKind)) return null;
  return restrictions.trainReasons?.[unitKind] ?? restrictions.defaultTrainReason ?? 'Недоступно в текущей сюжетной фазе';
}

function countBuildings(
  buildings: StoryBuildingSnapshot[],
  condition: Extract<StoryCondition, { type: 'buildingCount' }>
): number {
  return buildings.filter((building) => {
    if (!building.alive) return false;
    if (condition.side !== undefined && building.side !== condition.side) return false;
    if (condition.kind && building.buildingKind !== condition.kind) return false;
    if (condition.completed !== undefined && building.completed !== condition.completed) return false;
    return true;
  }).length;
}

function countUnits(
  units: StoryUnitSnapshot[],
  condition: Extract<StoryCondition, { type: 'unitCount' }>
): number {
  return units.filter((unit) => {
    if (!unit.alive) return false;
    if (condition.side !== undefined && unit.side !== condition.side) return false;
    if (condition.kind && unit.unitKind !== condition.kind) return false;
    return true;
  }).length;
}

function eventMatches(condition: Extract<StoryCondition, { type: 'event' }>, event: StoryRuntimeEvent): boolean {
  if (condition.eventType !== event.type) return false;
  if (condition.areaId && event.type === 'areaEntered' && event.areaId !== condition.areaId) return false;
  if (condition.side !== undefined && 'side' in event && event.side !== condition.side) return false;
  if (condition.kind) {
    if (event.type === 'unitKilled' || event.type === 'unitTrained') return event.unitKind === condition.kind;
    if (event.type === 'buildingDestroyed' || event.type === 'buildingCompleted') return event.buildingKind === condition.kind;
    return false;
  }
  return true;
}

function firstUnitInArea(units: StoryUnitSnapshot[], area: StoryArea): StoryUnitSnapshot | null {
  const r2 = area.radius * area.radius;
  for (const unit of units) {
    if (!unit.alive) continue;
    if (area.side !== undefined && unit.side !== area.side) continue;
    const dx = unit.x - area.x;
    const dy = unit.y - area.y;
    if (dx * dx + dy * dy <= r2) return unit;
  }
  return null;
}
