import Phaser from 'phaser';
import type { BuildingKind, Race, UnitKind } from '../config';

export type UnitFacing = 'south' | 'east' | 'north' | 'west';
export type UnitAnimState = 'idle' | 'walk' | 'attack' | 'death' | 'work';
export type FutureUnitAnimState = Exclude<UnitAnimState, 'work'>;
export type BuildingStage = 'stage1' | 'stage2' | 'final' | 'destroying' | 'ruin';

export const UNIT_FACINGS: readonly UnitFacing[] = ['south', 'east', 'north', 'west'];
export const UNIT_ANIM_STATES: readonly UnitAnimState[] = ['idle', 'walk', 'attack', 'death', 'work'];
export const BUILDING_STAGES: readonly BuildingStage[] = ['stage1', 'stage2', 'final', 'destroying', 'ruin'];

export interface DisplaySize {
  width: number;
  height: number;
}

export interface ArtImageAsset {
  type: 'image';
  key: string;
  path: string;
}

export interface ArtSheetAsset {
  type: 'spritesheet';
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  margin?: number;
  spacing?: number;
}

export type ArtAsset = ArtImageAsset | ArtSheetAsset;

export interface UnitSheetAsset extends ArtSheetAsset {
  group: 'unit';
  race: Race;
  unitKind: UnitKind;
  anim: UnitAnimState;
  framesPerFacing: number;
  fps: number;
  repeat: number;
  display: DisplaySize;
  origin: { x: number; y: number };
}

export interface FutureUnitSheetAsset extends ArtSheetAsset {
  group: 'future-unit';
  unitKey: 'caravan';
  anim: FutureUnitAnimState;
  framesPerFacing: number;
  fps: number;
  repeat: number;
  display: DisplaySize;
  origin: { x: number; y: number };
}

export interface BuildingSheetAsset extends ArtSheetAsset {
  group: 'building';
  race: Race;
  buildingKind: BuildingKind;
  display: DisplaySize;
  origin: { x: number; y: number };
}

export interface RuntimeArtManifest {
  version: 1;
  /**
   * Keep false while assets are incomplete. When true, every asset in this
   * manifest is loaded and missing files will surface as loader errors.
   */
  loadAll?: boolean;
  /**
   * Keys from ART_ASSETS to load. This is the safe default path while sprite
   * sheets are generated in batches.
   */
  enabledKeys?: string[];
}

const RACES: readonly Race[] = ['alliance', 'horde'];
const UNIT_KINDS: readonly UnitKind[] = ['worker', 'footman', 'archer', 'knight', 'catapult'];
const BUILDING_KINDS: readonly BuildingKind[] = ['townhall', 'farm', 'barracks', 'workshop', 'tower'];

const UNIT_ANIM_META: Record<UnitAnimState, { frames: number; fps: number; repeat: number }> = {
  idle: { frames: 4, fps: 5, repeat: -1 },
  walk: { frames: 8, fps: 10, repeat: -1 },
  attack: { frames: 6, fps: 12, repeat: 0 },
  death: { frames: 8, fps: 10, repeat: 0 },
  work: { frames: 6, fps: 10, repeat: 0 }
};

export const UNIT_ART_DISPLAY: Record<UnitKind, DisplaySize> = {
  worker: { width: 40, height: 40 },
  footman: { width: 44, height: 44 },
  archer: { width: 44, height: 44 },
  knight: { width: 52, height: 52 },
  catapult: { width: 48, height: 48 }
};

export const CARAVAN_ART_DISPLAY: DisplaySize = { width: 96, height: 64 };
export const CARAVAN_ART_FRAME: DisplaySize = { width: 192, height: 128 };

export const BUILDING_ART_DISPLAY: Record<BuildingKind, DisplaySize> = {
  townhall: { width: 144, height: 144 },
  farm: { width: 96, height: 96 },
  barracks: { width: 144, height: 144 },
  workshop: { width: 144, height: 144 },
  tower: { width: 128, height: 128 }
};

export const BUILDING_ART_FRAME: Record<BuildingKind, DisplaySize> = {
  townhall: { width: 192, height: 192 },
  farm: { width: 128, height: 128 },
  barracks: { width: 192, height: 192 },
  workshop: { width: 192, height: 192 },
  tower: { width: 128, height: 128 }
};

export function unitSheetKey(kind: UnitKind, race: Race, anim: UnitAnimState): string {
  return `art_unit_${kind}_${race}_${anim}`;
}

export function unitAnimKey(kind: UnitKind, race: Race, anim: UnitAnimState, facing: UnitFacing): string {
  return `${unitSheetKey(kind, race, anim)}_${facing}`;
}

export function caravanSheetKey(anim: FutureUnitAnimState): string {
  return `art_unit_caravan_neutral_${anim}`;
}

