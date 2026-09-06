"""Local SAM ViT-B quant single-card point/box jobs; artwork stays read-only.

ORT interface/preprocessing adapted from rembg/sessions/sam.py (MIT).
Changes: OpenCV affine implementation; serial encoder/decoder lifetimes; bounded
CPU/RAM; prompt-aware candidate selection instead of union; source-bound embedding
caches; crop/rotation mapping; traceable artifacts. No automatic batch mode.
SAM model: Copyright (c) Meta Platforms, Inc. and affiliates, Apache-2.0.
See THIRD_PARTY_NOTICES.txt. No network requests or model downloads in this CLI.
"""
import os
os.environ["OMP_NUM_THREADS"] = "2"
os.environ["OPENBLAS_NUM_THREADS"] = "2"
os.environ["MKL_NUM_THREADS"] = "2"

import argparse
import ctypes
import gc
import hashlib
import io
import json
from pathlib import Path
import threading
import time
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw
from card_recipes import RECIPES

ROOT = Path(__file__).resolve().parents[2]
MODELS = Path("D:/Codex_Tools/card-depth-sam-v1/models")
URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/"
ASSETS = {"encoder": ("sam_vit_b_01ec64.encoder.quant.onnx", "26fc0e01d2fa34ed2d3f91259118482d"),
          "decoder": ("sam_vit_b_01ec64.decoder.quant.onnx", "45391530307d1aee79b2a1507769e6c7")}
POSITIVE = [[650, 570], [640, 930], [275, 710], [1030, 985]]
NEGATIVE = [[250, 260], [1100, 640]]
BOX = [185, 205, 1080, 1110]
INPUT_SIZE = (684, 1024)
CACHE_DIRECTORY = Path("D:/Codex_Tools/card-depth-sam-v1/embeddings")
PREPROCESS_VERSION = "rembg-sam-affine-684x1024-cv2-linear-v1"
DEFAULT_JOB = {"key": "enh/4", "source": "images/cards/enh/4.webp", "coordinate_space": "pixels",
               "positive": POSITIVE, "negative": NEGATIVE, "box": BOX, "rotation": 0}


def digest(path, algorithm="sha256"):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, algorithm).hexdigest()


def memory_snapshot():
    class ProcessMemory(ctypes.Structure):
        _fields_ = [("cb", ctypes.c_ulong), ("PageFaultCount", ctypes.c_ulong)] + [
            (name, ctypes.c_size_t) for name in ("PeakWorkingSetSize", "WorkingSetSize", "QuotaPeakPagedPoolUsage",
            "QuotaPagedPoolUsage", "QuotaPeakNonPagedPoolUsage", "QuotaNonPagedPoolUsage", "PagefileUsage",
            "PeakPagefileUsage", "PrivateUsage")]
    class SystemMemory(ctypes.Structure):
        _fields_ = [("dwLength", ctypes.c_ulong), ("dwMemoryLoad", ctypes.c_ulong)] + [
            (name, ctypes.c_ulonglong) for name in ("ullTotalPhys", "ullAvailPhys", "ullTotalPageFile",
            "ullAvailPageFile", "ullTotalVirtual", "ullAvailVirtual", "ullAvailExtendedVirtual")]
    kernel = ctypes.windll.kernel32
    kernel.GetCurrentProcess.restype = ctypes.c_void_p
    process = ProcessMemory(); process.cb = ctypes.sizeof(process)
    system = SystemMemory(); system.dwLength = ctypes.sizeof(system)
    ctypes.windll.psapi.GetProcessMemoryInfo(ctypes.c_void_p(kernel.GetCurrentProcess()), ctypes.byref(process), process.cb)
    kernel.GlobalMemoryStatusEx(ctypes.byref(system))
    return {"time": time.time(), "working_set": process.WorkingSetSize, "peak_working_set": process.PeakWorkingSetSize,
            "private_bytes": process.PrivateUsage, "available_physical": system.ullAvailPhys,
            "available_commit": system.ullAvailPageFile}


