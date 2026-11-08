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
import re
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
from raw_resources import verify_runtime_files
from verify_ipa import read_pck


BOARD_PARITY_V071_HANDOFF_SHA = '2dbc622be80fa9bfcde0e715b643016b0732847775a8e9ae759ec82d85aed2e2'
BOARD_PARITY_V071_SOURCES = {
    'native-adventure-gallery.js': '6334c4c0beea849423cc0ec9bde1657447ab6868569139386474b0a7e6d9dfe7',
    'native-battle-cosmetic-frame.js': 'b996589c458731ab28486f1f320eeac780ba67f64dee2dec100c988c754efbb6',
    'native-battle-scene.js': 'ac9455d6a9dfe57ae5f7a1d940edb6a8f8062055c7f91cbc192fe523c18f9dd6',
    'native-crew-markup.js': '8660f30422445b2011a978f9dcce2093869ecac9abc1e1996b606560b1d63b90',
    'native-game-controls.js': '9ee08fed2073bb7ae021d0665cfd1223a64817efd7cab82a1808ccf2cc17b6df',
    'native-game-runtime.js': 'd3ab7287789d984a5cee3497943eac853e76f8ceb4441149210000082ec8d56d',
    'native-modal-bridge.js': '9c4c266f0b2dbce0cc2e3272c7b945e9663a104906de5cdb4f1665c01be969a8',
    'native_adventure_gallery.gd': 'd1de3b5a3a399c0e5928a15904682d1e5f2a611112469bbdab48bdbd5aef7087',
    'native_app_stage.gd': 'd888c3965512ddc8401a278fc757fb9a688244fd5149774c07e6c1690ce2eae7',
    'native_backpack_modal.gd': '6aa5f0a7578ba873e837f0d6af299d66092ccd5a5a48bb0481dccd244a6ed1a4',
    'native_battle_cosmetic_frame.gd': '4d65dc6376045aa05294bfc14485ed31a5e62d3a24fb01a8132cb47300567c2d',
    'native_battle_cosmetic_layer.gdshader': 'c28fb0f1b15a6365509e18455fe226b2ae94cc70c64d399945459269e64e1cc7',
    'native_battle_timeline.gd': 'b524541d2d4a83e1fe9604aa9107193792614215316a87caad4491d0259ea730',
    'native_battle_view.gd': 'dbf86b8e29dfee48c30cee096ed37475bce2d0818a78935656bab83f30370b32',
    'native_cosmetic_modal.gd': '2369f0f739834d7886055026490c9673a2719412ed6ad044a214c841be84e895',
    'native_crew_modal.gd': 'b73e601969a539094b12a5d24b0b03c8c61b70fa603f96a048548aefc3dd5a56',
    'native_game_tools.gd': '171b84a4376d47df65d18687d2601e72cb92a5b590fa74ea5b53c94761eadf71',
    'native_map_hud.gd': 'c5deeb13b0738fa3df2d3765f4eda6c9d22eb1e08dec3b909fe3b889567300dc',
    'native_portrait_card.gd': 'c47e6af8b92836d8cbc15a4f1f988f623e412e5cbcd331ed70148ec8d20f41f8',
    'native_reward_choice_modal.gd': 'c58379ba29b659842cbcb9b5a4d5a42ecd574a6a1918896725d4afc9c7890220',
    'original-core.js': 'cfd150004227b2a53e29fee38bf1d5dc7b5e571f9c0550c3655949c7d6e2f975',
    'original-tot-stage.js': 'b306a61c945af8543f9db89dd0b1f0882848e175bbac58e145aa7bc933afbee4',
    'portrait_round_clip.gdshader': '8f3c740ff6701e5f4048afc110851d062b5b6519405d259bb2a777687416c633',
}
BOARD_PARITY_V071_RETAINED = {
    'native-turn-control-sync.js': 'fc7aef40dc49a1637cec1267a8b2b4f27a79177e6dfbbf982dd5de2ee102cbbb',
    'native_battle_stage.gd': 'e71248eb67e7a63d9fec1fcbe7d770282073529ab53e4c55bc79da26368d3ce4',
}


def sha(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream,'sha256').hexdigest()


