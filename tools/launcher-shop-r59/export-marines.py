from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
ROOT=Path(__file__).resolve().parents[2]
manifest=Path(__file__).with_name('marines-art.json')
data=json.loads(manifest.read_text(encoding='utf-8'))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
for it in data['items']:
    dest=ROOT/it['output']
    with Image.open(it['source']) as source:
        im=source.convert('RGBA').resize((735,735),Image.Resampling.LANCZOS)
        a=im.getchannel('A')
        corners=[a.getpixel(xy) for xy in [(0,0),(734,0),(0,734),(734,734)]]
        assert corners==[0,0,0,0],(it['id'],corners)
        assert a.getextrema()==(0,255)
        im.save(dest,format='WEBP',quality=94,method=4)
    with Image.open(dest) as final:
        assert final.size==(735,735) and final.mode=='RGBA'
    it['pixelQA']={'size':[735,735],'mode':'RGBA','cornerAlpha':corners,'alphaExtrema':[0,255],'sha256':sha(dest),'sourceSha256':sha(it['source']),'beforeSha256':sha(it['before']),'bytes':dest.stat().st_size}
    print(it['id'],it['pixelQA'])
manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
sheet=Image.new('RGB',(1500,660),(21,30,37));draw=ImageDraw.Draw(sheet)
for i,it in enumerate(data['items']):
    for row,path in enumerate([it['before'],ROOT/it['output']]):
        with Image.open(path) as src:
            thumb=src.convert('RGBA').resize((280,280),Image.Resampling.LANCZOS)
            sheet.paste(thumb,(i*300+10,row*330+30),thumb)
        draw.text((i*300+12,row*330+8),str(it['id'])+(' BEFORE' if row==0 else ' AFTER'),fill='white')
out=Path('D:/Codex_QA/launcher-shop-r59/art/marines-before-after.jpg')
sheet.save(out,quality=93)
print(out)
