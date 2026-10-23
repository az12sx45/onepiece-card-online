"""Refresh only declared platform adapters in a prepared, unshipped candidate."""
import argparse
import json
from pathlib import Path
import shutil
from prepare import IOS, adapt, sha
from raw_resources import keep_runtime_files


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--candidate',type=Path,required=True)
    parser.add_argument('--product',type=Path,required=True)
    parser.add_argument('--windows-check',action='store_true')
    args=parser.parse_args()
    target=args.candidate.resolve();product=args.product.resolve()
    report=json.loads((target/'preparation.json').read_text())
    lock=json.loads((IOS/'dependencies.json').read_text())
    if report['macCompiled'] or report['signed'] or report['cloudJobDispatched']:
        raise ValueError('Cannot mutate a built, signed or uploaded candidate')
    if sha(product.parent/'manifest.json')!=lock['productManifestSha256'] or report['baselineManifestSha256']!=lock['productManifestSha256']:
        raise ValueError('Baseline identity mismatch')
    manifest=json.loads((product.parent/'manifest.json').read_text())
    project=target/'project'
    preserved=0;changes=[]
    for entry in manifest['files']:
        name=entry['path']
        if name in ['project.godot','project.binary','native/po-runtime.gdextension']:continue
        source=product/name;destination=project/name
        if source.suffix in ['.gd','.js','.tscn']:
            original=source.read_text(encoding='utf8');after=adapt(name,original)
            if original!=after:
                if sha(source)!=entry['sha256']:raise ValueError('Baseline adapter changed')
                destination.write_text(after,encoding='utf8',newline='\n')
                changes.append({'path':name,'baselineSha256':entry['sha256'],'iosSha256':sha(destination)})
                continue
        if sha(destination)!=entry['sha256']:raise ValueError('Unapproved gameplay/art change: '+name)
        preserved+=1
    for source in (IOS/'overlay').iterdir():
        if source.is_file():shutil.copyfile(source,project/source.name)
    keep_runtime_files(project)
    shutil.copyfile(IOS/'export_presets.cfg',project/'export_presets.cfg')
    for folder in ['tools','native']:
        shutil.copytree(IOS/folder,target/folder,dirs_exist_ok=True,ignore=shutil.ignore_patterns('__pycache__'))
    for name in ['dependencies.json','README.md']:shutil.copyfile(IOS/name,target/name)
    if args.windows_check:
        extension=IOS.parent/'godot-pilot/runtime-probe/addons/godotjs-ext.daylily-zeleen/godotjs-ext.gdextension'
        (project/'.godot/extension_list.cfg').write_text(extension.as_posix()+'\n')
    else:
        (project/'.godot/extension_list.cfg').write_text('res://addons/godotjs-ext.daylily-zeleen/godotjs-ext.gdextension\nres://addons/po-ios/po-ios.gdextension\n')
    report.update(preservedFiles=preserved,platformAdaptations=changes,windowsCheckBinding=args.windows_check)
    (target/'preparation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    checksums={str(p.relative_to(target)).replace('\\','/'):sha(p) for p in target.rglob('*') if p.is_file() and p.name!='input-sha256.json' and '__pycache__' not in p.parts}
    (target/'input-sha256.json').write_text(json.dumps(checksums,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'preservedFiles':preserved,'platformAdaptations':len(changes),'sealedInputs':len(checksums),'windowsCheckBinding':args.windows_check}))


if __name__=='__main__':main()
