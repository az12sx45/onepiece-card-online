"""Read-only source inventory and contact sheets for the card depth art review."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw

VARIANTS = {"normal": "images/cards", "enh": "images/cards/enh",
            "lux": "images/cards_lux", "lux-enh": "images/cards_lux/enh"}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--public", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    inventory = []
    for variant, directory in VARIANTS.items():
        for start in (0, 10):
            sheet = Image.new("RGB", (1500, 940), "#172130")
            draw = ImageDraw.Draw(sheet)
            for offset in range(10):
                ident = start + offset
                source = args.public / directory / f"{ident}.webp"
                with Image.open(source) as source_image:
                    inventory.append({"variant": variant, "id": ident,
                                      "source": directory + f"/{ident}.webp",
                                      "size": source_image.size, "mode": source_image.mode,
                                      "sha256": hashlib.sha256(source.read_bytes()).hexdigest()})
                    thumb = source_image.convert("RGB").resize((290, 435))
                x, y = (offset % 5) * 300 + 5, (offset // 5) * 470 + 27
                sheet.paste(thumb, (x, y))
                draw.text((x, y-20), f"{variant} {ident}", fill="white")
            sheet.save(args.out / f"{variant}-{start:02}.jpg", quality=93)
    (args.out / "source-inventory.json").write_text(json.dumps(inventory, indent=2), encoding="utf-8")
    print(json.dumps({"cards": len(inventory), "source_modified": False, "out": str(args.out)}))

if __name__ == "__main__":
    main()
