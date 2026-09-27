"""Pack reviewed whole-body GPT drawings; never assemble or warp anatomy.

The plan explicitly declares source regions and a single scale per four-frame
loop. Cropping/alpha preservation/atlas encoding is deterministic, not new art.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('plan', type=Path)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[3])
    args = parser.parse_args()
    root = args.root.resolve()
    plan = json.loads(args.plan.read_text(encoding='utf-8-sig'))
    records = []
    for group in plan['clips']:
        source = root / group['source']
        original = Image.open(source).convert('RGBA')
        alpha_range=original.getchannel('A').getextrema()
        assert alpha_range[0] == 0 and alpha_range[1] >= 240, 'Real alpha required'
        assert len(group['regions']) == 4
        scale = group['scale']
        assert 0 < scale <= 1
        atlas = Image.new('RGBA', (512, 128))
        frame_info = []
        for index, region in enumerate(group['regions']):
            x0, y0, x1, y1 = region
            assert 0 <= x0 < x1 <= original.width and 0 <= y0 < y1 <= original.height
            frame = original.crop(region)
            bounds = frame.getchannel('A').getbbox()
            assert bounds, f'Empty frame {group["id"]} {index}'
            # A cell's horizontal centre is stable even when an arm extends.
            cropped = frame.crop(bounds)
            output = cropped.resize((round(cropped.width * scale), round(cropped.height * scale)), Image.Resampling.LANCZOS)
            source_root = group.get('roots', [None] * 4)[index]
            root_x = source_root[0] - x0 if source_root else frame.width / 2
            offset = round(64 + (bounds[0] - root_x) * scale)
            top = 112 - output.height
            assert 0 <= offset and offset + output.width <= 128 and top >= 0, f'Clipped actor {group["id"]} {index}'
            atlas.alpha_composite(output, (index * 128 + offset, top))
            frame_info.append({'sourceRegion': region, 'alphaBounds': list(bounds), 'outputBounds': [offset, top, output.width, output.height]})
        dest = root / group['asset']
        assert dest.resolve().is_relative_to(root)
        dest.parent.mkdir(parents=True, exist_ok=True)
        atlas.save(dest, 'WEBP', lossless=True, exact=True)
        records.append({**group, 'sourceSha256': sha(source), 'assetSha256': sha(dest), 'frames': frame_info,
                        'shape': {'cell': 128, 'columns': 4, 'rows': 1, 'root': [64, 112]}, 'generator': 'gpt-image',
                        'visualAcceptance': False})
    report = args.plan.with_name(args.plan.stem + '-import.json')
    report.write_text(json.dumps({'schema': 'launcher-life-art-import/1', 'clips': records}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'clips': len(records), 'report': str(report)}))


if __name__ == '__main__':
    main()
