import json
from pathlib import Path
from PIL import Image
import cv2,numpy as np
q=Path(__file__).parent
r=json.loads((q/'brook/walk/inspection/components.json').read_text());c=next(c for c in r['components'] if c['row']==3 and c['column']==1)
a=np.array(Image.open(r['source']).convert('RGBA'));n,l,s,cen=cv2.connectedComponentsWithStats((a[:,:,3]>128).astype('uint8'),8);i=l[c['seed'][1],c['seed'][0]];keep=cv2.dilate((l==i).astype('uint8'),np.ones((3,3),np.uint8));a[keep==0]=0
im=Image.fromarray(a); im.crop(im.getchannel('A').getbbox()).save(q/'brook/walk/neutral-south-reference.png')
