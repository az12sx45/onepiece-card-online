"""Bind the independently completed review to exact runtime/source/delivery bytes."""
from pathlib import Path
from PIL import Image
import hashlib,json,subprocess
ROOT=Path(__file__).resolve().parents[3]
BASE=ROOT/'tools/launcher-room/life-v1'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def relative(p):return p.relative_to(ROOT).as_posix()
review=BASE/'final-visual-review.json'
proof=json.loads(review.read_text(encoding='utf-8-sig'))
assert proof['status']=='PASS_WITH_NOTES' and not proof['blockingIssues'],'Review must be completed first'
expected=json.loads(subprocess.check_output(['node','-e',"console.log(JSON.stringify(require('./desktop/launcher-life-actions').assets()))"],cwd=ROOT,text=True))
items=[]
for name in expected:
 p=ROOT/'public/images/launcher_room/life_v1'/name
 im=Image.open(p).convert('RGBA');assert im.size==(512,128)
 frames=[im.crop((i*128,0,(i+1)*128,128)) for i in range(4)]
 assert len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames})==4,f'Nonanimated loop {name}'
 assert all(f.getchannel('A').getextrema()[0]==0 for f in frames)
 bounds=[f.getchannel('A').point(lambda a:255 if a>32 else 0).getbbox() for f in frames]
 assert all(b and b[0]>0 and b[1]>0 and b[2]<128 and b[3]<=113 for b in bounds),f'Clipped {name}: {bounds}'
 items.append({'asset':relative(p),'assetSha256':sha(p),'assetBytes':p.stat().st_size,'assetPixels':[512,128],'distinctFrames':4,'alpha':True,'clipped':False,'frameBounds':bounds})
for name in ['furniture/galley-stove.webp']+[f'furniture_views/galley-stove/{i}.webp' for i in range(4)]:
 p=ROOT/'public/images/launcher_room'/name;im=Image.open(p);assert im.size==(384,384)
 items.append({'asset':relative(p),'assetSha256':sha(p),'assetBytes':p.stat().st_size,'assetPixels':[384,384]})
dependencies=[{'path':relative(p),'sha256':sha(p)} for p in sorted(BASE.rglob('*')) if p.is_file() and '__pycache__' not in p.parts]
manifest={'schema':'launcher-life-art/1','version':'1.2.0','generator':'OpenAI built-in image_gen','canonicalCharactersOnly':True,'anatomyReassembled':False,'mirrored':False,
          'shape':{'cell':128,'columns':4,'rows':1,'frames':4,'root':[64,112]},'review':relative(review),'items':items,'dependencies':dependencies}
(ROOT/'docs/LAUNCHER_LIFE_ART_20260927.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'items':len(items),'sourcesAndEvidence':len(dependencies),'runtimeAtlases':len(expected)},ensure_ascii=False))
