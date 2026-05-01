import Phaser from 'phaser';
import {
  VIEW_W, VIEW_H, COLORS, MAP_W, MAP_H, WORLD_W, WORLD_H,
  UNIT, BUILDING, Side, SIDE, BuildingKind, UnitKind, RACE_COLOR, RACE_LABEL, DIFFICULTY,
  STORY_MAP_LABEL, type GameLaunchConfig
} from '../config';
import { Unit } from '../entities/Unit';
import { Building } from '../entities/Building';
import { ResourceNode } from '../entities/ResourceNode';
import { Caravan } from '../entities/Caravan';
import { artAssetUrl } from '../assets/artManifest';
import { GameScene, type GameOverPayload, type SkirmishSummary } from './GameScene';

interface UIInit {
  playerSide: Side;
  launchConfig: GameLaunchConfig;
}

type HoverEntity = Unit | Building | ResourceNode | Caravan;

interface EntityHoverPayload {
  entity: HoverEntity | null;
  screenX: number;
  screenY: number;
}

interface TooltipRow {
  label: string;
  value: string;
}

interface TooltipModel {
  title: string;
  subtitle: string;
  rows: TooltipRow[];
  role: string;
}

export class UIScene extends Phaser.Scene {
  private game_!: GameScene;
  private playerSide: Side = SIDE.player;
  private launchConfig: GameLaunchConfig = { mode: 'skirmish', playerRace: 'alliance', difficulty: 'normal' };
  private baseModeText = '';
  private modeOverrideText = '';

  private buildMenuOpen = false;
  private lastPanelUpdate = 0;
  private lastMinimapUpdate = 0;
  private panelSignature = '';
  private hoveredEntity: HoverEntity | null = null;
  private hoverScreen = { x: 0, y: 0 };

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
  private elTooltip = document.getElementById('entity-tooltip')!;
  private elGameOver = document.getElementById('game-over-screen')!;
  private elGameOverTitle = document.getElementById('game-over-title')!;
  private elGameOverSummary = document.getElementById('game-over-summary')!;
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
  private onGameOver = (payload: GameOverPayload | boolean): void => this.showGameOver(payload);
  private onMode = (m: string): void => {
    this.modeOverrideText = m;
    this.renderModeText();
  };
  private onEntityHover = (payload: EntityHoverPayload): void => this.showEntityTooltip(payload);

  constructor() { super('UIScene'); }

