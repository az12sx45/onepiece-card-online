"""Suggest one-time joints from GPT kit alpha. Output is DRAFT, never visual acceptance."""
import argparse, json, math, os
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

PROFILES = {
 'luffy': dict(head=255, neck=274, torso=174, hip=432, ground=600, arm=145, foot=75, stride=24, speed=26),
 'zoro': dict(head=244, neck=265, torso=172, hip=423, ground=600, arm=149, foot=81, stride=26, speed=27),
 'nami': dict(head=243, neck=266, torso=218, hip=432, ground=600, arm=148, foot=72, stride=23, speed=25),
 'usopp': dict(head=255, neck=272, torso=179, hip=434, ground=600, arm=150, foot=81, stride=25, speed=26),
 'sanji': dict(head=240, neck=267, torso=177, hip=428, ground=600, arm=153, foot=82, stride=27, speed=28),
 'chopper': dict(head=262, neck=292, torso=104, hip=375, ground=475, arm=86, foot=49, stride=17, speed=21),
 'robin': dict(head=254, neck=276, torso=218, hip=439, ground=600, arm=148, foot=76, stride=24, speed=25),
 'franky': dict(head=212, neck=248, torso=217, hip=446, ground=600, arm=260, foot=102, stride=25, speed=26),
 'brook': dict(head=265, neck=287, torso=143, hip=413, ground=600, arm=151, foot=88, stride=28, speed=27),
 'jinbe': dict(head=222, neck=250, torso=321, hip=435, ground=600, arm=207, foot=111, stride=22, speed=23),
}

