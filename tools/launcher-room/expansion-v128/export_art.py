"""Derive runtime art from retained GPT originals, preserving complete objects."""
from pathlib import Path
import json,hashlib,shutil
import cv2,numpy as np
from PIL import Image,ImageChops,ImageDraw
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def proof(path):return dict(path=path.relative_to(ROOT).as_posix(),sha256=sha(path),bytes=path.stat().st_size)

def complete_views(im,key):
 """Separate whole silhouettes by their centroid, never by a sheet-midpoint cut."""
 pixels=np.asarray(im).copy();solid=(pixels[:,:,3]>=5).astype(np.uint8)
 count,labels,stats,centroids=cv2.connectedComponentsWithStats(solid,connectivity=8)
 assert count>4,f'{key}: fewer than four objects'
 threshold=max(1000,int(max(stats[1:,cv2.CC_STAT_AREA])*.08))
 substantial=[i for i in range(1,count) if stats[i,cv2.CC_STAT_AREA]>=threshold]
 assert len(substantial)==4,f'{key}: expected four isolated substantial objects, got {len(substantial)}'
 views=[None]*4;records=[None]*4;half=im.width/2
 for label in substantial:
  cx,cy=centroids[label];rotation=int(cx>=half)+2*int(cy>=half)
  assert views[rotation] is None,f'{key}: two objects in quadrant {rotation}'
  # Keep the original antialiased pixels around the component. Only distant
  # transparent-canvas dust is removed; no drawing, inpainting or body assembly.
  keep=cv2.dilate((labels==label).astype(np.uint8),np.ones((5,5),np.uint8))
  isolated=pixels.copy();isolated[:,:,3]*=keep
  view=Image.fromarray(isolated,'RGBA');bound=view.getchannel('A').point(lambda n:255 if n>=5 else 0).getbbox()
  assert bound and bound[0]>2 and bound[1]>2 and bound[2]<im.width-2 and bound[3]<im.height-2,f'{key}/{rotation}: actual source-edge clipping'
  assert bound[2]-bound[0]>150 and bound[3]-bound[1]>150,f'{key}/{rotation}: incomplete object'
  views[rotation]=view
  records[rotation]=dict(rotation=rotation,sourceBounds=list(bound),centroid=[round(float(cx),3),round(float(cy),3)],componentArea=int(stats[label,cv2.CC_STAT_AREA]),crossesVerticalMidpoint=bound[0]<half<bound[2],crossesHorizontalMidpoint=bound[1]<half<bound[3])
 assert all(v is not None for v in views),f'{key}: missing view'
 return views,records
def main():
 manifests=[p for p in [HERE/'scene-generation.json',HERE/'furniture-generation.json'] if p.exists()]
 items=[];sources=[];extractions=[];furniture_outputs=[]
 for manifest in manifests:
  for entry in json.loads(manifest.read_text(encoding='utf8')):
   key=entry['key'];folder=HERE/'sources'/key
   revision=entry.get('revision',1);assert isinstance(revision,int) and 1<=revision<=20,'Invalid source revision'
   if revision>1:folder=folder/f'attempt-{revision}'
   folder.mkdir(parents=True,exist_ok=True)
   original=folder/'original.png';external=Path(entry['source'])
   if original.exists():assert sha(original)==sha(external),'Original was changed'
   else:shutil.copy2(external,original)
   prompt=folder/'prompt.txt';receipt=folder/'receipt.json'
   if not prompt.exists():prompt.write_text(entry['prompt'],encoding='utf8')
   if not receipt.exists():receipt.write_text(json.dumps(entry,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
   source=dict(key=key,kind=entry['kind'],image=proof(original),prompt=proof(prompt),receipt=proof(receipt));sources.append(source)
   im=Image.open(original).convert('RGBA')
   if entry['kind']=='scene':
    target=ROOT/'public/images/launcher_room/scenes'/f'{key}.webp';target.parent.mkdir(parents=True,exist_ok=True)
    im=im.convert('RGB').resize((1600,900),Image.Resampling.LANCZOS);im.save(target,'WEBP',quality=90,method=6)
    items.append(dict(**proof(target),width=1600,height=900,alpha=False,source=key))
   else:
    assert im.width==im.height and im.width>=1024 and im.width%2==0
    assert im.getchannel('A').getextrema()[0]==0,'Real transparent output required'
    views,extraction=complete_views(im,key);extractions.append(dict(key=key,method='whole connected silhouettes; centroid assigns rotation',views=extraction))
    bounds=[v.getchannel('A').point(lambda n:255 if n>=5 else 0).getbbox() for v in views]
    assert all(bounds),'Missing object'
    scale=min(360/max(b[2]-b[0] for b in bounds),360/max(b[3]-b[1] for b in bounds))
    outputs=[]
    for i,(view,b) in enumerate(zip(views,bounds)):
     cut=view.crop(b);size=(round(cut.width*scale),round(cut.height*scale));out=Image.new('RGBA',(384,384))
     out.alpha_composite(cut.resize(size,Image.Resampling.LANCZOS),((384-size[0])//2,372-size[1]));outputs.append(out)
     target=ROOT/'public/images/launcher_room/furniture_views'/key/f'{i}.webp';target.parent.mkdir(parents=True,exist_ok=True);out.save(target,'WEBP',lossless=True,method=6)
     items.append(dict(**proof(target),width=384,height=384,alpha=True,source=key,rotation=i,uniformScale=scale,groundRoot=[192,372]))
    for i in range(4):
     for j in range(i):assert ImageChops.difference(outputs[i],outputs[j]).getbbox(),'Repeated view'
    furniture_outputs.append((key,outputs))
    thumb=ROOT/'public/images/launcher_room/furniture'/f'{key}.webp';thumb.parent.mkdir(parents=True,exist_ok=True);outputs[0].save(thumb,'WEBP',lossless=True,method=6)
    items.append(dict(**proof(thumb),width=384,height=384,alpha=True,source=key,thumbnail=True))
 contacts=[]
 if furniture_outputs:
  cell=256;rowheight=284;sheet=Image.new('RGB',(4*cell,len(furniture_outputs)*rowheight),(255,255,255));draw=ImageDraw.Draw(sheet)
  for row,(key,outputs) in enumerate(furniture_outputs):
   for rotation,view in enumerate(outputs):
    base=Image.new('RGBA',(cell,cell),(255,255,255,255));base.alpha_composite(view.resize((cell,cell),Image.Resampling.LANCZOS));sheet.paste(base.convert('RGB'),(rotation*cell,row*rowheight));draw.text((rotation*cell+8,row*rowheight+cell+3),f'{key} / {rotation}',fill=(25,35,40))
  contact=HERE/'furniture-contact-white.png';sheet.save(contact);contacts.append(proof(contact))
 report=dict(schema='launcher-room-expansion-gpt-art/1',tool='built-in image_gen',humanAcceptance=False,sources=sources,assets=items,extractions=extractions,contactSheets=contacts,exporter=proof(Path(__file__)))
 (HERE/'art-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print(json.dumps(dict(sources=len(sources),assets=len(items))))
if __name__=='__main__':main()
