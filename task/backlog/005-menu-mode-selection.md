# 005. Menu Mode Selection

## Коротко

Разделить игру на два режима запуска: `1v1 Skirmish` против ИИ и отдельный `Story Map`. После этой задачи дальнейшие gameplay/story задачи смогут получать mode config и не смешивать skirmish-логику с сюжетной.

## Контекст проекта

Сейчас игра стартует как текущий RTS матч против ИИ. Пользователь хочет два режима:

- `1v1 Skirmish`: текущий режим против ИИ, позже с караванами, автопилотом, формациями и улучшенным AI.
- `Story Map`: одна сюжетная карта с objectives, триггерами, катсценами и драматической аркой.

Меню визуально уже устраивает пользователя, поэтому не надо делать новую большую графику меню или генерировать новые menu images.

## Предыдущие задачи

Задача 004 могла добавить UI icons/tooltips. Она не является строгим prerequisite, но если она уже сделана, использовать ее UI conventions. Графические задачи 001-003 должны были стабилизировать assets, которые будут использоваться в обоих режимах.

## Что сделать

1. Ввести тип режима:
   - `GameMode = 'skirmish' | 'story'`;
   - место для mode config в `src/config.ts` или отдельном типовом файле.
2. Обновить `MenuScene.ts`:
   - добавить выбор `1v1 Skirmish`;
   - добавить выбор `Story Map`;
   - сохранить текущий выбор race/difficulty для skirmish;
   - для story mode можно фиксировать race/difficulty или скрыть difficulty.
3. Передавать в `GameScene` config:
   - `mode`;
   - `playerRace`;
   - `difficulty`;
   - `storyMapId`, если mode story.
4. В `GameScene` сохранить mode config и не полагаться на implicit defaults.
5. В `UIScene` показать активный режим хотя бы в debug/summary месте.
6. Убедиться, что текущий skirmish flow не меняется для пользователя, если он выбирает `1v1 Skirmish`.

## Implementation notes

- Основные файлы: `src/scenes/MenuScene.ts`, `src/scenes/GameScene.ts`, `src/scenes/UIScene.ts`, `src/config.ts`, `src/ui.css`.
- Не делать story mechanics в этой задаче. Нужно только подготовить mode selection и передачу config.
- Не ломать GitHub Pages base paths.
- Не удалять текущую возможность быстро стартовать матч.

## Проверка

- `npm run build`
- Запустить меню.
- Стартовать `1v1 Skirmish` за alliance и horde.
- Проверить difficulty для skirmish.
- Стартовать `Story Map`; допускается пока заглушка, но `GameScene` должен знать, что mode story.
- Вернуться в меню и стартовать другой режим без stale state.

## Что будет дальше

Задача 006 добавит караваны в `1v1 Skirmish`. Задача 012 использует `Story Map` mode config, чтобы подключить story controller. Если задача 005 не сделана, story и skirmish будут сложнее разделять в коде.
