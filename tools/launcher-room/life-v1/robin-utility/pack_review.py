"""Task-local whole-figure packaging: alpha speck cleanup, crop, uniform scale only.
No anatomy construction, morphing, rotation or direction mirroring.
"""
from pathlib import Path
import hashlib,json,statistics,subprocess,sys
from PIL import Image,ImageDraw,ImageFilter,ImageChops

ROOT=Path(__file__).resolve().parents[4]
BASE=ROOT/'tools/launcher-room/life-v1'
GEN=Path(r'C:\Users\王曜瑋\.codex\generated_images\01a0df5a-f51d-7f40-8213-929b1e8bec76')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p):return p.relative_to(ROOT).as_posix()
def savej(p,obj):p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
refs={
 'robin':ROOT/'tools/launcher-room/fullbody-v3/sources/robin-actions-source-01/image.png',
 'chopper':ROOT/'tools/launcher-room/fullbody-v3/sources/chopper-actions-01/image.png'}
generated={
 'chopper-utility':('exec-524bbeb0-2dee-4f6f-b45c-fea5857ae2ec.png',[0,340,657,905,1254]),
 'robin-utility':('exec-71a74745-86e9-4ce3-bb00-8f6dfb374492.png',[0,414,737,908,1254]),
 'chopper-work':('exec-ed2c7a48-ff56-4caa-a4d0-0077e6a03013.png',[0,323,631,926,1254]),
 'robin-work':('exec-69e86e64-f427-4e06-8222-1a203c47ee2a.png',[0,321,633,938,1254]),
 'chopper-read':('exec-2c901e95-f362-40ca-ba98-7f791a5c6a11.png',[0,319,629,934,1254]),
 'robin-read':('exec-05ebbe61-7977-4232-9bf0-419f7ae05ee4.png',[0,323,636,945,1254]),
 'chopper-medicine':('exec-8e7a632c-79c6-4780-80cb-0952a77f36e3.png',[0,326,641,930,1254])}
fixes=[
 ('robin-utility','rest-fix','exec-75ccd6fa-278e-4754-8662-1bab3c54e177.png',[refs['robin']]),
 ('robin-utility','train-fix-rejected','exec-1c284a8d-41d9-410e-be0e-fad29552269f.png',[BASE/'robin-utility/train-reference.png']),
 ('robin-utility','train-correct','exec-6dac48c5-e668-4028-a3c9-8b6db619671c.png',[BASE/'robin-utility/train-reference.png']),
 ('chopper-work','east-fix','exec-fa127535-50c0-4794-8274-af7e62981ebe.png',[ROOT/'tools/launcher-room/fullbody-v3/sources/chopper-actions-02/image.png'])]

def clean(path):
 im=Image.open(path).convert('RGBA');alpha=im.getchannel('A')
 assert alpha.getextrema()==(0,255),'Genuine tool alpha required'
 # Remove detached generation specks while retaining the drawn figure and its AA edge.
 width,height=im.size;mask=bytearray(alpha.point(lambda a:1 if a>=64 else 0).tobytes());kept=bytearray(width*height)
 for start in range(len(mask)):
  if not mask[start]:continue
  mask[start]=0;todo=[start];component=[]
  while todo:
   at=todo.pop();component.append(at);x=at%width
   for near in ((at-1 if x else -1),(at+1 if x+1<width else -1),at-width,at+width):
    if 0<=near<len(mask)and mask[near]:mask[near]=0;todo.append(near)
  if len(component)>=32:
   for at in component:kept[at]=255
 support=Image.frombytes('L',im.size,bytes(kept)).filter(ImageFilter.MaxFilter(5))
 im.putalpha(ImageChops.multiply(alpha.point(lambda a:a if a>=16 else 0),support))
 output=path.with_stem(path.stem+'-alpha')
 im.save(output)
 return output

