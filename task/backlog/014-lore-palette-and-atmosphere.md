# 014. Lore, Palette And Atmosphere

## Коротко

Усилить визуальную и повествовательную атмосферу Ashen Crown: теплая fantasy RTS палитра, пепельные story events, lore snippets, ambient FX и драматические visual beats без большой новой генерации ассетов.

## Контекст проекта

К этому моменту должны существовать:

- sprite-based units/buildings/resources;
- skirmish mode;
- story mode framework;
- первая story map или хотя бы ее ранние фазы.

Пользователь хочет, чтобы story mode был драматичным. Эта задача делает не механику миссии, а настроение: цвет, текст, эффекты, camera beats, ощущение мира.

## Предыдущие задачи

Задача 013 должна была создать сюжетную карту и основные события. Задачи 002-004 дали графику и UI. Если задача 013 еще не сделана, эту задачу можно частично выполнить для skirmish/menu, но story-specific corruption effects лучше отложить.

## Что сделать

1. Палитра:
   - пересмотреть `COLORS` в `src/config.ts`;
   - сделать траву/землю теплее;
   - сделать faction accents читаемыми;
   - не превращать UI в однотонную коричневую массу.
2. Ambient FX:
   - дым у поврежденных зданий;
   - искры/пепел в story corruption phases;
   - dust near caravan/road events;
   - subtle glow near crown/ruin objective.
3. Story visual beats:
   - camera shake на крупном разрушении;
   - короткая пауза/камера при предательстве;
   - затемнение/теплый tint при forbidden power.
4. Lore snippets:
   - короткий текст в меню или story intro;
   - objective flavor text;
   - victory/defeat/end state text;
   - different line if `saved_caravan` vs `abandoned_caravan`.
5. UI polish:
   - dialogue overlay должен быть читаемым;
   - objective panel не должен спорить с command panel;
   - resource/command icons остаются crisp.

## Implementation notes

- Основные файлы: `src/config.ts`, `src/scenes/GameScene.ts`, `src/scenes/MenuScene.ts`, `src/scenes/UIScene.ts`, `src/systems/EffectsSystem.ts`, `src/systems/ParticleFX.ts`, `src/ui.css`.
- Использовать существующие `px_*` particles.
- Не генерировать новые menu/story images, пока пользователь явно не попросит.
- Любой новый visual effect должен иметь budget/throttle, чтобы не сломать задачу 010.

## Проверка

- `npm run build`
- Проверить skirmish:
  - terrain не слишком темный;
  - UI читается;
  - combat FX не загрязняют экран.
- Проверить story:
  - intro/objective text видны;
  - caravan event выглядит постановочно;
  - corruption/forbidden power visual state заметен;
  - FPS не проседает от ambient particles.

## Что будет дальше

Это последняя backlog-задача в текущем наборе. После нее следующая работа должна быть не отдельным release checklist-файлом, а обычной сессией стабилизации по найденным багам: пройти skirmish, пройти story map, исправить конкретные issues и снова выполнить `npm run build`.
