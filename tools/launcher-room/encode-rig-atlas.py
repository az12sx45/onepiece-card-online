"""Encode baked GPT-part pixels; remove only alpha <= 2 dust and hidden RGB."""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops


def encode(source, destination, cell_size=256):
    image = Image.open(source).convert('RGBA')
    if image.size not in ((2048, 1024), (2048, 5120)):
        raise ValueError('Expected one 32-cell cycle, or five 32-cell depth projections')
    alpha = image.getchannel('A')
    if alpha.getextrema() != (0, 255):
        raise ValueError('Atlas must have real transparent background and opaque art')
    source_pixels = list(image.size)
    if cell_size != 256:
        image = image.resize((image.width * cell_size // 256, image.height * cell_size // 256), Image.Resampling.LANCZOS)
        alpha = image.getchannel('A')
    clear = alpha.point(lambda value: 255 if value <= 2 else 0)
    image.paste((0, 0, 0, 0), mask=clear)
    frame_bounds = []
    for index in range(image.height // cell_size * 8):
        cell = image.crop((index % 8 * cell_size, index // 8 * cell_size, index % 8 * cell_size + cell_size, index // 8 * cell_size + cell_size))
        bounds = cell.getchannel('A').point(lambda value: 255 if value > 32 else 0).getbbox()
        if not bounds or bounds[0] == 0 or bounds[1] == 0 or bounds[2] == cell_size or bounds[3] == cell_size:
            raise ValueError(f'Empty or clipped actor in frame {index}: {bounds}')
        frame_bounds.append([bounds[0], bounds[1], bounds[2]-1, bounds[3]-1])
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, 'WEBP', lossless=True, method=6, exact=True)
    decoded = Image.open(destination).convert('RGBA')
    if decoded.size != image.size or any(channel.getbbox() for channel in ImageChops.difference(image, decoded).split()):
        raise ValueError('Lossless WebP round trip changed actor pixels')
    return {'file': str(destination), 'assetPixels': list(decoded.size), 'bytes': destination.stat().st_size,
            'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'cleaning': 'alpha<=2 only; hidden RGB zeroed',
            'cell': cell_size, 'anchor': [128 * cell_size // 256, 224 * cell_size // 256], 'frameBounds': frame_bounds,
            'resize': {'fromPixels': source_pixels, 'factor': cell_size/256, 'filter': 'LANCZOS' if cell_size != 256 else 'none'},
            'losslessRoundTrip': True, 'visualAcceptance': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--cell', type=int, choices=[128, 256], default=256)
    args = parser.parse_args()
    print(json.dumps(encode(args.source, args.destination, args.cell)))


if __name__ == '__main__':
    main()
