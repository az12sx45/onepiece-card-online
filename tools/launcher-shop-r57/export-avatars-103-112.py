from pathlib import Path
from PIL import Image
import json, hashlib, os

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name('avatar-art-103-112.json')
data = json.loads(MANIFEST.read_text(encoding='utf-8'))
for item in data['items']:
    source = Path(item['source'])
    destination = ROOT / item['output']
    with Image.open(source) as original:
        image = original.convert('RGBA')
        if image.size != (735,735):
            image = image.resize((735,735), Image.Resampling.LANCZOS)
        alpha = image.getchannel('A')
        corners = [alpha.getpixel(xy) for xy in [(0,0),(734,0),(0,734),(734,734)]]
        assert corners == [0,0,0,0], (item['id'], corners)
        assert alpha.getextrema() == (0,255), item['id']
        temporary = destination.with_suffix('.webp.part')
        image.save(temporary, format='WEBP', quality=93, method=6)
        os.replace(temporary, destination)
    with Image.open(destination) as final:
        assert final.size == (735,735) and final.mode == 'RGBA'
    item['pixelQA'] = {'size':[735,735], 'mode':'RGBA', 'cornerAlpha':corners,
        'alphaExtrema':list(alpha.getextrema()), 'bytes':destination.stat().st_size,
        'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),
        'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
    print(item['id'], item['pixelQA']['bytes'], item['pixelQA']['sha256'])
temporary_manifest = MANIFEST.with_suffix('.json.part')
temporary_manifest.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
os.replace(temporary_manifest, MANIFEST)
