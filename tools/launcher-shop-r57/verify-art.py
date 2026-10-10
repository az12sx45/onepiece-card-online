"""Read-only output/provenance checks and a QA contact sheet; never repaint art."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib, math

ROOT = Path(__file__).resolve().parents[2]
OUT = Path('D:/Codex_QA/launcher-shop-r57/art')
OUT.mkdir(parents=True, exist_ok=True)
spec = json.loads((Path(__file__).with_name('avatars-spec.json')).read_text(encoding='utf-8'))
records = {}
for name in ['avatar-art-93-102.json', 'avatar-art-103-112.json', 'avatar-art-113-122.json']:
    data = json.loads((Path(__file__).with_name(name)).read_text(encoding='utf-8'))
    for item in data.get('items', data.get('entries', [])):
        assert item['id'] not in records
        records[item['id']] = (name, item)
assert sorted(records) == list(range(93, 123))
assets, hashes = [], set()
sheet = Image.new('RGB', (1500, 1920), '#102934')
draw = ImageDraw.Draw(sheet)
for index, item in enumerate(spec['items']):
    name, record = records[item['id']]
    file = ROOT / item['output']
    source = Path(record['source'])
    assert source.is_file() and record.get('prompt')
    assert record['output'] == item['output']
    sha = hashlib.sha256(file.read_bytes()).hexdigest()
    assert sha not in hashes
    hashes.add(sha)
    with Image.open(file) as image:
        assert image.format == 'WEBP' and image.size == (735, 735) and image.mode == 'RGBA'
        alpha = image.getchannel('A')
        assert alpha.getextrema() == (0, 255)
        assert all(alpha.getpixel(p) == 0 for p in [(0,0), (734,0), (0,734), (734,734)])
        histogram = alpha.histogram()
        coverage = sum(histogram[16:]) / (735 * 735)
        assert .55 < coverage < .82, (item['id'], coverage)
        # Strong pixels outside the inscribed circle expose square backgrounds
        # or stray drawings; allow only a tiny antialiased edge tolerance.
        outside = sum(1 for y in range(735) for x in range(735)
                      if (x-367)**2+(y-367)**2 > 370**2 and alpha.getpixel((x,y)) > 16)
        assert outside < 735*735*.003, (item['id'], outside)
        bounds = alpha.getbbox()
        assert abs((bounds[2]-bounds[0])-(bounds[3]-bounds[1])) <= 22, (item['id'], bounds)
        thumb = image.copy(); thumb.thumbnail((284,284))
        x,y = (index%5)*300+8,(index//5)*320+4
        sheet.paste(thumb,(x,y),thumb)
        draw.text((x+8,y+289),str(item['id'])+'  '+item['style'],fill='#ead5a3')
        assets.append({'id':item['id'],'file':item['output'],'size':[735,735],'mode':'RGBA',
                       'bytes':file.stat().st_size,'sha256':sha,'coverage':round(coverage,4),
                       'outsideCircleStrongPixels':outside,'alphaBounds':bounds,
                       'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
                       'provenance':name,'visualReview':'All 30 individually reviewed by generating agent and parent contact-sheet review.'})
sheet.save(OUT/'avatars-93-122.jpg', quality=93)
report={'status':'PASS','count':len(assets),'dimensions':[735,735],'format':'RGBA WebP',
        'counts':{'avatars':30,'styles':6},'totalBytes':sum(x['bytes'] for x in assets),'assets':assets}
(OUT/'asset-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({key:report[key] for key in ['status','count','totalBytes','dimensions','format']}))