def main():
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('character',choices=PROFILES);p.add_argument('direction',choices=['east','west','north','south']);p.add_argument('output');p.add_argument('--update-heads',action='store_true');a=p.parse_args()
 source=Path(a.source).resolve();output=Path(a.output).resolve();im=Image.open(source).convert('RGBA');alpha=np.asarray(im)[:,:,3];binary=(alpha>64).astype(np.uint8)
 count, labels, stats, centers=cv2.connectedComponentsWithStats(binary,8);groups=[[] for _ in range(12)]
 for i in range(1,count):
  x,y,w,h,area=map(int,stats[i]);cx,cy=centers[i]
  if area<90:continue
  col=min(3,int(cx/im.width*4));row=min(2,int(cy/im.height*3));groups[row*4+col].append([x,y,x+w,y+h])
 boxes=[]
 for i,g in enumerate(groups):
  if not g:
   if i!=11:raise ValueError(f'Missing connected part in cell {i+1}')
   boxes.append(None);continue
  x0=max(0,min(v[0] for v in g)-2);y0=max(0,min(v[1] for v in g)-2);x1=min(im.width,max(v[2] for v in g)+2);y1=min(im.height,max(v[3] for v in g)+2)
  boxes.append([x0,y0,x1-x0,y1-y0])
 def center_at(b,f):
  x,y,w,h=b;yy=y+round(h*f);lo=max(y,yy-3);hi=min(y+h,yy+4);coords=np.nonzero(binary[lo:hi,x:x+w]);xx=float(coords[1].mean()+x) if coords[1].size else x+w/2
  return [round(xx,2),float(yy)]
 c=PROFILES[a.character];d=a.direction;side=d in ['east','west'];nearSign=-1 if d in ['east','south'] else 1
 spec={'schema':'one-piece-room-rig/1','character':a.character,'direction':d,'images':{'sheet':os.path.relpath(source,output.parent).replace('\\','/')},'canonicalSize':700,'canonicalRoot':[313,c['ground']],'output':{'cell':256,'root':[128,224],'canonicalScale':.35,'stageWidth':96},'gait':{'stride':c['stride']*(1 if side else .62),'speed':c['speed']*(1 if side else .62),'stance':.62,'lift':1.6 if a.character!='chopper' else 1.2,'kneeSoftness':1,'armSwing':.20,'mode':'side' if side else 'depth','feet':{}},'parts':{},'restPose':{'bodyOffset':0},'actions':{},'annotation':{'status':'DRAFT_REQUIRES_VISUAL_REVIEW','method':'Connected alpha components; one-time normalized joint suggestions; no image painting','sourcePixels':list(im.size),'boxes':boxes}}
 parts=spec['parts']
 # Expression jaw changes cannot reposition a skull. Lock all heads to the crown.
 first=boxes[0];headScale=c['head']/first[3];quietNeck=center_at(first,.96);crownOffset=round(first[3]*.12)
 def crown(b):
  x,y,w,h=b;yy=y+crownOffset;coords=np.nonzero(binary[max(y,yy-3):min(y+h,yy+4),x:x+w]);xx=float(coords[1].mean()+x) if coords[1].size else x+w/2
  return [round(xx,2),float(yy)]
 quietCrown=crown(first);crownTarget=[313+(quietCrown[0]-quietNeck[0])*headScale,c['neck']+(quietCrown[1]-quietNeck[1])*headScale]
 for i,name in enumerate(['quiet','happy','annoyed','surprise']):
  b=boxes[i];parts['head_'+name]={'rect':b,'sourceRoot':crown(b),'targetRoot':crownTarget,'scale':round(headScale,6)}
 spec['annotation']['headCalibration']='Common quiet-head scale and crown row anchor, independent of mouth/chin movement'
 b=boxes[4];bodyScale=c['torso']/b[3];parts['torso']={'rect':b,'sourceRoot':center_at(b,.06),'targetRoot':[313,c['neck']+4],'scale':round(bodyScale,6)}
 bodyWidth=b[2]*bodyScale;shoulderGap=min(90,max(45,bodyWidth*.30));hipGap=min(55,max(26,bodyWidth*.19));shoulderY=c['neck']+25
 if a.character=='franky':shoulderGap=92
 for i,which in [(5,'near'),(6,'far')]:
  b=boxes[i];sg=nearSign if which=='near' else -nearSign;hip=[313+sg*shoulderGap,shoulderY];parts[which+'Arm']={'rect':b,'joints':[center_at(b,.10),center_at(b,.54),center_at(b,.91)],'hip':hip,'length':c['arm']}
  spec['restPose'][which+'Arm']={'hand':[sg*min(24,c['arm']*.15),c['arm']*.96],'bend':sg}
 for i,footIndex,which in [(7,9,'near'),(8,10,'far')]:
  b=boxes[i];fb=boxes[footIndex];sg=nearSign if which=='near' else -nearSign;hipX=313+sg*hipGap;footScale=c['foot']/fb[2]*(.85 if not side else 1)
  footX=fb[0]+fb[2]*({'east':.31,'west':.69,'north':.5,'south':.5}[d]);footY=fb[1]+fb[3]*.48;ankleY=c['ground']-(fb[1]+fb[3]-footY)*footScale;ankle=[hipX,ankleY]
  parts[which+'Foot']={'rect':fb,'sourceRoot':[footX,footY],'targetRoot':ankle,'scale':round(footScale,6)}
  parts[which+'Leg']={'rect':b,'joints':[center_at(b,.08),center_at(b,.60),center_at(b,.97)],'hip':[hipX,c['hip']],'length':ankleY-c['hip']+2}
  bend=1 if d=='east' else -1 if d=='west' else sg;spec['gait']['feet'][which]={'ankle':ankle,'phaseOffset':0 if which=='near' else .5,'bend':bend}
  spec['restPose'][which+'Leg']=[[hipX,c['hip']],[hipX,(c['hip']+ankleY)/2],ankle]
 if boxes[11] and a.character in ['luffy','zoro','usopp','chopper','jinbe']:
  b=boxes[11];accScale=({'luffy':130,'zoro':200,'usopp':115,'chopper':120,'jinbe':320}[a.character])/b[3]
  if a.character=='jinbe':root=[313,c['neck']+35];layer='back';anchor=center_at(b,.06)
  elif a.character=='chopper':root=[313,c['neck']+45];layer='front' if d=='north' else 'back';anchor=center_at(b,.08)
  else:
   anatomicalRight=a.character=='zoro';sg=(1 if d in ['north','west'] else -1)*(1 if anatomicalRight else -1);root=[313+sg*hipGap,c['hip']-16];layer='back' if (d=='west' and anatomicalRight) or (d=='east' and not anatomicalRight) else 'front';anchor=center_at(b,.08)
  parts['accessory']={'rect':b,'sourceRoot':anchor,'targetRoot':root,'scale':round(accScale,6),'layer':layer}
 arm=c['arm'];ng=nearSign;fg=-ng
 poses=[('idle','quiet',[ng*arm*.15,arm*.96],[fg*arm*.15,arm*.96]),('talk_happy','happy',[ng*arm*.45,arm*.68],[fg*arm*.15,arm*.94]),('talk_annoyed','annoyed',[-ng*arm*.23,arm*.54],[-fg*arm*.23,arm*.54]),('surprised','surprise',[ng*arm*.36,-arm*.30],[fg*arm*.36,-arm*.30]),('focused_use','quiet',[-ng*arm*.23,arm*.69],[-fg*arm*.23,arm*.69]),('sit','quiet',[ng*arm*.1,arm*.86],[fg*arm*.1,arm*.86]),('wave','happy',[ng*arm*.50,-arm*.75],[fg*arm*.15,arm*.94]),('listen','quiet',[ng*arm*.15,arm*.94],[fg*arm*.15,arm*.94])]
 for name,expr,nhand,fhand in poses:
  spec['actions'][name]={'expression':expr,'bodyOffset':0,'nearArm':{'hand':nhand,'bend':ng},'farArm':{'hand':fhand,'bend':fg},'animation':{'nearHandDelta':[0,3],'farHandDelta':[0,2],'bob':1}}
 for name in ['talk_happy','talk_annoyed','focused_use','wave','surprised']:
  spec['actions'][name]['animation']={'nearHandDelta':[ng*6,-5],'farHandDelta':[fg*3,2],'bob':1.5}
 sit=spec['actions']['sit'];sit['bodyOffset']=min(55,(c['ground']-c['hip'])*.38)
 for which in ['near','far']:
  hip=parts[which+'Leg']['hip'];ankle=spec['gait']['feet'][which]['ankle'];sg=nearSign if which=='near' else -nearSign
  if side:knee=[hip[0]+(1 if d=='east' else -1)*55,hip[1]+sit['bodyOffset']];foot=[knee[0],ankle[1]]
  else:knee=[hip[0]+sg*15,hip[1]+sit['bodyOffset']+30];foot=[hip[0]+sg*10,ankle[1]]
  sit[which+'Leg']=[[hip[0],hip[1]+sit['bodyOffset']],knee,foot]
 if a.update_heads:
  old=json.loads(output.read_text(encoding='utf8'));oldQuiet=old['parts']['head_quiet'];commonScale=oldQuiet['scale'];q=parts['head_quiet']['sourceRoot'];target=[oldQuiet['targetRoot'][j]+(q[j]-oldQuiet['sourceRoot'][j])*commonScale for j in range(2)]
  for name in ['quiet','happy','annoyed','surprise']:
   fresh=parts['head_'+name];fresh['scale']=commonScale;fresh['targetRoot']=target;old['parts']['head_'+name]=fresh
  old.setdefault('annotation',{})['headCalibration']=spec['annotation']['headCalibration'];spec=old
 output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({'output':str(output),'status':'DRAFT_REQUIRES_VISUAL_REVIEW','parts':len(spec['parts'])}))
if __name__=='__main__':main()
