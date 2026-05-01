# 002. Unit Sprite Gameplay Integration

## Коротко

Довести sprite-based юнитов до игрового качества: все стороны, анимации, facing, death cleanup и отсутствие деформации. После задачи юниты должны быть готовы для 1v1 и будущего story mode.

## Контекст проекта

В проекте уже есть art manifest и runtime unit sprite sheets:

- `public/assets/art/units/alliance/{worker,footman,archer,knight,catapult}_{idle,walk,attack,death}.png`;
- `public/assets/art/units/horde/{worker,footman,archer,knight,catapult}_{idle,walk,attack,death}.png`;
- worker дополнительно имеет `work`;
- neutral caravan лежит в `public/assets/art/future/caravan_{idle,walk,attack,death}.png`.

`BootScene.ts` загружает assets из manifest и регистрирует Phaser animations. `Unit.ts` уже умеет использовать art sheets, если они загружены. Процедурный путь должен остаться fallback, но не основной путь.

## Предыдущие задачи

Задача 001 должна была закрепить pipeline и audit checks. Если она еще не сделана, перед началом этой задачи надо хотя бы запустить `python3 task/tools/process-art-assets.py` и открыть `task/art-sample/index.html`, чтобы убедиться, что unit sheets не обрезаны.

## Что сделать

1. Проверить `Unit.ts`:
   - art-sheet path выбирается для всех готовых unit assets;
   - procedural weapon sprite не создается для sprite-based юнитов;
   - fallback работает только если asset отсутствует.
2. Проверить animation switching:
   - idle при стоянии;
   - walk при движении;
   - attack при ударе/выстреле;
   - work для worker gather/build;
   - death при смерти.
3. Проверить facing:
   - movement vector выбирает `south/east/north/west`;
   - attack/work поворачивают юнита к цели;
   - при остановке сохраняется последнее направление;
   - west не должен выглядеть как отдельный неправильный source, он зеркалится.
4. Проверить uniform scale:
   - не использовать прямоугольное `setDisplaySize` на квадратном `128x128`;
   - `UNIT_ART_DISPLAY` должен задавать целевой render size без сплющивания;
   - collision radius, speed, range и attack timing не меняются.
5. Проверить death lifecycle:
   - death animation успевает проиграться;
   - healthbar уничтожается;
   - cargo badge уничтожается;
   - selection и targeting не получают ссылку на уничтоженный sprite.

## Implementation notes

- Основные файлы: `src/entities/Unit.ts`, `src/assets/artManifest.ts`, `src/scenes/BootScene.ts`.
- Frame size unit sheets: `128x128`.
- Caravan frame size: `192x128`.
- Если конкретный юнит выглядит меньше/больше остальных, сначала править `UNIT_TARGET_BASE_HEIGHT` в `task/tools/process-art-assets.py`, затем перегенерировать assets.
- Не менять `UNIT[kind].size` ради визуального размера: это gameplay collision.

## Проверка

- `python3 task/tools/process-art-assets.py`
- `npm run build`
- В sample viewer проверить все unit animations.
- В игре проверить:
  - стартовую базу;
  - выделение юнита;
  - move;
  - attack;
  - gather/build worker work;
  - death;
  - ranged attack для archer/catapult.

## Что будет дальше

Задача 003 переводит buildings/resources на такой же уровень готовности. Задача 006 использует neutral caravan sprite как gameplay entity. Задача 013 использует unit death/attack/work animations для scripted story events.
