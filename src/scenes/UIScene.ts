import Phaser from 'phaser';
import {
  VIEW_W, VIEW_H, COLORS, MAP_W, MAP_H, WORLD_W, WORLD_H,
  UNIT, BUILDING, Side, SIDE, BuildingKind, UnitKind, RACE_COLOR, Difficulty, DIFFICULTY
} from '../config';
import { Unit } from '../entities/Unit';
import { Building } from '../entities/Building';
import { GameScene } from './GameScene';

interface UIInit {
  playerSide: Side;
  difficulty?: Difficulty;
}

export class UIScene extends Phaser.Scene {
  private game_!: GameScene;
  private playerSide: Side = SIDE.player;
  private difficulty: Difficulty = 'normal';

  private buildMenuOpen = false;
  private lastPanelUpdate = 0;
  private lastMinimapUpdate = 0;
  private panelSignature = '';

  // DOM Elements
  private elUiLayer = document.getElementById('ui-layer')!;
  private elGold = document.getElementById('ui-gold')!;
  private elLumber = document.getElementById('ui-lumber')!;
  private elFood = document.getElementById('ui-food')!;
  private elModeText = document.getElementById('ui-mode-text')!;
  private elPanel = document.getElementById('bottom-panel')!;
  private elTitle = document.getElementById('ui-sel-title')!;
  private elStats = document.getElementById('ui-sel-stats')!;
  private elSummary = document.getElementById('ui-sel-summary')!;
  private elProgressCont = document.getElementById('ui-sel-progress-container')!;
  private elProgressFill = document.getElementById('ui-sel-progress-fill')!;
  private elActions = document.getElementById('ui-actions')!;
  private elMessage = document.getElementById('center-message')!;
  private elGameOver = document.getElementById('game-over-screen')!;
  private elGameOverTitle = document.getElementById('game-over-title')!;
  private mmCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
  private mmCtx = this.mmCanvas.getContext('2d')!;

  private msgTimeout: any;

  private onSelectionChanged = (): void => {
    this.buildMenuOpen = false;
    this.renderCommandPanel();
  };
  private onResourcesChanged = (): void => this.renderResources();
  private onOpenBuild = (): void => this.openBuildMenu();
  private onOpenTrain = (): void => {
    this.buildMenuOpen = false;
    this.renderCommandPanel();
  };
  private onFlash = (m: string): void => this.showMessage(m);
  private onGameOver = (win: boolean): void => this.showGameOver(win);
  private onMode = (m: string): void => { this.elModeText.innerText = m; };

  constructor() { super('UIScene'); }

  init(data: UIInit): void {
    this.playerSide = data.playerSide ?? SIDE.player;
    this.difficulty = data.difficulty ?? 'normal';
  }

