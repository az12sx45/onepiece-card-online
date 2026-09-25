"""Record the eight grounded walk frames cut from the original GPT atlases."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "tools/launcher-room/action-source-png/action-manifest.json"
OUTPUT = ROOT / "docs/LAUNCHER_ROOM_WALK_ART_20260925.json"
CHARACTERS = ("luffy", "zoro", "nami", "usopp", "sanji", "chopper", "robin", "brook")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    frames = json.loads(SOURCE.read_text(encoding="utf-8"))
    by_name = {entry["character"]: entry for entry in frames["characters"]}
    items = []
    for key in CHARACTERS:
        row = by_name[key]
        frame = next(entry for entry in row["frames"] if entry["pose"] == "walk2")
        source = frame["sourcePng"]
        asset = f"public/images/launcher_room/action_frames/{key}/walk2.webp"
        allowed_sources = {
            f"tools/launcher-room/action-source-png/{key}.png",
            f"tools/launcher-room/action-source-png/{key}-walk2-grounded.png",
        }
        if source not in allowed_sources or frame["path"] != asset:
            raise ValueError(f"Unexpected grounded-walk source: {key}")
        source_path, asset_path = ROOT / source, ROOT / asset
        with Image.open(asset_path) as image:
            alpha = image.convert("RGBA").getchannel("A")
            if image.size != (256, 256) or not alpha.getbbox():
                raise ValueError(f"Invalid walk frame: {asset}")
            bounds = list(alpha.getbbox())
        items.append({
            "key": key,
            "sourcePng": source,
            "sourceSha256": sha256(source_path),
            "sourceRegion": frame["sourceRegion"],
            "asset": asset,
            "assetSha256": sha256(asset_path),
            "assetBytes": asset_path.stat().st_size,
            "assetPixels": [256, 256],
            "alphaBounds": bounds,
        })
    document = {
        "version": "1.1.12",
        "date": "2026-09-25",
        "generator": "GPT character action atlases and selected grounded stride redraws",
        "canonicalCharactersOnly": True,
        "items": items,
    }
    OUTPUT.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ROOM_WALK_ART_MANIFEST=PASS frames={len(items)} output={OUTPUT}")


if __name__ == "__main__":
    main()
