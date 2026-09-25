"""Record and verify the GPT source sheets and packed room action/view assets."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs" / "LAUNCHER_ROOM_DEPTH_ART_20260925.json"
FURNITURE = (
    "bookshelf", "helm", "kitchen-table", "map-table", "medicine-cabinet",
    "piano", "swords-rack", "tangerine-tree", "tool-bench", "treasure-chest",
)
CHARACTERS = (
    "luffy", "zoro", "nami", "usopp", "sanji", "chopper", "robin",
    "franky", "brook", "jinbe",
)
EXTRA_WALK_SOURCES = frozenset({
    "luffy", "zoro", "nami", "usopp", "sanji", "chopper", "robin", "brook",
})
EXTRA_POSE_SOURCES = frozenset({("franky", "talk_annoyed"), ("jinbe", "sit")})
POSES = (
    "idle", "walk1", "walk2", "talk_happy", "talk_annoyed",
    "surprised", "focused_use", "sit", "wave",
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def entry(kind: str, key: str, variant: str) -> dict:
    if kind == "furniture":
        source = f"tools/launcher-room/furniture-source-png/{key}.png"
        asset = f"public/images/launcher_room/furniture_views/{key}/{variant}.webp"
    else:
        source_name = f"{key}-{variant}" if (variant == "walk2" and key in EXTRA_WALK_SOURCES) or (key, variant) in EXTRA_POSE_SOURCES else key
        source = f"tools/launcher-room/action-source-png/{source_name}.png"
        asset = f"public/images/launcher_room/action_frames/{key}/{variant}.webp"
    source_path, asset_path = ROOT / source, ROOT / asset
    if not source_path.is_file() or not asset_path.is_file():
        raise FileNotFoundError(f"Missing {source_path if not source_path.is_file() else asset_path}")
    with Image.open(source_path) as original:
        source_pixels = list(original.size)
    with Image.open(asset_path) as frame:
        rgba = frame.convert("RGBA")
        alpha = rgba.getchannel("A")
        bounds = alpha.getbbox()
        if frame.format != "WEBP" or min(frame.size) < 256 or bounds is None:
            raise ValueError(f"Invalid room art frame: {asset}")
        if all(alpha.getpixel(point) > 8 for point in (
            (0, 0), (frame.width - 1, 0), (0, frame.height - 1),
            (frame.width - 1, frame.height - 1),
        )):
            raise ValueError(f"Frame lacks transparent outer corners: {asset}")
        if bounds[0] < 3 or bounds[1] < 3 or bounds[2] > frame.width - 3 or bounds[3] > frame.height - 3:
            raise ValueError(f"Frame cutout touches an outer edge: {asset}, alpha bounds={bounds}")
        pixels = list(frame.size)
    return {
        "id": f"{kind}/{key}/{variant}",
        "kind": kind,
        "key": key,
        "variant": variant,
        "sourcePng": source,
        "sourceSha256": digest(source_path),
        "sourcePixels": source_pixels,
        "asset": asset,
        "assetSha256": digest(asset_path),
        "assetBytes": asset_path.stat().st_size,
        "assetPixels": pixels,
        "alpha": "transparent-cutout",
        "alphaBounds": list(bounds),
    }


def main() -> None:
    items = [entry("furniture", key, str(direction)) for key in FURNITURE for direction in range(4)]
    items.extend(entry("character", key, pose) for key in CHARACTERS for pose in POSES)
    document = {
        "version": "1.1.11",
        "date": "2026-09-25",
        "generator": "OpenAI built-in image_gen; canonical character action sheets, supplementary walk frames, and four-view furniture sheets",
        "processing": "Locally cropped transparent WebP frames; source sheets retained",
        "canonicalCharactersOnly": True,
        "items": items,
    }
    OUTPUT.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ROOM_DEPTH_ART_MANIFEST=PASS items={len(items)} output={OUTPUT}")


if __name__ == "__main__":
    main()