  create(): void {
    this.game_ = this.scene.get('GameScene') as GameScene;

    this.game.events.on('selection-changed', this.onSelectionChanged);
    this.game.events.on('resources-changed', this.onResourcesChanged);
    this.game_.economy.events.on('changed', this.onResourcesChanged);
    this.game.events.on('ui-open-build', this.onOpenBuild);
    this.game.events.on('ui-open-train', this.onOpenTrain);
    this.game.events.on('flash-message', this.onFlash);
    this.game.events.on('game-over', this.onGameOver);
    this.game.events.on('ui-mode', this.onMode);

    this.mmCanvas.addEventListener('mousedown', this.onMinimapClick);

    document.getElementById('btn-restart')!.onclick = () => {
      this.elGameOver.classList.remove('visible');
      this.scene.stop('UIScene'); 
      this.scene.stop('GameScene');
      this.scene.start('MenuScene');
    };

    this.renderResources();
    this.renderCommandPanel();
    this.elModeText.innerText = '';
    this.elUiLayer.style.display = 'flex';
    this.elGameOver.classList.remove('visible');

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('selection-changed', this.onSelectionChanged);
      this.game.events.off('resources-changed', this.onResourcesChanged);
      this.game_.economy.events.off('changed', this.onResourcesChanged);
      this.game.events.off('ui-open-build', this.onOpenBuild);
      this.game.events.off('ui-open-train', this.onOpenTrain);
      this.game.events.off('flash-message', this.onFlash);
      this.game.events.off('game-over', this.onGameOver);
      this.game.events.off('ui-mode', this.onMode);
      this.mmCanvas.removeEventListener('mousedown', this.onMinimapClick);
      this.elUiLayer.style.display = 'none';
      this.elPanel.style.display = 'none';
      this.elGold.innerText = 'Золото: 0';
      this.elLumber.innerText = 'Дерево: 0';
      this.elFood.innerText = 'Лимит: 0/0';
    });
  }

  private onMinimapClick = (e: MouseEvent): void => {
    const rect = this.mmCanvas.getBoundingClientRect();
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    const wx = Phaser.Math.Clamp(rx, 0, 1) * WORLD_W;
    const wy = Phaser.Math.Clamp(ry, 0, 1) * WORLD_H;
    this.game.events.emit('ui-minimap-click', wx, wy);
  }

  update(_t: number, dt: number): void {
    this.lastPanelUpdate += dt;
    this.lastMinimapUpdate += dt;
    if (this.lastPanelUpdate >= 250) {
      this.renderResources();
      if (!this.buildMenuOpen) this.refreshPanelText();
      this.lastPanelUpdate = 0;
    }
    if (this.lastMinimapUpdate >= 180) {
      this.drawMinimap();
      this.lastMinimapUpdate = 0;
    }
  }

  private prevGold = -1;
  private prevLumber = -1;
  private prevFood = -1;
  private prevCap = -1;

  private renderResources(): void {
    const p = this.game_.economy.get(this.playerSide);
    if (!p) return;
    this.setResource(this.elGold, `Золото: ${p.gold}`, p.gold, this.prevGold);
    this.setResource(this.elLumber, `Дерево: ${p.lumber}`, p.lumber, this.prevLumber);
    this.setResource(this.elFood, `Лимит: ${p.food}/${p.foodCap}`, p.food + p.foodCap * 1000, this.prevFood + this.prevCap * 1000);
    this.prevGold = p.gold;
    this.prevLumber = p.lumber;
    this.prevFood = p.food;
    this.prevCap = p.foodCap;
  }

  private setResource(el: HTMLElement, text: string, cur: number, prev: number): void {
    el.innerText = text;
    if (prev >= 0 && cur !== prev) {
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 300);
    }
  }

  private renderCommandPanel(): void {
    this.buildMenuOpen = false;
    this.elActions.innerHTML = '';
    this.panelSignature = this.computeSignature();

    const sel = this.game_.selected;
    const selBuilding = this.game_.selectedBuilding;

    if (!selBuilding && sel.length === 0) {
      this.elPanel.style.display = 'none';
      return;
    }
    this.elPanel.style.display = 'flex';

    if (selBuilding) {
      this.renderBuildingPanel(selBuilding);
      return;
    }

    const first = sel[0];
    this.elTitle.innerText = sel.length > 1 ? `Отряд: ${sel.length}` : labelForUnit(first.unitKind, first.race);
    
    const avgHp = Math.round(sel.reduce((s, u) => s + u.hp, 0) / sel.length);
    this.elStats.innerText = `HP ${Math.round(first.hp)}/${first.maxHp} • средн. ${avgHp} • атака ${first.atk} • ${stateLabel(first.state)}`;
    this.elSummary.innerText = summarizeUnits(sel);
    
    const cargo = sel.find(u => u.cargo)?.cargo;
    if (cargo) {
      this.elSummary.innerText += `\nНесет: ${cargo.type === 'gold' ? 'золото' : 'дерево'} x${cargo.amount}`;
    }

    this.elProgressCont.style.display = 'none';

    const hasWorker = sel.some(u => u.isWorker());
    if (hasWorker) this.addButton('Строить [B]', 'Открыть меню строительства', () => this.openBuildMenu());
    this.addButton('Стоп [X]', 'Сбросить текущие приказы', () => this.game.events.emit('ui-stop'));
    this.addButton('Атака [Q]', 'Атака-движение: Q, затем ЛКМ по точке', () => this.showMessage('Нажмите Q, затем ЛКМ по точке атаки'));
  }

  private computeSignature(): string {
    const sb = this.game_.selectedBuilding;
    if (sb) return `b:${sb.buildingKind}:${sb.completed ? 1 : 0}`;
    const sel = this.game_.selected;
    if (sel.length === 0) return '';
    const hasWorker = sel.some(u => u.isWorker()) ? 1 : 0;
    return `u:${sel.length}:${hasWorker}`;
  }

  private refreshPanelText(): void {
    const sig = this.computeSignature();
    if (sig !== this.panelSignature) {
      this.renderCommandPanel();
      return;
    }

    const sel = this.game_.selected;
    const selBuilding = this.game_.selectedBuilding;

    if (!selBuilding && sel.length === 0) {
      if (this.elPanel.style.display !== 'none') this.renderCommandPanel();
      return;
    }

    if (selBuilding) {
      const statsParts = [`HP ${Math.round(selBuilding.hp)}/${selBuilding.maxHp}`];
      if (selBuilding.canAttack()) statsParts.push(`ATK ${selBuilding.attack}`, `RNG ${Math.round(selBuilding.range)}`);
      this.elStats.innerText = statsParts.join(' • ');

      if (!selBuilding.completed) {
        const pct = selBuilding.progressFraction();
        this.elSummary.innerText = `Строится: ${Math.floor(pct * 100)}%`;
        this.elProgressCont.style.display = 'block';
        this.elProgressFill.style.width = `${pct * 100}%`;
        return;
      }

      let summary = selBuilding.rally ? `Точка сбора ${Math.round(selBuilding.rally.x)},${Math.round(selBuilding.rally.y)}` : 'ПКМ по карте задает точку сбора';
      if (selBuilding.queue.length > 0) {
        const cur = selBuilding.queue[0];
        const pct = 1 - cur.remaining / cur.total;
        const queueStr = selBuilding.queue.map(q => labelForUnit(q.kind, selBuilding.race)).join(' > ');
        summary = `Очередь: ${queueStr}\n` + summary;
        this.elProgressCont.style.display = 'block';
        this.elProgressFill.style.width = `${pct * 100}%`;
      } else {
        this.elProgressCont.style.display = 'none';
      }
      this.elSummary.innerText = summary;
      return;
    }

    const first = sel[0];
    const avgHp = Math.round(sel.reduce((s, u) => s + u.hp, 0) / sel.length);
    this.elStats.innerText = `HP ${Math.round(first.hp)}/${first.maxHp} • средн. ${avgHp} • атака ${first.atk} • ${stateLabel(first.state)}`;
    let summary = summarizeUnits(sel);
    const cargo = sel.find(u => u.cargo)?.cargo;
    if (cargo) summary += `\nНесет: ${cargo.type === 'gold' ? 'золото' : 'дерево'} x${cargo.amount}`;
    this.elSummary.innerText = summary;
  }

  private renderBuildingPanel(b: Building): void {
    this.elTitle.innerText = labelForBuilding(b.buildingKind, b.race);
    
    const statsParts = [`HP ${Math.round(b.hp)}/${b.maxHp}`];
    if (b.canAttack()) statsParts.push(`ATK ${b.attack}`, `RNG ${Math.round(b.range)}`);
    this.elStats.innerText = statsParts.join(' • ');

    if (!b.completed) {
      const pct = b.progressFraction();
      this.elSummary.innerText = `Строится: ${Math.floor(pct * 100)}%`;
      this.elProgressCont.style.display = 'block';
      this.elProgressFill.style.width = `${pct * 100}%`;
      return;
    }

    let summary = b.rally ? `Точка сбора ${Math.round(b.rally.x)},${Math.round(b.rally.y)}` : 'ПКМ по карте задает точку сбора';
    
    if (b.queue.length > 0) {
      const cur = b.queue[0];
      const pct = 1 - cur.remaining / cur.total;
      const queueStr = b.queue.map(q => labelForUnit(q.kind, b.race)).join(' > ');
      summary = `Очередь: ${queueStr}\n` + summary;
      this.elProgressCont.style.display = 'block';
      this.elProgressFill.style.width = `${pct * 100}%`;
    } else {
      this.elProgressCont.style.display = 'none';
    }
    this.elSummary.innerText = summary;

    for (const kind of trainableFor(b.buildingKind)) {
      const def = UNIT[kind];
      const label = `Нанять ${labelForUnit(kind, b.race)}`;
      const tooltip = `${def.food} лимит, ${Math.round(def.build/1000)}с\nЦена: ${def.cost.gold}G, ${def.cost.lumber}L`;
      this.addButton(label, tooltip, () => this.game.events.emit('ui-train', kind), `<br><span class="cost">${def.cost.gold}G  ${def.cost.lumber}L</span>`);
    }
  }

  private openBuildMenu(): void {
    if (!this.game_.selected.some(u => u.isWorker())) { this.showMessage('Нужен рабочий'); return; }
    this.buildMenuOpen = true;
    this.elActions.innerHTML = '';
    
    this.elTitle.innerText = 'Строительство';
    this.elStats.innerText = 'ESC отменяет размещение';
    this.elSummary.innerText = 'Выберите здание';
    this.elProgressCont.style.display = 'none';

    const defs: BuildingKind[] = ['farm', 'barracks', 'workshop', 'tower', 'townhall'];
    defs.forEach((kind) => {
      const def = BUILDING[kind];
      const label = `${labelForBuilding(kind, this.game_.playerRace)} [${def.hotkey}]`;
      const foodAdd = def.food ? `(+${def.food} лимит)` : '';
      this.addButton(label, buildTooltip(kind), () => {
        this.game.events.emit('ui-build', kind);
        this.buildMenuOpen = false;
        this.renderCommandPanel();
      }, `<br><span class="cost">${def.cost.gold}G ${def.cost.lumber}L ${foodAdd}</span>`);
    });
  }

  private addButton(label: string, tooltip: string, onClick: () => void, extraHtml = ''): void {
    const btn = document.createElement('button');
    btn.className = 'cmd-btn';
    btn.innerHTML = label + extraHtml;
    btn.onclick = onClick;
    btn.onmouseenter = () => { this.elModeText.innerText = tooltip; };
    btn.onmouseleave = () => { this.elModeText.innerText = ''; };
    this.elActions.appendChild(btn);
  }

  private showMessage(text: string): void {
    this.elMessage.innerText = text;
    this.elMessage.classList.add('show');
    
    if (this.msgTimeout) clearTimeout(this.msgTimeout);
    this.msgTimeout = setTimeout(() => {
      this.elMessage.classList.remove('show');
    }, 2000);
  }

  private showGameOver(win: boolean): void {
    this.elGameOver.classList.add('visible');
    this.elGameOverTitle.innerText = win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
    this.elGameOverTitle.className = win ? 'win' : 'lose';
  }

  private drawMinimap(): void {
    if (!this.game_ || !this.game_.map || !this.game_.fog) return;
    const w = this.mmCanvas.width;
    const h = this.mmCanvas.height;
    this.mmCtx.fillStyle = '#0b0d0e';
    this.mmCtx.fillRect(0, 0, w, h);
    
    const scale = w / MAP_W;
    const iScale = Math.ceil(scale);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const explored = this.game_.fog.isExplored(x, y);
        if (!explored) continue;
        
        const t = this.game_.map.get(x, y);
        let c = '#365f2a';
        if (t === 2) c = '#174522';
        else if (t === 3) c = '#626b70';
        else if (t === 4) c = '#1c5f8c';
        else if (t === 5) c = '#6b5b3a';
        else if (t === 1) c = '#426f32';
        
        this.mmCtx.fillStyle = c;
        this.mmCtx.fillRect(x * scale, y * scale, iScale, iScale);
      }
    }

    const mapUnit = (x: number, y: number, color: string, size: number) => {
      this.mmCtx.fillStyle = color;
      this.mmCtx.fillRect(x * scale, y * scale, size, size);
    };

    const numToHex = (n: number) => '#' + n.toString(16).padStart(6, '0');
    const pColor = numToHex(RACE_COLOR[this.game_.playerRace]);
    const aColor = numToHex(RACE_COLOR[this.game_.aiRace]);

    for (const r of this.game_.resources) {
      if (!r.alive) continue;
      const { tx, ty } = this.game_.map.worldToTile(r.x, r.y);
      if (!this.game_.fog.isExplored(tx, ty)) continue;
      mapUnit(tx, ty, r.resourceType === 'gold' ? '#d9ad3d' : '#305020', 2);
    }
    for (const b of this.game_.buildings) {
      if (!b.alive) continue;
      const c = b.centerTile();
      if (b.side !== SIDE.player && !this.game_.fog.isExplored(c.tx, c.ty)) continue;
      mapUnit(c.tx, c.ty, b.side === SIDE.player ? pColor : aColor, 3);
    }
    for (const u of this.game_.units) {
      if (!u.alive) continue;
      const { tx, ty } = this.game_.map.worldToTile(u.x, u.y);
      if (u.side !== SIDE.player && !this.game_.fog.isVisible(tx, ty)) continue;
      mapUnit(tx, ty, u.side === SIDE.player ? pColor : aColor, 2);
    }

    // View rect
    const cam = this.game_.cameras.main;
    const vx = (cam.scrollX / WORLD_W) * w;
    const vy = (cam.scrollY / WORLD_H) * h;
    const vw = (cam.width / WORLD_W) * w;
    const vh = (cam.height / WORLD_H) * h;
    
    this.mmCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.mmCtx.lineWidth = 1;
    this.mmCtx.strokeRect(vx, vy, vw, vh);
  }
}

