"""Pack four GPT whole-body reading sources into four-direction 4-frame clips.

Only cropping, uniform per-loop scaling and whole-body translation are applied.
Original source alpha and source files are preserved. Runtime review is separate.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[4]
base = root / 'tools/launcher-room/life-v1'
specs = {
    'nami-read': ([0, 326, 647, 954, 1254], 'b9ae5a4a-5e4e-49c4-b876-4bc697a8d9d6'),
    'jinbe-read': ([0, 315, 625, 918, 1254], '0fd76ee1-695c-4ed3-8b40-1d609177ff6b'),
    'franky-read': ([0, 314, 630, 938, 1254], '95a95ad3-21e9-44e8-a7cd-9e8b44142e2a'),
    'usopp-read': ([0, 311, 625, 931, 1254], '0842dd5f-b113-447f-b797-a01113e6982e'),
}
refs = {
    'nami': ['nami-actions-source-01'],
    'jinbe': ['jinbe-v15-actions-01'],
    'franky': ['franky-actions-source-01', 'franky-actions-side-repair-02', 'franky-actions-north-repair-02'],
    'usopp': ['usopp-actions-01', 'usopp-actions-05'],
}
directions = ['east', 'west', 'north', 'south']

for name, (rows, uid) in specs.items():
    key, action = name.split('-')
    folder = base / name
    source = folder / 'source.png'
    image = Image.open(source).convert('RGBA')
    assert image.size == (1254, 1254)
    assert image.getchannel('A').getextrema() == (0, 255)
    clips = []
    for row, direction in enumerate(directions):
        regions, heights, roots = [], [], []
        for col in range(4):
            # Nami's source uses unequal column spacing. Boundaries were
            # reviewed against all sixteen complete alpha components.
            nami_columns = [[0, 391, 662, 937, 1254], [0, 314, 587, 864, 1254],
                            [0, 350, 630, 903, 1254], [0, 356, 630, 906, 1254]]
            edges = nami_columns[row] if key == 'nami' else [round(i * image.width / 4) for i in range(5)]
            x0, x1 = edges[col], edges[col + 1]
            cell = image.crop((x0, rows[row], x1, rows[row + 1]))
            solid = cell.getchannel('A').point(lambda a: 255 if a >= 32 else 0)
            bounds = solid.getbbox()
            assert bounds, (name, direction, col)
            floor = solid.crop((0, max(bounds[1], bounds[3] - 10), cell.width, bounds[3])).getbbox()
            ground_x = round(x0 + (floor[0] + floor[2]) / 2)
            left = max(x0, x0 + bounds[0] - 2)
            right = min(x1, x0 + bounds[2] + 2)
            top = max(rows[row], rows[row] + bounds[1] - 2)
            bottom = min(rows[row + 1], rows[row] + bounds[3] + 2)
            regions.append([left, top, right, bottom])
            roots.append([ground_x, bottom])
            heights.append(bottom - top)
        clips.append({
            'id': action, 'key': key, 'direction': direction,
            'source': str(source.relative_to(root)).replace('\\', '/'),
            'scale': round(100 / max(heights), 6),
            'regions': regions, 'roots': roots,
            'asset': f'public/images/launcher_room/life_v1/{key}/{action}-{direction}.webp',
        })
    (folder / 'plan.json').write_text(json.dumps({'clips': clips}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    subprocess.run([sys.executable, str(base / 'import_clips.py'), str(folder / 'plan.json'), '--root', str(root)], check=True)
    contact = Image.new('RGB', (512, 512), (31, 46, 52))
    checks = []
    for row, clip in enumerate(clips):
        asset = root / clip['asset']
        atlas = Image.open(asset).convert('RGBA')
        assert atlas.size == (512, 128)
        frame_hashes, frame_bounds = [], []
        for i in range(4):
            frame = atlas.crop((i * 128, 0, (i + 1) * 128, 128))
            bounds = frame.getchannel('A').getbbox()
            assert bounds and 0 <= bounds[0] < bounds[2] <= 128 and 0 <= bounds[1] < bounds[3] <= 112
            frame_hashes.append(hashlib.sha256(frame.tobytes()).hexdigest())
            frame_bounds.append(bounds)
        assert len(set(frame_hashes)) == 4, (name, clip['direction'], 'duplicate frames')
        contact.paste(atlas, (0, row * 128), atlas)
        checks.append({'asset': clip['asset'], 'sha256': hashlib.sha256(asset.read_bytes()).hexdigest(), 'size': list(atlas.size), 'frameBounds': frame_bounds, 'distinctFrames': 4, 'root': [64, 112]})
    contact.save(folder / 'contact-128.png')
    receipt = {
        'generator': 'image_gen.imagegen', 'mode': 'built-in',
        'generatedFile': f'C:/Users/王曜瑋/.codex/generated_images/01a0e0d1-a4bf-73f3-af41-6763cfefe2b5/exec-{uid}.png',
        'references': [f'tools/launcher-room/fullbody-v3/sources/{ref}/image.png' for ref in refs[key]],
        'prompt': str((folder / 'prompt.txt').relative_to(root)).replace('\\', '/'),
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'sourcePixels': list(image.size), 'trueAlpha': True,
        'packing': 'Whole-body crop and root translation only, one uniform scale per four-frame loop. Main bounds measured at alpha32 and padded within row/cell bounds; original alpha is retained. No limb assembly, mirror, rotation or warp. Feet root is derived from ground pixels.',
        'sourceAccepted': False, 'contactAccepted': False, 'runtimeAccepted': False,
        'sourceReview': 'Pending recorded visual review.',
        'actualSizeReview': 'Pending contact review.',
        'contactSheet': str((folder / 'contact-128.png').relative_to(root)).replace('\\', '/'),
        'contactSha256': hashlib.sha256((folder / 'contact-128.png').read_bytes()).hexdigest(),
        'numericQa': {'passed': True, 'checks': checks, 'scope': 'Atlas dimensions, alpha bounds and four distinct frames; not runtime acceptance.'},
    }
    (folder / 'receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(name, receipt['sourceSha256'], [(clip['direction'], clip['scale']) for clip in clips])