export function caravanAnimKey(anim: FutureUnitAnimState, facing: UnitFacing): string {
  return `${caravanSheetKey(anim)}_${facing}`;
}

export function buildingSheetKey(kind: BuildingKind, race: Race): string {
  return `art_building_${kind}_${race}`;
}

export function buildingDamageKey(kind: BuildingKind, race: Race): string {
  return `art_building_${kind}_${race}_damage`;
}

export function buildingDestructionKey(kind: BuildingKind, race: Race): string {
  return `art_building_${kind}_${race}_destruction`;
}

export function legacyBuildingStageKey(kind: BuildingKind, race: Race, stage: Exclude<BuildingStage, 'ruin'>): string {
  if (stage === 'final') return `building_${kind}_${race}`;
  return `building_${kind}_${race}_${stage}`;
}

export const UNIT_SHEET_ASSETS: UnitSheetAsset[] = RACES.flatMap((race) =>
  UNIT_KINDS.flatMap((unitKind) =>
    UNIT_ANIM_STATES
      .filter((anim) => unitKind === 'worker' || anim !== 'work')
      .map((anim) => {
        const meta = UNIT_ANIM_META[anim];
        return {
          type: 'spritesheet' as const,
          group: 'unit' as const,
          key: unitSheetKey(unitKind, race, anim),
          path: `assets/art/units/${race}/${unitKind}_${anim}.png`,
          frameWidth: 128,
          frameHeight: 128,
          race,
          unitKind,
          anim,
          framesPerFacing: meta.frames,
          fps: meta.fps,
          repeat: meta.repeat,
          display: UNIT_ART_DISPLAY[unitKind],
          origin: { x: 0.5, y: 0.58 }
        };
      })
  )
);

export const FUTURE_UNIT_SHEET_ASSETS: FutureUnitSheetAsset[] = UNIT_ANIM_STATES
  .filter((anim): anim is FutureUnitAnimState => anim !== 'work')
  .map((anim) => {
    const meta = UNIT_ANIM_META[anim];
    return {
      type: 'spritesheet' as const,
      group: 'future-unit' as const,
      key: caravanSheetKey(anim),
      path: `assets/art/future/caravan_${anim}.png`,
      frameWidth: CARAVAN_ART_FRAME.width,
      frameHeight: CARAVAN_ART_FRAME.height,
      unitKey: 'caravan',
      anim,
      framesPerFacing: meta.frames,
      fps: meta.fps,
      repeat: meta.repeat,
      display: CARAVAN_ART_DISPLAY,
      origin: { x: 0.5, y: 0.62 }
    };
  });

export const BUILDING_SHEET_ASSETS: BuildingSheetAsset[] = RACES.flatMap((race) =>
  BUILDING_KINDS.map((buildingKind) => ({
    type: 'spritesheet' as const,
    group: 'building' as const,
    key: buildingSheetKey(buildingKind, race),
    path: `assets/art/buildings/${race}/${buildingKind}.png`,
    frameWidth: BUILDING_ART_FRAME[buildingKind].width,
    frameHeight: BUILDING_ART_FRAME[buildingKind].height,
    race,
    buildingKind,
    display: BUILDING_ART_DISPLAY[buildingKind],
    origin: { x: 0.5, y: 0.5 }
  }))
);

export const BUILDING_DAMAGE_ASSETS: ArtImageAsset[] = RACES.flatMap((race) =>
  BUILDING_KINDS.map((buildingKind) => ({
    type: 'image' as const,
    key: buildingDamageKey(buildingKind, race),
    path: `assets/art/buildings/${race}/${buildingKind}_damage.png`
  }))
);

export const BUILDING_DESTRUCTION_ASSETS: ArtImageAsset[] = RACES.flatMap((race) =>
  BUILDING_KINDS.map((buildingKind) => ({
    type: 'image' as const,
    key: buildingDestructionKey(buildingKind, race),
    path: `assets/art/buildings/${race}/${buildingKind}_destruction.png`
  }))
);

