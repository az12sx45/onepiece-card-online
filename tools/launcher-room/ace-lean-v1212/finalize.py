"""Copy reviewed Ace v2 atlases into the runtime tree with SHA verification."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
STAGE = HERE / 'stage-r4'
STAGED_MANIFEST = STAGE / 'tools/launcher-room/ace-lean-v1212/manifest.json'


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    manifest = json.loads(STAGED_MANIFEST.read_text(encoding='utf-8'))
    if manifest['atlasCount'] != 17 or manifest['frameCount'] != 81:
        raise ValueError('Incomplete Ace action set')
    runtime = ROOT / 'public/images/launcher_room/reserved_v2/ace'
    if runtime.exists():
        raise FileExistsError(f'Refusing to overwrite Ace v2 runtime: {runtime}')
    paths = []
    for item in manifest['items']:
        relative = Path(item['path'])
        if relative.parts[:5] != ('public', 'images', 'launcher_room', 'reserved_v2', 'ace'):
            raise ValueError(f'Unexpected runtime path: {relative}')
        source = STAGE / relative
        target = ROOT / relative
        if not source.is_file() or source.stat().st_size != item['bytes'] or sha(source) != item['sha256']:
            raise ValueError(f'Unverified staged atlas: {relative}')
        paths.append((source, target, item))
    for source, target, item in paths:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        if target.stat().st_size != item['bytes'] or sha(target) != item['sha256']:
            raise ValueError(f'Runtime atlas copy failed: {target}')
    contact = STAGE / manifest['contact']['path']
    if contact.stat().st_size != manifest['contact']['bytes'] or sha(contact) != manifest['contact']['sha256']:
        raise ValueError('Contact sheet hash mismatch')
    final_contact = HERE / 'contact.png'
    if final_contact.exists():
        raise FileExistsError(final_contact)
    shutil.copy2(contact, final_contact)
    manifest['contact']['path'] = str(final_contact.relative_to(ROOT)).replace('\\', '/')
    manifest['visualAccepted'] = True
    manifest['humanAcceptance'] = False
    manifest['visualReview'] = 'Independent AI visual review of 81 frames on pale background; canonical badge/tattoo check; no human play acceptance claimed.'
    final_manifest = HERE / 'manifest.json'
    if final_manifest.exists():
        raise FileExistsError(final_manifest)
    final_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'runtimeAtlases': len(paths), 'runtimeBytes': sum(item['bytes'] for _, _, item in paths),
                      'manifest': str(final_manifest), 'contact': str(final_contact)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
