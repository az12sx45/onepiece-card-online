from PIL import Image
from pathlib import Path
import json, hashlib, subprocess, sys
root=Path(__file__).resolve().parents[4]
base=root/'tools/launcher-room/life-v1'
specs={
'luffy-utility':([0,398,741,921,1254],['eat','rest','sleep','train'],[.28,.28,.34,.32],'a0f0e707-4eec-4af4-81cc-f1e2d695c3d3'),
'zoro-utility':([0,431,755,928,1254],['eat','rest','sleep','train'],[.303,.303,.303,.303],'8cbb281e-6065-4443-9f42-89b706e1574b'),
'luffy-work':([0,316,627,909,1254],['east','west','north','south'],None,'3bced73c-c2ef-4044-8fcf-68aed15f04c2'),
'zoro-work':([0,321,632,934,1254],['east','west','north','south'],None,'3ff6af77-904c-4848-b404-b3d2396c2d5c')}
for name,(ys,ids,scales,generation) in specs.items():
 folder=base/name; im=Image.open(folder/'source.png').convert('RGBA')
 assert im.size==(1254,1254) and im.getchannel('A').getextrema()==(0,255)
 key=name.split('-')[0]; groups=[]
 for row,id in enumerate(ids):
  regions=[]; heights=[]
  for col in range(4):
   x0,x1=round(col*1254/4),round((col+1)*1254/4)
   crop=im.crop((x0,ys[row],x1,ys[row+1]))
   alpha=crop.getchannel('A'); solid=alpha.point(lambda a:255 if a>=32 else 0)
   box=solid.getbbox(); assert box
   heights.append(box[3]-box[1]+4)
   if id=='sleep': local_root=(box[0]+box[2])/2
   else:
    floor=solid.crop((0,max(box[1],box[3]-10),crop.width,box[3])).getbbox()
    local_root=(floor[0]+floor[2])/2
   ground=round(x0+local_root)
   half=max(ground-(x0+box[0]),x0+box[2]-ground)+2
   left,right=ground-half,ground+half
   top,bottom=max(0,ys[row]+box[1]-2),min(im.height,ys[row]+box[3]+2)
   assert 0<=left<right<=im.width
   regions.append([left,top,right,bottom])
  scale=scales[row] if scales else round(100/max(heights),6)
  action=id if scales else 'work'; direction='south' if scales else id
  groups.append({'id':action,'key':key,'direction':direction,'source':str((folder/'source.png').relative_to(root)).replace('\\','/'),'scale':scale,'regions':regions,'asset':f'public/images/launcher_room/life_v1/{key}/{action}-{direction}.webp'})
 (folder/'plan.json').write_text(json.dumps({'clips':groups},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 receipt={'generator':'image_gen.imagegen','mode':'built-in','generatedFile':f'C:/Users/王曜瑋/.codex/generated_images/01a0e0d1-a4bf-73f3-af41-6763cfefe2b5/exec-{generation}.png','reference':f'tools/launcher-room/fullbody-v3/sources/{key}/image.png','prompt':str((folder/'prompt.txt').relative_to(root)).replace('\\','/'),'sourceSha256':hashlib.sha256((folder/'source.png').read_bytes()).hexdigest(),'sourcePixels':list(im.size),'trueAlpha':True,'sourceReview':'Sixteen intact complete figures. Canonical early outfit preserved. '+('Zoro has two healthy eyes with no eye scar; sheathed swords, left-ear earrings and left-arm bandana checked.' if key=='zoro' else 'Luffy retains the straw hat, red vest, blue shorts, yellow sash and left-under-eye stitch; no chest X scar.')+' '+('Four-direction tray-and-cloth supply work, face and torso share direction, true back view.' if not scales else 'Distinct eating, cross-legged rest, grounded side sleep and controlled low training. No invisible chair, high walking step or detached anatomy.'),'packing':'One uniform scale per four-frame loop, whole-figure crop and root alignment only. Main figure bounds estimated at alpha32 with 2px source padding to exclude remote faint generated pixels; source alpha never modified. No limb splitting, mirroring or warping.','runtimeAccepted':False,'actualSizeReview':'pending contact review'}
 (folder/'receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 subprocess.run([sys.executable,str(base/'import_clips.py'),str(folder/'plan.json'),'--root',str(root)],check=True)
 contact=Image.new('RGB',(512,512),(31,46,52))
 for row,group in enumerate(groups):
  atlas=Image.open(root/group['asset']).convert('RGBA')
  contact.paste(atlas,(0,row*128),atlas)
 contact.save(folder/'contact-128.png')
 print(name,[(g['id'],g['direction'],g['scale']) for g in groups])
