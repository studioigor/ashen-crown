# 010. Performance For 100-500 Units

## Коротко

Сделать воспроизводимые performance scenarios и убрать основные просадки FPS при большом количестве юнитов, частиц, healthbars, projectiles и fog updates.

## Контекст проекта

Sprite sheets меняют GPU/memory профиль по сравнению с процедурной графикой. В `task/requests.md` отдельно указаны проверки на 100/300/500 юнитах. До этой задачи группа уже должна двигаться стабильнее после задач 008-009, но визуальные системы все еще могут создавать лишние allocations и update cost.

## Предыдущие задачи

Задача 009 должна была снизить pathfinding spikes. Если она не сделана, performance profiling все равно можно начать, но результаты будут смешивать visual cost и pathfinding cost. Задачи 002-004 важны, потому что art assets и UI уже должны быть подключены.

## Что сделать

1. Добавить debug/perf сценарий массового спавна:
   - 100 юнитов;
   - 300 юнитов;
   - 500 юнитов;
   - желательно отдельная горячая клавиша или dev-only метод.
2. Добавить простые метрики:
   - average frame time;
   - active units;
   - active projectiles;
   - active particles;
   - healthbar updates;
   - fog update time;
   - pathfinding calls per second.
3. Оптимизировать visual updates:
   - не обновлять дорогие visual effects вне камеры;
   - не перезапускать sprite animation без необходимости;
   - throttling для offscreen units.
4. Добавить pooling:
   - floating damage text;
   - common particles;
   - projectile trails;
   - temporary decals, если применимо.
5. Fog of war:
   - снизить частоту update при большом entity count;
   - убедиться, что visibility не flicker.
6. Health bars:
   - не перерисовывать скрытые full HP bars;
   - не создавать лишние Graphics.

## Implementation notes

- Основные файлы: `src/scenes/GameScene.ts`, `src/systems/ParticleFX.ts`, `src/systems/EffectsSystem.ts`, `src/world/FogOfWar.ts`, `src/entities/Entity.ts`, `src/entities/Unit.ts`.
- Не менять баланс ради FPS.
- Все debug UI/keys должны быть легко выключаемыми или dev-only.
- Не оптимизировать преждевременно незамеренные места: сначала добавить метрики.

## Проверка

- `npm run build`
- Запустить perf scenario:
  - 100 units: должно быть стабильно;
  - 300 units: должно быть играбельно;
  - 500 units: не должно быть runaway allocations/freeze.
- Проверить обычный матч после оптимизаций.
- Проверить, что particles/projectiles/death effects все еще видны.

## Что будет дальше

Задача 011 улучшит 1v1 skirmish AI и правила режима. Ей нужна стабильная производительность, иначе более активный AI будет маскировать проблемы FPS.
