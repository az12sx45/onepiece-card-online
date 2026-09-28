"""Build a versioned, whole-figure Ace replacement from seven GPT sprite sheets.

No legacy art is overwritten. Exports 17 runtime atlases and an 81-frame contact
sheet into a fresh staging folder for independent visual review.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
IMPORTER = ROOT / 'tools/launcher-room/reserved-v1/import_atlases.py'
spec = importlib.util.spec_from_file_location('reserved_importer', IMPORTER)
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)

SHEETS = ('master', 'walk-side', 'walk-front', 'acting-side', 'acting-front', 'work', 'utility')
OUT = HERE / 'stage-r4'
DEST_BASE = 'public/images/launcher_room/reserved_v2/ace'
SOURCE_FILES = {'acting-side': 'acting-side-inset.png'}


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def defringe(image: Image.Image) -> tuple[Image.Image, int]:
    """Remove only generated transparent matte and saturated warm edge noise.

    The authored opaque body, hat, beads and tattoo interiors are retained;
    geometry/pose/root never changes. The export downsampler creates fresh AA.
    """
    data = np.asarray(image.convert('RGBA')).copy()
    alpha = data[:, :, 3]
    core = alpha > 128
    distance = cv2.distanceTransform(core.astype('uint8'), cv2.DIST_L2, 3)
    red = (data[:, :, 0] > 220) & (data[:, :, 1] < 75) & (data[:, :, 2] < 75)
    yellow = (data[:, :, 0] > 210) & (data[:, :, 1] > 130) & (data[:, :, 2] < 75)
    remove = (alpha <= 128) | ((red | yellow) & (distance <= 5))
    count = int(np.count_nonzero((alpha > 0) & remove))
    data[remove] = 0
    return Image.fromarray(data, 'RGBA'), count


def remove_tiny_islands(image: Image.Image) -> tuple[Image.Image, int]:
    data = np.asarray(image.convert('RGBA')).copy()
    alpha = data[:, :, 3]
    count, labels, stats, _ = cv2.connectedComponentsWithStats(
        (alpha > 128).astype('uint8'), connectivity=8)
    if count <= 2:
        return image, 0
    main = max(range(1, count), key=lambda component: int(stats[component, cv2.CC_STAT_AREA]))
    secondary = [component for component in range(1, count) if component != main]
    if any(int(stats[component, cv2.CC_STAT_AREA]) > 16 for component in secondary):
        raise ValueError('A rendered pose has a significant detached component')
    secondary_mask = np.isin(labels, secondary).astype('uint8')
    outside = (cv2.dilate(secondary_mask, np.ones((3, 3), dtype='uint8')) > 0) & (alpha > 0)
    removed = int(np.count_nonzero(outside))
    data[outside] = 0
    return Image.fromarray(data, 'RGBA'), removed


def main() -> None:
    if OUT.exists() and any(OUT.iterdir()):
        raise RuntimeError('Stage must be fresh; preserve and review previous export')
    images = {}
    sources = {}
    selected = {}
    refs = {}
    for sheet in SHEETS:
        source_id = f'ace-{sheet}'
        image_path = HERE / 'sources' / SOURCE_FILES.get(sheet, f'{sheet}.png')
        image = Image.open(image_path).convert('RGBA')
        if image.size != (1254, 1254) or image.getextrema()[3] != (0, 255):
            raise ValueError(f'Expected 1254px true-alpha source: {image_path}')
        images[source_id] = image
        cols, rows = imp.SHEETS[sheet]['grid']
        count, labels, stats, centroids = cv2.connectedComponentsWithStats(
            (np.asarray(image.getchannel('A')) > 128).astype('uint8'), connectivity=8)
        cells = {}
        for component in range(1, count):
            if int(stats[component, cv2.CC_STAT_AREA]) <= 500:
                continue
            x, y = centroids[component]
            col = min(cols - 1, int(x * cols / image.width))
            row = min(rows - 1, int(y * rows / image.height))
            key = f'{row}:{col}'
            if key in cells:
                raise ValueError(f'Multiple complete figures in {sheet} cell {key}')
            yy, xx = np.where(labels == component)
            mid = len(xx) // 2
            cells[key] = {'region': [0, 0, image.width, image.height],
                          'componentSeed': [int(xx[mid]), int(yy[mid])]}
        if len(cells) != cols * rows:
            raise ValueError(f'{sheet} has {len(cells)} complete figures, expected {cols * rows}')
        sources[source_id] = {'key': 'ace', 'sheet': sheet, 'cells': cells}
        selected[sheet] = source_id
        col, row = imp.SHEETS[sheet]['standing']
        frame = imp.cell_frame(source_id, sources[source_id], image, col, row,
                               'south', 'calibration-standing')
        try:
            extracted = imp.extraction(frame, image)
        except ValueError as exc:
            raise ValueError(f'{sheet} standing source: {exc}') from exc
        refs[source_id] = extracted['opaqueBounds'][3]
    master_height = refs[selected['master']]
    if not 400 <= master_height <= 620:
        raise ValueError(f'Unexpected Ace standing height: {master_height}')
    overall_scale = 100 / master_height
    units = {source_id: master_height / height for source_id, height in refs.items()}

    items = []
    contacts = []
    defringe_pixels = 0
    isolated_pixels = 0
    for item in imp.build_specs('ace', selected, sources, images):
        cell, count = item['cell'], item['columns']
        atlas = Image.new('RGBA', (cell * count, cell))
        records = []
        for index, frame in enumerate(item['selections']):
            try:
                value = imp.extraction(frame, images[frame['source']])
            except ValueError as exc:
                raise ValueError(f'{item["asset"]} frame {index}: {exc}') from exc
            value['sourceUnitScale'] = units[frame['source']]
            value['image'], removed = defringe(value['image'])
            defringe_pixels += removed
            figure, transform = imp.legacy.render_one(value, overall_scale, cell)
            figure, removed_islands = remove_tiny_islands(figure)
            isolated_pixels += removed_islands
            bounds = imp.legacy.pixel_bounds(figure, True)
            if not bounds or min(bounds[:2]) < 1 or max(bounds[2:]) >= cell:
                raise ValueError(f'Clipped frame: {item["asset"]} frame {index}: {bounds}')
            atlas.paste(figure, (cell * index, 0))
            records.append({'index': index, 'pose': frame['pose'], 'source': frame['source'],
                            'sourceCell': frame['sourceCell'], 'bounds': bounds,
                            'removedDistantAlphaPixels': value['removedDistantAlphaPixels'],
                            'rgbaSha256': hashlib.sha256(figure.tobytes()).hexdigest(),
                            'wholeFigureOnly': True, 'mirrored': False})
            contacts.append((item['kind'], item.get('action', ''), item['direction'], index, figure))
        relative = item['asset'].replace('public/images/launcher_room/reserved_v1/ace', DEST_BASE)
        output = OUT / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(output, format='WEBP', lossless=True, exact=True, method=6)
        with Image.open(output) as decoded:
            if decoded.size != atlas.size or decoded.getextrema()[3] != (0, 255):
                raise ValueError(f'WebP round trip failed: {relative}')
        items.append({'path': relative, 'bytes': output.stat().st_size, 'sha256': sha(output),
                      'dimensions': list(atlas.size), 'cell': cell, 'frames': records})

    if len(items) != 17 or len(contacts) != 81:
        raise ValueError(f'Expected 17 atlases / 81 complete poses, got {len(items)} / {len(contacts)}')
    canvas = Image.new('RGB', (8 * 192, 11 * 192), '#14303a')
    draw = ImageDraw.Draw(canvas)
    for pos, (kind, action, direction, index, figure) in enumerate(contacts):
        x, y = (pos % 8) * 192, (pos // 8) * 192
        draw.rectangle((x + 2, y + 22, x + 189, y + 189), fill='#c1d1ce')
        thumb = figure.copy()
        thumb.thumbnail((168, 166), Image.Resampling.LANCZOS)
        canvas.paste(thumb, (x + (192 - thumb.width) // 2, y + 22), thumb)
        draw.text((x + 5, y + 5), f'{action or kind} {direction} {index}', fill='white')
    contact = OUT / 'tools/launcher-room/ace-lean-v1212/contact.png'
    contact.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(contact)

    manifest = {
        'schema': 'launcher-ace-lean-art/1', 'build': '1.2.12-candidate',
        'identity': 'Portgas D. Ace', 'legacyArtOverwritten': False,
        'visualAccepted': False, 'humanAcceptance': False,
        'sourceSheets': [{'path': str((HERE / 'sources' / SOURCE_FILES.get(sheet, f'{sheet}.png')).relative_to(ROOT)).replace('\\', '/'),
                          'bytes': (HERE / 'sources' / SOURCE_FILES.get(sheet, f'{sheet}.png')).stat().st_size,
                          'sha256': sha(HERE / 'sources' / SOURCE_FILES.get(sheet, f'{sheet}.png')), 'standingHeight': refs[f'ace-{sheet}']}
                         for sheet in SHEETS],
        'items': items, 'atlasCount': len(items), 'frameCount': len(contacts),
        'totalRuntimeBytes': sum(item['bytes'] for item in items),
        'contact': {'path': str(contact.relative_to(OUT)).replace('\\', '/'),
                    'bytes': contact.stat().st_size, 'sha256': sha(contact)},
        'processing': 'Whole connected source figure per cell; common standing calibration; no body part splicing or mirroring; existing importer plus restrained alpha/warm-edge cleanup.',
        'removedWarmAndTransparentEdgePixels': defringe_pixels,
        'removedIsolatedPixels': isolated_pixels
    }
    path = OUT / 'tools/launcher-room/ace-lean-v1212/manifest.json'
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'atlasCount': len(items), 'frameCount': len(contacts),
                      'totalRuntimeBytes': manifest['totalRuntimeBytes'],
                      'manifest': str(path), 'contact': str(contact)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
