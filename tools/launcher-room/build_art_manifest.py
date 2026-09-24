"""Write the reviewed 1.1.9 GPT room art inventory with source/output hashes."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "docs/LAUNCHER_ROOM_ART_20260925.json"
PROMPTS = {
    "scenes": {
        "sunny-deck": "Empty Thousand Sunny deck; large clear wood floor for freely placed room objects; no people.",
        "sunny-kitchen": "Empty Thousand Sunny galley; sea-view portholes, back-wall kitchen, clear floor; no people.",
        "sunny-library": "Empty Thousand Sunny library; bookshelves and portholes at the back, clear floor; no people.",
    },
    "furniture": {
        "helm": "Thousand Sunny ship helm on a movable pedestal; standalone transparent anime prop.",
        "map-table": "Nami nautical chart table with maps and compass; standalone transparent anime prop.",
        "treasure-chest": "Straw Hat pirate treasure chest, closed; standalone transparent anime prop.",
        "tangerine-tree": "Nami tangerine tree in ship planter; standalone transparent anime prop.",
        "swords-rack": "Zoro three-sword rack with sheathed katana; standalone transparent anime prop.",
        "kitchen-table": "Sanji galley dining table; standalone transparent anime prop.",
        "bookshelf": "Robin ship library bookcase; standalone transparent anime prop.",
        "medicine-cabinet": "Chopper medical cabinet; standalone transparent anime prop.",
        "piano": "Brook upright piano; standalone transparent anime prop.",
        "tool-bench": "Franky ship workshop bench; standalone transparent anime prop.",
    },
    "chibi": {
        "luffy": "Canonical Monkey D. Luffy, full-body chibi room sprite, existing game portrait reference.",
        "zoro": "Canonical Roronoa Zoro, full-body chibi room sprite, existing game portrait reference.",
        "nami": "Canonical Nami, full-body chibi room sprite, existing game portrait reference.",
        "chopper": "Canonical Tony Tony Chopper, full-body chibi room sprite, existing game portrait reference.",
        "sanji": "Canonical Sanji, full-body chibi room sprite, existing game portrait reference.",
        "robin": "Canonical Nico Robin, full-body chibi room sprite, existing game portrait reference.",
    },
    "frames": {
        "straw-hat": "Straw Hat pirate portrait frame, transparent outer area and open center.",
        "ship-wheel": "Thousand Sunny wheel portrait frame, transparent outer area and open center.",
    },
}


def digest(path: Path) -> str:
    hashed = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            hashed.update(chunk)
    return hashed.hexdigest()


def main() -> None:
    items = []
    for category, slugs in PROMPTS.items():
        for slug, prompt_intent in slugs.items():
            source = ROOT / f"tools/launcher-room/source-png/{slug}.png"
            output = ROOT / f"public/images/launcher_room/{category}/{slug}.webp"
            with Image.open(source) as original, Image.open(output) as delivered:
                image = delivered.convert("RGBA")
                corners = [
                    image.getpixel(point)[3]
                    for point in ((0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1))
                ]
                if category != "scenes" and any(corners):
                    raise SystemExit(f"Expected transparent corners: {output}")
                if category == "frames" and image.getpixel((image.width // 2, image.height // 2))[3] != 0:
                    raise SystemExit(f"Portrait frame has no transparent center: {output}")
                if category == "scenes" and delivered.size != (1600, 900):
                    raise SystemExit(f"Room scene has wrong dimensions: {output}")
                if category == "chibi" and delivered.size != (512, 768):
                    raise SystemExit(f"Chibi has wrong dimensions: {output}")
                items.append({
                    "id": f"{category}/{slug}",
                    "promptIntent": prompt_intent,
                    "sourcePng": source.relative_to(ROOT).as_posix(),
                    "sourceSha256": digest(source),
                    "sourcePixels": list(original.size),
                    "asset": output.relative_to(ROOT).as_posix(),
                    "assetSha256": digest(output),
                    "assetPixels": list(delivered.size),
                    "assetBytes": output.stat().st_size,
                    "alpha": "opaque-background" if category == "scenes" else "transparent-cutout",
                })
    if len(items) != 21:
        raise SystemExit(f"Expected 21 GPT assets; got {len(items)}")
    document = {
        "version": "1.1.9",
        "date": "2026-09-25",
        "generator": "OpenAI built-in image_gen, one independent generation per bitmap asset",
        "processing": "Local PNG-to-WebP conversion; transparent sprite alpha retained and checked",
        "canonicalCharactersOnly": True,
        "items": items,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "items": len(items), "manifest": str(OUTPUT), "sha256": digest(OUTPUT)}))


if __name__ == "__main__":
    main()
