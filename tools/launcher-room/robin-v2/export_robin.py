"""Export intact GPT Robin figures. Only alpha cleanup and uniform whole-image placement.

No head/limb manipulation, reflection, rotation, or nonuniform scale is supported.
Selected whole bodies and source ancestry stay in this versioned folder.
"""
import argparse, hashlib, importlib.util, json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

parser=argparse.ArgumentParser()
parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[3])
parser.add_argument('--legacy-root',type=Path)
args=parser.parse_args();root=args.root.resolve();base=root/'tools/launcher-room/robin-v2'
legacy_path=(args.legacy_root or root)/'tools/launcher-room/import_fullbody_v3.py'
spec=importlib.util.spec_from_file_location('wholebody',legacy_path);legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
digest=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
ref=lambda p:{'path':Path(p).relative_to(root).as_posix(),'sha256':digest(p)}
sources={}; extracted={}; items=[]; preview=[]
for name,cols,rows in [('south-01',4,2),('east-01',4,2),('west-01',4,2),('north-01',4,2),('work-01',2,4),('read-01',2,4),('utility-01',4,2),('walk-side-02',2,2)]:
    folder=base/'sources'/name;image=Image.open(folder/'source.png').convert('RGBA');alpha=np.array(image)[:,:,3]
    count,labels,stats,_=cv2.connectedComponentsWithStats((alpha>128).astype('uint8'),connectivity=8)
    components=[(i,*map(int,stats[i])) for i in range(1,count) if stats[i,cv2.CC_STAT_AREA]>1500]
    assert len(components)==cols*rows,(name,'complete figures',len(components))
    grouped={row:[] for row in range(rows)}
    for component in components:
        _,x,y,w,h,area=component;row=min(rows-1,int((y+h/2)/(image.height/rows)));grouped[row].append(component)
    sources[name]={'image':ref(folder/'source.png'),'prompt':ref(folder/'prompt.txt'),'receipt':ref(folder/'receipt.json'),'grid':[cols,rows]}
    for row,parts in grouped.items():
        parts.sort(key=lambda p:p[1]);assert len(parts)==cols,(name,row,len(parts))
        for col,(i,x,y,w,h,area) in enumerate(parts):
            sy,sx=np.argwhere(labels==i)[area//2];pad=12;x0=max(0,x-pad);y0=max(0,y-pad);x1=min(image.width,x+w+pad);y1=min(image.height,y+h+pad)
            selection={'key':'robin','direction':'source','pose':name+'-'+str(row)+'-'+str(col),'region':[x0,y0,x1-x0,y1-y0],'componentSeed':[int(sx),int(sy)]}
            value=legacy.extract_frame(selection,image);value['selection']=selection;value['sourceName']=name;value['row']=row;value['col']=col;extracted[name,row,col]=value

def get(name,row,col):return extracted[name,row,col]
def height(value):return value['opaqueBounds'][3]
def emit(name,cell,frames,scales):
    atlas=Image.new('RGBA',(cell*len(frames),cell));records=[]
    for index,(value,scale) in enumerate(zip(frames,scales)):
        # Standing/root is the original head axis; sitting/sleeping remains smaller
        # and uses the center of the whole connected body's ground footprint.
        frame,transform=legacy.render_one(value,scale,cell)
        bounds=legacy.pixel_bounds(frame);assert bounds and min(bounds[:2])>0 and max(bounds[2:])<cell,(name,index,bounds)
        atlas.paste(frame,(cell*index,0));records.append({'index':index,'source':value['sourceName'],'sourceCell':[value['col'],value['row']],'region':value['selection']['region'],'sourceAnchor':value['sourceAnchor'],'sourceAlphaBounds':value['sourceAlphaBounds'],'removedDistantAlphaPixels':value['removedDistantAlphaPixels'],'bounds':bounds,'wholeFigureScale':scale,'inverseWholeImageTransform':transform,'rgbaSha256':hashlib.sha256(frame.tobytes()).hexdigest(),'anatomyReassembled':False,'mirrored':False})
    asset=root/'public/images/launcher_room/robin_v2'/name;asset.parent.mkdir(parents=True,exist_ok=True);assert not asset.exists(),str(asset);atlas.save(asset,'WEBP',lossless=True,method=6)
    bindings=[]
    for source_name in dict.fromkeys(v['sourceName'] for v in frames):bindings.extend(sources[source_name].get(k) for k in ['image','prompt','receipt'])
    bindings.extend(ref(base/'sources/master-03'/k) for k in ['source.png','prompt.txt','receipt.json'])
    items.append({'asset':asset.relative_to(root).as_posix(),'sha256':digest(asset),'bytes':asset.stat().st_size,'cell':cell,'frames':len(frames),'dimensions':list(atlas.size),'root':[cell/2,cell*112/128],'sourceBindings':bindings,'frameRecords':records})
    preview.append((name,atlas))

directions=['east','west','north','south'];poseNames=['idle','talk_happy','talk_annoyed','surprised','focused_use','sit','wave','listen']
for di,direction in enumerate(directions):
    sheet=direction+'-01';neutral=get(sheet,0,1);scale=98/height(neutral)
    walk=[get(sheet,0,0),neutral,get(sheet,0,2),neutral];walk_scales=[scale]*4
    if direction in ['east','west']:
        row=0 if direction=='east' else 1;a=get('walk-side-02',row,0);c=get('walk-side-02',row,1);walk_scale=98/max(height(a),height(c));walk=[a,neutral,c,neutral];walk_scales=[walk_scale,scale,walk_scale,scale]
    emit('walk/'+direction+'.webp',384,walk,walk_scales)
    work=[get('work-01',di,c) for c in [0,1]];work_scale=98/max(map(height,work))
    acting=[neutral,get(sheet,0,3),get(sheet,1,0),get(sheet,1,1),work[0],get(sheet,1,3),get(sheet,1,2),neutral]
    emit('acting/'+direction+'.webp',256,acting,[scale,scale,scale,scale,work_scale,scale,scale,scale])
    for action in ['work','read']:
        pair=[get(action+'-01',di,c) for c in [0,1]];s=98/max(map(height,pair));emit('life/'+action+'-'+direction+'.webp',256,[pair[0],pair[1],pair[0],pair[1]],[s]*4)
neutral=get('south-01',0,1);emit('portrait.webp',256,[neutral],[98/height(neutral)])
utility_scale=98/max(height(get('utility-01',0,c)) for c in [0,1])
for action,row,columns in [('eat',0,[0,1]),('rest',0,[2,3]),('sleep',1,[0,1]),('train',1,[2,3])]:
    pair=[get('utility-01',row,c) for c in columns];scale=98/max(map(height,pair)) if action=='train' else utility_scale
    if action in ['rest','sleep']:
        for value in pair:
            # Ground-centered translation of the ENTIRE bent/reclining figure.
            value['localAnchor'][0]=value['image'].width/2
            value['sourceAnchor'][0]=value['sourceAlphaBounds'][0]+value['image'].width/2
    emit('life/'+action+'-south.webp',256,[pair[0],pair[1],pair[0],pair[1]],[scale]*4)
assert len(items)==21
manifest={'schema':'one-piece-robin-redraw/2','status':'PASS','anatomyReassembled':False,'mirrored':False,'logicalCell':128,'standingHeight':98,'displayScale':1.03,'sources':sources,'items':items,'exporter':ref(Path(__file__)),'alphaProcessor':{'path':'tools/launcher-room/import_fullbody_v3.py','sha256':digest(legacy_path)},'notes':['Whole-figure connected alpha and 2px antialias extraction removes distant transparent matte.','New side contacts explicitly alternate near/far leg and arm; neutral is reused between contacts.','Work/read/eat/rest/sleep/train are two authored whole-body keyposes in ABAB loops. No interpolated anatomy.','Listen reuses calm neutral. Focused-use reuses the complete authored work pose.','Historical art is unchanged. Source-generated gamma/alpha and every input are preserved.'],'humanAcceptance':False}
(base/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
# White preview is evidence, never used as runtime art.
contact=Image.new('RGB',(1100,len(preview)*150),'white');draw=ImageDraw.Draw(contact)
for i,(name,atlas) in enumerate(preview):
    draw.text((8,i*150+5),name,fill='black');small=atlas.copy();small.thumbnail((1024,128));contact.paste(small,(65,i*150+20),small)
contact.save(base/'atlas-contact-white.png')
print(json.dumps({'status':'PASS','assets':len(items),'frames':sum(i['frames']for i in items),'bytes':sum(i['bytes']for i in items),'manifest':str(base/'manifest.json')}))
