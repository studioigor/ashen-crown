# 007. Autopilot For Player Units

## Коротко

Добавить опциональный автопилот для выбранных юнитов игрока: ИИ временно управляет конкретным юнитом или группой, но любой ручной приказ сразу возвращает контроль игроку.

## Контекст проекта

В `task/requests.md` есть пункт про автопилот. В игре уже есть AI controller для противника, но его нельзя просто включить на всех player units без ограничений. Нужен lightweight behavior layer для конкретных выбранных юнитов.

Autopilot должен быть удобной функцией, а не заменой игрока. Он должен помогать с routine tasks: рабочий добывает/строит, военный защищает или идет к ближайшей угрозе.

## Предыдущие задачи

Задача 004 могла добавить command icons, включая `icon_autopilot`. Задача 006 добавила neutral caravan; autopilot не должен пытаться управлять neutral caravan. Задача 005 важна, потому что в story mode автопилот может быть отключен или ограничен фазами миссии.

## Что сделать

1. Добавить per-unit состояние:
   - `autopilot: boolean`;
   - возможно `autopilotMode`, если потребуется.
2. Добавить UI command:
   - кнопка/toggle в command panel;
   - иконка `icon_autopilot`, если задача 004 сделана;
   - visible только для player units.
3. Поведение worker autopilot:
   - если idle и рядом есть ресурс, gather;
   - если несет cargo, return cargo;
   - если есть незавершенная allied building nearby, help build/repair.
4. Поведение military autopilot:
   - если враг в sight/range, атаковать;
   - если база под атакой, идти защищать;
   - не уходить слишком далеко без явной команды.
5. Любой ручной приказ игрока должен выключать autopilot для выбранных юнитов:
   - move;
   - attack;
   - gather;
   - build;
   - stop.
6. Добавить visual/state indication в selected panel или над юнитом.

## Implementation notes

- Основные файлы: `src/entities/Unit.ts`, `src/scenes/GameScene.ts`, `src/scenes/UIScene.ts`, `src/systems/AI.ts`.
- Не переносить весь enemy AI напрямую в Unit. Лучше сделать small helper/service, который принимает player unit и world query.
- Следить за command loops: autopilot не должен каждую frame перезаписывать path.
- Добавить cooldown принятия решений.

## Проверка

- `npm run build`
- Worker autopilot:
  - добывает;
  - возвращает cargo;
  - прекращает autopilot после manual move.
- Military autopilot:
  - атакует угрозу;
  - не убегает через всю карту без причины;
  - прекращает autopilot после manual order.
- Group toggle работает на нескольких выбранных юнитах.

## Что будет дальше

Задача 008 добавит formation movement. Autopilot должен использовать обычные команды движения, чтобы потом автоматически получить formation/pathfinding улучшения. Задача 011 улучшит skirmish AI, но player autopilot должен оставаться отдельным и управляемым игроком.
