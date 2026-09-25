"""Make contact sheets and measure whether room action/view frames differ visibly."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont

from build_depth_art_manifest import CHARACTERS, FURNITURE, POSES, ROOT


CELL = 164
LABEL = 22
BACKGROUND = (15, 37, 46, 255)


def preview(path: Path) -> Image.Image:
    with Image.open(path) as source:
        rgba = source.convert("RGBA")
    rgba.thumbnail((CELL - 12, CELL - 12), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CELL, CELL), BACKGROUND)
    canvas.alpha_composite(rgba, ((CELL - rgba.width) // 2, CELL - rgba.height - 4))
    return canvas.convert("RGB")


def changed_ratio(left: Image.Image, right: Image.Image) -> float:
    a = left.resize((96, 96), Image.Resampling.LANCZOS)
    b = right.resize((96, 96), Image.Resampling.LANCZOS)
    diff = ImageChops.difference(a, b).convert("RGB")
    return round(sum(max(pixel) > 32 for pixel in diff.getdata()) / (96 * 96), 4)


def sheet(kind: str, names: tuple[str, ...], variants: tuple[str, ...], output: Path) -> dict:
    width = len(variants) * CELL
    height = len(names) * (CELL + LABEL)
    contact = Image.new("RGB", (width, height), (8, 24, 31))
    draw = ImageDraw.Draw(contact)
    metrics = {}
    for row, name in enumerate(names):
        rendered = []
        for col, variant in enumerate(variants):
            path = ROOT / "public" / "images" / "launcher_room" / kind / name / f"{variant}.webp"
            if not path.is_file():
                raise FileNotFoundError(path)
            tile = preview(path)
            x, y = col * CELL, row * (CELL + LABEL)
            contact.paste(tile, (x, y))
            draw.text((x + 4, y + CELL + 2), f"{name} {variant}", fill=(240, 225, 179), font=ImageFont.load_default())
            rendered.append(tile)
        if kind == "action_frames":
            metrics[name] = {
                "walk1_walk2_changed": changed_ratio(rendered[1], rendered[2]),
                "happy_annoyed_changed": changed_ratio(rendered[3], rendered[4]),
                "idle_use_changed": changed_ratio(rendered[0], rendered[6]),
            }
        else:
            metrics[name] = {
                "front_right_changed": changed_ratio(rendered[0], rendered[1]),
                "front_back_changed": changed_ratio(rendered[0], rendered[2]),
                "back_left_changed": changed_ratio(rendered[2], rendered[3]),
            }
    contact.save(output)
    return metrics


def main() -> None:
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("D:/Codex_QA/launcher-room-world-1.1.11")
    target.mkdir(parents=True, exist_ok=True)
    characters = sheet("action_frames", CHARACTERS, POSES, target / "character-actions-contact.png")
    furniture = sheet("furniture_views", FURNITURE, ("0", "1", "2", "3"), target / "furniture-views-contact.png")
    report = {
        "characterFrames": len(CHARACTERS) * len(POSES),
        "furnitureViews": len(FURNITURE) * 4,
        "characters": characters,
        "furniture": furniture,
        "lowMotionPairs": [name for name, values in characters.items() if values["walk1_walk2_changed"] < 0.06],
        "lowDirectionPairs": [name for name, values in furniture.items() if values["front_back_changed"] < 0.08],
    }
    (target / "art-motion-review.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ROOM_ART_REVIEW=PASS characters={len(characters)} furniture={len(furniture)} lowMotion={len(report['lowMotionPairs'])} lowDirection={len(report['lowDirectionPairs'])}")


if __name__ == "__main__":
    main()