class Monitor:
    def __init__(self, path):
        self.path = path; self.samples = []; self.phase = "initializing"; self.stopping = threading.Event()
        self.thread = threading.Thread(target=self.run, daemon=True); self.thread.start()

    def record(self):
        row = memory_snapshot(); row["phase"] = self.phase; self.samples.append(row)

    def save(self, status):
        self.path.write_text(json.dumps({"status": status, "max_working_set_bytes": 4 * 1024**3,
                             "min_available_bytes": 2 * 1024**3, "samples": self.samples}, indent=2) + "\n", encoding="utf-8")

    def run(self):
        while not self.stopping.is_set():
            self.record(); row = self.samples[-1]
            if row["working_set"] > 4 * 1024**3 or min(row["available_physical"], row["available_commit"]) < 2 * 1024**3:
                self.save("stopped-memory-budget")
                print(json.dumps({"phase": "stopped-memory-budget", "sample": row}), flush=True)
                os._exit(75)
            self.stopping.wait(0.5)

    def stop(self, status):
        self.stopping.set(); self.thread.join(timeout=2); self.record(); self.save(status)


def prepare(image):
    rgb = np.asarray(image.convert("RGB"))
    scale = min(INPUT_SIZE[1] / rgb.shape[1], INPUT_SIZE[0] / rgb.shape[0])
    transform = np.array([[scale, 0, 0], [0, scale, 0], [0, 0, 1]], dtype=np.float64)
    resized = cv2.warpAffine(rgb, transform[:2], (INPUT_SIZE[1], INPUT_SIZE[0]), flags=cv2.INTER_LINEAR)
    return resized.astype(np.float32), transform


def prompt_arrays(positive, negative, box, transform):
    coords = np.array(positive + negative + [box[:2], box[2:]] + [[0, 0]], dtype=np.float32)
    labels = np.array([1] * len(positive) + [0] * len(negative) + [2, 3, -1], dtype=np.float32)
    # rembg apply_coords has identity scale for fixed 684x1024 -> longest side1024.
    homogeneous = np.concatenate([coords, np.ones((len(coords), 1), dtype=np.float32)], axis=1)
    return (homogeneous @ transform.T)[:, :2][None].astype(np.float32), labels[None]


def select_candidate(masks, scores, positive, negative, box):
    metrics = []
    for index, mask in enumerate(masks):
        area = int(mask.sum())
        positive_flags = [bool(mask[min(mask.shape[0]-1, round(y)), min(mask.shape[1]-1, round(x))]) for x, y in positive]
        negative_flags = [bool(mask[min(mask.shape[0]-1, round(y)), min(mask.shape[1]-1, round(x))]) for x, y in negative]
        pos_hits = sum(positive_flags)
        neg_hits = sum(negative_flags)
        pixel_box = [round(v) for v in box]
        inside = int(mask[pixel_box[1]:pixel_box[3] + 1, pixel_box[0]:pixel_box[2] + 1].sum())
        outside_fraction = (area - inside) / max(1, area)
        iou = float(scores[index])
        metrics.append({"index": index, "predicted_iou": iou, "positive_hits": pos_hits,
                        "negative_hits": neg_hits, "area_pixels": area, "outside_box_fraction": outside_fraction,
                        "positive_hit_flags": positive_flags, "negative_hit_flags": negative_flags,
                        "prompt_constraints_pass": pos_hits == len(positive) and neg_hits == 0,
                        "selection_score": 10 * pos_hits - 20 * neg_hits + iou - 2 * outside_fraction})
    selected = max(metrics, key=lambda row: (row["prompt_constraints_pass"], row["selection_score"]))["index"]
    return selected, metrics


def coordinate_units(value):
    aliases = {"pixels": "pixels", "original-pixels": "pixels",
               "normalized": "normalized", "original-normalized": "normalized"}
    if value not in aliases:
        raise ValueError("coordinate_space must explicitly be pixels or normalized (original image coordinates)")
    return aliases[value]