  init(data: UIInit): void {
    this.playerSide = data.playerSide ?? SIDE.player;
    this.launchConfig = data.launchConfig ?? this.launchConfig;
    this.baseModeText = modeStatusLabel(this.launchConfig);
    this.modeOverrideText = '';
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
    this.game.events.on('ui-entity-hover', this.onEntityHover);

    this.mmCanvas.addEventListener('mousedown', this.onMinimapClick);
    this.elTooltip.style.setProperty('--tooltip-frame', `url("${artAssetUrl('assets/art/ui/tooltip_frame.png')}")`);

    document.getElementById('btn-restart')!.onclick = () => {
      this.elGameOver.classList.remove('visible');
      this.scene.stop('UIScene'); 
      this.scene.stop('GameScene');
      this.scene.start('MenuScene');
    };

    this.renderResources();
    this.renderCommandPanel();
    this.renderModeText();
    this.elUiLayer.style.display = 'flex';
    this.elGameOver.classList.remove('visible');
    this.elGameOverSummary.innerHTML = '';

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('selection-changed', this.onSelectionChanged);
      this.game.events.off('resources-changed', this.onResourcesChanged);
      this.game_.economy.events.off('changed', this.onResourcesChanged);
      this.game.events.off('ui-open-build', this.onOpenBuild);
      this.game.events.off('ui-open-train', this.onOpenTrain);
      this.game.events.off('flash-message', this.onFlash);
      this.game.events.off('game-over', this.onGameOver);
      this.game.events.off('ui-mode', this.onMode);
      this.game.events.off('ui-entity-hover', this.onEntityHover);
      this.mmCanvas.removeEventListener('mousedown', this.onMinimapClick);
      this.hideEntityTooltip();
      this.elUiLayer.style.display = 'none';
      this.elPanel.style.display = 'none';
      this.elGold.innerText = 'Золото: 0';
      this.elLumber.innerText = 'Дерево: 0';
      this.elFood.innerText = 'Лимит: 0/0';
      this.elModeText.innerText = '';
      this.elGameOverSummary.innerHTML = '';
    });
  }

  private renderModeText(): void {
    this.elModeText.innerText = this.modeOverrideText || this.baseModeText;
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
      if (this.hoveredEntity) this.refreshEntityTooltip();
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
    this.setResource(this.elGold, this.resourceHtml('gold', 'Золото', `${p.gold}`), p.gold, this.prevGold);
    this.setResource(this.elLumber, this.resourceHtml('lumber', 'Дерево', `${p.lumber}`), p.lumber, this.prevLumber);
    this.setResource(this.elFood, `<span class="resource-label">Лимит</span><span class="resource-value">${p.food}/${p.foodCap}</span>`, p.food + p.foodCap * 1000, this.prevFood + this.prevCap * 1000);
    this.prevGold = p.gold;
    this.prevLumber = p.lumber;
    this.prevFood = p.food;
    this.prevCap = p.foodCap;
  }

  private resourceHtml(icon: 'gold' | 'lumber', label: string, value: string): string {
    return `<img class="resource-icon" src="${this.iconUrl(icon)}" alt="" draggable="false"><span class="resource-label">${label}</span><span class="resource-value">${value}</span>`;
  }

  private setResource(el: HTMLElement, html: string, cur: number, prev: number): void {
    el.innerHTML = html;
    if (prev >= 0 && cur !== prev) {
      el.classList.add('pulse');
      setTimeout(() => el.classList.remove('pulse'), 300);
    }
  }

  private iconUrl(icon: string): string {
    return artAssetUrl(`assets/art/ui/icons/${icon}.png`);
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
    this.elSummary.innerText = summarizeSelection(sel);

    this.elProgressCont.style.display = 'none';

    const hasWorker = sel.some(u => u.isWorker());
    if (hasWorker) this.addButton('Строить [B]', 'Открыть меню строительства', () => this.openBuildMenu(), '', 'build');
    if (this.game_.isAutopilotAllowed()) {
      const autopilotCount = sel.filter(u => u.autopilot).length;
      const allAutopilot = autopilotCount === sel.length;
      this.addButton(
        'Автопилот',
        allAutopilot ? 'Вернуть выбранных юнитов под ручное управление' : 'Передать выбранных юнитов под автопилот',
        () => this.game.events.emit('ui-autopilot'),
        `<span class="cmd-state">${autopilotCount}/${sel.length}</span>`,
        'autopilot',
        allAutopilot
      );
    }
    this.addButton('Стоп [X]', 'Сбросить текущие приказы', () => this.game.events.emit('ui-stop'), '', 'stop');
    this.addButton('Атака [Q]', 'Атака-движение: Q, затем ЛКМ по точке', () => this.showMessage('Нажмите Q, затем ЛКМ по точке атаки'), '', 'attack_move');
  }

  private computeSignature(): string {
    const sb = this.game_.selectedBuilding;
    if (sb) return `b:${sb.buildingKind}:${sb.completed ? 1 : 0}`;
    const sel = this.game_.selected;
    if (sel.length === 0) return '';
    const hasWorker = sel.some(u => u.isWorker()) ? 1 : 0;
    const autopilotCount = sel.filter(u => u.autopilot).length;
    const autopilotAllowed = this.game_.isAutopilotAllowed() ? 1 : 0;
    return `u:${sel.length}:${hasWorker}:${autopilotCount}:${autopilotAllowed}`;
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
    this.elSummary.innerText = summarizeSelection(sel);
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
      this.addButton(label, tooltip, () => this.game.events.emit('ui-train', kind), `<span class="cost">${def.cost.gold}G  ${def.cost.lumber}L</span>`, kind);
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
      }, `<span class="cost">${def.cost.gold}G ${def.cost.lumber}L ${foodAdd}</span>`, 'build');
    });
  }

  private addButton(label: string, tooltip: string, onClick: () => void, extraHtml = '', icon?: string, active = false): void {
    const btn = document.createElement('button');
    btn.className = active ? 'cmd-btn active' : 'cmd-btn';
    if (active) btn.setAttribute('aria-pressed', 'true');
    const iconHtml = icon ? `<img class="cmd-icon" src="${this.iconUrl(icon)}" alt="" draggable="false">` : '';
    btn.innerHTML = `${iconHtml}<span class="cmd-copy"><span class="cmd-label">${escapeHtml(label)}</span>${extraHtml}</span>`;
    btn.onclick = onClick;
    btn.onmouseenter = () => { this.elModeText.innerText = tooltip; };
    btn.onmouseleave = () => { this.renderModeText(); };
    this.elActions.appendChild(btn);
  }

  private showEntityTooltip(payload: EntityHoverPayload): void {
    if (!payload.entity || !payload.entity.alive) {
      this.hideEntityTooltip();
      return;
    }
    this.hoveredEntity = payload.entity;
    this.hoverScreen = { x: payload.screenX, y: payload.screenY };
    this.refreshEntityTooltip();
  }

  private hideEntityTooltip(): void {
    this.hoveredEntity = null;
    this.elTooltip.classList.remove('visible');
    this.elTooltip.setAttribute('aria-hidden', 'true');
  }

  private refreshEntityTooltip(): void {
    const entity = this.hoveredEntity;
    if (!entity || !entity.alive) {
      this.hideEntityTooltip();
      return;
    }

    const model = describeTooltip(entity);
    this.elTooltip.replaceChildren();

    const title = document.createElement('div');
    title.className = 'entity-tooltip-title';
    title.textContent = model.title;
    this.elTooltip.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.className = 'entity-tooltip-subtitle';
    subtitle.textContent = model.subtitle;
    this.elTooltip.appendChild(subtitle);

    const rows = document.createElement('div');
    rows.className = 'entity-tooltip-rows';
    for (const row of model.rows) {
      const rowEl = document.createElement('div');
      rowEl.className = 'entity-tooltip-row';
      const label = document.createElement('span');
      label.textContent = row.label;
      const value = document.createElement('span');
      value.textContent = row.value;
      rowEl.append(label, value);
      rows.appendChild(rowEl);
    }
    this.elTooltip.appendChild(rows);

    const role = document.createElement('div');
    role.className = 'entity-tooltip-role';
    role.textContent = model.role;
    this.elTooltip.appendChild(role);

    this.elTooltip.style.visibility = 'hidden';
    this.elTooltip.classList.add('visible');
    this.elTooltip.setAttribute('aria-hidden', 'false');
    this.positionEntityTooltip();
    this.elTooltip.style.visibility = '';
  }

  private positionEntityTooltip(): void {
    const margin = 12;
    const gap = 16;
    const rect = this.elTooltip.getBoundingClientRect();
    let x = this.hoverScreen.x + gap;
    let y = this.hoverScreen.y + gap;

    if (x + rect.width > window.innerWidth - margin) x = this.hoverScreen.x - rect.width - gap;
    if (y + rect.height > window.innerHeight - margin) y = this.hoverScreen.y - rect.height - gap;

    const panelRect = this.blockingRect(this.elPanel);
    const minimapRect = this.blockingRect(document.getElementById('minimap-border')!);
    if (this.rectIntersects(x, y, rect.width, rect.height, panelRect) || this.rectIntersects(x, y, rect.width, rect.height, minimapRect)) {
      const blockerTop = Math.min(panelRect?.top ?? Infinity, minimapRect?.top ?? Infinity);
      if (Number.isFinite(blockerTop)) y = blockerTop - rect.height - gap;
    }

    x = Phaser.Math.Clamp(x, margin, Math.max(margin, window.innerWidth - rect.width - margin));
    y = Phaser.Math.Clamp(y, margin, Math.max(margin, window.innerHeight - rect.height - margin));
    this.elTooltip.style.left = `${Math.round(x)}px`;
    this.elTooltip.style.top = `${Math.round(y)}px`;
  }

  private blockingRect(el: HTMLElement): DOMRect | null {
    const style = window.getComputedStyle(el);
    if (style.pointerEvents === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  }

  private rectIntersects(x: number, y: number, w: number, h: number, rect: DOMRect | null): boolean {
    if (!rect) return false;
    return x < rect.right && x + w > rect.left && y < rect.bottom && y + h > rect.top;
  }

  private showMessage(text: string): void {
    this.elMessage.innerText = text;
    this.elMessage.classList.add('show');
    
    if (this.msgTimeout) clearTimeout(this.msgTimeout);
    this.msgTimeout = setTimeout(() => {
      this.elMessage.classList.remove('show');
    }, 2000);
  }

  private showGameOver(result: GameOverPayload | boolean): void {
    const win = typeof result === 'boolean' ? result : result.win;
    this.elGameOver.classList.add('visible');
    this.elGameOverTitle.innerText = win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ';
    this.elGameOverTitle.className = win ? 'win' : 'lose';
    this.elGameOverSummary.innerHTML = typeof result === 'boolean' ? '' : renderSkirmishSummary(result.summary);
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
    for (const c of this.game_.caravans) {
      if (!c.alive) continue;
      const { tx, ty } = this.game_.map.worldToTile(c.x, c.y);
      if (!this.game_.fog.isVisible(tx, ty)) continue;
      mapUnit(tx, ty, '#d9ad3d', 2);
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

function summarizeSelection(units: Unit[]): string {
  let summary = summarizeUnits(units);
  const cargo = units.find(u => u.cargo)?.cargo;
  if (cargo) summary += `\nНесет: ${cargo.type === 'gold' ? 'золото' : 'дерево'} x${cargo.amount}`;
  const autopilotCount = units.filter(u => u.autopilot).length;
  if (autopilotCount > 0) summary += `\nАвтопилот: ${autopilotCount}/${units.length}`;
  return summary;
}

function renderSkirmishSummary(summary: SkirmishSummary): string {
  const rows: [string, string][] = [
    ['Время', formatDuration(summary.durationMs)],
    ['Убито', `${summary.unitsKilled}`],
    ['Потери', `${summary.unitsLost}`],
    ['Ресурсы', `${summary.resourcesGathered.gold}G / ${summary.resourcesGathered.lumber}L`],
    ['Караваны', `${summary.caravansLooted}`]
  ];
  return rows
    .map(([label, value]) => `<div class="game-over-summary-row"><span>${label}</span><strong>${value}</strong></div>`)
    .join('');
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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

function describeTooltip(entity: HoverEntity): TooltipModel {
  if (entity instanceof Unit) return describeUnitTooltip(entity);
  if (entity instanceof Building) return describeBuildingTooltip(entity);
  if (entity instanceof Caravan) return describeCaravanTooltip(entity);
  return describeResourceTooltip(entity);
}

function describeUnitTooltip(u: Unit): TooltipModel {
  const rows: TooltipRow[] = [
    { label: 'HP', value: `${Math.round(u.hp)}/${u.maxHp}` },
    { label: 'Обзор', value: `${u.sight}` },
    { label: 'Состояние', value: stateLabel(u.state) }
  ];
  if (u.canAttack()) {
    rows.splice(1, 0, { label: 'Атака', value: `${u.atk}` }, { label: 'Дальность', value: `${Math.round(u.range)}` });
  }
  if (u.side === SIDE.player) rows.push({ label: 'Автопилот', value: u.autopilot ? 'включен' : 'выключен' });
  if (u.isWorker()) rows.push({ label: 'Груз', value: u.cargo ? `${resourceLabel(u.cargo.type)} x${u.cargo.amount}` : 'пусто' });
  return {
    title: labelForUnit(u.unitKind, u.race),
    subtitle: `${sideLabel(u.side)} • ${RACE_LABEL[u.race]} • ${unitTypeLabel(u.unitKind)}`,
    rows,
    role: unitRole(u.unitKind)
  };
}

function describeBuildingTooltip(b: Building): TooltipModel {
  const rows: TooltipRow[] = [
    { label: 'HP', value: `${Math.round(b.hp)}/${b.maxHp}` },
    { label: 'Обзор', value: `${b.sight}` }
  ];
  if (b.canAttack()) rows.splice(1, 0, { label: 'Атака', value: `${b.attack}` }, { label: 'Дальность', value: `${Math.round(b.range)}` });

  if (!b.completed) {
    rows.push({ label: 'Состояние', value: `строится ${Math.floor(b.progressFraction() * 100)}%` });
  } else if (b.queue.length > 0) {
    const current = b.queue[0];
    const pct = Math.floor((1 - current.remaining / current.total) * 100);
    rows.push({ label: 'Производство', value: `${labelForUnit(current.kind, b.race)} ${pct}%` });
    rows.push({ label: 'Очередь', value: b.queue.map(q => labelForUnit(q.kind, b.race)).join(' > ') });
  } else {
    rows.push({ label: 'Состояние', value: b.hp < b.maxHp ? 'повреждено' : 'готово' });
  }
  if (b.rally && b.completed) rows.push({ label: 'Сбор', value: `${Math.round(b.rally.x)}, ${Math.round(b.rally.y)}` });

  return {
    title: labelForBuilding(b.buildingKind, b.race),
    subtitle: `${sideLabel(b.side)} • ${RACE_LABEL[b.race]} • ${buildingTypeLabel(b.buildingKind)}`,
    rows,
    role: buildingRole(b.buildingKind)
  };
}

function describeResourceTooltip(r: ResourceNode): TooltipModel {
  return {
    title: r.resourceType === 'gold' ? 'Золотая жила' : 'Лес',
    subtitle: 'Нейтральный ресурс',
    rows: [
      { label: 'Запас', value: `${Math.max(0, r.amount)}/${r.maxHp}` },
      { label: 'Тип', value: resourceLabel(r.resourceType) }
    ],
    role: r.resourceType === 'gold' ? 'Рабочие добывают здесь золото.' : 'Рабочие рубят деревья для древесины.'
  };
}

function describeCaravanTooltip(c: Caravan): TooltipModel {
  return {
    title: 'Караван',
    subtitle: `${sideLabel(c.side)} • странники`,
    rows: [
      { label: 'HP', value: `${Math.round(c.hp)}/${c.maxHp}` },
      { label: 'Скорость', value: `${Math.round(c.speed)}` }
    ],
    role: 'Редкий нейтральный караван. Можно атаковать вручную ради добычи.'
  };
}

function sideLabel(side: Side): string {
  if (side === SIDE.player) return 'Игрок';
  if (side === SIDE.ai) return 'Враг';
  return 'Нейтрально';
}

function resourceLabel(type: 'gold' | 'lumber'): string {
  return type === 'gold' ? 'золото' : 'дерево';
}

function unitTypeLabel(kind: UnitKind): string {
  if (kind === 'worker') return 'рабочий';
  if (kind === 'footman') return 'пехота';
  if (kind === 'archer') return 'стрелок';
  if (kind === 'knight') return 'кавалерия';
  return 'осада';
}

function buildingTypeLabel(kind: BuildingKind): string {
  if (kind === 'townhall') return 'центр базы';
  if (kind === 'farm') return 'снабжение';
  if (kind === 'barracks') return 'казармы';
  if (kind === 'workshop') return 'мастерская';
  return 'оборона';
}

function unitRole(kind: UnitKind): string {
  if (kind === 'worker') return 'Добывает ресурсы и строит здания.';
  if (kind === 'footman') return 'Ближний бой и удержание линии.';
  if (kind === 'archer') return 'Дальний бой против легких целей.';
  if (kind === 'knight') return 'Быстрый ударный юнит ближнего боя.';
  return 'Осадный юнит с большим уроном по зданиям.';
}

function buildingRole(kind: BuildingKind): string {
  if (kind === 'townhall') return 'Принимает ресурсы и обучает рабочих.';
  if (kind === 'farm') return 'Увеличивает лимит снабжения.';
  if (kind === 'barracks') return 'Обучает пехоту, стрелков и кавалерию.';
  if (kind === 'workshop') return 'Открывает тяжелые войска и осаду.';
  return 'Автоматически атакует врагов рядом.';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[ch]!));
}

function modeStatusLabel(config: GameLaunchConfig): string {
  if (config.mode === 'story') return `Story Map · ${STORY_MAP_LABEL[config.storyMapId]}`;
  return `1v1 Skirmish · ${DIFFICULTY[config.difficulty].label}`;
}
