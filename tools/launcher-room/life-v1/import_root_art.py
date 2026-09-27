"""Explicit reviewed whole-figure crops, immutable originals and provenance."""
from pathlib import Path
import json, hashlib, subprocess, sys
from PIL import Image

BASE=Path(__file__).resolve().parent
ROOT=BASE.parents[2]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()

def prepare(name, rows, xs, scales, directional=False):
    folder=BASE/name
    key=name.split('-')[0]
    source=folder/('source-alpha-clean.png' if name=='jinbe-utility' else 'source.png')
    im=Image.open(source).convert('RGBA')
    action=name.split('-')[1]
    clips=[]
    for index,(y0,y1) in enumerate(rows):
        clip=action if directional else ['eat','rest','sleep','train'][index]
        direction=['east','west','north','south'][index] if directional else 'south'
        regions=[[xs[i],y0,xs[i+1],y1] for i in range(4)]
        roots=[]
        for x0,ya,x1,yb in regions:
            frame=im.crop((x0,ya,x1,yb)); a=frame.getchannel('A').point(lambda v:255 if v>128 else 0)
            bounds=a.getbbox()
            # Stable feet anchor for standing poses. Sitting/sleeping anchor centre of entire figure.
            if directional or clip=='train':
                foot=a.crop((0,max(0,bounds[3]-8),frame.width,bounds[3])).getbbox()
                rx=(foot[0]+foot[2])/2+x0
            else: rx=(bounds[0]+bounds[2])/2+x0
            roots.append([rx,ya+bounds[3]])
        clips.append({'id':f'{key}-{clip}-{direction}','key':key,'direction':direction,'source':source.relative_to(ROOT).as_posix(),
                      'asset':f'public/images/launcher_room/life_v1/{key}/{clip}-{direction}.webp',
                      'regions':regions,'roots':roots,'scale':scales[index]})
    plan=folder/'plan.json'; plan.write_text(json.dumps({'clips':clips},indent=2)+'\n',encoding='utf-8')
    subprocess.run([sys.executable,str(BASE/'import_clips.py'),str(plan),'--root',str(ROOT)],check=True)
    contact=Image.new('RGBA',(512,512),(35,42,51,255))
    records=json.loads((folder/'plan-import.json').read_text())['clips']
    for i,record in enumerate(records): contact.alpha_composite(Image.open(ROOT/record['asset']),(0,i*128))
    contact.save(folder/'contact-128.png')
    (folder/'receipt.json').write_text(json.dumps({'generator':'gpt-image','sourceSha256':sha(source),'promptSha256':sha(folder/'prompt.txt'),
        'sourceReviewed':True,'runtimeAccepted':False,'wholeFigureOnly':True,
        'assets':[{k:r[k] for k in ['asset','assetSha256']} for r in records]},indent=2)+'\n',encoding='utf-8')

prepare('brook-utility',[(0,353),(353,662),(662,830),(830,1199)],[0,328,656,984,1312],[.29]*4)
prepare('jinbe-utility',[(0,279),(279,535),(535,694),(694,1024)],[0,384,768,1152,1536],[.3565,.31,.31,.31])
prepare('sanji-cook',[(0,318),(318,637),(637,950),(950,1287)],[0,305,610,916,1222],[.313]*4,True)
prepare('jinbe-helm',[(0,311),(311,623),(623,911),(911,1254)],[0,313,627,940,1254],[.315]*4,True)

# Furniture uses the same 384px canvas and grounded root as existing four-view pieces.
folder=BASE/'galley-stove'; source=folder/'source.png'; im=Image.open(source).convert('RGBA')
regions=[[0,0,768,533],[768,0,1536,533],[0,533,768,1024],[768,533,1536,1024]]
records=[]; contact=Image.new('RGBA',(768,768),(35,42,51,255))
for index,region in enumerate(regions):
    cell=im.crop(region); bounds=cell.getchannel('A').getbbox(); crop=cell.crop(bounds)
    # Equal source-camera physical scale, no independent width/height deformation.
    scaled=crop.resize((round(crop.width*.495),round(crop.height*.495)),Image.Resampling.LANCZOS)
    atlas=Image.new('RGBA',(384,384)); atlas.alpha_composite(scaled,(192-scaled.width//2,372-scaled.height))
    asset=ROOT/f'public/images/launcher_room/furniture_views/galley-stove/{index}.webp';asset.parent.mkdir(parents=True,exist_ok=True)
    atlas.save(asset,'WEBP',lossless=True,exact=True);contact.alpha_composite(atlas,((index%2)*384,(index//2)*384))
    records.append({'asset':asset.relative_to(ROOT).as_posix(),'assetSha256':sha(asset),'sourceRegion':region,'sourceBounds':list(bounds),'scale':.495})
preview=ROOT/'public/images/launcher_room/furniture/galley-stove.webp'; Image.open(ROOT/records[0]['asset']).save(preview,'WEBP',lossless=True,exact=True)
records.append({'asset':preview.relative_to(ROOT).as_posix(),'assetSha256':sha(preview)})
contact.save(folder/'contact-384.png')
(folder/'receipt.json').write_text(json.dumps({'generator':'gpt-image','sourceSha256':sha(source),'promptSha256':sha(folder/'prompt.txt'),
   'sourceReviewed':True,'runtimeAccepted':False,'groundRoot':[192,372],'assets':records},indent=2)+'\n',encoding='utf-8')
