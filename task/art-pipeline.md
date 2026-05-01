# Ashen Crown Art Pipeline

Этот документ фиксирует текущий raster asset pipeline как основной путь для
готовой графики. Процедурные текстуры в `BootScene.ts` остаются fallback:
игра использует runtime PNG только когда их ключи перечислены в
`public/assets/art/manifest.generated.json`.

## Рабочий процесс

1. Положить новый GPT Image sheet в `public/assets/art/source`.
2. Назвать файл по одному из ожидаемых шаблонов из списка ниже.
3. Запустить генератор:

   ```bash
   python3 task/tools/process-art-assets.py
   ```

4. Открыть `task/art-sample/index.html` в браузере и проверить runtime PNG.
5. Если результат корректный, обновить `docs/` для GitHub Pages:

   ```bash
   npm run build
   ```

`npm run build` пишет production bundle в `docs/` и копирует `public/assets/art`
в `docs/assets/art`. Не меняйте `vite.config.ts` base path: GitHub Pages
ожидает `/ashen-crown/`, а game runtime строит asset URLs через
`src/assets/artManifest.ts`.

## Ожидаемые source файлы

Unit sheets лежат в `public/assets/art/source` и называются:

- `units_alliance_worker.png`
- `units_alliance_footman.png`
- `units_alliance_archer.png`
- `units_alliance_knight.png`
- `units_alliance_catapult.png`
- `units_horde_worker.png`
- `units_horde_footman.png`
- `units_horde_archer.png`
- `units_horde_knight.png`
- `units_horde_catapult.png`
- `future_caravan.png`

Unit source sheet ожидается как 3 ряда направлений: `south`, `east`, `north`.
`west` генерируется зеркалированием `east`. Runtime sheet получает 4 ряда
направлений и отдельный PNG на каждую анимацию. Frame size для обычных юнитов
`128x128`, для caravan `192x128`.

Building sheets называются:

- `building_alliance_townhall.png`
- `building_alliance_farm.png`
- `building_alliance_barracks.png`
- `building_alliance_workshop.png`
- `building_alliance_tower.png`
- `building_horde_townhall.png`
- `building_horde_farm.png`
- `building_horde_barracks.png`
- `building_horde_workshop.png`
- `building_horde_tower.png`

Building source sheet ожидается как 5 кадров в строку:
`stage1`, `stage2`, `final`, `destroying`, `ruin`.

Shared sheets:

- `damage_overlays_all_buildings.png`
- `terrain_tiles.png`
- `water_frame_3.png`
- `resources_and_decals.png`
- `projectiles_particles_fx.png`
- `cursors_selection_commands.png`
- `ui_frames.png`
- `command_resource_icons.png`

Иконки режутся component-based extraction, не грубой равной сеткой. Terrain
tiles нормализуются как полноразмерные `32x32`; их alpha bbox может касаться
края, это нормально.

## Проверка результата

После запуска генератор печатает audit summary:

- сколько unit sheets и building sheets обработано;
- сколько terrain/resource/fx/ui/icon assets создано;
- какие source файлы отсутствуют;
- какие не-terrain кадры касаются края alpha bbox;
- итоговое количество `enabledKeys`.

Текущий полный набор должен давать `enabledKeys: 146` и `missing source files:
none`.

Sample viewer должен показывать все enabled runtime assets:

- юниты и caravan по всем направлениям и анимациям;
- building stages;
- building damage/destruction overlays;
- terrain tiles, включая alias `tile_water`;
- resources, fx, ui и command/resource icons.

Проверяйте визуально:

- кадр обрезан, если sprite или тень упирается в край canvas/ячейки;
- кадр сплющен, если квадратный unit frame выглядит растянутым по одной оси;
- у building stage должны быть видны все 5 стадий;
- у icons не должно пропадать оружие, контур или resource символ.

Юнитов нельзя растягивать через `setDisplaySize(width, height)`, когда frame
квадратный. Используйте uniform scale.

## Если GPT Image выдал кривой sheet

- Лишний ряд или столбец: не коммитьте runtime PNG. Сначала поправьте source
  sheet или добавьте осознанный override в `process-art-assets.py`.
- Кривая сетка у units: проверьте `task/art-sample/normalized/*.png`; если
  component extraction попала не в ту ячейку, исправьте source layout или
  координатный override.
- Кривая сетка у buildings: source должен быть ровно 5 stage slots в строку.
  Если объект сильно смещен внутри slot, лучше поправить source PNG, чем
  компенсировать это в runtime.
- Обрезанные icons: проверьте `task/art-sample/icons-audit.png` и
  `task/art-sample/icon-source-grid-debug.png`; увеличивайте padding или
  корректируйте component assignment только после визуальной проверки.

## Audit изображения

Генератор обновляет:

- `task/art-sample/unit-scale-audit.png`
- `task/art-sample/icons-audit.png`
- `task/art-sample/terrain-audit.png`
- `task/art-sample/buildings-audit.png`

`task/art-sample/ui-audit.png` сохранен как существующий вспомогательный audit.
