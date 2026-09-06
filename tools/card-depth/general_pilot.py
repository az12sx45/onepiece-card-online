"""Run the approved BiRefNet-general pilot without changing shared pipelines.

Uses build_card_layers.infer and a snapshot of current card_recipes.RECIPES.
The model and venv remain outside Git. Only authoring artifacts are written.
"""
import os
os.environ["OMP_NUM_THREADS"] = "4"
os.environ["OPENBLAS_NUM_THREADS"] = "4"
os.environ["MKL_NUM_THREADS"] = "4"

import argparse
import ctypes
import json
from pathlib import Path
import time
import threading
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw
from birefnet_infer import digest, checkerboard
from build_card_layers import infer, window_mask
from card_recipes import RECIPES

ROOT = Path(__file__).resolve().parents[2]
MODEL = Path("D:/Codex_Tools/card-depth-birefnet-v1/models/birefnet-general.onnx")
MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx"
MODEL_MD5 = "7a35a0141cbbc80de11d9c9a28f52697"
APPROVED = ("enh/2", "enh/4", "enh/8", "enh/15")
ACTIVE_MONITOR = None


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


class MemoryMonitor:
    def __init__(self, destination):
        self.destination = destination
        self.samples = []
        self.phase = "initializing"
        self.stopping = threading.Event()
        self.thread = threading.Thread(target=self.run, daemon=True)
        self.thread.start()

    def record(self):
        sample = memory_snapshot(); sample["phase"] = self.phase
        self.samples.append(sample)
        return sample

    def save(self, status):
        report = {"status": status, "max_process_working_set_bytes": 8 * 1024**3,
                  "min_system_available_bytes": 2 * 1024**3, "samples": self.samples}
        self.destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    def run(self):
        while not self.stopping.is_set():
            sample = self.record()
            if sample["working_set"] > 8 * 1024**3 or min(sample["available_physical"], sample["available_commit"]) < 2 * 1024**3:
                self.save("stopped-memory-budget")
                print(json.dumps({"phase": "stopped-memory-budget", "memory": sample}), flush=True)
                os._exit(75)
            self.stopping.wait(1)

    def stop(self):
        self.stopping.set(); self.thread.join(timeout=2)
        self.record(); self.save("ended")


def cutout(original, mask):
    output = original.convert("RGBA")
    output.putalpha(mask)
    return output


def preview(original, mask):
    return Image.alpha_composite(checkerboard(original.size), cutout(original, mask)).convert("RGB")


