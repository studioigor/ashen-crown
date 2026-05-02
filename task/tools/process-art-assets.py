#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/assets/art/source"
OUT = ROOT / "public/assets/art"
SAMPLE = ROOT / "task/art-sample"
DEBUG = ROOT / "task/art-sample/normalized"

UNIT_DIRECTIONS = ["south", "east", "north", "west"]
SOURCE_DIRECTIONS = ["south", "east", "north"]

UNIT_FRAME_SCALE = 1.5
UNIT_FRAME = (192, 192)
CARAVAN_FRAME = (288, 192)
TERRAIN_TILE_SIZE = 64
ICON_SIZE = 128

UNIT_DISPLAY = {
    "worker": (40, 40),
    "footman": (44, 44),
    "archer": (44, 44),
    "knight": (52, 52),
    "catapult": (48, 48),
}

UNIT_TARGET_BASE_HEIGHT = {
    "worker": round(104 * UNIT_FRAME_SCALE),
    "footman": round(106 * UNIT_FRAME_SCALE),
    "archer": round(104 * UNIT_FRAME_SCALE),
    "knight": round(116 * UNIT_FRAME_SCALE),
    "catapult": round(104 * UNIT_FRAME_SCALE),
    "caravan": round(112 * UNIT_FRAME_SCALE),
}

BUILDING_FRAME = {
    "townhall": (384, 384),
    "farm": (256, 256),
    "barracks": (384, 384),
    "workshop": (384, 384),
    "tower": (256, 256),
}

BUILDING_DISPLAY = {
    "townhall": (144, 144),
    "farm": (96, 96),
    "barracks": (144, 144),
    "workshop": (144, 144),
    "tower": (128, 128),
}

UNIT_SOURCES = [
    ("alliance", "worker", SOURCE / "units_alliance_worker.png"),
    ("alliance", "footman", SOURCE / "units_alliance_footman.png"),
    ("alliance", "archer", SOURCE / "units_alliance_archer.png"),
    ("alliance", "knight", SOURCE / "units_alliance_knight.png"),
    ("alliance", "catapult", SOURCE / "units_alliance_catapult.png"),
    ("horde", "worker", SOURCE / "units_horde_worker.png"),
    ("horde", "footman", SOURCE / "units_horde_footman.png"),
    ("horde", "archer", SOURCE / "units_horde_archer.png"),
    ("horde", "knight", SOURCE / "units_horde_knight.png"),
    ("horde", "catapult", SOURCE / "units_horde_catapult.png"),
]

BUILDING_SOURCES = [
    ("alliance", "townhall", SOURCE / "building_alliance_townhall.png"),
    ("alliance", "farm", SOURCE / "building_alliance_farm.png"),
    ("alliance", "barracks", SOURCE / "building_alliance_barracks.png"),
    ("alliance", "workshop", SOURCE / "building_alliance_workshop.png"),
    ("alliance", "tower", SOURCE / "building_alliance_tower.png"),
    ("horde", "townhall", SOURCE / "building_horde_townhall.png"),
    ("horde", "farm", SOURCE / "building_horde_farm.png"),
    ("horde", "barracks", SOURCE / "building_horde_barracks.png"),
    ("horde", "workshop", SOURCE / "building_horde_workshop.png"),
    ("horde", "tower", SOURCE / "building_horde_tower.png"),
]

TERRAIN_NAMES = ["tile_grass", "tile_grass2", "tile_dirt", "tile_forest", "tile_stone", "tile_water_0", "tile_water_1", "tile_water_2"]

RESOURCE_ASSETS = {
    "goldmine": ((261, 205), (192, 192), "center"),
    "goldmine_damaged": ((702, 215), (192, 192), "center"),
    "goldmine_depleted": ((1102, 220), (192, 192), "center"),
    "tree": ((1493, 221), (96, 96), "bottom"),
    "tree_stump": ((194, 503), (96, 96), "bottom"),
    "tree_log": ((562, 510), (80, 48), "center"),
    "tree_trunk": ((827, 503), (40, 60), "center"),
    "tree_canopy": ((1125, 503), (72, 72), "center"),
}

DECAL_ASSETS = {
    "decal_flower_0": ((124, 681), (40, 48), "bottom"),
    "decal_flower_1": ((290, 681), (40, 48), "bottom"),
    "decal_flower_2": ((451, 682), (40, 48), "bottom"),
    "decal_flower_3": ((607, 680), (40, 48), "bottom"),
    "decal_flower_4": ((761, 682), (40, 48), "bottom"),
    "decal_pebble_0": ((951, 691), (32, 24), "center"),
    "decal_pebble_1": ((1078, 689), (32, 24), "center"),
    "decal_twig": ((1269, 689), (64, 36), "center"),
    "decal_mushroom_0": ((1443, 683), (40, 48), "bottom"),
    "decal_mushroom_1": ((1576, 688), (40, 48), "bottom"),
    "decal_tuft_0": ((178, 838), (48, 40), "bottom"),
    "decal_tuft_1": ((409, 831), (64, 48), "bottom"),
    "decal_dirt_patch": ((1028, 845), (96, 48), "center"),
    "decal_rock_pile": ((1369, 841), (96, 52), "center"),
}

