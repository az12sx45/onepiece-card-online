"""Install SHA-pinned Godot editor and only its iOS template on the CI Mac."""
import argparse
import json
from pathlib import Path
import subprocess
import sys
import zipfile
from build_macos import fetch


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--root',type=Path,required=True)
    args=parser.parse_args()
    if sys.platform!='darwin':parser.error('macOS required')
    root=args.root.resolve();root.mkdir(parents=True,exist_ok=False)
    base='https://github.com/godotengine/godot-builds/releases/download/4.7.2-stable/'
    editor=root/'editor.zip'
    fetch({'url':base+'Godot_v4.7.2-stable_macos.universal.zip','sha256':'c58a24e31d720be9d62f60cb5627c4e695fb72f21b0cfe1bc9ccaa9a3b3ba63e'},editor)
    # ditto preserves the application bundle's symlinks and executable flags.
    subprocess.run(['ditto','-x','-k',str(editor),str(root)],check=True)
    templates=root/'templates.tpz'
    fetch({'url':base+'Godot_v4.7.2-stable_export_templates.tpz','sha256':'f298490b8d44d934be425a5a65a51bf15f422428b229a06a6e11d9ffea248011'},templates)
    target=Path.home()/'Library/Application Support/Godot/export_templates/4.7.2.stable'
    target.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(templates) as archive:
        members=[n for n in archive.namelist() if n.endswith('/ios.zip')]
        if len(members)!=1:raise ValueError('Expected exactly one iOS template')
        with archive.open(members[0]) as src,(target/'ios.zip').open('wb') as dst:
            import shutil
            shutil.copyfileobj(src,dst,1024*1024)
    executable=root/'Godot.app/Contents/MacOS/Godot'
    subprocess.run([str(executable),'--version'],check=True)
    # Delete only the two downloaded, verified archives in this fresh CI folder.
    editor.unlink();templates.unlink()
    print(json.dumps({'godot':str(executable),'template':str(target/'ios.zip')}))


if __name__=='__main__':main()
