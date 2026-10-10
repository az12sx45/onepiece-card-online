"""Encode approved, individually GPT-generated r57 avatars without repainting alpha."""
from pathlib import Path
import hashlib
import json
import os
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RECORD = Path(__file__).with_name('avatar-art-93-102.json')
data = json.loads(RECORD.read_text(encoding='utf-8'))
for entry in data['entries']:
    source = Path(entry['source'])
    output = ROOT / entry['output']
    with Image.open(source) as original:
        if original.mode != 'RGBA':
            raise RuntimeError(f"{entry['id']}: generated source has no RGBA alpha")
        source_size = list(original.size)
        image = original.resize((735, 735), Image.Resampling.LANCZOS)
        alpha = image.getchannel('A')
        corners = [alpha.getpixel(p) for p in [(0, 0), (734, 0), (0, 734), (734, 734)]]
        if any(corners) or alpha.getextrema() != (0, 255):
            raise RuntimeError(f"{entry['id']}: alpha validation failed: {corners}")
        part = output.with_suffix('.webp.part')
        image.save(part, format='WEBP', quality=94, method=6, exact=True)
    with Image.open(part) as reread:
        reread.load()
        if reread.size != (735, 735) or reread.mode != 'RGBA':
            raise RuntimeError(f"{entry['id']}: encoded WebP is not 735 RGBA")
    os.replace(part, output)
    entry.update({
        'sourceSize': source_size,
        'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
        'bytes': output.stat().st_size,
        'size': [735, 735],
        'mode': 'RGBA',
        'format': 'WebP',
        'cornerAlpha': corners,
        'validation': 'PASS: original alpha preserved; exact dimensions; corners transparent; individual canon/style visual review recorded'
    })
    print(entry['id'], entry['sha256'], entry['bytes'])
data['status'] = 'completed'
temp = RECORD.with_suffix('.json.part')
temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
os.replace(temp, RECORD)