function labelForUnit(k: UnitKind, race: Unit['race']): string {
  return UNIT[k].labelByRace[race];
}

function labelForBuilding(k: BuildingKind, race: Building['race']): string {
  return BUILDING[k].labelByRace[race];
}

function trainableFor(kind: BuildingKind): UnitKind[] {
  if (kind === 'townhall') return ['worker'];
  if (kind === 'barracks') return ['footman', 'archer', 'knight'];
  if (kind === 'workshop') return ['catapult'];
  return [];
}

function summarizeUnits(units: Unit[]): string {
  const counts = new Map<UnitKind, number>();
  for (const u of units) counts.set(u.unitKind, (counts.get(u.unitKind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, n]) => `${UNIT[kind].labelByRace[units[0].race]} x${n}`).join(' • ');
}

function buildTooltip(kind: BuildingKind): string {
  if (kind === 'farm') return 'Увеличивает лимит снабжения';
  if (kind === 'barracks') return 'Нанимает пехоту и кавалерию';
  if (kind === 'workshop') return 'Открывает рыцарей и осадные машины';
  if (kind === 'tower') return 'Автоматически атакует врагов рядом';
  return 'Новая база, склад и производство рабочих';
}

function stateLabel(state: Unit['state']): string {
  if (state === 'idle') return 'ожидает';
  if (state === 'move') return 'движется';
  if (state === 'attack_move') return 'атака-движение';
  if (state === 'attack') return 'атакует';
  if (state === 'gather') return 'добывает';
  if (state === 'return_cargo') return 'несет груз';
  if (state === 'build') return 'строит';
  return 'мертв';
}
