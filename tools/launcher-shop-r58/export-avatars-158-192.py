from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib, os, sys
ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name('avatar-art-158-192.json')
data = json.loads(MANIFEST.read_text(encoding='utf-8'))
for item in data['items']:
    source = Path(item['source'])
    destination = ROOT / item['output']
    if destination.exists() and item.get('pixelQA',{}).get('sourceSha256') == hashlib.sha256(source.read_bytes()).hexdigest():
        continue
    with Image.open(source) as original:
        image = original.convert('RGBA')
        if image.size != (735,735): image = image.resize((735,735), Image.Resampling.LANCZOS)
        alpha = image.getchannel('A')
        corners = [alpha.getpixel(xy) for xy in [(0,0),(734,0),(0,734),(734,734)]]
        assert corners == [0,0,0,0], (item['id'], corners)
        assert alpha.getextrema() == (0,255), item['id']
        corner_max=[alpha.crop(box).getextrema()[1] for box in [(0,0,48,48),(687,0,735,48),(0,687,48,735),(687,687,735,735)]]
        assert max(corner_max)<=1, (item['id'],'corner blocks',corner_max)
        temporary = destination.with_suffix('.webp.part')
        image.save(temporary, format='WEBP', quality=94, method=4)
        os.replace(temporary,destination)
    with Image.open(destination) as final:
        assert final.size == (735,735) and final.mode == 'RGBA'
    item['pixelQA']={'size':[735,735],'mode':'RGBA','cornerAlpha':corners,'corner48MaxAlpha':corner_max,'alphaExtrema':list(alpha.getextrema()),'bytes':destination.stat().st_size,'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
    print(item['id'],item['pixelQA']['bytes'],item['pixelQA']['sha256'])
temporary=MANIFEST.with_suffix('.json.part')
temporary.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
os.replace(temporary,MANIFEST)
sheet=Image.new('RGB',(1100,((len(data['items'])+4)//5)*250),(20,31,39))
draw=ImageDraw.Draw(sheet)
for n,item in enumerate(data['items']):
    with Image.open(ROOT/item['output']) as im:
        im=im.convert('RGBA').resize((210,210),Image.Resampling.LANCZOS)
        xy=((n%5)*220+5,(n//5)*250+5)
        sheet.paste(im,xy,im)
        draw.text((xy[0]+8,xy[1]+214),str(item['id']),fill='white')
out=Path('D:/Codex_QA/launcher-shop-r58/art/avatars-158-192.jpg')
out.parent.mkdir(parents=True,exist_ok=True)
sheet.save(out,quality=94)
print(out)
