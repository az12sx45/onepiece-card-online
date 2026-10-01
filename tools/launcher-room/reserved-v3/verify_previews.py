"""Verify exactly ten downloadable, locked art previews and their selected originals."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
PREVIEW_ROOT = ROOT / "public/images/launcher_room/reserved_v3_previews"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    roster_path = HERE / "roster.json"
    manifest_path = HERE / "preview-manifest.json"
    roster = json.loads(roster_path.read_text(encoding="utf-8"))
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    keys = set(roster.get("characters", {}))
    if roster.get("characterCount") != 10 or len(keys) != 10:
        raise ValueError("The locked candidate roster must contain exactly ten characters")
    if manifest.get("schema") != "one-piece-locked-crew-previews/1" or manifest.get("characterCount") != 10:
        raise ValueError("Unexpected preview manifest")
    if manifest.get("rosterSha256") != digest(roster_path) or set(manifest.get("previews", {})) != keys:
        raise ValueError("Preview manifest does not match the selected roster")
    actual = {path.name for path in PREVIEW_ROOT.iterdir() if path.is_file()}
    if actual != {f"{key}.webp" for key in keys}:
        raise ValueError("Unexpected or missing files in locked preview folder")
    total = 0
    for key in sorted(keys):
        candidate = roster["characters"][key]
        if candidate.get("locked") is not True or candidate.get("runtimeEligible") is not False or candidate.get("availableForPurchase") is not False:
            raise ValueError(f"Candidate is not locked: {key}")
        source = candidate["sourceSheets"]["master"]
        preview = manifest["previews"][key]
        expected = f"public/images/launcher_room/reserved_v3_previews/{key}.webp"
        if preview.get("path") != expected or preview.get("sourceSha256") != source["sha256"]:
            raise ValueError(f"Preview source/path mismatch: {key}")
        if preview.get("releaseStatus") != "locked-art-preview-only" or preview.get("runtimeAnimationComplete") is not False:
            raise ValueError(f"Preview is falsely marked as complete: {key}")
        path = ROOT / expected
        if path.stat().st_size != preview.get("bytes") or digest(path) != preview.get("sha256"):
            raise ValueError(f"Preview bytes changed: {key}")
        with Image.open(path) as image:
            if image.size != (256, 256) or image.mode != "RGBA" or image.getchannel("A").getextrema() != (0, 255):
                raise ValueError(f"Preview size or alpha is invalid: {key}")
        total += path.stat().st_size
    print(json.dumps({"lockedPreviewCount": len(keys), "totalBytes": total, "shaVerified": True}))


if __name__ == "__main__":
    main()
