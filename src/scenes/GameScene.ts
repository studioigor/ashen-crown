import Phaser from 'phaser';
import {
  TILE, WORLD_W, WORLD_H, VIEW_W, VIEW_H,
  CAMERA_SPEED, EDGE_SCROLL_PX,
  Side, SIDE, Race, Difficulty, GameMode, StoryMapId, GameLaunchConfig, DIFFICULTY, COLORS, RACE_COLOR,
  UNIT, BUILDING, UnitKind, BuildingKind,
  RESOURCE, CARAVAN_CONFIG, FOG, FEEL, VISUALS
} from '../config';
import { TileMap, TileType } from '../world/TileMap';
import { generateMap, MapLayout } from '../world/MapGenerator';
import { FogOfWar } from '../world/FogOfWar';
import { Unit } from '../entities/Unit';
import { Building } from '../entities/Building';
import { ResourceNode } from '../entities/ResourceNode';
import { Caravan } from '../entities/Caravan';
import { IEntity } from '../entities/Entity';
import { findPath } from '../systems/Pathfinding';
import { Economy } from '../systems/Economy';
import { runAI, AIState } from '../systems/AI';
import { EffectsSystem } from '../systems/EffectsSystem';
import { AudioSystem } from '../systems/AudioSystem';
import { formationSlots } from '../systems/Formation';
import { nearestReachableWalkable } from '../world/MapValidation';
import {
  BUILDING_ART_DISPLAY,
  buildingArtReady,
  buildingSheetKey,
  getBuildingStageFrame
} from '../assets/artManifest';

export type GameInit = GameLaunchConfig;

export class GameScene extends Phaser.Scene {
  map!: TileMap;
  layout!: MapLayout;
  units: Unit[] = [];
  buildings: Building[] = [];
  resources: ResourceNode[] = [];
  caravans: Caravan[] = [];
  projectiles: Projectile[] = [];
  selected: Unit[] = [];
  selectedBuilding: Building | null = null;
  economy = new Economy();
  fog!: FogOfWar;
  effects!: EffectsSystem;
  audio!: AudioSystem;
  mode: GameMode = 'skirmish';
  playerRace: Race = 'alliance';
  aiRace: Race = 'horde';
  difficulty: Difficulty = 'normal';
  storyMapId: StoryMapId | null = null;
  seed = 42;
  launchConfig: GameLaunchConfig = { mode: 'skirmish', playerRace: 'alliance', difficulty: 'normal' };
  aiState: AIState = { phase: 'economy', nextCheckMs: 0, armyTargetScore: 9, regroupUntilMs: 0, lastPressureMs: 0 };

  private tileLayer!: Phaser.GameObjects.Container;
  private waterTiles: Phaser.GameObjects.Image[] = [];
  private waterPhase = 0;
  private cameraVel = { x: 0, y: 0 };
  private selectionRect!: Phaser.GameObjects.Graphics;
  private footprint!: Phaser.GameObjects.Graphics;
  private rallyGraphics!: Phaser.GameObjects.Graphics;
  private selectionRings: Phaser.GameObjects.Sprite[] = [];
  private buildingSelectionRing: Phaser.GameObjects.Sprite | null = null;
  private placementKind: BuildingKind | null = null;
  private placementGhost: Phaser.GameObjects.Sprite | null = null;
  private attackMoveMode = false;
  private dragStart: { x: number; y: number } | null = null;
  private panStart: { x: number; y: number; sx: number; sy: number } | null = null;
  private controlGroups: Record<number, Unit[]> = {};
  private lastCombatTickMs = 0;
  private lastFogTickMs = 0;
  private lastAITickMs = 0;
  private lastUnderAttackMs = -9999;
  private lastClick: { kind: UnitKind; time: number } | null = null;
  private cursorKeys!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { W: Phaser.Input.Keyboard.Key, A: Phaser.Input.Keyboard.Key, S: Phaser.Input.Keyboard.Key, D: Phaser.Input.Keyboard.Key };
  private gameOver = false;
  private cursorSprite!: Phaser.GameObjects.Image;
  private lastCursorKey = 'cursor_default';
  private lastCursorCheckMs = 0;
  private lastHoverCheckMs = 0;
  private hoveredEntity: IEntity | null = null;
  private caravanNextSpawnMs = Infinity;
  private caravanRouteFlip = false;
  private debugCaravans = false;

  private onUiBuild = (kind: BuildingKind): void => this.beginPlacement(kind);
  private onUiTrain = (kind: UnitKind): void => this.requestTrain(kind);
  private onUiStop = (): void => this.commandStop();
  private onUiCenterTownhall = (): void => this.centerOnTownhall();
  private onUiMinimapClick = (wx: number, wy: number): void => { this.cameras.main.centerOn(wx, wy); };

  constructor() { super('GameScene'); }

  init(data: GameInit): void {
    const config = this.normalizeLaunchConfig(data);
    this.mode = config.mode;
    this.playerRace = config.playerRace;
    this.aiRace = this.playerRace === 'alliance' ? 'horde' : 'alliance';
    this.difficulty = config.difficulty;
    this.storyMapId = config.mode === 'story' ? config.storyMapId : null;
    this.seed = config.seed ?? Math.floor(Math.random() * 100000);
    this.launchConfig = { ...config, seed: this.seed };
    this.units = []; this.buildings = []; this.resources = []; this.caravans = [];
    this.projectiles = []; this.selected = []; this.selectedBuilding = null;
    this.selectionRings = []; this.buildingSelectionRing = null;
    this.placementKind = null; this.placementGhost = null;
    this.attackMoveMode = false; this.dragStart = null; this.panStart = null;
    this.controlGroups = {}; this.gameOver = false;
    this.lastUnderAttackMs = -9999;
    this.lastClick = null;
    this.caravanNextSpawnMs = Infinity;
    this.caravanRouteFlip = false;
    this.debugCaravans = false;
    this.aiState = {
      phase: 'economy',
      nextCheckMs: 0,
      armyTargetScore: DIFFICULTY[this.difficulty].attackScore,
      regroupUntilMs: 0,
      lastPressureMs: 0
    };
    this.economy = new Economy();
  }

  private normalizeLaunchConfig(data: GameInit): GameLaunchConfig {
    if (data?.mode === 'story') {
      return {
        mode: 'story',
        playerRace: data.playerRace,
        difficulty: data.difficulty,
        storyMapId: data.storyMapId,
        seed: data.seed
      };
    }
    return {
      mode: 'skirmish',
      playerRace: data?.playerRace ?? 'alliance',
      difficulty: data?.difficulty ?? 'normal',
      seed: data?.seed
    };
  }

