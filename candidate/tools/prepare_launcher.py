"""Copy the APK launcher renderer/art, changing only the iOS transport/origin."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil


def prepare_launcher(source, candidate):
    source=Path(source);candidate=Path(candidate)
    target=candidate/'bundle-resources/launcher-web'
    if target.exists():raise ValueError('Use a fresh launcher bundle directory')
    files=[]
    for folder in ['launcher','launcher-assets']:
        for file in sorted((source/folder).rglob('*')):
            if not file.is_file():continue
            if file.is_symlink():raise ValueError('Do not copy resource symlinks')
            relative=file.relative_to(source)
            destination=target/relative;destination.parent.mkdir(parents=True,exist_ok=True)
            data=file.read_bytes();original=hashlib.sha256(data).hexdigest()
            if folder=='launcher' and file.suffix in ['.html','.js','.css']:
                text=data.decode('utf8').replace('https://appassets.androidplatform.net','poapp://app')
                text=text.replace('https:\\/\\/appassets\\.androidplatform\\.net','poapp:\\/\\/app')
                text=text.replace('Android 啟動器','iOS 啟動器').replace('Android app storage','iPhone App 儲存空間')
                if file.name=='index.html':
                    text=text.replace('<script src="mobile-bridge.js">','<script src="ios-transport.js"></script>\n<script src="mobile-bridge.js">')
                    text=text.replace("'self'", "'self' poapp:")
                data=text.encode('utf8')
            destination.write_bytes(data)
            files.append({'path':relative.as_posix(),'sourceSha256':original,'sha256':hashlib.sha256(data).hexdigest(),'size':len(data)})
    transport=target/'launcher/ios-transport.js'
    transport.write_text("""'use strict';
window.TabletopAndroid=Object.freeze({postMessage:message=>window.webkit.messageHandlers.tabletop.postMessage(message)});
window.__poLauncherPause=()=>{for(const media of document.querySelectorAll('audio,video'))media.pause();};
""",encoding='utf8')
    files.append({'path':'launcher/ios-transport.js','sha256':hashlib.sha256(transport.read_bytes()).hexdigest(),'size':transport.stat().st_size})
    index=(target/'launcher/index.html').read_text(encoding='utf8')
    if 'ios-transport.js' not in index:raise ValueError('Transport insertion failed')
    manifest={'schema':1,'source':'verified APK launcher assets','files':files,'bytes':sum(f['size'] for f in files)}
    (candidate/'launcher-manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    return manifest


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,required=True);parser.add_argument('--candidate',type=Path,required=True)
    args=parser.parse_args();result=prepare_launcher(args.source,args.candidate)
    print(json.dumps({'launcherFiles':len(result['files']),'bytes':result['bytes']}))
