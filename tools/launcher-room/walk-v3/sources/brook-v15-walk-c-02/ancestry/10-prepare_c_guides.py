from pathlib import Path
import json,sys
from PIL import Image,ImageDraw
import numpy as np,cv2
q=Path(__file__).parent
out=q/('luffy/walk/brook-c-guides' if '--brook' in sys.argv else 'luffy/walk/c-guides');out.mkdir(exist_ok=True)
sheet=Image.new('RGBA',(800,800))
for index,(direction,rel,row) in enumerate([('east','side-inspection',0),('west','side-inspection',1),('north','all-inspection',2),('south','all-inspection',3)]):
 col=0 if '--brook' in sys.argv and row>=2 else 2
 report=json.loads((q/'luffy/walk'/rel/'components.json').read_text()); im=Image.open(report['source']).convert('RGBA'); arr=np.array(im); c=next(c for c in report['components'] if c['row']==row and c['column']==col)
 n,lab,stats,cent=cv2.connectedComponentsWithStats((arr[:,:,3]>128).astype('uint8'),8);chosen=lab[c['seed'][1],c['seed'][0]];mask=cv2.dilate((lab==chosen).astype('uint8'),np.ones((3,3),np.uint8));arr[mask==0]=0
 char=Image.fromarray(arr).crop(Image.fromarray(arr).getchannel('A').getbbox());char.save(out/f'{direction}.png');char.thumbnail((360,360),Image.Resampling.LANCZOS);sheet.paste(char,(index%2*400+(400-char.width)//2,index//2*400+(400-char.height)//2))
sheet.save(out/'four-directions.png')
print(out)
