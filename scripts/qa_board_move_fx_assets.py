"""Verify authored GPT raster atlases, transparency, provenance and contact sheets."""
import argparse, hashlib, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

p=argparse.ArgumentParser()
p.add_argument('--work',type=Path,required=True)
p.add_argument('--output',type=Path,required=True)
a=p.parse_args()
root=Path(__file__).resolve().parents[1]
data=json.loads((root/'scripts/data/board_move_fx_v1.json').read_text(encoding='utf-8-sig'))
a.output.mkdir(parents=True,exist_ok=True)
records=[]; failures=[]; thumbnails=[]
for name,family in data['families'].items():
    file=root/'public'/family['sheet']
    if not file.exists(): failures.append(f'{name}: missing file'); continue
    im=Image.open(file).convert('RGBA'); pixels=np.asarray(im); alpha=pixels[:,:,3]
    if im.size!=(2048,1024): failures.append(f'{name}: wrong dimensions {im.size}')
    frames=[]
    for i in range(8):
        tile=im.crop((i%4*512,i//4*512,i%4*512+512,i//4*512+512))
        mask=np.asarray(tile.getchannel('A'))
        edge=int(mask[:24,:].sum()+mask[-24:,:].sum()+mask[:,:24].sum()+mask[:,-24:].sum())
        visible=int((mask>16).sum())
        frames.append({'frame':i,'visiblePixels':visible,'transparentMargin':edge==0,'sha256':hashlib.sha256(tile.tobytes()).hexdigest()})
        if visible==0: failures.append(f'{name}/{i}: empty frame')
        if edge: failures.append(f'{name}/{i}: nontransparent atlas margin')
    if len({f['sha256'] for f in frames})!=8: failures.append(f'{name}: duplicate frames')
    meta_path=a.work/'raw'/f'{name}.meta.json'
    meta=json.loads(meta_path.read_text(encoding='utf-8-sig')) if meta_path.exists() else None
    if not meta: failures.append(f'{name}: missing generation provenance')
    report_path=a.work/'processed'/f'{name}.json'
    matte=json.loads(report_path.read_text(encoding='utf-8-sig')) if report_path.exists() else None
    if not matte: failures.append(f'{name}: missing local background-removal report')
    if matte and hashlib.sha256(file.read_bytes()).hexdigest()!=matte.get('outputSha256'):
        failures.append(f'{name}: installed image differs from local cutout report')
    if meta and matte:
        source=Path(meta.get('source',''))
        if not source.is_file(): failures.append(f'{name}: original GPT source missing')
        elif hashlib.sha256(source.read_bytes()).hexdigest()!=matte.get('sourceSha256'):
            failures.append(f'{name}: source provenance hash mismatch')
        if len(meta.get('prompt',''))<40: failures.append(f'{name}: generation prompt missing')
    record={'id':name,'sheet':family['sheet'],'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'alphaZeroFraction':float((alpha==0).mean()),'frames':frames,'generation':meta,'backgroundRemoval':matte}
    records.append(record)
    tile=im.crop((1536,0,2048,512)).resize((240,240),Image.Resampling.LANCZOS)
    card=Image.new('RGB',(256,280),'#15212c');card.paste(tile,(8,0),tile)
    ImageDraw.Draw(card).text((8,250),name,fill='white',font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',15))
    thumbnails.append(card)
for start in range(0,len(thumbnails),25):
    sheet=Image.new('RGB',(1280,1400),'#15212c')
    for index,tile in enumerate(thumbnails[start:start+25]):sheet.paste(tile,((index%5)*256,(index//5)*280))
    sheet.save(a.output/f'contact-sheet-{start//25+1}.jpg',quality=93)
report={'families':len(records),'expectedFamilies':len(data['families']),'frames':sum(len(r['frames'])for r in records),'bytes':sum(r['bytes']for r in records),'failures':failures,'assets':records}
(a.output/'asset-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:v for k,v in report.items()if k!='assets'},ensure_ascii=False))
raise SystemExit(bool(failures))
