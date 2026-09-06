"""Build versioned, read-only-original Card depth assets using approved local BiRefNet.

Player assets are two WebP color layers plus one tiny alpha-only frame mask.
The browser uses the original card for fixed lettering, so no text is regenerated.
BiRefNet only segments. OpenCV Telea fills the small areas exposed by parallax;
the fully inpainted character interior remains hidden beneath the opaque subject.
"""
import argparse
import json
from pathlib import Path
import time
import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageFilter
from birefnet_infer import normalize, postprocess, digest, DEFAULT_MODEL, MODEL_MD5, MODEL_URL
from card_recipes import RECIPES
from mask_corrections import CORRECTIONS
from mask_corrections_lux import WINDOW_INCLUDES

MODEL_SPECS = {
    MODEL_MD5: {"name":"BiRefNet-general-lite", "url":MODEL_URL},
    "7a35a0141cbbc80de11d9c9a28f52697": {
        "name":"BiRefNet-general",
        "url":"https://github.com/danielgatis/rembg/releases/download/v0.0.0/BiRefNet-general-epoch_244.onnx"},
}

def window_mask(size, recipe):
    width, height = size
    window = Image.new("L", size, 0)
    draw = ImageDraw.Draw(window)
    draw.polygon([(round(x*width),round(y*height)) for x,y in recipe["window"]], fill=255)
    for polygon in WINDOW_INCLUDES.get(f'{recipe["variant"]}/{recipe["id"]}', []):
        draw.polygon([(round(x*width),round(y*height)) for x,y in polygon], fill=255)
    b = recipe["badge"]
    draw.ellipse((round(b[0]*width),round(b[1]*height),round(b[2]*width),round(b[3]*height)), fill=0)
    for polygon in recipe.get("protect", []):
        draw.polygon([(round(x*width),round(y*height)) for x,y in polygon], fill=0)
    # Feather only inside the protected window: zero-alpha regions stay protected.
    blurred = window.filter(ImageFilter.GaussianBlur(width*.004))
    return Image.fromarray(np.minimum(np.asarray(window),np.asarray(blurred)).astype(np.uint8))

def infer(original, recipe, session):
    width,height=original.size
    box=tuple(round(v*(width if i%2==0 else height)) for i,v in enumerate(recipe["crop"]))
    model_input=original
    if recipe.get("inference_clean"):
        # Remove printed badges from model input only; NEVER from delivered art.
        remove=Image.new("L",original.size,0); pen=ImageDraw.Draw(remove)
        b=recipe["badge"]
        pen.ellipse(tuple(round(v*(width if i%2==0 else height)) for i,v in enumerate(b)),fill=255)
        for polygon in recipe.get("protect", []):
            pen.polygon([(round(x*width),round(y*height)) for x,y in polygon],fill=255)
        model_input=Image.fromarray(cv2.inpaint(np.array(original),np.array(remove),8,cv2.INPAINT_TELEA))
    crop=model_input.crop(box)
    rotation=recipe.get("rotation",0)
    if rotation: crop=crop.rotate(rotation,expand=True)
    result=session.run(None,{session.get_inputs()[0].name:normalize(crop)})
    local_mask=postprocess(result[0],crop.size)
    if rotation: local_mask=local_mask.rotate(-rotation,expand=True)
    mask=Image.new("L",original.size,0)
    mask.paste(local_mask,box[:2])
    return mask

