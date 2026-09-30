"""Freeze reviewed launcher 1.2.15 bitmap delivery bytes and image geometry.

Run after visual review. The manifest is checked independently by package QA;
this script never changes the artwork itself.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
ROOM = ROOT / "public/images/launcher_room"
ANNOUNCEMENT = ROOT / "public/images/launcher_announcements/launcher-life-fishing-1.2.15.webp"
DEST = Path(__file__).with_name("manifest.json")

SCENES = ["crew-cabin", "sunny-deck", "sunny-kitchen", "sunny-library", "sunny-workshop", "sunny-aquarium"]
OCEAN = ["dawn", "day", "dusk", "night", "storm"]
FISH = ["balloon-catfish", "glistening-saury", "panda-shark", "smile-jellyfish"]
FURNITURE = ["aquarium-tank", "crew-tea-table", "fishing-gear-rack", "galley-icebox"]
LOCKED = ["vivi", "shanks", "mihawk", "perona", "marco", "buggy", "carrot", "yamato", "bonclay", "koala"]
ASSETS = (
    [f"scenes/{key}-cutout-v3.webp" for key in SCENES]
    + [f"sea/ocean-{key}.webp" for key in OCEAN]
    + ["minigames_v1/fishing-sea.webp", "minigames_v1/repair-workbench-v2.webp", "minigames_v1/navigation-chart-v2.webp", "minigames_v1/cooking-galley-v2.webp", "minigames_v1/supply-deck-v2.webp"]
    + [f"fish_v1/{key}.webp" for key in FISH]
    + [f"furniture/{key}.webp" for key in FURNITURE]
    + [f"furniture_views/{key}/{rotation}.webp" for key in FURNITURE for rotation in range(4)]
    + [f"reserved_v3_previews/{key}.webp" for key in LOCKED]
)


def detail(file: Path) -> dict:
    data = file.read_bytes()
    with Image.open(file) as opened:
        image = opened.convert("RGBA")
        alpha = image.getchannel("A")
        minimum, maximum = alpha.getextrema()
        width, height = image.size
    return {
        "path": file.relative_to(ROOT).as_posix(),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "dimensions": [width, height],
        "alphaMin": minimum,
        "alphaMax": maximum,
    }


def main() -> None:
    items = [detail(ROOM / name) for name in ASSETS]
    assert len(items) == 50 and len({item["path"] for item in items}) == 50
    for item in items:
        name = item["path"].removeprefix("public/images/launcher_room/")
        if name.startswith(("scenes/", "fish_v1/", "furniture/", "furniture_views/", "reserved_v3_previews/")):
            assert item["alphaMin"] == 0 and item["alphaMax"] >= 250, f"Missing transparent cutout: {name}"
        if name.startswith(("scenes/", "sea/")) or name in {"minigames_v1/repair-workbench-v2.webp", "minigames_v1/navigation-chart-v2.webp", "minigames_v1/cooking-galley-v2.webp", "minigames_v1/supply-deck-v2.webp"}:
            assert item["dimensions"] == [1600, 900], f"Wrong scene/background size: {name}"
        if name == "minigames_v1/fishing-sea.webp":
            width, height = item["dimensions"]
            assert width >= 1536 and abs(width / height - 16 / 9) < 0.02, "Fishing sea has an unexpected aspect ratio"
        if name.startswith("reserved_v3_previews/"):
            assert item["dimensions"] == [256, 256], f"Wrong reserve preview size: {name}"
    banner = detail(ANNOUNCEMENT)
    assert banner["dimensions"] == [1600, 900]
    result = {
        "schema": "launcher-life-fishing-art/1",
        "release": "1.2.15",
        "artistReview": "Codex visual review; not a human playtest",
        "itemCount": len(items),
        "items": items,
        "announcement": banner,
    }
    DEST.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{DEST}: {len(items)} room assets + announcement; {sum(item['bytes'] for item in items) + banner['bytes']} bytes")


if __name__ == "__main__":
    main()
