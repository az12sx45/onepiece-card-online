"""Finalize reviewed imagegen scene cutouts for the launcher room.

Usage: python scripts/launcher_scene_cutout_finalize.py SOURCE.png ORIGINAL.webp OUTPUT.webp
Requires Pillow and OpenCV. Source art is edited with imagegen; this step
aligns its alpha mask to the original art, removes detached alpha specks, and
encodes a WebP with the original foreground colors and details.
"""

import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image


def finalize(source: Path, original: Path, output: Path) -> None:
    image = Image.open(source).convert("RGBA").resize((1600, 900), Image.Resampling.LANCZOS)
    base = Image.open(original).convert("RGBA")
    if base.size != (1600, 900):
        raise ValueError(f"Original scene must be 1600x900: {original}")
    rgba = np.asarray(image).copy()
    alpha = rgba[:, :, 3]
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (alpha >= 128).astype(np.uint8), connectivity=8
    )
    if count < 2:
        raise ValueError(f"No opaque foreground in {source}")
    main = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    main_mask = (labels == main).astype(np.uint8)
    source_gray = cv2.cvtColor(rgba[:, :, :3], cv2.COLOR_RGB2GRAY)
    original_pixels = np.asarray(base).copy()
    original_gray = cv2.cvtColor(original_pixels[:, :, :3], cv2.COLOR_RGB2GRAY)
    sift = cv2.SIFT_create(nfeatures=5000)
    key_src, desc_src = sift.detectAndCompute(source_gray, main_mask * 255)
    key_dst, desc_dst = sift.detectAndCompute(original_gray, None)
    if desc_src is None or desc_dst is None:
        raise ValueError(f"Cannot align foreground to original: {source}")
    matches = cv2.BFMatcher().knnMatch(desc_src, desc_dst, k=2)
    good = [m for m, n in matches if m.distance < n.distance * 0.68]
    if len(good) < 30:
        raise ValueError(f"Only {len(good)} scene alignment matches: {source}")
    src = np.float32([key_src[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst = np.float32([key_dst[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    transform, inliers = cv2.estimateAffinePartial2D(
        src, dst, method=cv2.RANSAC, ransacReprojThreshold=3.0
    )
    if transform is None or int(inliers.sum()) < 25:
        raise ValueError(f"Scene alignment failed: {source}")
    aligned = cv2.warpAffine(main_mask * 255, transform, (1600, 900), flags=cv2.INTER_LINEAR)
    # The generator can leave detached bright pixels in transparent sky.
    # Eroding the selected ship silhouette removes edge color contamination.
    aligned = cv2.erode(aligned, np.ones((3, 3), np.uint8), iterations=3)
    original_pixels[:, :, 3] = cv2.GaussianBlur(aligned, (3, 3), 0.55)
    original_pixels[original_pixels[:, :, 3] == 0, :3] = 0
    clean = Image.fromarray(original_pixels, "RGBA")
    output.parent.mkdir(parents=True, exist_ok=True)
    clean.save(output, "WEBP", quality=90, method=6)
    check = Image.open(output)
    if check.size != (1600, 900) or check.getchannel("A").getextrema() != (0, 255):
        raise ValueError(f"Invalid transparent foreground: {output}")
    print(f"{output}: {output.stat().st_size:,} bytes, 1600x900 RGBA, {int(inliers.sum())}/{len(good)} alignment matches")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    finalize(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
