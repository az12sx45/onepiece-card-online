"""Read-only source preflight and partial scratch preview; never emits a release manifest."""
from __future__ import annotations
import argparse, copy, hashlib, importlib.util, json
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve()
spec = importlib.util.spec_from_file_location('reserved_import', HERE.with_name('import_atlases.py'))
imp = importlib.util.module_from_spec(spec); spec.loader.exec_module(imp)

def audit(plan, root, output):
    root, output = Path(root).resolve(), Path(output).resolve()
    imp.require(not output.exists(), 'Scratch output must be new')
    fixed = copy.deepcopy(plan)
    images, results = {}, []
    for sid, source in fixed['sources'].items():
        image = Image.open(imp.checked_file(root, source['image'], sid)).convert('RGBA')
        images[sid] = image
        alpha = np.array(image)[:, :, 3]
        count, labels, stats, centroids = cv2.connectedComponentsWithStats((alpha > 128).astype('uint8'), connectivity=8)
        cols, rows = imp.SHEETS[source['sheet']]['grid']
        seen = set()
        for row in range(rows):
            for col in range(cols):
                frame = imp.cell_frame(sid, source, image, col, row, 'south', 'preflight')
                original = frame['region'].copy()
                nominal_failure = None
                try: imp.extraction(frame, image)
                except ValueError as error: nominal_failure = str(error)
                if nominal_failure:
                    x, y, w, h = original
                    ids, counts = np.unique(labels[y:y+h, x:x+w], return_counts=True)
                    candidates = [(int(n), int(i)) for i, n in zip(ids, counts) if i and stats[i, cv2.CC_STAT_AREA] >= 500]
                    imp.require(candidates, f'No complete component available: {sid}/{row}:{col}')
                    body = max(candidates)[1]
                    imp.require(body not in seen, f'A source body was assigned twice: {sid}/{row}:{col}')
                    bx, by, bw, bh, area = map(int, stats[body])
                    left, top, right, bottom = max(0, bx-4), max(0, by-4), min(image.width, bx+bw+4), min(image.height, by+bh+4)
                    ys, xs = np.where(labels == body)
                    nearest = int(np.argmin((xs-centroids[body,0])**2 + (ys-centroids[body,1])**2))
                    override = {'region': [left, top, right-left, bottom-top], 'componentSeed': [int(xs[nearest]), int(ys[nearest])]}
                    source.setdefault('cells', {})[f'{row}:{col}'] = override
                    frame = imp.cell_frame(sid, source, image, col, row, 'south', 'preflight')
                result = imp.extraction(frame, image)
                bx, by, bw, bh = result['opaqueBounds']
                body_ids, body_counts = np.unique(labels[by:by+bh,bx:bx+bw], return_counts=True)
                body = max((int(n),int(i)) for i,n in zip(body_ids,body_counts) if i)[1]
                seen.add(body)
                # An expanded source region must not retain opaque fragments of its neighbour.
                ax, ay, ar, ab = result['sourceAlphaBounds']
                opaque_output = np.array(result['image'])[:,:,3] > 128
                region_labels = labels[ay:ab,ax:ar]
                # Tiny authored detached pixels within the AA radius are not a neighbour figure.
                other_bodies = [i for i in range(1,count) if i != body and stats[i,cv2.CC_STAT_AREA] >= 500]
                other = int(np.count_nonzero(opaque_output & np.isin(region_labels,other_bodies)))
                isolated = int(np.count_nonzero(opaque_output & (region_labels != body))) - other
                results.append({'source':sid,'sourceSha256':source['image']['sha256'],'cell':[col,row], 'nominalRegion':original,
                    'region':frame['region'],'nominalFailure':nominal_failure,'componentSeed':frame.get('componentSeed'),
                    'opaqueBounds':result['opaqueBounds'],'removedDistantAlphaPixels':result['removedDistantAlphaPixels'],
                    'retainedNeighbourOpaquePixels':other,'retainedNearbyIsolatedOpaquePixels':isolated,'ok':other==0})
    output.mkdir(parents=True)
    imp.write_json(output/'preflight-selection.json', fixed)
    contacts = []
    for key in imp.KEYS:
        selected = {s['sheet']: sid for sid,s in fixed['sources'].items() if s['key']==key}
        if set(selected) != set(imp.SHEETS): continue
        references = {}
        for sheet, sid in selected.items():
            col,row = imp.SHEETS[sheet]['standing']
            source=fixed['sources'][sid]
            col,row=source.get('standingReference',{}).get('cell',[col,row])
            f=imp.cell_frame(sid,source,images[sid],col,row,'south','calibration-standing')
            references[sid]=imp.extraction(f,images[sid])['opaqueBounds'][3]
        masterheight=references[selected['master']]
        scale=100/masterheight * fixed['characters'][key].get('outputScale',1)
        contact=Image.new('RGB',(1536,2112),'#142e37'); draw=ImageDraw.Draw(contact)
        frames=[]; index=0
        for item in imp.build_specs(key,selected,fixed['sources'],images):
            atlas=Image.new('RGBA',(item['cell']*item['columns'],item['cell']))
            for i,frame in enumerate(item['selections']):
                value=imp.extraction(frame,images[frame['source']])
                value['sourceUnitScale']=masterheight/references[frame['source']]
                rendered,transform=imp.legacy.render_one(value,scale,item['cell'])
                bounds=imp.legacy.pixel_bounds(rendered)
                imp.require(bounds and min(bounds[:2])>0 and max(bounds[2:])<item['cell'],f'Scratch output clips {key}/{frame["pose"]}')
                atlas.paste(rendered,(i*item['cell'],0))
                x,y=index%8*192,index//8*192
                draw.rectangle((x+2,y+21,x+189,y+189),fill='#b4c8c5')
                crop=rendered.copy(); crop.thumbnail((168,168),Image.Resampling.LANCZOS)
                contact.paste(crop,(x+(192-crop.width)//2,y+21),crop)
                draw.text((x+5,y+4),f'{item.get("action",item["kind"])} {item["direction"]} {i}',fill='white')
                frames.append({**frame,'bounds':bounds,'sourceUnitScale':value['sourceUnitScale'],'uniformCharacterScale':scale,'inverseWholeImageTransform':transform,'rgbaSha256':hashlib.sha256(rendered.tobytes()).hexdigest()})
                index+=1
            filename=output/key/f'{item.get("action",item["kind"])}-{item["direction"]}.webp'; filename.parent.mkdir(parents=True,exist_ok=True)
            atlas.save(filename,format='WEBP',lossless=True,exact=True)
        filename=output/f'{key}-contact.png'; contact.save(filename)
        imp.write_json(output/f'{key}-scratch-frames.json',frames)
        contacts.append({'key':key,'path':str(filename),'sha256':imp.digest(filename),'frames':index})
    report={'schema':'one-piece-room-reserved-preflight/1','scope':'Scratch extraction and geometry only; no release manifest or human acceptance',
        'ok':all(r['ok'] for r in results),'sourceCount':len(images),'cellCount':len(results),'overrides':sum(bool(r['nominalFailure']) for r in results),
        'items':results,'contacts':contacts,'humanAcceptance':False,'importerSha256':imp.digest(imp.HERE),'preflightScriptSha256':imp.digest(HERE)}
    imp.write_json(output/'PREFLIGHT.json',report)
    return {k:v for k,v in report.items() if k!='items'}

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--plan',required=True); parser.add_argument('--source-root',required=True); parser.add_argument('--output',required=True)
    args=parser.parse_args()
    print(json.dumps(audit(imp.read_json(args.plan),args.source_root,args.output),ensure_ascii=False))
