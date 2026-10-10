from pathlib import Path
from io import BytesIO
import hashlib, json, subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[2]
QA=Path('D:/Codex_QA/launcher-shop-r59/art')
BASELINE='14b85203384077a1d2705aa278921b7d6d93b961'
spec=json.loads((Path(__file__).parent/'release-assets.json').read_text('utf-8'))
ids=spec['avatarIds']
QA.mkdir(parents=True,exist_ok=True)
records=[]
font=ImageFont.truetype('C:/Windows/Fonts/msjh.ttc',22)
for id in ids:
    logical=f'public/images/board/avatars/{id}.webp'
    data=(ROOT/logical).read_bytes()
    old=subprocess.check_output(['git','cat-file','blob',f'{BASELINE}:{logical}'],cwd=ROOT)
    assert data!=old, f'{id} was not replaced'
    with Image.open(BytesIO(data)) as im:
        assert im.mode=='RGBA' and im.size==(735,735),(id,im.mode,im.size)
        a=im.getchannel('A')
        assert a.getextrema()==(0,255),id
        assert all(a.getpixel(p)==0 for p in [(0,0),(734,0),(0,734),(734,734)]),id
        assert all(a.crop(b).getextrema()[1]<=1 for b in [(0,0,32,32),(703,0,735,32),(0,703,32,735),(703,703,735,735)]),id
        bounds=a.getbbox()
    records.append({'id':id,'path':logical,'sha256':hashlib.sha256(data).hexdigest(),'previousSha256':hashlib.sha256(old).hexdigest(),'bytes':len(data),'size':[735,735],'mode':'RGBA','alphaBounds':bounds})
assert len({r['sha256'] for r in records})==len(ids)
for start in range(0,len(ids),4):
    subset=ids[start:start+4]
    sheet=Image.new('RGB',(1000,len(subset)*390),(18,34,44))
    d=ImageDraw.Draw(sheet)
    for row,id in enumerate(subset):
        logical=f'public/images/board/avatars/{id}.webp'
        old=subprocess.check_output(['git','cat-file','blob',f'{BASELINE}:{logical}'],cwd=ROOT)
        for col,b in enumerate([old,(ROOT/logical).read_bytes()]):
            with Image.open(BytesIO(b)) as im:
                im=im.convert('RGBA');im.thumbnail((352,352),Image.Resampling.LANCZOS)
                xy=(col*500+74,row*390+8);sheet.paste(im,xy,im)
            d.text((col*500+30,row*390+359),f'{id} '+('修正前' if col==0 else '修正後'),font=font,fill=(243,220,176))
    sheet.save(QA/f'compare-{start//4+1}.jpg',quality=92)
show=Image.new('RGB',(1320,440),(18,34,44))
for n,id in enumerate([148,152,150]):
    with Image.open(ROOT/f'public/images/board/avatars/{id}.webp') as im:
        im=im.convert('RGBA').resize((420,420),Image.Resampling.LANCZOS);show.paste(im,(n*440+10,10),im)
show.save(QA/'corrected-trio.webp',quality=92)
report={'status':'PASS','count':len(records),'scope':'Pixel format, alpha and SHA checks; visual canon review recorded separately. Comparison sheets are QA only.','items':records}
(QA.parent/'art-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
print(json.dumps({'status':'PASS','count':len(records),'bytes':sum(r['bytes'] for r in records)}))
