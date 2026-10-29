"""Create an isolated iOS candidate from a verified native product generation.

Does not edit Android sources, install apps, sign, upload, or start cloud jobs.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import urllib.request
from raw_resources import keep_runtime_files

IOS = Path(__file__).resolve().parents[1]
ROOT = IOS.parent


def sha(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise ValueError('Platform adaptation anchor changed: ' + before[:100])
    return text.replace(before, after)


def adapt(name, text):
    if name in ['native_asset_cache.gd', 'native_audio_transport.gd', 'native_battle_audio.gd', 'native_nika_video.gd', 'native_katakuri_cinematic.gd']:
        text = text.replace('OS.get_name()=="Android"','OS.get_name() in ["Android","iOS"]').replace('OS.get_name()!="Android"','OS.get_name() not in ["Android","iOS"]')
    if name == 'native_android_account.gd':
        text = text.replace('Android secure session service unavailable','Secure session service unavailable')
    if name == 'native_nika_video.gd':
        text = replace_once(text, '\t\telse:android_plugin.call("play",android_ticket,source,muted or muted_for_test,profile=="marineford")', '\t\telse:android_plugin.call("play",android_ticket,source,muted or muted_for_test,profile=="marineford")\n\t\tif OS.get_name()=="iOS":android_plugin.call("volume",android_ticket,playback_volume)')
    if name == 'native_websocket_pool.gd':
        text = replace_once(text,'ONEPIECE_TABLETOP_ANDROID/0.1.0','ONEPIECE_TABLETOP_IOS/0.1.0')
    if name == 'native-product.tscn':
        text = replace_once(text, 'res://native_product_root.gd', 'res://ios_product_root.gd')
    if name == 'original-account.js':
        text = replace_once(text, ' async clear(){active();await auth.clearAccount();return broadcast();},',
            " async authenticate(credentials){active();await ensureLoaded();active();return auth.authenticate('login',credentials);},\n async clear(){active();await auth.clearAccount();return broadcast();},")
    if name == 'native-account-service.js':
        text = replace_once(text, 'load:()=>account.load(),', 'authenticate:credentials=>account.authenticate(credentials),load:()=>account.load(),')
    if name == 'native-product-entry.js':
        text = text.replace('root.get_tree().quit()', "root.get_parent().call_deferred('return_to_launcher')")
    if name == 'native_screen_metrics.gd':
        text = replace_once(text, '\treturn maxf(.01,', '\tif OS.get_name()=="iOS" and Engine.has_singleton("PoNativeSession"):\n\t\tvar bridge: Object=Engine.get_singleton("PoNativeSession").get("bridge")\n\t\tif bridge!=null:density=maxf(1.0,float(bridge.call("display_scale")))\n\treturn maxf(.01,')
    return text


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--product', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--media-manifest', type=Path)
    parser.add_argument('--card-media-manifest', type=Path)
    args = parser.parse_args()
    lock = json.loads((IOS/'dependencies.json').read_text())
    product = args.product.resolve()
    manifest_path = product.parent/'manifest.json'
    if sha(manifest_path) != lock['productManifestSha256']:
        raise ValueError('Source is not the pinned, verified v038 product')
    manifest = json.loads(manifest_path.read_text())
    if args.out.exists():
        raise ValueError('Use a new output directory; never overwrite a candidate')
    out = args.out.resolve()
    # Validate the entire generation before writing a new candidate.
    for record in manifest['files']:
        file = (product/record['path']).resolve()
        if not file.is_relative_to(product) or file.is_symlink() or sha(file) != record['sha256']:
            raise ValueError('Product source changed: '+record['path'])
    if args.media_manifest:
        raw = args.media_manifest.read_bytes()
    else:
        with urllib.request.urlopen(lock['media']['url'], timeout=40) as response:
            raw = response.read(8*1024*1024+1)
    if hashlib.sha256(raw).hexdigest() != lock['media']['sha256']:
        raise ValueError('Published media manifest differs from pinned release')
    media_manifest = json.loads(raw)
    media = {}
    records = media_manifest.get('assets', media_manifest.get('files', []))
    if any(record['path'] == 'native-card.tscn' for record in manifest['files']):
        card_lock = lock.get('cardMedia')
        if not card_lock or card_lock.get('blobBase') != lock['media']['blobBase']:
            raise ValueError('Native Card requires a pinned compatible media catalog')
        if args.card_media_manifest:
            card_raw = args.card_media_manifest.read_bytes()
        else:
            with urllib.request.urlopen(card_lock['url'], timeout=40) as response:
                card_raw = response.read(8*1024*1024+1)
        if hashlib.sha256(card_raw).hexdigest() != card_lock['sha256']:
            raise ValueError('Card media catalog differs from pinned release')
        card_manifest = json.loads(card_raw)
        records = list(records) + card_manifest.get('assets', card_manifest.get('files', []))
    for record in records:
        if record.get('kind') not in ['image','audio','video','font']:
            continue
        path = record['path']
        if not path or path.startswith('/') or '\\' in path or ':' in path or '..' in path.split('/'):
            raise ValueError('Invalid or duplicate media path')
        if not re.fullmatch('[0-9a-f]{64}', record['sha256']) or type(record['size']) is not int or record['size'] <= 0:
            raise ValueError('Invalid media integrity record')
        entry = {k:record[k] for k in ['kind','sha256','size']}
        if path in media and media[path] != entry:
            raise ValueError('Conflicting native Board/Card media: ' + path)
        media[path] = entry
    if not media:
        raise ValueError('No media catalog entries')
    if shutil.disk_usage(out.parent).free < sum(x['size'] for x in manifest['files']) + 128*1024*1024:
        raise ValueError('Insufficient space to prepare without deleting retained builds')
    out.mkdir(parents=True)
    project = out/'project'
    project.mkdir()
    adapted, preserved = [], []
    for record in manifest['files']:
        name = record['path']
        if name in ['project.godot', 'project.binary', 'native/po-runtime.gdextension']:
            continue
        source = product/name
        destination = project/name
        destination.parent.mkdir(parents=True,exist_ok=True)
        if source.suffix in ['.gd','.js','.tscn']:
            original = source.read_text(encoding='utf8')
            changed = adapt(name,original)
            if changed != original:
                destination.write_text(changed,encoding='utf8',newline='\n')
                adapted.append({'path':name,'baselineSha256':record['sha256'],'iosSha256':sha(destination)})
                continue
        shutil.copyfile(source,destination)
        preserved.append(record)
    for source in (IOS/'overlay').iterdir():
        if source.is_file(): shutil.copyfile(source,project/source.name)
    keep_runtime_files(project)
    (project/'ios-media.json').write_text(json.dumps(media,separators=(',',':'),ensure_ascii=False),encoding='utf8')
    # The extension uses globalize_path. A physical copy goes inside the final
    # .app before signing; it must not depend on metadata buried only in a PCK.
    metadata = project/'.godot/.api_dumping'
    shutil.copytree(metadata,out/'bundle-resources/.godot/.api_dumping')
    (project/'project.godot').write_text('''config_version=5
[application]
config/name="PIRATE ODYSSEY"
run/main_scene="res://ios_host.tscn"
config/features=PackedStringArray("4.7", "GL Compatibility")
[autoload]
IOSServices="*res://ios_services.gd"
[display]
window/size/viewport_width=960
window/size/viewport_height=432
window/stretch/mode="canvas_items"
window/stretch/aspect="expand"
window/handheld/orientation=0
[rendering]
renderer/rendering_method="gl_compatibility"
renderer/rendering_method.mobile="gl_compatibility"
textures/vram_compression/import_etc2_astc=true
[input_devices]
pointing/emulate_mouse_from_touch=true
''',encoding='utf8')
    shutil.copyfile(IOS/'export_presets.cfg',project/'export_presets.cfg')
    shutil.copytree(IOS/'native',out/'native')
    shutil.copytree(IOS/'tools',out/'tools',ignore=shutil.ignore_patterns('__pycache__'))
    shutil.copyfile(IOS/'dependencies.json',out/'dependencies.json')
    shutil.copyfile(IOS/'README.md',out/'README.md')
    icon = ROOT/'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'
    if not icon.is_file(): raise ValueError('Original launcher icon unavailable')
    shutil.copyfile(icon,project/'ios-icon.png')
    (out/'media-manifest.json').write_bytes(raw)
    report = {'schema':1,'baselineNativeVersion':lock['androidBaseline'],'baselineManifestSha256':sha(manifest_path),
        'preservedFiles':len(preserved),'platformAdaptations':adapted,'mediaFiles':len(media),
        'mediaBytes':sum(x['size'] for x in media.values()),'mediaDownloadedLocally':False,
        'macCompiled':False,'signed':False,'iphoneTested':False,'cloudJobDispatched':False,
        'paidServicesAuthorized':False,'androidSourceChanged':False}
    (out/'preparation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    checksums={str(p.relative_to(out)).replace('\\','/'):sha(p) for p in out.rglob('*') if p.is_file()}
    (out/'input-sha256.json').write_text(json.dumps(checksums,indent=2)+'\n',encoding='utf8')
    print(json.dumps(report))


if __name__ == '__main__': main()