FX_ASSETS = {
    "projectile_arrow": ((188, 151), (32, 16)),
    "projectile_stone": ((425, 154), (28, 28)),
    "projectile_tower": ((702, 152), (36, 36)),
    "px_spark": ((956, 162), (32, 32)),
    "px_flame": ((1162, 153), (36, 36)),
    "px_blood": ((1345, 163), (24, 32)),
    "px_leaf": ((1519, 151), (32, 32)),
    "px_star": ((199, 335), (32, 32)),
    "px_ember": ((425, 354), (24, 24)),
    "px_rune": ((657, 340), (36, 44)),
    "px_crater": ((949, 351), (68, 48)),
    "px_arrow_trail": ((1401, 345), (76, 20)),
    "px_debris_1": ((175, 557), (28, 28)),
    "px_debris_2": ((353, 555), (28, 28)),
    "px_debris_3": ((530, 555), (28, 28)),
    "px_smoke_dark": ((175, 760), (48, 48)),
    "px_dust": ((425, 760), (48, 48)),
    "px_smoke_light": ((701, 760), (56, 56)),
    "px_mist": ((1100, 760), (56, 44)),
    "px_shockwave": ((1400, 760), (72, 72)),
    "px_glow": ((1545, 760), (40, 40)),
}

CURSOR_ASSETS = {
    "cursor_default": ((204, 185), (32, 32)),
    "cursor_attack": ((486, 193), (32, 32)),
    "cursor_build_ok": ((802, 186), (36, 36)),
    "cursor_build_no": ((1122, 186), (36, 36)),
    "cursor_gather": ((1435, 192), (36, 36)),
    "ring_select_s": ((180, 474), (36, 24)),
    "ring_select_m": ((509, 473), (52, 34)),
    "ring_select_l": ((932, 471), (72, 44)),
}

UI_FRAME_ASSETS = {
    "panel_frame": ((498, 742), (512, 168), "ui_panel_frame"),
    "tooltip_frame": ((770, 363), (256, 192), "ui_tooltip_frame"),
    "minimap_frame": ((247, 385), (192, 192), "ui_minimap_frame"),
}

ICON_NAMES = [
    "stop", "attack_move", "build", "repair", "rally",
    "worker", "footman", "archer", "knight", "catapult",
    "return_cargo", "gather_gold", "gather_lumber", "patrol", "hold_position",
    "autopilot", "formation", "support", "gold", "lumber",
]

UNIT_RUNTIME_SEQUENCES = {
    "worker": {
        "idle": [("idle", 0), ("idle", -1), ("idle", 0), ("idle", 1)],
        "walk": [("walk_a", 0), ("idle", -1), ("walk_b", 0), ("idle", 1), ("walk_a", 0), ("idle", -1), ("walk_b", 0), ("idle", 1)],
        "attack": [("idle", 0), ("attack_windup", -1), ("attack_strike", 0), ("attack_strike", 1), ("attack_windup", 0), ("idle", 0)],
        "death": [("idle", 0), ("death_fall", 0), ("death_fall", 1), ("corpse", 2), ("corpse", 2), ("corpse", 2), ("corpse", 2), ("corpse", 2)],
        "work": [("idle", 0), ("work_windup", -1), ("work_strike", 0), ("work_strike", 1), ("work_windup", 0), ("idle", 0)],
    },
    "default": {
        "idle": [("idle", 0), ("idle", -1), ("idle", 0), ("idle", 1)],
        "walk": [("walk_a", 0), ("idle", -1), ("walk_b", 0), ("idle", 1), ("walk_a", 0), ("idle", -1), ("walk_b", 0), ("idle", 1)],
        "attack": [("idle", 0), ("attack_windup", -1), ("attack_strike", 0), ("attack_recover", 1), ("attack_strike", 0), ("idle", 0)],
        "death": [("idle", 0), ("death_hit", 0), ("death_fall", 1), ("corpse", 2), ("corpse", 2), ("corpse", 2), ("corpse", 2), ("corpse", 2)],
    },
    "caravan": {
        "idle": [("idle", 0), ("idle", -1), ("idle", 0), ("idle", 1)],
        "walk": [("walk_a", 0), ("idle", -1), ("walk_b", 0), ("idle", 1), ("walk_a", 0), ("idle", -1), ("walk_b", 0), ("idle", 1)],
        "attack": [("idle", 0), ("attack_windup", -1), ("attack_strike", 0), ("attack_recover", 1), ("attack_strike", 0), ("idle", 0)],
        "death": [("idle", 0), ("death_hit", 0), ("death_fall", 1), ("corpse", 2), ("corpse", 2), ("corpse", 2), ("corpse", 2), ("corpse", 2)],
    },
}

WORKER_POSE_NAMES = [
    "idle",
    "walk_a",
    "walk_b",
    "work_windup",
    "work_strike",
    "attack_windup",
    "attack_strike",
    "death_fall",
    "corpse",
]

DEFAULT_POSE_NAMES = [
    "idle",
    "walk_a",
    "walk_b",
    "attack_windup",
    "attack_strike",
    "attack_recover",
    "death_hit",
    "death_fall",
    "corpse",
]

DEFAULT_8_POSE_NAMES = [
    "idle",
    "walk_a",
    "walk_b",
    "attack_windup",
    "attack_strike",
    "attack_recover",
    "death_fall",
    "corpse",
]

SOURCE_COL_OVERRIDES = {
    "units_horde_knight.png": 8,
}


@dataclass
class Component:
    count: int
    bbox: tuple[int, int, int, int]
    center: tuple[float, float]


@dataclass
class AuditStats:
    missing_sources: list[str] = field(default_factory=list)
    edge_warnings: list[str] = field(default_factory=list)
    unit_sheets: int = 0
    unit_assets: int = 0
    building_sheets: int = 0
    building_overlay_assets: int = 0
    terrain_assets: int = 0
    resource_assets: int = 0
    decal_assets: int = 0
    fx_assets: int = 0
    ui_assets: int = 0
    icon_assets: int = 0


