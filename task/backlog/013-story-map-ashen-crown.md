# 013. Story Map: The Ashen Crown

## Коротко

Сделать первую полноценную сюжетную карту Ashen Crown: одна миссия с фазами, objectives, dialogue, scripted caravan dilemma, предательством и моральным выбором. Драматизм должен быть на уровне большой RTS-кампании про падение героя, но сюжет и персонажи должны быть оригинальными.

## Контекст проекта

Story mode уже должен иметь framework после задачи 012. Эта задача наполняет его конкретной картой и событиями. Не нужно делать отдельную кампанию из многих карт: цель — одна сильная story map.

Игра уже имеет нужные визуальные кирпичи:

- building stages и ruin;
- caravan sprite;
- goldmine/tree resource states;
- particles: smoke, dust, flame, blood, debris, glow;
- UI frames/tooltips/dialogue style;
- две фракции alliance/horde.

Новые сюжетные портреты пока не нужны. Драма должна делаться через сценарий, objectives, камеру, потерю юнитов, горящие здания и выбор игрока.

## Предыдущие задачи

Задача 012 обязательна: без StoryController, objectives и dialogue overlay эту задачу придется начинать с framework. Задача 006 полезна, потому что дает caravan entity. Задачи 003 и 014 дают разрушения/атмосферу, но 014 идет после этой задачи и может усилить настроение позже.

## Сюжетная основа

Рабочее название: `The Ashen Crown`.

Главный герой — наследник пограничного лорда. Он пытается спасти город от осады и болезни, но узнает, что под старой часовней спрятана древняя корона. Корона может дать победу, но питается страхом, смертью и верностью людей героя. Игрок начинает защитником, затем оказывается перед выбором: спасать людей ценой слабости или брать запретную силу ценой человечности.

## Фазы миссии

1. `The Last Harvest`
   - Игрок собирает ресурсы и укрепляет деревню.
   - Objective: построить farm и barracks, обучить защитников.
   - Dialogue: тревожные новости, но герой еще верит в обычную оборону.

2. `The Road Burns`
   - На дороге появляется караван беженцев.
   - Его атакуют враги за пределами базы.
   - Objective branch:
     - спасти караван;
     - или остаться защищать базу.
   - Если караван погибает, игрок может получить ресурсы с обломков, но получает story flag `abandoned_caravan`.

3. `The Oathbreaker`
   - Союзный капитан обвиняет героя:
     - если караван спасен, капитан требует эвакуации;
     - если брошен, капитан обвиняет героя в холодной выгоде.
   - Часть войск уходит, становится neutral или требует новый objective.
   - Objective: пережить ночной рейд и удержать townhall.

4. `Under The Chapel`
   - Открывается древний ruin/tower objective.
   - Игрок получает forbidden power:
     - temporary buff;
     - summon/elite unit;
     - или разрушительный ability через scripted event.
   - Первое применение спасает базу, но меняет dialogue и ставит flag `used_crown_power`.

5. `Crown Of Ash`
   - Финальный выбор:
     - `Destroy the Crown`: сложная оборона, меньше силы, шанс искупления.
     - `Wear the Crown`: мощная атака, но союзники становятся жертвами/врагами.
   - Финал должен оставить цену победы, а не просто “you win”.

## Что сделать в первой implementation session

1. Реализовать старт story map и первые 3 фазы.
2. Добавить scripted caravan event.
3. Добавить минимум один branch flag:
   - `saved_caravan`;
   - `abandoned_caravan`.
4. Сделать dialogue для ключевых моментов:
   - старт;
   - появление каравана;
   - итог каравана;
   - обвинение капитана;
   - начало ночного рейда.
5. Добавить objectives:
   - build/economy objective;
   - rescue/defend branch objective;
   - survive raid objective.
6. Добавить визуальную постановку:
   - camera pan to caravan;
   - smoke/fire near attack;
   - damaged/ruined building if event requires.

## Implementation notes

- Основные файлы: `src/story/storyMap.ts`, `src/story/StoryController.ts`, `src/scenes/GameScene.ts`, `src/scenes/UIScene.ts`.
- Не делать финальный выбор полностью, если он не помещается в сессию. Достаточно заложить flags и структуру фаз.
- Не ломать skirmish mode.
- Караван в story должен быть scripted, а не случайный skirmish spawn.

## Проверка

- `npm run build`
- Стартовать `Story Map`.
- Пройти первые 3 фазы:
  - build objective завершается;
  - caravan появляется;
  - rescue/fail branch работает;
  - dialogue меняется по branch flag;
  - raid начинается;
  - skirmish не ломается.

## Что будет дальше

Задача 014 усилит атмосферу: теплая/пепельная палитра, corruption phase, ambient FX, lore snippets и драматические visual beats для story и skirmish.
