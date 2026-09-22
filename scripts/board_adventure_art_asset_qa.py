"""Validate GPT provenance and every shipped picture without modifying images."""
import hashlib
import json
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = Path('D:/Codex_QA/draw-result-art-20260922/assets.json')
FILES = ['BOARD_ADVENTURE_ART_CHEST_HEAL_V1.json', 'BOARD_ADVENTURE_ART_IMPEL_PP_V1.json', 'BOARD_ADVENTURE_ART_JUDICIAL_V1.json']

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    records = []
    for name in FILES:
        document = json.loads((ROOT / 'docs' / name).read_text(encoding='utf-8-sig'))
        assert len(document['assets']) == 18, name
        for record in document['assets']:
            target = ROOT / record['finalPath']
            source = Path(record['sourcePath'])
            assert record['prompt'] and len(record['prompt']) > 100
            assert source.is_file() and source.suffix.lower() == '.png'
            source_bytes = source.read_bytes()
            assert sha(source_bytes) == record['sourceSha256']
            data = target.read_bytes()
            assert sha(data) == (record.get('finalSha256') or record['sha256'])
            assert len(data) == (record.get('finalBytes') or record['bytes'])
            with Image.open(source) as image:
                image.load()
                assert image.size == (1536, 1024)
            with Image.open(target) as image:
                image.load()
                assert image.size == (1536, 1024) and image.format == 'WEBP'
            records.append({'path': record['finalPath'], 'sha256': sha(data), 'bytes': len(data), 'sourceSha256': sha(source_bytes), 'width': 1536, 'height': 1024})
    assert len(records) == 54 and len({r['sha256'] for r in records}) == 54
    expected = {r['path'] for r in records}
    actual = {p.relative_to(ROOT).as_posix() for p in (ROOT / 'public/images/board/adventure_reveal/v1').iterdir()}
    assert actual == expected
    prior = []
    for target in sorted((ROOT / 'public/images/board/sea_event_reveal/v2').glob('*.webp')):
        relative = target.relative_to(ROOT).as_posix()
        baseline = subprocess.check_output(['git', 'cat-file', 'blob', '7a9558a85e5874185b47c5c7ba2dac5dfc870458:' + relative], cwd=ROOT)
        assert baseline == target.read_bytes()
        with Image.open(target) as image:
            image.load()
            assert image.size == (1536, 1024)
        prior.append({'path': relative, 'sha256': sha(baseline), 'bytes': len(baseline)})
    assert len(prior) == 72 and len({r['sha256'] for r in prior}) == 72
    result = {'ok': True, 'newImages': 54, 'oldImagesUnchanged': 72, 'totalImages': 126, 'newBytes': sum(r['bytes'] for r in records), 'records': records, 'prior': prior}
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k not in ['records', 'prior']}))

if __name__ == '__main__':
    main()
