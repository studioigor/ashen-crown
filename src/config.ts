export const TILE = 32;
export const MAP_W = 64;
export const MAP_H = 64;
export const WORLD_W = TILE * MAP_W;
export const WORLD_H = TILE * MAP_H;

export const VIEW_W = 1280;
export const VIEW_H = 720;

export const COLORS = {
  grass: 0x2f5627,
  grass2: 0x3b6730,
  forest: 0x14381d,
  forestDark: 0x08170f,
  stone: 0x596066,
  stoneDark: 0x272c30,
  water: 0x123d5b,
  waterLight: 0x2a7da8,
  dirt: 0x58482e,
  goldMine: 0xd9ad3d,
  allianceTeam: 0x4aa3ff,
  hordeTeam: 0xd24a3a,
  neutral: 0xaaaaaa,
  uiBg: 0x121516,
  uiPanel: 0x1f2527,
  uiBorder: 0x58656a,
  uiAccent: 0xffd36a,
  hpGreen: 0x3ad24a,
  hpYellow: 0xd2c43a,
  hpRed: 0xd23a3a,
  selection: 0xffffff,
  ghostOk: 0x44ff44,
  ghostBad: 0xff4444,
  warning: 0xff6644
};

export type Race = 'alliance' | 'horde';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type GameMode = 'skirmish' | 'story';
export type StoryMapId = 'the-ashen-crown';

export interface SkirmishLaunchConfig {
  mode: 'skirmish';
  playerRace: Race;
  difficulty: Difficulty;
  seed?: number;
}

export interface StoryLaunchConfig {
  mode: 'story';
  playerRace: Race;
  difficulty: Difficulty;
  storyMapId: StoryMapId;
  seed?: number;
}

export type GameLaunchConfig = SkirmishLaunchConfig | StoryLaunchConfig;

export const STORY_MAP_LABEL: Record<StoryMapId, string> = {
  'the-ashen-crown': 'The Ashen Crown'
};

export const STORY_MODE_DEFAULTS = {
  mode: 'story',
  playerRace: 'alliance',
  difficulty: 'normal',
  storyMapId: 'the-ashen-crown'
} as const satisfies StoryLaunchConfig;

export const DIFFICULTY = {
  easy: {
    label: 'Easy',
    aiDelayMs: 1200,
    attackScore: 7,
    targetWorkers: 7,
    incomeBias: 0.95,
    townhallQueueCap: 1,
    barracksQueueCap: 1,
    workshopQueueCap: 1,
    attackWaveMinUnits: 4,
    regroupMs: 12000,
    regroupGrowth: 3,
    defenseRadiusTiles: 11,
    defenseHoldMs: 14000,
    caravanOpportunityRadiusTiles: 5
  },
  normal: {
    label: 'Normal',
    aiDelayMs: 750,
    attackScore: 9,
    targetWorkers: 10,
    incomeBias: 1,
    townhallQueueCap: 2,
    barracksQueueCap: 2,
    workshopQueueCap: 1,
    attackWaveMinUnits: 5,
    regroupMs: 9500,
    regroupGrowth: 3,
    defenseRadiusTiles: 13,
    defenseHoldMs: 12000,
    caravanOpportunityRadiusTiles: 6
  },
  hard: {
    label: 'Hard',
    aiDelayMs: 520,
    attackScore: 11,
    targetWorkers: 13,
    incomeBias: 1.1,
    townhallQueueCap: 2,
    barracksQueueCap: 3,
    workshopQueueCap: 1,
    attackWaveMinUnits: 6,
    regroupMs: 6500,
    regroupGrowth: 2,
    defenseRadiusTiles: 15,
    defenseHoldMs: 10000,
    caravanOpportunityRadiusTiles: 7
  }
} as const;

export const SKIRMISH_CONFIG = {
  start: {
    gold: 430,
    lumber: 230,
    workers: 4,
    mainBuilding: 'townhall',
    workerOffsetX: -66,
    workerOffsetY: 76,
    workerSpacingX: 28
  },
  rules: {
    elimination: 'allBuildings'
  },
  caravans: {
    enabled: true
  }
} as const;

export const RACE_COLOR: Record<Race, number> = {
  alliance: COLORS.allianceTeam,
  horde: COLORS.hordeTeam
};

export const RACE_LABEL: Record<Race, string> = {
  alliance: 'Alliance',
  horde: 'Horde'
};

export const CAMERA_SPEED = 760;
export const CAMERA_ZOOM = 1.5;
export const EDGE_SCROLL_PX = 18;

export const VISUALS = {
  shakeScale: 0.82,
  maxPersistentDecals: 46,
  maxFloatingTexts: 36,
  particleBudgetPerSecond: 760,
  ambientEveryMs: 360,
  ambientLeafChance: 0.42,
  ambientMistChance: 0.28,
  stepDustMs: 230,
  projectileTrailMs: 42,
  battleDecalFadeMs: 14000
} as const;

export const FEEL = {
  cameraSmoothing: 0.16,
  cameraFriction: 0.82,
  commandPulseMs: 520,
  arrivalRadius: 13,
  gatherWorkPulseMs: 620,
  buildWorkPulseMs: 720
} as const;

type Cost = { gold: number; lumber: number };
type RaceLabels = Record<Race, string>;

