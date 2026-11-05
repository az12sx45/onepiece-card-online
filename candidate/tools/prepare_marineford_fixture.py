"""Build deterministic native test fixtures using independent standard JSON hashing."""
import argparse
import hashlib
import json
from pathlib import Path

def digest(data):
    return hashlib.sha256(data).hexdigest()

def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--assets', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=False)
    source = args.out/'source'
    source.mkdir()
    types = {
        'marineford/index.html': ('document','text/html'),
        'marineford/marineford.css': ('style','text/css'),
        'marineford/marineford.js': ('script','text/javascript'),
        'marineford/sound.js': ('script','text/javascript'),
        'marineford/cards.json': ('data','application/json'),
        'vendor/socket.io-client/4.8.1/socket.io.min.js': ('script','text/javascript'),
        'marineford/art/v2/test-a.webp': ('image','image/webp'),
        'images/board/avatars/8.webp': ('image','image/webp')
    }
    types.update({'marineford/audio/native-tone.wav':('audio','audio/wav'),
                  'marineford/videos/native-blue.mp4':('video','video/mp4'),
                  'marineford/fonts/native-fixture.woff':('font','font/woff')})
    html = b"""<!doctype html><html><head><link rel="stylesheet" href="marineford.css?fixture=1"></head><body><script src="/vendor/socket.io-client/4.8.1/socket.io.min.js"></script><script src="sound.js"></script><script src="marineford.js?fixture=1"></script></body></html>"""
    main_script = b"""(async()=>{
      const cards=await (await fetch('cards.json')).json();
      const avatar=new Image();avatar.src='/images/board/avatars/8.webp';document.body.append(avatar);
      const art=new Image();art.src='art/v2/test-a.webp';document.body.append(art);
      await Promise.all([avatar.decode(),art.decode()]);
      const audio=new Audio('audio/native-tone.wav');audio.preload='auto';audio.load();
      const video=document.createElement('video');video.muted=true;video.playsInline=true;
      video.src='videos/native-blue.mp4';video.preload='metadata';document.body.append(video);video.load();
      const metadata=element=>new Promise((resolve,reject)=>{
        if(element.readyState>=1)return resolve();
        element.addEventListener('loadedmetadata',resolve,{once:true});
        element.addEventListener('error',()=>reject(Error('media decode failed')),{once:true});
        setTimeout(()=>reject(Error('media metadata timeout')),5000);
      });
      await Promise.all([metadata(audio),metadata(video)]);
      const font=await document.fonts.load('16px "PO Media Fixture"','A');
      const dynamicFont=await new FontFace('PO Dynamic Fixture','url("fonts/native-fixture.woff")').load();
      const range=await fetch('audio/native-tone.wav',{headers:{Range:'bytes=0-7'}});
      const rangeBytes=await range.arrayBuffer();
      const invalid=await fetch('videos/native-blue.mp4',{headers:{Range:'bytes=999999-'}});
      const missing=await fetch('audio/not-in-manifest.wav');
      let unknownProgramBlocked=false;
      try{await fetch('/marineford/not-in-manifest.js');}catch(_){unknownProgramBlocked=true;}
      const missingImage=new Image();
      const missingImageBlocked=await new Promise(resolve=>{
        missingImage.onload=()=>resolve(false);missingImage.onerror=()=>resolve(true);
        missingImage.src='art/v2/not-in-manifest.webp';setTimeout(()=>resolve(false),2000);
      });
      const context=new AudioContext();
      const decoded=await context.decodeAudioData(await (await fetch('audio/native-tone.wav')).arrayBuffer());
      await context.close();
      const socket=io({autoConnect:false,reconnection:false});
      const uri=socket.io.uri;socket.disconnect();
      let network=true;
      if(window.__PO_FIXTURE_NETWORK_PROBE__){
        const proof=await fetch('/api/desktop-runtime-package/marineford');
        if(!proof.ok||(await proof.json()).gameId!=='marineford')throw Error('official API blocked');
        network=await new Promise((resolve,reject)=>{
          const websocket=new WebSocket('wss://onepiece-card-online.onrender.com/socket.io/?EIO=4&transport=websocket');
          const timeout=setTimeout(()=>{websocket.close();reject(Error('official socket timeout'));},8000);
          websocket.onmessage=event=>{if(String(event.data).startsWith('0{')){clearTimeout(timeout);websocket.close();resolve(true);}};
          websocket.onerror=()=>{clearTimeout(timeout);reject(Error('official socket blocked'));};
        });
      }
      const previous=Number(localStorage.getItem('__po_program_test')||0);
      localStorage.setItem('__po_program_test',String(previous+1));
      webkit.messageHandlers.result.postMessage({origin:location.origin,version:cards[0].version,
        secret:localStorage.getItem('opSecret')==='fixture-secret',socket:uri,previous,
        avatar:avatar.getAttribute('src'),art:art.getAttribute('src'),
        audio:audio.src.startsWith('data:audio/wav;'),video:video.src.startsWith('data:video/mp4;'),
        audioDecoded:decoded.duration>0,videoDecoded:video.videoWidth===16&&video.duration>0,
        font:font.length>0&&dynamicFont.status==='loaded',range:range.status===206&&rangeBytes.byteLength===8,
        invalidRange:invalid.status===416,missing:missing.status===404,
        unknownProgramBlocked,missingImageBlocked,
        renderStatic:performance.getEntriesByType('resource').filter(e=>e.name.startsWith(location.origin)&&
          /\\/(marineford\\/(art|audio|video|videos|fonts)\\/|marineford\\/(index.html|marineford.js|marineford.css|sound.js|cards.json)|vendor\\/socket.io-client\\/)/.test(new URL(e.name).pathname)).length,
        marker:window.__PO_MARINEFORD_LOCAL_PROGRAM__===true,sound:window.fixtureSound===true,network});
    })().catch(e=>webkit.messageHandlers.result.postMessage({error:e.name+':'+e.message}));"""
    values = {
        'marineford/index.html': html,
        'marineford/marineford.css': b'@font-face{font-family:"PO Media Fixture";src:url("fonts/native-fixture.woff") format("woff")}body{background-image:url("art/v2/test-a.webp");font-family:"PO Media Fixture"}',
        'marineford/marineford.js': main_script,
        'marineford/sound.js': b'window.fixtureSound=true;',
        'vendor/socket.io-client/4.8.1/socket.io.min.js': (args.assets/'launcher/socket.io.min.js').read_bytes(),
        'marineford/art/v2/test-a.webp': (args.assets/'launcher-assets/images/game_launcher/launcher_marineford_cover_v2.webp').read_bytes(),
        'images/board/avatars/8.webp': (args.assets/'launcher-assets/images/game_launcher/launcher_marineford_box_v3.webp').read_bytes()
    }
    fixtures=Path(__file__).parent/'fixtures'
    for path,name in [('marineford/audio/native-tone.wav','tone.wav'),
                      ('marineford/videos/native-blue.mp4','blue.mp4'),
                      ('marineford/fonts/native-fixture.woff','fixture.woff')]:
        values[path]=(fixtures/name).read_bytes()
    for version in (1,2,3):
        values['marineford/cards.json'] = encode([{'id':'native-fixture','version':version}])
        rows=[]
        totals={kind:{'files':0,'bytes':0} for kind in ('document','style','script','data','wasm','image','audio','video','font')}
        for path,data in sorted(values.items()):
            kind,mime=types[path]
            sha=digest(data)
            (source/sha).write_bytes(data)
            rows.append(dict(path=path,kind=kind,mime=mime,size=len(data),sha256=sha))
            totals[kind]['files']+=1
            totals[kind]['bytes']+=len(data)
        identity=digest(encode(rows))
        release='package-'+identity[:16]
        created='2026-11-05T05:00:00.000Z' if version==1 else '2026-11-05T05:01:00.000Z'
        manifest=dict(schema=3,gameId='marineford',releaseId=release,createdAt=created,
                      entryPath='marineford/index.html',assetSetSha256=identity,totalFiles=len(rows),
                      totalBytes=sum(r['size'] for r in rows),byKind=totals,assets=rows)
        data=encode(manifest)
        pointer=dict(schema=1,gameId='marineford',createdAt=created,
                     assetBlobBaseUrl='https://game-assets.rihdi.tw/desktop/blobs/sha256',releaseId=release,
                     manifestPath='desktop/manifests/marineford-'+release+'.json',manifestSha256=digest(data),
                     entryPath='marineford/index.html',totalFiles=len(rows),totalBytes=manifest['totalBytes'])
        (args.out/f'manifest-{version}.json').write_bytes(data)
        (args.out/f'pointer-{version}.json').write_bytes(encode(pointer))
        proof=dict(ok=True,schema=1,gameId='marineford',releaseId=release,
                   manifestSha256=pointer['manifestSha256'],entryPath=pointer['entryPath'])
        (args.out/f'proof-{version}.json').write_bytes(encode(proof))
        if version==1:
            row=next(r for r in rows if r['path']=='marineford/art/v2/test-a.webp')
            cover=dict(row,path='images/game_launcher/launcher_marineford_cover_v2.webp')
            (args.out/'legacy.json').write_bytes(encode(dict(schema=1,gameId='marineford',assets=[cover,row])))
    for label,limit in [('inline-limit',23*1024*1024),('blob-limit',33*1024*1024)]:
        manifest=json.loads((args.out/'manifest-1.json').read_bytes())
        pointer=json.loads((args.out/'pointer-1.json').read_bytes())
        for row in manifest['assets']:
            if row['kind'] in ('audio','video','font') and (label=='inline-limit' or row['kind']=='audio'):
                row['size']=limit
        totals={kind:{'files':0,'bytes':0} for kind in manifest['byKind']}
        for row in manifest['assets']:
            totals[row['kind']]['files']+=1
            totals[row['kind']]['bytes']+=row['size']
        identity=digest(encode(manifest['assets']))
        release='package-'+identity[:16]
        manifest.update(assetSetSha256=identity,releaseId=release,byKind=totals,
                        totalBytes=sum(row['size'] for row in manifest['assets']))
        data=encode(manifest)
        pointer.update(releaseId=release,manifestPath='desktop/manifests/marineford-'+release+'.json',
                       manifestSha256=digest(data),totalBytes=manifest['totalBytes'])
        (args.out/f'manifest-{label}.json').write_bytes(data)
        (args.out/f'pointer-{label}.json').write_bytes(encode(pointer))
    print('Prepared independent Marineford program fixtures')

if __name__=='__main__':
    main()
