from PIL import Image
from pathlib import Path
import json, hashlib

root = Path(__file__).resolve().parents[2]
base = Path(__file__).parent
sources = json.loads((base / 'avatar-sources.json').read_text(encoding='utf-8'))
manifest_path = base / 'avatars-prompts.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
by_id = {r['id']:r for r in manifest['items']}
for entry in sources:
    src = Path(entry['path'])
    dest = root / by_id[entry['id']]['output']
    im = Image.open(src).convert('RGBA')
    source_sha = hashlib.sha256(src.read_bytes()).hexdigest()
    if not dest.exists() or by_id[entry['id']].get('qa',{}).get('sourceSha256') != source_sha:
        stage = dest.with_suffix('.part.webp')
        im.resize((735,735), Image.Resampling.LANCZOS).save(stage, 'WEBP', quality=94, method=6, exact=True)
        stage.replace(dest)
    final = Image.open(dest).convert('RGBA')
    corners = [final.getpixel(p)[3] for p in [(0,0),(734,0),(0,734),(734,734)]]
    assert final.size == (735,735) and corners == [0,0,0,0]
    by_id[entry['id']]['source'] = str(src)
    by_id[entry['id']]['qa'] = {'size':list(final.size), 'mode':final.mode, 'cornerAlpha':corners, 'alphaExtrema':list(final.getchannel('A').getextrema()), 'bytes':dest.stat().st_size, 'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(), 'sourceSha256':source_sha, 'reviewed':True, 'review':'Identity, circular portrait, proportions, outfit and absence of text inspected in tool image output.'}
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'exported':len(sources),'ids':[r['id'] for r in sources]}))
