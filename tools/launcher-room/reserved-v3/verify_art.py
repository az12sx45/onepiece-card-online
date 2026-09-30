"""Audit locked future crew art. A successful audit is not a release flag."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
ROSTER = Path(__file__).with_name("roster.json")
SOURCE_GRIDS = {
    "master": (2, 2),
    "walk-side": (3, 2),
    "walk-front": (3, 2),
    "acting-side": (4, 4),
    "acting-front": (4, 4),
    "work": (4, 4),
    "utility": (4, 4),
}
DIRECTIONS = ("east", "west", "north", "south")


def digest(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def expected_assets(key: str) -> dict[str, tuple[int, int, int]]:
    base = f"public/images/launcher_room/reserved_v3/{key}"
    result = {f"{base}/portrait.webp": (256, 256, 1)}
    result.update({f"{base}/walk/{direction}.webp": (1536, 384, 4) for direction in DIRECTIONS})
    result.update({f"{base}/acting/{direction}.webp": (2048, 256, 8) for direction in DIRECTIONS})
    result.update({f"{base}/life/work-{direction}.webp": (1024, 256, 4) for direction in DIRECTIONS})
    result.update({f"{base}/life/{action}-south.webp": (1024, 256, 4) for action in ("eat", "rest", "sleep", "train")})
    return result


def opacity_share(alpha: Image.Image) -> float:
    return sum(alpha.histogram()[32:]) / (alpha.width * alpha.height)


def check_source(path: Path, grid: tuple[int, int], layout: dict | None = None) -> list[str]:
    problems = []
    with Image.open(path) as image:
        if image.mode != "RGBA":
            return ["source is not RGBA"]
        if image.width < 768 or image.height < 768:
            problems.append("source sheet is below 768 px")
        alpha = image.getchannel("A")
        columns, rows = grid
        if layout is not None and (not isinstance(layout, dict) or set(layout) != {"rowCuts", "columnCuts"}):
            return ["source layout must contain only rowCuts and columnCuts"]
        xcuts = (layout or {}).get("columnCuts", [round(col * image.width / columns) for col in range(columns + 1)])
        ycuts = (layout or {}).get("rowCuts", [round(row * image.height / rows) for row in range(rows + 1)])
        if (len(xcuts) != columns + 1 or len(ycuts) != rows + 1 or
                xcuts[0] != 0 or xcuts[-1] != image.width or ycuts[0] != 0 or ycuts[-1] != image.height or
                any(type(value) is not int for value in xcuts + ycuts) or
                any(right <= left for left, right in zip(xcuts, xcuts[1:])) or
                any(bottom <= top for top, bottom in zip(ycuts, ycuts[1:]))):
            return ["source layout cuts are invalid"]
        for row in range(rows):
            for col in range(columns):
                cell = alpha.crop((xcuts[col], ycuts[row], xcuts[col + 1], ycuts[row + 1]))
                share = opacity_share(cell)
                if share < .025:
                    problems.append(f"cell {row}:{col} has no full figure")
                if share > .65:
                    problems.append(f"cell {row}:{col} likely has painted background or clipped figure ({share:.2f})")
                for edge_name, edge in (("top", (0, 0, cell.width, 1)), ("bottom", (0, cell.height - 1, cell.width, cell.height)),
                                        ("left", (0, 0, 1, cell.height)), ("right", (cell.width - 1, 0, cell.width, cell.height))):
                    if sum(cell.crop(edge).histogram()[25:]) > 0:
                        problems.append(f"cell {row}:{col} touches {edge_name} grid edge above alpha 24")
    return problems


def check_output(path: Path, dimensions: tuple[int, int, int]) -> list[str]:
    problems = []
    width, height, frames = dimensions
    with Image.open(path) as image:
        if image.size != (width, height):
            return [f"expected {width}x{height}, got {image.width}x{image.height}"]
        if image.mode != "RGBA":
            return ["output is not RGBA"]
        alpha = image.getchannel("A")
        if alpha.getextrema()[0] != 0:
            problems.append("output has no transparent background")
        cell = width // frames
        for frame in range(frames):
            share = opacity_share(alpha.crop((frame * cell, 0, (frame + 1) * cell, height)))
            if share < .002:
                problems.append(f"frame {frame} is empty")
            if share > .70:
                problems.append(f"frame {frame} likely has opaque background ({share:.2f})")
    return problems


def safe_path(root: Path, value: str, prefix: str) -> Path:
    if not isinstance(value, str) or not value.startswith(prefix) or ".." in Path(value).parts:
        raise ValueError("source path is outside the reserved art tree")
    path = (root / value).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("source path resolves outside the repository")
    return path


def verify(root: Path, roster: dict) -> dict:
    if roster.get("schema") != "one-piece-launcher-future-crew/1" or roster.get("characterCount") != 10:
        raise ValueError("unsupported or incomplete roster schema")
    names = roster.get("characters")
    if not isinstance(names, dict) or len(names) != 10:
        raise ValueError("roster must list exactly ten characters")
    results = {}
    for key, record in names.items():
        if not key.isascii() or not key.replace("-", "").isalnum():
            raise ValueError("invalid character key")
        errors = []
        if record.get("locked") is not True or record.get("runtimeEligible") is not False or record.get("availableForPurchase") is not False:
            errors.append("locked character has release/ownership access enabled")
        selected = record.get("sourceSheets") or {}
        present_sources = 0
        missing_sources = []
        for sheet, grid in SOURCE_GRIDS.items():
            source = selected.get(sheet)
            if not source:
                missing_sources.append(sheet)
                continue
            try:
                path = safe_path(root, source["path"], f"tools/launcher-room/reserved-v3/sources/{key}/")
                if not path.is_file():
                    errors.append(f"{sheet}: selected source is missing")
                    continue
                if digest(path) != source.get("sha256") or path.stat().st_size != source.get("bytes"):
                    errors.append(f"{sheet}: selected source hash or length changed")
                    continue
                present_sources += 1
                errors.extend(f"{sheet}: {problem}" for problem in check_source(path, grid, source.get("layout")))
            except (KeyError, ValueError, OSError) as exc:
                errors.append(f"{sheet}: {exc}")
        present_outputs = 0
        missing_outputs = []
        for relative, dimensions in expected_assets(key).items():
            path = root / relative
            if not path.is_file():
                missing_outputs.append(relative)
                continue
            present_outputs += 1
            try:
                errors.extend(f"{relative}: {problem}" for problem in check_output(path, dimensions))
            except (OSError, ValueError) as exc:
                errors.append(f"{relative}: {exc}")
        contact = record.get("contactReview")
        contact_ok = False
        if isinstance(contact, dict) and contact.get("status") == "model-reviewed":
            try:
                path = safe_path(root, contact["path"], "tools/launcher-room/reserved-v3/contacts/")
                contact_ok = path.is_file() and digest(path) == contact.get("sha256")
            except (KeyError, ValueError, OSError):
                pass
        art_ready = not errors and not missing_sources and not missing_outputs and contact_ok
        results[key] = {
            "sourceSheetsPresent": present_sources,
            "sourceSheetsRequired": len(SOURCE_GRIDS),
            "sourceSheetsMissing": missing_sources,
            "runtimeAssetsPresent": present_outputs,
            "runtimeAssetsRequired": 17,
            "runtimeAssetsMissing": missing_outputs,
            "contactReviewValid": contact_ok,
            "artReadyForReleaseReview": art_ready,
            "errors": errors,
        }
    return {
        "schema": "one-piece-future-crew-art-audit/1",
        "rosterSha256": digest(ROSTER),
        "allArtReadyForReleaseReview": all(item["artReadyForReleaseReview"] for item in results.values()),
        "characters": results,
        "summary": {
            "sourceSheetsPresent": sum(item["sourceSheetsPresent"] for item in results.values()),
            "sourceSheetsRequired": 70,
            "runtimeAssetsPresent": sum(item["runtimeAssetsPresent"] for item in results.values()),
            "runtimeAssetsRequired": 170,
            "artReadyCharacters": sum(item["artReadyForReleaseReview"] for item in results.values()),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--report", type=Path, help="write a new audit report without replacing an earlier one")
    args = parser.parse_args()
    roster = json.loads(ROSTER.read_text(encoding="utf-8"))
    result = verify(args.root.resolve(), roster)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        with args.report.open("x", encoding="utf-8") as stream:
            json.dump(result, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
    print(json.dumps(result["summary"], ensure_ascii=False))
    return 0 if result["allArtReadyForReleaseReview"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