def tidy(mask, recipe):
    # Recover internal skin/clothes false-negative holes without inventing colors.
    binary=(np.array(mask)>90).astype(np.uint8)*255
    binary=cv2.morphologyEx(binary,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    inverse=255-binary
    count,labels,stats,_=cv2.connectedComponentsWithStats(inverse,8)
    for label in range(1,count):
        x,y,w,h,area=stats[label]
        if 0<x and 0<y and x+w<binary.shape[1] and y+h<binary.shape[0] and area<6500:
            binary[labels==label]=255
    correction=CORRECTIONS.get(f'{recipe["variant"]}/{recipe["id"]}',{})
    minimum=correction.get("keep_components_min_area",0)
    if minimum:
        count,labels,stats,_=cv2.connectedComponentsWithStats(binary,8)
        for label in range(1,count):
            if stats[label,cv2.CC_STAT_AREA]<minimum: binary[labels==label]=0
    if correction.get("replace"): binary[:]=0
    fixed=Image.fromarray(binary)
    draw=ImageDraw.Draw(fixed)
    additions=recipe["include"]+correction.get("include",[])
    if correction.get("replace"):additions.append(correction["replace"])
    for polygon in additions:
        draw.polygon([(round(x*mask.width),round(y*mask.height)) for x,y in polygon],fill=255)
    for polygon in correction.get("exclude",[]):
        draw.polygon([(round(x*mask.width),round(y*mask.height)) for x,y in polygon],fill=0)
    if correction.get("clip"):
        allowed=Image.new("L",mask.size,0)
        ImageDraw.Draw(allowed).polygon([(round(x*mask.width),round(y*mask.height)) for x,y in correction["clip"]],fill=255)
        fixed=Image.fromarray(np.minimum(np.array(fixed),np.array(allowed)))
    return fixed.filter(ImageFilter.GaussianBlur(.55))

def composite(background, subject, original, frame_mask, dx=0,dy=0):
    canvas=background.convert("RGBA")
    canvas.alpha_composite(subject,(round(dx),round(dy)))
    chrome=original.convert("RGBA")
    chrome.putalpha(frame_mask)
    return Image.alpha_composite(canvas,chrome).convert("RGB")

def build(original, raw_mask, recipe, width):
    size=(width,width*3//2)
    source=original.resize(size,Image.Resampling.LANCZOS)
    window=window_mask(size,recipe)
    matte=tidy(raw_mask,recipe).resize(size,Image.Resampling.LANCZOS)
    # Subject can extend under the fixed frame. Clipping before moving would cut
    # arms at the aperture; chrome does the final clipping after the translation.
    mask_array=np.array(matte)
    win=np.array(window)
    visible=(mask_array>8)&(win>0)
    removal=cv2.dilate(visible.astype(np.uint8)*255,np.ones((13,13),np.uint8))
    removal[win==0]=0
    repaired=cv2.inpaint(np.array(source),removal,5,cv2.INPAINT_TELEA)
    # These pixels are fully covered by the original-card frame mask in the
    # renderer. Do not re-encode hidden printed text in the downloaded plate.
    repaired[win==0]=0
    background=Image.fromarray(repaired)
    subject=source.convert("RGBA")
    # Keep only a narrow allowance around the window, not the hidden badge/text.
    allowance=cv2.dilate((win>0).astype(np.uint8)*255,np.ones((21,21),np.uint8))
    alpha=np.minimum(mask_array,allowance)
    subject.putalpha(Image.fromarray(alpha))
    # Empty RGB is canonicalized for lossless alpha and compact WebP output.
    pixels=np.array(subject); pixels[alpha==0,:3]=0
    subject=Image.fromarray(pixels)
    frame_mask=Image.fromarray(255-win)
    mask_asset=Image.new("RGBA",size,(255,255,255,255));mask_asset.putalpha(frame_mask)
    return source,background,subject,frame_mask,mask_asset

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--public",type=Path,required=True)
    parser.add_argument("--out",type=Path,required=True)
    parser.add_argument("--work",type=Path,required=True)
    parser.add_argument("--model",type=Path,default=DEFAULT_MODEL)
    parser.add_argument("--only",default="",help="Comma-separated variant/id keys")
    parser.add_argument("--width",type=int,default=828)
    parser.add_argument("--rebuild",action="store_true",help="Rebuild derived files from saved masks only")
    parser.add_argument("--mask-index",type=Path,help="Reviewed key -> {mask, report} overrides for a final rebuild")
    args=parser.parse_args()
    if args.width<400 or args.width%2: raise ValueError("width must be even and >=400")
    source_root=args.public.resolve(); destination=args.out.resolve(); work=args.work.resolve()
    if destination==source_root or destination.is_relative_to(source_root/"images"):
        raise ValueError("never write original image folders")
    args.work.mkdir(parents=True,exist_ok=True);args.out.mkdir(parents=True,exist_ok=True)
    selected=set(args.only.split(",")) if args.only else None
    recipes=[r for r in RECIPES if selected is None or f'{r["variant"]}/{r["id"]}' in selected]
    if selected and len(recipes)!=len(selected):raise ValueError("invalid card selection")
    session=None
    cv2.setNumThreads(2)
    model_md5=digest(args.model,"md5")
    if model_md5 not in MODEL_SPECS:raise ValueError("unexpected model checksum")
    model_spec={**MODEL_SPECS[model_md5],"md5":model_md5,"sha256":digest(args.model)}
    overrides=json.loads(args.mask_index.read_text(encoding="utf-8")) if args.mask_index else {}
    if not args.rebuild:
        options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1
        options.execution_mode=ort.ExecutionMode.ORT_SEQUENTIAL;options.log_severity_level=3
        session=ort.InferenceSession(str(args.model),sess_options=options,providers=["CPUExecutionProvider"])
    rows=[]
    for recipe in recipes:
        key=f'{recipe["variant"]}/{recipe["id"]}';stem=key.replace("/","-")
        original_path=source_root/recipe["source"]; original_hash=digest(original_path)
        original=Image.open(original_path).convert("RGB")
        if original.size!=(1242,1863):raise ValueError(f"unexpected source size: {key}")
        raw_path=Path(overrides[key]["mask"]) if key in overrides else work/f"{stem}-mask.png"
        used_model=model_spec
        start=time.perf_counter()
        if raw_path.exists():
            prior_report=Path(overrides[key]["report"]) if key in overrides else work/f"{stem}-report.json"
            if not prior_report.exists():
                raise ValueError(f"unproven cached mask: {key}; choose a fresh work directory")
            prior=json.loads(prior_report.read_text(encoding="utf-8"))
            used_model=prior.get("model", {"name":"BiRefNet-general-lite", "md5":MODEL_MD5,
                                         "sha256":"5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333",
                                         "url":MODEL_URL})
            if prior["source_sha256"]!=original_hash or any(prior["recipe"].get(k, 0 if k=="rotation" else False)!=recipe.get(k, 0 if k=="rotation" else False) for k in ("crop","rotation","inference_clean")):
                raise ValueError(f"source or inference crop changed for {key}; regenerate its mask in a new work directory")
            raw_mask=Image.open(raw_path).convert("L")
        elif args.rebuild:raise FileNotFoundError(raw_path)
        else:
            raw_mask=infer(original,recipe,session);raw_mask.save(raw_path)
        source,bg,subject,frame,mask_asset=build(original,raw_mask,recipe,args.width)
        card_out=destination/key;card_out.mkdir(parents=True,exist_ok=True)
        bg.save(card_out/"background.webp",quality=92,method=4)
        subject.save(card_out/"subject.webp",quality=95,method=4,exact=True)
        mask_asset.save(card_out/"foreground.webp",lossless=True,method=6,exact=True)
        neutral=composite(bg,subject,source,frame)
        right=composite(bg,subject,source,frame,args.width*.01,args.width*.006)
        left=composite(bg,subject,source,frame,-args.width*.01,-args.width*.006)
        checker=Image.new("RGB",source.size,"#525a66")
        checker.paste(subject,mask=subject.getchannel("A"))
        qa=Image.new("RGB",(1000,400),"#172130");draw=ImageDraw.Draw(qa)
        for i,(label,picture) in enumerate([("original",source),("neutral",neutral),("left",left),("right",right)]):
            qa.paste(picture.resize((246,369)),(i*250,26));draw.text((i*250+5,6),f"{key} {label}",fill="white")
        qa.save(work/f"{stem}-qa.jpg",quality=92)
        checker.resize((414,621)).save(work/f"{stem}-cutout.jpg",quality=92)
        original_now=digest(original_path)
        if original_hash!=original_now:raise RuntimeError("original changed")
        fixed=np.array(frame)==255
        diff=np.abs(np.array(neutral).astype(np.int16)-np.array(source).astype(np.int16))
        files=[{"path":str((Path(key)/name).as_posix()),"bytes":(card_out/name).stat().st_size,
                "sha256":digest(card_out/name)} for name in ("background.webp","subject.webp","foreground.webp")]
        row={"key":key,"source":recipe["source"],"source_sha256":original_hash,"source_unchanged":True,
             "size":[args.width,args.width*3//2],"recipe":recipe,
             "alpha_correction":CORRECTIONS.get(key),"model":used_model,"raw_mask_sha256":digest(raw_path),"files":files,
             "window_includes":WINDOW_INCLUDES.get(key),
             "fixed_pixel_max_error":int(diff[fixed].max()),"neutral_mean_error":float(diff.mean()),
             "visible_subject_fraction":float(((np.array(subject.getchannel('A'))>127)&(np.array(frame)<128)).mean()),
             "seconds":round(time.perf_counter()-start,2),"visual_review":"pending"}
        (work/f"{stem}-report.json").write_text(json.dumps(row,indent=2),encoding="utf-8")
        rows.append(row);print(json.dumps({"key":key,"seconds":row["seconds"],"bytes":sum(f['bytes'] for f in files),
                                         "fixed_error":row["fixed_pixel_max_error"]}),flush=True)
    report={"schema":"card-depth-build-v1","model":model_spec,
            "foreground_asset":"alpha-only mask; runtime samples original card for fixed lettering",
            "cards":rows,"count":len(rows),"status":"awaiting-visual-and-runtime-QA"}
    (work/("build-selected.json" if selected else "build-all.json")).write_text(json.dumps(report,indent=2),encoding="utf-8")

if __name__=="__main__":main()
