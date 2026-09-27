"""Losslessly optimize explicitly listed QA screenshots; preserve originals outside candidate."""
import argparse, hashlib, json, shutil
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image

def sha(data): return hashlib.sha256(data).hexdigest()
def run(list_file, originals):
    list_file, originals = Path(list_file).resolve(), Path(originals).resolve()
    entries=json.loads(list_file.read_text(encoding='utf-8'))
    if originals.exists(): raise ValueError('Original backup directory must be new')
    originals.mkdir(parents=True)
    def optimize(entry):
        source=(list_file.parent/entry['path']).resolve()
        if source.parent!=list_file.parent or source.suffix!='.png': raise ValueError('Unexpected screenshot path')
        before=source.read_bytes()
        if sha(before)!=entry['sha256']: raise ValueError('Screenshot changed before optimization')
        with Image.open(source) as image:
            image.load(); rgba=image.convert('RGBA'); pixel_sha=sha(rgba.tobytes()); size=list(image.size)
            target=originals/(source.stem+'.optimized.png')
            image.save(target,optimize=True,compress_level=9)
        with Image.open(target) as image:
            if list(image.size)!=size or sha(image.convert('RGBA').tobytes())!=pixel_sha: raise ValueError('Lossless optimization changed pixels')
        original=originals/source.name
        shutil.copyfile(source,original)
        if target.stat().st_size<len(before): shutil.copyfile(target,source)
        target.unlink()
        final=source.read_bytes()
        return {**entry,'sha256':sha(final),'bytes':len(final),'dimensions':size,'pixelSha256':pixel_sha,
            'unoptimizedSha256':sha(before),'unoptimizedBytes':len(before),'pixelsIdentical':True,'originalPath':str(original)}
    with ThreadPoolExecutor(max_workers=4) as pool: results=list(pool.map(optimize,entries))
    report={'schema':'one-piece-room-browser-lossless-png/1','ok':True,'count':len(results),'originalBytes':sum(r['unoptimizedBytes'] for r in results),
        'optimizedBytes':sum(r['bytes'] for r in results),'images':results,'scriptSha256':sha(Path(__file__).read_bytes()),'humanAcceptance':False}
    (list_file.parent/'PNG_OPTIMIZATION.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return {k:v for k,v in report.items() if k!='images'}
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--captures',required=True);parser.add_argument('--originals',required=True)
    args=parser.parse_args();print(json.dumps(run(args.captures,args.originals),ensure_ascii=False))
