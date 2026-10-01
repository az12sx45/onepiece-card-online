"""Prepare accepted generated transparent room art for the desktop asset pack.

The creative cutout/render is produced by ImageGen. This script only normalizes
its dimensions, separates a four-view contact sheet, and records alpha checks.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def alpha_bounds(image: Image.Image) -> tuple[int, int, int, int]:
    mask = image.getchannel("A").point(lambda value: 255 if value >= 32 else 0)
    bounds = mask.getbbox()
    if bounds is None:
        raise ValueError("image has no visible pixels")
    return bounds


def save_scene(source: Path, output: Path) -> dict:
    image = Image.open(source).convert("RGBA")
    if image.width / image.height < 1.75 or image.width / image.height > 1.80:
        raise ValueError("scene must be approximately 16:9")
    if image.getchannel("A").getextrema() != (0, 255):
        raise ValueError("scene needs genuine transparent and opaque pixels")
    scene = image.resize((1600, 900), Image.Resampling.LANCZOS)
    if scene.getchannel("A").getpixel((0, 0)) > 12:
        raise ValueError("outside corner was not made transparent")
    if scene.getchannel("A").getpixel((800, 800)) < 248:
        raise ValueError("floor is not opaque")
    output.parent.mkdir(parents=True, exist_ok=True)
    scene.save(output, "WEBP", quality=92, method=6)
    with Image.open(output) as verify:
        if verify.size != (1600, 900) or verify.mode != "RGBA":
            raise ValueError("saved scene did not retain dimensions and alpha")
        alpha = verify.getchannel("A")
        return {"source": str(source), "output": str(output), "size": verify.size,
                "alphaRange": alpha.getextrema(), "visibleBounds": alpha_bounds(verify)}


def save_texture(source: Path, output: Path) -> dict:
    image = Image.open(source).convert("RGB")
    if image.width / image.height < 1.75 or image.width / image.height > 1.80:
        raise ValueError("ocean texture must be approximately 16:9")
    output.parent.mkdir(parents=True, exist_ok=True)
    image.resize((1600, 900), Image.Resampling.LANCZOS).save(output, "WEBP", quality=87, method=6)
    with Image.open(output) as verify:
        if verify.size != (1600, 900) or verify.mode != "RGB":
            raise ValueError("saved ocean texture dimensions or format invalid")
    return {"source": str(source), "output": str(output), "size": [1600, 900]}


def save_sheet(source: Path, output_dir: Path, split_x: int, split_y: int,
               max_width: int, max_height: int) -> dict:
    image = Image.open(source).convert("RGBA")
    if not (0 < split_x < image.width and 0 < split_y < image.height):
        raise ValueError("sheet splits fall outside source")
    regions = (
        (0, 0, split_x, split_y),
        (split_x, 0, image.width, split_y),
        (0, split_y, split_x, image.height),
        (split_x, split_y, image.width, image.height),
    )
    cropped = []
    bounds = []
    for region in regions:
        panel = image.crop(region)
        box = alpha_bounds(panel)
        # A stray pixel at the cut line means two views were merged or clipped.
        edge = panel.getchannel("A")
        if max(edge.crop((panel.width - 1, 0, panel.width, panel.height)).getextrema()) > 80 and region[2] == split_x:
            raise ValueError("left view reaches sheet split")
        piece = panel.crop(box)
        cropped.append(piece)
        bounds.append(box)
    scale = min(max_width / max(piece.width for piece in cropped),
                max_height / max(piece.height for piece in cropped))
    if scale <= 0 or scale > 2:
        raise ValueError("unexpected furniture sheet scale")
    output_dir.mkdir(parents=True, exist_ok=True)
    outputs = []
    for rotation, piece in enumerate(cropped):
        size = (round(piece.width * scale), round(piece.height * scale))
        sprite = piece.resize(size, Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (384, 384), (0, 0, 0, 0))
        canvas.alpha_composite(sprite, ((384 - size[0]) // 2, 372 - size[1]))
        target = output_dir / f"{rotation}.webp"
        canvas.save(target, "WEBP", quality=93, method=6)
        with Image.open(target) as verify:
            if verify.size != (384, 384) or verify.mode != "RGBA":
                raise ValueError("saved furniture view lost alpha or size")
            outputs.append({"path": str(target), "visibleBounds": alpha_bounds(verify),
                            "alphaRange": verify.getchannel("A").getextrema()})
    return {"source": str(source), "outputDir": str(output_dir), "sourceSize": image.size,
            "split": [split_x, split_y], "sourceViewBounds": bounds, "scale": scale,
            "views": outputs}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("kind", choices=("scene", "sheet", "texture"))
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--split-x", type=int)
    parser.add_argument("--split-y", type=int)
    parser.add_argument("--max-width", type=int, default=348)
    parser.add_argument("--max-height", type=int, default=336)
    args = parser.parse_args()
    if args.kind == "scene":
        result = save_scene(args.source, args.output)
    elif args.kind == "texture":
        result = save_texture(args.source, args.output)
    else:
        result = save_sheet(args.source, args.output, args.split_x, args.split_y, args.max_width, args.max_height)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
