"""Re-export retained whole-body artwork without changing any authored pose or anchor."""
import argparse
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / 'tools/launcher-room'))
from import_fullbody_v3 import extract_frame, render_one, pixel_bounds

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def ref(path):
    return {'path': path.relative_to(ROOT).as_posix(), 'sha256': sha(path)}

def build():
    manifest_path = ROOT / 'tools/launcher-room/hd-v4/manifest.json'
    if manifest_path.exists():
        raise ValueError('Existing manifest must be reviewed, never overwritten by a build')
    modes = [
        ('motion_v4', 'docs/LAUNCHER_ROOM_WALK_V3_20260927.json', 384, 4),
        ('acting_v4', 'docs/LAUNCHER_ROOM_FULLBODY_ART_20260927.json', 256, 8),
    ]
    items, source_records, inputs = [], {}, []
    for kind, legacy_path, cell, columns in modes:
        legacy_file = ROOT / legacy_path
        legacy = read(legacy_file)
        selection_file = ROOT / legacy['resolvedSelection']['path']
        assert sha(selection_file) == legacy['resolvedSelection']['sha256']
        selection = read(selection_file)
        frames = {(f['key'], f['direction'], f['pose']): f for f in selection['frames']}
        images = {}
        for source_id, source in legacy['sources'].items():
            source_file = ROOT / source['image']['path']
            assert sha(source_file) == source['image']['sha256'], source_file
            image = Image.open(source_file).convert('RGBA')
            images[source_id] = image
            source_records[source_file.relative_to(ROOT).as_posix()] = {
                **ref(source_file), 'dimensions': list(image.size),
                'generator': source['generator'], 'sourceId': source_id,
            }
        inputs.append({'kind': kind, 'legacyManifest': ref(legacy_file), 'selection': ref(selection_file)})
        for old in legacy['items']:
            if old.get('kind') not in ('walking', 'static-poses'):
                continue
            assert len(old['frames']) == columns
            old_asset = ROOT / old['asset']
            assert sha(old_asset) == old['assetSha256']
            old_pixels = Image.open(old_asset).convert('RGBA')
            atlas = Image.new('RGBA', (cell * columns, cell))
            records = []
            for frame in old['frames']:
                index = frame['index']
                authored = frames[(old['key'], old['direction'], frame['pose'])]
                extracted = extract_frame(authored, images[authored['source']])
                assert extracted['localAnchor'] == frame['localAnchor']
                assert extracted['sourceAlphaBounds'] == frame['sourceAlphaBounds']
                old_frame, _ = render_one(extracted, frame['uniformDirectionScale'], 128)
                old_rgba_sha = hashlib.sha256(old_frame.tobytes()).hexdigest()
                assert old_rgba_sha == frame['rgbaSha256'], (kind, old['key'], old['direction'], frame['pose'])
                assert old_frame.tobytes() == old_pixels.crop((index * 128, 0, (index + 1) * 128, 128)).tobytes()
                hd_frame, transform = render_one(extracted, frame['uniformDirectionScale'], cell)
                bounds = pixel_bounds(hd_frame)
                assert bounds and min(bounds[:2]) > 0 and max(bounds[2:]) < cell
                atlas.paste(hd_frame, (index * cell, 0))
                records.append({
                    'index': index, 'pose': frame['pose'], 'sourceId': authored['source'],
                    'sourcePath': legacy['sources'][authored['source']]['image']['path'],
                    'sourceRegion': authored['region'], 'localAnchor': frame['localAnchor'],
                    'uniformDirectionScale': frame['uniformDirectionScale'],
                    'sourceUnitScale': frame['sourceUnitScale'],
                    'legacyRgbaSha256': old_rgba_sha, 'legacyPixelsReproduced': True,
                    'rgbaSha256': hashlib.sha256(hd_frame.tobytes()).hexdigest(),
                    'bounds': bounds, 'inverseWholeImageTransform': transform,
                    'root': [cell / 2, cell * 112 / 128], 'clipped': False,
                })
            relative = f'public/images/launcher_room/{kind}/{old["key"]}/{old["direction"]}.webp'
            target = ROOT / relative
            assert not target.exists(), target
            target.parent.mkdir(parents=True, exist_ok=True)
            atlas.save(target, 'WEBP', lossless=True, exact=True, method=6)
            decoded = Image.open(target).convert('RGBA')
            assert decoded.tobytes() == atlas.tobytes()
            items.append({
                'kind': kind, 'key': old['key'], 'direction': old['direction'],
                'asset': relative, 'sha256': sha(target), 'bytes': target.stat().st_size,
                'dimensions': list(atlas.size), 'cell': cell, 'columns': columns,
                'logicalCell': 128, 'resolution': cell / 128,
                'legacyAsset': ref(old_asset), 'losslessPixelMatch': True, 'frames': records,
            })
            print(f'{kind}/{old["key"]}/{old["direction"]}: {cell}px', flush=True)
        for image in images.values():
            image.close()
    assert len(items) == 80
    manifest = {
        'schema': 'one-piece-room-hd-art/4', 'version': '1.2.4',
        'method': 'Original whole-body source, same component selection, uniform scale and root; higher export resolution only',
        'logicalCell': 128, 'anatomyReassembled': False, 'mirrored': False,
        'generatedNewDrawings': False, 'legacyFramesReproduced': sum(len(i['frames']) for i in items),
        'inputs': inputs, 'exporter': ref(Path(__file__).resolve()),
        'legacyImporter': ref(ROOT / 'tools/launcher-room/import_fullbody_v3.py'),
        'sources': source_records, 'items': items,
        'visualAcceptance': False, 'humanAcceptance': False,
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'ok': True, 'assets': len(items), 'frames': manifest['legacyFramesReproduced'], 'manifest': str(manifest_path)}))

if __name__ == '__main__':
    build()