def ensure_dirs() -> None:
    for path in [
        OUT / "units/alliance",
        OUT / "units/horde",
        OUT / "future",
        OUT / "buildings/alliance",
        OUT / "buildings/horde",
        OUT / "terrain",
        OUT / "resources",
        OUT / "fx",
        OUT / "ui/icons",
        OUT / "menu",
        DEBUG,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def bg_color(im: Image.Image) -> tuple[int, int, int]:
    rgb = im.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    points = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1)]
    vals = [px[x, y] for x, y in points]
    return tuple(sum(v[i] for v in vals) // len(vals) for i in range(3))


def chroma_kind(im: Image.Image) -> str:
    r, g, b = bg_color(im)
    if g > r and g > b:
        return "green"
    return "magenta"


def is_bg_pixel(r: int, g: int, b: int, kind: str) -> bool:
    if kind == "green":
        return g > 92 and g - max(r, b) > 16
    return r > 105 and b > 82 and min(r, b) - g > 24


def keyed_image(im: Image.Image, kind: str | None = None) -> Image.Image:
    kind = kind or chroma_kind(im)
    out = im.convert("RGBA")
    px = out.load()
    w, h = out.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_bg_pixel(r, g, b, kind):
                px[x, y] = (r, g, b, 0)
                continue
            if kind == "green":
                dominant = g - max(r, b)
                if g > 70 and dominant > 6:
                    alpha = max(0, min(180, 255 - dominant * 12))
                    px[x, y] = (r, min(g, max(r, b) + 4), b, alpha)
                elif g > max(r, b):
                    px[x, y] = (r, max(r, b), b, a)
            else:
                dominant = min(r, b) - g
                if r > 75 and b > 65 and dominant > 6:
                    alpha = max(0, min(180, 255 - dominant * 10))
                    clean = max(g + 4, min(r, b) - 20)
                    px[x, y] = (min(r, clean), g, min(b, clean), alpha)
    return out


def alpha_bbox(im: Image.Image) -> tuple[int, int, int, int] | None:
    return im.getchannel("A").getbbox()


def note_missing_source(audit: AuditStats, path: Path) -> None:
    audit.missing_sources.append(path.name)


def edge_touch_sides(bbox: tuple[int, int, int, int], size: tuple[int, int]) -> list[str]:
    w, h = size
    x1, y1, x2, y2 = bbox
    sides: list[str] = []
    if x1 <= 0:
        sides.append("left")
    if y1 <= 0:
        sides.append("top")
    if x2 >= w:
        sides.append("right")
    if y2 >= h:
        sides.append("bottom")
    return sides


def audit_frame_edges(audit: AuditStats, label: str, im: Image.Image) -> None:
    bbox = alpha_bbox(im)
    if not bbox:
        return
    sides = edge_touch_sides(bbox, im.size)
    if sides:
        audit.edge_warnings.append(f"{label}: {','.join(sides)} bbox={bbox} size={im.size}")


def audit_sheet_edges(
    audit: AuditStats,
    label: str,
    sheet: Image.Image,
    frame: tuple[int, int],
    rows: int,
    cols: int,
    row_names: list[str] | None = None,
    col_names: list[str] | None = None,
) -> None:
    fw, fh = frame
    for r in range(rows):
        for c in range(cols):
            name_parts = [label]
            if row_names:
                name_parts.append(row_names[r])
            if col_names:
                name_parts.append(col_names[c])
            else:
                name_parts.append(f"frame{c}")
            crop = sheet.crop((c * fw, r * fh, (c + 1) * fw, (r + 1) * fh))
            audit_frame_edges(audit, " ".join(name_parts), crop)


def padded_bbox(bbox: tuple[int, int, int, int], pad: int, limit: tuple[int, int]) -> tuple[int, int, int, int]:
    w, h = limit
    x1, y1, x2, y2 = bbox
    return max(0, x1 - pad), max(0, y1 - pad), min(w, x2 + pad), min(h, y2 + pad)


def components(im: Image.Image, min_pixels: int = 60) -> list[Component]:
    a = im.getchannel("A")
    px = a.load()
    w, h = a.size
    seen = bytearray(w * h)
    found: list[Component] = []
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            if seen[idx] or px[x, y] == 0:
                continue
            stack = [(x, y)]
            seen[idx] = 1
            count = 0
            minx = maxx = x
            miny = maxy = y
            while stack:
                cx, cy = stack.pop()
                count += 1
                minx = min(minx, cx)
                maxx = max(maxx, cx)
                miny = min(miny, cy)
                maxy = max(maxy, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or ny < 0 or nx >= w or ny >= h:
                        continue
                    nidx = ny * w + nx
                    if seen[nidx] or px[nx, ny] == 0:
                        continue
                    seen[nidx] = 1
                    stack.append((nx, ny))
            if count >= min_pixels:
                found.append(Component(count, (minx, miny, maxx + 1, maxy + 1), ((minx + maxx + 1) / 2, (miny + maxy + 1) / 2)))
    return found


def assign_components_to_grid(comps: list[Component], size: tuple[int, int], rows: int, cols: int) -> dict[tuple[int, int], tuple[int, int, int, int]]:
    w, h = size
    cells: dict[tuple[int, int], list[tuple[int, int, int, int]]] = {(r, c): [] for r in range(rows) for c in range(cols)}
    for comp in comps:
        cx, cy = comp.center
        c = max(0, min(cols - 1, int(cx / w * cols)))
        r = max(0, min(rows - 1, int(cy / h * rows)))
        cells[(r, c)].append(comp.bbox)
    out: dict[tuple[int, int], tuple[int, int, int, int]] = {}
    for key, bboxes in cells.items():
        if bboxes:
            out[key] = (
                min(b[0] for b in bboxes),
                min(b[1] for b in bboxes),
                max(b[2] for b in bboxes),
                max(b[3] for b in bboxes),
            )
            continue
        r, c = key
        out[key] = (
            round(c * w / cols),
            round(r * h / rows),
            round((c + 1) * w / cols),
            round((r + 1) * h / rows),
        )
    return out


def normalize_crop(
    crop: Image.Image,
    frame: tuple[int, int],
    scale: float,
    dy: int = 0,
    center_y: str = "bottom",
    fit_margin: int = 0,
) -> Image.Image:
    fw, fh = frame
    bbox = alpha_bbox(crop)
    if bbox is None:
        return Image.new("RGBA", frame, (0, 0, 0, 0))
    trimmed = crop.crop(bbox)
    if fit_margin:
        scale = min(scale, (fw - fit_margin * 2) / trimmed.width, (fh - fit_margin * 2) / trimmed.height)
    resized = trimmed.resize((max(1, round(trimmed.width * scale)), max(1, round(trimmed.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", frame, (0, 0, 0, 0))
    x = round((fw - resized.width) / 2)
    if center_y == "center":
        y = round((fh - resized.height) / 2) + dy
    else:
        y = fh - 5 - resized.height + dy
    y = max(0, min(fh - resized.height, y))
    canvas.alpha_composite(resized, (x, y))
    return canvas


def crop_keyed(im: Image.Image, bbox: tuple[int, int, int, int], pad: int = 4) -> Image.Image:
    return im.crop(padded_bbox(bbox, pad, im.size))


def unit_pose_map(path: Path, kind: str, frame: tuple[int, int]) -> dict[str, dict[str, Image.Image]]:
    raw = Image.open(path)
    keyed = keyed_image(raw)
    comps = components(keyed, min_pixels=60)
    cols = SOURCE_COL_OVERRIDES.get(path.name, 9)
    grid = assign_components_to_grid(comps, keyed.size, 3, cols)
    pose_names = WORKER_POSE_NAMES if kind == "worker" else DEFAULT_POSE_NAMES
    if cols == 8 and kind != "worker":
        pose_names = DEFAULT_8_POSE_NAMES
    if path.name == "future_caravan.png":
        pose_names = DEFAULT_POSE_NAMES

    poses: dict[str, dict[str, Image.Image]] = {d: {} for d in UNIT_DIRECTIONS}
    for r, direction in enumerate(SOURCE_DIRECTIONS):
        for c, pose_name in enumerate(pose_names):
            poses[direction][pose_name] = crop_keyed(keyed, grid[(r, c)], pad=5)

    for pose_name in pose_names:
        poses["west"][pose_name] = poses["east"][pose_name].transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    for direction in UNIT_DIRECTIONS:
        if "death_hit" not in poses[direction] and "death_fall" in poses[direction]:
            poses[direction]["death_hit"] = poses[direction]["death_fall"]
        if "attack_recover" not in poses[direction] and "attack_strike" in poses[direction]:
            poses[direction]["attack_recover"] = poses[direction]["attack_strike"]
    return poses


def compute_scale_for_sequence(poses: dict[str, dict[str, Image.Image]], sequence: list[tuple[str, int]], frame: tuple[int, int], margin: int) -> float:
    max_w = 1
    max_h = 1
    for direction in UNIT_DIRECTIONS:
        for pose_name, _ in sequence:
            bbox = alpha_bbox(poses[direction][pose_name])
            if not bbox:
                continue
            max_w = max(max_w, bbox[2] - bbox[0])
            max_h = max(max_h, bbox[3] - bbox[1])
    return min((frame[0] - margin * 2) / max_w, (frame[1] - margin * 2) / max_h)


def compute_scale_for_base_height(
    poses: dict[str, dict[str, Image.Image]],
    pose_names: Iterable[str],
    target_height: int,
    frame: tuple[int, int],
    margin: int,
) -> float:
    max_w = 1
    max_h = 1
    for direction in UNIT_DIRECTIONS:
        for pose_name in pose_names:
            bbox = alpha_bbox(poses[direction][pose_name])
            if not bbox:
                continue
            max_w = max(max_w, bbox[2] - bbox[0])
            max_h = max(max_h, bbox[3] - bbox[1])
    return min(target_height / max_h, (frame[0] - margin * 2) / max_w)


def render_unit_sheet(
    poses: dict[str, dict[str, Image.Image]],
    sequence: list[tuple[str, int]],
    frame: tuple[int, int],
    margin: int = 6,
    scale: float | None = None,
) -> Image.Image:
    scale = scale if scale is not None else compute_scale_for_sequence(poses, sequence, frame, margin)
    sheet = Image.new("RGBA", (frame[0] * len(sequence), frame[1] * len(UNIT_DIRECTIONS)), (0, 0, 0, 0))
    for r, direction in enumerate(UNIT_DIRECTIONS):
        for c, (pose_name, dy) in enumerate(sequence):
            normalized = normalize_crop(poses[direction][pose_name], frame, scale, dy=dy, center_y="bottom", fit_margin=margin)
            sheet.alpha_composite(normalized, (c * frame[0], r * frame[1]))
    return sheet


def process_units(audit: AuditStats, enabled: set[str]) -> None:
    for race, kind, path in UNIT_SOURCES:
        if not path.exists():
            note_missing_source(audit, path)
            continue
        audit.unit_sheets += 1
        frame = UNIT_FRAME
        poses = unit_pose_map(path, kind, frame)
        target_dir = OUT / "units" / race
        target_dir.mkdir(parents=True, exist_ok=True)
        seq_key = "worker" if kind == "worker" else "default"
        debug_cols = SOURCE_COL_OVERRIDES.get(path.name, 9)
        all_names = WORKER_POSE_NAMES if kind == "worker" else DEFAULT_POSE_NAMES
        if debug_cols == 8 and kind != "worker":
            all_names = DEFAULT_8_POSE_NAMES
        unit_scale = compute_scale_for_base_height(poses, ["idle", "walk_a", "walk_b"], UNIT_TARGET_BASE_HEIGHT[kind], frame, 6)
        for anim, sequence in UNIT_RUNTIME_SEQUENCES[seq_key].items():
            sheet = render_unit_sheet(poses, sequence, frame, scale=unit_scale)
            sheet.save(target_dir / f"{kind}_{anim}.png")
            audit_sheet_edges(audit, f"unit {race}/{kind} {anim}", sheet, frame, len(UNIT_DIRECTIONS), len(sequence), UNIT_DIRECTIONS)
            enabled.add(f"art_unit_{kind}_{race}_{anim}")
            audit.unit_assets += 1
        debug = Image.new("RGBA", (256 * debug_cols, 256 * 4), (0, 0, 0, 0))
        scale = compute_scale_for_sequence(poses, [(name, 0) for name in all_names], (256, 256), 12)
        for r, direction in enumerate(UNIT_DIRECTIONS):
            for c, name in enumerate(all_names):
                debug.alpha_composite(normalize_crop(poses[direction][name], (256, 256), scale), (c * 256, r * 256))
        debug.save(DEBUG / f"unit_{race}_{kind}_normalized.png")

    caravan_path = SOURCE / "future_caravan.png"
    if caravan_path.exists():
        audit.unit_sheets += 1
        frame = CARAVAN_FRAME
        poses = unit_pose_map(caravan_path, "caravan", frame)
        target_dir = OUT / "future"
        target_dir.mkdir(parents=True, exist_ok=True)
        unit_scale = compute_scale_for_base_height(poses, ["idle", "walk_a", "walk_b"], UNIT_TARGET_BASE_HEIGHT["caravan"], frame, 6)
        for anim, sequence in UNIT_RUNTIME_SEQUENCES["caravan"].items():
            sheet = render_unit_sheet(poses, sequence, frame, scale=unit_scale)
            sheet.save(target_dir / f"caravan_{anim}.png")
            audit_sheet_edges(audit, f"unit neutral/caravan {anim}", sheet, frame, len(UNIT_DIRECTIONS), len(sequence), UNIT_DIRECTIONS)
            enabled.add(f"art_unit_caravan_neutral_{anim}")
            audit.unit_assets += 1
    else:
        note_missing_source(audit, caravan_path)


def process_buildings(audit: AuditStats, enabled: set[str]) -> None:
    for race, kind, path in BUILDING_SOURCES:
        if not path.exists():
            note_missing_source(audit, path)
            continue
        audit.building_sheets += 1
        raw = Image.open(path)
        keyed = keyed_image(raw, "green")
        frame = BUILDING_FRAME[kind]
        cols = 5
        crops: list[Image.Image] = []
        max_w = 1
        max_h = 1
        for c in range(cols):
            bbox = (
                round(c * keyed.width / cols),
                0,
                round((c + 1) * keyed.width / cols),
                keyed.height,
            )
            cell = keyed.crop(bbox)
            ab = alpha_bbox(cell)
            if not ab:
                crops.append(cell)
                continue
            trimmed = cell.crop(ab)
            crops.append(trimmed)
            max_w = max(max_w, trimmed.width)
            max_h = max(max_h, trimmed.height)
        scale = min((frame[0] - 8) / max_w, (frame[1] - 8) / max_h)
        sheet = Image.new("RGBA", (frame[0] * cols, frame[1]), (0, 0, 0, 0))
        for c, crop in enumerate(crops):
            normalized = normalize_crop(crop, frame, scale, center_y="center")
            sheet.alpha_composite(normalized, (c * frame[0], 0))
        target_dir = OUT / "buildings" / race
        target_dir.mkdir(parents=True, exist_ok=True)
        sheet.save(target_dir / f"{kind}.png")
        audit_sheet_edges(audit, f"building {race}/{kind}", sheet, frame, 1, cols, col_names=["stage1", "stage2", "final", "destroying", "ruin"])
        enabled.add(f"art_building_{kind}_{race}")


def nearest(comps: list[Component], x: float, y: float) -> Component:
    return min(comps, key=lambda c: (c.center[0] - x) ** 2 + (c.center[1] - y) ** 2)


def save_component_asset(keyed: Image.Image, comp: Component, path: Path, size: tuple[int, int], pad: int = 7, center_y: str = "center") -> Image.Image:
    crop = crop_keyed(keyed, comp.bbox, pad=pad)
    bbox = alpha_bbox(crop)
    if not bbox:
        out = Image.new("RGBA", size, (0, 0, 0, 0))
        out.save(path)
        return out
    trimmed = crop.crop(bbox)
    vertical_margin = 8 if center_y == "bottom" else 2
    scale = min((size[0] - 2) / trimmed.width, (size[1] - vertical_margin) / trimmed.height)
    out = normalize_crop(trimmed, size, scale, center_y=center_y)
    out.save(path)
    return out


def process_resources(audit: AuditStats, enabled: set[str]) -> None:
    path = SOURCE / "resources_and_decals.png"
    if not path.exists():
        note_missing_source(audit, path)
        return
    keyed = keyed_image(Image.open(path), "magenta")
    comps = components(keyed, min_pixels=70)
    resource_dir = OUT / "resources"
    resource_dir.mkdir(parents=True, exist_ok=True)
    for name, (point, size, center_y) in RESOURCE_ASSETS.items():
        out = save_component_asset(keyed, nearest(comps, *point), resource_dir / f"{name}.png", size, center_y=center_y)
        audit_frame_edges(audit, f"resource {name}", out)
        enabled.add(name)
        audit.resource_assets += 1
    for name, (point, size, center_y) in DECAL_ASSETS.items():
        out = save_component_asset(keyed, nearest(comps, *point), resource_dir / f"{name}.png", size, center_y=center_y)
        audit_frame_edges(audit, f"decal {name}", out)
        enabled.add(name)
        audit.decal_assets += 1


def process_terrain(audit: AuditStats, enabled: set[str]) -> None:
    terrain = SOURCE / "terrain_tiles.png"
    if terrain.exists():
        im = Image.open(terrain).convert("RGBA")
        target_dir = OUT / "terrain"
        target_dir.mkdir(parents=True, exist_ok=True)
        for i, name in enumerate(TERRAIN_NAMES):
            r, c = divmod(i, 4)
            crop = im.crop((round(c * im.width / 4), round(r * im.height / 2), round((c + 1) * im.width / 4), round((r + 1) * im.height / 2)))
            crop.resize((TERRAIN_TILE_SIZE, TERRAIN_TILE_SIZE), Image.Resampling.LANCZOS).save(target_dir / f"{name}.png")
            enabled.add(name)
            audit.terrain_assets += 1
        shutil.copyfile(target_dir / "tile_water_0.png", target_dir / "tile_water.png")
        enabled.add("tile_water")
        audit.terrain_assets += 1
    else:
        note_missing_source(audit, terrain)
    water = SOURCE / "water_frame_3.png"
    if water.exists():
        Image.open(water).convert("RGBA").resize((TERRAIN_TILE_SIZE, TERRAIN_TILE_SIZE), Image.Resampling.LANCZOS).save(OUT / "terrain/tile_water_3.png")
        enabled.add("tile_water_3")
        audit.terrain_assets += 1
    else:
        note_missing_source(audit, water)


def process_fx(audit: AuditStats, enabled: set[str]) -> None:
    path = SOURCE / "projectiles_particles_fx.png"
    if not path.exists():
        note_missing_source(audit, path)
        return
    keyed = keyed_image(Image.open(path), "magenta")
    comps = components(keyed, min_pixels=50)
    fx_dir = OUT / "fx"
    fx_dir.mkdir(parents=True, exist_ok=True)
    for name, (point, size) in FX_ASSETS.items():
        out = save_component_asset(keyed, nearest(comps, *point), fx_dir / f"{name}.png", size)
        audit_frame_edges(audit, f"fx {name}", out)
        enabled.add(name)
        audit.fx_assets += 1


def process_cursors_and_ui(audit: AuditStats, enabled: set[str]) -> None:
    cursor_path = SOURCE / "cursors_selection_commands.png"
    if cursor_path.exists():
        keyed = keyed_image(Image.open(cursor_path), "magenta")
        comps = components(keyed, min_pixels=80)
        ui_dir = OUT / "ui"
        ui_dir.mkdir(parents=True, exist_ok=True)
        for name, (point, size) in CURSOR_ASSETS.items():
            out = save_component_asset(keyed, nearest(comps, *point), ui_dir / f"{name}.png", size)
            audit_frame_edges(audit, f"ui {name}", out)
            enabled.add(name)
            audit.ui_assets += 1
    else:
        note_missing_source(audit, cursor_path)

    ui_path = SOURCE / "ui_frames.png"
    if ui_path.exists():
        keyed = keyed_image(Image.open(ui_path), "green")
        comps = components(keyed, min_pixels=80)
        ui_dir = OUT / "ui"
        for filename, (point, size, key) in UI_FRAME_ASSETS.items():
            out = save_component_asset(keyed, nearest(comps, *point), ui_dir / f"{filename}.png", size)
            audit_frame_edges(audit, f"ui {filename}", out)
            enabled.add(key)
            audit.ui_assets += 1
    else:
        note_missing_source(audit, ui_path)

    icons_path = SOURCE / "command_resource_icons.png"
    if icons_path.exists():
        keyed = keyed_image(Image.open(icons_path), "magenta")
        comps = components(keyed, min_pixels=500)
        grid = assign_components_to_grid(comps, keyed.size, 4, 5)
        icon_dir = OUT / "ui/icons"
        icon_dir.mkdir(parents=True, exist_ok=True)
        for i, name in enumerate(ICON_NAMES):
            r, c = divmod(i, 5)
            crop = crop_keyed(keyed, grid[(r, c)], pad=3)
            bbox = alpha_bbox(crop)
            if bbox:
                crop = crop.crop(bbox)
            icon_margin = 4
            out = normalize_crop(
                crop,
                (ICON_SIZE, ICON_SIZE),
                min((ICON_SIZE - icon_margin * 2) / max(1, crop.width), (ICON_SIZE - icon_margin * 2) / max(1, crop.height)),
                center_y="center",
            )
            out.save(icon_dir / f"{name}.png")
            audit_frame_edges(audit, f"icon {name}", out)
            enabled.add(f"icon_{name}")
            audit.icon_assets += 1
    else:
        note_missing_source(audit, icons_path)


def process_damage_overlays(audit: AuditStats, enabled: set[str]) -> None:
    path = SOURCE / "damage_overlays_all_buildings.png"
    if not path.exists():
        note_missing_source(audit, path)
        return
    keyed = keyed_image(Image.open(path), "green")
    kinds = ["townhall", "farm", "barracks", "workshop", "tower"]
    races = ["alliance", "horde"]
    for race_index, race in enumerate(races):
        for heavy_index, suffix in enumerate(["damage", "destruction"]):
            row = race_index * 2 + heavy_index
            for c, kind in enumerate(kinds):
                frame = BUILDING_FRAME[kind]
                crop = keyed.crop((round(c * keyed.width / 5), round(row * keyed.height / 4), round((c + 1) * keyed.width / 5), round((row + 1) * keyed.height / 4)))
                bbox = alpha_bbox(crop)
                if bbox:
                    crop = crop.crop(bbox)
                target_dir = OUT / "buildings" / race
                target_dir.mkdir(parents=True, exist_ok=True)
                out = normalize_crop(crop, frame, min((frame[0] - 6) / max(1, crop.width), (frame[1] - 6) / max(1, crop.height)), center_y="center")
                out.save(target_dir / f"{kind}_{suffix}.png")
                audit_frame_edges(audit, f"building overlay {race}/{kind} {suffix}", out)
                enabled.add(f"art_building_{kind}_{race}_{suffix}")
                audit.building_overlay_assets += 1


def write_manifest(enabled: set[str]) -> list[str]:
    ordered = sorted(enabled)
    # Legacy alias expected by some tile code.
    if "tile_water_0" in ordered and "tile_water" not in ordered:
        ordered.append("tile_water")
        ordered = sorted(ordered)
    manifest = {"version": 1, "loadAll": False, "enabledKeys": ordered}
    (OUT / "manifest.generated.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return ordered


def draw_stage_background(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    x1, y1, x2, y2 = box
    draw.rectangle(box, fill=(74, 96, 47, 255))
    tile = 16
    for y in range(y1, y2, tile):
        for x in range(x1, x2, tile):
            if ((x - x1) // tile + (y - y1) // tile) % 2 == 0:
                draw.rectangle((x, y, min(x + tile, x2), min(y + tile, y2)), fill=(84, 108, 54, 255))


def paste_frame_scaled(
    canvas: Image.Image,
    frame: Image.Image,
    box: tuple[int, int, int, int],
    display: tuple[int, int],
    scale: float,
    bottom_align: bool = True,
) -> None:
    x1, y1, x2, y2 = box
    max_w = max(1, x2 - x1 - 18)
    max_h = max(1, y2 - y1 - 18)
    draw_scale = min(scale, max_w / display[0], max_h / display[1])
    size = (max(1, round(display[0] * draw_scale)), max(1, round(display[1] * draw_scale)))
    resized = frame.resize(size, Image.Resampling.NEAREST)
    px = x1 + round((x2 - x1 - size[0]) / 2)
    if bottom_align:
        py = y2 - 10 - size[1]
    else:
        py = y1 + round((y2 - y1 - size[1]) / 2)
    canvas.alpha_composite(resized, (px, py))


def draw_text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill: tuple[int, int, int, int] = (238, 232, 215, 255)) -> None:
    draw.text(xy, text, fill=fill)


def save_unit_scale_audit() -> None:
    rows: list[tuple[str, Path, tuple[int, int], tuple[int, int]]] = [
        (f"{race}/{kind}", OUT / "units" / race / f"{kind}_idle.png", UNIT_FRAME, UNIT_DISPLAY[kind])
        for race, kind, _ in UNIT_SOURCES
    ]
    rows.append(("neutral/caravan", OUT / "future/caravan_idle.png", CARAVAN_FRAME, (96, 64)))

    label_w = 148
    cell_w = 142
    header_h = 34
    row_h = 132
    image = Image.new("RGBA", (label_w + cell_w * len(UNIT_DIRECTIONS), header_h + row_h * len(rows)), (30, 35, 28, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 0, image.width, image.height), fill=(30, 35, 28, 255))
    for i, direction in enumerate(UNIT_DIRECTIONS):
        draw_text(draw, (label_w + i * cell_w + 42, 12), direction, (215, 170, 82, 255))

    for r, (label, path, frame, display) in enumerate(rows):
        y = header_h + r * row_h
        draw_text(draw, (12, y + 54), label)
        if not path.exists():
            draw_text(draw, (label_w + 12, y + 54), f"missing {path.name}", (255, 128, 100, 255))
            continue
        sheet = Image.open(path).convert("RGBA")
        fw, fh = frame
        for c, direction in enumerate(UNIT_DIRECTIONS):
            x = label_w + c * cell_w
            cell = (x + 6, y + 6, x + cell_w - 6, y + row_h - 6)
            draw_stage_background(draw, cell)
            draw.ellipse((x + 46, y + row_h - 23, x + 96, y + row_h - 12), fill=(0, 0, 0, 72))
            crop = sheet.crop((0, c * fh, fw, (c + 1) * fh))
            paste_frame_scaled(image, crop, cell, display, 2.7, bottom_align=True)
            draw.rectangle(cell, outline=(75, 84, 63, 255))
            draw_text(draw, (x + 10, y + 10), direction, (185, 176, 148, 255))
    image.save(SAMPLE / "unit-scale-audit.png")


def save_buildings_audit() -> None:
    stages = ["stage1", "stage2", "final", "destroying", "ruin"]
    rows = [(race, kind, OUT / "buildings" / race / f"{kind}.png") for race, kind, _ in BUILDING_SOURCES]
    label_w = 154
    cell_w = 138
    header_h = 34
    row_h = 126
    image = Image.new("RGBA", (label_w + cell_w * len(stages), header_h + row_h * len(rows)), (30, 35, 28, 255))
    draw = ImageDraw.Draw(image)
    for i, stage in enumerate(stages):
        draw_text(draw, (label_w + i * cell_w + 34, 12), stage, (215, 170, 82, 255))
    for r, (race, kind, path) in enumerate(rows):
        y = header_h + r * row_h
        draw_text(draw, (12, y + 52), f"{race}/{kind}")
        if not path.exists():
            draw_text(draw, (label_w + 12, y + 52), f"missing {path.name}", (255, 128, 100, 255))
            continue
        sheet = Image.open(path).convert("RGBA")
        frame = BUILDING_FRAME[kind]
        display = BUILDING_DISPLAY[kind]
        fw, fh = frame
        for c, stage in enumerate(stages):
            x = label_w + c * cell_w
            cell = (x + 6, y + 6, x + cell_w - 6, y + row_h - 6)
            draw_stage_background(draw, cell)
            draw.ellipse((x + 39, y + row_h - 25, x + 99, y + row_h - 12), fill=(0, 0, 0, 70))
            crop = sheet.crop((c * fw, 0, (c + 1) * fw, fh))
            paste_frame_scaled(image, crop, cell, display, 1.25, bottom_align=False)
            draw.rectangle(cell, outline=(75, 84, 63, 255))
            draw_text(draw, (x + 10, y + 10), stage, (185, 176, 148, 255))
    image.save(SAMPLE / "buildings-audit.png")


def save_icon_audit() -> None:
    cols = 5
    cell_w = 108
    cell_h = 112
    header_h = 24
    rows = math.ceil(len(ICON_NAMES) / cols)
    image = Image.new("RGBA", (cols * cell_w, header_h + rows * cell_h), (30, 35, 28, 255))
    draw = ImageDraw.Draw(image)
    draw_text(draw, (12, 8), "Runtime command/resource icons", (215, 170, 82, 255))
    for i, name in enumerate(ICON_NAMES):
        r, c = divmod(i, cols)
        x = c * cell_w
        y = header_h + r * cell_h
        box = (x + 10, y + 8, x + cell_w - 10, y + 82)
        draw.rectangle(box, fill=(32, 37, 30, 255), outline=(75, 84, 63, 255))
        path = OUT / "ui/icons" / f"{name}.png"
        if path.exists():
            icon = Image.open(path).convert("RGBA")
            paste_frame_scaled(image, icon, box, (64, 64), 1.0, bottom_align=False)
        else:
            draw_text(draw, (x + 16, y + 38), "missing", (255, 128, 100, 255))
        draw_text(draw, (x + 10, y + 88), name[:16], (238, 232, 215, 255))
    image.save(SAMPLE / "icons-audit.png")


def save_terrain_audit() -> None:
    names = TERRAIN_NAMES + ["tile_water", "tile_water_3"]
    cols = 5
    cell_w = 108
    cell_h = 104
    header_h = 24
    rows = math.ceil(len(names) / cols)
    image = Image.new("RGBA", (cols * cell_w, header_h + rows * cell_h), (30, 35, 28, 255))
    draw = ImageDraw.Draw(image)
    draw_text(draw, (12, 8), "Runtime terrain tiles", (215, 170, 82, 255))
    for i, name in enumerate(names):
        r, c = divmod(i, cols)
        x = c * cell_w
        y = header_h + r * cell_h
        box = (x + 14, y + 8, x + cell_w - 14, y + 76)
        draw.rectangle(box, fill=(32, 37, 30, 255), outline=(75, 84, 63, 255))
        path = OUT / "terrain" / f"{name}.png"
        if path.exists():
            tile = Image.open(path).convert("RGBA").resize((64, 64), Image.Resampling.NEAREST)
            image.alpha_composite(tile, (x + 22, y + 10))
        else:
            draw_text(draw, (x + 18, y + 34), "missing", (255, 128, 100, 255))
        draw_text(draw, (x + 10, y + 82), name[:16], (238, 232, 215, 255))
    image.save(SAMPLE / "terrain-audit.png")


def save_audit_images() -> None:
    save_unit_scale_audit()
    save_buildings_audit()
    save_icon_audit()
    save_terrain_audit()


def print_audit_summary(audit: AuditStats, enabled_keys: list[str]) -> None:
    print("processed:")
    print(f"  unit sheets: {audit.unit_sheets}")
    print(f"  unit runtime sheets: {audit.unit_assets}")
    print(f"  building sheets: {audit.building_sheets}")
    print(f"  building damage/destruction assets: {audit.building_overlay_assets}")
    print(f"  terrain assets: {audit.terrain_assets}")
    print(f"  resource assets: {audit.resource_assets}")
    print(f"  decal assets: {audit.decal_assets}")
    print(f"  fx assets: {audit.fx_assets}")
    print(f"  ui assets: {audit.ui_assets}")
    print(f"  icon assets: {audit.icon_assets}")
    if audit.missing_sources:
        print("missing source files:")
        for name in sorted(set(audit.missing_sources)):
            print(f"  {name}")
    else:
        print("missing source files: none")
    if audit.edge_warnings:
        print(f"edge-touch warnings: {len(audit.edge_warnings)}")
        for warning in audit.edge_warnings:
            print(f"  {warning}")
    else:
        print("edge-touch warnings: none")
    print(f"enabledKeys: {len(enabled_keys)}")


def main() -> None:
    ensure_dirs()
    audit = AuditStats()
    enabled: set[str] = set()
    process_units(audit, enabled)
    process_buildings(audit, enabled)
    process_damage_overlays(audit, enabled)
    process_terrain(audit, enabled)
    process_resources(audit, enabled)
    process_fx(audit, enabled)
    process_cursors_and_ui(audit, enabled)
    enabled_keys = write_manifest(enabled)
    save_audit_images()
    print_audit_summary(audit, enabled_keys)


if __name__ == "__main__":
    main()
