"""Export reviewed GPT avatars 84-92, preserving generated alpha without masks/crops."""
from pathlib import Path
from PIL import Image
import hashlib
import json
import io

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
REPORT = Path('D:/Codex_QA/launcher-guestbook-r56/avatars-tail-report.json')
SOURCES = json.loads((HERE / 'sources-tail.json').read_text(encoding='utf-8'))['entries']

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

rows = []
for row in SOURCES:
    source = Path(row['source'])
    output = ROOT / row['output']
    image = Image.open(source)
    assert image.mode == 'RGBA', (source, image.mode)
    assert image.width == image.height, (source, image.size)
    assert image.getchannel('A').getextrema() == (0, 255), source
    final = image.resize((735, 735), Image.Resampling.LANCZOS)
    if not output.exists():
        buffer = io.BytesIO()
        final.save(buffer, 'WEBP', quality=94, method=6, exact=True)
        output.write_bytes(buffer.getvalue())
    saved = Image.open(output)
    assert saved.mode == 'RGBA' and saved.size == (735, 735), output
    alpha = saved.getchannel('A')
    corners = [alpha.getpixel(p) for p in ((0,0),(734,0),(0,734),(734,734))]
    assert corners == [0,0,0,0], (output, corners)
    histogram = alpha.histogram()
    opaque_ratio = sum(histogram[240:])/(735*735)
    assert 0.73 < opaque_ratio < 0.82, (output, opaque_ratio)
    rows.append(dict(row, width=735, height=735, mode=saved.mode,
        cornerAlpha=corners, opaqueRatio=round(opaque_ratio,5),
        sourceSha256=digest(source), sha256=digest(output), bytes=output.stat().st_size))

REPORT.parent.mkdir(parents=True, exist_ok=True)
REPORT.write_text(json.dumps({'ok': True, 'count':len(rows), 'method':'resize only; generated alpha preserved; no crop/mask/drawing', 'entries':rows}, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(json.dumps({'ok':True, 'count':len(rows), 'totalBytes':sum(r['bytes'] for r in rows), 'report':str(REPORT)}))
