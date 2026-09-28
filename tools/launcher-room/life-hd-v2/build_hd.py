"""Repack reviewed life artwork at 256 px per frame from the original PNGs.

The accepted 128 px atlases remain untouched. This script uses each existing
crop, root and uniform four-frame scale at twice its original output size;
the largest effective scale remains below 1, so no figure is upsampled.
"""
from __future__ import annotations

import argparse
from collections import Counter
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
LIFE_PLANS = ROOT / "tools/launcher-room/life-v1"
MANIFEST = Path(__file__).with_name("manifest.json")
OLD_PREFIX = "public/images/launcher_room/life_v1/"
NEW_PREFIX = "public/images/launcher_room/life_hd_v2/"
CELL = 256
ROOT_POINT = (128, 224)


def digest(data: bytes) -> str:
    return sha256(data).hexdigest()


def build_record(group: dict, plan_path: Path, check: bool) -> dict:
    legacy_path = group["asset"]
    assert legacy_path.startswith(OLD_PREFIX), legacy_path
    asset_path = NEW_PREFIX + legacy_path.removeprefix(OLD_PREFIX)
    source_path = group["source"]
    source_file = ROOT / source_path
    source_bytes = source_file.read_bytes()
    source = Image.open(BytesIO(source_bytes)).convert("RGBA")
    alpha_min, alpha_max = source.getchannel("A").getextrema()
    assert alpha_min == 0 and alpha_max >= 240, source_path
    assert len(group["regions"]) == 4, legacy_path
    original_scale = float(group["scale"])
    scale = original_scale * 2
    assert 0 < scale < 1, (legacy_path, scale)

    atlas = Image.new("RGBA", (CELL * 4, CELL))
    frame_bounds = []
    for index, region in enumerate(group["regions"]):
        x0, y0, x1, y1 = map(int, region)
        assert 0 <= x0 < x1 <= source.width and 0 <= y0 < y1 <= source.height
        frame = source.crop((x0, y0, x1, y1))
        bounds = frame.getchannel("A").getbbox()
        assert bounds, (legacy_path, index)
        cropped = frame.crop(bounds)
        width = round(cropped.width * scale)
        height = round(cropped.height * scale)
        assert 0 < width <= cropped.width and 0 < height <= cropped.height, legacy_path
        output = cropped.resize((width, height), Image.Resampling.LANCZOS)
        source_root = group.get("roots", [None] * 4)[index]
        root_x = source_root[0] - x0 if source_root else frame.width / 2
        left = round(ROOT_POINT[0] + (bounds[0] - root_x) * scale)
        top = ROOT_POINT[1] - height
        assert 0 <= left and left + width <= CELL and top >= 0, (legacy_path, index, left, top, width, height)
        atlas.alpha_composite(output, (index * CELL + left, top))
        frame_bounds.append([left, top, width, height])

    raw = BytesIO()
    atlas.save(raw, "WEBP", lossless=True, exact=True)
    encoded = raw.getvalue()
    dest = ROOT / asset_path
    if check:
        assert dest.is_file() and digest(dest.read_bytes()) == digest(encoded), asset_path
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists() or dest.read_bytes() != encoded:
            dest.write_bytes(encoded)
    return {
        "asset": asset_path,
        "legacyAtlas": legacy_path,
        "source": source_path,
        "sourceSha256": digest(source_bytes),
        "sourcePixels": list(source.size),
        "plan": plan_path.relative_to(ROOT).as_posix(),
        "planSha256": digest(plan_path.read_bytes()),
        "scaleFromSource": scale,
        "assetPixels": [CELL * 4, CELL],
        "cellPixels": CELL,
        "groundRoot": list(ROOT_POINT),
        "frameBounds": frame_bounds,
        "assetBytes": len(encoded),
        "assetSha256": digest(encoded),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify outputs without writing")
    args = parser.parse_args()
    groups = []
    for plan_path in sorted(LIFE_PLANS.glob("*/plan.json")):
        plan = json.loads(plan_path.read_text(encoding="utf-8-sig"))
        for group in plan["clips"]:
            if group["key"] != "robin":
                groups.append((group, plan_path))
    names = [group["asset"] for group, _ in groups]
    assert len(names) == len(set(names)) == 116, "Life atlas plan coverage changed"
    expected = {
        path.relative_to(ROOT).as_posix()
        for path in (ROOT / OLD_PREFIX).glob("*/*.webp")
        if path.parent.name != "robin"
    }
    assert set(names) == expected, "Life atlas plans do not match released art"

    records = [build_record(group, plan_path, args.check) for group, plan_path in groups]
    records.sort(key=lambda item: item["asset"])
    by_action = Counter(item["asset"].split("/")[-1].split("-")[0] for item in records)
    manifest = {
        "schema": "launcher-life-hd-art/1",
        "release": "1.2.10",
        "method": "reviewed-original-png-crops-at-2x-output-no-upsample",
        "sourceAtlasCellPixels": 128,
        "newAtlasCellPixels": CELL,
        "count": len(records),
        "byAction": dict(sorted(by_action.items())),
        "assets": records,
    }
    formatted = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        assert MANIFEST.read_text(encoding="utf-8") == formatted, "HD manifest differs from source files"
    elif not MANIFEST.exists() or MANIFEST.read_text(encoding="utf-8") != formatted:
        MANIFEST.write_text(formatted, encoding="utf-8")
    print(json.dumps({"ok": True, "mode": "check" if args.check else "build", "count": len(records), "byAction": dict(by_action), "totalBytes": sum(item["assetBytes"] for item in records)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
