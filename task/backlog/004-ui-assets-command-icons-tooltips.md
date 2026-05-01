# 004. UI Assets, Command Icons And Hover Tooltips

## Коротко

Добавить hover tooltip по игровым объектам и начать использовать готовые command/resource icons в UI, не ломая текущую панель команд.

## Контекст проекта

В `task/requests.md` первым пунктом указаны тултипы при наведении на юниты и здания. Сейчас в `UIScene.ts` уже есть text area для подсказок команд (`mode-text`), но нет полноценного entity tooltip. Также уже готовы UI assets:

- command icons: `public/assets/art/ui/icons/*.png`;
- resource icons: `gold`, `lumber`;
- UI frames: `panel_frame`, `tooltip_frame`, `minimap_frame`;
- cursors and selection rings.

Иконки уже нормализованы component-based extraction, поэтому их нельзя снова резать грубой сеткой.

## Предыдущие задачи

Задача 002 должна была стабилизировать unit sprites. Задача 003 должна была стабилизировать building/resource states. Эта задача использует их данные в tooltip: HP, attack, sight, carried resources, building state.

## Что сделать

1. Добавить hover detection в `GameScene.ts`:
   - слушать `pointermove`;
   - определить entity под курсором;
   - приоритет: UI не должен ловить world hover, если курсор над DOM panel;
   - не делать дорогой full scan каждый кадр, если уже есть spatial lookup или удобные массивы.
2. Добавить entity tooltip в `UIScene.ts`:
   - name/type;
   - owner/race, если полезно;
   - HP/maxHP;
   - attack/range/sight для боевых юнитов и башен;
   - worker carried resource amount/type;
   - building production/construction state;
   - short role text.
3. Tooltip должен:
   - появляться при hover;
   - исчезать при уходе;
   - не flicker;
   - не перекрывать command buttons;
   - использовать существующий UI style.
4. Добавить icon slot в command buttons:
   - stop;
   - attack move;
   - build;
   - repair;
   - rally;
   - production icons для worker/footman/archer/knight/catapult;
   - gather icons где применимо.
5. Подключить resource icons к resource counters, если это не требует большого refactor.

## Implementation notes

- Основные файлы: `src/scenes/GameScene.ts`, `src/scenes/UIScene.ts`, `src/ui.css`, `src/assets/artManifest.ts`.
- DOM UI может использовать URL из `import.meta.env.BASE_URL`; не хардкодить `/assets/...`, чтобы GitHub Pages base не ломался.
- Если использовать Phaser-loaded textures в DOM неудобно, можно использовать прямые `assets/art/ui/icons/*.png` paths через base URL helper.
- Не добавлять tooltip text как canvas, текст должен остаться DOM для читаемости.

## Проверка

- `npm run build`
- Навести на:
  - worker с ресурсом и без;
  - footman/archer/knight/catapult;
  - building full HP/damaged/constructing;
  - resource node.
- Проверить command panel icons и hotkeys.
- Проверить, что tooltip не остается висеть после смерти entity.

## Что будет дальше

Задача 005 добавит выбор режимов в меню и будет использовать более явный UI flow. Задача 007 добавит command icon для autopilot. Задача 012 переиспользует tooltip/dialogue UI подход для story overlay.
