import Phaser from 'phaser';
import { TILE, COLORS, Race, RACE_COLOR, UNIT_KINDS, BUILDING_KINDS, UnitKind, BuildingKind, VIEW_W, VIEW_H } from '../config';

type G = Phaser.GameObjects.Graphics;

const OUTLINE = 0x1a1410;
const OUTLINE_SOFT = 0x2a1f18;
const RIM_LIGHT = 0xfff0c0;

const ALLIANCE_TRIM = 0xf4d078;
const ALLIANCE_SKIN = 0xf0cfa2;
const ALLIANCE_CLOAK = 0x2b4e8a;

const HORDE_TRIM = 0x2a1612;
const HORDE_SKIN = 0x7fb457;
const HORDE_CLOAK = 0x3a120c;

const METAL = 0xc6ccd2;
const METAL_LIGHT = 0xe8ecef;
const METAL_DARK = 0x4e555b;

const LEATHER = 0x6d4720;
const LEATHER_DARK = 0x3a2311;
const WOOD = 0x8a5a2a;
const WOOD_DARK = 0x4a2e10;
const WOOD_LIGHT = 0xb88148;

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create(): void {
    this.makeTerrainTiles();
    this.makeWaterFrames();
    this.makeDecals();
    this.makeTrees();
    this.makeGoldMine();

    this.makeShadows();
    for (const race of ['alliance', 'horde'] as Race[]) {
      for (const kind of UNIT_KINDS) this.makeUnit(kind, race);
      for (const kind of UNIT_KINDS) this.makeWeapon(kind, race);
      for (const kind of BUILDING_KINDS) {
        this.makeBuilding(kind, race, 'final');
        this.makeBuilding(kind, race, 'stage1');
        this.makeBuilding(kind, race, 'stage2');
        this.makeBuildingDamaged(kind, race);
      }
    }

    this.makeProjectile('projectile_arrow', 0xffe08a, 0xb3832b, 14, 2);
    this.makeStoneProjectile('projectile_stone');
    this.makeMagicProjectile('projectile_tower', 0x99ddff, 0x3a78a8);

    this.makeParticleTextures();
    this.makeCursors();
    this.makeVignette();

    this.makePixel();
    this.makeSelectionRing('ring8', 8);
    this.makeSelectionRing('ring12', 12);
    this.makeSelectionRing('ring16', 16);
    this.makeSelectionRing('ring24', 24);
    this.makeSelectionRing('ring48', 48);
    this.makeSelectionRing('ring_select_s', 14);
    this.makeSelectionRing('ring_select_m', 18);
    this.makeSelectionRing('ring_select_l', 26);

    this.scene.start('MenuScene');
  }

  // ---------------- TERRAIN TILES ----------------

  private makeTerrainTiles(): void {
    this.makeGrassTile('tile_grass', 0x2f5627, 0x4d7a3b, 0x172b18);
    this.makeGrassTile('tile_grass2', 0x3a6730, 0x5b8c42, 0x20381d);
    this.makeDirtTile();
    this.makeForestTile();
    this.makeStoneTile();
  }

  private makeGrassTile(key: string, base: number, light: number, dark: number): void {
    const g = this.add.graphics();
    g.fillStyle(base, 1);
    g.fillRect(0, 0, TILE, TILE);

    // Large warm blotches (low-freq noise)
    for (let i = 0; i < 4; i++) {
      g.fillStyle(light, 0.35);
      g.fillEllipse(Math.random() * TILE, Math.random() * TILE, 10 + Math.random() * 8, 6 + Math.random() * 4);
    }
    for (let i = 0; i < 4; i++) {
      g.fillStyle(dark, 0.22);
      g.fillEllipse(Math.random() * TILE, Math.random() * TILE, 9 + Math.random() * 7, 5 + Math.random() * 4);
    }

    // Grass blade tufts (short strokes, not primitives)
    g.lineStyle(1, light, 0.7);
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * TILE;
      const y = Math.random() * TILE;
      const h = 1.5 + Math.random() * 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (Math.random() - 0.5), y - h);
      g.strokePath();
    }

    // Dark fantasy ground veins and damp patches.
    g.lineStyle(1, dark, 0.28);
    for (let i = 0; i < 3; i++) {
      const x = Math.random() * TILE;
      const y = Math.random() * TILE;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 5 + Math.random() * 8, y + (Math.random() - 0.5) * 5);
      g.lineTo(x + 9 + Math.random() * 8, y + 4 + (Math.random() - 0.5) * 6);
      g.strokePath();
    }
    g.fillStyle(0x08120c, 0.16);
    for (let i = 0; i < 4; i++) {
      g.fillEllipse(Math.random() * TILE, Math.random() * TILE, 5 + Math.random() * 8, 2 + Math.random() * 4);
    }

    // Subtle tile edge for depth
    g.fillStyle(dark, 0.22);
    g.fillRect(0, TILE - 1, TILE, 1);
    g.fillStyle(light, 0.15);
    g.fillRect(0, 0, TILE, 1);

    g.generateTexture(key, TILE, TILE);
    g.destroy();
  }

  private makeDirtTile(): void {
    const g = this.add.graphics();
    g.fillStyle(COLORS.dirt, 1);
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x20170f, 0.24);
    g.fillRect(0, 0, TILE, TILE);

    // Cobble/path stones — rounded irregular shapes
    const stones = [
      { x: 6, y: 6, w: 10, h: 7 },
      { x: 20, y: 4, w: 8, h: 6 },
      { x: 4, y: 18, w: 8, h: 8 },
      { x: 16, y: 18, w: 12, h: 10 },
      { x: 24, y: 24, w: 6, h: 5 },
    ];
    for (const s of stones) {
      g.fillStyle(0x4a3a22, 1);
      g.fillRoundedRect(s.x - 0.5, s.y - 0.5 + 1, s.w + 1, s.h + 1, 2);
      g.fillStyle(0x8b7348, 1);
      g.fillRoundedRect(s.x, s.y, s.w, s.h, 2);
      g.fillStyle(0xa99260, 0.6);
      g.fillRoundedRect(s.x + 1, s.y + 1, Math.max(1, s.w - 3), Math.max(1, s.h - 4), 1.5);
    }

    g.fillStyle(0x2a1f12, 0.5);
    for (let i = 0; i < 10; i++) {
      g.fillCircle(Math.random() * TILE, Math.random() * TILE, 0.5);
    }

    g.generateTexture('tile_dirt', TILE, TILE);
    g.destroy();
  }

  private makeForestTile(): void {
    const g = this.add.graphics();
    // Underlying grass
    g.fillStyle(0x355d2a, 1); g.fillRect(0, 0, TILE, TILE);
    g.fillStyle(0x436f32, 0.5);
    g.fillEllipse(10, 8, 14, 8);
    g.fillEllipse(22, 22, 14, 8);

    // Three tree crowns seen from above (but tile shows trees partially — crown shapes)
    const crowns = [
      { x: 9, y: 9, r: 7 },
      { x: 22, y: 11, r: 8 },
      { x: 14, y: 24, r: 7 },
    ];

    // Soft drop shadows
    for (const c of crowns) {
      g.fillStyle(0x000000, 0.35);
      g.fillEllipse(c.x + 2, c.y + c.r - 1, c.r * 2, c.r);
    }
    // Dark crown base
    for (const c of crowns) {
      g.fillStyle(COLORS.forestDark, 1);
      g.fillCircle(c.x, c.y, c.r);
    }
    // Crown highlight (scalloped)
    for (const c of crowns) {
      g.fillStyle(COLORS.forest, 1);
      g.fillCircle(c.x - c.r * 0.25, c.y - c.r * 0.3, c.r * 0.65);
      g.fillStyle(0x2d6b3a, 0.9);
      g.fillCircle(c.x - c.r * 0.4, c.y - c.r * 0.45, c.r * 0.3);
    }

    g.generateTexture('tile_forest', TILE, TILE);
    g.destroy();
  }

  private makeStoneTile(): void {
    const g = this.add.graphics();
    g.fillStyle(0x54595d, 1);
    g.fillRect(0, 0, TILE, TILE);

    // Irregular rocks — composed polygons, not primitive circles
    this.drawRock(g, 8, 10, 10, 0x74797d, 0x40454a);
    this.drawRock(g, 22, 18, 8, 0x6b7075, 0x3a3f44);
    this.drawRock(g, 14, 24, 6, 0x80858a, 0x484d52);
    this.drawRock(g, 26, 6, 5, 0x70757a, 0x3f4449);

    // Gravel
    g.fillStyle(0x333739, 0.7);
    for (let i = 0; i < 14; i++) {
      g.fillCircle(Math.random() * TILE, Math.random() * TILE, 0.6);
    }

    g.generateTexture('tile_stone', TILE, TILE);
    g.destroy();
  }

  private drawRock(g: G, cx: number, cy: number, size: number, light: number, dark: number): void {
    const pts: { x: number; y: number }[] = [];
    const sides = 6;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2;
      const r = size * (0.7 + Math.random() * 0.4);
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.85 });
    }
    // Shadow
    g.fillStyle(0x000000, 0.5);
    g.beginPath(); g.moveTo(pts[0].x + 1.5, pts[0].y + 2);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x + 1.5, pts[i].y + 2);
    g.closePath(); g.fillPath();

    // Base
    g.fillStyle(dark, 1);
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath(); g.fillPath();

    // Top highlight (only upper half points)
    g.fillStyle(light, 1);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < Math.ceil(pts.length / 2) + 1; i++) g.lineTo(pts[i].x, pts[i].y);
    g.lineTo(cx, cy);
    g.closePath(); g.fillPath();

    // Outline
    g.lineStyle(1, OUTLINE, 0.5);
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath(); g.strokePath();
  }

  private makeWaterFrames(): void {
    // 4 phase-shifted water frames for animated cycling
    for (let f = 0; f < 4; f++) {
      const g = this.add.graphics();
    g.fillStyle(COLORS.water, 1);
      g.fillRect(0, 0, TILE, TILE);
      // Gradient darker at bottom
      g.fillStyle(0x071827, 0.72);
      g.fillRect(0, TILE - 10, TILE, 10);

      // Wave crests — curves
      const shift = (f * TILE) / 4;
      g.lineStyle(2, COLORS.waterLight, 0.85);
      for (let yi = 0; yi < 3; yi++) {
        const y = 6 + yi * 10;
        g.beginPath();
        for (let x = 0; x <= TILE; x += 2) {
          const yy = y + Math.sin((x + shift + yi * 7) / 4) * 1.2;
          if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
        }
        g.strokePath();
      }
      g.lineStyle(1, 0xd8f4ff, 0.22);
      g.beginPath();
      g.moveTo((f * 7) % TILE, 3);
      g.lineTo(((f * 7) % TILE) + 9, 4);
      g.strokePath();
      // Sparkle glints
      g.fillStyle(0xffffff, 0.7);
      const glints = [
        { x: (6 + shift) % TILE, y: 8 },
        { x: (18 + shift) % TILE, y: 18 },
        { x: (26 + shift) % TILE, y: 26 },
      ];
      for (const p of glints) {
        g.fillEllipse(p.x, p.y, 3, 1);
      }

      g.generateTexture(`tile_water_${f}`, TILE, TILE);
      if (f === 0) g.generateTexture('tile_water', TILE, TILE); // legacy key
      g.destroy();
    }
  }

  // ---------------- DECALS (scattered decorations) ----------------

  private makeDecals(): void {
    // Flowers (small, with stem + petals)
    const flowerColors = [0xffd86a, 0xff7a88, 0xb86aff, 0xfff2a0, 0xff9a44];
    flowerColors.forEach((c, i) => this.makeFlower(`decal_flower_${i}`, c));

    // Pebbles
    this.makePebble('decal_pebble_0', 0x8a8175);
    this.makePebble('decal_pebble_1', 0xa89c86);

    // Twig
    this.makeTwig('decal_twig');

    // Mushroom
    this.makeMushroom('decal_mushroom_0', 0xc83838, 0xffffff);
    this.makeMushroom('decal_mushroom_1', 0xe89040, 0xf8e8d0);

    // Grass tuft
    this.makeGrassTuft('decal_tuft_0', 0x72a648);
    this.makeGrassTuft('decal_tuft_1', 0x5a8a3a);
  }

  private makeFlower(key: string, petal: number): void {
    const g = this.add.graphics();
    const cx = 5, cy = 5;
    // Stem
    g.lineStyle(1, 0x2a5a28, 1);
    g.beginPath(); g.moveTo(cx, cy + 3); g.lineTo(cx, cy + 1); g.strokePath();
    // Petals (4 ellipses around center)
    g.fillStyle(petal, 1);
    g.fillEllipse(cx - 2, cy, 2, 2);
    g.fillEllipse(cx + 2, cy, 2, 2);
    g.fillEllipse(cx, cy - 2, 2, 2);
    g.fillEllipse(cx, cy + 1, 2, 2);
    // Center
    g.fillStyle(0xffefa0, 1); g.fillCircle(cx, cy, 1);
    g.generateTexture(key, 10, 10);
    g.destroy();
  }

  private makePebble(key: string, c: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.4); g.fillEllipse(4, 5, 6, 2);
    g.fillStyle(c, 1); g.fillEllipse(4, 4, 5, 3);
    const lc = Phaser.Display.Color.ValueToColor(c).lighten(20).color;
    g.fillStyle(lc, 0.7); g.fillEllipse(3.5, 3.5, 3, 1.5);
    g.generateTexture(key, 8, 8);
    g.destroy();
  }

  private makeTwig(key: string): void {
    const g = this.add.graphics();
    g.lineStyle(2, WOOD_DARK, 1);
    g.beginPath(); g.moveTo(1, 8); g.lineTo(10, 2); g.strokePath();
    g.lineStyle(1, WOOD_DARK, 1);
    g.beginPath(); g.moveTo(5, 5); g.lineTo(7, 2); g.moveTo(7, 4); g.lineTo(9, 7); g.strokePath();
    g.generateTexture(key, 12, 10);
    g.destroy();
  }

  private makeMushroom(key: string, cap: number, stem: number): void {
    const g = this.add.graphics();
    // Stem
    g.fillStyle(stem, 1);
    g.fillRect(4, 5, 3, 4);
    g.fillStyle(0x8a7a60, 0.5);
    g.fillRect(4, 7, 3, 2);
    // Cap
    g.fillStyle(0x000000, 0.4);
    g.fillEllipse(5.5, 5, 9, 4);
    g.fillStyle(cap, 1);
    g.fillEllipse(5.5, 4, 9, 5);
    // Spots
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(3, 3, 0.7);
    g.fillCircle(7, 3.5, 0.8);
    g.fillCircle(5.5, 2.5, 0.6);
    g.generateTexture(key, 12, 10);
    g.destroy();
  }

  private makeGrassTuft(key: string, c: number): void {
    const g = this.add.graphics();
    g.lineStyle(1, c, 1);
    g.beginPath();
    g.moveTo(3, 8); g.lineTo(3, 3);
    g.moveTo(5, 8); g.lineTo(6, 1);
    g.moveTo(7, 8); g.lineTo(8, 4);
    g.moveTo(9, 8); g.lineTo(9, 2);
    g.strokePath();
    const dc = Phaser.Display.Color.ValueToColor(c).darken(20).color;
    g.lineStyle(1, dc, 1);
    g.beginPath();
    g.moveTo(4, 8); g.lineTo(4, 4);
    g.moveTo(6, 8); g.lineTo(7, 3);
    g.strokePath();
    g.generateTexture(key, 12, 10);
    g.destroy();
  }

  // ---------------- TREE ----------------

  private makeTrees(): void {
    this.makeTreeTrunk();
    this.makeTreeCanopy();
    this.makeTreeLegacy(); // combined for fallback + resource node
  }

  private makeTreeTrunk(): void {
    const g = this.add.graphics();
    // Shadow
    g.fillStyle(0x000000, 0.45); g.fillEllipse(10, 26, 14, 5);
    // Trunk — tapered
    g.fillStyle(WOOD_DARK, 1);
    g.beginPath();
    g.moveTo(8, 26); g.lineTo(7, 18); g.lineTo(9, 8); g.lineTo(11, 8); g.lineTo(13, 18); g.lineTo(12, 26);
    g.closePath(); g.fillPath();
    g.fillStyle(WOOD, 1);
    g.beginPath();
    g.moveTo(9, 26); g.lineTo(8.5, 18); g.lineTo(10, 8); g.lineTo(11, 8); g.lineTo(11, 18); g.lineTo(10.5, 26);
    g.closePath(); g.fillPath();
    // Bark lines
    g.lineStyle(1, WOOD_DARK, 0.7);
    g.beginPath(); g.moveTo(9, 22); g.lineTo(10, 15); g.strokePath();
    g.generateTexture('tree_trunk', 20, 30);
    g.destroy();
  }

  private makeTreeCanopy(): void {
    const g = this.add.graphics();
    const cx = 18, cy = 18;
    // Shadow
    g.fillStyle(0x000000, 0.3); g.fillEllipse(cx + 1, cy + 15, 22, 4);
    // Base dark crown
    g.fillStyle(COLORS.forestDark, 1);
    g.fillCircle(cx, cy, 14);
    g.fillCircle(cx - 6, cy - 3, 9);
    g.fillCircle(cx + 6, cy - 2, 10);
    g.fillCircle(cx + 3, cy + 6, 9);
    // Mid-tone
    g.fillStyle(COLORS.forest, 1);
    g.fillCircle(cx - 2, cy - 2, 9);
    g.fillCircle(cx + 5, cy - 4, 7);
    g.fillCircle(cx - 5, cy + 2, 6);
    // Highlight
    g.fillStyle(0x3f8a48, 1);
    g.fillCircle(cx - 3, cy - 6, 4);
    g.fillCircle(cx + 2, cy - 2, 3);
    // Top dot highlight
    g.fillStyle(0x62a05a, 0.8);
    g.fillCircle(cx - 4, cy - 7, 2);
    g.generateTexture('tree_canopy', 36, 36);
    g.destroy();
  }

  private makeTreeLegacy(): void {
    const g = this.add.graphics();
    // Used for resource node sprite (TILE × TILE)
    // Shadow
    g.fillStyle(0x000000, 0.5); g.fillEllipse(TILE / 2, TILE - 2, 16, 5);
    // Trunk
    g.fillStyle(WOOD_DARK, 1);
    g.fillRect(TILE / 2 - 2.5, TILE - 14, 5, 14);
    g.fillStyle(WOOD, 1);
    g.fillRect(TILE / 2 - 1, TILE - 14, 2, 14);
    // Canopy (stacked blobs)
    g.fillStyle(COLORS.forestDark, 1);
    g.fillCircle(TILE / 2, TILE / 2 - 1, 12);
    g.fillCircle(TILE / 2 - 5, TILE / 2 - 5, 7);
    g.fillCircle(TILE / 2 + 5, TILE / 2 - 2, 8);
    g.fillStyle(COLORS.forest, 1);
    g.fillCircle(TILE / 2 - 2, TILE / 2 - 3, 8);
    g.fillCircle(TILE / 2 + 3, TILE / 2 - 5, 5);
    g.fillStyle(0x3f8a48, 1);
    g.fillCircle(TILE / 2 - 3, TILE / 2 - 6, 3);
    g.generateTexture('tree', TILE, TILE);
    g.destroy();
  }

  private makeGoldMine(): void {
    const S = TILE * 3;
    const g = this.add.graphics();
    const cx = S / 2, cy = S / 2 + 4;

    // Base shadow
    g.fillStyle(0x000000, 0.55);
    g.fillEllipse(cx, cy + 18, S * 0.85, S * 0.4);

    // Mountain body (polygon mountain cave shape)
    g.fillStyle(0x2d3236, 1);
    g.beginPath();
    g.moveTo(6, cy + 20);
    g.lineTo(14, 20);
    g.lineTo(28, 6);
    g.lineTo(S / 2, 12);
    g.lineTo(S - 28, 4);
    g.lineTo(S - 14, 22);
    g.lineTo(S - 6, cy + 20);
    g.closePath();
    g.fillPath();
    // Light side
    g.fillStyle(0x4a5258, 1);
    g.beginPath();
    g.moveTo(6, cy + 20);
    g.lineTo(14, 20);
    g.lineTo(28, 6);
    g.lineTo(S / 2, 12);
    g.lineTo(S / 2, cy + 20);
    g.closePath();
    g.fillPath();
    // Outline
    g.lineStyle(2, OUTLINE, 0.9);
    g.beginPath();
    g.moveTo(6, cy + 20);
    g.lineTo(14, 20);
    g.lineTo(28, 6);
    g.lineTo(S / 2, 12);
    g.lineTo(S - 28, 4);
    g.lineTo(S - 14, 22);
    g.lineTo(S - 6, cy + 20);
    g.strokePath();

    // Cave entrance (dark arch)
    g.fillStyle(0x0a0c0e, 1);
    g.fillEllipse(cx, cy + 8, S * 0.44, S * 0.28);
    g.fillRect(cx - S * 0.22, cy + 4, S * 0.44, 12);
    // Arch outline
    g.lineStyle(2, OUTLINE, 1);
    g.strokeEllipse(cx, cy + 8, S * 0.44, S * 0.28);

    // Wooden beam supports
    g.fillStyle(WOOD_DARK, 1);
    g.fillRect(cx - S * 0.24 - 3, cy + 2, 3, 18);
    g.fillRect(cx + S * 0.24, cy + 2, 3, 18);
    g.fillStyle(WOOD, 1);
    g.fillRect(cx - S * 0.26, cy + 2, S * 0.52, 4);
    // Plank texture
    g.lineStyle(0.7, WOOD_DARK, 1);
    g.lineBetween(cx - S * 0.22, cy + 4, cx + S * 0.22, cy + 4);

    // Gold nuggets spilling from cave
    const nuggets = [
      { x: cx - 14, y: cy + 18, r: 3 },
      { x: cx - 4, y: cy + 22, r: 4 },
      { x: cx + 6, y: cy + 20, r: 3 },
      { x: cx + 15, y: cy + 24, r: 3.5 },
      { x: cx - 10, y: cy + 26, r: 2.5 },
    ];
    for (const n of nuggets) {
      g.fillStyle(0x8a6220, 1); g.fillEllipse(n.x + 1, n.y + 1, n.r * 2, n.r * 1.3);
      g.fillStyle(0xe4b04a, 1); g.fillEllipse(n.x, n.y, n.r * 2, n.r * 1.3);
      g.fillStyle(0xfff0a8, 0.8); g.fillEllipse(n.x - n.r * 0.3, n.y - n.r * 0.3, n.r, n.r * 0.5);
    }

    // Sparkles
    g.fillStyle(0xfff8c8, 1);
    g.fillCircle(cx - 16, cy + 16, 1);
    g.fillCircle(cx + 10, cy + 21, 1);

    g.generateTexture('goldmine', S, S);
    g.destroy();
  }

  // ---------------- SHADOWS ----------------

  private makeShadows(): void {
    this.makeShadow('unit_shadow_s', 18, 6);
    this.makeShadow('unit_shadow_m', 24, 8);
    this.makeShadow('unit_shadow_l', 34, 11);
    this.makeShadow('unit_shadow_xl', 44, 14);
  }

  private makeShadow(key: string, w: number, h: number): void {
    const g = this.add.graphics();
    // Multi-layered soft ellipse to simulate blur and directional depth
    g.fillStyle(0x06080d, 0.2); g.fillEllipse(w / 2 + 2, h / 2 + 2, w, h);
    g.fillStyle(0x080a0f, 0.35); g.fillEllipse(w / 2 + 1, h / 2 + 1, w * 0.82, h * 0.78);
    g.fillStyle(0x000000, 0.55); g.fillEllipse(w / 2, h / 2, w * 0.65, h * 0.6);
    g.fillStyle(0x000000, 0.8); g.fillEllipse(w / 2, h / 2, w * 0.4, h * 0.35);
    g.generateTexture(key, w + 4, h + 4);
    g.destroy();
  }

  // ---------------- UNITS ----------------

  private makeUnit(kind: UnitKind, race: Race): void {
    switch (kind) {
      case 'worker': return this.makeWorker(race);
      case 'footman': return this.makeFootman(race);
      case 'archer': return this.makeArcher(race);
      case 'knight': return this.makeKnight(race);
      case 'catapult': return this.makeCatapult(race);
    }
  }

  private makeWorker(race: Race): void {
    const W = 32, H = 40;
    const g = this.add.graphics();
    const cx = W / 2;
    const skin = race === 'alliance' ? ALLIANCE_SKIN : HORDE_SKIN;
    const cloth = race === 'alliance' ? 0x8a6d42 : 0x5a3a22;
    const clothLight = race === 'alliance' ? 0xa8845a : 0x75522e;
    const sash = RACE_COLOR[race];

    // Legs (trousers with boot)
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 6, 24, 5, 12, 1.5);
    g.fillRoundedRect(cx + 1, 24, 5, 12, 1.5);
    g.fillStyle(LEATHER, 1);
    g.fillRoundedRect(cx - 5.5, 24, 4, 9, 1);
    g.fillRoundedRect(cx + 1.5, 24, 4, 9, 1);
    // Boot tips
    g.fillStyle(LEATHER_DARK, 1);
    g.fillRoundedRect(cx - 6, 32, 5, 4, 1.5);
    g.fillRoundedRect(cx + 1, 32, 5, 4, 1.5);
    // Boot highlight
    g.fillStyle(0x8a6240, 0.8);
    g.fillRect(cx - 5, 25, 1, 7);
    g.fillRect(cx + 2, 25, 1, 7);

    // Torso — tunic
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 8, 15, 16, 12, 3);
    g.fillStyle(cloth, 1);
    g.fillRoundedRect(cx - 7.5, 15.5, 15, 11, 2.5);
    g.fillStyle(clothLight, 0.8);
    g.fillRoundedRect(cx - 7, 16, 7, 10, 2);
    // Belt
    g.fillStyle(LEATHER_DARK, 1);
    g.fillRect(cx - 8, 23, 16, 2.5);
    g.fillStyle(0xd4a04a, 1);
    g.fillRect(cx - 1, 23, 2, 2.5);
    // Sash (team color)
    g.fillStyle(sash, 1);
    g.fillTriangle(cx - 7, 16, cx - 3, 16, cx - 5, 22);
    g.fillStyle(0x000000, 0.3);
    g.fillTriangle(cx - 5, 16, cx - 3, 16, cx - 5, 22);

    // Arms (left/right)
    // Left arm (relaxed)
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 10, 17, 4, 9, 1.5);
    g.fillStyle(cloth, 1);
    g.fillRoundedRect(cx - 9.5, 17, 3, 6, 1);
    g.fillStyle(skin, 1);
    g.fillRoundedRect(cx - 9.5, 22, 3, 4, 1);
    // Right arm (holding tool, forward)
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx + 6, 17, 4, 8, 1.5);
    g.fillStyle(cloth, 1);
    g.fillRoundedRect(cx + 6.5, 17, 3, 5, 1);
    g.fillStyle(skin, 1);
    g.fillRoundedRect(cx + 6.5, 21, 3, 3.5, 1);

    // Head — round with hat
    const hy = 8;
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(cx, hy + 2, 6);
    g.fillStyle(skin, 1);
    g.fillCircle(cx, hy + 2, 5);
    // Skin shading
    g.fillStyle(0x000000, 0.2);
    g.fillRect(cx + 1, hy - 1, 4, 6);
    // Hair peek (alliance) / orc tusks (horde)
    if (race === 'alliance') {
      g.fillStyle(0x6b4a28, 1);
      g.fillRect(cx - 4, hy - 1, 8, 3);
      g.fillRoundedRect(cx - 4, hy, 8, 3, 1);
    } else {
      // Orc brow + tusks
      g.fillStyle(0x3a5a26, 1);
      g.fillRect(cx - 4, hy, 8, 2);
      // Tusks
      g.fillStyle(0xfff4d8, 1);
      g.fillTriangle(cx - 2, hy + 5, cx - 1.5, hy + 5, cx - 1.7, hy + 7);
      g.fillTriangle(cx + 2, hy + 5, cx + 1.5, hy + 5, cx + 1.7, hy + 7);
    }
    // Eyes (two dots)
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 2, hy + 2, 1, 1);
    g.fillRect(cx + 1, hy + 2, 1, 1);

    // Hat/cap on top
    if (race === 'alliance') {
      // Peasant cap
      g.fillStyle(OUTLINE, 1);
      g.fillTriangle(cx - 6, hy - 1, cx + 6, hy - 1, cx, hy - 8);
      g.fillStyle(0x8a5a2a, 1);
      g.fillTriangle(cx - 5, hy - 1, cx + 5, hy - 1, cx, hy - 7);
      g.fillStyle(0xa8744a, 1);
      g.fillTriangle(cx - 5, hy - 1, cx, hy - 1, cx, hy - 7);
    } else {
      // Horde bandana
      g.fillStyle(OUTLINE, 1);
      g.fillRoundedRect(cx - 6, hy - 4, 12, 4, 1.5);
      g.fillStyle(sash, 1);
      g.fillRect(cx - 5.5, hy - 4, 11, 3);
      // Knot
      g.fillStyle(sash, 1);
      g.fillTriangle(cx + 5, hy - 3, cx + 9, hy - 1, cx + 6, hy);
    }

    // Rim light (top-left highlight on head)
    g.fillStyle(RIM_LIGHT, 0.3);
    g.fillCircle(cx - 2, hy, 2);

    g.generateTexture(`unit_worker_${race}`, W, H);
    g.destroy();
  }

  private makeFootman(race: Race): void {
    const W = 36, H = 44;
    const g = this.add.graphics();
    const cx = W / 2;
    const tabard = RACE_COLOR[race];
    const tabardDark = Phaser.Display.Color.ValueToColor(tabard).darken(30).color;
    const trim = race === 'alliance' ? ALLIANCE_TRIM : 0xb08020;

    // Legs — armored greaves
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 7, 26, 6, 14, 2);
    g.fillRoundedRect(cx + 1, 26, 6, 14, 2);
    g.fillStyle(METAL_DARK, 1);
    g.fillRoundedRect(cx - 6.5, 26, 5, 11, 1.5);
    g.fillRoundedRect(cx + 1.5, 26, 5, 11, 1.5);
    g.fillStyle(METAL, 0.6);
    g.fillRect(cx - 5.5, 27, 1, 9);
    g.fillRect(cx + 2.5, 27, 1, 9);
    // Boots
    g.fillStyle(LEATHER_DARK, 1);
    g.fillRoundedRect(cx - 7, 36, 6, 4, 1.5);
    g.fillRoundedRect(cx + 1, 36, 6, 4, 1.5);

    // Torso — plate armor
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 10, 15, 20, 14, 3);
    g.fillStyle(METAL_DARK, 1);
    g.fillRoundedRect(cx - 9.5, 15.5, 19, 13, 2.5);
    g.fillStyle(METAL, 1);
    g.fillRoundedRect(cx - 9, 16, 18, 7, 2);
    g.fillStyle(METAL_LIGHT, 0.5);
    g.fillRect(cx - 8, 16, 16, 2);

    // Tabard — team color drape over torso
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 5, 17, 10, 16);
    g.fillStyle(tabard, 1);
    g.fillRect(cx - 4.5, 17.5, 9, 15);
    // V-neck
    g.fillStyle(METAL, 1);
    g.fillTriangle(cx - 4.5, 17.5, cx + 4.5, 17.5, cx, 22);
    // Emblem (cross / horns)
    g.fillStyle(trim, 1);
    if (race === 'alliance') {
      g.fillRect(cx - 0.75, 23, 1.5, 6);
      g.fillRect(cx - 3, 25, 6, 1.5);
    } else {
      // Horde skull-like mark
      g.fillCircle(cx, 25, 2);
      g.fillStyle(0x000000, 0.8);
      g.fillRect(cx - 1, 25, 2, 2);
    }
    // Tabard bottom zigzag
    g.fillStyle(tabardDark, 1);
    g.fillTriangle(cx - 4.5, 32, cx - 3.5, 35, cx - 2.5, 32);
    g.fillTriangle(cx - 2.5, 32, cx - 1.5, 35, cx - 0.5, 32);
    g.fillTriangle(cx - 0.5, 32, cx + 0.5, 35, cx + 1.5, 32);
    g.fillTriangle(cx + 1.5, 32, cx + 2.5, 35, cx + 3.5, 32);
    g.fillTriangle(cx + 3.5, 32, cx + 4.5, 34, cx + 4.5, 32);

    // Shoulders (pauldrons)
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(cx - 10, 17, 4);
    g.fillCircle(cx + 10, 17, 4);
    g.fillStyle(METAL_DARK, 1);
    g.fillCircle(cx - 10, 17, 3.3);
    g.fillCircle(cx + 10, 17, 3.3);
    g.fillStyle(METAL, 1);
    g.fillCircle(cx - 10.5, 16.3, 2);
    g.fillCircle(cx + 9.5, 16.3, 2);
    g.fillStyle(trim, 1);
    g.fillCircle(cx - 10, 17, 1);
    g.fillCircle(cx + 10, 17, 1);

    // Arms (holding weapon on right, shield on left in weapon sprite)
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 13, 19, 4, 10, 1.5);
    g.fillRoundedRect(cx + 9, 19, 4, 10, 1.5);
    g.fillStyle(METAL_DARK, 1);
    g.fillRoundedRect(cx - 12.5, 19, 3, 7, 1);
    g.fillRoundedRect(cx + 9.5, 19, 3, 7, 1);
    g.fillStyle(METAL, 0.7);
    g.fillRect(cx - 12, 19, 1, 6);
    g.fillRect(cx + 10, 19, 1, 6);
    // Gauntlets
    g.fillStyle(METAL_LIGHT, 1);
    g.fillRoundedRect(cx - 13, 25, 4, 4, 1.5);
    g.fillRoundedRect(cx + 9, 25, 4, 4, 1.5);
    g.lineStyle(0.5, OUTLINE, 1);
    g.strokeRoundedRect(cx - 13, 25, 4, 4, 1.5);
    g.strokeRoundedRect(cx + 9, 25, 4, 4, 1.5);

    // Head + helmet
    this.drawKnightHelm(g, cx, 10, race);

    g.generateTexture(`unit_footman_${race}`, W, H);
    g.destroy();
  }

  private drawKnightHelm(g: G, cx: number, cy: number, race: Race): void {
    // Helmet base
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 6, cy - 5, 12, 12, 3);
    g.fillStyle(METAL_DARK, 1);
    g.fillRoundedRect(cx - 5.5, cy - 4.5, 11, 11, 2.5);
    g.fillStyle(METAL, 1);
    g.fillRoundedRect(cx - 5.5, cy - 4.5, 11, 5, 2.5);
    g.fillStyle(METAL_LIGHT, 0.6);
    g.fillRect(cx - 5, cy - 4, 10, 2);
    // Visor slit
    g.fillStyle(0x0a0c0e, 1);
    g.fillRect(cx - 4, cy + 1, 8, 1.5);
    // Face shadow (inside visor) gap
    g.fillStyle(0x2a1a10, 1);
    g.fillRect(cx - 2, cy + 2.5, 4, 1.5);

    if (race === 'alliance') {
      // Plume (blue feather)
      const pc = ALLIANCE_CLOAK;
      g.fillStyle(OUTLINE, 1);
      g.fillTriangle(cx - 2, cy - 6, cx + 2, cy - 9, cx + 4, cy - 5);
      g.fillStyle(pc, 1);
      g.fillTriangle(cx - 1.5, cy - 6, cx + 2, cy - 8.5, cx + 3.5, cy - 5.5);
      g.fillStyle(0x5fa0e0, 1);
      g.fillTriangle(cx - 1.5, cy - 6, cx + 1, cy - 7.5, cx + 1, cy - 5.5);
    } else {
      // Horned helmet
      g.fillStyle(OUTLINE, 1);
      g.fillTriangle(cx - 7, cy - 3, cx - 6, cy - 6, cx - 5, cy - 3);
      g.fillTriangle(cx + 5, cy - 3, cx + 6, cy - 6, cx + 7, cy - 3);
      g.fillStyle(0xf0d6a8, 1);
      g.fillTriangle(cx - 6.5, cy - 3, cx - 6, cy - 5.5, cx - 5.5, cy - 3);
      g.fillTriangle(cx + 5.5, cy - 3, cx + 6, cy - 5.5, cx + 6.5, cy - 3);
    }

    // Rim light on top-left of helm
    g.fillStyle(RIM_LIGHT, 0.4);
    g.fillRect(cx - 5, cy - 4, 3, 1);
  }

  private makeArcher(race: Race): void {
    const W = 34, H = 44;
    const g = this.add.graphics();
    const cx = W / 2;
    const cloak = race === 'alliance' ? 0x2a5a36 : 0x4a2a18;
    const cloakLight = race === 'alliance' ? 0x3d7a4a : 0x6a3a22;
    const tunic = race === 'alliance' ? 0x5a8f48 : 0x8a5a30;
    const skin = race === 'alliance' ? ALLIANCE_SKIN : HORDE_SKIN;
    const trim = RACE_COLOR[race];

    // Legs — leather
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 6, 26, 5, 12, 1.5);
    g.fillRoundedRect(cx + 1, 26, 5, 12, 1.5);
    g.fillStyle(LEATHER, 1);
    g.fillRoundedRect(cx - 5.5, 26, 4, 9, 1);
    g.fillRoundedRect(cx + 1.5, 26, 4, 9, 1);
    g.fillStyle(LEATHER_DARK, 1);
    g.fillRoundedRect(cx - 6, 34, 5, 4, 1.5);
    g.fillRoundedRect(cx + 1, 34, 5, 4, 1.5);

    // Torso — tunic + leather jerkin
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 8, 15, 16, 13, 3);
    g.fillStyle(tunic, 1);
    g.fillRoundedRect(cx - 7.5, 15.5, 15, 12, 2.5);
    // Leather jerkin overlay
    g.fillStyle(LEATHER, 1);
    g.fillRect(cx - 7, 17, 14, 6);
    g.fillStyle(LEATHER_DARK, 0.6);
    g.fillRect(cx - 7, 22, 14, 1);
    // Belt
    g.fillStyle(LEATHER_DARK, 1);
    g.fillRect(cx - 8, 24, 16, 2);
    // Quiver strap
    g.fillStyle(LEATHER_DARK, 1);
    g.fillRect(cx - 3, 15, 2, 13);
    // Quiver on back (peeking right shoulder)
    g.fillStyle(LEATHER_DARK, 1);
    g.fillRoundedRect(cx + 4, 12, 4, 10, 1);
    g.fillStyle(LEATHER, 1);
    g.fillRect(cx + 4.5, 12, 3, 9);
    // Arrow fletching in quiver
    g.fillStyle(0xe8e0c0, 1);
    g.fillTriangle(cx + 4.5, 11, cx + 5.5, 8, cx + 6.5, 11);
    g.fillTriangle(cx + 6, 11, cx + 7, 8, cx + 7.5, 11);
    g.fillStyle(trim, 1);
    g.fillTriangle(cx + 4.5, 11, cx + 5, 9.5, cx + 5.5, 11);

    // Arms
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 10, 17, 4, 9, 1.5);
    g.fillRoundedRect(cx + 6, 17, 4, 9, 1.5);
    g.fillStyle(tunic, 1);
    g.fillRoundedRect(cx - 9.5, 17, 3, 5, 1);
    g.fillRoundedRect(cx + 6.5, 17, 3, 5, 1);
    g.fillStyle(skin, 1);
    g.fillRoundedRect(cx - 9.5, 21, 3, 5, 1);
    g.fillRoundedRect(cx + 6.5, 21, 3, 5, 1);

    // Hood + head
    const hy = 10;
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(cx, hy, 6.5);
    g.fillStyle(skin, 1);
    g.fillCircle(cx, hy, 5.5);
    // Face shadow from hood
    g.fillStyle(0x000000, 0.4);
    g.fillRect(cx - 4, hy - 2, 8, 3);
    // Eyes (glinting)
    g.fillStyle(0xffffff, 1);
    g.fillRect(cx - 2.5, hy, 1, 1);
    g.fillRect(cx + 1.5, hy, 1, 1);
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 2, hy, 0.5, 0.5);
    g.fillRect(cx + 2, hy, 0.5, 0.5);

    // Hood (covering top of head, big shape)
    g.fillStyle(OUTLINE, 1);
    g.beginPath();
    g.moveTo(cx - 8, hy + 2);
    g.lineTo(cx - 7, hy - 4);
    g.lineTo(cx - 3, hy - 8);
    g.lineTo(cx + 3, hy - 8);
    g.lineTo(cx + 7, hy - 4);
    g.lineTo(cx + 8, hy + 2);
    g.lineTo(cx + 5, hy + 1);
    g.lineTo(cx, hy - 5);
    g.lineTo(cx - 5, hy + 1);
    g.closePath();
    g.fillPath();
    g.fillStyle(cloak, 1);
    g.beginPath();
    g.moveTo(cx - 7, hy + 1);
    g.lineTo(cx - 6, hy - 3);
    g.lineTo(cx - 3, hy - 7);
    g.lineTo(cx + 3, hy - 7);
    g.lineTo(cx + 6, hy - 3);
    g.lineTo(cx + 7, hy + 1);
    g.lineTo(cx + 4, hy);
    g.lineTo(cx, hy - 4);
    g.lineTo(cx - 4, hy);
    g.closePath();
    g.fillPath();
    // Hood highlight
    g.fillStyle(cloakLight, 0.7);
    g.fillTriangle(cx - 6, hy - 3, cx - 3, hy - 7, cx, hy - 4);

    g.generateTexture(`unit_archer_${race}`, W, H);
    g.destroy();
  }

  private makeKnight(race: Race): void {
    const W = 44, H = 44;
    const g = this.add.graphics();
    const cx = W / 2, cyHorse = 28;
    const horseColor = race === 'alliance' ? 0xe8d2a8 : 0x3a2218;
    const horseDark = race === 'alliance' ? 0xa8906a : 0x20100a;
    const mane = race === 'alliance' ? 0x4a2e18 : 0x662e20;
    const saddle = RACE_COLOR[race];

    // Horse body (side-facing)
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 15, cyHorse - 6, 28, 14, 4);
    // Horse legs
    g.fillRect(cx - 12, cyHorse + 6, 3, 9);
    g.fillRect(cx - 4, cyHorse + 6, 3, 9);
    g.fillRect(cx + 4, cyHorse + 6, 3, 9);
    g.fillRect(cx + 10, cyHorse + 6, 3, 9);

    g.fillStyle(horseColor, 1);
    g.fillRoundedRect(cx - 14.5, cyHorse - 5.5, 27, 13, 3.5);
    g.fillStyle(horseDark, 0.7);
    g.fillRect(cx - 14.5, cyHorse + 3, 27, 4);

    // Legs (fill)
    g.fillStyle(horseColor, 1);
    g.fillRect(cx - 11.5, cyHorse + 6, 2, 8);
    g.fillRect(cx - 3.5, cyHorse + 6, 2, 8);
    g.fillRect(cx + 4.5, cyHorse + 6, 2, 8);
    g.fillRect(cx + 10.5, cyHorse + 6, 2, 8);
    // Hooves
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 12, cyHorse + 13, 3, 2);
    g.fillRect(cx - 4, cyHorse + 13, 3, 2);
    g.fillRect(cx + 4, cyHorse + 13, 3, 2);
    g.fillRect(cx + 10, cyHorse + 13, 3, 2);

    // Horse head (right side)
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx + 11, cyHorse - 10, 8, 10, 2);
    g.fillStyle(horseColor, 1);
    g.fillRoundedRect(cx + 11.5, cyHorse - 9.5, 7, 9, 2);
    // Muzzle
    g.fillStyle(horseDark, 1);
    g.fillRoundedRect(cx + 15, cyHorse - 5, 4, 5, 1.5);
    // Eye
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx + 16, cyHorse - 7, 1, 1);
    // Ears
    g.fillStyle(OUTLINE, 1);
    g.fillTriangle(cx + 12, cyHorse - 10, cx + 13, cyHorse - 13, cx + 14, cyHorse - 10);
    g.fillStyle(horseColor, 1);
    g.fillTriangle(cx + 12.5, cyHorse - 10, cx + 13, cyHorse - 12, cx + 13.5, cyHorse - 10);

    // Mane
    g.fillStyle(OUTLINE, 1);
    g.beginPath();
    g.moveTo(cx + 8, cyHorse - 7);
    g.lineTo(cx + 10, cyHorse - 10);
    g.lineTo(cx + 13, cyHorse - 8);
    g.lineTo(cx + 12, cyHorse - 5);
    g.closePath(); g.fillPath();
    g.fillStyle(mane, 1);
    g.beginPath();
    g.moveTo(cx + 8.5, cyHorse - 7);
    g.lineTo(cx + 10, cyHorse - 9.5);
    g.lineTo(cx + 12.5, cyHorse - 7.5);
    g.lineTo(cx + 11.5, cyHorse - 5);
    g.closePath(); g.fillPath();

    // Tail
    g.fillStyle(OUTLINE, 1);
    g.beginPath();
    g.moveTo(cx - 15, cyHorse - 2);
    g.lineTo(cx - 19, cyHorse + 2);
    g.lineTo(cx - 18, cyHorse + 5);
    g.lineTo(cx - 14, cyHorse + 2);
    g.closePath(); g.fillPath();
    g.fillStyle(mane, 1);
    g.beginPath();
    g.moveTo(cx - 15, cyHorse - 1);
    g.lineTo(cx - 18, cyHorse + 2.5);
    g.lineTo(cx - 17, cyHorse + 4.5);
    g.lineTo(cx - 14, cyHorse + 2);
    g.closePath(); g.fillPath();

    // Saddle (team color)
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 5, cyHorse - 9, 11, 6, 2);
    g.fillStyle(saddle, 1);
    g.fillRoundedRect(cx - 4.5, cyHorse - 8.5, 10, 5, 1.5);
    g.fillStyle(0xffffff, 0.3);
    g.fillRect(cx - 4, cyHorse - 8, 9, 1);

    // Rider torso (on saddle)
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx - 5, 10, 10, 12, 2.5);
    g.fillStyle(METAL_DARK, 1);
    g.fillRoundedRect(cx - 4.5, 10.5, 9, 11, 2);
    g.fillStyle(METAL, 1);
    g.fillRoundedRect(cx - 4, 11, 8, 5, 1.5);
    // Rider tabard
    g.fillStyle(saddle, 1);
    g.fillRect(cx - 3, 14, 6, 9);
    g.fillStyle(0x000000, 0.3);
    g.fillRect(cx - 3, 14, 6, 1.5);

    // Shoulders
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(cx - 5, 12, 3);
    g.fillCircle(cx + 5, 12, 3);
    g.fillStyle(METAL, 1);
    g.fillCircle(cx - 5, 11.5, 2.2);
    g.fillCircle(cx + 5, 11.5, 2.2);

    // Arms holding lance
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx + 3, 13, 4, 8, 1.2);
    g.fillStyle(METAL_DARK, 1);
    g.fillRoundedRect(cx + 3.5, 13, 3, 6, 1);

    // Helm
    this.drawKnightHelm(g, cx, 6, race);

    g.generateTexture(`unit_knight_${race}`, W, H);
    g.destroy();
  }

  private makeCatapult(race: Race): void {
    const W = 48, H = 48;
    const g = this.add.graphics();
    const cx = W / 2;
    const accent = RACE_COLOR[race];

    // Shadow
    g.fillStyle(0x000000, 0.55);
    g.fillEllipse(cx, 42, 40, 10);

    // Wheels (2 big with spokes)
    this.drawWagonWheel(g, cx - 14, 34, 8);
    this.drawWagonWheel(g, cx + 14, 34, 8);

    // Chassis (wooden frame) — polygon
    g.fillStyle(OUTLINE, 1);
    g.beginPath();
    g.moveTo(cx - 18, 30); g.lineTo(cx + 18, 30);
    g.lineTo(cx + 15, 22); g.lineTo(cx - 15, 22);
    g.closePath(); g.fillPath();
    g.fillStyle(WOOD_DARK, 1);
    g.beginPath();
    g.moveTo(cx - 17, 30); g.lineTo(cx + 17, 30);
    g.lineTo(cx + 14, 23); g.lineTo(cx - 14, 23);
    g.closePath(); g.fillPath();
    g.fillStyle(WOOD, 1);
    g.beginPath();
    g.moveTo(cx - 17, 30); g.lineTo(cx + 17, 30);
    g.lineTo(cx + 14, 27); g.lineTo(cx - 14, 27);
    g.closePath(); g.fillPath();
    // Wood grain
    g.lineStyle(1, WOOD_DARK, 0.7);
    g.lineBetween(cx - 14, 25, cx + 14, 25);
    g.lineBetween(cx - 14, 28, cx + 14, 28);

    // Metal reinforcement bands
    g.fillStyle(METAL_DARK, 1);
    g.fillRect(cx - 10, 22, 2, 9);
    g.fillRect(cx + 8, 22, 2, 9);

    // Throwing arm (angled up-back)
    g.fillStyle(OUTLINE, 1);
    g.beginPath();
    g.moveTo(cx + 2, 22); g.lineTo(cx + 4, 22);
    g.lineTo(cx - 12, 4); g.lineTo(cx - 14, 5);
    g.closePath(); g.fillPath();
    g.fillStyle(WOOD_DARK, 1);
    g.beginPath();
    g.moveTo(cx + 2.5, 22); g.lineTo(cx + 3.5, 22);
    g.lineTo(cx - 12, 5); g.lineTo(cx - 13, 5.5);
    g.closePath(); g.fillPath();
    g.fillStyle(WOOD, 1);
    g.beginPath();
    g.moveTo(cx + 2.8, 22); g.lineTo(cx + 3.2, 22);
    g.lineTo(cx - 12, 5.5); g.lineTo(cx - 12.5, 5.8);
    g.closePath(); g.fillPath();

    // Counterweight box (back)
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(cx + 4, 17, 14, 8, 1.5);
    g.fillStyle(0x4a3220, 1);
    g.fillRoundedRect(cx + 4.5, 17.5, 13, 7, 1);
    g.fillStyle(METAL_DARK, 1);
    g.fillRect(cx + 5, 18, 12, 1.5);
    g.fillRect(cx + 5, 23, 12, 1.2);
    // Rivets
    g.fillStyle(METAL, 1);
    for (let i = 0; i < 3; i++) g.fillCircle(cx + 7 + i * 4, 18.5, 0.6);

    // Sling cup with stone ammo
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(cx - 13, 4, 5);
    g.fillStyle(0x5a5a5a, 1);
    g.fillCircle(cx - 13, 4, 4);
    g.fillStyle(0x8a8a8a, 1);
    g.fillCircle(cx - 13.5, 3.5, 2.5);
    g.fillStyle(0xaaaaaa, 0.7);
    g.fillCircle(cx - 14, 3, 1);

    // Team flag on side
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx + 15, 10, 1, 12);
    g.fillStyle(accent, 1);
    g.fillTriangle(cx + 15, 10, cx + 22, 13, cx + 15, 16);
    g.fillStyle(0x000000, 0.3);
    g.fillTriangle(cx + 15, 13, cx + 22, 13, cx + 15, 16);

    g.generateTexture(`unit_catapult_${race}`, W, H);
    g.destroy();
  }

  private drawWagonWheel(g: G, cx: number, cy: number, r: number): void {
    // Tire outer
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(cx, cy, r);
    // Wood ring
    g.fillStyle(WOOD_DARK, 1);
    g.fillCircle(cx, cy, r - 1);
    g.fillStyle(WOOD, 1);
    g.fillCircle(cx, cy, r - 2.5);
    // Hub
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(cx, cy, 2.5);
    g.fillStyle(METAL_DARK, 1);
    g.fillCircle(cx, cy, 2);
    g.fillStyle(METAL, 1);
    g.fillCircle(cx, cy, 1);
    // Spokes
    g.lineStyle(1.5, WOOD_DARK, 1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 2, cy + Math.sin(a) * 2);
      g.lineTo(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 2));
      g.strokePath();
    }
  }

  // ---------------- WEAPONS ----------------

  private makeWeapon(kind: UnitKind, race: Race): void {
    const key = `unit_${kind}_${race}_weapon`;
    switch (kind) {
      case 'worker': return this.makeWeaponHammer(key);
      case 'footman': return this.makeWeaponSwordShield(key, race);
      case 'archer': return this.makeWeaponBow(key, race);
      case 'knight': return this.makeWeaponLance(key, race);
      case 'catapult': {
        // No separate weapon sprite for catapult — make a 1×1 empty texture
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0); g.fillRect(0, 0, 1, 1);
        g.generateTexture(key, 1, 1);
        g.destroy();
        return;
      }
    }
  }

  private makeWeaponHammer(key: string): void {
    const W = 18, H = 18;
    const g = this.add.graphics();
    // Handle (diagonal)
    g.lineStyle(3, OUTLINE, 1); g.lineBetween(2, 16, 14, 4);
    g.lineStyle(2, WOOD, 1); g.lineBetween(2, 16, 14, 4);
    // Head (metal block at top)
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(10, 1, 8, 5, 1);
    g.fillStyle(METAL_DARK, 1);
    g.fillRoundedRect(10.5, 1.5, 7, 4, 0.8);
    g.fillStyle(METAL_LIGHT, 0.6);
    g.fillRect(11, 2, 6, 1);
    g.fillStyle(METAL, 1);
    g.fillRoundedRect(11, 2.5, 6, 2.5, 0.5);
    g.generateTexture(key, W, H);
    g.destroy();
  }

  private makeWeaponSwordShield(key: string, race: Race): void {
    const W = 22, H = 22;
    const g = this.add.graphics();
    const shieldColor = RACE_COLOR[race];

    // Shield behind
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(0, 6, 9, 12, 2);
    g.fillStyle(shieldColor, 1);
    g.fillRoundedRect(0.5, 6.5, 8, 11, 1.5);
    g.fillStyle(0x000000, 0.3);
    g.fillRect(4.5, 6.5, 4, 11);
    // Shield emblem
    g.fillStyle(race === 'alliance' ? ALLIANCE_TRIM : 0xf0d070, 1);
    g.fillRect(4 - 0.75, 10, 1.5, 4);
    g.fillRect(2.5, 11.25, 3, 1.5);
    g.fillStyle(METAL, 1);
    g.fillCircle(4.5, 7.5, 0.8);
    g.fillCircle(4.5, 16.5, 0.8);

    // Sword in front (diagonal)
    // Blade
    g.lineStyle(3.5, OUTLINE, 1); g.lineBetween(8, 16, 20, 3);
    g.lineStyle(2.5, METAL_LIGHT, 1); g.lineBetween(8, 16, 20, 3);
    g.lineStyle(1, METAL_DARK, 1); g.lineBetween(9, 15, 19, 4);
    // Tip
    g.fillStyle(OUTLINE, 1);
    g.fillTriangle(19, 2, 21, 4, 18, 5);
    g.fillStyle(METAL_LIGHT, 1);
    g.fillTriangle(19, 3, 20.5, 4, 18.5, 4.5);
    // Guard
    g.fillStyle(OUTLINE, 1);
    g.fillRect(5, 15, 8, 2);
    g.fillStyle(ALLIANCE_TRIM, 1);
    g.fillRect(5.5, 15.3, 7, 1.4);
    // Handle
    g.fillStyle(OUTLINE, 1);
    g.fillRect(6, 17, 3, 5);
    g.fillStyle(LEATHER_DARK, 1);
    g.fillRect(6.3, 17.2, 2.4, 4.6);
    // Pommel
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(7.5, 22, 2);
    g.fillStyle(ALLIANCE_TRIM, 1);
    g.fillCircle(7.5, 22, 1.4);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  private makeWeaponBow(key: string, race: Race): void {
    const W = 20, H = 22;
    const g = this.add.graphics();
    const limb = race === 'alliance' ? 0x6b4a28 : 0x4a2814;
    // Bow limbs (curved via line segments approximating a quadratic curve)
    const bowOutline = (thick: number, color: number, alpha: number, bulge: number, y0: number, y1: number) => {
      g.lineStyle(thick, color, alpha);
      g.beginPath();
      const segs = 14;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        // Quadratic bezier (10, y0) -> (10 + bulge, mid) -> (10, y1) approximation
        const mt = 1 - t;
        const cx2 = 10 + bulge;
        const cy2 = (y0 + y1) / 2;
        const x = mt * mt * 10 + 2 * mt * t * cx2 + t * t * 10;
        const y = mt * mt * y0 + 2 * mt * t * cy2 + t * t * y1;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.strokePath();
    };
    bowOutline(3.5, OUTLINE, 1, 6, 1, 21);
    bowOutline(2.5, limb, 1, 5, 2, 20);
    // Grip
    g.fillStyle(OUTLINE, 1);
    g.fillRect(12, 9, 3, 4);
    g.fillStyle(LEATHER, 1);
    g.fillRect(12.3, 9.3, 2.4, 3.4);
    // String
    g.lineStyle(1, 0xd0c89c, 1);
    g.lineBetween(10, 2, 10, 20);
    // Nocked arrow
    g.lineStyle(1.5, WOOD, 1);
    g.lineBetween(0, 11, 11, 11);
    // Arrow head
    g.fillStyle(OUTLINE, 1);
    g.fillTriangle(0, 11, 3, 9, 3, 13);
    g.fillStyle(METAL, 1);
    g.fillTriangle(0.5, 11, 2.8, 9.5, 2.8, 12.5);
    // Fletching
    g.fillStyle(RACE_COLOR[race], 1);
    g.fillTriangle(10, 11, 13, 9, 13, 11);
    g.fillTriangle(10, 11, 13, 13, 13, 11);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  private makeWeaponLance(key: string, race: Race): void {
    const W = 28, H = 8;
    const g = this.add.graphics();
    const pennant = RACE_COLOR[race];

    // Shaft (horizontal — rotation pivot at left)
    g.lineStyle(3.5, OUTLINE, 1); g.lineBetween(2, 4, 24, 4);
    g.lineStyle(2.5, WOOD, 1); g.lineBetween(2, 4, 24, 4);
    g.lineStyle(1, WOOD_DARK, 1); g.lineBetween(4, 4, 22, 4);

    // Spearhead
    g.fillStyle(OUTLINE, 1);
    g.fillTriangle(24, 1, 28, 4, 24, 7);
    g.fillStyle(METAL, 1);
    g.fillTriangle(24, 1.8, 27.4, 4, 24, 6.2);
    g.fillStyle(METAL_LIGHT, 0.7);
    g.fillTriangle(24, 2, 26.5, 4, 24, 4);

    // Pennant
    g.fillStyle(OUTLINE, 1);
    g.fillTriangle(10, 4, 18, 0, 18, 2.5);
    g.fillTriangle(10, 4, 18, 5.5, 18, 8);
    g.fillStyle(pennant, 1);
    g.fillTriangle(10, 4, 17, 1, 17, 3);
    g.fillTriangle(10, 4, 17, 5, 17, 7);

    // Grip
    g.fillStyle(OUTLINE, 1);
    g.fillRect(1, 3, 4, 2.5);
    g.fillStyle(LEATHER_DARK, 1);
    g.fillRect(1.3, 3.2, 3.4, 2.1);

    g.generateTexture(key, W, H);
    g.destroy();
  }

  // ---------------- BUILDINGS ----------------

  private makeBuilding(kind: BuildingKind, race: Race, stage: 'final' | 'stage1' | 'stage2'): void {
    switch (kind) {
      case 'townhall': return this.makeTownHall(race, stage);
      case 'farm': return this.makeFarm(race, stage);
      case 'barracks': return this.makeBarracks(race, stage);
      case 'workshop': return this.makeWorkshop(race, stage);
      case 'tower': return this.makeTower(race, stage);
    }
  }

  private buildingKey(kind: BuildingKind, race: Race, stage: 'final' | 'stage1' | 'stage2'): string {
    if (stage === 'final') return `building_${kind}_${race}`;
    return `building_${kind}_${race}_${stage}`;
  }

  private buildingSize(kind: BuildingKind): number {
    return (kind === 'farm' || kind === 'tower') ? TILE * 2 : TILE * 3;
  }

  private drawConstructionBase(g: G, size: number, stage: 'stage1' | 'stage2'): void {
    // Shared: shadow + stone foundation + scaffolding
    g.fillStyle(0x000000, 0.55);
    g.fillEllipse(size / 2, size - 6, size * 0.8, 14);

    // Stone foundation
    g.fillStyle(0x4a4e52, 1);
    g.fillRect(4, size - 18, size - 8, 12);
    g.fillStyle(0x6a6e72, 1);
    g.fillRect(4, size - 18, size - 8, 3);
    // Stones
    g.lineStyle(1, 0x2a2e32, 1);
    for (let x = 6; x < size - 6; x += 8) g.lineBetween(x, size - 15, x, size - 6);
    g.lineBetween(4, size - 10, size - 4, size - 10);

    if (stage === 'stage1') {
      // Wooden posts (scaffolding)
      g.fillStyle(WOOD_DARK, 1);
      g.fillRect(8, size - 40, 3, 30);
      g.fillRect(size - 11, size - 40, 3, 30);
      g.fillRect(size / 2 - 1.5, size - 36, 3, 26);
      // Cross beams
      g.lineStyle(2, WOOD, 1);
      g.lineBetween(8, size - 30, size - 8, size - 30);
      g.lineBetween(8, size - 20, size - 8, size - 20);
      // Pile of materials
      g.fillStyle(WOOD, 1);
      g.fillRect(size / 2 - 10, size - 14, 20, 4);
      g.fillStyle(WOOD_DARK, 1);
      g.fillRect(size / 2 - 10, size - 13, 20, 1);
    } else {
      // stage2: half-built walls
      g.fillStyle(OUTLINE, 1);
      g.fillRect(6, size - 30, size - 12, 20);
      g.fillStyle(0xbfb8a0, 1);
      g.fillRect(7, size - 29, size - 14, 18);
      // Unfinished top (jagged)
      g.fillStyle(OUTLINE, 1);
      for (let x = 7; x < size - 7; x += 4) {
        g.fillTriangle(x, size - 30, x + 2, size - 34, x + 4, size - 30);
      }
      // Scaffolding still visible
      g.fillStyle(WOOD_DARK, 1);
      g.fillRect(4, size - 36, 2, 26);
      g.fillRect(size - 6, size - 36, 2, 26);
      g.lineStyle(1.5, WOOD, 1);
      g.lineBetween(4, size - 24, size - 4, size - 24);
    }
  }

  private makeTownHall(race: Race, stage: 'final' | 'stage1' | 'stage2'): void {
    const size = this.buildingSize('townhall');
    const g = this.add.graphics();
    const key = this.buildingKey('townhall', race, stage);

    if (stage !== 'final') {
      this.drawConstructionBase(g, size, stage);
      g.generateTexture(key, size, size);
      g.destroy();
      return;
    }

    const cx = size / 2;
    const wallColor = race === 'alliance' ? 0xe4d9b8 : 0xc8a878;
    const wallDark = race === 'alliance' ? 0xa89868 : 0x8a6a42;
    const roof = race === 'alliance' ? 0x2a4e8a : 0x7a1e14;
    const roofLight = race === 'alliance' ? 0x4470a8 : 0xa8382a;
    const teamColor = RACE_COLOR[race];

    // Shadow
    g.fillStyle(0x000000, 0.6);
    g.fillEllipse(cx, size - 4, size * 0.88, 16);

    // Stone foundation
    g.fillStyle(0x3a3d40, 1);
    g.fillRect(4, size - 14, size - 8, 10);
    g.fillStyle(0x5a5d60, 1);
    g.fillRect(4, size - 14, size - 8, 3);
    // Stone blocks
    g.lineStyle(1, 0x2a2d30, 1);
    g.lineBetween(4, size - 9, size - 4, size - 9);
    for (let x = 8; x < size; x += 8) {
      g.lineBetween(x, size - 14, x, size - 9);
    }
    for (let x = 12; x < size; x += 8) {
      g.lineBetween(x, size - 9, x, size - 4);
    }

    // Main keep body (central tall block)
    const mainX = 14, mainW = size - 28, mainTop = 20, mainBot = size - 14;
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(mainX - 1, mainTop - 1, mainW + 2, mainBot - mainTop + 2, 2);
    g.fillStyle(wallColor, 1);
    g.fillRoundedRect(mainX, mainTop, mainW, mainBot - mainTop, 1.5);
    g.fillStyle(wallDark, 0.6);
    g.fillRect(cx, mainTop, mainW / 2, mainBot - mainTop);
    // Stone masonry — horizontal bands
    g.lineStyle(0.8, wallDark, 0.9);
    for (let y = mainTop + 8; y < mainBot; y += 10) {
      g.lineBetween(mainX, y, mainX + mainW, y);
    }
    // Random stones offset
    g.lineStyle(0.5, wallDark, 0.7);
    for (let y = mainTop + 3; y < mainBot; y += 10) {
      for (let x = mainX + 8; x < mainX + mainW; x += 10) {
        g.lineBetween(x, y, x, y + 8);
      }
    }

    // Side towers (left + right)
    const towerW = 14, towerH = mainBot - 12;
    const towerTop = 10;
    this.drawRoundTower(g, 6, towerTop, towerW, towerH, wallColor, wallDark, roof, roofLight);
    this.drawRoundTower(g, size - 6 - towerW, towerTop, towerW, towerH, wallColor, wallDark, roof, roofLight);

    // Central peaked roof
    g.fillStyle(OUTLINE, 1);
    g.fillTriangle(mainX - 3, mainTop + 2, cx, 4, mainX + mainW + 3, mainTop + 2);
    g.fillStyle(roof, 1);
    g.fillTriangle(mainX - 1, mainTop + 1, cx, 6, mainX + mainW + 1, mainTop + 1);
    g.fillStyle(roofLight, 1);
    g.fillTriangle(mainX - 1, mainTop + 1, cx, 6, cx, mainTop + 1);
    // Roof tiles — lines
    g.lineStyle(0.7, OUTLINE, 0.7);
    for (let i = 1; i < 5; i++) {
      const y = mainTop + 1 - ((i / 5) * (mainTop - 5));
      const spanL = Phaser.Math.Linear(mainX - 1, cx, i / 5);
      const spanR = Phaser.Math.Linear(mainX + mainW + 1, cx, i / 5);
      g.lineBetween(spanL, y, spanR, y);
    }

    // Door
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 8, mainBot - 18, 16, 18);
    g.fillStyle(WOOD_DARK, 1);
    g.fillRect(cx - 7, mainBot - 17, 14, 17);
    g.fillStyle(WOOD, 1);
    g.fillRect(cx - 6.5, mainBot - 17, 6, 17);
    // Door frame arch
    g.fillStyle(OUTLINE, 1);
    g.fillEllipse(cx, mainBot - 18, 20, 6);
    g.fillStyle(wallColor, 1);
    g.fillRect(cx - 10, mainBot - 18, 20, 3);
    // Door planks
    g.lineStyle(0.6, WOOD_DARK, 1);
    g.lineBetween(cx, mainBot - 17, cx, mainBot);
    // Door handle
    g.fillStyle(0xd4a04a, 1);
    g.fillCircle(cx - 3, mainBot - 9, 1);

    // Windows (two on each side of door)
    this.drawWindow(g, mainX + 5, mainTop + 10, 5, 7);
    this.drawWindow(g, mainX + mainW - 10, mainTop + 10, 5, 7);

    // Banner (team) flying from main roof
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 0.5, 1, 1.5, 10);
    g.fillStyle(teamColor, 1);
    g.fillTriangle(cx, 2, cx + 8, 5, cx, 8);
    g.fillStyle(0x000000, 0.3);
    g.fillTriangle(cx, 5, cx + 8, 5, cx, 8);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private drawRoundTower(g: G, x: number, y: number, w: number, h: number, wall: number, wallDark: number, roof: number, roofLight: number): void {
    const cx = x + w / 2;
    // Body (cylindrical look)
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(x, y + 5, w, h - 5, w / 4);
    g.fillStyle(wall, 1);
    g.fillRoundedRect(x + 0.7, y + 5.5, w - 1.4, h - 6, w / 4 - 0.5);
    g.fillStyle(wallDark, 0.5);
    g.fillRect(cx, y + 6, w / 2, h - 6);
    // Masonry bands
    g.lineStyle(0.7, wallDark, 0.85);
    for (let yy = y + 12; yy < y + h; yy += 8) {
      g.lineBetween(x + 1, yy, x + w - 1, yy);
    }
    // Arrow slit
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 0.75, y + 12, 1.5, 5);

    // Conical roof
    g.fillStyle(OUTLINE, 1);
    g.fillTriangle(x - 1, y + 7, cx, y - 3, x + w + 1, y + 7);
    g.fillStyle(roof, 1);
    g.fillTriangle(x, y + 6, cx, y - 2, x + w, y + 6);
    g.fillStyle(roofLight, 1);
    g.fillTriangle(x, y + 6, cx, y - 2, cx, y + 6);
    // Roof ridges
    g.lineStyle(0.6, OUTLINE, 0.7);
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      const yy = Phaser.Math.Linear(y + 6, y - 2, t);
      const lx = Phaser.Math.Linear(x, cx, t);
      const rx = Phaser.Math.Linear(x + w, cx, t);
      g.lineBetween(lx, yy, rx, yy);
    }
    // Finial
    g.fillStyle(OUTLINE, 1); g.fillCircle(cx, y - 3, 1.5);
    g.fillStyle(METAL_LIGHT, 1); g.fillCircle(cx, y - 3, 0.9);
  }

  private drawWindow(g: G, x: number, y: number, w: number, h: number): void {
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(x - 0.5, y - 0.5, w + 1, h + 1, 1.5);
    // Warm glow
    g.fillStyle(0xffc864, 1);
    g.fillRoundedRect(x, y, w, h, 1);
    g.fillStyle(0xffe8a8, 0.7);
    g.fillRect(x + 1, y + 1, w - 2, Math.max(1, h - 4));
    // Cross bars
    g.fillStyle(OUTLINE, 1);
    g.fillRect(x + w / 2 - 0.3, y, 0.6, h);
    g.fillRect(x, y + h / 2 - 0.3, w, 0.6);
    // Ledge
    g.fillStyle(0x6a605a, 1);
    g.fillRect(x - 1, y + h, w + 2, 1);
  }

  private makeFarm(race: Race, stage: 'final' | 'stage1' | 'stage2'): void {
    const size = this.buildingSize('farm');
    const g = this.add.graphics();
    const key = this.buildingKey('farm', race, stage);

    if (stage !== 'final') {
      this.drawConstructionBase(g, size, stage);
      g.generateTexture(key, size, size);
      g.destroy();
      return;
    }

    const cx = size / 2;
    const teamColor = RACE_COLOR[race];
    const barnWall = race === 'alliance' ? 0xb8764a : 0x7a4a28;
    const barnLight = race === 'alliance' ? 0xd69064 : 0x9a5a32;
    const roof = race === 'alliance' ? 0x4a2e18 : 0x3a2010;
    const roofLight = race === 'alliance' ? 0x7a4a28 : 0x5a3020;

    // Shadow
    g.fillStyle(0x000000, 0.6);
    g.fillEllipse(cx, size - 3, size * 0.85, 10);

    // Barn body
    g.fillStyle(OUTLINE, 1);
    g.fillRect(6, 22, size - 12, size - 28);
    g.fillStyle(barnWall, 1);
    g.fillRect(7, 23, size - 14, size - 30);
    // Wall planks (vertical)
    g.lineStyle(0.7, roof, 0.8);
    for (let x = 10; x < size - 10; x += 4) {
      g.lineBetween(x, 23, x, size - 7);
    }
    g.fillStyle(barnLight, 0.5);
    g.fillRect(7, 23, 6, size - 30);

    // Stone foundation
    g.fillStyle(0x4a4e52, 1);
    g.fillRect(5, size - 10, size - 10, 6);
    g.fillStyle(0x6a6e72, 1);
    g.fillRect(5, size - 10, size - 10, 2);

    // Roof (two triangles forming peaked roof)
    g.fillStyle(OUTLINE, 1);
    g.beginPath();
    g.moveTo(3, 24);
    g.lineTo(cx, 5);
    g.lineTo(size - 3, 24);
    g.lineTo(size - 6, 23);
    g.lineTo(cx, 10);
    g.lineTo(6, 23);
    g.closePath(); g.fillPath();
    g.fillStyle(roof, 1);
    g.fillTriangle(5, 23, cx, 8, size - 5, 23);
    g.fillStyle(roofLight, 1);
    g.fillTriangle(5, 23, cx, 8, cx, 23);
    // Tile lines
    g.lineStyle(0.7, OUTLINE, 0.6);
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      const yy = Phaser.Math.Linear(23, 8, t);
      const lx = Phaser.Math.Linear(5, cx, t);
      const rx = Phaser.Math.Linear(size - 5, cx, t);
      g.lineBetween(lx, yy, rx, yy);
    }

    // Hay opening (upper barn door)
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 5, 12, 10, 8);
    g.fillStyle(0x1a1410, 1);
    g.fillRect(cx - 4.5, 12.5, 9, 7);
    // Hay sticking out
    g.fillStyle(0xe6c464, 1);
    g.fillTriangle(cx - 4, 19, cx, 16, cx + 4, 19);
    g.fillStyle(0xb8944a, 1);
    g.fillTriangle(cx - 3, 19, cx, 17, cx + 3, 19);

    // Main door (large double doors)
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 7, size - 20, 14, 14);
    g.fillStyle(WOOD_DARK, 1);
    g.fillRect(cx - 6, size - 19, 13, 13);
    // Door split
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 0.5, size - 19, 1, 13);
    // Door cross-beams
    g.fillStyle(WOOD, 1);
    g.fillTriangle(cx - 6, size - 19, cx - 0.5, size - 10, cx - 6, size - 16);
    g.fillTriangle(cx + 0.5, size - 19, cx + 6, size - 16, cx + 6, size - 10);

    // Hay bale beside
    g.fillStyle(OUTLINE, 1);
    g.fillEllipse(9, size - 10, 10, 8);
    g.fillStyle(0xd4b458, 1);
    g.fillEllipse(9, size - 10, 9, 7);
    g.lineStyle(0.6, 0x8a7428, 0.9);
    for (let i = 0; i < 4; i++) {
      g.lineBetween(5, size - 12 + i, 13, size - 12 + i);
    }

    // Weathervane on roof peak
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 0.5, 2, 1, 8);
    g.fillStyle(teamColor, 1);
    g.fillTriangle(cx, 3, cx + 5, 5, cx, 7);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makeBarracks(race: Race, stage: 'final' | 'stage1' | 'stage2'): void {
    const size = this.buildingSize('barracks');
    const g = this.add.graphics();
    const key = this.buildingKey('barracks', race, stage);

    if (stage !== 'final') {
      this.drawConstructionBase(g, size, stage);
      g.generateTexture(key, size, size);
      g.destroy();
      return;
    }

    const cx = size / 2;
    const wallColor = race === 'alliance' ? 0xd0c9b0 : 0xaa9070;
    const wallDark = race === 'alliance' ? 0x9a9372 : 0x6a5538;
    const roof = race === 'alliance' ? 0x2a4e8a : 0x7a1e14;
    const roofLight = race === 'alliance' ? 0x4470a8 : 0xa8382a;
    const teamColor = RACE_COLOR[race];

    // Shadow
    g.fillStyle(0x000000, 0.6);
    g.fillEllipse(cx, size - 4, size * 0.88, 14);

    // Fortress wall body
    g.fillStyle(OUTLINE, 1);
    g.fillRect(6, 22, size - 12, size - 28);
    g.fillStyle(wallColor, 1);
    g.fillRect(7, 23, size - 14, size - 30);
    g.fillStyle(wallDark, 0.5);
    g.fillRect(cx, 23, size / 2 - 7, size - 30);
    // Stone masonry
    g.lineStyle(0.8, wallDark, 0.8);
    for (let y = 28; y < size - 7; y += 10) {
      g.lineBetween(7, y, size - 7, y);
    }
    for (let y = 23; y < size - 7; y += 10) {
      for (let x = 14; x < size - 7; x += 14) {
        g.lineBetween(x, y, x, y + 10);
      }
    }

    // Stone foundation
    g.fillStyle(0x3a3d40, 1);
    g.fillRect(4, size - 12, size - 8, 8);
    g.fillStyle(0x5a5d60, 1);
    g.fillRect(4, size - 12, size - 8, 2);

    // Two small towers at corners
    this.drawRoundTower(g, 3, 12, 12, size - 22, wallColor, wallDark, roof, roofLight);
    this.drawRoundTower(g, size - 15, 12, 12, size - 22, wallColor, wallDark, roof, roofLight);

    // Battlement top on central wall
    g.fillStyle(OUTLINE, 1);
    g.fillRect(16, 18, size - 32, 6);
    g.fillStyle(wallColor, 1);
    g.fillRect(17, 19, size - 34, 4);
    // Crenellations
    g.fillStyle(OUTLINE, 1);
    for (let x = 17; x < size - 17; x += 5) {
      g.fillRect(x, 14, 3, 5);
    }
    g.fillStyle(wallColor, 1);
    for (let x = 17; x < size - 17; x += 5) {
      g.fillRect(x + 0.5, 14.5, 2, 4);
    }

    // Central gate with portcullis
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 10, size - 25, 20, 18);
    g.fillStyle(0x0a0c0e, 1);
    g.fillRect(cx - 9, size - 24, 18, 17);
    // Arch top
    g.fillStyle(0x0a0c0e, 1);
    g.fillEllipse(cx, size - 25, 20, 8);
    // Portcullis bars
    g.lineStyle(1, METAL_DARK, 1);
    for (let x = cx - 8; x <= cx + 8; x += 3) g.lineBetween(x, size - 24, x, size - 8);
    g.lineBetween(cx - 8, size - 18, cx + 8, size - 18);
    // Stone arch outline
    g.lineStyle(1.5, wallDark, 1);
    g.strokeEllipse(cx, size - 25, 20, 8);

    // Crossed swords emblem above gate
    g.lineStyle(2.5, OUTLINE, 1);
    g.lineBetween(cx - 6, 18, cx + 6, 28);
    g.lineBetween(cx + 6, 18, cx - 6, 28);
    g.lineStyle(1.8, METAL, 1);
    g.lineBetween(cx - 6, 18, cx + 6, 28);
    g.lineBetween(cx + 6, 18, cx - 6, 28);
    g.fillStyle(teamColor, 1);
    g.fillCircle(cx, 23, 2.5);
    g.fillStyle(0x000000, 0.4);
    g.fillCircle(cx + 0.5, 23.5, 1);

    // Windows on tower bodies handled by drawRoundTower arrow slit already
    // Additional windows on wall
    this.drawWindow(g, 22, 30, 5, 6);
    this.drawWindow(g, size - 27, 30, 5, 6);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makeWorkshop(race: Race, stage: 'final' | 'stage1' | 'stage2'): void {
    const size = this.buildingSize('workshop');
    const g = this.add.graphics();
    const key = this.buildingKey('workshop', race, stage);

    if (stage !== 'final') {
      this.drawConstructionBase(g, size, stage);
      g.generateTexture(key, size, size);
      g.destroy();
      return;
    }

    const cx = size / 2;
    const wallColor = race === 'alliance' ? 0xa08866 : 0x806040;
    const wallDark = race === 'alliance' ? 0x705a3a : 0x503020;
    const roof = race === 'alliance' ? 0x3a2a1a : 0x2a1a0a;
    const teamColor = RACE_COLOR[race];

    // Shadow
    g.fillStyle(0x000000, 0.6);
    g.fillEllipse(cx, size - 4, size * 0.88, 14);

    // Main body (industrial shed with tall shape)
    g.fillStyle(OUTLINE, 1);
    g.fillRect(6, 18, size - 12, size - 24);
    g.fillStyle(wallColor, 1);
    g.fillRect(7, 19, size - 14, size - 26);
    g.fillStyle(wallDark, 0.6);
    g.fillRect(cx, 19, size / 2 - 7, size - 26);

    // Stone base
    g.fillStyle(0x3a3d40, 1);
    g.fillRect(4, size - 12, size - 8, 8);
    g.fillStyle(0x5a5d60, 1);
    g.fillRect(4, size - 12, size - 8, 2);

    // Wooden planks on upper half
    g.fillStyle(WOOD_DARK, 1);
    g.fillRect(8, 20, size - 16, 16);
    g.fillStyle(WOOD, 1);
    g.fillRect(8, 20, size - 16, 14);
    g.lineStyle(0.7, WOOD_DARK, 1);
    for (let y = 22; y < 34; y += 3) g.lineBetween(8, y, size - 8, y);

    // Sloped workshop roof (asymmetric)
    g.fillStyle(OUTLINE, 1);
    g.beginPath();
    g.moveTo(4, 22); g.lineTo(size - 18, 4); g.lineTo(size - 4, 22);
    g.closePath(); g.fillPath();
    g.fillStyle(roof, 1);
    g.fillTriangle(5, 21, size - 18, 6, size - 5, 21);
    g.fillStyle(0x5a4228, 1);
    g.fillTriangle(5, 21, size - 18, 6, cx - 8, 21);
    // Roof plank lines
    g.lineStyle(0.6, OUTLINE, 0.8);
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      const yy = 21 - t * 15;
      const lx = Phaser.Math.Linear(5, size - 18, t);
      const rx = Phaser.Math.Linear(size - 5, size - 18, t);
      g.lineBetween(lx, yy, rx, yy);
    }

    // Tall chimney
    g.fillStyle(OUTLINE, 1);
    g.fillRect(size - 22, 0, 8, 18);
    g.fillStyle(0x3a3d40, 1);
    g.fillRect(size - 21, 1, 6, 17);
    g.fillStyle(0x5a5d60, 1);
    g.fillRect(size - 21, 1, 2, 17);
    // Chimney cap
    g.fillStyle(OUTLINE, 1);
    g.fillRect(size - 24, 0, 12, 3);
    g.fillStyle(0x6a6d70, 1);
    g.fillRect(size - 23, 0, 10, 2);
    // Mortar bricks
    g.lineStyle(0.5, 0x1a1d20, 1);
    for (let y = 4; y < 17; y += 4) g.lineBetween(size - 21, y, size - 15, y);

    // Big workshop doors (double swing)
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 12, size - 26, 24, 20);
    g.fillStyle(WOOD_DARK, 1);
    g.fillRect(cx - 11, size - 25, 22, 19);
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 0.5, size - 25, 1, 19);
    // Metal hinges
    g.fillStyle(METAL_DARK, 1);
    g.fillRect(cx - 11, size - 22, 4, 1.5);
    g.fillRect(cx - 11, size - 12, 4, 1.5);
    g.fillRect(cx + 7, size - 22, 4, 1.5);
    g.fillRect(cx + 7, size - 12, 4, 1.5);
    // X-braces
    g.lineStyle(1.5, WOOD, 1);
    g.lineBetween(cx - 10, size - 25, cx - 1, size - 7);
    g.lineBetween(cx - 1, size - 25, cx - 10, size - 7);
    g.lineBetween(cx + 1, size - 25, cx + 10, size - 7);
    g.lineBetween(cx + 10, size - 25, cx + 1, size - 7);

    // Gear wheel decoration
    this.drawGear(g, 18, 28, 6, METAL_DARK, METAL);

    // Anvil silhouette on side
    g.fillStyle(OUTLINE, 1);
    g.fillRect(size - 22, size - 22, 10, 3);
    g.fillRect(size - 18, size - 19, 5, 4);
    g.fillRect(size - 20, size - 15, 9, 2);
    g.fillStyle(METAL_DARK, 1);
    g.fillRect(size - 21, size - 21.5, 8, 2);
    g.fillRect(size - 17, size - 19, 4, 3);
    g.fillRect(size - 19, size - 15, 7, 1.5);

    // Team pennant
    g.fillStyle(OUTLINE, 1);
    g.fillRect(8, 10, 1, 14);
    g.fillStyle(teamColor, 1);
    g.fillTriangle(9, 11, 16, 14, 9, 17);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private drawGear(g: G, cx: number, cy: number, r: number, dark: number, light: number): void {
    const teeth = 8;
    g.fillStyle(OUTLINE, 1);
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const tx = cx + Math.cos(a) * (r + 1.2);
      const ty = cy + Math.sin(a) * (r + 1.2);
      g.fillRect(tx - 1.2, ty - 1.2, 2.4, 2.4);
    }
    g.fillCircle(cx, cy, r);
    g.fillStyle(dark, 1);
    g.fillCircle(cx, cy, r - 0.8);
    g.fillStyle(light, 1);
    g.fillCircle(cx - r * 0.3, cy - r * 0.3, r * 0.4);
    // Inner hole
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(cx, cy, r * 0.3);
  }

  private makeTower(race: Race, stage: 'final' | 'stage1' | 'stage2'): void {
    const size = this.buildingSize('tower');
    const g = this.add.graphics();
    const key = this.buildingKey('tower', race, stage);

    if (stage !== 'final') {
      this.drawConstructionBase(g, size, stage);
      g.generateTexture(key, size, size);
      g.destroy();
      return;
    }

    const cx = size / 2;
    const wallColor = race === 'alliance' ? 0xcac3ab : 0xa89870;
    const wallDark = race === 'alliance' ? 0x948c70 : 0x6a5538;
    const roof = race === 'alliance' ? 0x2a4e8a : 0x7a1e14;
    const roofLight = race === 'alliance' ? 0x4470a8 : 0xa8382a;
    const teamColor = RACE_COLOR[race];

    // Shadow
    g.fillStyle(0x000000, 0.55);
    g.fillEllipse(cx, size - 4, size * 0.7, 10);

    // Foundation
    g.fillStyle(0x3a3d40, 1);
    g.fillRect(10, size - 10, size - 20, 6);
    g.fillStyle(0x5a5d60, 1);
    g.fillRect(10, size - 10, size - 20, 2);

    // Tower shaft (tall thin)
    const tx = 14, tw = size - 28;
    g.fillStyle(OUTLINE, 1);
    g.fillRoundedRect(tx - 1, 18 - 1, tw + 2, size - 28 + 2, 3);
    g.fillStyle(wallColor, 1);
    g.fillRoundedRect(tx, 18, tw, size - 28, 2.5);
    g.fillStyle(wallDark, 0.6);
    g.fillRect(cx, 18, tw / 2, size - 28);
    // Masonry
    g.lineStyle(0.7, wallDark, 0.85);
    for (let y = 24; y < size - 12; y += 7) g.lineBetween(tx, y, tx + tw, y);
    for (let y = 20; y < size - 12; y += 7) {
      for (let x = tx + 5; x < tx + tw; x += 7) g.lineBetween(x, y, x, y + 7);
    }
    for (let y = 24; y < size - 12; y += 7) {
      for (let x = tx + 1; x < tx + tw; x += 7) g.lineBetween(x, y, x, y + 7);
    }

    // Battlements at top of shaft
    g.fillStyle(OUTLINE, 1);
    g.fillRect(tx - 3, 14, tw + 6, 6);
    g.fillStyle(wallColor, 1);
    g.fillRect(tx - 2, 15, tw + 4, 4);
    g.fillStyle(OUTLINE, 1);
    for (let x = tx - 2; x < tx + tw + 2; x += 4) {
      g.fillRect(x, 10, 2.5, 5);
    }
    g.fillStyle(wallColor, 1);
    for (let x = tx - 2; x < tx + tw + 2; x += 4) {
      g.fillRect(x + 0.3, 10.3, 1.9, 4.4);
    }

    // Pointed roof
    g.fillStyle(OUTLINE, 1);
    g.fillTriangle(tx - 4, 10, cx, 0, tx + tw + 4, 10);
    g.fillStyle(roof, 1);
    g.fillTriangle(tx - 3, 10, cx, 2, tx + tw + 3, 10);
    g.fillStyle(roofLight, 1);
    g.fillTriangle(tx - 3, 10, cx, 2, cx, 10);
    g.lineStyle(0.6, OUTLINE, 0.7);
    for (let i = 1; i < 3; i++) {
      const t = i / 3;
      const yy = Phaser.Math.Linear(10, 2, t);
      const lx = Phaser.Math.Linear(tx - 3, cx, t);
      const rx = Phaser.Math.Linear(tx + tw + 3, cx, t);
      g.lineBetween(lx, yy, rx, yy);
    }

    // Arrow slit window
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 1, 22, 2, 7);
    g.fillRect(cx - 1.5, 23, 3, 2);
    g.fillStyle(0x0a0c0e, 1);
    g.fillRect(cx - 0.5, 23, 1, 6);

    // Door at base
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 4, size - 22, 8, 12);
    g.fillStyle(WOOD_DARK, 1);
    g.fillRect(cx - 3.3, size - 21.5, 6.6, 11.5);
    g.fillStyle(WOOD, 1);
    g.fillRect(cx - 3, size - 21, 3, 11);
    // Hinges
    g.fillStyle(METAL_DARK, 1);
    g.fillRect(cx - 3.3, size - 19, 2, 1);
    g.fillRect(cx - 3.3, size - 12, 2, 1);

    // Team banner
    g.fillStyle(OUTLINE, 1);
    g.fillRect(cx - 0.5, 0, 1, 6);
    g.fillStyle(teamColor, 1);
    g.fillTriangle(cx, 1, cx + 5, 3, cx, 5);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makeBuildingDamaged(kind: BuildingKind, race: Race): void {
    // Damage overlay — cracks and soot (designed to be blended with MULTIPLY)
    const size = this.buildingSize(kind);
    const g = this.add.graphics();
    // Start transparent
    g.fillStyle(0xffffff, 0);
    g.fillRect(0, 0, size, size);

    // Soot patches (dark)
    const sootCount = 4;
    for (let i = 0; i < sootCount; i++) {
      const x = Math.random() * size;
      const y = 20 + Math.random() * (size - 40);
      const r = 4 + Math.random() * 6;
      g.fillStyle(0x1a1410, 0.55);
      g.fillEllipse(x, y, r * 2, r);
    }

    // Cracks (jagged lines)
    g.lineStyle(1.5, 0x1a1410, 0.85);
    const cracks = 4;
    for (let i = 0; i < cracks; i++) {
      let px = 8 + Math.random() * (size - 16);
      let py = 16 + Math.random() * (size - 30);
      g.beginPath();
      g.moveTo(px, py);
      const segs = 4 + Math.floor(Math.random() * 3);
      for (let s = 0; s < segs; s++) {
        px += (Math.random() - 0.5) * 10;
        py += 3 + Math.random() * 6;
        g.lineTo(px, py);
      }
      g.strokePath();
    }

    // Small holes
    for (let i = 0; i < 3; i++) {
      const x = 10 + Math.random() * (size - 20);
      const y = 20 + Math.random() * (size - 35);
      g.fillStyle(0x0a0806, 1);
      g.fillCircle(x, y, 2 + Math.random() * 1.5);
      g.fillStyle(0x3a1a0a, 1);
      g.fillCircle(x - 0.5, y - 0.5, 1);
    }

    g.generateTexture(`building_${kind}_${race}_damaged`, size, size);
    g.destroy();
  }

  // ---------------- PROJECTILES ----------------

  private makeProjectile(key: string, color: number, dark: number, w: number, r: number): void {
    const g = this.add.graphics();
    const H = Math.max(6, r * 2 + 4);
    // Shaft
    g.fillStyle(0x000000, 0.5);
    g.fillRoundedRect(1, H / 2 - r * 0.6, w, r * 1.2, r * 0.5);
    g.fillStyle(WOOD, 1);
    g.fillRoundedRect(0, H / 2 - r * 0.55, w * 0.7, r * 1.1, r * 0.45);
    g.fillStyle(WOOD_DARK, 1);
    g.fillRect(0, H / 2, w * 0.7, 1);
    // Arrowhead
    g.fillStyle(OUTLINE, 1);
    g.fillTriangle(w * 0.65, H / 2 - r - 1, w + 1, H / 2, w * 0.65, H / 2 + r + 1);
    g.fillStyle(color, 1);
    g.fillTriangle(w * 0.68, H / 2 - r, w, H / 2, w * 0.68, H / 2 + r);
    g.fillStyle(0xffffff, 0.7);
    g.fillTriangle(w * 0.7, H / 2 - r * 0.7, w * 0.95, H / 2 - 0.5, w * 0.75, H / 2);
    // Fletching (at back)
    g.fillStyle(dark, 1);
    g.fillTriangle(0, H / 2 - r * 0.9, 3, H / 2 - 0.2, 0, H / 2);
    g.fillTriangle(0, H / 2 + r * 0.9, 3, H / 2 + 0.2, 0, H / 2);
    g.generateTexture(key, w + 2, H);
    g.destroy();
  }

  private makeStoneProjectile(key: string): void {
    const W = 14, H = 14;
    const g = this.add.graphics();
    const cx = W / 2, cy = H / 2;
    // Rough round stone
    g.fillStyle(0x000000, 0.55);
    g.fillEllipse(cx + 1, cy + 1, 12, 10);
    g.fillStyle(0x4a5258, 1);
    g.fillCircle(cx, cy, 6);
    g.fillStyle(0x6a7278, 1);
    g.fillCircle(cx - 1, cy - 1, 5);
    g.fillStyle(0x8a9298, 1);
    g.fillCircle(cx - 2, cy - 2, 2.5);
    // Crack detail
    g.lineStyle(0.5, 0x2a3238, 1);
    g.lineBetween(cx - 2, cy + 2, cx + 3, cy - 1);
    g.lineStyle(1, OUTLINE, 0.7);
    g.strokeCircle(cx, cy, 6);
    g.generateTexture(key, W, H);
    g.destroy();
  }

  private makeMagicProjectile(key: string, core: number, glow: number): void {
    const W = 14, H = 14;
    const g = this.add.graphics();
    const cx = W / 2, cy = H / 2;
    // Outer glow
    g.fillStyle(glow, 0.5);
    g.fillCircle(cx, cy, 6.5);
    g.fillStyle(glow, 0.8);
    g.fillCircle(cx, cy, 4.5);
    // Core
    g.fillStyle(core, 1);
    g.fillCircle(cx, cy, 3);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(cx - 0.7, cy - 0.7, 1.5);
    g.generateTexture(key, W, H);
    g.destroy();
  }

  // ---------------- PARTICLES ----------------

  private makeParticleTextures(): void {
    this.makeSoftDisc('px_smoke_light', 16, 0xcfcfcf, 0.9);
    this.makeSoftDisc('px_smoke_dark', 16, 0x202020, 0.95);
    this.makeSoftDisc('px_dust', 14, 0xbfa878, 0.9);
    this.makeSoftDisc('px_mist', 22, 0xbfd4e0, 0.65);
    this.makeSoftDisc('px_glow', 24, 0xffe088, 0.9);
    this.makeEmber('px_ember');
    this.makeRune('px_rune');
    this.makeCrater('px_crater');
    this.makeArrowTrail('px_arrow_trail');
    this.makeSpark('px_spark');
    this.makeFlame('px_flame');
    this.makeBlood('px_blood');
    this.makeLeaf('px_leaf');
    this.makeStar('px_star');
    this.makeDebris('px_debris_1', 0x6a4a28, 8, 6);
    this.makeDebris('px_debris_2', 0x8a8a8a, 7, 7);
    this.makeDebris('px_debris_3', 0x4a3020, 9, 4);
    this.makeShockwave('px_shockwave');
  }

  private makeSoftDisc(key: string, diameter: number, color: number, maxAlpha: number): void {
    const g = this.add.graphics();
    const r = diameter / 2;
    // Enhanced multi-ring soft blur with intense bright core
    const rings = 8;
    for (let i = rings; i >= 1; i--) {
      const t = i / rings;
      // Use easing for smoother outer falloff and denser core
      const easeT = Math.pow(t, 1.5);
      g.fillStyle(color, maxAlpha * (1 - easeT) * 0.6);
      g.fillCircle(r, r, r * easeT);
    }
    g.fillStyle(color, maxAlpha * 0.95);
    g.fillCircle(r, r, r * 0.25);
    g.fillStyle(0xffffff, maxAlpha * 0.8);
    g.fillCircle(r, r, r * 0.08); // Additive white core for extra pop
    g.generateTexture(key, diameter, diameter);
    g.destroy();
  }

  private makeSpark(key: string): void {
    const g = this.add.graphics();
    // Bright star-like spark
    g.fillStyle(0xffffff, 1);
    g.fillCircle(8, 8, 3);
    g.fillStyle(0xffee88, 0.9);
    g.fillCircle(8, 8, 5);
    g.fillStyle(0xffc040, 0.55);
    g.fillCircle(8, 8, 7);
    // Cross rays
    g.lineStyle(1, 0xffffff, 0.9);
    g.lineBetween(2, 8, 14, 8);
    g.lineBetween(8, 2, 8, 14);
    g.generateTexture(key, 16, 16);
    g.destroy();
  }

  private makeFlame(key: string): void {
    const g = this.add.graphics();
    // Teardrop flame
    g.fillStyle(0xff4a1a, 1);
    g.fillCircle(8, 10, 6);
    g.fillTriangle(8, 1, 4, 8, 12, 8);
    g.fillStyle(0xff8a3a, 1);
    g.fillCircle(8, 11, 4);
    g.fillTriangle(8, 3, 5, 9, 11, 9);
    g.fillStyle(0xffd86a, 0.9);
    g.fillCircle(8, 11.5, 2.2);
    g.fillStyle(0xffffff, 0.7);
    g.fillCircle(8, 12, 1);
    g.generateTexture(key, 16, 18);
    g.destroy();
  }

  private makeBlood(key: string): void {
    const g = this.add.graphics();
    g.fillStyle(0x5a0a0a, 1);
    g.fillCircle(5, 5, 3.5);
    g.fillStyle(0x980808, 1);
    g.fillCircle(5, 5, 2.8);
    g.fillStyle(0xc82020, 1);
    g.fillCircle(5, 5, 1.6);
    g.fillStyle(0xff4040, 0.8);
    g.fillCircle(4, 4, 0.8);
    g.generateTexture(key, 10, 10);
    g.destroy();
  }

  private makeLeaf(key: string): void {
    const g = this.add.graphics();
    // Oval leaf with vein
    g.fillStyle(0x2a5a28, 1);
    g.fillEllipse(4, 5, 7, 4);
    g.fillStyle(0x4a8a38, 1);
    g.fillEllipse(4, 5, 5.5, 3);
    g.lineStyle(0.5, 0x1a3a18, 1);
    g.lineBetween(1, 5, 7, 5);
    g.generateTexture(key, 8, 10);
    g.destroy();
  }

  private makeStar(key: string): void {
    const g = this.add.graphics();
    g.fillStyle(0xfff8c8, 1);
    g.fillCircle(6, 6, 2);
    g.lineStyle(1.5, 0xfff8c8, 1);
    g.lineBetween(6, 1, 6, 11);
    g.lineBetween(1, 6, 11, 6);
    g.lineStyle(1, 0xffd86a, 1);
    g.lineBetween(3, 3, 9, 9);
    g.lineBetween(9, 3, 3, 9);
    g.generateTexture(key, 12, 12);
    g.destroy();
  }

  private makeEmber(key: string): void {
    const g = this.add.graphics();
    g.fillStyle(0xff3a12, 0.45);
    g.fillCircle(5, 5, 5);
    g.fillStyle(0xff8a24, 0.82);
    g.fillCircle(5, 5, 3);
    g.fillStyle(0xfff0a0, 1);
    g.fillCircle(4.4, 4.3, 1.3);
    g.generateTexture(key, 10, 10);
    g.destroy();
  }

  private makeRune(key: string): void {
    const g = this.add.graphics();
    g.lineStyle(1.5, 0x9bd8ff, 0.9);
    g.strokeCircle(6, 6, 4.5);
    g.lineStyle(1, 0xffffff, 0.85);
    g.lineBetween(6, 1, 6, 11);
    g.lineBetween(2, 8, 10, 4);
    g.fillStyle(0x9bd8ff, 0.65);
    g.fillCircle(6, 6, 1.5);
    g.generateTexture(key, 12, 12);
    g.destroy();
  }

  private makeCrater(key: string): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0);
    g.fillRect(0, 0, 42, 28);
    g.fillStyle(0x1a1410, 0.7);
    g.fillEllipse(21, 16, 36, 18);
    g.fillStyle(0x3a2a1a, 0.45);
    g.fillEllipse(18, 12, 24, 10);
    g.lineStyle(1, 0x000000, 0.55);
    g.strokeEllipse(21, 16, 34, 17);
    g.lineStyle(1, 0x6a4a28, 0.35);
    g.lineBetween(8, 14, 2, 10);
    g.lineBetween(31, 17, 40, 13);
    g.lineBetween(20, 23, 24, 27);
    g.generateTexture(key, 42, 28);
    g.destroy();
  }

  private makeArrowTrail(key: string): void {
    const g = this.add.graphics();
    g.fillStyle(0xfff0b0, 0.15);
    g.fillTriangle(0, 3, 18, 0, 18, 6);
    g.fillStyle(0xffd36a, 0.45);
    g.fillTriangle(3, 3, 18, 1.5, 18, 4.5);
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(12, 2.5, 6, 1);
    g.generateTexture(key, 18, 6);
    g.destroy();
  }

  private makeDebris(key: string, color: number, w: number, h: number): void {
    const g = this.add.graphics();
    // Chunky irregular piece
    g.fillStyle(OUTLINE, 1);
    g.beginPath();
    g.moveTo(0, 1); g.lineTo(w - 1, 0); g.lineTo(w, h - 1); g.lineTo(1, h);
    g.closePath(); g.fillPath();
    g.fillStyle(color, 1);
    g.beginPath();
    g.moveTo(1, 2); g.lineTo(w - 2, 1); g.lineTo(w - 1, h - 2); g.lineTo(2, h - 1);
    g.closePath(); g.fillPath();
    const lc = Phaser.Display.Color.ValueToColor(color).lighten(25).color;
    g.fillStyle(lc, 0.8);
    g.fillRect(2, 2, Math.max(1, w - 5), Math.max(1, Math.floor(h / 3)));
    g.generateTexture(key, w + 1, h + 1);
    g.destroy();
  }

  private makeShockwave(key: string): void {
    const D = 48;
    const g = this.add.graphics();
    const r = D / 2;
    // Ring with soft gradient
    for (let i = 0; i < 6; i++) {
      const alpha = 0.15 + (5 - i) * 0.15;
      g.lineStyle(1 + i * 0.3, 0xffffff, alpha * 0.9);
      g.strokeCircle(r, r, r - 2 - i * 2);
    }
    g.lineStyle(2, 0xffffff, 1);
    g.strokeCircle(r, r, r - 3);
    g.generateTexture(key, D, D);
    g.destroy();
  }

  // ---------------- CURSORS ----------------

  private makeCursors(): void {
    this.makeCursor('cursor_default', (g) => {
      g.fillStyle(OUTLINE, 1);
      g.fillTriangle(0, 0, 10, 10, 0, 14);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(1, 2, 8, 9, 1, 12);
      g.fillStyle(0xffd86a, 0.9);
      g.fillTriangle(2, 3, 7, 8, 2, 9);
    }, 14, 16);

    this.makeCursor('cursor_attack', (g) => {
      const c = 10;
      g.lineStyle(2, OUTLINE, 1);
      g.strokeCircle(c, c, 8);
      g.fillStyle(OUTLINE, 1);
      g.fillRect(c - 0.7, 0, 1.4, 5);
      g.fillRect(c - 0.7, c + 6, 1.4, 5);
      g.fillRect(0, c - 0.7, 5, 1.4);
      g.fillRect(c + 6, c - 0.7, 5, 1.4);
      g.lineStyle(1, 0xff4040, 1);
      g.strokeCircle(c, c, 8);
      g.fillStyle(0xff4040, 1);
      g.fillRect(c - 0.5, 0, 1, 4.5);
      g.fillRect(c - 0.5, c + 6, 1, 4.5);
      g.fillRect(0, c - 0.5, 4.5, 1);
      g.fillRect(c + 6, c - 0.5, 4.5, 1);
      g.fillCircle(c, c, 1.2);
    }, 20, 20);

    this.makeCursor('cursor_build_ok', (g) => {
      g.lineStyle(2, OUTLINE, 1);
      g.strokeRoundedRect(1, 1, 14, 14, 2);
      g.lineStyle(1.5, 0x44ff44, 1);
      g.strokeRoundedRect(1.5, 1.5, 13, 13, 2);
      g.fillStyle(0x44ff44, 0.25);
      g.fillRoundedRect(2, 2, 12, 12, 2);
      g.lineStyle(1.5, OUTLINE, 1);
      g.beginPath();
      g.moveTo(4, 8); g.lineTo(7, 11); g.lineTo(12, 5);
      g.strokePath();
      g.lineStyle(1.2, 0xffffff, 1);
      g.beginPath();
      g.moveTo(4, 8); g.lineTo(7, 11); g.lineTo(12, 5);
      g.strokePath();
    }, 16, 16);

    this.makeCursor('cursor_build_no', (g) => {
      g.lineStyle(2, OUTLINE, 1);
      g.strokeRoundedRect(1, 1, 14, 14, 2);
      g.lineStyle(1.5, 0xff4040, 1);
      g.strokeRoundedRect(1.5, 1.5, 13, 13, 2);
      g.fillStyle(0xff4040, 0.25);
      g.fillRoundedRect(2, 2, 12, 12, 2);
      g.lineStyle(2, OUTLINE, 1);
      g.lineBetween(4, 4, 12, 12);
      g.lineBetween(12, 4, 4, 12);
      g.lineStyle(1.4, 0xff4040, 1);
      g.lineBetween(4, 4, 12, 12);
      g.lineBetween(12, 4, 4, 12);
    }, 16, 16);

    this.makeCursor('cursor_gather', (g) => {
      // Pickaxe cursor
      g.lineStyle(2.5, OUTLINE, 1);
      g.lineBetween(2, 14, 13, 3);
      g.lineStyle(1.5, WOOD, 1);
      g.lineBetween(2, 14, 13, 3);
      g.fillStyle(OUTLINE, 1);
      g.fillTriangle(10, 1, 16, 1, 13, 7);
      g.fillTriangle(15, 5, 16, 9, 10, 7);
      g.fillStyle(METAL, 1);
      g.fillTriangle(11, 2, 15, 2, 13, 6);
      g.fillTriangle(14, 6, 15, 8, 11, 6.5);
    }, 18, 18);
  }

  private makeCursor(key: string, draw: (g: G) => void, w: number, h: number): void {
    const g = this.add.graphics();
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  // ---------------- VIGNETTE ----------------

  private makeVignette(): void {
    const W = VIEW_W, H = VIEW_H;
    const g = this.add.graphics();
    // Radial darkening — emulate with many concentric ellipses from outside in
    const cx = W / 2, cy = H / 2;
    const rings = 40;
    const maxR = Math.hypot(cx, cy);
    for (let i = 0; i < rings; i++) {
      const t = i / rings;
      const alpha = Math.pow(t, 2.2) * 0.55;
      g.fillStyle(0x000000, alpha);
      const r = maxR * (1 - t);
      g.fillEllipse(cx, cy, r * 2, r * 2 * (H / W));
    }
    g.generateTexture('vignette_overlay', W, H);
    g.destroy();
  }

  // ---------------- SELECTION RINGS ----------------

  private makeSelectionRing(key: string, r: number): void {
    const g = this.add.graphics();
    const size = (r + 4) * 2;
    const c = size / 2;
    // Outer soft ring (shadow)
    g.lineStyle(3, 0x000000, 0.55);
    g.strokeCircle(c, c, r + 0.5);
    // Inner white ring
    g.lineStyle(1.5, 0xffffff, 0.95);
    g.strokeCircle(c, c, r);
    // Dashed inner detail
    g.lineStyle(1, 0xffffff, 0.7);
    const dashes = 16;
    for (let i = 0; i < dashes; i++) {
      if (i % 2) continue;
      const a0 = (i / dashes) * Math.PI * 2;
      const a1 = ((i + 1) / dashes) * Math.PI * 2;
      g.beginPath();
      g.arc(c, c, r - 3, a0, a1, false);
      g.strokePath();
    }
    g.generateTexture(key, size, size);
    g.destroy();
  }

  private makePixel(): void {
    const g = this.add.graphics();
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 2, 2);
    g.generateTexture('pixel', 2, 2);
    g.destroy();
  }
}
