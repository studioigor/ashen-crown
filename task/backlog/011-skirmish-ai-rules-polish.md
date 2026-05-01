# 011. Skirmish AI And Rules Polish

## Коротко

Довести `1v1 Skirmish` до самостоятельного режима: понятный старт, надежные win/loss conditions, улучшенный AI, караваны как редкое событие и summary в конце.

## Контекст проекта

Skirmish — это текущая основа игры: игрок против ИИ. После задачи 005 режим должен запускаться явно как `skirmish`. После задачи 006 в нем могут появляться караваны. После задач 008-010 movement/performance должны быть стабильнее.

Эта задача не делает story mode. Она полирует текущий replayable режим.

## Предыдущие задачи

Важны задачи 005, 006, 008, 009, 010:

- 005 разделяет режимы;
- 006 добавляет караваны;
- 008-009 улучшают движение групп;
- 010 снижает FPS просадки.

Если часть из них не сделана, эту задачу можно выполнять частично, но не надо привязывать skirmish rules к будущему story state.

## Что сделать

1. Проверить start conditions:
   - стартовые здания;
   - стартовые workers;
   - стартовые ресурсы;
   - race-specific labels.
2. Проверить difficulty:
   - easy/normal/hard должны отличаться темпом;
   - параметры должны быть в config;
   - AI не должен ломаться на easy.
3. Улучшить AI:
   - строит экономику;
   - не забывает production;
   - собирает army group перед атакой;
   - защищает базу при нападении;
   - не отправляет одиночные suicide attacks без причины.
4. Встроить караваны:
   - skirmish caravan spawn можно включить;
   - AI может игнорировать караван или атаковать только opportunistically;
   - награда не должна ломать баланс.
5. Win/loss:
   - поражение при уничтожении ключевых зданий игрока;
   - победа при уничтожении базы ИИ;
   - cleanup timers и UI state.
6. End summary:
   - время матча;
   - units killed/lost;
   - resources gathered;
   - caravans looted, если задача 006 сделана.

## Implementation notes

- Основные файлы: `src/systems/AI.ts`, `src/scenes/GameScene.ts`, `src/scenes/UIScene.ts`, `src/config.ts`.
- Не добавлять story objectives в skirmish.
- Не делать AI omniscient, если fog matters.
- AI должен использовать те же movement/order systems, что игрок, насколько возможно.

## Проверка

- `npm run build`
- Сыграть короткий skirmish на easy/normal/hard.
- Проверить:
  - AI строит базу;
  - AI атакует группой;
  - AI защищается;
  - победа/поражение срабатывают;
  - end summary показывается;
  - караваны не ломают темп.

## Что будет дальше

Задача 012 начинает story mode framework. Skirmish после этой задачи должен быть достаточно изолирован, чтобы story не наследовал случайные skirmish AI timers и caravan spawns.
