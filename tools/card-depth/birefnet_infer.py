"""Local CPU BiRefNet-general-lite segmentation for read-only card originals.

Pre/post-processing follows rembg's BiRefNetSessionGeneral and BaseSession:
https://github.com/danielgatis/rembg/blob/main/rembg/sessions/birefnet_general.py
https://github.com/danielgatis/rembg/blob/main/rembg/sessions/base.py
BiRefNet: https://github.com/ZhengPeng7/BiRefNet (MIT).
This CLI does not download models, alter inputs, generate artwork, or publish.
Crop coordinates are normalized left, top, right, bottom in the original image.
All exported masks and foregrounds retain the original full-canvas dimensions.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import time

# Bound native thread pools before importing numerical libraries.
os.environ["OMP_NUM_THREADS"] = "4"
os.environ["OPENBLAS_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageOps


MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-bb_swin_v1_tiny-epoch_232.onnx"
MODEL_MD5 = "4fab47adc4ff364be1713e97b7e66334"
DEFAULT_MODEL = Path("D:/Codex_Tools/card-depth-birefnet-v1/models/birefnet-general-lite.onnx")


def digest(path: Path, algorithm: str = "sha256") -> str:
    hasher = hashlib.new(algorithm)
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def parse_crop(value):
    values = [float(part) for part in value.split(",")] if isinstance(value, str) else list(value)
    if len(values) != 4 or not all(np.isfinite(values)):
        raise ValueError("crop needs four finite normalized coordinates")
    left, top, right, bottom = values
    if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
        raise ValueError("crop must satisfy 0 <= left < right <= 1 and 0 <= top < bottom <= 1")
    return values


def normalize(cropped: Image.Image) -> np.ndarray:
    resized = cropped.convert("RGB").resize((1024, 1024), Image.Resampling.LANCZOS)
    pixels = np.array(resized)
    # rembg uses the maximum observed RGB value, not an unconditional 255.
    pixels = pixels / max(float(np.max(pixels)), 1e-6)
    pixels = (pixels - np.array([0.485, 0.456, 0.406])) / np.array([0.229, 0.224, 0.225])
    return np.expand_dims(pixels.transpose((2, 0, 1)), 0).astype(np.float32)


def postprocess(output: np.ndarray, size: tuple[int, int]) -> Image.Image:
    logits = output[:, 0, :, :]
    with np.errstate(over="ignore"):
        probabilities = 1.0 / (1.0 + np.exp(-logits))
    low, high = float(np.min(probabilities)), float(np.max(probabilities))
    if not np.isfinite(low) or not np.isfinite(high):
        raise ValueError("model returned nonfinite probabilities")
    # A constant output is degenerate: avoid NaNs and return a documented empty mask.
    normalized = (probabilities - low) / (high - low) if high > low else np.zeros_like(probabilities)
    mask = Image.fromarray((np.squeeze(normalized) * 255).astype(np.uint8))
    return mask.resize(size, Image.Resampling.LANCZOS)


def checkerboard(size: tuple[int, int], tile: int = 32) -> Image.Image:
    width, height = size
    yy, xx = np.indices((height, width))
    gray = np.where(((xx // tile) + (yy // tile)) % 2, 108, 174).astype(np.uint8)
    return Image.fromarray(np.repeat(gray[:, :, None], 3, axis=2)).convert("RGBA")


def self_test() -> int:
    """Exercise preprocessing contracts without loading a model or writing files."""
    checks = 0

    def check(condition, label):
        nonlocal checks
        if not condition:
            raise AssertionError(label)
        checks += 1

    check(parse_crop("0.1,0.2,0.8,0.9") == [0.1, 0.2, 0.8, 0.9], "crop CSV parses")
    check(parse_crop([0, 0, 1, 1]) == [0, 0, 1, 1], "full crop parses")
    for value in ["0,0,1", "0,0,1,1,1", "-0.1,0,1,1", "0,0,1.1,1", "0.5,0,0.5,1", "0,0.8,1,0.2", "0,0,nan,1", "0,0,inf,1"]:
        try:
            parse_crop(value)
        except ValueError:
            checks += 1
        else:
            raise AssertionError(f"invalid crop accepted: {value}")
    original = Image.new("RGB", (4, 6), (50, 100, 200))
    before = original.tobytes()
    tensor = normalize(original)
    check(tensor.shape == (1, 3, 1024, 1024), "model NCHW input shape")
    check(tensor.dtype == np.float32, "float32 model input")
    expected = (np.array([0.25, 0.5, 1.0]) - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    check(np.allclose(tensor[0, :, 500, 500], expected), "observed max normalization follows rembg")
    check(original.tobytes() == before, "normalization preserves source pixels")
    black = normalize(Image.new("RGB", (2, 3)))
    check(np.isfinite(black).all(), "black input is finite")
    mask = postprocess(np.array([[[[-4.0, 4.0], [0.0, 2.0]]]], dtype=np.float32), (2, 2))
    check(mask.mode == "L" and mask.size == (2, 2), "postprocess grayscale shape")
    check(mask.getpixel((0, 0)) == 0 and mask.getpixel((1, 0)) == 255, "sigmoid/min-max endpoints")
    resized = postprocess(np.array([[[[-4.0, 4.0], [0.0, 2.0]]]], dtype=np.float32), (8, 12))
    check(resized.size == (8, 12), "mask returns to crop dimensions")
    empty = postprocess(np.zeros((1, 1, 2, 2), dtype=np.float32), (3, 5))
    check(empty.getextrema() == (0, 0), "constant logits have safe empty fallback")
    try:
        postprocess(np.full((1, 1, 2, 2), np.nan, dtype=np.float32), (2, 2))
    except ValueError:
        checks += 1
    else:
        raise AssertionError("nonfinite output accepted")
    checker = checkerboard((64, 64), 32)
    check(checker.mode == "RGBA" and checker.size == (64, 64), "checker dimensions")
    check(checker.getpixel((0, 0)) != checker.getpixel((32, 0)), "checker alternates")
    foreground = original.convert("RGBA")
    foreground.putalpha(Image.new("L", original.size, 0))
    canvas = checkerboard(original.size)
    check(Image.alpha_composite(canvas, foreground).tobytes() == canvas.tobytes(), "transparent foreground reveals checker")
    check(original.tobytes() == before, "QA compositing preserves source pixels")
    print(f"BIREFNET_TOOL_SELF_TEST=PASS ({checks} checks; no model load; no file writes)")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--input", type=Path)
    mode.add_argument("--batch", type=Path, help="JSON list of {id,input,crop} records; paths relative to JSON file")
    mode.add_argument("--self-test", action="store_true", help="run preprocessing checks without loading any model")
    parser.add_argument("--id", default="segmentation")
    parser.add_argument("--crop", default="0,0,1,1")
    parser.add_argument("--output-dir", type=Path)
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    if args.output_dir is None:
        parser.error("--output-dir is required for inference")

    model = args.model.resolve(strict=True)
    if digest(model, "md5") != MODEL_MD5:
        raise ValueError("model MD5 differs from the official rembg general-lite model")
    if args.batch:
        batch_file = args.batch.resolve(strict=True)
        jobs = json.loads(batch_file.read_text(encoding="utf-8"))
        base = batch_file.parent
    else:
        jobs = [{"id": args.id, "input": str(args.input.resolve()), "crop": parse_crop(args.crop)}]
        base = Path.cwd()
    if not isinstance(jobs, list) or not jobs:
        raise ValueError("batch must be a nonempty list")

    output_dir = args.output_dir.resolve()
    prepared = []
    identifiers = set()
    for job in jobs:
        identifier = job["id"]
        if not isinstance(identifier, str) or not identifier or any(c not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_" for c in identifier):
            raise ValueError("id may contain only ASCII letters, digits, hyphens and underscores")
        if identifier in identifiers:
            raise ValueError("duplicate output id")
        identifiers.add(identifier)
        source = (base / job["input"]).resolve(strict=True)
        if output_dir == source.parent or source.is_relative_to(output_dir):
            raise ValueError("output directory must be separate from input originals")
        crop = parse_crop(job.get("crop", [0, 0, 1, 1]))
        planned = [output_dir / f"{identifier}-{suffix}.png" for suffix in ["crop", "mask", "foreground", "checker", "qa"]]
        if any(path.exists() for path in planned) or (output_dir / f"{identifier}-report.json").exists():
            raise FileExistsError(f"outputs already exist for {identifier}; choose a new id or output directory")
        prepared.append((identifier, source, crop, job))

    output_dir.mkdir(parents=True, exist_ok=True)
    cv2.setNumThreads(4)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    options.inter_op_num_threads = 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    options.log_severity_level = 3
    started = time.perf_counter()
    session = ort.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])
    session_seconds = time.perf_counter() - started
    model_info = {"path": str(model), "url": MODEL_URL, "md5": MODEL_MD5, "sha256": digest(model), "bytes": model.stat().st_size,
                  "input": [{"name": v.name, "shape": v.shape, "type": v.type} for v in session.get_inputs()],
                  "providers": session.get_providers(), "threads": 4, "inter_op_threads": 1,
                  "load_seconds": round(session_seconds, 4)}
    versions = {name: importlib.metadata.version(name) for name in ["onnxruntime", "Pillow", "numpy", "opencv-python-headless"]}
    results = []
    for identifier, source, crop, job in prepared:
        source_hash = digest(source)
        with Image.open(source) as opened:
            original = ImageOps.exif_transpose(opened).convert("RGB")
        width, height = original.size
        box = (round(crop[0] * width), round(crop[1] * height), round(crop[2] * width), round(crop[3] * height))
        cropped = original.crop(box)
        input_tensor = normalize(cropped)
        started = time.perf_counter()
        output = session.run(None, {session.get_inputs()[0].name: input_tensor})
        inference_seconds = time.perf_counter() - started
        cropped_mask = postprocess(output[0], cropped.size)
        mask = Image.new("L", original.size, 0)
        mask.paste(cropped_mask, box[:2])
        foreground = original.convert("RGBA")
        foreground.putalpha(mask)
        preview = Image.alpha_composite(checkerboard(original.size), foreground).convert("RGB")
        image_files = {"crop": cropped, "mask": mask, "foreground": foreground, "checker": preview}
        qa = Image.new("RGB", (900, 690), "#222222")
        draw = ImageDraw.Draw(qa)
        for index, (title, picture) in enumerate([(identifier + " / input", original), ("raw mask", mask.convert("RGB")), ("CPU model foreground", preview)]):
            thumb = picture.copy()
            thumb.thumbnail((292, 638), Image.Resampling.LANCZOS)
            qa.paste(thumb, (index * 300 + (300 - thumb.width) // 2, 30))
            draw.text((index * 300 + 8, 8), title, fill="white")
        draw.text((8, 664), f"crop={box}; inference={inference_seconds:.2f}s; no manual cleanup; NOT production-approved", fill="white")
        image_files["qa"] = qa
        files = {}
        for suffix, picture in image_files.items():
            destination = output_dir / f"{identifier}-{suffix}.png"
            picture.save(destination)
            files[suffix] = {"path": str(destination), "size": list(picture.size), "bytes": destination.stat().st_size, "sha256": digest(destination)}
        binary = (np.asarray(mask) > 127).astype(np.uint8)
        count, _, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
        if digest(source) != source_hash:
            raise RuntimeError("input original changed during inference")
        result = {"id": identifier, "source": str(source), "source_sha256": source_hash, "source_size": list(original.size),
                  "crop_normalized": crop, "crop_pixels": list(box), "inference_seconds": round(inference_seconds, 4),
                  "foreground_fraction": round(float(binary.mean()), 5),
                  "connected_components_over_64px": int(sum(stats[i, cv2.CC_STAT_AREA] > 64 for i in range(1, count))),
                  "notes": job.get("notes", "Raw segmentation, requires visual QA; not approved artwork."), "files": files}
        report = {"model": model_info, "packages": versions, **result}
        (output_dir / f"{identifier}-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        results.append(result)
        print(json.dumps({"id": identifier, "inference_seconds": result["inference_seconds"], "source_size": list(original.size), "crop": list(box), "qa": files["qa"]["path"]}), flush=True)
    summary_path = output_dir / f"batch-{time.time_ns()}-report.json"
    summary_path.write_text(json.dumps({"model": model_info, "packages": versions, "results": results}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(summary_path), "count": len(results), "session_load_seconds": model_info["load_seconds"]}), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
