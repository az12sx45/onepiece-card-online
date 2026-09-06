"""Combine complementary authoring masks; explicit inputs, original SHA required."""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
from birefnet_infer import digest
from card_recipes import RECIPES

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--key",required=True)
    parser.add_argument("--inputs",type=Path,nargs="+",required=True,help="Input report JSONs paired with -mask.png")
    parser.add_argument("--out",type=Path,required=True)
    args=parser.parse_args()
    rec=next(r for r in RECIPES if f'{r["variant"]}/{r["id"]}'==args.key)
    binary=None;proof=[];original_hash=None
    for report_path in args.inputs:
        row=json.loads(report_path.read_text(encoding="utf-8"))
        if original_hash and row["source_sha256"]!=original_hash:raise ValueError("different originals")
        original_hash=row["source_sha256"]
        mask_path=report_path.with_name(report_path.name.replace("-report.json","-mask.png"))
        mask=np.asarray(Image.open(mask_path).convert("L"))>90
        if mask.shape!=(1863,1242):raise ValueError("wrong mask canvas")
        binary=mask if binary is None else binary|mask
        proof.append({"report":str(report_path.resolve()),"report_sha256":digest(report_path),
                      "mask_sha256":digest(mask_path),"model":row.get("model",{"name":"BiRefNet-general-lite"})})
    binary=binary.astype(np.uint8)*255
    binary=cv2.morphologyEx(binary,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
    count,labels,stats,_=cv2.connectedComponentsWithStats(binary,8)
    for label in range(1,count):
        if stats[label,cv2.CC_STAT_AREA]<7000:binary[labels==label]=0
    # Small enclosed segmentation gaps, never an unrestricted convex hull.
    count,labels,stats,_=cv2.connectedComponentsWithStats(255-binary,8)
    for label in range(1,count):
        x,y,w,h,area=stats[label]
        if 0<x and 0<y and x+w<1242 and y+h<1863 and area<35000:binary[labels==label]=255
    args.out.mkdir(parents=True,exist_ok=True)
    stem=args.key.replace("/","-")
    mask_path=args.out/f"{stem}-mask.png"
    if mask_path.exists():raise FileExistsError("Choose a new versioned output directory")
    Image.fromarray(binary).save(mask_path)
    row={"key":args.key,"source":rec["source"],"source_sha256":original_hash,"recipe":rec,
         "model":{"name":"reviewed-hybrid-authoring-masks","inputs":proof},
         "mask_sha256":digest(mask_path),"visual_review":"pending"}
    (args.out/f"{stem}-report.json").write_text(json.dumps(row,indent=2),encoding="utf-8")
    print(str(mask_path))

if __name__=="__main__":main()
