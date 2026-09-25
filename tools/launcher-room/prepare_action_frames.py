"""Cut the GPT-produced 3x3 One Piece action atlases into aligned room frames.

Source sheets stay in action-source-png.  This script never creates new art; it
only detects atlas gutters, normalizes canvas alignment and converts to WebP.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "tools" / "launcher-room" / "action-source-png"
DEST = ROOT / "public" / "images" / "launcher_room" / "action_frames"
POSES = (
    "idle", "walk1", "walk2", "talk_happy", "talk_annoyed",
    "surprised", "focused_use", "sit", "wave",
)
CHARACTERS = (
    "luffy", "zoro", "nami", "usopp", "sanji", "chopper",
    "robin", "franky", "brook", "jinbe",
)
FRAME_SIZE = 256
ALPHA_THRESHOLD = 12


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def split_lines(alpha: np.ndarray, axis: int) -> tuple[int, int]:
    """Select low-occupancy cuts close to thirds, with a gutter preference."""
    projection = np.count_nonzero(alpha > ALPHA_THRESHOLD, axis=1 - axis)
    extent = len(projection)
    cuts: list[int] = []
    for third in (1, 2):
        nominal = extent * third / 3
        radius = max(24, round(extent * 0.065))
        candidates = range(max(1, round(nominal) - radius), min(extent - 1, round(nominal) + radius))
        cut = min(candidates, key=lambda n: (int(projection[n]), abs(n - nominal)))
        # Generated atlases can leave an entirely transparent band; its centre
        # gives the safest separation for edges and antialiasing.
        if projection[cut] == 0:
            lo = hi = cut
            while lo > 0 and projection[lo - 1] == 0:
                lo -= 1
            while hi + 1 < extent and projection[hi + 1] == 0:
                hi += 1
            cut = (lo + hi) // 2
        cuts.append(cut)
    if cuts[0] >= cuts[1]:
        raise ValueError("The atlas thirds overlap")
    return cuts[0], cuts[1]


def process(character: str, *, allow_touching: bool = False) -> dict:
    sheet_path = SOURCE / f"{character}.png"
    sheet = Image.open(sheet_path).convert("RGBA")
    if min(sheet.size) < 900 or not 0.85 <= sheet.width / sheet.height <= 1.15:
        raise ValueError(f"{sheet_path} is not a near-square full-size atlas: {sheet.size}")
    alpha = np.asarray(sheet.getchannel("A"))
    if alpha.min() != 0 or alpha.max() < 240:
        raise ValueError(f"{sheet_path} does not have working transparency")
    xs = (0, *split_lines(alpha, 1), sheet.width)
    ys = (0, *split_lines(alpha, 0), sheet.height)
    cut_occupancy = {
        "x": [int(np.count_nonzero(alpha[:, n] > ALPHA_THRESHOLD)) for n in xs[1:3]],
        "y": [int(np.count_nonzero(alpha[n, :] > ALPHA_THRESHOLD)) for n in ys[1:3]],
    }
    if not allow_touching and max(*cut_occupancy["x"], *cut_occupancy["y"]) > 25:
        raise ValueError(f"{character} atlas has overlapping figures at cuts: {cut_occupancy}")
    entries: list[tuple[str, Image.Image, tuple[int, int, int, int], tuple[int, int, int, int]]] = []
    for row in range(3):
        for col in range(3):
            pose = POSES[row * 3 + col]
            region = (xs[col], ys[row], xs[col + 1], ys[row + 1])
            cell = sheet.crop(region)
            bbox = cell.getchannel("A").point(lambda a: 255 if a > ALPHA_THRESHOLD else 0).getbbox()
            if not bbox:
                raise ValueError(f"{character}/{pose} is empty")
            entries.append((pose, cell, bbox, region))
    # One scale for the entire character preserves natural pose size, especially
    # a seated pose, while making feet align to a common baseline.
    max_width = max(b[2] - b[0] for _, _, b, _ in entries)
    max_height = max(b[3] - b[1] for _, _, b, _ in entries)
    scale = min(240 / max_width, 242 / max_height)
    pose_overrides = {pose: SOURCE / f"{character}-{pose}.png" for pose in POSES}
    frame_dir = DEST / character
    frame_dir.mkdir(parents=True, exist_ok=True)
    frames = []
    for pose, cell, bbox, region in entries:
        source_path = sheet_path
        pose_scale = scale
        override = pose_overrides[pose]
        if override.exists():
            source_path = override
            cell = Image.open(override).convert("RGBA")
            region = (0, 0, cell.width, cell.height)
            bbox = cell.getchannel("A").point(lambda a: 255 if a > ALPHA_THRESHOLD else 0).getbbox()
            if not bbox:
                raise ValueError(f"Empty pose override: {override}")
            pose_scale = min(240 / (bbox[2] - bbox[0]), 242 / (bbox[3] - bbox[1]))
        crop = cell.crop(bbox)
        new_size = (max(1, round(crop.width * pose_scale)), max(1, round(crop.height * pose_scale)))
        art = crop.resize(new_size, Image.Resampling.LANCZOS)
        frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE))
        frame.alpha_composite(art, ((FRAME_SIZE - art.width) // 2, 248 - art.height))
        # Generated PNGs may carry vivid hidden RGB in fully transparent pixels.
        # It is invisible to browsers but some image viewers display those RGB
        # channels as red/yellow bars. Zero them, and remove alpha-only dust.
        pixels = np.array(frame)
        pixels[pixels[:, :, 3] <= ALPHA_THRESHOLD] = (0, 0, 0, 0)
        frame = Image.fromarray(pixels, "RGBA")
        path = frame_dir / f"{pose}.webp"
        frame.save(path, "WEBP", lossless=True, method=6, exact=True)
        verify = Image.open(path)
        if verify.size != (FRAME_SIZE, FRAME_SIZE) or verify.mode != "RGBA":
            raise ValueError(f"Bad output: {path}")
        saved = np.asarray(verify)
        if np.any(saved[saved[:, :, 3] == 0, :3]):
            raise ValueError(f"Transparent RGB contamination: {path}")
        if any(verify.getpixel(p)[3] for p in ((0, 0), (255, 0), (0, 255), (255, 255))):
            raise ValueError(f"Opaque corner: {path}")
        frames.append({"pose": pose, "path": str(path.relative_to(ROOT)).replace("\\", "/"),
                       "bytes": path.stat().st_size, "sha256": sha256(path),
                       "source": str(source_path.relative_to(ROOT)).replace("\\", "/"),
                       "sourcePng": str(source_path.relative_to(ROOT)).replace("\\", "/"),
                       "sourceSha256": sha256(source_path),
                       "sourceRegion": region, "sourceBounds": bbox})
    return {"character": character, "source": str(sheet_path.relative_to(ROOT)).replace("\\", "/"),
            "sourceSha256": sha256(sheet_path), "sourcePixels": sheet.size,
            "poseOverrideSha256": {pose: sha256(path) for pose, path in pose_overrides.items() if path.exists()},
            "cuts": {"x": xs[1:3], "y": ys[1:3], "occupancy": cut_occupancy},
            "scale": round(scale, 6), "frames": frames}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("characters", nargs="*", choices=CHARACTERS)
    parser.add_argument("--allow-touching", action="store_true")
    args = parser.parse_args()
    characters = args.characters or CHARACTERS
    manifest = {"schema": 1, "frameSize": [FRAME_SIZE, FRAME_SIZE],
                "poses": POSES, "characters": [process(c, allow_touching=args.allow_touching)
                                              for c in characters]}
    if len(characters) == len(CHARACTERS):
        out = SOURCE / "action-manifest.json"
        out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote {out}")
    print(json.dumps({"characters": characters,
                      "frames": sum(len(c["frames"]) for c in manifest["characters"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
