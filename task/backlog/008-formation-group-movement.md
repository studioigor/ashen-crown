# 008. Formation Group Movement

## Коротко

Сделать групповые move/attack-move команды читаемыми: юниты получают разные слоты строя, не собираются в одну точку и сохраняют примерную роль в группе.

## Контекст проекта

В `task/requests.md` есть пункт про строй, обход и поддержку больших групп. В проекте уже есть `Formation.ts`, но его надо подключить к реальным player commands. Эта задача не должна переписывать весь pathfinding; она должна создать слой распределения целей группы.

## Предыдущие задачи

Задача 007 добавляла autopilot. Если она сделана, autopilot должен отдавать обычные group/unit orders, а не обходить formation logic. Задача 002 важна тем, что visual size юнитов не равен collision radius; formation slots должны использовать gameplay radius.

## Что сделать

1. Найти текущий flow групповой команды в `GameScene.ts`.
2. При выборе группы больше 1 юнита:
   - вычислить center target;
   - построить formation slots вокруг click point;
   - назначить каждому юниту свой slot.
3. Распределять роли:
   - melee ближе к фронту;
   - ranged позади;
   - siege позади или в центре;
   - workers без боевой роли не должны мешать военным.
4. Подключить к:
   - move;
   - attack-move;
   - возможно rally target, если это дешево.
5. Избежать лишнего A*:
   - один path до group center;
   - slot offset применяется в конце;
   - не делать отдельный path для каждого юнита без необходимости.
6. Добавить fallback:
   - если slot blocked, выбрать ближайший свободный;
   - если группа маленькая, не усложнять.

## Implementation notes

- Основные файлы: `src/systems/Formation.ts`, `src/scenes/GameScene.ts`, `src/entities/Unit.ts`.
- Formation должна использовать `UNIT[kind].size`/radius, а не sprite display size.
- Для direction/facing ничего специально делать не надо: Unit update сам выберет walk facing.
- Не решать global stuck и 500-unit perf в этой задаче, это задача 009/010.

## Проверка

- `npm run build`
- Выделить 10, 30, 60 юнитов.
- Дать move command:
  - юниты приходят в разные точки;
  - ranged/siege не оказываются впереди melee без причины.
- Дать attack-move:
  - formation не ломает атаку;
  - юниты не стоят из-за недоступного slot.

## Что будет дальше

Задача 009 стабилизирует pathfinding для больших групп и узких проходов. Она будет опираться на то, что group movement уже имеет group center и slots. Задача 010 измерит производительность на 100-500 юнитах.
