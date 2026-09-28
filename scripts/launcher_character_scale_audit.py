"""Measure released room-actor silhouettes in their real sprite atlases.

Alpha bounds compare upright action size against the same character's
directional standing frame. Seated/rest/sleep poses are intentionally excluded.
"""

from __future__ import annotations

import json
from pathlib import Path
import re
from statistics import median

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "public/images/launcher_room"
OUT = ROOT / "tools/launcher-room/scale-v1210/review-evidence/all-actor-scale.json"
LEGACY = ("luffy", "zoro", "nami", "usopp", "sanji", "chopper", "robin", "franky", "brook", "jinbe")
DIRECTIONS = ("east", "west", "north", "south")
NON_UPRIGHT = {"rest", "sleep"}


def fraction(image: Image.Image) -> tuple[float, float]:
    mask = image.getchannel("A").point(lambda alpha: 255 if alpha > 24 else 0)
    box = mask.getbbox()
    if box is None:
        raise AssertionError("Empty atlas frame")
    return ((box[2] - box[0]) / image.width, (box[3] - box[1]) / image.height)


def frames(file: Path) -> list[tuple[float, float]]:
    with Image.open(file) as raw:
        atlas = raw.convert("RGBA")
    cell = atlas.height
    assert atlas.width % cell == 0, file
    return [fraction(atlas.crop((index * cell, 0, (index + 1) * cell, cell)))
            for index in range(atlas.width // cell)]


def stem(key: str) -> Path | None:
    if key == "robin":
        return ART / "robin_v2"
    if key in {"ace", "sabo", "law", "hancock"}:
        return ART / "reserved_v1" / key
    return None


def walk_path(key: str, direction: str) -> Path:
    special = stem(key)
    return (special / "walk" / f"{direction}.webp") if special else (ART / "motion_v4" / key / f"{direction}.webp")


def life_dir(key: str) -> Path:
    special = stem(key)
    if special:
        return special / "life"
    hd = ART / "life_hd_v2" / key
    return hd if hd.is_dir() else ART / "life_v1" / key


def motion_scales() -> dict[str, float]:
    script = (ROOT / "desktop/launcher-room-motion-data.js").read_text(encoding="utf-8")
    match = re.search(r"const data=(\{.*?\});\s*if\(typeof", script, flags=re.S)
    assert match, "Cannot parse room motion manifest"
    data = json.loads(match.group(1))
    return {key: value.get("displayScale", 1) for key, value in data["characters"].items()}


def main() -> None:
    release = json.loads((ROOT / "config/launcher-crew-release-v1.json").read_text(encoding="utf-8"))
    active = list(LEGACY) + [key for key, enabled in release["characters"].items() if enabled]
    scales = motion_scales()
    characters = []
    outliers = []
    for key in active:
        standing = {}
        for direction in DIRECTIONS:
            shape = frames(walk_path(key, direction))
            assert len(shape) == 4
            standing[direction] = shape[1]
        character = {
            "key": key,
            "displayScale": scales.get(key, 1),
            "standingHeightByDirection": {direction: round(standing[direction][1], 4) for direction in DIRECTIONS},
            "uprightActions": [],
        }
        for file in sorted(life_dir(key).glob("*.webp")):
            action, direction = file.stem.rsplit("-", 1)
            if action in NON_UPRIGHT or direction not in DIRECTIONS:
                continue
            silhouette = frames(file)
            assert len(silhouette) == 4
            width, height = (median(values[index] for values in silhouette) for index in (0, 1))
            ratio = height / standing[direction][1]
            with Image.open(file) as atlas:
                cell = atlas.height
            entry = {
                "action": action, "direction": direction,
                "atlas": file.relative_to(ROOT).as_posix(),
                "atlasCell": cell,
                "standingHeightFraction": round(standing[direction][1], 4),
                "actionHeightFraction": round(height, 4),
                "heightRatio": round(ratio, 4),
                "widthRatio": round(width / standing[direction][0], 4),
            }
            character["uprightActions"].append(entry)
            if ratio < 0.93 or ratio > 1.07:
                outliers.append({"key": key, **entry})
        characters.append(character)

    luffy = next(row for row in characters if row["key"] == "luffy")
    reference = luffy["standingHeightByDirection"]["south"] * luffy["displayScale"]
    for character in characters:
        value = character["standingHeightByDirection"]["south"] * character["displayScale"] / reference
        character["southVisibleHeightRelativeToLuffy"] = round(value, 4)

    report = {
        "schema": "launcher-character-scale-audit/1",
        "activeCharacters": active,
        "method": "Pillow RGBA alpha >24; walk standing frame 1; action median of four complete frames; same actor and direction; rest/sleep omitted.",
        "characters": characters,
        "outliersOverSevenPercent": sorted(outliers, key=lambda item: item["heightRatio"]),
        "humanAcceptance": False,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"active": len(active), "outliers": len(outliers), "out": str(OUT)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