export const STATIC_ART_ASSETS: ArtImageAsset[] = [
  { type: 'image', key: 'tile_grass', path: 'assets/art/terrain/tile_grass.png' },
  { type: 'image', key: 'tile_grass2', path: 'assets/art/terrain/tile_grass2.png' },
  { type: 'image', key: 'tile_forest', path: 'assets/art/terrain/tile_forest.png' },
  { type: 'image', key: 'tile_stone', path: 'assets/art/terrain/tile_stone.png' },
  { type: 'image', key: 'tile_dirt', path: 'assets/art/terrain/tile_dirt.png' },
  { type: 'image', key: 'tile_water', path: 'assets/art/terrain/tile_water_0.png' },
  { type: 'image', key: 'tile_water_0', path: 'assets/art/terrain/tile_water_0.png' },
  { type: 'image', key: 'tile_water_1', path: 'assets/art/terrain/tile_water_1.png' },
  { type: 'image', key: 'tile_water_2', path: 'assets/art/terrain/tile_water_2.png' },
  { type: 'image', key: 'tile_water_3', path: 'assets/art/terrain/tile_water_3.png' },
  { type: 'image', key: 'tree', path: 'assets/art/resources/tree.png' },
  { type: 'image', key: 'tree_trunk', path: 'assets/art/resources/tree_trunk.png' },
  { type: 'image', key: 'tree_canopy', path: 'assets/art/resources/tree_canopy.png' },
  { type: 'image', key: 'goldmine', path: 'assets/art/resources/goldmine.png' },
  { type: 'image', key: 'goldmine_damaged', path: 'assets/art/resources/goldmine_damaged.png' },
  { type: 'image', key: 'goldmine_depleted', path: 'assets/art/resources/goldmine_depleted.png' },
  { type: 'image', key: 'tree_stump', path: 'assets/art/resources/tree_stump.png' },
  { type: 'image', key: 'tree_log', path: 'assets/art/resources/tree_log.png' },
  { type: 'image', key: 'projectile_arrow', path: 'assets/art/fx/projectile_arrow.png' },
  { type: 'image', key: 'projectile_stone', path: 'assets/art/fx/projectile_stone.png' },
  { type: 'image', key: 'projectile_tower', path: 'assets/art/fx/projectile_tower.png' },
  { type: 'image', key: 'px_smoke_light', path: 'assets/art/fx/px_smoke_light.png' },
  { type: 'image', key: 'px_smoke_dark', path: 'assets/art/fx/px_smoke_dark.png' },
  { type: 'image', key: 'px_dust', path: 'assets/art/fx/px_dust.png' },
  { type: 'image', key: 'px_mist', path: 'assets/art/fx/px_mist.png' },
  { type: 'image', key: 'px_glow', path: 'assets/art/fx/px_glow.png' },
  { type: 'image', key: 'px_ember', path: 'assets/art/fx/px_ember.png' },
  { type: 'image', key: 'px_rune', path: 'assets/art/fx/px_rune.png' },
  { type: 'image', key: 'px_crater', path: 'assets/art/fx/px_crater.png' },
  { type: 'image', key: 'px_arrow_trail', path: 'assets/art/fx/px_arrow_trail.png' },
  { type: 'image', key: 'px_spark', path: 'assets/art/fx/px_spark.png' },
  { type: 'image', key: 'px_flame', path: 'assets/art/fx/px_flame.png' },
  { type: 'image', key: 'px_blood', path: 'assets/art/fx/px_blood.png' },
  { type: 'image', key: 'px_leaf', path: 'assets/art/fx/px_leaf.png' },
  { type: 'image', key: 'px_star', path: 'assets/art/fx/px_star.png' },
  { type: 'image', key: 'px_debris_1', path: 'assets/art/fx/px_debris_1.png' },
  { type: 'image', key: 'px_debris_2', path: 'assets/art/fx/px_debris_2.png' },
  { type: 'image', key: 'px_debris_3', path: 'assets/art/fx/px_debris_3.png' },
  { type: 'image', key: 'px_shockwave', path: 'assets/art/fx/px_shockwave.png' },
  { type: 'image', key: 'cursor_default', path: 'assets/art/ui/cursor_default.png' },
  { type: 'image', key: 'cursor_attack', path: 'assets/art/ui/cursor_attack.png' },
  { type: 'image', key: 'cursor_build_ok', path: 'assets/art/ui/cursor_build_ok.png' },
  { type: 'image', key: 'cursor_build_no', path: 'assets/art/ui/cursor_build_no.png' },
  { type: 'image', key: 'cursor_gather', path: 'assets/art/ui/cursor_gather.png' },
  { type: 'image', key: 'ring_select_s', path: 'assets/art/ui/ring_select_s.png' },
  { type: 'image', key: 'ring_select_m', path: 'assets/art/ui/ring_select_m.png' },
  { type: 'image', key: 'ring_select_l', path: 'assets/art/ui/ring_select_l.png' },
  { type: 'image', key: 'ui_panel_frame', path: 'assets/art/ui/panel_frame.png' },
  { type: 'image', key: 'ui_tooltip_frame', path: 'assets/art/ui/tooltip_frame.png' },
  { type: 'image', key: 'ui_minimap_frame', path: 'assets/art/ui/minimap_frame.png' },
  { type: 'image', key: 'menu_background_map', path: 'assets/art/menu/background_map.png' },
  { type: 'image', key: 'menu_intro_alliance', path: 'assets/art/menu/intro_alliance.png' },
  { type: 'image', key: 'menu_intro_horde', path: 'assets/art/menu/intro_horde.png' },
  { type: 'image', key: 'icon_stop', path: 'assets/art/ui/icons/stop.png' },
  { type: 'image', key: 'icon_attack_move', path: 'assets/art/ui/icons/attack_move.png' },
  { type: 'image', key: 'icon_build', path: 'assets/art/ui/icons/build.png' },
  { type: 'image', key: 'icon_repair', path: 'assets/art/ui/icons/repair.png' },
  { type: 'image', key: 'icon_rally', path: 'assets/art/ui/icons/rally.png' },
  { type: 'image', key: 'icon_worker', path: 'assets/art/ui/icons/worker.png' },
  { type: 'image', key: 'icon_footman', path: 'assets/art/ui/icons/footman.png' },
  { type: 'image', key: 'icon_archer', path: 'assets/art/ui/icons/archer.png' },
  { type: 'image', key: 'icon_knight', path: 'assets/art/ui/icons/knight.png' },
  { type: 'image', key: 'icon_catapult', path: 'assets/art/ui/icons/catapult.png' },
  { type: 'image', key: 'icon_return_cargo', path: 'assets/art/ui/icons/return_cargo.png' },
  { type: 'image', key: 'icon_gather_gold', path: 'assets/art/ui/icons/gather_gold.png' },
  { type: 'image', key: 'icon_gather_lumber', path: 'assets/art/ui/icons/gather_lumber.png' },
  { type: 'image', key: 'icon_patrol', path: 'assets/art/ui/icons/patrol.png' },
  { type: 'image', key: 'icon_hold_position', path: 'assets/art/ui/icons/hold_position.png' },
  { type: 'image', key: 'icon_autopilot', path: 'assets/art/ui/icons/autopilot.png' },
  { type: 'image', key: 'icon_formation', path: 'assets/art/ui/icons/formation.png' },
  { type: 'image', key: 'icon_support', path: 'assets/art/ui/icons/support.png' },
  { type: 'image', key: 'icon_gold', path: 'assets/art/ui/icons/gold.png' },
  { type: 'image', key: 'icon_lumber', path: 'assets/art/ui/icons/lumber.png' }
];

