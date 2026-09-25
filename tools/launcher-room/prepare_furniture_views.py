"""Split GPT-generated four-view furniture sheets into aligned transparent sprites.

The 2 x 2 source order is front, right, back, left. Sources are retained as
unmodified PNG files in furniture-source-png; this script only derives WebP.
"""

from pathlib import Path
import hashlib

import cv2
import numpy as np
from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[2]
SOURCES = ROOT / "tools" / "launcher-room" / "furniture-source-png"
OUTPUT = ROOT / "public" / "images" / "launcher_room" / "furniture_views"
KEYS = (
    "bookshelf",
    "helm",
    "kitchen-table",
    "map-table",
    "medicine-cabinet",
    "piano",
    "swords-rack",
    "tangerine-tree",
    "tool-bench",
    "treasure-chest",
)
SIZE = 384
MARGIN = 12


def read_views(path: Path) -> list[Image.Image]:
    image = Image.open(path).convert("RGBA")
    if image.width != image.height or image.width < 1024 or image.width % 2:
        raise ValueError(f"{path.name}: expected even square 1024px+ source")
    half = image.width // 2
    pixels = np.asarray(image).copy()
    solid = (pixels[:, :, 3] >= 5).astype(np.uint8)
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(solid, connectivity=8)
    substantial = [i for i in range(1, count) if stats[i, cv2.CC_STAT_AREA] > 100000]
    # Most sheets have a clear gutter around all four complete objects. Extract
    # those full silhouettes before quadrant splitting so overhanging sword or
    # piano edges are not chopped at the grid midpoint.
    if len(substantial) == 4:
        result: list[Image.Image | None] = [None] * 4
        for label in substantial:
            cx, cy = centroids[label]
            index = int(cx >= half) + 2 * int(cy >= half)
            keep = cv2.dilate((labels == label).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=1)
            separate = pixels.copy()
            separate[:, :, 3] *= keep
            if result[index] is not None:
                break
            result[index] = Image.fromarray(separate, "RGBA")
        else:
            if all(view is not None for view in result):
                return result  # type: ignore[return-value]
    boxes = (
        (0, 0, half, half),
        (half, 0, image.width, half),
        (0, half, half, image.height),
        (half, half, image.width, image.height),
    )
    return [image.crop(box) for box in boxes]


def bounds(view: Image.Image, key: str, rotation: int):
    alpha = view.getchannel("A")
    # Include softly faded ground contact while ignoring isolated one-pixel dust.
    bound = alpha.point(lambda x: 255 if x >= 5 else 0).getbbox()
    if not bound:
        raise ValueError(f"{key}/{rotation}: fully transparent view")
    if bound[2] - bound[0] < 150 or bound[3] - bound[1] < 150:
        raise ValueError(f"{key}/{rotation}: furniture too small")
    return bound


def isolate_main_silhouette(view: Image.Image, key: str, rotation: int) -> Image.Image:
    """Remove pieces leaking into this quadrant from another sprite panel."""
    pixels = np.asarray(view).copy()
    solid = (pixels[:, :, 3] >= 5).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(solid, connectivity=8)
    if count < 2:
        raise ValueError(f"{key}/{rotation}: no visible furniture")
    main = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    # A one-pixel border retains antialiased color and softly faded shadows.
    keep = cv2.dilate((labels == main).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=1)
    discarded = int(np.count_nonzero((pixels[:, :, 3] > 0) & (keep == 0)))
    pixels[:, :, 3] *= keep
    if discarded:
        print(f"{key}/{rotation}: removed {discarded} neighboring-panel pixels")
    return Image.fromarray(pixels, "RGBA")


def process(key: str) -> None:
    path = SOURCES / f"{key}.png"
    if not path.exists():
        raise FileNotFoundError(path)
    views = [isolate_main_silhouette(view, key, i) for i, view in enumerate(read_views(path))]
    boxes = [bounds(view, key, i) for i, view in enumerate(views)]
    widths = [b[2] - b[0] for b in boxes]
    heights = [b[3] - b[1] for b in boxes]
    scale = min((SIZE - 2 * MARGIN) / max(widths), (SIZE - 2 * MARGIN) / max(heights))

    rendered = []
    output = OUTPUT / key
    output.mkdir(parents=True, exist_ok=True)
    for rotation, (view, box) in enumerate(zip(views, boxes)):
        cut = view.crop(box)
        scaled = cut.resize((round(cut.width * scale), round(cut.height * scale)), Image.Resampling.LANCZOS)
        canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
        x = (SIZE - scaled.width) // 2
        y = SIZE - MARGIN - scaled.height
        canvas.alpha_composite(scaled, (x, y))
        # The tall right-column bookshelf drawings touch each other across the
        # sheet gutter. A sliver of the upper shelf survives component isolation
        # just above and to the right of the lower-left-facing shelf.
        if key == "bookshelf" and rotation == 3:
            clean = np.asarray(canvas).copy()
            clean[:26, :, 3] = 0
            clean[:35, :185, 3] = 0
            clean[:80, 310:, 3] = 0
            canvas = Image.fromarray(clean, "RGBA")
        target = output / f"{rotation}.webp"
        canvas.save(target, "WEBP", lossless=True, method=6)
        rendered.append(canvas)
        digest = hashlib.sha256(target.read_bytes()).hexdigest()[:16]
        print(f"{key}/{rotation} {target.stat().st_size} bytes alpha={canvas.getchannel('A').getbbox()} sha256={digest}")

    # This catches accidentally repeated identical panels; visual review still matters.
    for first in range(4):
        for second in range(first + 1, 4):
            if not ImageChops.difference(rendered[first], rendered[second]).getbbox():
                raise ValueError(f"{key}: views {first} and {second} are identical")


if __name__ == "__main__":
    for item in KEYS:
        process(item)
