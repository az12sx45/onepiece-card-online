"""Resources read with FileAccess/Image.load must survive export unchanged."""
from pathlib import Path

ROOTS = ('assets', 'mobile', 'native-animation-assets', 'card-assets')
EXTENSIONS = {'.ttf', '.otf', '.png', '.webp', '.jpg', '.jpeg'}


def runtime_files(project):
    project = Path(project)
    # The original web Card route owns its own bundled artwork. The retained
    # native Card renderer is unreachable, so its art is excluded at export.
    omit_card = 'exclude_filter="card-assets/*"' in (project/'export_presets.cfg').read_text()
    if omit_card:
        host = (project/'ios_host.gd').read_text()
        if 'if target!="board":' not in host:
            raise ValueError('Cannot omit native Card artwork while native Card can launch')
    roots = [root for root in ROOTS if not (omit_card and root == 'card-assets')]
    files = [p for root in roots for p in (project/root).rglob('*')
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
    if 'exclude_filter="card-assets/*"' in (project/'export_presets.cfg').read_text():
        if any(key.startswith('res://card-assets/') for key in entries):
            raise ValueError('Retired native Card artwork unexpectedly exported')
    files = runtime_files(project)
    for file in files:
        key = 'res://'+file.relative_to(project).as_posix()
        if entries.get(key) != file.read_bytes():
            raise ValueError('Runtime raw resource missing or changed: '+key)
    return len(files)
