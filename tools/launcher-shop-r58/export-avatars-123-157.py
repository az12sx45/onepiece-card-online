from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib, os, sys
ROOT=Path(__file__).resolve().parents[2]
MANIFEST=Path(__file__).with_name('avatar-art-123-157.json')
data=json.loads(MANIFEST.read_text(encoding='utf-8'))
selected=set(map(int,sys.argv[1:]))
for item in data['items']:
    if selected and item['id'] not in selected: continue
    source=Path(item['source']); destination=ROOT/item['output']
    with Image.open(source) as original:
        im=original.convert('RGBA').resize((735,735),Image.Resampling.LANCZOS)
        alpha=im.getchannel('A')
        corners=[alpha.getpixel(xy) for xy in [(0,0),(734,0),(0,734),(734,734)]]
        assert corners==[0,0,0,0],(item['id'],corners)
        assert alpha.getextrema()==(0,255)
        part=destination.with_suffix('.webp.part'); im.save(part,format='WEBP',quality=93,method=4); os.replace(part,destination)
    with Image.open(destination) as final:
        assert final.size==(735,735) and final.mode=='RGBA'
    item['pixelQA']={'size':[735,735],'mode':'RGBA','cornerAlpha':corners,'alphaExtrema':list(alpha.getextrema()),'bytes':destination.stat().st_size,'sha256':hashlib.sha256(destination.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
    print(item['id'],item['pixelQA']['bytes'])
part=MANIFEST.with_suffix('.json.part'); part.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');os.replace(part,MANIFEST)
out=Path('D:/Codex_QA/launcher-shop-r58/art');out.mkdir(parents=True,exist_ok=True)
items=[i for i in data['items'] if (ROOT/i['output']).exists()]
sheet=Image.new('RGB',(1000,((len(items)+4)//5)*220),(26,36,45));draw=ImageDraw.Draw(sheet)
for n,item in enumerate(items):
    with Image.open(ROOT/item['output']) as im:
        im.thumbnail((190,190));x=(n%5)*200+5;y=(n//5)*220+5;sheet.paste(im,(x,y),im);draw.text((x+5,y+192),str(item['id']),fill='white')
sheet.save(out/'avatars-123-157.jpg',quality=91)