def provenance(folder,source,prompt,generatedfile,references,review):
 receipt=folder/(source.stem.replace('-source','')+'-receipt.json' if source.name!='source.png' else 'receipt.json')
 savej(receipt,{'generator':'image_gen.imagegen','mode':'built-in','generatedFile':str(GEN/generatedfile),
   'source':{'path':rel(source),'sha256':sha(source)},'prompt':{'path':rel(prompt),'sha256':sha(prompt)},
   'references':[{'path':rel(p),'sha256':sha(p),'role':'approved whole-character identity and style'}for p in references],
   'review':review,'runtimeAccepted':False,'processing':'Keep original RGBA; separate alpha copy removes alpha<16 and isolated <32px opaque specks, retaining 2px AA edge. Crop whole figures and uniform scale only.'})
 return receipt

plans={}
receipts={}
for group,(gen,rows) in generated.items():
 key,kind=group.split('-',1);folder=BASE/group;source=folder/'source.png'
 review='Reviewed complete connected body, head/body same facing, correct outfit, four chronological poses per row. Runtime test pending.'
 if group=='robin-utility':review+=' Original rest row rejected: knees switch sides; original train row rejected: shortened body. Use complete-figure replacement strips.'
 if group in ['chopper-work','chopper-read']:review+=' Original EAST row rejected: collar on anatomical right antler; replaced by corrected complete EAST figures.'
 reference=[refs[key]]
 if group=='chopper-medicine':reference+=[BASE/'chopper-work/east-fix-source.png']
 receipts[group]=provenance(folder,source,folder/'prompt.txt',gen,reference,review)
 clean(source);plans[group]={'clips':[]}
for group,name,gen,reference in fixes:
 folder=BASE/group;source=folder/(name+'-source.png')
 if name=='train-fix-rejected':source=folder/'train-fix-rejected-source.png'
 prompt=folder/(('train-fix' if name=='train-fix-rejected' else name)+'-prompt.txt')
 review='Rejected: realistic tall adult proportion; never selected.' if 'rejected' in name else 'Whole-figure replacement reviewed. Legs stay on same side for rest; no near-side collar for Chopper east; compact 3-head proportion for corrected train.'
 receipts[name]=provenance(folder,source,prompt,gen,reference,review)
 if 'rejected' not in name:clean(source)

def add(group,action,direction,source,row,scale=None):
 key=group.split('-')[0];im=Image.open(source).convert('RGBA');width,height=im.size
 cols=[round(i*width/4)for i in range(5)]
 if source.name=='rest-fix-source-alpha.png':cols=[0,443,886,1280,width] # Actual empty gutter; figure4's boot begins before nominal 3/4 grid.
 regions=[[cols[i],row[0],cols[i+1],row[1]]for i in range(4)]
 bounds=[im.crop(r).getchannel('A').getbbox()for r in regions]
 heights=[b[3]-b[1]for b in bounds]
 if scale is None:scale=98/max(heights)
 roots=[]
 for r,b in zip(regions,bounds):
  frame=im.crop(r)
  # Plant standing loops by their feet, not prop extents. Sleep centres its full silhouette.
  if action=='rest':rootx=(b[0]+b[2])/2+(6/scale if key=='robin' else 0)
  elif action=='sleep':rootx=(b[0]+b[2])/2
  else:
   strip=frame.crop((0,max(0,b[3]-12),frame.width,b[3])).getchannel('A').point(lambda a:255 if a>=64 else 0)
   feet=strip.getbbox();rootx=(feet[0]+feet[2])/2 if feet else frame.width/2
  roots.append([round(r[0]+rootx,2),row[1]])
 clips=plans[group]['clips']
 clips.append({'id':action,'key':key,'direction':direction,'source':rel(source),'scale':scale,'regions':regions,'roots':roots,
   'asset':f'public/images/launcher_room/life_v1/{key}/{action}-{direction}.webp',
   'normalization':'One uniform scale for all four complete figures. Standing height matched accepted idle (98px); rest/sleep use same head/anatomical size, naturally lower.',
   'alphaCleanup':'Alpha<16 and detached opaque islands smaller than32px removed; all larger figures/props and2px AA edge retained. No RGB redraw or anatomy transform.',
   'originalSource':rel(source).replace('-alpha.png','.png')})
 return scale

