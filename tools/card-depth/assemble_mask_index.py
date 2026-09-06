"""Assemble explicit provenance references; this does not approve visual quality."""
import argparse
import json
from pathlib import Path
from card_recipes import RECIPES

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--work",type=Path,required=True)
    args=parser.parse_args()
    root=args.work.resolve()
    rows={}
    for recipe in RECIPES:
        key=f'{recipe["variant"]}/{recipe["id"]}';stem=key.replace("/","-")
        folder="layers"
        if recipe["variant"]=="lux-enh" and recipe["id"]>=8:folder="continuation"
        if key in ("enh/10","enh/11","enh/15"):folder="refinement"
        if key in ("enh/4","enh/5","enh/8","enh/11","lux-enh/5"):folder="hybrid"
        if key=="lux-enh/7":folder="sam-refinement/lux-enh-7"
        mask=root/folder/f"{stem}-mask.png";report=root/folder/f"{stem}-report.json"
        if not mask.is_file() or not report.is_file():raise FileNotFoundError(key)
        rows[key]={"mask":str(mask),"report":str(report)}
    out=root/"selected-mask-index.json"
    out.write_text(json.dumps(rows,indent=2),encoding="utf-8")
    print(f"{len(rows)}/80 complete mask provenance entries: {out}")

if __name__=="__main__":main()
