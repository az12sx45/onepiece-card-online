"""Export one locked future crew member from seven reviewed whole-figure PNGs.

The output is a candidate art pack. This tool cannot release, sell, or select
a character. It refuses missing sources and existing output files.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import json
import math
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
OLD_PATH = HERE.parent / "reserved-v1" / "import_atlases.py"
OLD_SPEC = importlib.util.spec_from_file_location("reserved_v1_whole_figure", OLD_PATH)
old = importlib.util.module_from_spec(OLD_SPEC)
OLD_SPEC.loader.exec_module(old)
old.BASE = "tools/launcher-room/reserved-v3"
old.ASSET_ROOT = "public/images/launcher_room/reserved_v3"
old.MANIFEST = f"{old.BASE}/manifest.json"
original_cell_frame = old.cell_frame


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cell_frame(source_id, source, image, col, row, direction, pose):
    frame = original_cell_frame(source_id, source, image, col, row, direction, pose)
    layout = source.get("layout")
    if layout:
        xcuts, ycuts = layout["columnCuts"], layout["rowCuts"]
        frame["region"] = [xcuts[col], ycuts[row], xcuts[col + 1] - xcuts[col], ycuts[row + 1] - ycuts[row]]
    return frame


old.cell_frame = cell_frame


def load_sources(key: str) -> tuple[dict, dict, dict]:
    roster = json.loads((HERE / "roster.json").read_text(encoding="utf-8"))
    character = roster["characters"].get(key)
    if not character or (character.get("locked"), character.get("runtimeEligible"), character.get("availableForPurchase")) != (True, False, False):
        raise ValueError("Only a locked, unavailable future crew member can be exported")
    if set(character["sourceSheets"]) != set(old.SHEETS) or not all(character["sourceSheets"].values()):
        raise ValueError("All seven reviewed source sheets are required")
    sources, selected, images = {}, {}, {}
    for sheet, record in character["sourceSheets"].items():
        rel = record["path"]
        if not rel.startswith(f"tools/launcher-room/reserved-v3/sources/{key}/") or ".." in Path(rel).parts:
            raise ValueError(f"Unsafe selected source: {sheet}")
        path = (ROOT / rel).resolve()
        if not path.is_relative_to(ROOT) or not path.is_file() or sha(path) != record["sha256"] or path.stat().st_size != record["bytes"]:
            raise ValueError(f"Selected source missing or hash changed: {sheet}")
        image = Image.open(path).convert("RGBA")
        layout = record.get("layout")
        if layout:
            cols, rows = old.SHEETS[sheet]["grid"]
            xcuts, ycuts = layout.get("columnCuts"), layout.get("rowCuts")
            if (not isinstance(xcuts, list) or not isinstance(ycuts, list) or len(xcuts) != cols + 1 or len(ycuts) != rows + 1 or
                    xcuts[0] != 0 or xcuts[-1] != image.width or ycuts[0] != 0 or ycuts[-1] != image.height or
                    any(type(v) is not int for v in xcuts + ycuts) or
                    any(b <= a for a, b in zip(xcuts, xcuts[1:])) or any(b <= a for a, b in zip(ycuts, ycuts[1:]))):
                raise ValueError(f"Invalid saved row/column cuts: {sheet}")
        source_id = f"{key}-{sheet}"
        sources[source_id] = {"key": key, "sheet": sheet, "image": {"path": rel, "sha256": record["sha256"], "bytes": record["bytes"]},
                              "layout": layout, "standingReferenceCell": record.get("standingReferenceCell"), "generator": "gpt-image"}
        selected[sheet] = source_id
        images[source_id] = image
    return sources, selected, images


def prepare(key: str, sources: dict, selected: dict, images: dict) -> tuple[list, dict]:
    references = {}
    for sheet, source_id in selected.items():
        source, image = sources[source_id], images[source_id]
        col, row = source.get("standingReferenceCell") or old.SHEETS[sheet]["standing"]
        frame = cell_frame(source_id, source, image, col, row, "south", "calibration-standing")
        extracted = old.extraction(frame, image)
        references[source_id] = {"frame": frame, "opaqueBounds": extracted["opaqueBounds"],
                                 "sourceAnchor": extracted["sourceAnchor"], "standingHeight": extracted["opaqueBounds"][3]}
    master_height = references[selected["master"]]["standingHeight"]
    uniform_scale = 100 / master_height
    source_units = {source_id: master_height / ref["standingHeight"] for source_id, ref in references.items()}
    prepared = []
    for spec in old.build_specs(key, selected, sources, images):
        cell, columns = spec["cell"], spec["columns"]
        atlas = Image.new("RGBA", (cell * columns, cell))
        records = []
        for index, frame in enumerate(spec.pop("selections")):
            try:
                value = old.extraction(frame, images[frame["source"]])
            except ValueError as error:
                raise ValueError(f"{key}/{spec['kind']}/{spec.get('action', spec['direction'])}/{index} from {frame['sourceCell']}: {error}") from error
            value["sourceUnitScale"] = source_units[frame["source"]]
            rendered, transform = old.legacy.render_one(value, uniform_scale, cell)
            bounds, opaque = old.legacy.pixel_bounds(rendered), old.legacy.pixel_bounds(rendered, True)
            if not bounds or not opaque or min(bounds[:2]) <= 0 or max(bounds[2:]) >= cell:
                raise ValueError(f"Rendered frame clips output cell: {key} {spec['kind']}/{spec.get('action', spec['direction'])}/{spec['direction']} {index} {bounds}")
            if opaque[2] - opaque[0] > math.ceil(112 * cell / 128):
                raise ValueError(f"Figure too wide: {key} {spec['kind']}/{spec.get('action', spec['direction'])}/{spec['direction']} {index} {opaque}")
            atlas.paste(rendered, (index * cell, 0))
            records.append({**copy.deepcopy(frame), "index": index, "bounds": bounds, "opaqueBoundsAtOutput": opaque,
                            "rgbaSha256": hashlib.sha256(rendered.tobytes()).hexdigest(), "wholeImageTransform": transform,
                            "uniformCharacterScale": uniform_scale, "sourceUnitScale": source_units[frame["source"]],
                            "anatomyReassembled": False, "mirrored": False, "clipped": False})
        prepared.append({**spec, "atlas": atlas, "dimensions": list(atlas.size), "frames": records,
                         "sourceIds": sorted({frame["source"] for frame in records})})
    if len(prepared) != 17 or sum(len(item["frames"]) for item in prepared) != 81:
        raise ValueError("Character export must have exactly 17 atlases and 81 complete figures")
    return prepared, references


def export(key: str) -> dict:
    sources, selected, images = load_sources(key)
    prepared, references = prepare(key, sources, selected, images)
    old.KEYS = [key]
    output_dir = ROOT / old.ASSET_ROOT / key
    contact_path = ROOT / old.BASE / "contacts" / f"{key}.png"
    manifest_path = ROOT / old.BASE / "manifests" / f"{key}.json"
    qa_path = ROOT / old.BASE / "pixel-qa" / f"{key}.json"
    if contact_path.exists() or manifest_path.exists():
        raise FileExistsError("Contact or manifest already exists; this tool never overwrites an accepted art pack")
    expected_paths = {ROOT / item["asset"] for item in prepared}
    if output_dir.exists() and {p for p in output_dir.rglob("*") if p.is_file()} != expected_paths:
        raise FileExistsError("Partial or unexpected art pack files; inspect before retrying")
    items = []
    for item in prepared:
        record = {field: value for field, value in item.items() if field != "atlas"}
        target = ROOT / record["asset"]
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            with Image.open(target) as existing:
                if existing.convert("RGBA").tobytes() != item["atlas"].tobytes():
                    raise ValueError(f"Existing atlas differs from rendered source: {record['asset']}")
        else:
            item["atlas"].save(target, format="WEBP", lossless=True, exact=True, method=6)
        record["sha256"], record["bytes"] = sha(target), target.stat().st_size
        items.append(record)
    qa_path.parent.mkdir(parents=True, exist_ok=True)
    qa = old.pixel_qa(ROOT, items)
    if qa_path.exists():
        if json.loads(qa_path.read_text(encoding="utf-8")) != qa:
            raise ValueError("Existing pixel QA differs from the rendered art pack")
    else:
        qa_path.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    contacts = old.make_contacts(ROOT, items)
    manifest = {"schema": "one-piece-room-future-crew-character-art/1", "character": key,
                "releasePolicy": "locked-art-candidate", "runtimeEligible": False, "availableForPurchase": False,
                "artStatus": "awaiting-model-contact-review", "humanAcceptance": False,
                "sourceSheets": {sheet: sources[source_id] for sheet, source_id in selected.items()},
                "sourceCalibration": references, "items": items, "pixelQa": {"path": qa_path.relative_to(ROOT).as_posix(), "sha256": sha(qa_path)},
                "contactSheet": contacts[0], "assetCount": 17, "frameCount": 81,
                "processingRules": {"wholeFigureOnly": True, "anatomyReassembled": False, "mirrored": False,
                                    "sourceRegion": "one complete whole figure from each reviewed transparent cell",
                                    "calibration": "one master standing height and one standing reference per source sheet",
                                    "transforms": "uniform whole-image scale and translation only"}}
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {"ok": True, "character": key, "assets": 17, "frames": 81,
            "assetBytes": sum(item["bytes"] for item in items), "manifest": manifest_path.relative_to(ROOT).as_posix(),
            "contact": contacts[0]["path"], "releasePolicy": "locked-art-candidate"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("character")
    parser.add_argument("--dry-run", action="store_true", help="validate and render every atlas in memory without writing output")
    args = parser.parse_args()
    if args.dry_run:
        sources, selected, images = load_sources(args.character)
        prepared, references = prepare(args.character, sources, selected, images)
        print(json.dumps({"ok": True, "dryRun": True, "character": args.character, "assets": len(prepared),
                          "frames": sum(len(item["frames"]) for item in prepared), "calibratedSources": len(references)}, ensure_ascii=False))
    else:
        print(json.dumps(export(args.character), ensure_ascii=False))


if __name__ == "__main__":
    main()
