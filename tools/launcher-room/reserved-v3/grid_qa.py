"""Find safe whole-figure cuts in a generated transparent sprite sheet.

The model can shift a row away from an arithmetic grid line. This tool finds a
fully transparent horizontal gutter and reports the safe cut without altering
the source PNG. A sheet with no clear gutter is rejected.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image


def zero_runs(values: np.ndarray) -> list[tuple[int, int]]:
    indexes = np.flatnonzero(values == 0)
    if not len(indexes):
        return []
    chunks = np.split(indexes, np.where(np.diff(indexes) > 1)[0] + 1)
    return [(int(group[0]), int(group[-1]) + 1) for group in chunks if len(group)]


def find_cuts(alpha: np.ndarray, count: int, axis: int, min_gap: int, alpha_threshold: int) -> list[int]:
    height, width = alpha.shape
    extent = height if axis == 0 else width
    occupancy = np.count_nonzero(alpha > alpha_threshold, axis=1 if axis == 0 else 0)
    runs = zero_runs(occupancy)
    cuts = [0]
    for index in range(1, count):
        expected = index * extent / count
        candidates = [(start, end) for start, end in runs
                      if end - start >= min_gap and abs((start + end) / 2 - expected) < extent / count * .35]
        if not candidates:
            raise ValueError(f"No transparent gutter near {'row' if axis == 0 else 'column'} cut {index}/{count}")
        # Prefer a wide gap; use proximity only as a tie-breaker.
        start, end = max(candidates, key=lambda run: (run[1] - run[0], -abs((run[0] + run[1]) / 2 - expected)))
        cuts.append((start + end) // 2)
    cuts.append(extent)
    if any(right <= left for left, right in zip(cuts, cuts[1:])):
        raise ValueError("Detected cuts are not increasing")
    return cuts


def inspect(path: Path, columns: int, rows: int, min_gap: int = 4, alpha_threshold: int = 24) -> dict:
    with Image.open(path) as source:
        if source.mode != "RGBA":
            raise ValueError("Source image must be RGBA")
        alpha = np.asarray(source.getchannel("A"))
        dimensions = list(source.size)
    if int(alpha.min()) != 0 or int(alpha.max()) < 252:
        raise ValueError("Source must contain true transparency and opaque figures")
    xcuts = find_cuts(alpha, columns, axis=1, min_gap=min_gap, alpha_threshold=alpha_threshold)
    ycuts = find_cuts(alpha, rows, axis=0, min_gap=min_gap, alpha_threshold=alpha_threshold)
    cells = []
    for row in range(rows):
        for col in range(columns):
            cell = alpha[ycuts[row]:ycuts[row + 1], xcuts[col]:xcuts[col + 1]]
            edge_counts = [int(np.count_nonzero(side > alpha_threshold)) for side in (cell[0, :], cell[-1, :], cell[:, 0], cell[:, -1])]
            if any(edge_counts):
                raise ValueError(f"Figure touches source cell border {row}:{col}: {edge_counts}")
            ys, xs = np.where(cell > 128)
            if len(xs) < 1500:
                raise ValueError(f"Missing whole figure in cell {row}:{col}")
            bounds = [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())]
            cells.append({"row": row, "col": col, "opaqueBoundsInCell": bounds, "opaquePixels": len(xs), "edgePixelsAboveAlpha24": edge_counts})
    return {"path": str(path), "dimensions": dimensions, "alphaExtrema": [int(alpha.min()), int(alpha.max())],
            "rowCuts": ycuts, "columnCuts": xcuts, "alphaThreshold": alpha_threshold,
            "cells": cells, "safeWholeFigureCuts": True}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--columns", type=int, required=True)
    parser.add_argument("--rows", type=int, required=True)
    parser.add_argument("--alpha-threshold", type=int, default=24, help="ignore distant near-zero alpha noise when finding gutters")
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    report = inspect(args.path, args.columns, args.rows, alpha_threshold=args.alpha_threshold)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        with args.report.open("x", encoding="utf-8") as stream:
            json.dump(report, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
    print(json.dumps({"dimensions": report["dimensions"], "rowCuts": report["rowCuts"],
                      "columnCuts": report["columnCuts"], "cellCount": len(report["cells"]), "safeWholeFigureCuts": True}, ensure_ascii=False))


if __name__ == "__main__":
    main()