  create(): void {
    this.effects = new EffectsSystem(this);
    this.audio = new AudioSystem(this);
    this.layout = generateMap(this.seed);
    this.map = this.layout.map;

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.setBackgroundColor('#2a4a22');
    this.effects.setupPostFX();
    this.effects.setupVignette();

    this.economy.register(SIDE.player, this.playerRace, 430, 230, 0);
    this.economy.register(SIDE.ai, this.aiRace, 430, 230, 0);

    this.drawTiles();
    this.spawnInitial();
    this.debugCaravans = this.isDebugCaravansEnabled();
    this.scheduleNextCaravan(true);

    this.fog = new FogOfWar(this, this.map);
    this.initialReveal();
    this.fog.redraw();
    this.applyVisibility();

    this.selectionRect = this.add.graphics().setDepth(1200).setScrollFactor(0);
    this.footprint = this.add.graphics().setDepth(510);
    this.rallyGraphics = this.add.graphics().setDepth(75);

    // Custom cursor sprite (hides native)
    this.input.setDefaultCursor('none');
    this.cursorSprite = this.add.image(VIEW_W / 2, VIEW_H / 2, 'cursor_default')
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(2000);

    this.setupInput();

    this.scene.launch('UIScene', { playerSide: SIDE.player, launchConfig: this.launchConfig });

    // Ambient audio starts once user has interacted (audioctx resumes on first sound)
    this.input.once('pointerdown', () => this.audio.startAmbient());

    this.game.events.on('ui-build', this.onUiBuild);
    this.game.events.on('ui-train', this.onUiTrain);
    this.game.events.on('ui-stop', this.onUiStop);
    this.game.events.on('ui-center-townhall', this.onUiCenterTownhall);
    this.game.events.on('ui-minimap-click', this.onUiMinimapClick);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.emitEntityHover(null);
      this.game.events.off('ui-build', this.onUiBuild);
      this.game.events.off('ui-train', this.onUiTrain);
      this.game.events.off('ui-stop', this.onUiStop);
      this.game.events.off('ui-center-townhall', this.onUiCenterTownhall);
      this.game.events.off('ui-minimap-click', this.onUiMinimapClick);
      this.cancelPlacement();
    });
  }

  private drawTiles(): void {
    this.tileLayer = this.add.container(0, 0);
    this.tileLayer.setDepth(0);
    this.waterTiles = [];
    for (let y = 0; y < this.map.h; y++) {
      for (let x = 0; x < this.map.w; x++) {
        const t = this.map.get(x, y);
        const key = t === 4 /* Water */ ? 'tile_water_0' : this.map.tileTextureKey(t);
        const s = this.add.image(x * TILE, y * TILE, key).setOrigin(0, 0);
        this.tileLayer.add(s);
        if (t === 4) this.waterTiles.push(s);
      }
    }
    this.drawTileOverlays();
    // Render decals above tiles
    const decalContainer = this.add.container(0, 0);
    decalContainer.setDepth(1);
    for (const d of this.layout.decals) {
      if (!this.textures.exists(d.key)) continue;
      const img = this.add.image(d.x, d.y, d.key).setScale(d.scale).setRotation(d.rotation);
      decalContainer.add(img);
    }
    // Water animation tick
    this.time.addEvent({
      delay: 260,
      loop: true,
      callback: () => {
        this.waterPhase = (this.waterPhase + 1) % 4;
        const key = `tile_water_${this.waterPhase}`;
        for (const t of this.waterTiles) t.setTexture(key);
      }
    });
  }

  private drawTileOverlays(): void {
    const g = this.add.graphics().setDepth(2);
    for (let y = 0; y < this.map.h; y++) {
      for (let x = 0; x < this.map.w; x++) {
        const t = this.map.get(x, y);
        const wx = x * TILE;
        const wy = y * TILE;
        if (t === TileType.Water) {
          this.drawWaterEdge(g, x, y, wx, wy);
        } else if (t === TileType.Dirt) {
          this.drawRoadEdge(g, x, y, wx, wy);
        } else if (t === TileType.Forest) {
          g.fillStyle(0x000000, 0.08);
          g.fillRect(wx, wy + TILE - 4, TILE, 4);
        }
      }
    }
  }

  private drawWaterEdge(g: Phaser.GameObjects.Graphics, tx: number, ty: number, wx: number, wy: number): void {
    const isWater = (x: number, y: number) => this.map.inBounds(x, y) && this.map.get(x, y) === TileType.Water;
    g.fillStyle(0x12120c, 0.34);
    g.lineStyle(1, 0xa7c8c2, 0.32);
    if (!isWater(tx, ty - 1)) { g.fillRect(wx, wy, TILE, 3); g.lineBetween(wx + 2, wy + 3, wx + TILE - 2, wy + 3); }
    if (!isWater(tx, ty + 1)) { g.fillRect(wx, wy + TILE - 3, TILE, 3); g.lineBetween(wx + 2, wy + TILE - 4, wx + TILE - 2, wy + TILE - 4); }
    if (!isWater(tx - 1, ty)) { g.fillRect(wx, wy, 3, TILE); g.lineBetween(wx + 3, wy + 2, wx + 3, wy + TILE - 2); }
    if (!isWater(tx + 1, ty)) { g.fillRect(wx + TILE - 3, wy, 3, TILE); g.lineBetween(wx + TILE - 4, wy + 2, wx + TILE - 4, wy + TILE - 2); }
  }

  private drawRoadEdge(g: Phaser.GameObjects.Graphics, tx: number, ty: number, wx: number, wy: number): void {
    const isRoad = (x: number, y: number) => this.map.inBounds(x, y) && this.map.get(x, y) === TileType.Dirt;
    g.lineStyle(2, 0x2c2116, 0.22);
    if (!isRoad(tx, ty - 1)) g.lineBetween(wx, wy + 1, wx + TILE, wy + 1);
    if (!isRoad(tx, ty + 1)) g.lineBetween(wx, wy + TILE - 2, wx + TILE, wy + TILE - 2);
    if (!isRoad(tx - 1, ty)) g.lineBetween(wx + 1, wy, wx + 1, wy + TILE);
    if (!isRoad(tx + 1, ty)) g.lineBetween(wx + TILE - 2, wy, wx + TILE - 2, wy + TILE);
  }

  private spawnInitial(): void {
    const pb = this.layout.playerBase;
    const ab = this.layout.aiBase;

    const pth = this.spawnBuilding(pb.tx - 1, pb.ty - 1, 'townhall', SIDE.player, this.playerRace, true);
    const ath = this.spawnBuilding(ab.tx - 1, ab.ty - 1, 'townhall', SIDE.ai, this.aiRace, true);

    for (let i = 0; i < 4; i++) this.spawnUnit(pth.x - 66 + i * 28, pth.y + 76, 'worker', SIDE.player, this.playerRace);
    for (let i = 0; i < 4; i++) this.spawnUnit(ath.x - 66 + i * 28, ath.y + 76, 'worker', SIDE.ai, this.aiRace);

    for (const m of this.layout.goldMines) {
      const node = new ResourceNode(this, m.tx - 1, m.ty - 1, 'gold');
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) this.map.setWalkable(m.tx - 1 + dx, m.ty - 1 + dy, false);
      this.resources.push(node);
    }
    for (const t of this.layout.trees) this.resources.push(new ResourceNode(this, t.tx, t.ty, 'lumber'));
  }

  private isDebugCaravansEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('debugCaravans') === '1';
  }

  private caravanSpawnsEnabled(): boolean {
    if (this.mode === 'skirmish') return CARAVAN_CONFIG.enabledInSkirmish;
    return CARAVAN_CONFIG.enabledInStory;
  }

  private scheduleNextCaravan(first = false): void {
    if (!this.caravanSpawnsEnabled()) {
      this.caravanNextSpawnMs = Infinity;
      return;
    }
    const range = this.debugCaravans
      ? CARAVAN_CONFIG.debugSpawnMs
      : first
        ? CARAVAN_CONFIG.firstSpawnMs
        : CARAVAN_CONFIG.repeatSpawnMs;
    this.caravanNextSpawnMs = this.time.now + Phaser.Math.Between(range.min, range.max);
  }

  private spawnCaravan(): Caravan {
    const caravan = new Caravan(this, this.createCaravanRoute());
    this.caravans.push(caravan);
    this.effects.fx.dustPuff(caravan.x, caravan.y + caravan.radius * 0.45, true);
    caravan.setVisible(this.isVisibleEntity(caravan));
    return caravan;
  }

  private createCaravanRoute(): { x: number; y: number }[] {
    const lower = { x: 10 * TILE + TILE / 2, y: WORLD_H - 13 * TILE + TILE / 2 };
    const center = { x: WORLD_W / 2, y: WORLD_H / 2 };
    const upper = { x: WORLD_W - 12 * TILE + TILE / 2, y: 12 * TILE + TILE / 2 };
    const margin = CARAVAN_CONFIG.radius * 3;
    const fromLower = this.caravanRouteFlip;
    this.caravanRouteFlip = !this.caravanRouteFlip;
    return fromLower
      ? [{ x: -margin, y: lower.y }, lower, center, upper, { x: WORLD_W + margin, y: upper.y }]
      : [{ x: WORLD_W + margin, y: upper.y }, upper, center, lower, { x: -margin, y: lower.y }];
  }

  spawnUnit(x: number, y: number, kind: UnitKind, side: Side, race: Race): Unit {
    const u = new Unit(this, x, y, kind, side, race);
    this.units.push(u);
    this.economy.addFood(side, u.food);
    return u;
  }

  spawnBuilding(tx: number, ty: number, kind: BuildingKind, side: Side, race: Race, instant = false): Building {
    const b = new Building(this, tx, ty, kind, side, race, instant);
    this.buildings.push(b);
    const def = BUILDING[kind];
    for (let dy = 0; dy < def.size; dy++) {
      for (let dx = 0; dx < def.size; dx++) this.map.setWalkable(tx + dx, ty + dy, false);
    }
    if (instant && (kind === 'townhall' || kind === 'farm')) this.economy.addCap(side, def.food);
    return b;
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.cursorKeys = kb.createCursorKeys();
    this.wasdKeys = kb.addKeys('W,A,S,D') as any;
    kb.on('keydown-Q', () => this.setAttackMoveMode(true));
    kb.on('keydown-X', () => this.commandStop());
    kb.on('keydown-H', () => this.centerOnTownhall());
    kb.on('keydown-R', () => this.restartGame());
    kb.on('keydown-M', () => this.flashMessage(this.audio.toggleMute() ? 'Звук выключен' : 'Звук включен'));
    kb.on('keydown-ESC', () => { this.cancelPlacement(); this.setAttackMoveMode(false); });
    kb.on('keydown-B', () => this.game.events.emit('ui-open-build'));
    kb.on('keydown-E', () => this.tryTrainHotkey('worker'));
    kb.on('keydown-F', () => this.tryTrainHotkey('footman'));
    kb.on('keydown-K', () => this.tryTrainHotkey('knight'));
    kb.on('keydown-C', () => this.tryTrainHotkey('catapult'));

    for (let i = 1; i <= 9; i++) {
      kb.on(`keydown-${i}`, (ev: KeyboardEvent) => {
        if (ev.ctrlKey || ev.metaKey) {
          this.controlGroups[i] = this.selected.filter(u => u.alive);
          this.effects.statusText(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y - 80, `Группа ${i} сохранена`, 0xaaffaa);
        } else this.selectGroup(i);
      });
    }

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isOverUi(p)) return;
      if (p.middleButtonDown()) {
        this.panStart = { x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY };
        return;
      }
      if (p.leftButtonDown()) {
        if (this.placementKind) { this.tryPlaceBuilding(p); return; }
        if (this.attackMoveMode) { this.commandAttackMoveWorld(p); this.setAttackMoveMode(false); return; }
        this.dragStart = { x: p.worldX, y: p.worldY };
      } else if (p.rightButtonDown()) {
        if (this.placementKind) { this.cancelPlacement(); return; }
        this.commandRightClickWorld(p);
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.panStart && !p.middleButtonDown()) this.panStart = null;
      if (!p.leftButtonReleased()) return;
      if (!this.dragStart) return;
      const end = { x: p.worldX, y: p.worldY };
      const dist = Phaser.Math.Distance.Between(this.dragStart.x, this.dragStart.y, end.x, end.y);
      const additive = (p.event as MouseEvent | undefined)?.shiftKey ?? false;
      if (dist < 6) this.clickSelect(end, additive);
      else this.boxSelect(this.dragStart, end, additive);
      this.dragStart = null;
      this.selectionRect.clear();
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.panStart) {
        this.cameras.main.scrollX = this.panStart.sx + (this.panStart.x - p.x);
        this.cameras.main.scrollY = this.panStart.sy + (this.panStart.y - p.y);
      }
      if (this.placementKind && this.placementGhost) this.updatePlacementGhost(p.worldX, p.worldY);
      if (this.dragStart && p.leftButtonDown()) this.drawSelectionDrag(p);
      this.updateCursor(p);
      this.updateEntityHover(p);
    });

    this.input.mouse?.disableContextMenu();
  }

  private updateCursor(p: Phaser.Input.Pointer): void {
    // Position always (cheap)
    this.cursorSprite.setPosition(p.x - 2, p.y - 2);

    // Throttle expensive hit-test to ~90ms
    const now = this.time.now;
    if (now - this.lastCursorCheckMs < 90) return;
    this.lastCursorCheckMs = now;

    let key = 'cursor_default';
    if (this.placementKind) {
      const { tx, ty } = this.tileFromWorld(p.worldX, p.worldY);
      key = this.canPlace(tx, ty, this.placementKind) ? 'cursor_build_ok' : 'cursor_build_no';
    } else if (this.attackMoveMode) {
      key = 'cursor_attack';
    } else if (!this.isOverUi(p)) {
      const hit = this.findEntityAt(p.worldX, p.worldY);
      if (hit) {
        if ((hit instanceof Unit || hit instanceof Building) && hit.side !== SIDE.player && hit.side !== SIDE.neutral) {
          key = 'cursor_attack';
        } else if (hit instanceof Caravan && this.selected.some(u => u.canAttack())) {
          key = 'cursor_attack';
        } else if (hit instanceof ResourceNode && this.selected.some(u => u.isWorker())) {
          key = 'cursor_gather';
        }
      }
    }

    if (key !== this.lastCursorKey) {
      this.cursorSprite.setTexture(key);
      this.lastCursorKey = key;
    }
  }

  private isOverUi(p: Phaser.Input.Pointer): boolean {
    const { x, y } = this.pointerClientPosition(p);
    const el = document.elementFromPoint(x, y);
    return !!el?.closest('#top-bar, #bottom-panel, #minimap-border, #game-over-screen.visible, #menu-layer.visible');
  }

  private pointerClientPosition(p: Phaser.Input.Pointer): { x: number; y: number } {
    const ev = p.event as MouseEvent | undefined;
    if (ev && typeof ev.clientX === 'number' && typeof ev.clientY === 'number') {
      return { x: ev.clientX, y: ev.clientY };
    }
    const rect = this.game.canvas.getBoundingClientRect();
    return {
      x: rect.left + (p.x / VIEW_W) * rect.width,
      y: rect.top + (p.y / VIEW_H) * rect.height
    };
  }

  private updateEntityHover(p: Phaser.Input.Pointer): void {
    const now = this.time.now;
    if (this.isOverUi(p) || this.dragStart || this.placementKind) {
      this.lastHoverCheckMs = now;
      this.emitEntityHover(null, p);
      return;
    }
    if (now - this.lastHoverCheckMs < 80) return;
    this.lastHoverCheckMs = now;

    this.emitEntityHover(this.findEntityAt(p.worldX, p.worldY), p);
  }

  private emitEntityHover(entity: IEntity | null, p?: Phaser.Input.Pointer): void {
    const next = entity?.alive ? entity : null;
    if (!next && !this.hoveredEntity) return;
    this.hoveredEntity = next;
    const pointer = p ?? this.input.activePointer;
    const screen = this.pointerClientPosition(pointer);
    this.game.events.emit('ui-entity-hover', {
      entity: this.hoveredEntity,
      screenX: screen.x,
      screenY: screen.y
    });
  }

  private tileFromWorld(x: number, y: number): { tx: number; ty: number } {
    return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
  }

  private clickSelect(pos: { x: number; y: number }, additive: boolean): void {
    const hit = this.findEntityAt(pos.x, pos.y);
    if (!hit) {
      if (!additive) this.clearSelection();
      return;
    }

    if (hit instanceof Unit && hit.side === SIDE.player) {
      const now = this.time.now;
      if (this.lastClick && this.lastClick.kind === hit.unitKind && now - this.lastClick.time < 360) {
        this.selectSameTypeOnScreen(hit.unitKind, additive);
      } else {
        if (!additive) { this.selected = []; this.selectedBuilding = null; }
        this.toggleUnitSelection(hit, additive);
      }
      this.lastClick = { kind: hit.unitKind, time: now };
      this.updateSelectionRings();
      this.audio.play('select');
      return;
    }

    if (hit instanceof Building && hit.side === SIDE.player) {
      if (!additive) this.clearSelection(false);
      this.selected = [];
      this.selectedBuilding = hit;
      this.updateSelectionRings();
      this.audio.play('select');
    } else if (!additive) {
      this.clearSelection();
    }
  }

  private boxSelect(a: { x: number; y: number }, b: { x: number; y: number }, additive: boolean): void {
    if (!additive) this.clearSelection(false);
    const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
    const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
    const picked = this.units.filter(u => u.alive && u.side === SIDE.player && u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2);
    for (const u of picked) if (!this.selected.includes(u)) this.selected.push(u);
    this.selectedBuilding = null;
    if (this.selected.length === 0) {
      const building = this.buildings.find(bld => bld.alive && bld.side === SIDE.player && Math.abs(bld.x - (x1 + x2) / 2) < bld.radius && Math.abs(bld.y - (y1 + y2) / 2) < bld.radius);
      if (building) this.selectedBuilding = building;
    }
    this.updateSelectionRings();
    if (this.selected.length || this.selectedBuilding) this.audio.play('select');
  }

  private selectSameTypeOnScreen(kind: UnitKind, additive: boolean): void {
    const cam = this.cameras.main;
    if (!additive) this.selected = [];
    this.selectedBuilding = null;
    for (const u of this.units) {
      if (!u.alive || u.side !== SIDE.player || u.unitKind !== kind) continue;
      if (!Phaser.Geom.Rectangle.Contains(cam.worldView, u.x, u.y)) continue;
      if (!this.selected.includes(u)) this.selected.push(u);
    }
  }

  private toggleUnitSelection(u: Unit, additive: boolean): void {
    if (!additive) {
      this.selected = [u];
      this.selectedBuilding = null;
      return;
    }
    const idx = this.selected.indexOf(u);
    if (idx >= 0) this.selected.splice(idx, 1);
    else this.selected.push(u);
    this.selectedBuilding = null;
  }

  private drawSelectionDrag(p: Phaser.Input.Pointer): void {
    this.selectionRect.clear();
    this.selectionRect.lineStyle(1.5, 0x66ff66, 1);
    const cam = this.cameras.main;
    const sx = this.dragStart!.x - cam.scrollX;
    const sy = this.dragStart!.y - cam.scrollY;
    const ex = p.worldX - cam.scrollX;
    const ey = p.worldY - cam.scrollY;
    this.selectionRect.strokeRect(Math.min(sx, ex), Math.min(sy, ey), Math.abs(ex - sx), Math.abs(ey - sy));
  }

  private findEntityAt(x: number, y: number): IEntity | null {
    for (const u of this.units) {
      if (u.alive && u.sprite.visible && Phaser.Math.Distance.Between(x, y, u.x, u.y) <= u.radius + 5) return u;
    }
    for (const c of this.caravans) {
      if (c.alive && c.sprite.visible && Phaser.Math.Distance.Between(x, y, c.x, c.y) <= c.radius + 6) return c;
    }
    for (const b of this.buildings) {
      if (b.alive && b.sprite.visible && Math.abs(x - b.x) <= b.radius && Math.abs(y - b.y) <= b.radius) return b;
    }
    for (const r of this.resources) {
      if (r.alive && r.sprite.visible && Math.abs(x - r.x) <= r.radius && Math.abs(y - r.y) <= r.radius) return r;
    }
    return null;
  }

  clearSelection(emit = true): void {
    this.selected = [];
    this.selectedBuilding = null;
    this.updateSelectionRings(emit);
  }

  selectGroup(i: number): void {
    const g = this.controlGroups[i];
    if (!g) return;
    this.selected = g.filter(u => u.alive);
    this.selectedBuilding = null;
    this.updateSelectionRings();
    this.audio.play('select');
  }

  private updateSelectionRings(emit = true): void {
    for (const r of this.selectionRings) r.destroy();
    this.selectionRings = [];
    if (this.buildingSelectionRing) { this.buildingSelectionRing.destroy(); this.buildingSelectionRing = null; }
    for (const u of this.selected) {
      const ringKey = u.unitKind === 'catapult' ? 'ring_select_l'
        : u.unitKind === 'knight' ? 'ring_select_m'
        : 'ring_select_s';
      const r = this.add.sprite(u.x, u.y, ringKey).setDepth(29);
      r.setData('follow', u);
      r.setTint(RACE_COLOR[u.race]);
      this.tweens.add({
        targets: r,
        scale: { from: 0.9, to: 1.1 },
        alpha: { from: 0.7, to: 1 },
        duration: 720,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this.tweens.add({
        targets: r,
        rotation: Math.PI * 2,
        duration: 7000,
        repeat: -1
      });
      this.selectionRings.push(r);
    }
    if (this.selectedBuilding) {
      const b = this.selectedBuilding;
      const ring = this.add.sprite(b.x, b.y, 'ring48').setDepth(29);
      ring.setDisplaySize(b.radius * 2 + 10, b.radius * 2 + 10);
      this.tweens.add({
        targets: ring,
        alpha: { from: 0.7, to: 1 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this.buildingSelectionRing = ring;
    }
    this.drawRally();
    if (emit) this.game.events.emit('selection-changed', { units: this.selected, building: this.selectedBuilding });
  }

  private commandRightClickWorld(p: Phaser.Input.Pointer): void {
    if (this.selectedBuilding) {
      if (this.selectedBuilding.completed) {
        this.selectedBuilding.rally = { x: p.worldX, y: p.worldY };
        this.effects.commandMarker(p.worldX, p.worldY, 0xffffff, 'rally', 'Сбор');
        this.audio.play('move');
        this.drawRally();
      }
      return;
    }
    if (this.selected.length === 0) return;
    const hit = this.findEntityAt(p.worldX, p.worldY);
    if (hit instanceof Caravan) {
      for (const u of this.selected) this.orderAttack(u, hit);
      this.effects.targetMarker(hit, 0xffaa44, 'Караван');
      this.audio.play('attack');
    } else if (hit instanceof Unit && hit.side !== SIDE.player && hit.side !== SIDE.neutral) {
      for (const u of this.selected) this.orderAttack(u, hit);
      this.effects.targetMarker(hit, 0xff4444, 'Атака');
      this.audio.play('attack');
    } else if (hit instanceof Building && hit.side !== SIDE.player) {
      for (const u of this.selected) this.orderAttackBuilding(u, hit);
      this.effects.targetMarker(hit, 0xff4444, 'Атака');
      this.audio.play('attack');
    } else if (hit instanceof ResourceNode) {
      const workers = this.selected.filter(u => u.isWorker());
      if (workers.length) {
        for (const u of workers) this.orderGather(u, hit);
        this.effects.targetMarker(hit, 0xffd84a, hit.resourceType === 'gold' ? 'Золото' : 'Дерево');
        this.audio.play('move');
      } else this.commandMoveTo(p.worldX, p.worldY);
    } else if (hit instanceof Building && hit.side === SIDE.player && !hit.completed) {
      const workers = this.selected.filter(u => u.isWorker());
      if (workers.length) {
        for (const u of workers) this.orderBuild(u, hit);
        this.effects.targetMarker(hit, 0x88ff88, 'Строить');
        this.audio.play('move');
      } else {
        this.commandMoveTo(p.worldX, p.worldY);
      }
    } else if (hit instanceof Building && hit.side === SIDE.player && hit.completed && hit.buildingKind === 'townhall') {
      let returned = false;
      for (const u of this.selected) if (u.isWorker() && u.cargo) { this.orderReturnCargo(u, hit); returned = true; }
      if (returned) {
        this.effects.targetMarker(hit, 0x66ddff, 'Сдать');
        this.audio.play('move');
      } else this.commandMoveTo(p.worldX, p.worldY);
    } else {
      this.commandMoveTo(p.worldX, p.worldY);
    }
  }

  private commandMoveTo(x: number, y: number): void {
    this.orderMoveGroup(x, y);
    this.effects.commandMarker(x, y, 0x66ff66, 'move', 'Идти');
    this.audio.play('move');
  }

  private commandAttackMoveWorld(p: Phaser.Input.Pointer): void {
    const slots = formationSlots(this.selected, { x: p.worldX, y: p.worldY }, 34);
    this.selected.forEach((u, i) => {
      if (!u.canAttack()) { this.orderMove(u, slots[i].x, slots[i].y); return; }
      u.clearOrders();
      u.state = 'attack_move';
      u.attackMoveTo = slots[i];
      this.repath(u, slots[i].x, slots[i].y);
    });
    this.effects.commandMarker(p.worldX, p.worldY, 0xff9944, 'attack', 'Атака');
    this.audio.play('attack');
  }

  private commandStop(): void {
    for (const u of this.selected) u.clearOrders();
    this.setAttackMoveMode(false);
    this.audio.play('move', 0.5);
  }

  private centerOnTownhall(): void {
    const th = this.buildings.find(b => b.alive && b.side === SIDE.player && b.buildingKind === 'townhall');
    if (th) this.cameras.main.centerOn(th.x, th.y);
  }

  private restartGame(): void {
    this.scene.stop('UIScene');
    this.scene.restart({ ...this.launchConfig, seed: Math.floor(Math.random() * 100000) });
  }

  private setAttackMoveMode(v: boolean): void {
    this.attackMoveMode = v;
    this.game.events.emit('ui-mode', v ? 'Атака-движение: ЛКМ по земле или цели' : '');
    if (v) this.effects.statusText(this.cameras.main.midPoint.x, this.cameras.main.midPoint.y - 100, 'Атака-движение', 0xffaa66);
  }

  private orderMoveGroup(x: number, y: number): void {
    const slots = formationSlots(this.selected, { x, y }, 32);
    this.selected.forEach((u, i) => this.orderMove(u, slots[i].x, slots[i].y));
  }

  orderMove(u: Unit, x: number, y: number): void {
    u.clearOrders();
    u.state = 'move';
    this.repath(u, x, y);
  }

  orderAttack(u: Unit, target: IEntity): void {
    if (!u.canAttack()) return;
    u.clearOrders();
    u.state = 'attack';
    if (target instanceof Building) u.targetBuilding = target;
    else u.targetUnit = target;
  }

  orderAttackBuilding(u: Unit, target: Building): void {
    if (!u.canAttack()) return;
    u.clearOrders();
    u.state = 'attack';
    u.targetBuilding = target;
  }

  orderGather(u: Unit, node: ResourceNode): void {
    u.clearOrders();
    u.state = 'gather';
    u.targetResource = node;
  }

  orderReturnCargo(u: Unit, hall: Building): void {
    u.returnTo = hall;
    u.state = 'return_cargo';
    this.repath(u, hall.x, hall.y);
  }

  orderBuild(u: Unit, site: Building): void {
    u.clearOrders();
    u.state = 'build';
    u.targetBuilding = site;
    this.repath(u, site.x, site.y);
  }

  repath(u: Unit, wx: number, wy: number): void {
    const s = this.tileFromWorld(u.x, u.y);
    const g = this.tileFromWorld(wx, wy);
    const path = findPath(this.map, s.tx, s.ty, g.tx, g.ty);
    const wp = path.map(p => ({ x: p.tx * TILE + TILE / 2, y: p.ty * TILE + TILE / 2 }));
    u.setPath(wp);
    u.pathDest = wp.length > 0 ? wp[wp.length - 1] : { x: wx, y: wy };
    u.pathRepathMs = 0;
  }

  beginPlacement(kind: BuildingKind): void {
    if (!this.economy.canAfford(SIDE.player, BUILDING[kind].cost.gold, BUILDING[kind].cost.lumber)) {
      this.flashMessage('Недостаточно ресурсов');
      this.audio.play('error');
      return;
    }
    const hasWorker = this.selected.some(u => u.isWorker());
    if (!hasWorker) { this.flashMessage('Нужен рабочий'); this.audio.play('error'); return; }
    this.cancelPlacement();
    this.placementKind = kind;
    if (buildingArtReady(this, kind, this.playerRace)) {
      const display = BUILDING_ART_DISPLAY[kind];
      this.placementGhost = this.add.sprite(0, 0, buildingSheetKey(kind, this.playerRace), getBuildingStageFrame('final'))
        .setDisplaySize(display.width, display.height)
        .setAlpha(0.72)
        .setDepth(500);
    } else {
      this.placementGhost = this.add.sprite(0, 0, `building_${kind}_${this.playerRace}`).setAlpha(0.72).setDepth(500);
    }
    this.game.events.emit('ui-mode', `Строительство: ${BUILDING[kind].labelByRace[this.playerRace]}`);
  }

  cancelPlacement(): void {
    if (this.placementGhost) this.placementGhost.destroy();
    this.placementGhost = null;
    this.placementKind = null;
    this.footprint?.clear();
    this.game.events.emit('ui-mode', this.attackMoveMode ? 'Атака-движение: ЛКМ по земле или цели' : '');
  }

  canPlace(tx: number, ty: number, kind: BuildingKind): boolean {
    const size = BUILDING[kind].size;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        if (!this.map.inBounds(tx + dx, ty + dy)) return false;
        if (!this.map.isWalkable(tx + dx, ty + dy)) return false;
      }
    }
    return true;
  }

  tryPlaceBuilding(p: Phaser.Input.Pointer): void {
    if (!this.placementKind) return;
    const { tx, ty } = this.tileFromWorld(p.worldX, p.worldY);
    if (!this.canPlace(tx, ty, this.placementKind)) { this.flashMessage('Нельзя построить здесь'); this.audio.play('error'); return; }
    const def = BUILDING[this.placementKind];
    if (!this.economy.spend(SIDE.player, def.cost.gold, def.cost.lumber)) return;
    const site = this.spawnBuilding(tx, ty, this.placementKind, SIDE.player, this.playerRace, false);
    const worker = this.selected.find(u => u.isWorker())!;
    this.orderBuild(worker, site);
    this.effects.commandMarker(site.x, site.y, 0x88ff88, 'build', 'Строить');
    this.audio.play('build');
    this.cancelPlacement();
  }

  private updatePlacementGhost(wx: number, wy: number): void {
    if (!this.placementKind || !this.placementGhost) return;
    const { tx, ty } = this.tileFromWorld(wx, wy);
    const size = BUILDING[this.placementKind].size;
    this.placementGhost.setPosition(tx * TILE + (size * TILE) / 2, ty * TILE + (size * TILE) / 2);
    const ok = this.canPlace(tx, ty, this.placementKind);
    this.placementGhost.setTint(ok ? COLORS.ghostOk : COLORS.ghostBad);
    this.placementGhost.setAlpha(ok ? 0.78 : 0.54);
    this.drawFootprint(tx, ty, size, ok);
  }

  private drawFootprint(tx: number, ty: number, size: number, ok: boolean): void {
    this.footprint.clear();
    this.footprint.lineStyle(1, ok ? COLORS.ghostOk : COLORS.ghostBad, 0.95);
    this.footprint.fillStyle(ok ? COLORS.ghostOk : COLORS.ghostBad, 0.18);
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        this.footprint.fillRect((tx + dx) * TILE, (ty + dy) * TILE, TILE, TILE);
        this.footprint.strokeRect((tx + dx) * TILE + 1, (ty + dy) * TILE + 1, TILE - 2, TILE - 2);
      }
    }
  }

  requestTrain(kind: UnitKind): void {
    const b = this.selectedBuilding;
    if (!b || b.side !== SIDE.player || !b.completed) return;
    const producer = UNIT[kind].producer as BuildingKind;
    if (b.buildingKind !== producer) { this.flashMessage('Это здание не производит этого юнита'); this.audio.play('error'); return; }
    const requires = UNIT[kind].requires as BuildingKind | undefined;
    if (requires && !this.buildings.some(x => x.alive && x.completed && x.side === SIDE.player && x.buildingKind === requires)) {
      this.flashMessage(`Нужно здание: ${BUILDING[requires].labelByRace[this.playerRace]}`);
      this.audio.play('error');
      return;
    }
    const def = UNIT[kind];
    if (b.queue.length >= 5) { this.flashMessage('Очередь заполнена'); this.audio.play('error'); return; }
    if (!this.economy.canAfford(SIDE.player, def.cost.gold, def.cost.lumber)) { this.flashMessage('Недостаточно ресурсов'); this.audio.play('error'); return; }
    if (!this.economy.hasFoodRoom(SIDE.player, def.food)) { this.flashMessage('Нужно больше снабжения'); this.audio.play('error'); return; }
    this.economy.spend(SIDE.player, def.cost.gold, def.cost.lumber);
    b.enqueue(kind);
    this.audio.play('train');
    this.game.events.emit('selection-changed', { units: this.selected, building: this.selectedBuilding });
  }

  private tryTrainHotkey(kind: UnitKind): void {
    if (!this.selectedBuilding) return;
    this.requestTrain(kind);
  }

  update(_t: number, dt: number): void {
    if (this.gameOver) return;
    this.updateCamera(dt);
    this.effects.ambientViewportTick(dt, this.cameras.main.worldView);
    this.updateUnits(dt);
    this.applySeparation(dt);
    this.updateCaravans(dt);
    this.updateBuildings(dt);
    this.updateProjectiles(dt);
    this.updateSelectionRingsFollow();
    this.drawRally();
    this.lastCombatTickMs += dt;
    if (this.lastCombatTickMs >= 200) { this.combatTick(); this.lastCombatTickMs = 0; }
    this.lastFogTickMs += dt;
    if (this.lastFogTickMs >= FOG.updateMs) { this.updateFog(); this.lastFogTickMs = 0; }
    this.lastAITickMs += dt;
    if (this.lastAITickMs >= DIFFICULTY[this.difficulty].aiDelayMs) {
      runAI(this, this.aiState, this.difficulty);
      this.lastAITickMs = 0;
    }
    this.checkVictory();
    this.pruneDead();
  }

  private updateSelectionRingsFollow(): void {
    for (const r of this.selectionRings) {
      const u = r.getData('follow') as Unit;
      if (!u || !u.alive) { r.destroy(); continue; }
      r.setPosition(u.x, u.y);
    }
    this.selectionRings = this.selectionRings.filter(r => r.active);
    if (this.buildingSelectionRing && this.selectedBuilding && !this.selectedBuilding.alive) {
      this.buildingSelectionRing.destroy();
      this.buildingSelectionRing = null;
      this.selectedBuilding = null;
      this.game.events.emit('selection-changed', { units: this.selected, building: this.selectedBuilding });
    }
    if (this.buildingSelectionRing && this.selectedBuilding) this.buildingSelectionRing.setPosition(this.selectedBuilding.x, this.selectedBuilding.y);
  }

  private updateCamera(dt: number): void {
    const cam = this.cameras.main;
    const speed = (CAMERA_SPEED * dt) / 1000;
    let dx = 0, dy = 0;
    if (this.cursorKeys.up?.isDown || this.wasdKeys.W.isDown) dy -= 1;
    if (this.cursorKeys.down?.isDown || this.wasdKeys.S.isDown) dy += 1;
    if (this.cursorKeys.left?.isDown || this.wasdKeys.A.isDown) dx -= 1;
    if (this.cursorKeys.right?.isDown || this.wasdKeys.D.isDown) dx += 1;

    const p = this.input.activePointer;
    if (p && !p.isDown) {
      if (p.x < EDGE_SCROLL_PX) dx -= 1;
      if (p.x > VIEW_W - EDGE_SCROLL_PX) dx += 1;
      if (p.y < EDGE_SCROLL_PX) dy -= 1;
      if (p.y > VIEW_H - EDGE_SCROLL_PX) dy += 1;
    }
    const len = Math.hypot(dx, dy) || 1;
    const targetX = dx ? (dx / len) * speed : 0;
    const targetY = dy ? (dy / len) * speed : 0;
    this.cameraVel.x = Phaser.Math.Linear(this.cameraVel.x * FEEL.cameraFriction, targetX, FEEL.cameraSmoothing);
    this.cameraVel.y = Phaser.Math.Linear(this.cameraVel.y * FEEL.cameraFriction, targetY, FEEL.cameraSmoothing);
    if (Math.abs(this.cameraVel.x) < 0.01) this.cameraVel.x = 0;
    if (Math.abs(this.cameraVel.y) < 0.01) this.cameraVel.y = 0;
    cam.scrollX = Phaser.Math.Clamp(cam.scrollX + this.cameraVel.x, 0, WORLD_W - cam.width);
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY + this.cameraVel.y, 0, WORLD_H - cam.height);
  }

  private updateUnits(dt: number): void {
    for (const u of this.units) {
      if (!u.alive) continue;
      this.updateUnit(u, dt);
      u.update();
    }
  }

  private updateUnit(u: Unit, dt: number): void {
    u.pathRepathMs += dt;
    switch (u.state) {
      case 'idle': this.tickIdle(u); break;
      case 'move': this.tickMove(u, dt); break;
      case 'attack_move': this.tickAttackMove(u, dt); break;
      case 'attack': this.tickAttack(u, dt); break;
      case 'gather': this.tickGather(u, dt); break;
      case 'return_cargo': this.tickReturnCargo(u, dt); break;
      case 'build': this.tickBuild(u, dt); break;
    }
  }

  private tickIdle(u: Unit): void {
    if (!u.canAttack()) return;
    const target = this.acquireTarget(u, u.sight * TILE);
    if (target) this.assignAttackTarget(u, target);
  }

  private tickMove(u: Unit, dt: number): void {
    if (!this.stepPath(u, dt)) u.state = 'idle';
  }

  private tickAttackMove(u: Unit, dt: number): void {
    const tgt = this.acquireTarget(u, u.sight * TILE);
    if (tgt) { this.assignAttackTarget(u, tgt); return; }
    if (!this.stepPath(u, dt)) {
      u.state = 'idle';
      u.attackMoveTo = null;
    }
  }

  private tickAttack(u: Unit, dt: number): void {
    let tgt: IEntity | null = u.targetUnit && u.targetUnit.alive ? u.targetUnit : null;
    if (!tgt) tgt = u.targetBuilding && u.targetBuilding.alive ? u.targetBuilding : null;
    if (!tgt) {
      if (u.attackMoveTo) { u.state = 'attack_move'; this.repath(u, u.attackMoveTo.x, u.attackMoveTo.y); return; }
      u.state = 'idle'; u.targetUnit = null; u.targetBuilding = null; return;
    }
    const dist = Phaser.Math.Distance.Between(u.x, u.y, tgt.x, tgt.y);
    const effectiveRange = u.range + tgt.radius + u.radius + (tgt.kind === 'building' ? TILE * 0.65 : 0);
    if (dist > effectiveRange) {
      if (u.path.length === 0 || u.pathRepathMs > 500) this.repath(u, tgt.x, tgt.y);
      this.stepPath(u, dt);
      return;
    }
    const now = this.time.now;
    if (now - u.lastAttack >= u.cooldown) {
      u.lastAttack = now;
      const bonus = tgt.kind === 'building' ? UNIT[u.unitKind].bonusVsBuilding ?? 0 : 0;
      const damage = u.atk + bonus;

      u.playAttackSwing();

      if (u.isRanged()) this.spawnProjectile(u, tgt, damage, UNIT[u.unitKind].splashRadius ?? 0);
      else this.dealDamage(tgt, damage, u);
      if (tgt.kind === 'unit' && tgt.alive) {
        const vic = tgt as Unit;
        if (vic.canAttack() && !vic.targetUnit && !vic.targetBuilding) this.assignAttackTarget(vic, u);
      }
    }
  }

  private tickGather(u: Unit, dt: number): void {
    const node = u.targetResource;
    if (!node || !node.alive) {
      if (u.cargo) { this.returnToNearestHall(u); return; }
      const newNode = this.findNearestResource(u, 'gold');
      if (newNode) u.targetResource = newNode;
      else u.state = 'idle';
      return;
    }
    const dist = Phaser.Math.Distance.Between(u.x, u.y, node.x, node.y);
    const reach = node.radius + u.radius + TILE * 1.5;
    if (dist > reach) {
      if (u.path.length === 0 || u.pathRepathMs > 500) this.repath(u, node.x, node.y);
      this.stepPath(u, dt);
      return;
    }
    u.path = [];
    const prevGather = u.gatherAccum;
    u.gatherAccum += dt;
    if (Math.floor(prevGather / FEEL.gatherWorkPulseMs) !== Math.floor(u.gatherAccum / FEEL.gatherWorkPulseMs)) {
      u.playWorkSwing('gather');
      if (u.side === SIDE.player && node.sprite.visible) {
        this.effects.gatherImpact(node.x, node.y, node.resourceType);
        this.audio.play('gather', 0.28, u.x);
      }
    }
    if (u.gatherAccum >= RESOURCE.gatherTime) {
      u.gatherAccum = 0;
      const n = node.harvest(RESOURCE.workerCarry);
      if (!node.alive && node.resourceType === 'lumber') this.map.setWalkable(node.tx, node.ty, true);
      if (n > 0) {
        u.cargo = { type: node.resourceType, amount: n };
        if (u.side === SIDE.player) {
          this.effects.resourceText(u.x, u.y, `+${n}`, node.resourceType);
          this.effects.gatherImpact(u.x, u.y, node.resourceType);
        }
        this.returnToNearestHall(u);
      }
    }
  }

  private tickReturnCargo(u: Unit, dt: number): void {
    if (!u.cargo) { u.state = 'idle'; return; }
    let hall = u.returnTo && u.returnTo.alive ? u.returnTo : null;
    if (!hall) hall = this.findNearestHall(u);
    if (!hall) { u.state = 'idle'; return; }
    const dist = Phaser.Math.Distance.Between(u.x, u.y, hall.x, hall.y);
    if (dist > hall.radius + u.radius + TILE * 1.5) {
      if (u.path.length === 0 || u.pathRepathMs > 500) this.repath(u, hall.x, hall.y);
      this.stepPath(u, dt);
      return;
    }
    this.economy.deposit(u.side, u.cargo.type, Math.round(u.cargo.amount * (u.side === SIDE.ai ? DIFFICULTY[this.difficulty].incomeBias : 1)));
    if (u.side === SIDE.player) {
      this.effects.resourceText(hall.x, hall.y, `+${u.cargo.amount} ${u.cargo.type === 'gold' ? 'G' : 'L'}`, u.cargo.type);
      this.audio.play('deposit', 0.45);
    }
    const lastNode = u.targetResource;
    u.cargo = null;
    u.returnTo = null;
    if (lastNode && lastNode.alive) u.state = 'gather';
    else {
      const t = this.findNearestResource(u, 'gold');
      if (t) { u.targetResource = t; u.state = 'gather'; }
      else u.state = 'idle';
    }
  }

  private tickBuild(u: Unit, dt: number): void {
    const site = u.targetBuilding;
    if (!site || !site.alive) { u.state = 'idle'; u.targetBuilding = null; return; }
    if (site.completed) { u.state = 'idle'; u.targetBuilding = null; return; }
    const dist = Phaser.Math.Distance.Between(u.x, u.y, site.x, site.y);
    if (dist > site.radius + u.radius + TILE * 1.5) {
      if (u.path.length === 0 || u.pathRepathMs > 500) this.repath(u, site.x, site.y);
      this.stepPath(u, dt);
      return;
    }
    u.path = [];
    const prevBuild = site.buildProgress;
    const done = site.addBuildProgress(dt);
    if (Math.floor(prevBuild / FEEL.buildWorkPulseMs) !== Math.floor(site.buildProgress / FEEL.buildWorkPulseMs)) {
      u.playWorkSwing('build');
      if (site.sprite.visible) this.effects.buildProgressPulse(site.x, site.y, site.radius);
    }
    if (done) {
      const def = BUILDING[site.buildingKind];
      if (site.buildingKind === 'townhall' || site.buildingKind === 'farm') this.economy.addCap(site.side, def.food);
      this.effects.buildingComplete(site.x, site.y, RACE_COLOR[site.race]);
      if (site.side === SIDE.player) this.audio.play('build');
      u.state = 'idle'; u.targetBuilding = null;
    }
  }

  private stepPath(u: Unit, dt: number): boolean {
    if (u.path.length === 0) return false;
    const step = (u.speed * dt) / 1000;
    const next = u.path[0];
    const dx = next.x - u.x;
    const dy = next.y - u.y;
    const d = Math.hypot(dx, dy);
    if (d <= step) {
      u.x = next.x; u.y = next.y;
      u.path.shift();
    } else {
      u.x += (dx / d) * step;
      u.y += (dy / d) * step;
    }
    return true;
  }

  private applySeparation(dt: number): void {
    const strength = Math.min(1, dt / 16.67) * 1.4;
    for (let i = 0; i < this.units.length; i++) {
      const a = this.units[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.units.length; j++) {
        const b = this.units[j];
        if (!b.alive || b.side !== a.side) continue;
        const min = a.radius + b.radius + 4;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d <= 0.01 || d >= min) continue;
        const push = ((min - d) / 2) * strength;
        const nx = dx / d, ny = dy / d;
        this.tryNudge(a, -nx * push, -ny * push);
        this.tryNudge(b, nx * push, ny * push);
      }
    }
  }

  private tryNudge(u: Unit, dx: number, dy: number): void {
    const nx = Phaser.Math.Clamp(u.x + dx, 0, WORLD_W - 1);
    const ny = Phaser.Math.Clamp(u.y + dy, 0, WORLD_H - 1);
    const t = this.map.worldToTile(nx, ny);
    if (!this.map.isWalkable(t.tx, t.ty)) return;
    u.x = nx; u.y = ny;
  }

  private updateCaravans(dt: number): void {
    for (const caravan of this.caravans) {
      if (caravan.alive) caravan.update(dt);
    }
    if (this.time.now < this.caravanNextSpawnMs) return;
    if (this.caravans.filter(c => c.alive).length >= CARAVAN_CONFIG.maxActive) return;
    this.spawnCaravan();
    this.scheduleNextCaravan(false);
  }

  private acquireTarget(u: Unit, range: number): IEntity | null {
    let best: IEntity | null = null;
    let bestD = Infinity;
    for (const o of this.units) {
      if (!o.alive || o.side === u.side || o.side === SIDE.neutral) continue;
      const d = Phaser.Math.Distance.Between(u.x, u.y, o.x, o.y);
      if (d < range && d < bestD) { best = o; bestD = d; }
    }
    for (const b of this.buildings) {
      if (!b.alive || b.side === u.side) continue;
      const d = Phaser.Math.Distance.Between(u.x, u.y, b.x, b.y);
      if (d < range && d < bestD) { best = b; bestD = d; }
    }
    return best;
  }

  private assignAttackTarget(u: Unit, target: IEntity): void {
    u.state = 'attack';
    u.targetUnit = target instanceof Building ? null : target;
    u.targetBuilding = target instanceof Building ? target : null;
  }

  findNearestResource(u: Unit, type: 'gold' | 'lumber'): ResourceNode | null {
    let best: ResourceNode | null = null;
    let bestD = Infinity;
    for (const r of this.resources) {
      if (!r.alive || r.resourceType !== type) continue;
      const d = Phaser.Math.Distance.Between(u.x, u.y, r.x, r.y);
      if (d < bestD) { best = r; bestD = d; }
    }
    return best;
  }

  findNearestHall(u: Unit): Building | null {
    let best: Building | null = null;
    let bestD = Infinity;
    for (const b of this.buildings) {
      if (!b.alive || b.side !== u.side || b.buildingKind !== 'townhall' || !b.completed) continue;
      const d = Phaser.Math.Distance.Between(u.x, u.y, b.x, b.y);
      if (d < bestD) { best = b; bestD = d; }
    }
    return best;
  }

  private returnToNearestHall(u: Unit): void {
    const h = this.findNearestHall(u);
    if (!h) { u.state = 'idle'; return; }
    u.returnTo = h;
    u.state = 'return_cargo';
    this.repath(u, h.x, h.y);
  }

  private updateBuildings(dt: number): void {
    for (const b of this.buildings) {
      if (!b.alive) continue;
      b.update();
      this.tickBuildingAttack(b);
      const produced = b.tickProduction(dt);
      if (produced) this.finishProduction(b, produced);
    }
  }

  private tickBuildingAttack(b: Building): void {
    if (!b.canAttack()) return;
    const target = this.acquireBuildingTarget(b);
    if (!target) return;
    const now = this.time.now;
    if (now - b.lastAttack < b.cooldown) return;
    b.lastAttack = now;
    this.spawnProjectileFromBuilding(b, target);
  }

  private acquireBuildingTarget(b: Building): IEntity | null {
    let best: IEntity | null = null;
    let bestD = Infinity;
    for (const u of this.units) {
      if (!u.alive || u.side === b.side || u.side === SIDE.neutral) continue;
      const d = Phaser.Math.Distance.Between(b.x, b.y, u.x, u.y);
      if (d <= b.range && d < bestD) { best = u; bestD = d; }
    }
    return best;
  }

  private finishProduction(b: Building, produced: UnitKind): void {
    const def = UNIT[produced];
    if (!this.economy.hasFoodRoom(b.side, def.food)) {
      this.refund(b.side, def.cost.gold, def.cost.lumber);
      if (b.side === SIDE.player) this.flashMessage('Производство отменено: нет снабжения');
      return;
    }
    const spawnPos = this.findSpawnPoint(b);
    if (!spawnPos) {
      this.refund(b.side, def.cost.gold, def.cost.lumber);
      if (b.side === SIDE.player) this.flashMessage('Нет места для выхода юнита');
      return;
    }
    const u = this.spawnUnit(spawnPos.x, spawnPos.y, produced, b.side, b.race);
    this.effects.unitSpawn(spawnPos.x, spawnPos.y, RACE_COLOR[b.race]);
    if (b.side === SIDE.player) this.audio.play('train');
    if (b.rally) this.orderMove(u, b.rally.x, b.rally.y);
  }

  private refund(side: Side, gold: number, lumber: number): void {
    if (gold) this.economy.deposit(side, 'gold', gold);
    if (lumber) this.economy.deposit(side, 'lumber', lumber);
  }

  private findSpawnPoint(b: Building): { x: number; y: number } | null {
    const start = b.centerTile();
    for (let r = b.sizeTiles; r <= b.sizeTiles + 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = start.tx + dx, ty = start.ty + dy;
          if (!this.map.isWalkable(tx, ty)) continue;
          const p = this.map.tileToWorld(tx, ty);
          if (this.units.some(u => u.alive && Phaser.Math.Distance.Between(u.x, u.y, p.x, p.y) < u.radius + 16)) continue;
          return p;
        }
      }
    }
    const fallback = nearestReachableWalkable(this.map, start, start, 12);
    return fallback ? this.map.tileToWorld(fallback.tx, fallback.ty) : null;
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      p.update(dt);
      const tile = this.map.worldToTile(p.x, p.y);
      p.setVisible(p.side === SIDE.player || this.fog.isVisible(tile.tx, tile.ty));
    }
    this.projectiles = this.projectiles.filter(p => p.alive);
  }

  private spawnProjectile(from: Unit, to: IEntity, damage: number, splashRadius: number): void {
    const key = from.isSiege() ? 'projectile_stone' : 'projectile_arrow';
    this.projectiles.push(new Projectile(this, from.x, from.y, to, from.side, damage, splashRadius, key, from));
  }

  private spawnProjectileFromBuilding(from: Building, to: IEntity): void {
    this.projectiles.push(new Projectile(this, from.x, from.y - from.radius * 0.5, to, from.side, from.attack, 0, 'projectile_tower', from));
  }

  resolveProjectileHit(p: Projectile): void {
    if (!p.target.alive) return;
    const x = p.target.x, y = p.target.y;
    const hitVisible = this.isVisibleEntity(p.target);
    if (p.splashRadius > 0) {
      const targets = this.findSplashTargets(p.target, p.side, p.splashRadius);
      for (const target of targets) {
        const d = Phaser.Math.Distance.Between(x, y, target.x, target.y);
        const falloff = target === p.target ? 1 : Phaser.Math.Clamp(1 - d / (p.splashRadius * 1.25), 0.35, 0.65);
        const bonus = target.kind === 'building' && target === p.target ? UNIT.catapult.bonusVsBuilding : 0;
        this.dealDamage(target, Math.round((p.damage + bonus) * falloff), p.source, hitVisible);
      }
      if (hitVisible) this.effects.explosion(x, y);
    } else {
      this.dealDamage(p.target, p.damage, p.source, hitVisible);
      if (hitVisible) this.effects.projectileImpact(x, y, p.target.kind === 'building', x - p.x, y - p.y);
    }
  }

  private findSplashTargets(primary: IEntity, sourceSide: Side, radius: number): IEntity[] {
    const out: IEntity[] = [primary];
    for (const u of this.units) {
      if (!u.alive || u === primary || u.side === sourceSide || u.side === SIDE.neutral) continue;
      if (Phaser.Math.Distance.Between(primary.x, primary.y, u.x, u.y) <= radius) out.push(u);
    }
    for (const b of this.buildings) {
      if (!b.alive || b === primary || b.side === sourceSide) continue;
      if (Phaser.Math.Distance.Between(primary.x, primary.y, b.x, b.y) <= radius + b.radius * 0.4) out.push(b);
    }
    return out;
  }

  private dealDamage(target: IEntity, amount: number, from?: IEntity, show = true): void {
    if (!target.alive || amount <= 0) return;
    const wasAlive = target.alive;
    const wasBuilding = target.kind === 'building';
    const wasCaravan = target.kind === 'caravan';
    target.takeDamage(amount, from);
    if (show) {
      this.effects.hitFlash(target);
      this.effects.damageText(target.x, target.y, amount, amount >= 30);
      // Melee contact impact — only for melee (not spawned by projectile)
      if (from && from.kind === 'unit' && !(from as Unit).isRanged()) {
        this.effects.meleeImpact(target.x, target.y, wasBuilding, target.x - from.x, target.y - from.y);
      }
      this.audio.play('impact', 0.55, target.x);
    }
    if (from && target.side === SIDE.player && from.side === SIDE.ai) this.reportUnderAttack(target);
    if (wasAlive && !target.alive) {
      if (wasCaravan) this.grantCaravanLoot(target as Caravan, from, show);
      if (show) {
        if (wasBuilding) {
          this.effects.buildingDestroyed(target.x, target.y, RACE_COLOR[(target as Building).race]);
        } else {
          this.effects.deathPuff(target.x, target.y, target.side);
        }
        this.audio.play('death', 0.7, target.x);
      }
    }
  }

  private grantCaravanLoot(caravan: Caravan, from?: IEntity, show = true): void {
    const side = from?.side;
    if (side !== SIDE.player && side !== SIDE.ai) return;
    const reward = CARAVAN_CONFIG.reward;
    this.economy.deposit(side, 'gold', reward.gold);
    this.economy.deposit(side, 'lumber', reward.lumber);
    if (!show) return;
    this.effects.resourceText(caravan.x, caravan.y - 4, `+${reward.gold}G`, 'gold');
    this.effects.resourceText(caravan.x, caravan.y + 14, `+${reward.lumber}L`, 'lumber');
    this.effects.fx.goldPop(caravan.x - 10, caravan.y - 10);
    this.effects.fx.lumberChips(caravan.x + 12, caravan.y + 4);
    this.effects.fx.debrisBurst(caravan.x, caravan.y + 8);
    this.effects.fx.dustPuff(caravan.x, caravan.y + caravan.radius * 0.45, false);
    if (side === SIDE.player) this.audio.play('deposit', 0.5, caravan.x);
  }

  private reportUnderAttack(target: IEntity): void {
    if (this.time.now - this.lastUnderAttackMs < 2800) return;
    this.lastUnderAttackMs = this.time.now;
    this.flashMessage('Наши войска под атакой!');
    this.effects.alertPulse(target.x, target.y);
    this.audio.play('alert');
  }

  private combatTick(): void {
    for (const u of this.units) {
      if (!u.alive || u.state !== 'idle' || !u.canAttack()) continue;
      const t = this.acquireTarget(u, u.sight * TILE * 0.85);
      if (t) this.assignAttackTarget(u, t);
    }
  }

  private updateFog(): void {
    this.fog.dimVisible();
    for (const u of this.units) {
      if (!u.alive || u.side !== SIDE.player) continue;
      const { tx, ty } = this.map.worldToTile(u.x, u.y);
      this.fog.revealCircle(tx, ty, u.sight);
    }
    for (const b of this.buildings) {
      if (!b.alive || b.side !== SIDE.player) continue;
      const c = b.centerTile();
      this.fog.revealCircle(c.tx, c.ty, b.sight);
    }
    this.fog.redraw();
    this.applyVisibility();
  }

  private initialReveal(): void {
    for (const b of this.buildings) {
      if (b.side !== SIDE.player) continue;
      const c = b.centerTile();
      this.fog.revealCircle(c.tx, c.ty, b.sight);
    }
    for (const u of this.units) {
      if (u.side !== SIDE.player) continue;
      const { tx, ty } = this.map.worldToTile(u.x, u.y);
      this.fog.revealCircle(tx, ty, u.sight);
    }
  }

  private applyVisibility(): void {
    for (const u of this.units) {
      if (!u.alive) continue;
      const { tx, ty } = this.map.worldToTile(u.x, u.y);
      const visible = u.side === SIDE.player || this.fog.isVisible(tx, ty);
      u.sprite.setVisible(visible);
      u.hb.setVisible(visible);
    }
    for (const b of this.buildings) {
      if (!b.alive) continue;
      const c = b.centerTile();
      const explored = b.side === SIDE.player || this.fog.isExplored(c.tx, c.ty);
      const visible = b.side === SIDE.player || this.fog.isVisible(c.tx, c.ty);
      b.setVisible(explored);
      b.hb.setVisible(visible);
    }
    for (const r of this.resources) {
      if (!r.alive) continue;
      const { tx, ty } = this.map.worldToTile(r.x, r.y);
      const explored = this.fog.isExplored(tx, ty);
      r.sprite.setVisible(explored);
      r.hb.setVisible(explored);
    }
    for (const c of this.caravans) {
      if (!c.alive) continue;
      const { tx, ty } = this.map.worldToTile(c.x, c.y);
      c.setVisible(this.fog.isVisible(tx, ty));
    }
  }

  private isVisibleEntity(e: IEntity): boolean {
    if (e.side === SIDE.player) return true;
    const { tx, ty } = this.map.worldToTile(e.x, e.y);
    return this.fog.isVisible(tx, ty);
  }

  private pruneDead(): void {
    const deadUnits = this.units.filter(u => !u.alive);
    if (deadUnits.length > 0) {
      const deadUnitIds = new Set(deadUnits.map(u => u.id));
      for (const u of deadUnits) this.economy.removeFood(u.side, u.food);
      this.units = this.units.filter(u => u.alive);

      let selectionChanged = false;
      const selectedCount = this.selected.length;
      this.selected = this.selected.filter(u => u.alive);
      if (this.selected.length !== selectedCount) selectionChanged = true;

      for (const key of Object.keys(this.controlGroups)) {
        const groupId = Number(key);
        const group = this.controlGroups[groupId];
        const aliveGroup = group.filter(u => u.alive);
        if (aliveGroup.length > 0) this.controlGroups[groupId] = aliveGroup;
        else delete this.controlGroups[groupId];
      }

      for (const u of this.units) {
        if (u.targetUnit && deadUnitIds.has(u.targetUnit.id)) u.targetUnit = null;
      }

      for (const r of this.selectionRings) {
        const u = r.getData('follow') as Unit | undefined;
        if (!u || deadUnitIds.has(u.id) || !u.alive) r.destroy();
      }
      this.selectionRings = this.selectionRings.filter(r => r.active);

      if (selectionChanged) this.game.events.emit('selection-changed', { units: this.selected, building: this.selectedBuilding });
    }

    const deadCaravans = this.caravans.filter(c => !c.alive);
    if (deadCaravans.length > 0) {
      const deadCaravanIds = new Set(deadCaravans.map(c => c.id));
      this.caravans = this.caravans.filter(c => c.alive);
      for (const u of this.units) {
        if (u.targetUnit && deadCaravanIds.has(u.targetUnit.id)) u.targetUnit = null;
      }
    }

    this.buildings = this.buildings.filter(b => {
      if (!b.alive) {
        const def = BUILDING[b.buildingKind];
        if ((b.buildingKind === 'townhall' || b.buildingKind === 'farm') && b.completed) this.economy.removeCap(b.side, def.food);
        for (let dy = 0; dy < b.sizeTiles; dy++) for (let dx = 0; dx < b.sizeTiles; dx++) this.map.setWalkable(b.tx + dx, b.ty + dy, true);
        return false;
      }
      return true;
    });
    this.resources = this.resources.filter(r => r.alive);

    if (this.hoveredEntity && !this.hoveredEntity.alive) this.emitEntityHover(null);
  }

  private checkVictory(): void {
    const playerHasBase = this.buildings.some(b => b.alive && b.side === SIDE.player);
    const aiHasBase = this.buildings.some(b => b.alive && b.side === SIDE.ai);
    if (!aiHasBase && playerHasBase) this.endGame(true);
    else if (!playerHasBase && aiHasBase) this.endGame(false);
  }

  private endGame(win: boolean): void {
    if (this.gameOver) return;
    this.gameOver = true;
    const color = win ? 0x44ff88 : 0xff4444;
    const mid = this.cameras.main.midPoint;
    this.effects.shockwave(mid.x, mid.y, color);
    this.cameras.main.flash(500, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
    this.cameras.main.shake(700, 0.012);
    this.audio.play(win ? 'victory' : 'defeat', 1);
    this.tweens.timeScale = 0.35;
    window.setTimeout(() => {
      this.tweens.timeScale = 1;
      this.game.events.emit('game-over', win);
    }, 1400);
  }

  private flashMessage(text: string): void {
    this.game.events.emit('flash-message', text);
  }

  private drawRally(): void {
    this.rallyGraphics.clear();
    const b = this.selectedBuilding;
    if (!b || !b.rally || !b.completed) return;
    this.rallyGraphics.lineStyle(2, 0xffffff, 0.55);
    this.rallyGraphics.lineBetween(b.x, b.y, b.rally.x, b.rally.y);
    this.rallyGraphics.fillStyle(RACE_COLOR[b.race], 1);
    this.rallyGraphics.fillTriangle(b.rally.x, b.rally.y - 16, b.rally.x + 12, b.rally.y - 10, b.rally.x, b.rally.y - 4);
    this.rallyGraphics.lineStyle(2, 0x111111, 1);
    this.rallyGraphics.lineBetween(b.rally.x, b.rally.y - 16, b.rally.x, b.rally.y + 12);
  }
}