def verify_board_pack(entries, project, names, *, immutable_remaps=False):
    records = {}
    for name in names:
        source = (project/name).read_bytes()
        packed = 'res://'+name
        remap_record = None
        if name.endswith('.gd'):
            compiled = packed[:-3]+'.gdc'
            remap_path = packed+'.remap'
            remap = entries.get(remap_path, b'')
            destination = ('path="'+compiled+'"').encode()
            if destination not in remap:
                raise ValueError('Board GDScript remap missing: '+name)
            if immutable_remaps:
                if re.fullmatch(rb'\[remap\]\s+'+re.escape(destination)+rb'\s*', remap) is None:
                    raise ValueError('Unexpected Board GDScript remap: '+name)
                remap_record = {'path': remap_path, 'sha256': hashlib.sha256(remap).hexdigest(), 'bytes': len(remap)}
            packed = compiled
        content = entries.get(packed)
        if not content or (name.endswith(('.js', '.json', '.gdshader')) and content != source):
            raise ValueError('Board resource missing or changed: '+name)
        if remap_record is not None and not content.startswith(b'GDSC'):
            raise ValueError('Unexpected Board GDScript payload: '+name)
        records[name] = {'sourceSha256': hashlib.sha256(source).hexdigest(),
                         'packedPath': packed, 'packedSha256': hashlib.sha256(content).hexdigest(),
                         'packedBytes': len(content)}
        if remap_record is not None:
            records[name]['remap'] = remap_record
    return records


def verify_board_update_host_v070(entries, project, out):
    expected_sources = {
        'original-core.js': '29930498f0307e979b422085c091e2fcba1fa95669a66797760675c4aec9facb',
        'native-turn-control-sync.js': 'fc7aef40dc49a1637cec1267a8b2b4f27a79177e6dfbbf982dd5de2ee102cbbb',
        'native_battle_stage.gd': 'e71248eb67e7a63d9fec1fcbe7d770282073529ab53e4c55bc79da26368d3ce4',
    }
    judicial = verify_board_pack(entries, project, expected_sources)
    for name, expected in expected_sources.items():
        if judicial[name]['sourceSha256'] != expected:
            raise ValueError('v070 Judicial Island input differs from handoff: '+name)
    host = verify_board_pack(entries, project, ('ios_host.gd', 'ios_board_update.gd',
        'ios_board_transport.gd', 'ios-board-program-v1.json', 'native-product-entry.js'))

    return {'bundledJudicialPrograms': judicial, 'hostResources': host,
        'qaFixture': make_board_qa_fixture(entries, out, judicial['native-turn-control-sync.js'], 70)}


def make_board_qa_fixture(entries, out, source, build):
    name = 'native-turn-control-sync.js'
    packed_path = source['packedPath']
    revision = f'qa-v{build:03d}-transport'
    baseline = entries[packed_path]
    marker = ("exports.boardUpdateRevision = '"+revision+"';").encode('ascii')
    if b'boardUpdateRevision' in baseline:
        raise ValueError('QA revision already present in shipped source')
    fixture = baseline + (b'' if baseline.endswith(b'\n') else b'\n') + marker + b'\n'
    artifact = out/'board-qa'/name
    artifact.parent.mkdir()
    artifact.write_bytes(fixture)
    return {'qaOnly': True, 'revision': revision,
            'file': artifact.relative_to(out).as_posix(), 'packedPath': packed_path,
            'baseSha256': source['packedSha256'],
            'sha256': hashlib.sha256(fixture).hexdigest(), 'bytes': len(fixture)}


def verify_board_parity_source_v071(project):
    for name, expected in {**BOARD_PARITY_V071_SOURCES, **BOARD_PARITY_V071_RETAINED}.items():
        if sha(project/name) != expected:
            raise ValueError('v071 Board input differs from handoff: '+name)


def verify_board_parity_host_v071(entries, project, out):
    verify_board_parity_source_v071(project)
    parity = verify_board_pack(entries, project, BOARD_PARITY_V071_SOURCES, immutable_remaps=True)
    retained = verify_board_pack(entries, project, BOARD_PARITY_V071_RETAINED, immutable_remaps=True)
    config_name = 'ios-board-program-v1.json'
    host = verify_board_pack(entries, project, ('ios_host.gd', 'ios_board_update.gd',
        'ios_board_transport.gd', config_name, 'native-product-entry.js'), immutable_remaps=True)
    config = json.loads(entries['res://'+config_name])
    channel = 'https://game-assets.rihdi.tw/ios/board-program/v1/host-71/'
    if (config['hostBuild'] != 71 or config['platform'] != 'ios' or config['qaVersion'] != 'Board QA v071.1'
            or config['manifestUrl'] != channel+'release.json' or config['blobBaseUrl'] != channel+'blobs/'
            or re.fullmatch('[0-9a-f]{64}', config['base']) is None):
        raise ValueError('Unexpected v071 Board update host config')

    packed = {
        record['packedPath'].removeprefix('res://'): {
            'sha256': record['packedSha256'], 'bytes': record['packedBytes'],
        }
        for record in (*parity.values(), *retained.values())
    }
    limits = config['resourceLimits']
    if (len(packed) != 25 or set(limits) != set(packed)
            or any(type(limit) is not int or limit < packed[name]['bytes'] for name, limit in limits.items())):
        raise ValueError('v071 Board packed resources and allowlist differ')

    return {
        'handoffSha256': BOARD_PARITY_V071_HANDOFF_SHA,
        'base': config['base'],
        'bundledParityPrograms': parity,
        'retainedBoardPrograms': retained,
        'hostResources': host,
        'allowlistedPackedResources': packed,
        'qaFixture': make_board_qa_fixture(entries, out, retained['native-turn-control-sync.js'], 71),
    }


