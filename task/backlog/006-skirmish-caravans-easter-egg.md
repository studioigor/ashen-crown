# 006. Skirmish Caravans Easter Egg

## Коротко

Добавить редкие нейтральные караваны в `1v1 Skirmish`: они проходят по маршруту, могут быть атакованы, при смерти дают награду и не ломают баланс.

## Контекст проекта

Караван уже есть как future art asset:

- `public/assets/art/future/caravan_idle.png`;
- `public/assets/art/future/caravan_walk.png`;
- `public/assets/art/future/caravan_attack.png`;
- `public/assets/art/future/caravan_death.png`.

Это neutral/future unit, не обычный `UnitKind`. Он нужен и для skirmish easter egg, и позже для story dilemma в задаче 013.

## Предыдущие задачи

Задача 002 должна была стабилизировать unit animation path. Задача 005 должна была ввести режимы, чтобы караваны появлялись только в `skirmish`, а в story могли запускаться скриптом. Если 005 еще не сделана, добавить feature flag в `GameScene`, но не смешивать это с будущим story flow.

## Что сделать

1. Добавить сущность каравана:
   - отдельный `src/entities/Caravan.ts`; или
   - аккуратный wrapper вокруг `Unit`, если типы позволяют без загрязнения `UnitKind`.
2. Караван должен иметь:
   - neutral side;
   - hp;
   - radius;
   - movement path;
   - death animation;
   - reward on death.
3. Добавить spawn manager в `GameScene.ts`:
   - редкий таймер;
   - spawn на краю карты;
   - маршрут через дорогу/центр/край;
   - despawn при выходе.
4. Добавить loot:
   - небольшое количество gold/lumber;
   - floating text;
   - FX: dust/spark/debris.
5. Убедиться, что AI не строит стратегию вокруг караванов:
   - ИИ может игнорировать их;
   - игрок может атаковать;
   - караван не должен блокировать pathfinding критично.
6. Добавить config values:
   - spawn interval range;
   - reward amount;
   - enable/disable in skirmish/story.

## Implementation notes

- Runtime caravan frame size: `192x128`.
- Suggested display: примерно `96x64`.
- Не добавлять caravan в `UNIT_KINDS`, если это ломает production/build UI.
- Если нужен targetable neutral entity, соблюдать интерфейс `IEntity`.
- Караван должен чистить healthbar/sprite/path state при despawn.

## Проверка

- `npm run build`
- В skirmish дождаться spawn или временно включить debug fast spawn.
- Проверить:
  - walk animation;
  - target selection/attack;
  - death animation;
  - reward;
  - despawn;
  - отсутствие spawn в story mode, если story mode уже существует.

## Что будет дальше

Задача 007 добавит autopilot, который не должен случайно управлять караванами. Задача 013 переиспользует caravan entity для сюжетного выбора: спасать караван или оставить его погибать.