export const ART_ASSETS: ArtAsset[] = [
  ...UNIT_SHEET_ASSETS,
  ...FUTURE_UNIT_SHEET_ASSETS,
  ...BUILDING_SHEET_ASSETS,
  ...BUILDING_DAMAGE_ASSETS,
  ...BUILDING_DESTRUCTION_ASSETS,
  ...STATIC_ART_ASSETS
];

export const ART_ASSET_BY_KEY = new Map(ART_ASSETS.map((asset) => [asset.key, asset]));

export const ART_RUNTIME_MANIFEST_KEY = 'art-runtime-manifest';

export function artAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function resolveEnabledArtAssets(runtime: RuntimeArtManifest | null | undefined): ArtAsset[] {
  if (!runtime) return [];
  if (runtime.loadAll) return ART_ASSETS;
  const enabled = new Set(runtime.enabledKeys ?? []);
  if (enabled.size === 0) return [];
  return ART_ASSETS.filter((asset) => enabled.has(asset.key));
}

export function getUnitFacingFromVector(dx: number, dy: number, fallback: UnitFacing): UnitFacing {
  if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return fallback;
  if (Math.abs(dx) > Math.abs(dy)) return dx >= 0 ? 'east' : 'west';
  return dy >= 0 ? 'south' : 'north';
}

export function unitArtReady(scene: Phaser.Scene, kind: UnitKind, race: Race): boolean {
  const required: UnitAnimState[] = kind === 'worker'
    ? ['idle', 'walk', 'attack', 'death', 'work']
    : ['idle', 'walk', 'attack', 'death'];
  return required.every((anim) => scene.textures.exists(unitSheetKey(kind, race, anim)));
}

export function unitAnimReady(scene: Phaser.Scene, kind: UnitKind, race: Race, anim: UnitAnimState): boolean {
  return scene.textures.exists(unitSheetKey(kind, race, anim));
}

export function caravanArtReady(scene: Phaser.Scene): boolean {
  const required: FutureUnitAnimState[] = ['idle', 'walk', 'death'];
  return required.every((anim) => scene.textures.exists(caravanSheetKey(anim)));
}

export function caravanAnimReady(scene: Phaser.Scene, anim: FutureUnitAnimState): boolean {
  return scene.textures.exists(caravanSheetKey(anim));
}

export function buildingArtReady(scene: Phaser.Scene, kind: BuildingKind, race: Race): boolean {
  return scene.textures.exists(buildingSheetKey(kind, race));
}

export function getBuildingStageFrame(stage: BuildingStage): number {
  return BUILDING_STAGES.indexOf(stage);
}
