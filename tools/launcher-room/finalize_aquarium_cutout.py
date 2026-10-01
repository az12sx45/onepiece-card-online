"""Align the generated fish-free tank to the original scene cutout.

ImageGen removes the generic fish and extracts the ship. SIFT preserves the
accepted room's floor and frame geometry while only using generated pixels
inside the aquarium glass.
"""

from pathlib import Path
import sys

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from launcher_scene_cutout_finalize import finalize  # noqa: E402


def fish_free_cutout(source: Path, original: Path, output: Path) -> None:
    finalize(source, original, output)
    generated = np.asarray(Image.open(source).convert("RGBA").resize((1600, 900), Image.Resampling.LANCZOS))
    accepted = np.asarray(Image.open(original).convert("RGBA"))
    foreground = np.asarray(Image.open(output).convert("RGBA")).copy()

    sift = cv2.SIFT_create(nfeatures=5000)
    kp_gen, des_gen = sift.detectAndCompute(cv2.cvtColor(generated[:, :, :3], cv2.COLOR_RGB2GRAY),
                                            (generated[:, :, 3] > 128).astype(np.uint8) * 255)
    kp_ref, des_ref = sift.detectAndCompute(cv2.cvtColor(accepted[:, :, :3], cv2.COLOR_RGB2GRAY), None)
    matches = cv2.BFMatcher().knnMatch(des_gen, des_ref, k=2)
    good = [m for m, n in matches if m.distance < n.distance * .68]
    src = np.float32([kp_gen[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
    dst = np.float32([kp_ref[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
    transform, inliers = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=3.0)
    if transform is None or inliers.sum() < 25:
        raise ValueError("aquarium imagegen edit could not be aligned")
    clean_tank = cv2.warpAffine(generated[:, :, :3], transform, (1600, 900), flags=cv2.INTER_LINEAR)
    glass = np.zeros((900, 1600), dtype=np.uint8)
    cv2.ellipse(glass, (800, 156), (414, 119), 0, 0, 360, 255, -1)
    # The little center door overlaps the aquarium at its lower edge.
    cv2.rectangle(glass, (738, 242), (865, 295), 0, -1)
    glass = cv2.GaussianBlur(glass, (17, 17), 4)
    factor = glass.astype(np.float32)[:, :, None] / 255
    foreground[:, :, :3] = np.rint(foreground[:, :, :3] * (1 - factor) + clean_tank * factor).astype(np.uint8)
    foreground[foreground[:, :, 3] == 0, :3] = 0
    Image.fromarray(foreground, "RGBA").save(output, "WEBP", quality=92, method=6)
    result = Image.open(output)
    assert result.size == (1600, 900) and result.mode == "RGBA"
    print(f"{output}: 1600x900 RGBA, {int(inliers.sum())}/{len(good)} alignment matches, fish-free tank")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit("usage: finalize_aquarium_cutout.py GENERATED.png ORIGINAL.webp OUTPUT.webp")
    fish_free_cutout(*(Path(argument) for argument in sys.argv[1:]))
