from pathlib import Path
from PIL import Image
import json, hashlib

base = Path(__file__).resolve().parent
root = base.parents[1]
review = json.loads((base / 'avatars-63-83-qa.json').read_text(encoding='utf-8'))
manifest_path = base / 'avatars-prompts.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
by_id = {r['id']: r for r in manifest['items']}
total_bytes = 0
for item in review['items']:
    row = by_id[item['id']]
    dest = root / row['output']
    source = Path(item['finalSource'])
    with Image.open(dest) as im:
        im.load()
        assert im.format == 'WEBP' and im.size == (735,735) and im.mode == 'RGBA'
        assert all(im.getpixel(p)[3] == 0 for p in [(0,0),(734,0),(0,734),(734,734)])
    assert row['source'] == str(source)
    assert row['qa']['sourceSha256'] == hashlib.sha256(source.read_bytes()).hexdigest()
    assert row['qa']['sha256'] == hashlib.sha256(dest.read_bytes()).hexdigest()
    total_bytes += dest.stat().st_size
    row['qa']['visualChecks'] = item['visualChecks']
    row['qa']['officialReferences'] = item['officialReferences']
    row['qa']['review'] = 'Individual generated output and final circular WebP inspected. Specific visual checks below; direct official-image comparison applies only when officialReferences is nonempty.'
    if item['revisionPrompt']:
        row['revisions'] = [{'reason': 'Corrected canon details after direct official image comparison', 'prompt': item['revisionPrompt'], 'finalSource': str(source)}]
    if item['id'] == 67:
        row['name'] = '蕾貝卡・競技場'
        row['subject'] = 'Rebecca, Dressrosa gladiator head-and-shoulders portrait, gold Corinthian helmet with red crest, pink braid, teal cloak at shoulders.'
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'validated':len(review['items']), 'ids':[x['id'] for x in review['items']], 'bytes':total_bytes, 'sourcesAndHashesMatch':True, 'pendingPartFiles':[str(p) for p in (root/'public/images/board/avatars').glob('*.part.webp')]}))
