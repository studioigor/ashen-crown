# 003. Building And Resource Art Integration

## Коротко

Довести sprite-based постройки, стадии строительства, разрушение, damage overlays и ресурсные ноды до состояния, пригодного для gameplay.

## Контекст проекта

Building source sheets уже сгенерированы и нормализуются в runtime sheets:

- races: `alliance`, `horde`;
- buildings: `townhall`, `farm`, `barracks`, `workshop`, `tower`;
- stages: `stage1`, `stage2`, `final`, `destroying`, `ruin`.

Resource assets уже есть:

- `goldmine`, `goldmine_damaged`, `goldmine_depleted`;
- `tree`, `tree_stump`, `tree_log`, `tree_trunk`, `tree_canopy`.

`Building.ts` уже умеет выбирать art sheet, но эту интеграцию надо довести и проверить по всем состояниям.

## Предыдущие задачи

Задача 001 задает правила pipeline. Задача 002 важна как пример правильного разделения visual size и gameplay radius: в этой задаче нужно сохранить тот же принцип для building footprint и resource click areas.

## Что сделать

1. Проверить construction stages:
   - `stage1` в начале строительства;
   - `stage2` в середине;
   - `final` после завершения;
   - stages не прыгают по размеру и остаются на footprint.
2. Проверить damage overlay:
   - легкий overlay при средних повреждениях;
   - heavy/destruction overlay при низком HP;
   - overlay совпадает с display size здания;
   - overlay скрывается/уничтожается при destroy.
3. Проверить destruction:
   - при смерти здания показать `destroying`;
   - затем `ruin`;
   - затем fade/despawn по текущему gameplay flow;
   - не оставить dangling flag/glow/smoke/healthbar.
4. Проверить resources:
   - goldmine меняет visual state при истощении;
   - depleted mine остается читаемой;
   - tree death оставляет stump/log decal, если asset доступен;
   - resource click area и harvest logic не меняются.
5. Проверить fallback:
   - если art asset отсутствует, старый procedural texture все еще работает;
   - если art asset есть, procedural не должен перекрывать его.

## Implementation notes

- Основные файлы: `src/entities/Building.ts`, `src/entities/ResourceNode.ts`, `src/scenes/GameScene.ts`, `src/assets/artManifest.ts`.
- Building frame sizes:
  - `townhall`, `barracks`, `workshop`: `192x192`;
  - `farm`, `tower`: `128x128`.
- Building display sizes:
  - size 3 footprint: `96x96`;
  - size 2 footprint: `64x64`.
- Не менять `BUILDING[kind].size` ради картинки.
- Damage overlays лежат рядом с building runtime assets и должны масштабироваться тем же display size.

## Проверка

- `python3 task/tools/process-art-assets.py`
- `npm run build`
- В sample viewer проверить building animation loop.
- В игре проверить:
  - строительство каждого здания;
  - повреждение каждого здания;
  - разрушение;
  - harvesting gold/tree;
  - depleted goldmine/tree stump.

## Что будет дальше

Задача 004 использует UI frame/icon assets и добавляет тултипы, которые должны правильно показывать HP зданий и ресурсы worker. Задача 013 использует building ruin/destruction для scripted story events.
