import { MAP_H, MAP_W, SIDE, TILE, type Race, type Side, type StoryMapId, type UnitKind } from '../config';
import { generateMap } from '../world/MapGenerator';
import type { StoryMapDefinition, StoryScriptedUnit } from './types';

type UnitSpec = [kind: UnitKind, dx: number, dy: number];

const COMBAT_UNITS: UnitKind[] = ['footman', 'archer', 'knight'];

export function createStoryMap(id: StoryMapId, seed: number): StoryMapDefinition {
  switch (id) {
    case 'the-ashen-crown':
      return createAshenCrown(seed);
  }
}

function createAshenCrown(seed: number): StoryMapDefinition {
  const layout = generateMap(seed);
  const pb = layout.playerBase;
  const townhall = {
    tx: pb.tx - 1,
    ty: pb.ty - 1,
    x: (pb.tx - 1) * TILE + TILE * 1.5,
    y: (pb.ty - 1) * TILE + TILE * 1.5
  };

  const oldRoad = worldPoint(pb.tx + 8, pb.ty + 7);
  const roadFire = worldPoint(pb.tx + 6, pb.ty + 6);
  const caravanStart = worldPoint(pb.tx + 12, pb.ty + 8);
  const caravanMid = worldPoint(pb.tx + 7, pb.ty + 7);
  const caravanExit = worldPoint(pb.tx - 8, pb.ty + 8);
  const retreatRoad = worldPoint(5, pb.ty + 9);
  const chapel = worldPoint(Math.floor(MAP_W / 2) + 4, Math.floor(MAP_H / 2) - 6);
  const destroyChoice = { x: chapel.x - TILE * 4, y: chapel.y + TILE * 2 };
  const wearChoice = { x: chapel.x + TILE * 4, y: chapel.y + TILE * 2 };
  const northeastRoad = worldPoint(MAP_W - 13, 14);
  const eastRoad = worldPoint(MAP_W - 15, 24);
  const southRoad = worldPoint(11, MAP_H - 13);
  const crownGate = worldPoint(Math.floor(MAP_W / 2) + 8, Math.floor(MAP_H / 2));
  const rowanActor = { x: townhall.x + TILE * 2.5, y: townhall.y + TILE * 0.8 };
  const maericActor = { x: townhall.x + TILE * 3.55, y: townhall.y + TILE * 1.65 };
  const miraActor = { x: townhall.x + TILE * 2.65, y: townhall.y + TILE * 2.45 };

  return {
    id: 'the-ashen-crown',
    title: 'Пепельная корона',
    layout,
    initialPhase: 'last_harvest',
    playerEconomy: { gold: 920, lumber: 560, foodCap: 0 },
    aiEconomy: { gold: 0, lumber: 0, foodCap: 100 },
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
    landmarks: [
      { id: 'actor_rowan', kind: 'actor', x: rowanActor.x, y: rowanActor.y, label: 'Роуэн Вейл', unitKind: 'knight', race: 'alliance', color: 0xffd36a },
      { id: 'actor_maeric', kind: 'actor', x: maericActor.x, y: maericActor.y, label: 'Капитан Маэрик', unitKind: 'footman', race: 'alliance', color: 0xc8d8ff },
      { id: 'actor_mira', kind: 'actor', x: miraActor.x, y: miraActor.y, label: 'Разведчица Мира', unitKind: 'archer', race: 'alliance', color: 0xbde0a8 },
      { id: 'old_road_wreck', kind: 'burnedRoad', x: oldRoad.x, y: oldRoad.y, label: 'Старая дорога', color: 0xffa35a },
      { id: 'old_chapel_ruins', kind: 'chapel', x: chapel.x, y: chapel.y, label: 'Старая часовня', color: 0xd8c09a },
      { id: 'crown_seal', kind: 'crownSeal', x: crownGate.x, y: crownGate.y, label: 'Печать Короны', color: 0xff7a32 },
      { id: 'choice_destroy_obelisk', kind: 'choiceObelisk', x: destroyChoice.x, y: destroyChoice.y, label: 'Уничтожить Корону', color: 0x8fd0ff, visible: false },
      { id: 'choice_wear_obelisk', kind: 'choiceObelisk', x: wearChoice.x, y: wearChoice.y, label: 'Надеть Корону', color: 0xff7a32, visible: false }
    ],
    phases: [
      {
        id: 'last_harvest',
        title: 'Последняя жатва',
        restrictions: {
          buildAllowed: ['farm', 'barracks'],
          trainAllowed: ['worker', 'footman'],
          defaultBuildReason: 'У деревни есть время только на хлеб и железо.',
          defaultTrainReason: 'Роуэн еще не созвал дальние отряды домой.',
          buildReasons: {
            workshop: 'Инженеры все еще на южной дороге.',
            tower: 'Маэрик запрещает башни, пока не пересчитаны беженцы.',
            townhall: 'Сегодня ночью второго престола не будет.'
          },
          trainReasons: {
            archer: 'Лучники стерегут дорогу.',
            knight: 'Пограничные рыцари не ответили.',
            catapult: 'Осадный двор молчит.'
          }
        },
        objectives: [
          {
            id: 'last_harvest_ready',
            title: 'Сделать деревню достойной обороны',
            description: 'Подготовьте снабжение, казармы и малый строй щитов, пока дорога не рухнула.',
            subObjectives: [
              { id: 'build_farm', title: 'Построить 1 ферму', condition: { type: 'buildingCount', side: SIDE.player, kind: 'farm', completed: true, count: 1 } },
              { id: 'build_barracks', title: 'Построить казармы', condition: { type: 'buildingCount', side: SIDE.player, kind: 'barracks', completed: true, count: 1 } },
              { id: 'train_two_footmen', title: 'Обучить 2 пехотинцев', condition: { type: 'unitCount', side: SIDE.player, kind: 'footman', count: 2 } }
            ]
          }
        ],
        enterEvents: [
          { type: 'setFlag', flag: 'story_started', value: true },
          { type: 'setAtmosphere', tone: 'normal' },
          { type: 'focusCamera', beat: { x: townhall.x, y: townhall.y, durationMs: 450, lockMs: 700 } },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Лорд Роуэн Вейл', text: 'Отец оставил мне границу и лихорадку. Если падет дорога, вместе с ней падет наше имя.', requireContinue: true, durationMs: 11000 },
              { speaker: 'Капитан Маэрик', text: 'Тогда трать дерево на порядок, а не на гордость. Ферма. Казармы. Люди, которые устоят, когда начнутся крики.', durationMs: 10000 }
            ]
          }
        ]
      },
      {
        id: 'road_burns',
        title: 'Дорога горит',
        restrictions: {
          buildAllowed: ['farm', 'barracks', 'tower'],
          trainAllowed: ['worker', 'footman', 'archer'],
          defaultBuildReason: 'Осадный двор закрыт, пока Маэрик не отдаст приказ.',
          defaultTrainReason: 'Только дорожные отряды достаточно близко, чтобы ответить.'
        },
        objectives: [
          {
            id: 'road_dilemma',
            title: 'Ответить горящей дороге',
            description: 'Спасите караван беженцев или удержите деревню и заберите то, что останется.',
            subObjectives: [
              { id: 'caravan_saved_sub', title: 'Караван добрался до безопасности', condition: { type: 'flag', flag: 'saved_caravan' } },
              { id: 'ambush_broken_sub', title: 'Разбить засаду', condition: { all: [{ type: 'flag', flag: 'road_ambush_spawned' }, { type: 'groupCount', groupId: 'road_ambush', count: 0 }] } }
            ]
          }
        ],
        enterEvents: [
          { type: 'setFlag', flag: 'road_ambush_spawned', value: true },
          { type: 'showMessage', text: 'Дорога под атакой.' },
          { type: 'setAtmosphere', tone: 'ashen' },
          { type: 'revealArea', x: oldRoad.x, y: oldRoad.y, radiusTiles: 10 },
          { type: 'playFx', kind: 'fire', x: roadFire.x, y: roadFire.y },
          { type: 'playFx', kind: 'smoke', x: oldRoad.x - 20, y: oldRoad.y + 18 },
          { type: 'playFx', kind: 'dust', x: oldRoad.x + 16, y: oldRoad.y + 34 },
          { type: 'playFx', kind: 'dust', x: caravanStart.x, y: caravanStart.y + 18 },
          { type: 'playFx', kind: 'ash', x: roadFire.x + 10, y: roadFire.y - 18 },
          { type: 'playFx', kind: 'marker', x: caravanMid.x, y: caravanMid.y, label: 'Беженцы' },
          { type: 'spawnCaravan', route: [caravanStart, caravanMid, worldPoint(pb.tx + 1, pb.ty + 7), caravanExit] },
          { type: 'spawnUnits', groupId: 'road_ambush', units: wave(oldRoad.x + 34, oldRoad.y + 8, SIDE.ai, 'horde', [['footman', -24, 0], ['footman', 18, 12], ['archer', 8, -34]]) },
          { type: 'commandGroup', groupId: 'road_ambush', command: { type: 'attackCaravan' } },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Разведчица Мира', text: 'Беженцы на восточной дороге. Орда режет их повозка за повозкой.', durationMs: 9000 },
              { speaker: 'Капитан Маэрик', text: 'Если уйдете от стен, деревня останется тоньше. Если останетесь, дорога это запомнит.', durationMs: 10000 }
            ]
          }
        ]
      },
      {
        id: 'oathbreaker',
        title: 'Клятвопреступник',
        restrictions: {
          buildAllowed: ['farm', 'barracks', 'tower'],
          trainAllowed: ['worker', 'footman', 'archer'],
          defaultBuildReason: 'В этой ссоре нет времени на новые работы.',
          defaultTrainReason: 'Дальние отряды вышли из строя.'
        },
        objectives: [
          {
            id: 'survive_oathbreaker',
            title: 'Удержать ратушу до рассвета',
            description: 'Клятва Маэрика ломается раньше вражеского строя.',
            subObjectives: [
              { id: 'townhall_stands_night', title: 'Ратуша стоит', condition: { type: 'buildingCount', side: SIDE.player, kind: 'townhall', count: 1 } },
              { id: 'night_raiders_broken', title: 'Ночные налетчики разбиты', condition: { all: [{ type: 'flag', flag: 'night_raid_second_wave' }, { type: 'groupCount', groupId: 'night_raid_a', count: 0 }, { type: 'groupCount', groupId: 'night_raid_b', count: 0 }] } }
            ]
          }
        ],
        enterEvents: [
          { type: 'setAtmosphere', tone: 'ashen' },
          { type: 'playFx', kind: 'ash', x: townhall.x, y: townhall.y - 28 },
          { type: 'showMessage', text: 'Капитан Маэрик ставит клятву под сомнение.' }
        ]
      },
      {
        id: 'under_chapel',
        title: 'Под часовней',
        restrictions: {
          buildAllowed: ['farm', 'barracks', 'tower', 'workshop'],
          trainAllowed: ['worker', 'footman', 'archer', 'knight'],
          defaultBuildReason: 'Осталась только война живых.',
          defaultTrainReason: 'Корона еще не открыла эту дверь.'
        },
        objectives: [
          {
            id: 'reach_chapel',
            title: 'Открыть старую часовню',
            description: 'Отправьте любого юнита к погребенным руинам под камнями часовни.',
            subObjectives: [
              { id: 'chapel_reached_sub', title: 'Добраться до руин в пепельном свете', condition: { type: 'flag', flag: 'chapel_reached' } }
            ]
          }
        ],
        enterEvents: [
          { type: 'setAtmosphere', tone: 'ashen' },
          { type: 'revealArea', x: chapel.x, y: chapel.y, radiusTiles: 8 },
          { type: 'playFx', kind: 'glow', x: chapel.x, y: chapel.y },
          { type: 'playFx', kind: 'ash', x: chapel.x, y: chapel.y - 24 },
          { type: 'playFx', kind: 'marker', x: chapel.x, y: chapel.y, label: 'Старая часовня' },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Разведчица Мира', text: 'Под часовней есть лестница. Ее не рубил каменщик. Ее не благословлял священник.', durationMs: 9000 },
              { speaker: 'Лорд Роуэн Вейл', text: 'Значит, мы откроем ее раньше Орды.', durationMs: 8000 }
            ]
          }
        ]
      },
      {
        id: 'under_chapel_power',
        title: 'Под часовней',
        restrictions: {
          buildAllowed: ['farm', 'barracks', 'tower', 'workshop'],
          trainAllowed: ['worker', 'footman', 'archer', 'knight'],
          defaultBuildReason: 'Земля слушает.',
          defaultTrainReason: 'Корона считает живых.'
        },
        objectives: [
          {
            id: 'crown_first_price',
            title: 'Пережить воинство Короны',
            description: 'Погребенная корона предлагает победу раньше, чем называет цену.',
            subObjectives: [
              { id: 'crown_host_broken_sub', title: 'Воинство Короны уничтожено', condition: { type: 'groupCount', groupId: 'crown_host', count: 0 } },
              { id: 'crown_power_used_sub', title: 'Запретная сила применена', condition: { type: 'flag', flag: 'used_crown_power' } }
            ]
          }
        ],
        enterEvents: [
          { type: 'setAtmosphere', tone: 'forbidden' },
          { type: 'revealArea', x: crownGate.x, y: crownGate.y, radiusTiles: 9 },
          { type: 'playFx', kind: 'mist', x: crownGate.x, y: crownGate.y },
          { type: 'playFx', kind: 'ash', x: crownGate.x, y: crownGate.y - 18 },
          { type: 'spawnUnits', groupId: 'crown_host', units: wave(crownGate.x, crownGate.y, SIDE.ai, 'horde', [['knight', -34, 0], ['footman', 0, -26], ['footman', 28, 18], ['archer', 48, -22], ['archer', -52, 18]]) },
          { type: 'commandGroup', groupId: 'crown_host', command: { type: 'attackTownhall' } },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Корона', text: 'Меня похоронили под трусами. Надень меня как король.', durationMs: 8500 },
              { speaker: 'Лорд Роуэн Вейл', text: 'Нет.', durationMs: 4500 },
              { speaker: 'Корона', text: 'Тогда смотри, как они честно умирают.', durationMs: 8500 }
            ]
          }
        ]
      },
      {
        id: 'crown_of_ash',
        title: 'Корона из пепла',
        restrictions: {
          buildAllowed: ['farm', 'barracks', 'tower', 'workshop'],
          trainAllowed: ['worker', 'footman', 'archer', 'knight', 'catapult'],
          defaultBuildReason: 'Последний приказ уже отдан.',
          defaultTrainReason: 'Последний приказ уже отдан.'
        },
        objectives: [
          {
            id: 'final_choice',
            title: 'Выбрать судьбу Короны',
            description: 'Отправьте любого юнита к левому маркеру, чтобы уничтожить Корону, или к правому, чтобы надеть ее.'
          }
        ],
        enterEvents: [
          { type: 'setAtmosphere', tone: 'forbidden' },
          { type: 'revealArea', x: chapel.x, y: chapel.y, radiusTiles: 9 },
          { type: 'setLandmarkVisible', id: 'choice_destroy_obelisk', visible: true },
          { type: 'setLandmarkVisible', id: 'choice_wear_obelisk', visible: true },
          { type: 'playFx', kind: 'marker', x: destroyChoice.x, y: destroyChoice.y, label: 'Уничтожить' },
          { type: 'playFx', kind: 'marker', x: wearChoice.x, y: wearChoice.y, label: 'Надеть' },
          { type: 'playFx', kind: 'glow', x: chapel.x, y: chapel.y },
          { type: 'playFx', kind: 'ash', x: destroyChoice.x, y: destroyChoice.y },
          { type: 'playFx', kind: 'ash', x: wearChoice.x, y: wearChoice.y },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Капитан Маэрик', text: 'Сломай ее, Роуэн. Или клянусь каждой могилой на той дороге, я сломаю тебя.', durationMs: 10000 },
              { speaker: 'Корона', text: 'Он просит тебя умереть чистым. Я прошу тебя жить коронованным.', durationMs: 10000 }
            ]
          }
        ]
      },
      {
        id: 'destroy_crown',
        title: 'Уничтожить Корону',
        restrictions: {
          buildAllowed: ['farm', 'barracks', 'tower', 'workshop'],
          trainAllowed: ['worker', 'footman', 'archer', 'knight', 'catapult'],
          defaultBuildReason: 'Деревня сражается тем, что осталось.',
          defaultTrainReason: 'Деревня сражается тем, что осталось.'
        },
        objectives: [
          {
            id: 'destroy_crown_defense',
            title: 'Устоять без Короны',
            description: 'Разбейте последнее воинство, пока Корона выжигает себя дотла.',
            subObjectives: [
              { id: 'destroy_wave_a_sub', title: 'Первое воинство разбито', condition: { type: 'groupCount', groupId: 'destroy_host_a', count: 0 } },
              { id: 'destroy_wave_b_sub', title: 'Второе воинство разбито', condition: { all: [{ type: 'flag', flag: 'destroy_second_host_sent' }, { type: 'groupCount', groupId: 'destroy_host_b', count: 0 }] } }
            ]
          }
        ],
        enterEvents: [
          { type: 'setFlag', flag: 'destroy_crown', value: true },
          { type: 'setAtmosphere', tone: 'ashen' },
          { type: 'revealArea', x: northeastRoad.x, y: northeastRoad.y, radiusTiles: 8 },
          { type: 'playFx', kind: 'explosion', x: chapel.x, y: chapel.y },
          { type: 'playFx', kind: 'ash', x: chapel.x, y: chapel.y - 36 },
          { type: 'sacrificePlayerUnits', count: 1, kinds: COMBAT_UNITS, x: chapel.x, y: chapel.y, radius: TILE * 18, label: 'Освобожден огнем' },
          { type: 'spawnUnits', groupId: 'destroy_host_a', units: wave(northeastRoad.x, northeastRoad.y, SIDE.ai, 'horde', [['knight', -20, 0], ['footman', 22, -18], ['footman', 30, 22], ['archer', -48, 18], ['catapult', 64, 6]]) },
          { type: 'commandGroup', groupId: 'destroy_host_a', command: { type: 'attackTownhall' } },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Лорд Роуэн Вейл', text: 'Я не куплю границу ценой собственного народа.', durationMs: 9000 },
              { speaker: 'Корона', text: 'Тогда плати ими всеми.', durationMs: 8000 }
            ]
          }
        ]
      },
      {
        id: 'wear_crown',
        title: 'Надеть Корону',
        restrictions: {
          buildAllowed: ['farm', 'barracks', 'tower', 'workshop'],
          trainAllowed: ['worker', 'footman', 'archer', 'knight', 'catapult'],
          defaultBuildReason: 'Коронованная армия больше не строит.',
          defaultTrainReason: 'Коронованная армия больше не просит.'
        },
        objectives: [
          {
            id: 'wear_crown_assault',
            title: 'Заставить последних свидетелей замолчать',
            description: 'Корона дает Роуэну силу. Маэрик дает ему последнего человеческого врага.',
            subObjectives: [
              { id: 'maeric_loyalists_broken', title: 'Верные Маэрику разбиты', condition: { type: 'groupCount', groupId: 'maeric_loyalists', count: 0 } },
              { id: 'wear_host_broken', title: 'Воинство Орды разбито', condition: { type: 'groupCount', groupId: 'wear_host', count: 0 } }
            ]
          }
        ],
        enterEvents: [
          { type: 'setFlag', flag: 'wear_crown', value: true },
          { type: 'setAtmosphere', tone: 'forbidden' },
          { type: 'revealArea', x: eastRoad.x, y: eastRoad.y, radiusTiles: 8 },
          { type: 'grantResources', side: SIDE.player, gold: 420, lumber: 240 },
          { type: 'sacrificePlayerUnits', count: 3, kinds: ['footman', 'archer', 'knight', 'worker'], x: townhall.x, y: townhall.y, radius: TILE * 30, label: 'Коронован' },
          { type: 'playFx', kind: 'glow', x: chapel.x, y: chapel.y },
          { type: 'spawnUnits', groupId: 'crown_guard', units: wave(chapel.x, chapel.y + TILE * 2, SIDE.player, 'alliance', [['knight', -34, 0], ['knight', 34, 0], ['catapult', 0, 42], ['archer', -58, 36], ['archer', 58, 36]]) },
          { type: 'spawnUnits', groupId: 'maeric_loyalists', units: wave(townhall.x + TILE * 7, townhall.y + TILE * 3, SIDE.ai, 'alliance', [['knight', -28, 0], ['footman', 20, -18], ['footman', 36, 20], ['archer', -54, 22]]) },
          { type: 'spawnUnits', groupId: 'wear_host', units: wave(eastRoad.x, eastRoad.y, SIDE.ai, 'horde', [['knight', -20, 0], ['footman', 18, -24], ['footman', 28, 24], ['archer', -46, 16], ['catapult', 60, 4]]) },
          { type: 'commandGroup', groupId: 'maeric_loyalists', command: { type: 'attackTownhall' } },
          { type: 'commandGroup', groupId: 'wear_host', command: { type: 'attackTownhall' } },
          { type: 'commandGroup', groupId: 'crown_guard', command: { type: 'attackMove', x: townhall.x + TILE * 7, y: townhall.y + TILE * 3 } },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Лорд Роуэн Вейл', text: 'На колени, Маэрик. Граница жива.', durationMs: 8000 },
              { speaker: 'Капитан Маэрик', text: 'Нет. Она носит твое лицо и говорит могилой в своей пасти.', durationMs: 10500 },
              { speaker: 'Корона', text: 'Хорошо. Король должен ясно слышать измену.', durationMs: 8500 }
            ]
          }
        ]
      }
    ],
    triggers: [
      {
        id: 'townhall_falls',
        on: 'buildingDestroyed',
        once: true,
        condition: { type: 'event', eventType: 'buildingDestroyed', side: SIDE.player, kind: 'townhall' },
        events: [
          { type: 'showDialogue', lines: [{ speaker: 'Разведчица Мира', text: 'Ратуши больше нет. Не осталось границы, которую можно спасти.', durationMs: 8000 }] },
          {
            type: 'endGame',
            win: false,
            lines: [
              { text: 'Ратуша стала холодной раньше рассвета.' },
              { text: 'Беженцы помнили дорогу, но не нашли дома за ней.', flag: 'saved_caravan' },
              { text: 'На дороге и у стен остался один и тот же пепел.', flag: 'abandoned_caravan' }
            ]
          }
        ]
      },
      {
        id: 'last_harvest_warning',
        phase: 'last_harvest',
        on: 'timer',
        once: true,
        delayMs: 1800,
        events: [
          { type: 'playFx', kind: 'marker', x: townhall.x, y: townhall.y, label: 'Держать' },
          { type: 'showMessage', text: 'Подготовьте деревню до события на дороге.' }
        ]
      },
      {
        id: 'last_harvest_complete',
        phase: 'last_harvest',
        on: 'state',
        once: true,
        condition: {
          all: [
            { type: 'buildingCount', side: SIDE.player, kind: 'farm', completed: true, count: 1 },
            { type: 'buildingCount', side: SIDE.player, kind: 'barracks', completed: true, count: 1 },
            { type: 'unitCount', side: SIDE.player, kind: 'footman', count: 2 }
          ]
        },
        events: [
          { type: 'setObjectiveStatus', objectiveId: 'last_harvest_ready', status: 'completed' },
          { type: 'setFlag', flag: 'last_harvest_ready', value: true },
          { type: 'showDialogue', lines: [{ speaker: 'Разведчица Мира', text: 'Дым на старой дороге. Не костровой дым. Дым беглецов.', durationMs: 8000 }] }
        ]
      },
      {
        id: 'last_harvest_to_road',
        phase: 'last_harvest',
        on: 'state',
        once: true,
        condition: { type: 'flagAgeMs', flag: 'last_harvest_ready', ms: 8500 },
        events: [
          { type: 'setPhase', phase: 'road_burns' }
        ]
      },
      {
        id: 'caravan_saved',
        phase: 'road_burns',
        on: 'caravanResolved',
        once: true,
        condition: { type: 'event', eventType: 'caravanResolved', outcome: 'escaped' },
        events: [
          { type: 'setObjectiveStatus', objectiveId: 'road_dilemma', status: 'completed' },
          { type: 'setFlag', flag: 'saved_caravan', value: true },
          { type: 'setFlag', flag: 'abandoned_caravan', value: false },
          { type: 'setFlag', flag: 'caravan_resolved', value: true },
          { type: 'commandGroup', groupId: 'road_ambush', command: { type: 'attackTownhall' } },
          { type: 'playFx', kind: 'dust', x: caravanExit.x, y: caravanExit.y },
          { type: 'showMessage', text: 'Добейте преследователей у дороги.' },
          { type: 'showDialogue', lines: [{ speaker: 'Разведчица Мира', text: 'Повозки прошли. Половина детей молчит, но они дышат.', durationMs: 9500 }] }
        ]
      },
      {
        id: 'caravan_abandoned',
        phase: 'road_burns',
        on: 'caravanResolved',
        once: true,
        condition: { type: 'event', eventType: 'caravanResolved', outcome: 'destroyed' },
        events: [
          { type: 'setObjectiveStatus', objectiveId: 'road_dilemma', status: 'failed' },
          { type: 'setFlag', flag: 'saved_caravan', value: false },
          { type: 'setFlag', flag: 'abandoned_caravan', value: true },
          { type: 'setFlag', flag: 'caravan_resolved', value: true },
          { type: 'grantResources', side: SIDE.player, gold: 140, lumber: 90 },
          { type: 'commandGroup', groupId: 'road_ambush', command: { type: 'attackTownhall' } },
          { type: 'playFx', kind: 'embers', x: caravanMid.x, y: caravanMid.y },
          { type: 'playFx', kind: 'ash', x: caravanMid.x, y: caravanMid.y - 18 },
          { type: 'showMessage', text: 'Засада идет к деревне.' },
          { type: 'showDialogue', lines: [{ speaker: 'Капитан Маэрик', text: 'Повозки горят, зато кладовая стала тяжелее. Запомни этот вес.', durationMs: 10000 }] }
        ]
      },
      {
        id: 'road_burns_resolved',
        phase: 'road_burns',
        on: 'state',
        once: true,
        condition: {
          all: [
            { type: 'flag', flag: 'caravan_resolved' },
            { type: 'flagAgeMs', flag: 'caravan_resolved', ms: 11000 },
            { type: 'groupCount', groupId: 'road_ambush', count: 0 },
            { type: 'buildingCount', side: SIDE.player, kind: 'townhall', count: 1 }
          ]
        },
        events: [
          { type: 'showMessage', text: 'Дорога затихла. Маэрик требует ответа.' },
          { type: 'setPhase', phase: 'oathbreaker' }
        ]
      },
      {
        id: 'oathbreaker_saved_accusation',
        phase: 'oathbreaker',
        on: 'timer',
        once: true,
        delayMs: 350,
        condition: { type: 'flag', flag: 'saved_caravan' },
        events: [
          { type: 'setFlag', flag: 'maeric_accused', value: true },
          { type: 'setAtmosphere', tone: 'ashen', durationMs: 9000 },
          { type: 'playFx', kind: 'ash', x: townhall.x - 18, y: townhall.y - 24 },
          { type: 'retreatPlayerUnits', count: 1, kinds: COMBAT_UNITS, x: townhall.x, y: townhall.y, radius: TILE * 24, toX: retreatRoad.x, toY: retreatRoad.y, despawnAfterMs: 4200, label: 'Эскорт' },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Капитан Маэрик', text: 'Ты спас дорогу и истончил стену. Я беру эскорт и увожу беженцев на запад.', durationMs: 10000 },
              { speaker: 'Лорд Роуэн Вейл', text: 'Ты бросаешь свою клятву.', durationMs: 7000 },
              { speaker: 'Капитан Маэрик', text: 'Нет. Я уношу ту ее часть, которую ты еще можешь спасти.', durationMs: 9000 }
            ]
          }
        ]
      },
      {
        id: 'oathbreaker_abandoned_accusation',
        phase: 'oathbreaker',
        on: 'timer',
        once: true,
        delayMs: 350,
        condition: { type: 'flag', flag: 'abandoned_caravan' },
        events: [
          { type: 'setFlag', flag: 'maeric_accused', value: true },
          { type: 'setAtmosphere', tone: 'ashen', durationMs: 9000 },
          { type: 'playFx', kind: 'ash', x: townhall.x - 18, y: townhall.y - 24 },
          { type: 'retreatPlayerUnits', count: 2, kinds: COMBAT_UNITS, x: townhall.x, y: townhall.y, radius: TILE * 24, toX: retreatRoad.x, toY: retreatRoad.y, despawnAfterMs: 4200, label: 'Дезертир' },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Капитан Маэрик', text: 'Ты дал детям гореть и считал древесину. Я не назову это командованием.', durationMs: 10000 },
              { speaker: 'Лорд Роуэн Вейл', text: 'Я выбрал деревню.', durationMs: 6500 },
              { speaker: 'Капитан Маэрик', text: 'Ты выбрал то, что будет тебе повиноваться, когда крики стихнут.', durationMs: 10000 }
            ]
          }
        ]
      },
      {
        id: 'night_raid_start',
        phase: 'oathbreaker',
        on: 'timer',
        once: true,
        delayMs: 30000,
        condition: { type: 'flag', flag: 'maeric_accused' },
        events: [
          { type: 'setFlag', flag: 'night_raid_started', value: true },
          { type: 'setLandmarkVisible', id: 'actor_maeric', visible: false },
          { type: 'setAtmosphere', tone: 'ashen' },
          { type: 'revealArea', x: northeastRoad.x, y: northeastRoad.y, radiusTiles: 8 },
          { type: 'playFx', kind: 'fire', x: northeastRoad.x, y: northeastRoad.y },
          { type: 'playFx', kind: 'ash', x: northeastRoad.x, y: northeastRoad.y - 24 },
          { type: 'damageOrDestroyBuilding', side: SIDE.player, kind: 'farm', damage: 130, x: townhall.x, y: townhall.y, radius: TILE * 14 },
          { type: 'spawnUnits', groupId: 'mira_bowmen', units: wave(townhall.x + TILE * 2, townhall.y + TILE * 2, SIDE.player, 'alliance', [['archer', -18, 0], ['archer', 18, 10]]) },
          { type: 'spawnUnits', groupId: 'night_raid_a', units: wave(northeastRoad.x, northeastRoad.y, SIDE.ai, 'horde', [['footman', -28, 0], ['footman', 16, -22], ['archer', 36, 18], ['archer', -52, 24]]) },
          { type: 'commandGroup', groupId: 'night_raid_a', command: { type: 'attackTownhall' } },
          { type: 'showDialogue', lines: [{ speaker: 'Разведчица Мира', text: 'Налетчики во тьме. Они ждали, пока Маэрик уйдет.', durationMs: 8500 }] }
        ]
      },
      {
        id: 'night_raid_second_wave',
        phase: 'oathbreaker',
        on: 'timer',
        once: true,
        delayMs: 54000,
        condition: { type: 'flag', flag: 'night_raid_started' },
        events: [
          { type: 'setFlag', flag: 'night_raid_second_wave', value: true },
          { type: 'revealArea', x: southRoad.x, y: southRoad.y, radiusTiles: 8 },
          { type: 'playFx', kind: 'smoke', x: southRoad.x, y: southRoad.y },
          { type: 'playFx', kind: 'dust', x: southRoad.x, y: southRoad.y + 22 },
          { type: 'spawnUnits', groupId: 'night_raid_b', units: wave(southRoad.x, southRoad.y, SIDE.ai, 'horde', [['knight', -30, 0], ['footman', 18, -20], ['footman', 40, 18], ['archer', -58, 24]]) },
          { type: 'commandGroup', groupId: 'night_raid_b', command: { type: 'attackTownhall' } },
          { type: 'showDialogue', lines: [{ speaker: 'Лорд Роуэн Вейл', text: 'Им не нужна ратуша. Им нужно, чтобы мы боялись внутри нее.', durationMs: 8500 }] }
        ]
      },
      {
        id: 'night_raid_broken',
        phase: 'oathbreaker',
        on: 'state',
        once: true,
        condition: {
          all: [
            { type: 'flag', flag: 'night_raid_second_wave' },
            { type: 'groupCount', groupId: 'night_raid_a', count: 0 },
            { type: 'groupCount', groupId: 'night_raid_b', count: 0 },
            { type: 'buildingCount', side: SIDE.player, kind: 'townhall', count: 1 }
          ]
        },
        events: [
          { type: 'setObjectiveStatus', objectiveId: 'survive_oathbreaker', status: 'completed' },
          { type: 'setFlag', flag: 'night_raid_cleared', value: true },
          { type: 'showDialogue', lines: [{ speaker: 'Разведчица Мира', text: 'Мертвые пришли за ратушей, но что-то под часовней ответило первым.', durationMs: 9500 }] }
        ]
      },
      {
        id: 'night_raid_to_chapel',
        phase: 'oathbreaker',
        on: 'state',
        once: true,
        condition: { type: 'flagAgeMs', flag: 'night_raid_cleared', ms: 10000 },
        events: [
          { type: 'showMessage', text: 'Старая часовня отмечена на карте.' },
          { type: 'setPhase', phase: 'under_chapel' }
        ]
      },
      {
        id: 'chapel_reached',
        phase: 'under_chapel',
        on: 'areaEntered',
        once: true,
        area: { id: 'old_chapel', x: chapel.x, y: chapel.y, radius: TILE * 3.4, side: SIDE.player },
        events: [
          { type: 'setFlag', flag: 'chapel_reached', value: true },
          { type: 'setObjectiveStatus', objectiveId: 'reach_chapel', status: 'completed' },
          { type: 'setAtmosphere', tone: 'forbidden', durationMs: 9000 },
          { type: 'playFx', kind: 'glow', x: chapel.x, y: chapel.y },
          { type: 'playFx', kind: 'ash', x: chapel.x, y: chapel.y - 18 },
          { type: 'showDialogue', lines: [{ speaker: 'Корона', text: 'Кровь наверху. Кровь внизу. Наконец-то рука с именем.', durationMs: 9500 }] }
        ]
      },
      {
        id: 'chapel_to_crown_host',
        phase: 'under_chapel',
        on: 'state',
        once: true,
        condition: { type: 'flagAgeMs', flag: 'chapel_reached', ms: 10000 },
        events: [
          { type: 'setPhase', phase: 'under_chapel_power' }
        ]
      },
      {
        id: 'first_crown_power',
        phase: 'under_chapel_power',
        on: 'timer',
        once: true,
        delayMs: 26000,
        events: [
          { type: 'setFlag', flag: 'used_crown_power', value: true },
          { type: 'setAtmosphere', tone: 'forbidden', durationMs: 12000 },
          { type: 'playFx', kind: 'glow', x: crownGate.x, y: crownGate.y },
          { type: 'playFx', kind: 'explosion', x: crownGate.x + 38, y: crownGate.y + 12 },
          { type: 'playFx', kind: 'ash', x: townhall.x, y: townhall.y - 28 },
          { type: 'commandGroup', groupId: 'crown_host', command: { type: 'despawn' } },
          { type: 'sacrificePlayerUnits', count: 2, kinds: ['footman', 'archer', 'knight', 'worker'], x: townhall.x, y: townhall.y, radius: TILE * 30, label: 'Клятва взята' },
          { type: 'damageOrDestroyBuilding', side: SIDE.player, kind: 'tower', damage: 999, x: townhall.x, y: townhall.y, radius: TILE * 18 },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Разведчица Мира', text: 'Воинство стало пеплом.', durationMs: 5000 },
              { speaker: 'Капитан Маэрик', text: 'И двое наших тоже.', durationMs: 6500 },
              { speaker: 'Корона', text: 'У победы всегда было тело. Я лишь перестала его прятать.', durationMs: 10000 }
            ]
          }
        ]
      },
      {
        id: 'crown_power_aftermath',
        phase: 'under_chapel_power',
        on: 'timer',
        once: true,
        delayMs: 56000,
        condition: { type: 'flag', flag: 'used_crown_power' },
        events: [
          { type: 'setObjectiveStatus', objectiveId: 'crown_first_price', status: 'completed' },
          { type: 'setPhase', phase: 'crown_of_ash' }
        ]
      },
      {
        id: 'choose_destroy_crown',
        phase: 'crown_of_ash',
        on: 'areaEntered',
        once: true,
        area: { id: 'destroy_crown_marker', x: destroyChoice.x, y: destroyChoice.y, radius: TILE * 2.6, side: SIDE.player },
        events: [
          { type: 'setObjectiveStatus', objectiveId: 'final_choice', status: 'completed' },
          { type: 'setLandmarkVisible', id: 'choice_wear_obelisk', visible: false },
          { type: 'setPhase', phase: 'destroy_crown' }
        ]
      },
      {
        id: 'choose_wear_crown',
        phase: 'crown_of_ash',
        on: 'areaEntered',
        once: true,
        area: { id: 'wear_crown_marker', x: wearChoice.x, y: wearChoice.y, radius: TILE * 2.6, side: SIDE.player },
        events: [
          { type: 'setObjectiveStatus', objectiveId: 'final_choice', status: 'completed' },
          { type: 'setLandmarkVisible', id: 'choice_destroy_obelisk', visible: false },
          { type: 'setPhase', phase: 'wear_crown' }
        ]
      },
      {
        id: 'destroy_second_host',
        phase: 'destroy_crown',
        on: 'timer',
        once: true,
        delayMs: 22000,
        events: [
          { type: 'setFlag', flag: 'destroy_second_host_sent', value: true },
          { type: 'revealArea', x: southRoad.x, y: southRoad.y, radiusTiles: 8 },
          { type: 'playFx', kind: 'dust', x: southRoad.x, y: southRoad.y + 22 },
          { type: 'spawnUnits', groupId: 'destroy_host_b', units: wave(southRoad.x, southRoad.y, SIDE.ai, 'horde', [['knight', -32, 0], ['knight', 24, 20], ['footman', 50, -16], ['archer', -58, 24], ['catapult', 70, 8]]) },
          { type: 'commandGroup', groupId: 'destroy_host_b', command: { type: 'attackTownhall' } },
          { type: 'showDialogue', lines: [{ speaker: 'Корона', text: 'Последний шанс, маленький лорд. Надень меня, и они преклонятся.', durationMs: 9000 }] }
        ]
      },
      {
        id: 'destroy_crown_victory',
        phase: 'destroy_crown',
        on: 'state',
        once: true,
        condition: {
          all: [
            { type: 'flag', flag: 'destroy_second_host_sent' },
            { type: 'elapsedMs', ms: 22000 },
            { type: 'groupCount', groupId: 'destroy_host_a', count: 0 },
            { type: 'groupCount', groupId: 'destroy_host_b', count: 0 },
            { type: 'buildingCount', side: SIDE.player, kind: 'townhall', count: 1 }
          ]
        },
        events: [
          { type: 'setObjectiveStatus', objectiveId: 'destroy_crown_defense', status: 'completed' },
          { type: 'setFlag', flag: 'destroy_victory_dialogue_started', value: true },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Капитан Маэрик', text: 'Короны больше нет.', durationMs: 6000 },
              { speaker: 'Лорд Роуэн Вейл', text: 'Нет. Она похоронена в каждом, кого я потратил, чтобы ее сломать.', durationMs: 10000 },
              { speaker: 'Разведчица Мира', text: 'Тогда вспомни их имена раньше, чем вспомнишь победу.', durationMs: 10000 }
            ]
          }
        ]
      },
      {
        id: 'destroy_crown_end',
        phase: 'destroy_crown',
        on: 'state',
        once: true,
        condition: { type: 'flagAgeMs', flag: 'destroy_victory_dialogue_started', ms: 28000 },
        events: [
          {
            type: 'endGame',
            win: true,
            lines: [
              { text: 'Корона раскололась, но ее пепел остался на каждом приказе.' },
              { text: 'Спасенные повозки ушли за западный холм и понесли имена павших дальше войны.', flag: 'saved_caravan' },
              { text: 'На старой дороге никто не сказал, что победа была чистой.', flag: 'abandoned_caravan' }
            ]
          }
        ]
      },
      {
        id: 'wear_crown_victory',
        phase: 'wear_crown',
        on: 'state',
        once: true,
        condition: {
          all: [
            { type: 'groupCount', groupId: 'maeric_loyalists', count: 0 },
            { type: 'groupCount', groupId: 'wear_host', count: 0 },
            { type: 'elapsedMs', ms: 12000 },
            { type: 'buildingCount', side: SIDE.player, kind: 'townhall', count: 1 }
          ]
        },
        events: [
          { type: 'setObjectiveStatus', objectiveId: 'wear_crown_assault', status: 'completed' },
          { type: 'setFlag', flag: 'wear_victory_dialogue_started', value: true },
          {
            type: 'showDialogue',
            lines: [
              { speaker: 'Корона', text: 'Дорога тиха. Ратуша стоит. Предатели стали пеплом.', durationMs: 9000 },
              { speaker: 'Лорд Роуэн Вейл', text: 'Пошлите всадников в каждую деревню. Скажите им: их лорд спас их.', durationMs: 10000 },
              { speaker: 'Разведчица Мира', text: 'А что им делать, если они не хотят такого спасения?', durationMs: 9000 },
              { speaker: 'Лорд Роуэн Вейл', text: 'Захотят.', durationMs: 6000 }
            ]
          }
        ]
      },
      {
        id: 'wear_crown_end',
        phase: 'wear_crown',
        on: 'state',
        once: true,
        condition: { type: 'flagAgeMs', flag: 'wear_victory_dialogue_started', ms: 36000 },
        events: [
          {
            type: 'endGame',
            win: true,
            lines: [
              { text: 'Роуэн сохранил границу и потерял право на тишину.' },
              { text: 'Те, кого он спас на дороге, первыми услышали новый закон Короны.', flag: 'saved_caravan' },
              { text: 'Там, где горели повозки, теперь ставят первый знак нового короля.', flag: 'abandoned_caravan' }
            ]
          }
        ]
      }
    ]
  };
}

function wave(x: number, y: number, side: Side, race: Race, specs: UnitSpec[]): StoryScriptedUnit[] {
  return specs.map(([kind, dx, dy]) => ({ kind, side, race, x: x + dx, y: y + dy }));
}

function worldPoint(tx: number, ty: number): { x: number; y: number } {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}
