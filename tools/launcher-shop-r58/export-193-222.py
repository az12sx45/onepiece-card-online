from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib, json, os, sys
base = Path(__file__).resolve().parent
root = base.parents[1]
manifest_path = base / 'avatar-art-193-222.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
for item in manifest['items']:
    source = Path(item['source'])
    output = root / item['output']
    if 'qa' in item and output.exists() and hashlib.sha256(output.read_bytes()).hexdigest() == item['qa']['sha256']:
        continue
    image = Image.open(source).convert('RGBA')
    assert image.getchannel('A').getextrema() == (0,255), f"Source alpha invalid: {item['id']}"
    image = image.resize((735,735), Image.Resampling.LANCZOS)
    stage = output.with_suffix('.webp.part')
    image.save(stage,'WEBP',quality=94,method=4,exact=True)
    with Image.open(stage) as final:
        assert final.size == (735,735) and final.mode == 'RGBA'
        corners = [final.getpixel(p)[3] for p in [(0,0),(734,0),(0,734),(734,734)]]
        assert corners == [0,0,0,0], f"Opaque corner: {item['id']}"
        corner_max = [final.getchannel('A').crop(box).getextrema()[1] for box in [(0,0,32,32),(703,0,735,32),(0,703,32,735),(703,703,735,735)]]
        assert max(corner_max)<=1, f"Visible corner alpha noise: {item['id']}"
        alpha = list(final.getchannel('A').getextrema())
    os.replace(stage,output)
    item['qa']={'size':[735,735],'mode':'RGBA','cornerAlpha':corners,'corner32pxMaxAlpha':corner_max,'corner32pxClear':max(corner_max)==0,'alphaExtrema':alpha,'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
stage_manifest=manifest_path.with_suffix('.json.part')
stage_manifest.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
os.replace(stage_manifest,manifest_path)
print(json.dumps({'status':'PASS','count':len(manifest['items']),'bytes':sum(x['qa']['bytes'] for x in manifest['items'])}))
if '--sheet' in sys.argv:
    out=Path('D:/Codex_QA/launcher-shop-r58/art')
    out.mkdir(parents=True,exist_ok=True)
    n=len(manifest['items']);w=250;h=280
    sheet=Image.new('RGB',(5*w,((n+4)//5)*h),(24,33,43));draw=ImageDraw.Draw(sheet)
    font=ImageFont.truetype('C:/Windows/Fonts/msjh.ttc',15)
    for j,item in enumerate(manifest['items']):
        im=Image.open(root/item['output']).convert('RGBA');im.thumbnail((230,230),Image.Resampling.LANCZOS)
        x=(j%5)*w+10;y=(j//5)*h+8;sheet.paste(im,(x,y),im)
        draw.text((x,y+234),str(item['id'])+' '+item['name'],fill='white',font=font)
    path=out/'avatars-193-222.jpg';sheet.save(path,quality=94);print(path)
