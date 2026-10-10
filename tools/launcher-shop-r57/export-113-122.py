from pathlib import Path
from PIL import Image
import hashlib, json

base = Path(__file__).resolve().parent
root = base.parents[1]
manifest_path = base / 'avatar-art-113-122.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for item in manifest['items']:
    source = Path(item['source'])
    output = root / item['output']
    image = Image.open(source).convert('RGBA')
    assert image.getchannel('A').getextrema() == (0, 255), f"Source alpha invalid: {item['id']}"
    image = image.resize((735, 735), Image.Resampling.LANCZOS)
    stage = output.with_suffix('.part.webp')
    image.save(stage, 'WEBP', quality=94, method=6, exact=True)
    with Image.open(stage) as final:
        assert final.size == (735,735) and final.mode == 'RGBA'
        corners = [final.getpixel(p)[3] for p in [(0,0),(734,0),(0,734),(734,734)]]
        assert corners == [0,0,0,0], f"Opaque corner: {item['id']}"
        alpha = list(final.getchannel('A').getextrema())
    stage.replace(output)
    item['qa'] = {'size':[735,735], 'mode':'RGBA', 'cornerAlpha':corners, 'alphaExtrema':alpha, 'bytes':output.stat().st_size, 'sha256':hashlib.sha256(output.read_bytes()).hexdigest(), 'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'PASS','count':len(manifest['items']),'bytes':sum(x['qa']['bytes'] for x in manifest['items'])}))