def run(command, cwd, log, env=None):
    print('START '+log.name,flush=True)
    with log.open('w') as handle:
        result=subprocess.run([str(x) for x in command],cwd=cwd,env=env,stdout=handle,stderr=subprocess.STDOUT,timeout=1800)
    if result.returncode:
        print(log.read_text(errors='replace')[-18000:],flush=True)
        raise RuntimeError('Build failed; inspect '+str(log))
    print('PASS '+log.name,flush=True)


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
    board = parser.add_mutually_exclusive_group()
    board.add_argument('--board-update-host-v070',action='store_true',
                       help='Verify the exact Judicial Island baseline and prepare a separate unsigned Board QA blob')
    board.add_argument('--board-parity-host-v071',action='store_true',
                       help='Verify the exact Board parity baseline and prepare a separate unsigned Board QA blob')
    args=parser.parse_args()
    if sys.platform!='darwin': parser.error('macOS/Xcode required; no Windows build success may be reported')
    candidate=args.candidate.resolve(); out=args.out.resolve()
    if out.exists(): raise ValueError('Use a new build output folder')
    lock=json.loads((candidate/'dependencies.json').read_text())
    for name,expected in json.loads((candidate/'input-sha256.json').read_text()).items():
        file=(candidate/name).resolve()
        if not file.is_relative_to(candidate) or sha(file)!=expected: raise ValueError('Candidate input changed: '+name)
    if args.board_parity_host_v071:
        verify_board_parity_source_v071(candidate/'project')
    version=subprocess.check_output([str(args.godot),'--version'],text=True).strip()
    if not version.startswith('4.7.2.stable'): raise ValueError('Exact verified Godot 4.7.2 required')
    subprocess.run(['xcrun','--sdk','iphoneos','--show-sdk-path'],check=True,stdout=subprocess.DEVNULL)
    sdk_version=subprocess.check_output(['xcrun','--sdk','iphoneos','--show-sdk-version'],text=True).strip()
    if int(sdk_version.split('.')[0])<26:raise ValueError('Godot 4.7.2 template requires iOS SDK 26 or newer')
    scons_version=subprocess.check_output([sys.executable,'-m','SCons','--version'],text=True)
    if '4.11.1' not in scons_version: raise ValueError('Install SCons 4.11.1 in this build environment')
    out.mkdir(parents=True); logs=out/'logs';logs.mkdir()
    project=out/'project';shutil.copytree(candidate/'project',project)
    native=out/'native';shutil.copytree(candidate/'native',native)
    run(['clang','-fobjc-arc','-framework','Cocoa','-framework','WebKit','-I',native,candidate/'tools/check_launcher_webkit.m','-o',out/'launcher-webkit-check'],out,logs/'launcher-check-compile.log')
    run([out/'launcher-webkit-check',candidate/'bundle-resources/launcher-web'],out,logs/'launcher-webkit-check.log')
    run(['clang++','-fobjc-arc','-framework','Cocoa','-framework','WebKit','-I',native,candidate/'tools/check_marineford_webkit.mm','-o',out/'marineford-webkit-check'],out,logs/'marineford-check-compile.log')
    run([sys.executable,'-B',candidate/'tools/prepare_marineford_fixture.py','--assets',candidate/'bundle-resources/launcher-web','--out',out/'marineford-fixtures'],out,logs/'marineford-fixture.log')
    run([out/'marineford-webkit-check',candidate/'bundle-resources/launcher-web',out/'marineford-fixtures',candidate/'tools/fixtures'],out,logs/'marineford-webkit-check.log')
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
    # OS is required by godot-cpp's own print_string.cpp, not just our bridge.
    profile.write_text(json.dumps({'enabled_classes':['RefCounted','OS']}))
    run([sys.executable,'-m','SCons','platform=ios','arch=arm64','api_version=4.7','build_profile='+str(profile),'target=template_release','ios_simulator=no','ios_min_version=16.0','debug_symbols=no','-j3'],native,logs/'native-bridge.log',env)
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
    packs=list(app.rglob('*.pck'))
    if len(packs)!=1:raise ValueError('Expected one exported game pack')
    entries=read_pck(packs[0].read_bytes())
    raw_verified=verify_runtime_files(entries,candidate/'project')
    board_level_up_pack=verify_board_pack(entries,candidate/'project',
        ('native-game-runtime.js', 'native_app_stage.gd', 'native_crew_level_up_hud.gd',
         'original-board-audio.js', 'original-core.js'))
    board_material_guide_pack=verify_board_pack(entries,candidate/'project',
        ('native-crew-markup.js', 'native_crew_modal.gd', 'original-core.js'))
    board_cpu_recovery_pack=verify_board_pack(entries,candidate/'project',
        ('native_hospital_modal.gd', 'native_mission_board_modal.gd', 'native_mission_journal_modal.gd', 'native_research_modal.gd', 'native_shop_modal.gd', 'native_tavern_modal.gd', 'original-core.js'))
    if args.board_update_host_v070:
        board_update_host = verify_board_update_host_v070(entries,candidate/'project',out)
    if args.board_parity_host_v071:
        board_parity_host = verify_board_parity_host_v071(entries,candidate/'project',out)
    del entries
    shutil.copytree(candidate/'bundle-resources',app,dirs_exist_ok=True)
    launcher=json.loads((candidate/'launcher-manifest.json').read_text())
    for record in launcher['files']:
        if sha(app/'launcher-web'/record['path'])!=record['sha256']:raise ValueError('Launcher bundle mismatch: '+record['path'])
    info=plistlib.loads((app/'Info.plist').read_bytes())
    if info['CFBundleIdentifier']!='tw.rihdi.po.native.ios': raise ValueError('Unexpected bundle identifier')
    if args.board_update_host_v070 and int(info['CFBundleVersion']) != 70:
        raise ValueError('Unexpected Board update host build number')
    if args.board_parity_host_v071 and int(info['CFBundleVersion']) != 71:
        raise ValueError('Unexpected Board parity host build number')
    executable=app/info['CFBundleExecutable']
    arch=subprocess.check_output(['lipo','-archs',str(executable)],text=True).strip()
    if arch!='arm64': raise ValueError('Unexpected device architectures')
    symbol_targets=[executable,*app.rglob('*.dylib')]
    for framework in app.rglob('*.framework'):
        metadata=framework/'Info.plist'
        if metadata.is_file():
            binary=framework/plistlib.loads(metadata.read_bytes())['CFBundleExecutable']
            if binary.is_file():symbol_targets.append(binary)
    stripped=[]
    for file in dict.fromkeys(symbol_targets):
        if not file.resolve().is_relative_to(app.resolve()):raise ValueError('Native binary escaped unsigned app')
        before=file.stat().st_size
        # Keep external entry points and all code/data. Remove only local/debug symbols
        # from the unsigned development payload before the owner signs it.
        run(['xcrun','strip','-S','-x',file],out,logs/('strip-'+str(len(stripped))+'.log'))
        stripped.append({'path':file.relative_to(app).as_posix(),'before':before,'after':file.stat().st_size})
    for needle in ['jsb_gdextension_init','po_ios_bridge_init']:
        found=False
        for file in symbol_targets:
            symbols=subprocess.run(['nm','-gU',str(file)],capture_output=True,text=True)
            if needle in symbols.stdout:
                if subprocess.check_output(['lipo','-archs',str(file)],text=True).strip()!='arm64':raise ValueError('Extension architecture mismatch')
                found=True
        if not found: raise ValueError('Missing native entry symbol: '+needle)
    package=out/'PO-iOS-UNSIGNED.ipa'
    with zipfile.ZipFile(package,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
        for file in app.rglob('*'):
            if file.is_file(): archive.write(file,'Payload/'+app.name+'/'+file.relative_to(app).as_posix())
    report={'macCompiled':True,'signed':False,'iphoneTested':False,'installableAsIs':False,
        'architectures':arch,'package':package.name,'sha256':sha(package),'bytes':package.stat().st_size,
        'baselineVersion':38,'cloudCostVerified':False,'warning':'Owner signing and physical iPhone acceptance required'}
    report['rawRuntimeResourcesByteIdentical']=raw_verified
    report['boardLevelUpPack']=board_level_up_pack
    report['boardMaterialGuidePack']=board_material_guide_pack
    report['boardCpuRecoveryPack']=board_cpu_recovery_pack
    if args.board_update_host_v070:
        report['boardUpdateHost'] = board_update_host
    if args.board_parity_host_v071:
        report['boardParityHost'] = board_parity_host
    report['macWebKitLauncherChecked']=True
    report['macWebKitMarinefordChecked']=True
    report['macWebKitMarinefordProgramChecked']=True
    report['versionCode']=int(info['CFBundleVersion'])
    report['minimumOS']=info['MinimumOSVersion']
    report['strippedLocalAndDebugSymbols']=stripped
    with zipfile.ZipFile(package) as archive:
        report['largestCompressedEntries']=[{'path':x.filename,'bytes':x.compress_size} for x in sorted(archive.infolist(),key=lambda x:x.compress_size,reverse=True)[:12]]
    (out/'build-result.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))


if __name__=='__main__': main()
