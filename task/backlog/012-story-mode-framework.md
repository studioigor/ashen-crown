# 012. Story Mode Framework

## Коротко

Создать технический каркас `Story Map`: story state, objectives, triggers, dialogue overlay, camera beats и отделение от skirmish AI/rules.

## Контекст проекта

Пользователь хочет второй режим: одна сюжетная карта с драматической аркой. Эта задача не пишет всю миссию, а строит систему, на которую задача 013 положит конкретный сюжет.

Story mode должен быть отдельным от skirmish:

- свои objectives;
- свои scripted events;
- свои caravan events;
- свои win/loss/fail states;
- возможность временно ограничивать production/building.

## Предыдущие задачи

Задача 005 должна была добавить выбор `Story Map` в меню и передавать `mode: 'story'`. Задача 011 должна была изолировать skirmish rules. Если 005 еще не сделана, сначала нужно добавить минимальный mode config, иначе story controller некуда подключать.

## Что сделать

1. Добавить story types:
   - `StoryPhase`;
   - `StoryObjective`;
   - `StoryTrigger`;
   - `StoryEvent`;
   - `StoryFlag`.
2. Создать `src/story/StoryController.ts`:
   - хранит current phase;
   - хранит objectives;
   - хранит flags;
   - получает доступ к нужным методам `GameScene`;
   - обновляется по timer/update или explicit events.
3. Создать `src/story/storyMap.ts`:
   - описание стартовой story map;
   - стартовые units/buildings/resources;
   - trigger definitions;
   - dialogue lines placeholders.
4. Подключить в `GameScene.ts`:
   - если mode story, создать StoryController;
   - отключить skirmish AI timers, если они не нужны;
   - передавать события: unit killed, building destroyed, resource gathered, area entered.
5. Добавить objectives UI в `UIScene.ts`:
   - current objective title;
   - optional sub-objectives;
   - completed/failed visual state.
6. Добавить dialogue overlay:
   - speaker;
   - text;
   - continue/auto-dismiss;
   - не блокировать игру навсегда при missed input.
7. Добавить camera helpers:
   - pan/focus point;
   - focus entity;
   - short control lock/unlock.

## Implementation notes

- Основные файлы: `src/story/StoryController.ts`, `src/story/storyMap.ts`, `src/scenes/GameScene.ts`, `src/scenes/UIScene.ts`, `src/config.ts`.
- Не надо делать все сюжетные фазы в этой задаче.
- Dialogue text можно написать черновой, задача 013 его усилит.
- API StoryController должен быть простым, чтобы следующая сессия могла добавлять события без переписывания.

## Проверка

- `npm run build`
- Из меню стартует `Story Map`.
- Появляется первый objective.
- Триггер может:
  - сменить objective;
  - показать dialogue;
  - поставить flag;
  - сдвинуть камеру.
- Skirmish mode запускается и не создает StoryController.

## Что будет дальше

Задача 013 наполнит этот framework конкретной миссией `The Ashen Crown`: caravan dilemma, предательство, forbidden power и финальный моральный выбор.
