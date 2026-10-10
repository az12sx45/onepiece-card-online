"""Check production dimensions/alpha and make review sheets, never alter art."""
import json, hashlib, sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[2]
qa = Path('D:/Codex_QA/launcher-guestbook-r56/art')
qa.mkdir(parents=True, exist_ok=True)
styles = json.loads((Path(__file__).parent / 'styles.json').read_text(encoding='utf-8-sig'))
groups = {
    'avatars': [(str(i), root / f'public/images/board/avatars/{i}.webp', (735,735), True) for i in range(63,93)],
    'boards': [(x['key'], root / 'public' / x['asset'].replace('opui://launcher/',''), (1536,864), False) for x in styles['boards']],
    'notes': [(x['key'], root / 'public' / x['asset'].replace('opui://launcher/',''), (960,480), True) for x in styles['notes']],
}
report = {'status':'RUNNING', 'assets':[], 'missing':[], 'sheets':[]}
for group, entries in groups.items():
    cols, cell_w, cell_h = (5,220,248) if group == 'avatars' else (2,480,295) if group == 'boards' else (3,320,187)
    sheet = Image.new('RGB',(cols*cell_w,((len(entries)+cols-1)//cols)*cell_h),'#15333d')
    draw = ImageDraw.Draw(sheet)
    for index, (key, file, size, alpha) in enumerate(entries):
        if not file.is_file():
            report['missing'].append(str(file.relative_to(root)));continue
        with Image.open(file) as original:
            assert original.format == 'WEBP', f'{key}: format'
            assert original.size == size, f'{key}: {original.size} != {size}'
            if alpha: assert original.mode == 'RGBA', f'{key}: missing alpha'
            im=original.convert('RGBA')
        corners=[im.getpixel(p)[3] for p in [(0,0),(size[0]-1,0),(0,size[1]-1),(size[0]-1,size[1]-1)]]
        if alpha: assert corners == [0]*4 and im.getchannel('A').getextrema() == (0,255), f'{key}: alpha'
        report['assets'].append({'group':group,'key':key,'path':str(file.relative_to(root)).replace('\\','/'),'size':size,'cornerAlpha':corners,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest()})
        im.thumbnail((cell_w-12,cell_h-28),Image.Resampling.LANCZOS)
        x=(index%cols)*cell_w; y=(index//cols)*cell_h
        sheet.paste(im,(x+(cell_w-im.width)//2,y),im)
        draw.text((x+10,y+cell_h-22),key,fill='white')
    target=qa/f'{group}-review.jpg';sheet.save(target,quality=94);report['sheets'].append(str(target))
report['status']='INCOMPLETE' if report['missing'] else 'PASS'
report['counts']={g:sum(x['group']==g for x in report['assets']) for g in groups}
report['totalBytes']=sum(x['bytes'] for x in report['assets'])
(qa/'asset-report.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
print(json.dumps({k:report[k] for k in ['status','counts','totalBytes','sheets']},ensure_ascii=False))
if report['missing'] and '--partial' not in sys.argv: sys.exit(1)
