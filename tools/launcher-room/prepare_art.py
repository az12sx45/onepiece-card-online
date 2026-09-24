"""Convert selected GPT PNG room artwork into deterministic launcher WebP files."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--scene", action="store_true")
    args = parser.parse_args()

    with Image.open(args.source) as original:
        image = original.convert("RGBA")
        source_size = image.size
        if args.scene:
            image = image.resize((1600, 900), Image.Resampling.LANCZOS).convert("RGB")
            alpha = "opaque"
        else:
            image.putalpha(image.getchannel("A").point(lambda value: 0 if value <= 2 else value))
            corners = [
                image.getpixel(point)[3]
                for point in ((0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1))
            ]
            if any(corners):
                raise SystemExit(f"Sprite PNG has an opaque corner; remove background first: {args.source}")
            alpha = "transparent"
        args.output.parent.mkdir(parents=True, exist_ok=True)
        image.save(args.output, format="WEBP", quality=88, method=6)
        result = {
            "source": str(args.source),
            "sourcePixels": source_size,
            "sourceSha256": sha256(args.source),
            "output": str(args.output),
            "outputPixels": image.size,
            "outputSha256": sha256(args.output),
            "outputBytes": args.output.stat().st_size,
            "alpha": alpha,
        }
        print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