def recover_existing(args, recipes):
    """Review a saved mask without opening an ONNX session; preserve failed files."""
    if args.memory_report is None:
        raise ValueError("--review-existing requires --memory-report")
    telemetry = json.loads(args.memory_report.read_text(encoding="utf-8"))
    if telemetry["status"] != "stopped-memory-budget":
        raise ValueError("Recovery expects an explicitly interrupted memory-budget run")
    samples = telemetry["samples"]
    model = {"name": "birefnet-general", "url": MODEL_URL, "path": str(MODEL),
             "md5": digest(MODEL, "md5"), "sha256": digest(MODEL), "bytes": MODEL.stat().st_size,
             "providers": ["CPUExecutionProvider"], "intra_op_threads": 4, "inter_op_threads": 1,
             "license": "MIT", "load_seconds": args.recorded_load_seconds,
             "load_seconds_evidence": "original pilot stdout, supplied for recovery",
             "checksum_source": "https://github.com/danielgatis/rembg/blob/main/rembg/sessions/birefnet_general.py",
             "model_license_source": "https://huggingface.co/ZhengPeng7/BiRefNet/raw/main/README.md"}
    if model["md5"] != MODEL_MD5:
        raise ValueError("General model differs from the official rembg MD5")
    memory = {"status": telemetry["status"], "report": str(args.memory_report.resolve()),
              "report_sha256": digest(args.memory_report),
              "peak_working_set_bytes": max(s["peak_working_set"] for s in samples),
              "max_private_bytes": max(s["private_bytes"] for s in samples),
              "min_available_physical_bytes": min(s["available_physical"] for s in samples),
              "min_available_commit_bytes": min(s["available_commit"] for s in samples)}
    for recipe in recipes:
        key = f'{recipe["variant"]}/{recipe["id"]}'
        stem = key.replace("/", "-")
        source = args.public / recipe["source"]
        source_hash = digest(source)
        prior = json.loads((args.baseline / f"{stem}-report.json").read_text(encoding="utf-8"))
        defaults = {"rotation": 0, "inference_clean": False, "protect": []}
        recipe_matches_baseline = all(prior["recipe"].get(k, defaults.get(k)) == recipe.get(k, defaults.get(k))
                                      for k in ("crop", "rotation", "inference_clean", "badge", "protect"))
        if source_hash != prior["source_sha256"] or not recipe_matches_baseline:
            raise ValueError("Recovery requires the same source and recipe as the saved baseline")
        outputs = (f"{stem}-recovered-window-cutout.png", f"{stem}-comparison.jpg", f"{stem}-report.json")
        if any((args.out / name).exists() for name in outputs):
            raise FileExistsError("Recovery outputs already exist; refusing overwrite")
        with Image.open(source) as opened:
            original = opened.convert("RGB")
        with Image.open(args.out / f"{stem}-mask.png") as opened:
            mask = opened.convert("L")
        if mask.size != original.size:
            raise ValueError("Saved mask does not match original canvas")
        windowed = Image.fromarray(np.minimum(np.array(mask), np.array(window_mask(original.size, recipe))))
        cutout(original, windowed).save(args.out / outputs[0])
        small_size = (306, 459)
        small = original.resize(small_size, Image.Resampling.LANCZOS)
        with Image.open(args.baseline / f"{stem}-mask.png") as opened:
            lite = opened.convert("L").resize(small_size, Image.Resampling.LANCZOS)
        pictures = [("source", small), ("lite raw baseline", preview(small, lite)),
                    ("general raw", preview(small, mask.resize(small_size, Image.Resampling.LANCZOS))),
                    ("general protected", preview(small, windowed.resize(small_size, Image.Resampling.LANCZOS)))]
        board = Image.new("RGB", (1248, 510), "#172130")
        pen = ImageDraw.Draw(board)
        for index, (label, picture) in enumerate(pictures):
            board.paste(picture, (index * 312 + 3, 25))
            pen.text((index * 312 + 3, 7), f"{key} {label}", fill="white")
        pen.text((5, 490), "Saved mask review only: no model load; original run stopped at RAM budget; visual QA required", fill="white")
        board.save(args.out / outputs[1], quality=94)
        failed = args.out / f"{stem}-window-cutout.png"
        try:
            with Image.open(failed) as opened:
                opened.load()
            failed_status = "valid"
        except OSError as error:
            failed_status = str(error)
        if digest(source) != source_hash:
            raise RuntimeError("Source changed during recovery")
        names = (f"{stem}-mask.png", f"{stem}-actualcutout.png", outputs[0], outputs[1])
        row = {"schema": "card-depth-general-pilot-v1", "status": "interrupted-after-inference-recovered-report",
               "key": key, "source": recipe["source"], "source_sha256": source_hash,
               "source_unchanged": True, "source_unchanged_evidence": "matches prior lite report and recovery before/after hashes",
               "size": list(original.size), "recipe": recipe,
               "recipe_evidence": "current recipe matched original pilot console crop/rotation and saved lite recipe; defaults explicit",
               "crop_pixels": [round(v * (original.width if i % 2 == 0 else original.height)) for i, v in enumerate(recipe["crop"])],
               "rotation": recipe.get("rotation", 0), "model": model, "inference_seconds": None,
               "timing_note": "Exact inference duration was not flushed before watchdog stop; consult phase samples for an estimate",
               "memory": memory, "baseline": {"same_inference_recipe": True, "source_sha256": prior["source_sha256"],
               "mask_sha256": digest(args.baseline / f"{stem}-mask.png")},
               "files": {name: {"sha256": digest(args.out / name), "bytes": (args.out / name).stat().st_size} for name in names},
               "excluded_failed_artifact": {"path": str(failed), "status": failed_status, "preserved": True},
               "recovery_code_sha256": {name: digest(Path(__file__).parent / name) for name in
                                          ("general_pilot.py", "build_card_layers.py", "card_recipes.py", "birefnet_infer.py")},
               "visual_review": "pending", "recovery_loaded_model": False}
        (args.out / outputs[2]).write_text(json.dumps(row, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print(json.dumps({"phase": "recovered-without-model", "key": key, "report": str(args.out / outputs[2]),
                          "excluded_failed_artifact": failed_status}), flush=True)


def main():
    global ACTIVE_MONITOR
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public", type=Path, default=ROOT / "public")
    parser.add_argument("--out", type=Path, default=ROOT / "artifacts/card-depth-v1/general-pilot")
    parser.add_argument("--baseline", type=Path, default=ROOT / "artifacts/card-depth-v1/layers")
    parser.add_argument("--only", default="enh/4", help="Single-card default; multiple cards require a deliberate comma-separated selection")
    parser.add_argument("--review-existing", action="store_true", help="Recover QA/provenance from saved masks; never opens an ONNX session")
    parser.add_argument("--memory-report", type=Path)
    parser.add_argument("--recorded-load-seconds", type=float)
    args = parser.parse_args()
    selected = args.only.split(",")
    if len(set(selected)) != len(selected) or any(key not in APPROVED for key in selected):
        raise ValueError("This pilot is limited to the four explicitly approved cards")
    recipes = [json.loads(json.dumps(r)) for r in RECIPES if f'{r["variant"]}/{r["id"]}' in selected]
    destination = args.out.resolve()
    source_root = args.public.resolve(strict=True)
    if destination.is_relative_to(source_root):
        raise ValueError("Pilot artifacts must not be written under public")
    if args.review_existing:
        recover_existing(args, recipes)
        return
    for recipe in recipes:
        stem = f'{recipe["variant"]}-{recipe["id"]}'
        if any(destination.glob(stem + "-*")):
            raise FileExistsError(f"Pilot artifacts already exist: {stem}; use a new output directory")
    if digest(MODEL, "md5") != MODEL_MD5:
        raise ValueError("General model differs from the official rembg MD5")
    destination.mkdir(parents=True, exist_ok=True)
    run_stem = "-".join(key.replace("/", "-") for key in selected)
    monitor = MemoryMonitor(destination / f"memory-{run_stem}-{time.time_ns()}.json")
    ACTIVE_MONITOR = monitor
    priority = "default"
    if os.name == "nt":
        kernel = ctypes.windll.kernel32
        kernel.GetCurrentProcess.restype = ctypes.c_void_p
        if kernel.SetPriorityClass(ctypes.c_void_p(kernel.GetCurrentProcess()), 0x00004000):
            priority = "BELOW_NORMAL_PRIORITY_CLASS"
    cv2.setNumThreads(2)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    options.inter_op_num_threads = 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.log_severity_level = 3
    start = time.perf_counter()
    monitor.phase = "model-load"
    print(json.dumps({"phase": "load", "model": str(MODEL), "threads": 4, "priority": priority}), flush=True)
    session = ort.InferenceSession(str(MODEL), sess_options=options, providers=["CPUExecutionProvider"])
    model = {"name": "birefnet-general", "url": MODEL_URL, "path": str(MODEL), "md5": MODEL_MD5,
             "sha256": digest(MODEL), "bytes": MODEL.stat().st_size, "providers": session.get_providers(),
             "load_seconds": round(time.perf_counter() - start, 4), "intra_op_threads": 4, "inter_op_threads": 1,
             "opencv_threads": 2, "priority": priority, "license": "MIT",
             "model_license_source": "https://huggingface.co/ZhengPeng7/BiRefNet/raw/main/README.md",
             "checksum_source": "https://github.com/danielgatis/rembg/blob/main/rembg/sessions/birefnet_general.py"}
    code = {name: digest(Path(__file__).parent / name) for name in ("general_pilot.py", "build_card_layers.py", "card_recipes.py", "birefnet_infer.py")}
    results = []
    print(json.dumps({"phase": "loaded", "seconds": model["load_seconds"]}), flush=True)
    for recipe in recipes:
        key = f'{recipe["variant"]}/{recipe["id"]}'
        stem = key.replace("/", "-")
        source = source_root / recipe["source"]
        source_hash = digest(source)
        with Image.open(source) as opened:
            original = opened.convert("RGB")
        start = time.perf_counter()
        monitor.phase = f"infer-{key}"
        print(json.dumps({"phase": "infer", "key": key, "crop": recipe["crop"], "rotation": recipe.get("rotation", 0)}), flush=True)
        mask = infer(original, recipe, session)
        inference_seconds = round(time.perf_counter() - start, 4)
        memory_after_inference = monitor.record()
        monitor.phase = f"export-{key}"
        mask.save(destination / f"{stem}-mask.png")
        cutout(original, mask).save(destination / f"{stem}-actualcutout.png")
        windowed = Image.fromarray(np.minimum(np.array(mask), np.array(window_mask(original.size, recipe))))
        cutout(original, windowed).save(destination / f"{stem}-window-cutout.png")
        baseline_mask = args.baseline / f"{stem}-mask.png"
        baseline_report = args.baseline / f"{stem}-report.json"
        baseline = {"available": baseline_mask.exists() and baseline_report.exists(), "same_inference_recipe": None}
        if baseline["available"]:
            prior = json.loads(baseline_report.read_text(encoding="utf-8"))
            baseline["source_sha256"] = prior["source_sha256"]
            baseline["mask_sha256"] = digest(baseline_mask)
            baseline["same_inference_recipe"] = prior["source_sha256"] == source_hash and all(
                prior["recipe"].get(k, 0 if k == "rotation" else False) == recipe.get(k, 0 if k == "rotation" else False)
                for k in ("crop", "rotation", "inference_clean", "badge", "protect"))
            with Image.open(baseline_mask) as prior_mask:
                lite_view = preview(original, prior_mask.convert("L"))
        else:
            lite_view = Image.new("RGB", original.size, "#222222")
        board = Image.new("RGB", (1248, 510), "#172130")
        pen = ImageDraw.Draw(board)
        for index, (label, picture) in enumerate([("source", original), ("lite raw baseline", lite_view),
                                                  ("general raw", preview(original, mask)), ("general protected window", preview(original, windowed))]):
            board.paste(picture.resize((306, 459), Image.Resampling.LANCZOS), (index * 312 + 3, 25))
            pen.text((index * 312 + 3, 7), f"{key} {label}", fill="white")
        pen.text((5, 490), f"general infer {inference_seconds:.2f}s; same recipe baseline={baseline['same_inference_recipe']}; visual QA required", fill="white")
        board.save(destination / f"{stem}-comparison.jpg", quality=94)
        if digest(source) != source_hash:
            raise RuntimeError("Source changed during inference")
        files = {name: {"sha256": digest(destination / f"{stem}-{name}"), "bytes": (destination / f"{stem}-{name}").stat().st_size}
                 for name in ("mask.png", "actualcutout.png", "window-cutout.png", "comparison.jpg")}
        row = {"schema": "card-depth-general-pilot-v1", "key": key, "source": recipe["source"],
               "source_sha256": source_hash, "source_unchanged": True, "size": list(original.size), "recipe": recipe,
               "crop_pixels": [round(v * (original.width if i % 2 == 0 else original.height)) for i, v in enumerate(recipe["crop"])],
               "rotation": recipe.get("rotation", 0), "model": model, "code_sha256": code, "baseline": baseline,
               "inference_seconds": inference_seconds, "memory_after_inference": memory_after_inference,
               "memory_report": str(monitor.destination), "files": files, "visual_review": "pending"}
        (destination / f"{stem}-report.json").write_text(json.dumps(row, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        results.append(row)
        print(json.dumps({"phase": "completed", "key": key, "seconds": inference_seconds, "report": str(destination / f"{stem}-report.json")}), flush=True)
    (destination / f"pilot-{run_stem}-report.json").write_text(json.dumps({"count": len(results), "cards": results, "model": model}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"phase": "finished", "count": len(results)}), flush=True)


if __name__ == "__main__":
    try:
        main()
    finally:
        if ACTIVE_MONITOR is not None:
            ACTIVE_MONITOR.stop()
