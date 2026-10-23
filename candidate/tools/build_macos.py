"""Build an unsigned device candidate on Mac. Never signs or starts paid services.

Requires Xcode, SCons 4.11.1, and the exact Godot 4.7.2 editor/iOS template.
Network operations fetch only SHA-pinned QuickJS and godot-cpp dependencies.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import plistlib
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile


def sha(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream,'sha256').hexdigest()


def run(command, cwd, log, env=None):
    with log.open('w') as handle:
        result=subprocess.run([str(x) for x in command],cwd=cwd,env=env,stdout=handle,stderr=subprocess.STDOUT,timeout=1800)
    if result.returncode:
        print(log.read_text(errors='replace')[-18000:],flush=True)
        raise RuntimeError('Build failed; inspect '+str(log))


def fetch(dependency, target):
    if target.exists():
        if sha(target)!=dependency['sha256']: raise ValueError('Existing dependency hash mismatch')
        return
    partial=target.with_suffix(target.suffix+'.partial')
    with urllib.request.urlopen(dependency['url'],timeout=90) as response, partial.open('wb') as output:
        shutil.copyfileobj(response,output,1024*1024)
    if sha(partial)!=dependency['sha256']: raise ValueError('Downloaded dependency hash mismatch')
    partial.rename(target)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--candidate',type=Path,required=True)
    parser.add_argument('--godot',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    if sys.platform!='darwin': parser.error('macOS/Xcode required; no Windows build success may be reported')
    candidate=args.candidate.resolve(); out=args.out.resolve()
    if out.exists(): raise ValueError('Use a new build output folder')
    lock=json.loads((candidate/'dependencies.json').read_text())
    for name,expected in json.loads((candidate/'input-sha256.json').read_text()).items():
        file=(candidate/name).resolve()
        if not file.is_relative_to(candidate) or sha(file)!=expected: raise ValueError('Candidate input changed: '+name)
    version=subprocess.check_output([str(args.godot),'--version'],text=True).strip()
    if not version.startswith('4.7.2.stable'): raise ValueError('Exact verified Godot 4.7.2 required')
    subprocess.run(['xcrun','--sdk','iphoneos','--show-sdk-path'],check=True,stdout=subprocess.DEVNULL)
    scons_version=subprocess.check_output([sys.executable,'-m','SCons','--version'],text=True)
    if '4.11.1' not in scons_version: raise ValueError('Install SCons 4.11.1 in this build environment')
    out.mkdir(parents=True); logs=out/'logs';logs.mkdir()
    project=out/'project';shutil.copytree(candidate/'project',project)
    native=out/'native';shutil.copytree(candidate/'native',native)
    vendor=out/'vendor';vendor.mkdir()
    js_zip=vendor/'godotjs.zip';fetch(lock['godotjs'],js_zip)
    addon=project/'addons/godotjs-ext.daylily-zeleen'
    with zipfile.ZipFile(js_zip) as archive:
        for entry in archive.infolist():
            rel='/'.join(entry.filename.split('/')[1:])
            if not rel or entry.is_dir() or not (rel.startswith(('bin/ios/','bin/macos/')) or rel in ['LICENSE','godotjs-ext.gdextension']): continue
            file=(addon/rel).resolve()
            if not file.is_relative_to(addon.resolve()): raise ValueError('Unsafe archive path')
            file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(archive.read(entry))
    cpp_tar=vendor/'godot-cpp.tar.gz';fetch(lock['godotCpp'],cpp_tar)
    cpp=vendor/'godot-cpp';cpp.mkdir()
    with tarfile.open(cpp_tar) as archive:
        for entry in archive:
            if not entry.isfile(): continue
            rel='/'.join(entry.name.split('/')[1:]);file=(cpp/rel).resolve()
            if not file.is_relative_to(cpp): raise ValueError('Unsafe godot-cpp archive path')
            file.parent.mkdir(parents=True,exist_ok=True);file.write_bytes(archive.extractfile(entry).read())
    env={**os.environ,'GODOT_CPP_DIR':str(cpp)}
    profile=native/'bridge-api-profile.json'
    profile.write_text(json.dumps({'enabled_classes':['RefCounted']}))
    run([sys.executable,'-m','SCons','platform=ios','arch=arm64','api_version=4.7','build_profile='+str(profile),'target=template_release','ios_simulator=no','debug_symbols=no','-j3'],native,logs/'native-bridge.log',env)
    libraries=list((native/'bin').glob('*.dylib'))
    if len(libraries)!=1: raise ValueError('Expected one iOS bridge dylib')
    bridge=project/'addons/po-ios/po-ios.xcframework'
    bridge.parent.mkdir(parents=True,exist_ok=True)
    run(['xcodebuild','-create-xcframework','-library',libraries[0],'-output',bridge],out,logs/'bridge-framework.log')
    (bridge.parent/'po-ios.gdextension').write_text('''[configuration]
entry_symbol="po_ios_bridge_init"
compatibility_minimum="4.7"
reloadable=false
[libraries]
ios.release="res://addons/po-ios/po-ios.xcframework"
''')
    # The build has no Apple signing identity. UNSIGNED is a generator placeholder
    # solely to satisfy Godot's non-empty team field; xcodebuild signing is OFF.
    preset=project/'export_presets.cfg'
    preset.write_text(preset.read_text().replace('application/app_store_team_id=""','application/app_store_team_id="UNSIGNED"'))
    # JS language must exist during editor import. Do not try loading the iOS-only
    # bridge on macOS; it is registered automatically in the exported iOS build.
    extensions=project/'.godot/extension_list.cfg'
    extensions.parent.mkdir(exist_ok=True)
    extensions.write_text('res://addons/godotjs-ext.daylily-zeleen/godotjs-ext.gdextension\n')
    run([args.godot,'--headless','--editor','--path',project,'--import'],out,logs/'editor-import.log')
    export=out/'xcode';export.mkdir()
    run([args.godot,'--headless','--path',project,'--export-release','iOS',export/'PO.zip'],out,logs/'godot-export.log')
    projects=list(export.glob('*.xcodeproj'))
    if len(projects)!=1: raise ValueError('Expected exactly one exported Xcode project')
    scheme_info=json.loads(subprocess.check_output(['xcodebuild','-list','-json','-project',str(projects[0])],text=True))
    schemes=scheme_info['project']['schemes']
    if len(schemes)!=1: raise ValueError('Ambiguous Xcode scheme; inspect export')
    run(['xcodebuild','-project',projects[0],'-scheme',schemes[0],'-configuration','Release','-sdk','iphoneos','-destination','generic/platform=iOS','-derivedDataPath',out/'derived','CODE_SIGNING_ALLOWED=NO','CODE_SIGNING_REQUIRED=NO','CODE_SIGN_IDENTITY=','DEVELOPMENT_TEAM=','build'],out,logs/'xcode-device.log')
    apps=list((out/'derived/Build/Products/Release-iphoneos').glob('*.app'))
    if len(apps)!=1: raise ValueError('Unsigned device app missing')
    app=apps[0]
    shutil.copytree(candidate/'bundle-resources/.godot',app/'.godot',dirs_exist_ok=True)
    info=plistlib.loads((app/'Info.plist').read_bytes())
    if info['CFBundleIdentifier']!='tw.rihdi.po.native.ios': raise ValueError('Unexpected bundle identifier')
    executable=app/info['CFBundleExecutable']
    arch=subprocess.check_output(['lipo','-archs',str(executable)],text=True).strip()
    if arch!='arm64': raise ValueError('Unexpected device architectures')
    for needle in ['jsb_gdextension_init','po_ios_bridge_init']:
        found=False
        for file in app.rglob('*'):
            if file.is_file() and (file.suffix=='.dylib' or file==executable):
                symbols=subprocess.run(['nm','-gU',str(file)],capture_output=True,text=True)
                if needle in symbols.stdout: found=True
        if not found: raise ValueError('Missing native entry symbol: '+needle)
    package=out/'PO-iOS-UNSIGNED.ipa'
    with zipfile.ZipFile(package,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=3) as archive:
        for file in app.rglob('*'):
            if file.is_file(): archive.write(file,'Payload/'+app.name+'/'+file.relative_to(app).as_posix())
    report={'macCompiled':True,'signed':False,'iphoneTested':False,'installableAsIs':False,
        'architectures':arch,'package':package.name,'sha256':sha(package),'bytes':package.stat().st_size,
        'baselineVersion':38,'cloudCostVerified':False,'warning':'Owner signing and physical iPhone acceptance required'}
    (out/'build-result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))


if __name__=='__main__': main()