def pixels(values, units, size):
    array = np.asarray(values, dtype=float)
    if not np.isfinite(array).all():
        raise ValueError("Coordinates must be finite")
    if units == "normalized":
        if np.any(array < 0) or np.any(array > 1):
            raise ValueError("Normalized coordinates must lie in [0,1]")
        array = array * np.array(size * (array.shape[-1] // 2))
    return array


def rotate_points(points, cropped_size, rotation):
    array = np.asarray(points, dtype=float).reshape(-1, 2)
    width, height = cropped_size
    if rotation == 90:
        return np.column_stack([array[:, 1], width - 1 - array[:, 0]])
    if rotation == 180:
        return np.column_stack([width - 1 - array[:, 0], height - 1 - array[:, 1]])
    if rotation == 270:
        return np.column_stack([height - 1 - array[:, 1], array[:, 0]])
    return array.copy()


def geometry_for_job(job, size):
    units = coordinate_units(job.get("coordinate_space"))
    rotation = job.get("rotation", 0)
    if rotation not in (0, 90, 180, 270):
        raise ValueError("rotation must be 0,90,180,270 degrees counterclockwise")
    width, height = size
    point_sets = {}
    for name in ("positive", "negative"):
        raw = job.get(name, [])
        if not isinstance(raw, list) or any(not isinstance(row, list) or len(row) != 2 for row in raw):
            raise ValueError(f"{name} must be a list of [x,y] pairs")
        point_sets[name] = pixels(raw, units, size).reshape(-1, 2) if raw else np.empty((0, 2))
        if np.any(point_sets[name] < 0) or np.any(point_sets[name] >= np.array(size)):
            raise ValueError(f"{name} points must be inside the original image")
    if len(point_sets["positive"]) == 0:
        raise ValueError("At least one positive point is required")
    box = pixels(job.get("box", []), units, size)
    if box.shape != (4,) or not (0 <= box[0] < box[2] <= width and 0 <= box[1] < box[3] <= height):
        raise ValueError("box must be an original-image [left,top,right,bottom] rectangle")
    crop = job.get("crop")
    if crop is None:
        bounds = [0, 0, width, height]
    else:
        crop_units = coordinate_units(crop.get("coordinate_space")) if isinstance(crop, dict) else units
        raw = crop.get("box") if isinstance(crop, dict) else crop
        values = pixels(raw, crop_units, size)
        if values.shape != (4,):
            raise ValueError("crop must contain four coordinates")
        bounds = [round(v) for v in values]
        if not (0 <= bounds[0] < bounds[2] <= width and 0 <= bounds[1] < bounds[3] <= height):
            raise ValueError("Rounded crop must be nonempty and inside the image")
    cropped_size = (bounds[2] - bounds[0], bounds[3] - bounds[1])
    transformed = {}
    for name, points in point_sets.items():
        local = points - np.array(bounds[:2])
        if np.any(local < 0) or np.any(local >= np.array(cropped_size)):
            raise ValueError(f"All {name} points must be inside crop; none are silently discarded")
        transformed[name] = rotate_points(local, cropped_size, rotation).tolist()
    clipped_box = [max(box[0], bounds[0]), max(box[1], bounds[1]),
                   min(box[2], bounds[2]-1), min(box[3], bounds[3]-1)]
    if clipped_box[0] >= clipped_box[2] or clipped_box[1] >= clipped_box[3]:
        raise ValueError("box has no usable overlap with crop")
    left, top, right, bottom = clipped_box
    corners = np.array([[left, top], [right, top], [right, bottom], [left, bottom]]) - np.array(bounds[:2])
    corners = rotate_points(corners, cropped_size, rotation)
    transformed["box"] = [float(corners[:, 0].min()), float(corners[:, 1].min()),
                          float(corners[:, 0].max()), float(corners[:, 1].max())]
    return {"crop_pixels": bounds, "rotation": rotation, "cropped_size": list(cropped_size),
            "original_positive": point_sets["positive"].tolist(), "original_negative": point_sets["negative"].tolist(),
            "original_box": box.tolist(), "box_clipped_to_crop": list(box) != clipped_box, "transformed": transformed}


def restore_mask(logits, transform, geometry, original_size):
    width, height = geometry["cropped_size"]
    rotated_size = (height, width) if geometry["rotation"] in (90, 270) else (width, height)
    local = cv2.warpAffine(logits, np.linalg.inv(transform)[:2], rotated_size, flags=cv2.INTER_LINEAR) > 0
    unrotated = Image.fromarray(local.astype(np.uint8) * 255).rotate(-geometry["rotation"], expand=True)
    full = Image.new("L", original_size, 0)
    full.paste(unrotated, tuple(geometry["crop_pixels"][:2]))
    return np.asarray(full) > 0


def cache_identity(source_sha256, original_size, geometry, encoder_sha256):
    return {"schema": "sam-embedding-v1", "source_sha256": source_sha256, "original_size": list(original_size),
            "crop_pixels": geometry["crop_pixels"], "rotation": geometry["rotation"],
            "encoder_sha256": encoder_sha256, "preprocess_version": PREPROCESS_VERSION, "input_size_hw": list(INPUT_SIZE)}


def cache_key(identity):
    return hashlib.sha256(json.dumps(identity, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def embedding_sha256(embedding):
    return hashlib.sha256(np.ascontiguousarray(embedding).tobytes()).hexdigest()


def load_embedding(source, identity):
    with np.load(source, allow_pickle=False) as archive:
        metadata = json.loads(str(archive["metadata_json"].item()))
        if metadata["identity"] != identity:
            raise ValueError("Embedding cache identity mismatch; will not silently reuse or overwrite")
        embedding = archive["embedding"]
        if embedding.shape != (1, 256, 64, 64) or embedding.dtype != np.float32 or not np.isfinite(embedding).all():
            raise ValueError("Embedding cache must contain finite float32 [1,256,64,64]")
        if embedding_sha256(embedding) != metadata["embedding_sha256"]:
            raise ValueError("Embedding cache content checksum mismatch")
        return embedding.copy()


def save_embedding(destination, embedding, identity):
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.stem + f"-{time.time_ns()}.partial.npz")
    metadata = {"identity": identity, "embedding_sha256": embedding_sha256(embedding)}
    with temporary.open("xb") as stream:
        np.savez_compressed(stream, embedding=embedding, metadata_json=np.array(json.dumps(metadata, sort_keys=True)))
    # Windows rename fails if the destination already exists; do not overwrite caches.
    temporary.rename(destination)


def obtain_embedding(path, identity, decode_only, produce):
    if path.exists():
        return load_embedding(path, identity), "hit"
    if decode_only:
        raise FileNotFoundError(f"--decode-only requires an exact existing embedding cache: {path}; encoder will not run")
    embedding = produce()
    save_embedding(path, embedding, identity)
    return embedding, "created"


def session_options():
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2; options.inter_op_num_threads = 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.enable_cpu_mem_arena = False; options.enable_mem_pattern = False
    options.log_severity_level = 3
    return options


def self_test():
    checks = 0
    def check(condition):
        nonlocal checks
        if not condition:
            raise AssertionError(f"self-test check {checks + 1}")
        checks += 1
    def rejects(function):
        try:
            function()
        except (ValueError, FileNotFoundError):
            check(True)
        else:
            check(False)
    image = Image.new("RGB", (1242, 1863), "red")
    array, transform = prepare(image)
    check(array.shape == (684, 1024, 3) and array.dtype == np.float32)
    coords, labels = prompt_arrays(POSITIVE, NEGATIVE, BOX, transform)
    check(coords.shape == (1, 9, 2) and labels.tolist() == [[1, 1, 1, 1, 0, 0, 2, 3, -1]])
    check(np.allclose(coords[0, 0], np.array(POSITIVE[0]) * transform[0, 0]))
    check(image.getpixel((1, 1)) == (255, 0, 0))
    masks = np.zeros((3, 10, 10), dtype=bool)
    masks[0] = True; masks[1, 2:7, 2:7] = True; masks[2, 2:4, 2:4] = True
    chosen, metrics = select_candidate(masks, np.array([.99, .7, .9]), [[3, 3], [5, 5]], [[0, 0]], [1, 1, 8, 8])
    check(chosen == 1 and metrics[1]["prompt_constraints_pass"] and not metrics[0]["prompt_constraints_pass"])
    options = session_options()
    check(not options.enable_cpu_mem_arena and not options.enable_mem_pattern)
    check(options.intra_op_num_threads == 2 and options.inter_op_num_threads == 1)
    job = {"coordinate_space": "pixels", "positive": [[3, 4]], "negative": [[2, 2]],
           "box": [1, 1, 8, 6], "crop": [1, 1, 9, 7], "rotation": 0}
    geometry = geometry_for_job(job, (10, 8))
    check(geometry["crop_pixels"] == [1, 1, 9, 7] and geometry["transformed"]["positive"] == [[2, 3]])
    normalized = {"coordinate_space": "normalized", "positive": [[.3, .5]], "negative": [[.2, .25]],
                  "box": [.1, .125, .8, .75], "crop": [.1, .125, .9, .875], "rotation": 0}
    check(geometry_for_job(normalized, (10, 8)) == geometry)
    for rotation in (0, 90, 180, 270):
        rotated_geometry = geometry_for_job(dict(job, rotation=rotation), (10, 8))
        width, height = rotated_geometry["cropped_size"]
        new_size = (height, width) if rotation in (90, 270) else (width, height)
        projected = rotated_geometry["transformed"]["positive"][0]
        check(0 <= projected[0] < new_size[0] and 0 <= projected[1] < new_size[1])
        test_mask = np.full((new_size[1], new_size[0]), -1, dtype=np.float32)
        test_mask[round(projected[1]), round(projected[0])] = 1
        restored = restore_mask(test_mask, np.eye(3), rotated_geometry, (10, 8))
        check(restored[4, 3] and restored.sum() == 1)
    rejects(lambda: geometry_for_job(dict(job, coordinate_space=None), (10, 8)))
    rejects(lambda: geometry_for_job(dict(job, rotation=45), (10, 8)))
    rejects(lambda: geometry_for_job(dict(job, positive=[[0, 0]]), (10, 8)))
    rejects(lambda: geometry_for_job(dict(job, crop=[2, 2, 2, 4]), (10, 8)))
    rejects(lambda: geometry_for_job(dict(job, positive=[[float("nan"), 3]]), (10, 8)))
    identity = cache_identity("a" * 64, (10, 8), geometry, "b" * 64)
    same_geometry = geometry_for_job(dict(job, positive=[[4, 4]], negative=[]), (10, 8))
    check(cache_key(identity) == cache_key(cache_identity("a" * 64, (10, 8), same_geometry, "b" * 64)))
    for field, value in (("source_sha256", "c" * 64), ("encoder_sha256", "d" * 64),
                         ("rotation", 90), ("crop_pixels", [0, 0, 10, 8])):
        check(cache_key(identity) != cache_key(dict(identity, **{field: value})))
    embedding = np.zeros((1, 256, 64, 64), dtype=np.float32)
    metadata = {"identity": identity, "embedding_sha256": embedding_sha256(embedding)}
    archive = io.BytesIO()
    np.savez_compressed(archive, embedding=embedding, metadata_json=np.array(json.dumps(metadata)))
    archive.seek(0)
    check(np.array_equal(load_embedding(archive, identity), embedding))
    archive.seek(0)
    rejects(lambda: load_embedding(archive, dict(identity, rotation=90)))
    class Missing:
        def exists(self): return False
        def __str__(self): return "deliberately-absent-test-cache"
    calls = []
    rejects(lambda: obtain_embedding(Missing(), identity, True, lambda: calls.append("encoder")))
    check(calls == [])
    print(f"SAM_REFINE_SELF_TEST=PASS ({checks} checks; no model load; no file writes)")


def run_session(phase, feed, model, monitor, timing):
    monitor.phase = phase + "-load"
    start = time.perf_counter()
    print(json.dumps({"phase": monitor.phase, "threads": 2, "cpu_arena": False}), flush=True)
    session = ort.InferenceSession(model[phase]["path"], sess_options=session_options(), providers=["CPUExecutionProvider"])
    timing[phase + "_load_seconds"] = round(time.perf_counter() - start, 4)
    try:
        model[phase]["inputs"] = [{"name": item.name, "shape": item.shape, "type": item.type} for item in session.get_inputs()]
        model[phase]["outputs"] = [{"name": item.name, "shape": item.shape, "type": item.type} for item in session.get_outputs()]
        monitor.phase = phase + "-infer"
        start = time.perf_counter()
        actual_feed = {session.get_inputs()[0].name: feed} if phase == "encoder" else feed
        outputs = session.run(None, actual_feed)
        timing[phase + "_inference_seconds"] = round(time.perf_counter() - start, 4)
        monitor.record()
    finally:
        del session
        gc.collect()
    print(json.dumps({"phase": phase + "-released", "timing": timing, "memory": memory_snapshot()}), flush=True)
    return outputs


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public", type=Path, default=ROOT / "public")
    parser.add_argument("--out", type=Path, help="Required with --job; must be empty/new; never overwritten")
    parser.add_argument("--job", type=Path, help="One original-coordinate prompt job JSON; no batch mode")
    parser.add_argument("--cache-dir", type=Path, default=CACHE_DIRECTORY)
    parser.add_argument("--decode-only", action="store_true", help="Require exact embedding cache; never run encoder on a miss")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test(); return
    if args.job and args.out is None:
        raise ValueError("--job requires an explicit independent --out")
    output_dir = args.out or ROOT / "artifacts/card-depth-v1/sam-pilot"
    public_root = args.public.resolve(strict=True)
    if output_dir.resolve().is_relative_to(public_root) or args.cache_dir.resolve().is_relative_to(public_root):
        raise ValueError("Artifacts and embedding caches must not be saved inside public")
    if output_dir.exists() and any(output_dir.iterdir()):
        raise FileExistsError("Output directory is not empty; choose an independent new --out")
    job = json.loads(args.job.read_text(encoding="utf-8-sig")) if args.job else json.loads(json.dumps(DEFAULT_JOB))
    if not isinstance(job, dict):
        raise ValueError("--job is exactly one object, not a batch")
    key = job.get("key")
    recipes = {f'{row["variant"]}/{row["id"]}': row for row in RECIPES}
    if key not in recipes:
        raise ValueError("Job key must identify one of the 80 existing cards")
    recipe = json.loads(json.dumps(recipes[key]))
    supplied_source = job.get("source", "").replace("\\", "/")
    if supplied_source.startswith("public/"):
        supplied_source = supplied_source[len("public/"):]
    if supplied_source != recipe["source"]:
        raise ValueError("Job source must exactly match the current recipe source for this key")
    source = public_root / recipe["source"]
    source_hash = digest(source)
    with Image.open(source) as opened:
        original = opened.convert("RGB")
    if not args.job and original.size != (1242, 1863):
        raise ValueError("Default pixel pilot requires the observed 1242x1863 source")
    geometry = geometry_for_job(job, original.size)
    model = {}
    for kind, (filename, expected) in ASSETS.items():
        path = MODELS / filename
        actual = digest(path, "md5")
        if actual != expected:
            raise ValueError(f"Official MD5 mismatch: {filename}")
        model[kind] = {"url": URL + filename, "path": str(path), "md5": actual,
                       "sha256": digest(path), "bytes": path.stat().st_size}
    identity = cache_identity(source_hash, original.size, geometry, model["encoder"]["sha256"])
    embedding_path = args.cache_dir / (cache_key(identity) + ".npz")
    if args.decode_only and not embedding_path.exists():
        raise FileNotFoundError(f"--decode-only requires {embedding_path}; no encoder will be loaded")
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = key.replace("/", "-")
    code_hash = digest(Path(__file__))
    recipe_file_hash = digest(Path(__file__).with_name("card_recipes.py"))
    request = {"key": key, "job": job, "source_sha256": source_hash, "original_size": list(original.size),
               "recipe_reference": recipe, "recipe_file_sha256": recipe_file_hash, "geometry": geometry,
               "embedding_identity": identity, "embedding_path": str(embedding_path), "decode_only": args.decode_only,
               "model": model, "tool_sha256": code_hash}
    (output_dir / f"{stem}-request.json").write_text(json.dumps(request, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    cv2.setNumThreads(1)
    kernel = ctypes.windll.kernel32; kernel.GetCurrentProcess.restype = ctypes.c_void_p
    kernel.SetPriorityClass(ctypes.c_void_p(kernel.GetCurrentProcess()), 0x00004000)
    memory_path = output_dir / f"{stem}-memory.json"
    monitor = Monitor(memory_path)
    status = "failed"; timing = {}; start_all = time.perf_counter()
    try:
        prepared = original.crop(geometry["crop_pixels"]).rotate(geometry["rotation"], expand=True)
        encoder_input, transform = prepare(prepared)
        start = time.perf_counter()
        embedding, cache_status = obtain_embedding(
            embedding_path, identity, args.decode_only,
            lambda: run_session("encoder", encoder_input, model, monitor, timing)[0])
        timing["embedding_acquire_seconds"] = round(time.perf_counter() - start, 4)
        if cache_status == "hit":
            model["encoder"]["inference_skipped_cache_hit"] = True
            timing["encoder_load_seconds"] = 0.0; timing["encoder_inference_seconds"] = 0.0
        print(json.dumps({"phase": "embedding-ready", "cache_status": cache_status, "path": str(embedding_path)}), flush=True)
        prompts = geometry["transformed"]
        coords, labels = prompt_arrays(prompts["positive"], prompts["negative"], prompts["box"], transform)
        feed = {"image_embeddings": embedding, "point_coords": coords, "point_labels": labels,
                "mask_input": np.zeros((1, 1, 256, 256), dtype=np.float32),
                "has_mask_input": np.zeros(1, dtype=np.float32), "orig_im_size": np.array(INPUT_SIZE, dtype=np.float32)}
        outputs = run_session("decoder", feed, model, monitor, timing)
        monitor.phase = "export"
        masks = np.stack([restore_mask(logits, transform, geometry, original.size) for logits in outputs[0][0]])
        scores = np.asarray(outputs[1]).reshape(-1)
        selected, metrics = select_candidate(masks, scores, geometry["original_positive"],
                                             geometry["original_negative"], geometry["original_box"])
        for index, mask in enumerate(masks):
            Image.fromarray(mask.astype(np.uint8) * 255).save(output_dir / f"{stem}-candidate-{index}.png")
        alpha = Image.fromarray(masks[selected].astype(np.uint8) * 255)
        alpha.save(output_dir / f"{stem}-mask.png")
        preview_size = (414, round(original.height * 414 / original.width))
        small = original.resize(preview_size, Image.Resampling.LANCZOS).convert("RGBA")
        small.putalpha(alpha.resize(small.size, Image.Resampling.LANCZOS))
        Image.alpha_composite(Image.new("RGBA", small.size, (110, 110, 110, 255)), small).convert("RGB").save(output_dir / f"{stem}-cutout.jpg", quality=95)
        prompt_preview = original.resize(preview_size, Image.Resampling.LANCZOS)
        pen = ImageDraw.Draw(prompt_preview)
        scale = preview_size[0] / original.width
        pen.rectangle(tuple(round(v * scale) for v in geometry["original_box"]), outline="#00ffff", width=2)
        pen.rectangle(tuple(round(v * scale) for v in geometry["crop_pixels"]), outline="#ffff00", width=1)
        for points, color in ((geometry["original_positive"], "#00ff00"), (geometry["original_negative"], "#ff2222")):
            for x, y in points:
                pen.ellipse((x * scale - 4, y * scale - 4, x * scale + 4, y * scale + 4), fill=color)
        prompt_preview.save(output_dir / f"{stem}-prompts.jpg", quality=95)
        if digest(source) != source_hash:
            raise RuntimeError("Source changed during job")
        timing["total_seconds"] = round(time.perf_counter() - start_all, 4)
        monitor.record()
        report = {"schema": "card-depth-sam-job-v2", "key": key, "source": recipe["source"],
                  "source_sha256": source_hash, "source_unchanged": True, "size": list(original.size),
                  "job": job, "geometry": geometry, "crop_pixels": geometry["crop_pixels"], "rotation": geometry["rotation"],
                  "recipe": recipe, "recipe_reference_source": "tools/card-depth/card_recipes.py",
                  "recipe_reference_sha256": recipe_file_hash,
                  "recipe_note": "Layout reference for builder/source verification; actual SAM preprocessing and prompts are recorded separately in job/geometry",
                  "preprocessing": {"input_size_hw": list(INPUT_SIZE), "transform": transform.tolist(),
                                    "format": "RGB float32 HWC", "affine": "OpenCV INTER_LINEAR", "version": PREPROCESS_VERSION},
                  "embedding_cache": {"status": cache_status, "identity": identity, "key": cache_key(identity),
                                      "path": str(embedding_path), "sha256": digest(embedding_path), "decode_only": args.decode_only},
                  "model": model, "license": "Apache-2.0", "license_source": "https://github.com/facebookresearch/segment-anything/blob/main/LICENSE",
                  "api_source": "https://github.com/danielgatis/rembg/blob/main/rembg/sessions/sam.py",
                  "runtime": {"onnxruntime": ort.__version__, "provider": "CPUExecutionProvider", "intra_op_threads": 2, "inter_op_threads": 1,
                              "cpu_memory_arena": False, "memory_pattern": False, "opencv_threads": 1, "serial_session_lifetimes": True},
                  "timing": timing, "selected_candidate": selected, "candidate_count": len(metrics), "candidate_metrics": metrics,
                  "selection": "prompt constraints first, then prompt-hit and predicted-IoU score minus outside-box penalty; no candidate union",
                  "memory": {"path": str(memory_path), "peak_working_set_bytes": max(row["peak_working_set"] for row in monitor.samples),
                             "max_private_bytes": max(row["private_bytes"] for row in monitor.samples)},
                  "tool_sha256": code_hash, "mask_sha256": digest(output_dir / f"{stem}-mask.png"),
                  "visual_review": "pending", "approved_for_layers": False}
        (output_dir / f"{stem}-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        status = "completed"
        print(json.dumps({"phase": status, "key": key, "selected_candidate": selected, "metrics": metrics,
                          "timing": timing, "memory": report["memory"]}), flush=True)
    finally:
        monitor.stop(status)


if __name__ == "__main__":
    main()
