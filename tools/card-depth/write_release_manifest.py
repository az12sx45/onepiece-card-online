"""Verify one final 80-card build and write its compact, reproducible file manifest.

This validates bytes and provenance, not artistic approval or multiplayer behavior.
"""
import argparse
import json
from pathlib import Path
from birefnet_infer import digest
from card_recipes import RECIPES
from mask_corrections import CORRECTIONS
from mask_corrections_lux import WINDOW_INCLUDES


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--build-report", type=Path, required=True)
    parser.add_argument("--public", type=Path, required=True)
    parser.add_argument("--assets", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    build = json.loads(args.build_report.read_text(encoding="utf-8"))
    expected = {f'{r["variant"]}/{r["id"]}': r for r in RECIPES}
    # A reviewed card can be rebuilt after the initial full run. Its adjacent
    # individual report is authoritative and must match the current recipes.
    rows = [json.loads((args.build_report.parent / (r["key"].replace("/", "-") + "-report.json")).read_text(encoding="utf-8"))
            for r in build["cards"]]
    assert build["count"] == len(rows) == 80
    assert {r["key"] for r in rows} == set(expected)
    manifest = []
    all_files = []
    for row in rows:
        recipe = expected[row["key"]]
        assert row["recipe"] == recipe, f'stale layout: {row["key"]}'
        assert row.get("alpha_correction") == CORRECTIONS.get(row["key"]), f'stale outline: {row["key"]}'
        assert row.get("window_includes") == WINDOW_INCLUDES.get(row["key"])
        assert row["source"] == recipe["source"]
        assert digest(args.public / row["source"]) == row["source_sha256"]
        assert row["source_unchanged"] and row["fixed_pixel_max_error"] == 0
        assert row["size"] == [828, 1242]
        files = row["files"]
        expected_files = {f'{row["key"]}/{role}.webp' for role in ("background", "subject", "foreground")}
        assert len(files) == 3 and {f["path"] for f in files} == expected_files
        for file in files:
            local = args.assets / file["path"]
            assert local.stat().st_size == file["bytes"] and digest(local) == file["sha256"]
            assert local.read_bytes()[:4] == b"RIFF" and local.read_bytes()[8:12] == b"WEBP"
            all_files.append(file["path"])
        manifest.append({"key": row["key"], "source": row["source"],
                         "source_sha256": row["source_sha256"], "files": files,
                         "alpha_repaired": bool(row.get("alpha_correction")),
                         "model": row["model"].get("name") or (
                             "SAM-ViT-B-quant" if {"encoder", "decoder"} <= set(row["model"]) else None),
                         "raw_mask_sha256": row["raw_mask_sha256"]})
        assert manifest[-1]["model"], f'unknown model provenance: {row["key"]}'
    actual = {p.relative_to(args.assets).as_posix() for p in args.assets.rglob("*") if p.is_file()}
    assert actual == set(all_files), "unexpected or missing asset files"
    result = {"schema": "card-depth-release-manifest-v1", "base": "/card-depth/v1/",
              "card_count": 80, "file_count": 240, "size": [828, 1242],
              "total_bytes": sum(f["bytes"] for row in rows for f in row["files"]),
              "scope": "lazy desktop presentation; originals unchanged; no player-side model",
              "visual_review": "see CARD_DEPTH_V1_RELEASE.md; byte checks are not visual approval",
              "cards": manifest}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"result": "PASS", "cards": 80, "files": 240, "bytes": result["total_bytes"],
                      "out": str(args.out)}))


if __name__ == "__main__":
    main()
