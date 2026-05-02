import type { BuildingKind, Race, Side, StoryMapId, UnitKind } from '../config';
import type { MapLayout } from '../world/MapGenerator';
import type { ResourceType } from '../entities/ResourceNode';

export type StoryFlag = string;
export type StoryPhaseId = string;
export type StoryObjectiveId = string;
export type StoryObjectiveStatus = 'hidden' | 'active' | 'completed' | 'failed';

export interface StorySubObjective {
  id: StoryObjectiveId;
  title: string;
  status?: StoryObjectiveStatus;
  condition?: StoryCondition;
}

export interface StoryObjective {
  id: StoryObjectiveId;
  title: string;
  description?: string;
  optional?: boolean;
  status?: StoryObjectiveStatus;
  subObjectives?: StorySubObjective[];
}

export interface StoryObjectiveView {
  id: StoryObjectiveId;
  title: string;
  description?: string;
  optional: boolean;
  status: StoryObjectiveStatus;
  subObjectives: Array<{
    id: StoryObjectiveId;
    title: string;
    status: StoryObjectiveStatus;
  }>;
}

export interface StoryDialogueLine {
  speaker: string;
  text: string;
  durationMs?: number;
  requireContinue?: boolean;
}

export interface StoryDialoguePayload {
  lines: StoryDialogueLine[];
}

export interface StoryObjectivePayload {
  objectives: StoryObjectiveView[];
}

export interface StoryCameraBeat {
  x: number;
  y: number;
  durationMs?: number;
  lockMs?: number;
}

export interface StoryArea {
  id: string;
  x: number;
  y: number;
  radius: number;
  side?: Side;
}

export interface StoryRestrictions {
  buildAllowed?: readonly BuildingKind[];
  trainAllowed?: readonly UnitKind[];
  buildReasons?: Partial<Record<BuildingKind, string>>;
  trainReasons?: Partial<Record<UnitKind, string>>;
  defaultBuildReason?: string;
  defaultTrainReason?: string;
}

export interface StoryPhase {
  id: StoryPhaseId;
  title: string;
  objectives: StoryObjective[];
  restrictions?: StoryRestrictions;
  enterEvents?: StoryEvent[];
}

export type StoryTriggerEventType =
  | 'state'
  | 'timer'
  | 'unitKilled'
  | 'buildingDestroyed'
  | 'buildingCompleted'
  | 'unitTrained'
  | 'resourceGathered'
  | 'areaEntered'
  | 'caravanResolved';

export interface StoryTrigger {
  id: string;
  phase?: StoryPhaseId;
  on: StoryTriggerEventType;
  once?: boolean;
  delayMs?: number;
  area?: StoryArea;
  condition?: StoryCondition;
  events: StoryEvent[];
}

export type StoryCondition =
  | { all: StoryCondition[] }
  | { any: StoryCondition[] }
  | { not: StoryCondition }
  | { type: 'flag'; flag: StoryFlag; value?: boolean }
  | { type: 'objectiveStatus'; objectiveId: StoryObjectiveId; status: StoryObjectiveStatus }
  | { type: 'buildingCount'; side?: Side; kind?: BuildingKind; completed?: boolean; count: number }
  | { type: 'unitCount'; side?: Side; kind?: UnitKind; count: number }
  | { type: 'elapsedMs'; ms: number }
  | { type: 'event'; eventType: StoryTriggerEventType; side?: Side; kind?: UnitKind | BuildingKind; areaId?: string };

export type StoryEvent =
  | { type: 'setPhase'; phase: StoryPhaseId }
  | { type: 'setFlag'; flag: StoryFlag; value: boolean }
  | { type: 'setObjectiveStatus'; objectiveId: StoryObjectiveId; status: StoryObjectiveStatus }
  | { type: 'showDialogue'; lines: StoryDialogueLine[] }
  | { type: 'focusCamera'; beat: StoryCameraBeat }
  | { type: 'showMessage'; text: string }
  | { type: 'playFx'; kind: 'marker' | 'smoke' | 'embers' | 'mist'; x: number; y: number; label?: string }
  | { type: 'spawnCaravan'; route: Array<{ x: number; y: number }> }
  | { type: 'endGame'; win: boolean };

export type StoryRuntimeEvent =
  | { type: 'state' }
  | { type: 'unitKilled'; unitId: number; unitKind: UnitKind; side: Side; bySide?: Side }
  | { type: 'buildingDestroyed'; buildingId: number; buildingKind: BuildingKind; side: Side; bySide?: Side }
  | { type: 'buildingCompleted'; buildingId: number; buildingKind: BuildingKind; side: Side }
  | { type: 'unitTrained'; unitId: number; unitKind: UnitKind; side: Side }
  | { type: 'resourceGathered'; side: Side; resourceType: ResourceType; amount: number }
  | { type: 'areaEntered'; areaId: string; unitId: number; side: Side }
  | { type: 'caravanResolved'; caravanId: number; outcome: 'destroyed' | 'escaped'; bySide?: Side };

export interface StoryUnitSnapshot {
  id: number;
  side: Side;
  unitKind: UnitKind;
  x: number;
  y: number;
  alive: boolean;
}

export interface StoryBuildingSnapshot {
  id: number;
  side: Side;
  buildingKind: BuildingKind;
  completed: boolean;
  alive: boolean;
}

export interface StoryControllerGameApi {
  getUnits(): StoryUnitSnapshot[];
  getBuildings(): StoryBuildingSnapshot[];
  emitObjectives(payload: StoryObjectivePayload): void;
  emitDialogue(payload: StoryDialoguePayload): void;
  focusCamera(beat: StoryCameraBeat): void;
  showMessage(text: string): void;
  playFx(kind: 'marker' | 'smoke' | 'embers' | 'mist', x: number, y: number, label?: string): void;
  spawnCaravan(route: Array<{ x: number; y: number }>): void;
  endGame(win: boolean): void;
}

export interface StoryStartingUnit {
  kind: UnitKind;
  side: Side;
  race?: Race;
  x: number;
  y: number;
}

export interface StoryStartingBuilding {
  kind: BuildingKind;
  side: Side;
  race?: Race;
  tx: number;
  ty: number;
  instant?: boolean;
}

export interface StoryStartingResource {
  type: ResourceType;
  tx: number;
  ty: number;
}

export interface StoryEconomyStart {
  gold: number;
  lumber: number;
  foodCap?: number;
}

export interface StoryMapDefinition {
  id: StoryMapId;
  title: string;
  layout: MapLayout;
  initialPhase: StoryPhaseId;
  playerEconomy: StoryEconomyStart;
  aiEconomy: StoryEconomyStart;
  startingUnits: StoryStartingUnit[];
  startingBuildings: StoryStartingBuilding[];
  startingResources: StoryStartingResource[];
  phases: StoryPhase[];
  triggers: StoryTrigger[];
}

export interface StoryStateView {
  phase: StoryPhaseId;
  flags: Record<StoryFlag, boolean>;
  objectives: StoryObjectiveView[];
}
