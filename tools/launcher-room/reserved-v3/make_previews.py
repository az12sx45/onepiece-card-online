"""Export ten locked art-preview portraits from accepted master front views."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OUTPUT = ROOT / "public/images/launcher_room/reserved_v3_previews"
MANIFEST = HERE / "preview-manifest.json"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render(source_path: Path) -> tuple[Image.Image, tuple[int, int, int, int]]:
    with Image.open(source_path) as image:
        if image.mode != "RGBA":
            raise ValueError(f"Source lacks RGBA: {source_path}")
        front = image.crop((round(image.width / 2), round(image.height / 2), image.width, image.height))
    # Ignore isolated faint model specks while preserving semi-transparent edge ink.
    threshold = front.getchannel("A").point(lambda value: 255 if value >= 24 else 0)
    box = threshold.getbbox()
    if not box:
        raise ValueError(f"Front figure is empty: {source_path}")
    front = front.crop(box)
    scale = min(220 / front.height, 224 / front.width)
    size = (max(1, round(front.width * scale)), max(1, round(front.height * scale)))
    front = front.resize(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
    canvas.alpha_composite(front, ((256 - size[0]) // 2, 232 - size[1]))
    return canvas, box


def main() -> None:
    roster = json.loads((HERE / "roster.json").read_text(encoding="utf-8"))
    if len(roster.get("characters", {})) != 10:
        raise ValueError("Expected exactly ten locked candidates")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    entries = {}
    for key, character in roster["characters"].items():
        if character.get("locked") is not True or character.get("availableForPurchase") is not False:
            raise ValueError(f"Cannot make a preview for a released character: {key}")
        selected = character["sourceSheets"]["master"]
        source_path = ROOT / selected["path"]
        if digest(source_path) != selected["sha256"]:
            raise ValueError(f"Selected original changed: {key}")
        image, box = render(source_path)
        target = OUTPUT / f"{key}.webp"
        if target.exists():
            raise FileExistsError(f"Preserve existing preview: {target}")
        image.save(target, format="WEBP", quality=90, method=6, exact=True)
        with Image.open(target) as decoded:
            if decoded.size != (256, 256) or decoded.mode != "RGBA":
                raise ValueError(f"Invalid exported preview: {target}")
            alpha = decoded.getchannel("A")
            if alpha.getextrema()[0] != 0 or alpha.getextrema()[1] != 255:
                raise ValueError(f"Preview alpha is invalid: {target}")
        entries[key] = {
            "path": target.relative_to(ROOT).as_posix(),
            "sha256": digest(target),
            "bytes": target.stat().st_size,
            "dimensions": [256, 256],
            "sourcePath": selected["path"],
            "sourceSha256": selected["sha256"],
            "frontCellBoundingBox": list(box),
            "releaseStatus": "locked-art-preview-only",
            "runtimeAnimationComplete": False,
        }
    manifest = {
        "schema": "one-piece-locked-crew-previews/1",
        "rosterSha256": digest(HERE / "roster.json"),
        "characterCount": 10,
        "previews": entries,
    }
    with MANIFEST.open("x", encoding="utf-8") as stream:
        json.dump(manifest, stream, ensure_ascii=False, indent=2)
        stream.write("\n")
    print(json.dumps({"count": len(entries), "totalBytes": sum(item["bytes"] for item in entries.values())}))


if __name__ == "__main__":
    main()
