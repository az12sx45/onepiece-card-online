"""Contact sheets of actual subject cutouts, not just similar neutral composites."""
import argparse
from pathlib import Path
from PIL import Image, ImageDraw

def main():
    parser=argparse.ArgumentParser();parser.add_argument("--work",type=Path,required=True)
    parser.add_argument("--variant",required=True,choices=["normal","enh","lux","lux-enh"])
    args=parser.parse_args()
    sheet=Image.new("RGB",(1100,1360),"#172130");draw=ImageDraw.Draw(sheet)
    present=[]
    for ident in range(20):
        x=(ident%5)*220;y=(ident//5)*340
        name=f"{args.variant}-{ident}-cutout.jpg";source=args.work/name
        draw.text((x+5,y+5),f"{args.variant}/{ident}",fill="white")
        if source.exists():
            with Image.open(source) as picture: sheet.paste(picture.resize((210,315)),(x+5,y+22))
            present.append(ident)
        else:draw.text((x+5,y+120),"NOT BUILT",fill="red")
    out=args.work/f"review-{args.variant}-cutouts.jpg";sheet.save(out,quality=94)
    print(f"{out}: {len(present)}/20")

if __name__=="__main__":main()