export const UNIT = {
  worker: {
    hp: 42, speed: 94, size: 14, atk: 4, range: 24, cooldown: 1150, sight: 6,
    cost: { gold: 50, lumber: 0 }, food: 1, build: 10500, score: 1,
    producer: 'townhall', requires: undefined, splashRadius: 0, bonusVsBuilding: 0, hotkey: 'E',
    labelByRace: { alliance: 'Peasant', horde: 'Peon' }
  },
  footman: {
    hp: 86, speed: 76, size: 16, atk: 11, range: 28, cooldown: 950, sight: 7,
    cost: { gold: 80, lumber: 0 }, food: 1, build: 14500, score: 2,
    producer: 'barracks', requires: undefined, splashRadius: 0, bonusVsBuilding: 0, hotkey: 'F',
    labelByRace: { alliance: 'Footman', horde: 'Grunt' }
  },
  archer: {
    hp: 52, speed: 82, size: 14, atk: 8, range: 168, cooldown: 1350, sight: 8,
    cost: { gold: 70, lumber: 40 }, food: 1, build: 15500, score: 2,
    producer: 'barracks', requires: undefined, splashRadius: 0, bonusVsBuilding: 0, hotkey: 'A',
    labelByRace: { alliance: 'Ranger', horde: 'Headhunter' }
  },
  knight: {
    hp: 132, speed: 112, size: 20, atk: 18, range: 30, cooldown: 950, sight: 8,
    cost: { gold: 145, lumber: 35 }, food: 2, build: 21000, score: 4,
    producer: 'barracks', requires: 'workshop', splashRadius: 0, bonusVsBuilding: 0, hotkey: 'K',
    labelByRace: { alliance: 'Knight', horde: 'Raider' }
  },
  catapult: {
    hp: 115, speed: 54, size: 24, atk: 28, range: 230, cooldown: 2450, sight: 9,
    cost: { gold: 170, lumber: 110 }, food: 3, build: 26500, score: 6,
    producer: 'workshop', requires: undefined, splashRadius: 52, bonusVsBuilding: 22, hotkey: 'C',
    labelByRace: { alliance: 'Ballista', horde: 'Catapult' }
  }
} as const satisfies Record<string, {
  hp: number;
  speed: number;
  size: number;
  atk: number;
  range: number;
  cooldown: number;
  sight: number;
  cost: Cost;
  food: number;
  build: number;
  score: number;
  producer: string;
  requires?: string;
  splashRadius?: number;
  bonusVsBuilding?: number;
  hotkey: string;
  labelByRace: RaceLabels;
}>;

export const BUILDING = {
  townhall: {
    hp: 950, size: 3, sight: 8, cost: { gold: 400, lumber: 200 }, food: 6, build: 24000,
    accepts: ['gold', 'lumber'], attack: 0, range: 0, cooldown: 0, hotkey: 'H',
    labelByRace: { alliance: 'Town Hall', horde: 'Great Hall' }
  },
  farm: {
    hp: 420, size: 2, sight: 4, cost: { gold: 80, lumber: 40 }, food: 5, build: 11500,
    accepts: [], attack: 0, range: 0, cooldown: 0, hotkey: 'F',
    labelByRace: { alliance: 'Farm', horde: 'Burrow' }
  },
  barracks: {
    hp: 650, size: 3, sight: 6, cost: { gold: 155, lumber: 85 }, food: 0, build: 18000,
    accepts: [], attack: 0, range: 0, cooldown: 0, hotkey: 'B',
    labelByRace: { alliance: 'Barracks', horde: 'Barracks' }
  },
  workshop: {
    hp: 620, size: 3, sight: 6, cost: { gold: 170, lumber: 120 }, food: 0, build: 21000,
    accepts: [], attack: 0, range: 0, cooldown: 0, hotkey: 'W',
    labelByRace: { alliance: 'Workshop', horde: 'Siege Lodge' }
  },
  tower: {
    hp: 470, size: 2, sight: 9, cost: { gold: 120, lumber: 100 }, food: 0, build: 16500,
    accepts: [], attack: 12, range: 190, cooldown: 1200, hotkey: 'T',
    labelByRace: { alliance: 'Guard Tower', horde: 'Watch Tower' }
  }
} as const satisfies Record<string, {
  hp: number;
  size: number;
  sight: number;
  cost: Cost;
  food: number;
  build: number;
  accepts: readonly string[];
  attack?: number;
  range?: number;
  cooldown?: number;
  hotkey: string;
  labelByRace: RaceLabels;
}>;

export const RESOURCE = {
  mineAmount: 1800,
  treeAmount: 180,
  workerCarry: 10,
  gatherTime: 1650
};

export const CARAVAN_CONFIG = {
  hp: 150,
  speed: 46,
  radius: 28,
  sight: 0,
  reward: { gold: 75, lumber: 35 },
  firstSpawnMs: { min: 75000, max: 135000 },
  repeatSpawnMs: { min: 180000, max: 300000 },
  debugSpawnMs: { min: 6000, max: 10000 },
  maxActive: 1,
  enabledInSkirmish: true,
  enabledInStory: false
} as const;

export const FOG = {
  updateMs: 220
};

export const AI_TICK_MS = 600;

export const UNIT_KINDS = ['worker', 'footman', 'archer', 'knight', 'catapult'] as const;
export type UnitKind = typeof UNIT_KINDS[number];

export const BUILDING_KINDS = ['townhall', 'farm', 'barracks', 'workshop', 'tower'] as const;
export type BuildingKind = typeof BUILDING_KINDS[number];

export const SIDE = { player: 0, ai: 1, neutral: 2 } as const;
export type Side = 0 | 1 | 2;
