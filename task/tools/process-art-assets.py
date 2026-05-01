#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "public/assets/art/source"
OUT = ROOT / "public/assets/art"
DEBUG = ROOT / "task/art-sample/normalized"

UNIT_DIRECTIONS = ["south", "east", "north", "west"]
SOURCE_DIRECTIONS = ["south", "east", "north"]

UNIT_DISPLAY = {
    "worker": (40, 40),
    "footman": (44, 44),
    "archer": (44, 44),
    "knight": (52, 52),
    "catapult": (48, 48),
}

UNIT_TARGET_BASE_HEIGHT = {
    "worker": 104,
    "footman": 106,
    "archer": 104,
    "knight": 116,
    "catapult": 104,
    "caravan": 112,
}

BUILDING_FRAME = {
    "townhall": (192, 192),
    "farm": (128, 128),
    "barracks": (192, 192),
    "workshop": (192, 192),
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


def process_units(report: list[str], enabled: set[str]) -> None:
    for race, kind, path in UNIT_SOURCES:
        if not path.exists():
            report.append(f"missing unit source: {path.name}")
            continue
        frame = (128, 128)
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
            enabled.add(f"art_unit_{kind}_{race}_{anim}")
        debug = Image.new("RGBA", (256 * debug_cols, 256 * 4), (0, 0, 0, 0))
        scale = compute_scale_for_sequence(poses, [(name, 0) for name in all_names], (256, 256), 12)
        for r, direction in enumerate(UNIT_DIRECTIONS):
            for c, name in enumerate(all_names):
                debug.alpha_composite(normalize_crop(poses[direction][name], (256, 256), scale), (c * 256, r * 256))
        debug.save(DEBUG / f"unit_{race}_{kind}_normalized.png")
        report.append(f"unit {race}/{kind}: ok")

    caravan_path = SOURCE / "future_caravan.png"
    if caravan_path.exists():
        frame = (192, 128)
        poses = unit_pose_map(caravan_path, "caravan", frame)
        target_dir = OUT / "future"
        target_dir.mkdir(parents=True, exist_ok=True)
        unit_scale = compute_scale_for_base_height(poses, ["idle", "walk_a", "walk_b"], UNIT_TARGET_BASE_HEIGHT["caravan"], frame, 6)
        for anim, sequence in UNIT_RUNTIME_SEQUENCES["caravan"].items():
            sheet = render_unit_sheet(poses, sequence, frame, scale=unit_scale)
            sheet.save(target_dir / f"caravan_{anim}.png")
            enabled.add(f"art_unit_caravan_neutral_{anim}")
        report.append("future caravan: ok")


def process_buildings(report: list[str], enabled: set[str]) -> None:
    for race, kind, path in BUILDING_SOURCES:
        if not path.exists():
            report.append(f"missing building source: {path.name}")
            continue
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
        enabled.add(f"art_building_{kind}_{race}")
        report.append(f"building {race}/{kind}: ok")


def nearest(comps: list[Component], x: float, y: float) -> Component:
    return min(comps, key=lambda c: (c.center[0] - x) ** 2 + (c.center[1] - y) ** 2)


def save_component_asset(keyed: Image.Image, comp: Component, path: Path, size: tuple[int, int], pad: int = 7, center_y: str = "center") -> None:
    crop = crop_keyed(keyed, comp.bbox, pad=pad)
    bbox = alpha_bbox(crop)
    if not bbox:
        Image.new("RGBA", size, (0, 0, 0, 0)).save(path)
        return
    trimmed = crop.crop(bbox)
    scale = min((size[0] - 2) / trimmed.width, (size[1] - 2) / trimmed.height)
    normalize_crop(trimmed, size, scale, center_y=center_y).save(path)


def process_resources(report: list[str], enabled: set[str]) -> None:
    path = SOURCE / "resources_and_decals.png"
    if not path.exists():
        return
    keyed = keyed_image(Image.open(path), "magenta")
    comps = components(keyed, min_pixels=70)
    resource_dir = OUT / "resources"
    resource_dir.mkdir(parents=True, exist_ok=True)
    mapping = {
        "goldmine": ((261, 205), (96, 96), "center"),
        "goldmine_damaged": ((702, 215), (96, 96), "center"),
        "goldmine_depleted": ((1102, 220), (96, 96), "center"),
        "tree": ((1493, 221), (32, 32), "bottom"),
        "tree_stump": ((194, 503), (32, 32), "bottom"),
        "tree_log": ((562, 510), (40, 24), "center"),
        "tree_trunk": ((827, 503), (20, 30), "center"),
        "tree_canopy": ((1125, 503), (36, 36), "center"),
    }
    for name, (point, size, center_y) in mapping.items():
        save_component_asset(keyed, nearest(comps, *point), resource_dir / f"{name}.png", size, center_y=center_y)
    for key in mapping:
        enabled.add(key)
    report.append("resources: ok")


def process_terrain(report: list[str], enabled: set[str]) -> None:
    terrain = SOURCE / "terrain_tiles.png"
    if terrain.exists():
        im = Image.open(terrain).convert("RGBA")
        names = ["tile_grass", "tile_grass2", "tile_dirt", "tile_forest", "tile_stone", "tile_water_0", "tile_water_1", "tile_water_2"]
        target_dir = OUT / "terrain"
        target_dir.mkdir(parents=True, exist_ok=True)
        for i, name in enumerate(names):
            r, c = divmod(i, 4)
            crop = im.crop((round(c * im.width / 4), round(r * im.height / 2), round((c + 1) * im.width / 4), round((r + 1) * im.height / 2)))
            crop.resize((32, 32), Image.Resampling.LANCZOS).save(target_dir / f"{name}.png")
            enabled.add(name)
        shutil.copyfile(target_dir / "tile_water_0.png", target_dir / "tile_water.png")
        enabled.add("tile_water")
    water = SOURCE / "water_frame_3.png"
    if water.exists():
        Image.open(water).convert("RGBA").resize((32, 32), Image.Resampling.LANCZOS).save(OUT / "terrain/tile_water_3.png")
        enabled.add("tile_water_3")
    report.append("terrain: ok")


def process_fx(report: list[str], enabled: set[str]) -> None:
    path = SOURCE / "projectiles_particles_fx.png"
    if not path.exists():
        return
    keyed = keyed_image(Image.open(path), "magenta")
    comps = components(keyed, min_pixels=50)
    fx_dir = OUT / "fx"
    fx_dir.mkdir(parents=True, exist_ok=True)
    mapping = {
        "projectile_arrow": ((188, 151), (16, 8)),
        "projectile_stone": ((425, 154), (14, 14)),
        "projectile_tower": ((702, 152), (18, 18)),
        "px_spark": ((956, 162), (16, 16)),
        "px_flame": ((1162, 153), (18, 18)),
        "px_blood": ((1345, 163), (12, 16)),
        "px_leaf": ((1519, 151), (16, 16)),
        "px_star": ((199, 335), (16, 16)),
        "px_ember": ((425, 354), (12, 12)),
        "px_rune": ((657, 340), (18, 22)),
        "px_crater": ((949, 351), (34, 24)),
        "px_arrow_trail": ((1401, 345), (38, 10)),
        "px_debris_1": ((175, 557), (14, 14)),
        "px_debris_2": ((353, 555), (14, 14)),
        "px_debris_3": ((530, 555), (14, 14)),
        "px_smoke_dark": ((175, 760), (24, 24)),
        "px_dust": ((425, 760), (24, 24)),
        "px_smoke_light": ((701, 760), (28, 28)),
        "px_mist": ((1100, 760), (28, 22)),
        "px_shockwave": ((1400, 760), (36, 36)),
        "px_glow": ((1545, 760), (20, 20)),
    }
    for name, (point, size) in mapping.items():
        save_component_asset(keyed, nearest(comps, *point), fx_dir / f"{name}.png", size)
        enabled.add(name)
    report.append("fx: ok")


def process_cursors_and_ui(report: list[str], enabled: set[str]) -> None:
    cursor_path = SOURCE / "cursors_selection_commands.png"
    if cursor_path.exists():
        keyed = keyed_image(Image.open(cursor_path), "magenta")
        comps = components(keyed, min_pixels=80)
        ui_dir = OUT / "ui"
        ui_dir.mkdir(parents=True, exist_ok=True)
        cursor_map = {
            "cursor_default": ((204, 185), (32, 32)),
            "cursor_attack": ((486, 193), (32, 32)),
            "cursor_build_ok": ((802, 186), (36, 36)),
            "cursor_build_no": ((1122, 186), (36, 36)),
            "cursor_gather": ((1435, 192), (36, 36)),
            "ring_select_s": ((180, 474), (36, 24)),
            "ring_select_m": ((509, 473), (52, 34)),
            "ring_select_l": ((932, 471), (72, 44)),
        }
        for name, (point, size) in cursor_map.items():
            save_component_asset(keyed, nearest(comps, *point), ui_dir / f"{name}.png", size)
            enabled.add(name)

    ui_path = SOURCE / "ui_frames.png"
    if ui_path.exists():
        keyed = keyed_image(Image.open(ui_path), "green")
        comps = components(keyed, min_pixels=80)
        ui_dir = OUT / "ui"
        frame_map = {
            "panel_frame": ((498, 742), (512, 168)),
            "tooltip_frame": ((770, 363), (256, 192)),
            "minimap_frame": ((247, 385), (192, 192)),
        }
        for filename, (point, size) in frame_map.items():
            save_component_asset(keyed, nearest(comps, *point), ui_dir / f"{filename}.png", size)
        for key in ["ui_panel_frame", "ui_tooltip_frame", "ui_minimap_frame"]:
            enabled.add(key)

    icons_path = SOURCE / "command_resource_icons.png"
    if icons_path.exists():
        keyed = keyed_image(Image.open(icons_path), "magenta")
        comps = components(keyed, min_pixels=500)
        grid = assign_components_to_grid(comps, keyed.size, 4, 5)
        icon_dir = OUT / "ui/icons"
        icon_dir.mkdir(parents=True, exist_ok=True)
        names = [
            "stop", "attack_move", "build", "repair", "rally",
            "worker", "footman", "archer", "knight", "catapult",
            "return_cargo", "gather_gold", "gather_lumber", "patrol", "hold_position",
            "autopilot", "formation", "support", "gold", "lumber",
        ]
        for i, name in enumerate(names):
            r, c = divmod(i, 5)
            crop = crop_keyed(keyed, grid[(r, c)], pad=3)
            bbox = alpha_bbox(crop)
            if bbox:
                crop = crop.crop(bbox)
            normalize_crop(crop, (64, 64), min(60 / max(1, crop.width), 60 / max(1, crop.height)), center_y="center").save(icon_dir / f"{name}.png")
            enabled.add(f"icon_{name}")
    report.append("ui/cursors/icons: ok")


def process_damage_overlays(report: list[str], enabled: set[str]) -> None:
    path = SOURCE / "damage_overlays_all_buildings.png"
    if not path.exists():
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
                normalize_crop(crop, frame, min((frame[0] - 6) / max(1, crop.width), (frame[1] - 6) / max(1, crop.height)), center_y="center").save(target_dir / f"{kind}_{suffix}.png")
                enabled.add(f"art_building_{kind}_{race}_{suffix}")
    report.append("damage overlays: ok")


def write_manifest(enabled: set[str]) -> None:
    ordered = sorted(enabled)
    # Legacy alias expected by some tile code.
    if "tile_water_0" in ordered and "tile_water" not in ordered:
        ordered.append("tile_water")
    manifest = {"version": 1, "loadAll": False, "enabledKeys": ordered}
    (OUT / "manifest.generated.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    ensure_dirs()
    report: list[str] = []
    enabled: set[str] = set()
    process_units(report, enabled)
    process_buildings(report, enabled)
    process_damage_overlays(report, enabled)
    process_terrain(report, enabled)
    process_resources(report, enabled)
    process_fx(report, enabled)
    process_cursors_and_ui(report, enabled)
    write_manifest(enabled)
    print("\n".join(report))
    print(f"enabled keys: {len(enabled)}")


if __name__ == "__main__":
    main()
