"""QA-only screenshot crop. Runtime art is never modified by this script."""
import sys
from PIL import Image
im=Image.open(sys.argv[1]);scale=im.width/960
x,y=float(sys.argv[3])*scale,float(sys.argv[4])*scale
im.crop((round(x-110*scale),round(y-115*scale),round(x+110*scale),round(y+45*scale))).save(sys.argv[2])