for group,(gen,rows) in generated.items():
 key,kind=group.split('-',1);source=BASE/group/'source-alpha.png'
 if kind=='utility':
  common=add(group,'eat','south',source,rows[:2])
  if key=='chopper':
   for i,a in enumerate(['rest','sleep','train'],1):add(group,a,'south',source,rows[i:i+2],common)
  else:
   rest=BASE/group/'rest-fix-source-alpha.png';add(group,'rest','south',rest,[0,Image.open(rest).height],.145)
   add(group,'sleep','south',source,rows[2:4],common)
   train=BASE/group/'train-correct-source-alpha.png';add(group,'train','south',train,[0,Image.open(train).height])
 else:
  for i,direction in enumerate(['east','west','north','south']):
   if key=='chopper' and direction=='east' and kind in ['work','read']:
    source2=BASE/'chopper-work/east-fix-source-alpha.png';h=Image.open(source2).height;half=round(h/2)
    add(group,kind,direction,source2,[0,half]if kind=='work'else[half,h])
   else:add(group,kind,direction,source,rows[i:i+2])

for group,plan in plans.items():
 planpath=BASE/group/'plan.json';savej(planpath,plan)
 subprocess.run([sys.executable,str(BASE/'import_clips.py'),str(planpath),'--root',str(ROOT)],check=True)

for key in ['chopper','robin']:
 groups=[p for name,p in plans.items()if name.startswith(key+'-')]
 clips=[c for p in groups for c in p['clips']]
 sheet=Image.new('RGB',(768,148*len(clips)),(37,45,53));draw=ImageDraw.Draw(sheet)
 reports=[];gifframes=[]
 for row,c in enumerate(clips):
  atlas=Image.open(ROOT/c['asset']).convert('RGBA');old=Image.open(ROOT/f'public/images/launcher_room/acting_v3/{key}/{c["direction"]}.webp').crop((0,0,128,128))
  draw.text((4,row*148+3),f'{key} {c["id"]} {c["direction"]}: old idle | frames 0 1 2 3',fill='white')
  sheet.paste(old,(0,row*148+20),old)
  bboxes=[];digests=[]
  for i in range(4):
   fr=atlas.crop((i*128,0,(i+1)*128,128));sheet.paste(fr,(128+i*128,row*148+20),fr)
   bb=fr.getchannel('A').point(lambda a:255 if a>16 else 0).getbbox();bboxes.append(bb)
   digests.append(hashlib.sha256(fr.tobytes()).hexdigest())
   assert bb and 0<bb[0]<bb[2]<128 and 0<bb[1]<bb[3]<=113,(c['asset'],i,bb)
  reports.append({'id':c['id'],'direction':c['direction'],'asset':c['asset'],'sha256':sha(ROOT/c['asset']),
     'frameBounds':bboxes,'distinctFrames':len(set(digests)),'scale':c['scale'],'visualAcceptance':False})
  assert len(set(digests))==4,'Distinct complete time frames required'
 sheet.save(BASE/(key+'-utility')/'contact-128.png')
 for phase in range(4):
  frame=Image.new('RGB',(128*4,148*4),(37,45,53));dd=ImageDraw.Draw(frame)
  chosen=[c for c in clips if c['id']in ['work','read','medicine']]+[c for c in clips if c['id']in ['eat','train','rest','sleep']]
  for i,c in enumerate(chosen[:16]):
   x=(i%4)*128;y=(i//4)*148;dd.text((x+2,y+2),c['id']+' '+c['direction'],fill='white')
   a=Image.open(ROOT/c['asset']).convert('RGBA');p=a.crop((phase*128,0,(phase+1)*128,128));frame.paste(p,(x,y+20),p)
  gifframes.append(frame)
 gifframes[0].save(BASE/(key+'-utility')/'motion-review.gif',save_all=True,append_images=gifframes[1:],duration=400,loop=0)
 savej(BASE/(key+'-utility')/'atlas-review.json',{'key':key,'status':'IMPORTED_AWAITING_CONTACT_REVIEW','clips':reports,'runtimeAccepted':False})
 print(key,len(clips),'clips imported')