class Projectile {
  sprite: Phaser.GameObjects.Sprite;
  alive = true;
  speed: number;
  private trailMs = 0;
  private trailKind: 'arrow' | 'siege' | 'magic';

  constructor(
    private scene: GameScene,
    x: number,
    y: number,
    public target: IEntity,
    public side: Side,
    public damage: number,
    public splashRadius: number,
    texture: string,
    public source?: IEntity
  ) {
    this.sprite = scene.add.sprite(x, y, texture).setDepth(40);
    this.speed = splashRadius > 0 ? 280 : 430;
    this.trailKind = splashRadius > 0 ? 'siege' : texture === 'projectile_tower' ? 'magic' : 'arrow';
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  update(dt: number): void {
    if (!this.alive) return;
    if (!this.target.alive) { this.destroy(); return; }
    const dx = this.target.x - this.sprite.x;
    const dy = this.target.y - this.sprite.y;
    const d = Math.hypot(dx, dy);
    const step = (this.speed * dt) / 1000;
    this.trailMs += dt;
    if (this.trailMs > VISUALS.projectileTrailMs && this.sprite.visible) {
      this.trailMs = 0;
      this.scene.effects.projectileTrail(this.sprite.x, this.sprite.y, this.sprite.rotation, this.trailKind);
    }
    if (d <= step + 3) {
      this.scene.resolveProjectileHit(this);
      this.destroy();
      return;
    }
    this.sprite.x += (dx / d) * step;
    this.sprite.y += (dy / d) * step;
    this.sprite.rotation = Math.atan2(dy, dx);
  }

  setVisible(v: boolean): void { this.sprite.setVisible(v); }

  destroy(): void {
    if (!this.alive) return;
    this.sprite.destroy();
    this.alive = false;
  }
}
