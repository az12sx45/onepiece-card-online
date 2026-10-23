"""Resources read with FileAccess/Image.load must survive export unchanged."""
from pathlib import Path

ROOTS = ('assets', 'mobile', 'native-animation-assets')
EXTENSIONS = {'.ttf', '.otf', '.png', '.webp', '.jpg', '.jpeg'}


def runtime_files(project):
    project = Path(project)
    files = [p for root in ROOTS for p in (project/root).rglob('*')
             if p.is_file() and p.suffix.lower() in EXTENSIONS]
    if not files or not (project/'assets/NotoSansTC.ttf').is_file():
        raise ValueError('Required bundled runtime assets missing')
    return sorted(files)


def keep_runtime_files(project):
    files = runtime_files(project)
    for file in files:
        Path(str(file)+'.import').write_text('[remap]\n\nimporter="keep"\n', encoding='utf8')
    return len(files)


def verify_runtime_files(entries, project):
    project = Path(project)
    files = runtime_files(project)
    for file in files:
        key = 'res://'+file.relative_to(project).as_posix()
        if entries.get(key) != file.read_bytes():
            raise ValueError('Runtime raw resource missing or changed: '+key)
    return len(files)
