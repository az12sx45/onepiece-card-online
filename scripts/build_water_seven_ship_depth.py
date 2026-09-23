"""Derive numeric relief geometry from the unchanged ship artwork; no bitmap edits.

Requires the locally installed ONNX Runtime, Pillow, OpenCV and NumPy.
The downloaded model is a build tool, never a player runtime dependency.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model-dir', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    sources = sorted((root / 'public/images/board/water_seven').glob('ship_*_cutout.webp'))
    assert len(sources) == 36, f'Expected six views for six ships, got {len(sources)}'
    provenance = json.loads((args.model_dir / 'provenance.json').read_text())
    model = args.model_dir / 'model.onnx'
    assert hashlib.sha256(model.read_bytes()).hexdigest() == provenance['sha256']
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    session = ort.InferenceSession(str(model), sess_options=options, providers=['CPUExecutionProvider'])
    assets = {}
    for index, source in enumerate(sources):
        rgba = np.asarray(Image.open(source).convert('RGBA'))
        height, width = rgba.shape[:2]
        alpha = rgba[:, :, 3:4].astype(np.float32) / 255
        rgb = rgba[:, :, :3] * alpha + 155 * (1 - alpha)
        scale = 518 / min(width, height)
        input_width, input_height = [int(round(value * scale / 14) * 14) for value in (width, height)]
        rgb = cv2.resize(rgb, (input_width, input_height), interpolation=cv2.INTER_CUBIC) / 255
        pixels = ((rgb - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]).transpose(2, 0, 1)[None].astype(np.float32)
        predicted = session.run(None, {'pixel_values': pixels})[0][0]
        predicted = cv2.resize(predicted, (width, height), interpolation=cv2.INTER_CUBIC)
        foreground = rgba[:, :, 3] > 200
        low, high = np.percentile(predicted[foreground], [2, 98])
        depth = np.clip((predicted - low) / max(float(high - low), 1e-5), 0, 1)
        # Extend geometry across transparent pixels so rigging edges do not
        # inherit the neutral background's depth or produce artificial ridges.
        depth = cv2.inpaint((depth * 255).astype(np.uint8), (rgba[:, :, 3] < 20).astype(np.uint8) * 255, 3, cv2.INPAINT_TELEA)
        grid_width, grid_height = [max(16, int(round(value * 128 / max(width, height)))) for value in (width, height)]
        depth = cv2.resize(depth, (grid_width, grid_height), interpolation=cv2.INTER_AREA)
        depth = cv2.GaussianBlur(depth, (3, 3), 0.6)
        key = source.relative_to(root / 'public').as_posix()
        assets[key] = {'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                       'sourceSize': [width, height], 'grid': [grid_width, grid_height],
                       'depth': base64.b64encode(depth.tobytes()).decode('ascii')}
        print(json.dumps({'index': index + 1, 'total': len(sources), 'source': key}), flush=True)
    document = {'schema': 1, 'generator': 'water-seven-ship-relief-v1', 'model': provenance, 'assets': assets}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


if __name__ == '__main__':
    main()
