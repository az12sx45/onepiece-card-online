"""Import selected built-in GPT originals; resize and encode only, no painted edits."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
for key in ("crew-cabin", "sunny-deck", "sunny-kitchen", "sunny-library"):
    source = Path(__file__).parent / key / "source.png"
    target = ROOT / "public/images/launcher_room/scenes" / f"{key}-v2.webp"
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image.convert("RGB").resize((1600, 900), Image.Resampling.LANCZOS).save(
            target, "WEBP", quality=92, method=6
        )
    print(f"{key}: {target.stat().st_size} bytes")
