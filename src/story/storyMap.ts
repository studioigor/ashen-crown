import { MAP_H, SIDE, TILE, type StoryMapId } from '../config';
import { generateMap } from '../world/MapGenerator';
import type { StoryMapDefinition } from './types';

export function createStoryMap(id: StoryMapId, seed: number): StoryMapDefinition {
  switch (id) {
    case 'the-ashen-crown':
      return createAshenCrownFramework(seed);
  }
}

function createAshenCrownFramework(seed: number): StoryMapDefinition {
  const layout = generateMap(seed);
  const pb = layout.playerBase;
  const townhall = {
    tx: pb.tx - 1,
    ty: pb.ty - 1,
    x: (pb.tx - 1) * TILE + TILE * 1.5,
    y: (pb.ty - 1) * TILE + TILE * 1.5
  };
  const oldRoad = worldPoint(32, 32);
  const lowerRoad = worldPoint(10, MAP_H - 13);

  return {
    id: 'the-ashen-crown',
    title: 'The Ashen Crown',
    layout,
    initialPhase: 'last_harvest',
    playerEconomy: { gold: 720, lumber: 420, foodCap: 0 },
    aiEconomy: { gold: 0, lumber: 0, foodCap: 0 },
    startingBuildings: [
      { kind: 'townhall', side: SIDE.player, tx: townhall.tx, ty: townhall.ty, instant: true }
    ],
    startingUnits: [
      { kind: 'worker', side: SIDE.player, x: townhall.x - 66, y: townhall.y + 76 },
      { kind: 'worker', side: SIDE.player, x: townhall.x - 38, y: townhall.y + 76 },
      { kind: 'worker', side: SIDE.player, x: townhall.x - 10, y: townhall.y + 76 },
      { kind: 'worker', side: SIDE.player, x: townhall.x + 18, y: townhall.y + 76 }
    ],
    startingResources: [
      ...layout.goldMines.map((mine) => ({ type: 'gold' as const, tx: mine.tx - 1, ty: mine.ty - 1 })),
      ...layout.trees.map((tree) => ({ type: 'lumber' as const, tx: tree.tx, ty: tree.ty }))
    ],
    phases: [
      {
        id: 'last_harvest',
        title: 'The Last Harvest',
        restrictions: {
          buildAllowed: ['farm', 'barracks'],
          trainAllowed: ['worker', 'footman'],
          defaultBuildReason: 'Сюжет пока разрешает только базовую оборону',
          defaultTrainReason: 'Сюжет пока разрешает только рабочих и пехоту',
          buildReasons: {
            workshop: 'Мастерская откроется позже по сюжету',
            tower: 'Башни пока запрещены: совет требует сохранить древесину',
            townhall: 'Новая база недоступна в этой сюжетной фазе'
          },
          trainReasons: {
            archer: 'Лучники прибудут после разведки дороги',
            knight: 'Кавалерия недоступна до следующей сюжетной фазы',
            catapult: 'Осадные машины недоступны до открытия мастерской'
          }
        },
        objectives: [
          {
            id: 'secure_foothold',
            title: 'Secure the Foothold',
            description: 'Prepare a minimal defense before the road event opens.',
            subObjectives: [
              {
                id: 'build_farm',
                title: 'Build 1 Farm',
                condition: { type: 'buildingCount', side: SIDE.player, kind: 'farm', completed: true, count: 1 }
              },
              {
                id: 'build_barracks',
                title: 'Build 1 Barracks',
                condition: { type: 'buildingCount', side: SIDE.player, kind: 'barracks', completed: true, count: 1 }
              },
              {
                id: 'train_footman',
                title: 'Train 1 Footman',
                condition: { type: 'unitCount', side: SIDE.player, kind: 'footman', count: 1 }
              }
            ]
          }
        ],
        enterEvents: [
          { type: 'setFlag', flag: 'story_started', value: true },
          {
            type: 'showDialogue',
            lines: [
              {
                speaker: 'Marshal Edrin',
                text: 'The harvest wagons are late, but the village still stands. Raise a farm, then a barracks. We need a shield before we need a crown.',
                requireContinue: true,
                durationMs: 12000
              }
            ]
          },
          { type: 'focusCamera', beat: { x: townhall.x, y: townhall.y, durationMs: 450, lockMs: 700 } }
        ]
      },
      {
        id: 'road_watch',
        title: 'The Road Watch',
        restrictions: {
          buildAllowed: ['farm', 'barracks'],
          trainAllowed: ['worker', 'footman', 'archer'],
          defaultBuildReason: 'Дальние постройки откроются после разведки дороги',
          defaultTrainReason: 'Этот отряд пока не участвует в сюжетной карте',
          trainReasons: {
            knight: 'Кавалерия еще не прибыла',
            catapult: 'Осадные машины появятся в более поздней фазе'
          }
        },
        objectives: [
          {
            id: 'scout_old_road',
            title: 'Scout the Old Road',
            description: 'Move any unit to the smoke marker on the central road.',
            subObjectives: [
              {
                id: 'enter_old_road',
                title: 'Reach the smoke on the road',
                condition: { type: 'flag', flag: 'old_road_seen', value: true }
              }
            ]
          }
        ],
        enterEvents: [
          { type: 'showMessage', text: 'Новая цель: разведать дорогу' },
          { type: 'focusCamera', beat: { x: oldRoad.x, y: oldRoad.y, durationMs: 700, lockMs: 950 } },
          { type: 'playFx', kind: 'marker', x: oldRoad.x, y: oldRoad.y, label: 'Old Road' },
          { type: 'playFx', kind: 'smoke', x: lowerRoad.x, y: lowerRoad.y }
        ]
      },
      {
        id: 'framework_ready',
        title: 'Framework Ready',
        restrictions: {
          buildAllowed: ['farm', 'barracks', 'tower'],
          trainAllowed: ['worker', 'footman', 'archer'],
          defaultBuildReason: 'Эта постройка зарезервирована для следующей story-задачи',
          defaultTrainReason: 'Этот отряд зарезервирован для следующей story-задачи'
        },
        objectives: [
          {
            id: 'await_next_order',
            title: 'Await the Next Order',
            description: 'The framework is active. Task 013 will replace this placeholder with the caravan dilemma and betrayal arc.'
          }
        ]
      }
    ],
    triggers: [
      {
        id: 'intro_marker_hint',
        phase: 'last_harvest',
        on: 'timer',
        once: true,
        delayMs: 1800,
        events: [
          { type: 'showMessage', text: 'Сюжетная цель обновляется в левом верхнем углу' },
          { type: 'playFx', kind: 'marker', x: townhall.x, y: townhall.y, label: 'Story Map' }
        ]
      },
      {
        id: 'foothold_ready',
        phase: 'last_harvest',
        on: 'state',
        once: true,
        condition: {
          all: [
            { type: 'buildingCount', side: SIDE.player, kind: 'farm', completed: true, count: 1 },
            { type: 'buildingCount', side: SIDE.player, kind: 'barracks', completed: true, count: 1 },
            { type: 'unitCount', side: SIDE.player, kind: 'footman', count: 1 }
          ]
        },
        events: [
          { type: 'setObjectiveStatus', objectiveId: 'secure_foothold', status: 'completed' },
          { type: 'setFlag', flag: 'foothold_ready', value: true },
          {
            type: 'showDialogue',
            lines: [
              {
                speaker: 'Scout Mira',
                text: 'Smoke on the old road. Not a raid yet, but something is moving through the ash.',
                durationMs: 9000
              }
            ]
          },
          { type: 'setPhase', phase: 'road_watch' }
        ]
      },
      {
        id: 'old_road_entered',
        phase: 'road_watch',
        on: 'areaEntered',
        once: true,
        area: { id: 'old_road', x: oldRoad.x, y: oldRoad.y, radius: TILE * 3.5, side: SIDE.player },
        events: [
          { type: 'setObjectiveStatus', objectiveId: 'scout_old_road', status: 'completed' },
          { type: 'setFlag', flag: 'old_road_seen', value: true },
          {
            type: 'showDialogue',
            lines: [
              {
                speaker: 'Marshal Edrin',
                text: 'Good. The road trigger, objective swap, dialogue queue, flag store, and camera beat are all alive. The real caravan comes next.',
                requireContinue: true,
                durationMs: 12000
              }
            ]
          },
          { type: 'focusCamera', beat: { x: townhall.x, y: townhall.y, durationMs: 700, lockMs: 900 } },
          { type: 'setPhase', phase: 'framework_ready' }
        ]
      }
    ]
  };
}

function worldPoint(tx: number, ty: number): { x: number; y: number } {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}
