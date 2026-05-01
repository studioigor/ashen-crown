# 001. Art Pipeline Contract

## Коротко

Закрепить текущий raster asset pipeline как источник правды для всей графики Ashen Crown. После этой задачи любая следующая сессия должна понимать, куда класть GPT Image sheets, как нормализовать их в runtime PNG, как проверять sample page и как не сломать GitHub Pages paths.

## Контекст проекта

Игра написана на Phaser + TypeScript. Раньше графика создавалась процедурно в `BootScene.ts`, но теперь основной путь такой:

- сырые GPT Image sheets лежат в `public/assets/art/source`;
- `task/tools/process-art-assets.py` режет, чистит chroma key, нормализует размеры и пишет runtime assets;
- runtime assets лежат в `public/assets/art`;
- `public/assets/art/manifest.generated.json` включает только готовые ключи;
- `src/assets/artManifest.ts` описывает все возможные art keys, frame sizes, display sizes и animation metadata;
- `task/art-sample/index.html` показывает результат нормализации до интеграции в игру;
- `npm run build` копирует готовые assets в `docs/assets/art` для GitHub Pages.

Процедурные генераторы в `BootScene.ts` должны оставаться fallback, но не должны быть основным путем для готовых ассетов.

## Предыдущие задачи

Предыдущих backlog-задач нет. Текущее состояние уже содержит первый рабочий asset pipeline, но он должен быть задокументирован и усилен проверками.

## Что сделать

1. Создать `task/art-pipeline.md`.
2. В документе описать полный рабочий процесс:
   - куда положить новый source PNG;
   - какие имена файлов ожидает `process-art-assets.py`;
   - как запустить `python3 task/tools/process-art-assets.py`;
   - как открыть `task/art-sample/index.html`;
   - как понять, что кадр обрезан или сплющен;
   - как обновить `docs/` через `npm run build`;
   - что делать, если GPT Image выдал лишний ряд/столбец или кривую сетку.
3. Усилить `process-art-assets.py` audit output:
   - количество обработанных unit sheets;
   - количество building sheets;
   - количество terrain/resource/fx/ui/icon assets;
   - missing source files;
   - кадры, где alpha bbox касается края;
   - итоговое количество `enabledKeys`.
4. Сохранить или обновить audit images:
   - `task/art-sample/unit-scale-audit.png`;
   - `task/art-sample/icons-audit.png`;
   - `task/art-sample/terrain-audit.png`;
   - при необходимости добавить `task/art-sample/buildings-audit.png`.
5. Убедиться, что sample viewer показывает все runtime assets, а не только пару примеров.

## Важные правила графики

- Unit source sheets сейчас ожидаются как 3 ряда: `south`, `east`, `north`. `west` зеркалится из `east`.
- Runtime unit sheets: 4 ряда направлений, отдельный PNG на каждую анимацию.
- Unit frame size: `128x128`, кроме caravan `192x128`.
- Юнитов нельзя тянуть через `setDisplaySize(width, height)`, если frame квадратный. Использовать uniform scale.
- Building source sheet: 5 кадров в строку: `stage1`, `stage2`, `final`, `destroying`, `ruin`.
- Иконки резать component-based extraction, не грубой равной сеткой.
- Terrain tiles полноразмерные `32x32`, их alpha bbox нормально касается края.

## Files

- `task/art-pipeline.md`
- `task/tools/process-art-assets.py`
- `task/art-sample/index.html`
- `src/assets/artManifest.ts`

## Проверка

- `python3 task/tools/process-art-assets.py`
- `npm run build`
- Открыть `task/art-sample/index.html` и проверить:
  - нет missing images;
  - юниты не сплющены;
  - building stages видны;
  - terrain tiles все показаны;
  - иконки не обрезаны.

## Что будет дальше

Задача 002 использует этот pipeline для финальной интеграции unit sprites в gameplay. Задача 003 делает то же для building/resource sprites. Если задача 001 не сделана, следующие задачи все равно можно делать, но агенту придется самому восстанавливать правила pipeline из кода.
