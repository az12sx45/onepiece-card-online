"""Prepare GPT-generated canonical One Piece chibi and emotion PNGs for the room."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "tools/launcher-room/source-png"
ROOM = ROOT / "public/images/launcher_room"
CHARACTERS = ("luffy", "zoro", "nami", "chopper", "sanji", "robin", "usopp", "franky", "brook", "jinbe")
MOODS = ("happy", "surprised", "focused", "annoyed")
MANIFEST = ROOT / "docs/LAUNCHER_ROOM_EXPANSION_ART_20260925.json"
CHIBI_HEIGHT = {"usopp": 620, "franky": 630, "brook": 688, "jinbe": 608}
FOOTLINE = 724


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_chibi(name: str) -> dict[str, object]:
    source = SOURCE / f"{name}.png"
    output = ROOM / "chibi" / f"{name}.webp"
    with Image.open(source) as image:
        original = image.convert("RGBA")
    if name not in CHIBI_HEIGHT:
        raise ValueError(f"Only new full-body sprites may be prepared here: {name}")
    # Existing six sprites use a common 724px footline. Keep that baseline and
    # scale each canonical silhouette to a comparable visible height.
    original.putalpha(original.getchannel("A").point(lambda a: 0 if a <= 2 else a))
    bounds = original.getbbox()
    if bounds is None:
        raise ValueError(f"Empty source image: {source}")
    cutout = original.crop(bounds)
    height = CHIBI_HEIGHT[name]
    width = round(cutout.width * height / cutout.height)
    if width > 500:
        raise ValueError(f"New chibi too wide: {name}: {width}")
    cutout = cutout.resize((width, height), Image.Resampling.LANCZOS)
    sprite = Image.new("RGBA", (512, 768), (0, 0, 0, 0))
    sprite.alpha_composite(cutout, ((512 - width) // 2, FOOTLINE - height))
    sprite.putalpha(sprite.getchannel("A").point(lambda a: 0 if a <= 2 else a))
    if any(sprite.getpixel(p)[3] for p in ((0, 0), (511, 0), (0, 767), (511, 767))):
        raise ValueError(f"Chibi has opaque corner: {name}")
    output.parent.mkdir(parents=True, exist_ok=True)
    sprite.save(output, format="WEBP", quality=88, method=6)
    return {"character": name, "sourceSha256": digest(source), "assetSha256": digest(output), "pixels": [512, 768], "alphaBounds": sprite.getbbox()}


def save_emotions(name: str) -> list[dict[str, object]]:
    source = SOURCE / f"{name}-emotions-sheet.png"
    with Image.open(source) as original:
        sheet = original.convert("RGBA")
    if sheet.width != sheet.height or sheet.width % 2:
        raise ValueError(f"Emotion sheet must be even square: {source}")
    half = sheet.width // 2
    prepared = []
    for index, mood in enumerate(MOODS):
        x = index % 2 * half
        y = index // 2 * half
        portrait = sheet.crop((x, y, x + half, y + half))
        portrait = portrait.resize((256, 256), Image.Resampling.LANCZOS)
        portrait.putalpha(portrait.getchannel("A").point(lambda a: 0 if a <= 2 else a))
        output = ROOM / "emotions" / f"{name}-{mood}.webp"
        output.parent.mkdir(parents=True, exist_ok=True)
        portrait.save(output, format="WEBP", quality=88, method=6)
        prepared.append({"character": name, "mood": mood, "pixels": [256, 256], "alphaBounds": portrait.getbbox(), "assetSha256": digest(output)})
    return prepared


def build_manifest() -> dict[str, object]:
    items = []
    new_chibi = ("usopp", "franky", "brook", "jinbe")
    for name in new_chibi:
        source = SOURCE / f"{name}.png"
        output = ROOM / "chibi" / f"{name}.webp"
        items.append((f"chibi/{name}", name, None, source, output))
    for name in CHARACTERS:
        source = SOURCE / f"{name}-emotions-sheet.png"
        for mood in MOODS:
            output = ROOM / "emotions" / f"{name}-{mood}.webp"
            items.append((f"emotions/{name}-{mood}", name, mood, source, output))
    manifest_items = []
    for asset_id, character, mood, source, output in items:
        with Image.open(output) as saved:
            image = saved.convert("RGBA")
            expected = (512, 768) if mood is None else (256, 256)
            if image.size != expected:
                raise ValueError(f"Wrong pixels: {output}: {image.size}")
            corners = ((0, 0), (image.width - 1, 0), (0, image.height - 1), (image.width - 1, image.height - 1))
            if any(image.getpixel(c)[3] > 2 for c in corners):
                raise ValueError(f"Opaque corner: {output}")
            bbox = image.getbbox()
            if bbox is None:
                raise ValueError(f"Empty art: {output}")
            manifest_items.append({
                "id": asset_id,
                "character": character,
                "mood": mood,
                "sourcePng": source.relative_to(ROOT).as_posix(),
                "sourceSha256": digest(source),
                "asset": output.relative_to(ROOT).as_posix(),
                "assetSha256": digest(output),
                "assetBytes": output.stat().st_size,
                "assetPixels": list(image.size),
                "alpha": "transparent-cutout",
                "alphaBounds": list(bbox),
            })
    if len(manifest_items) != 44:
        raise ValueError(f"Expected 44 new assets, got {len(manifest_items)}")
    document = {
        "version": "1.1.10",
        "date": "2026-09-25",
        "generator": "OpenAI built-in image_gen, one independent generation per full-body sprite and per emotion atlas",
        "processing": "Local PNG-to-WebP conversion; each generated four-expression atlas cropped to four 256x256 transparent portraits",
        "canonicalCharactersOnly": True,
        "items": manifest_items,
    }
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"manifest": str(MANIFEST), "items": len(manifest_items), "sha256": digest(MANIFEST)}


def build_contact(path: Path) -> dict[str, object]:
    contact = Image.new("RGB", (780, 10 * 166 + 46), "#edf1f5")
    draw = ImageDraw.Draw(contact)
    for index, mood in enumerate(MOODS):
        draw.text((95 + index * 170, 10), mood, fill="#142638")
    for row, name in enumerate(CHARACTERS):
        y = 42 + row * 166
        draw.text((8, y + 68), name, fill="#142638")
        for col, mood in enumerate(MOODS):
            portrait_path = ROOM / "emotions" / f"{name}-{mood}.webp"
            with Image.open(portrait_path) as original:
                portrait = original.convert("RGBA").resize((156, 156), Image.Resampling.LANCZOS)
            x = 90 + col * 170
            draw.rectangle((x - 1, y - 1, x + 157, y + 157), fill="#fff", outline="#c1d0de")
            contact.paste(portrait, (x, y), portrait)
    path.parent.mkdir(parents=True, exist_ok=True)
    contact.save(path)
    return {"contact": str(path), "sha256": digest(path), "pixels": list(contact.size)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--chibi", nargs="*", choices=CHARACTERS)
    parser.add_argument("--emotions", nargs="*", choices=CHARACTERS)
    parser.add_argument("--manifest", action="store_true")
    parser.add_argument("--contact", type=Path)
    args = parser.parse_args()
    result: dict[str, object] = {}
    if args.chibi:
        result["chibi"] = [save_chibi(name) for name in args.chibi]
    if args.emotions:
        result["emotions"] = [item for name in args.emotions for item in save_emotions(name)]
    if args.manifest:
        result["artManifest"] = build_manifest()
    if args.contact:
        result["contact"] = build_contact(args.contact)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
