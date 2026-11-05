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
    html = b"""<!doctype html><html><head><link rel="stylesheet" href="marineford.css?fixture=1"></head><body><script src="/vendor/socket.io-client/4.8.1/socket.io.min.js"></script><script src="sound.js"></script><script src="marineford.js?fixture=1"></script></body></html>"""
    main_script = b"""(async()=>{
      const cards=await (await fetch('cards.json')).json();
      const avatar=new Image();avatar.src='/images/board/avatars/8.webp';document.body.append(avatar);
      const art=new Image();art.src='art/v2/test-a.webp';document.body.append(art);
      await Promise.all([avatar.decode(),art.decode()]);
      const socket=io({autoConnect:false,reconnection:false});
      const uri=socket.io.uri;socket.disconnect();
      const previous=Number(localStorage.getItem('__po_program_test')||0);
      localStorage.setItem('__po_program_test',String(previous+1));
      webkit.messageHandlers.result.postMessage({origin:location.origin,version:cards[0].version,
        secret:localStorage.getItem('opSecret')==='fixture-secret',socket:uri,previous,
        avatar:avatar.getAttribute('src'),art:art.getAttribute('src'),
        marker:window.__PO_MARINEFORD_LOCAL_PROGRAM__===true,sound:window.fixtureSound===true});
    })().catch(e=>webkit.messageHandlers.result.postMessage({error:e.name}));"""
    values = {
        'marineford/index.html': html,
        'marineford/marineford.css': b'body{background-image:url("art/v2/test-a.webp")}',
        'marineford/marineford.js': main_script,
        'marineford/sound.js': b'window.fixtureSound=true;',
        'vendor/socket.io-client/4.8.1/socket.io.min.js': (args.assets/'launcher/socket.io.min.js').read_bytes(),
        'marineford/art/v2/test-a.webp': (args.assets/'launcher-assets/images/game_launcher/launcher_marineford_cover_v2.webp').read_bytes(),
        'images/board/avatars/8.webp': (args.assets/'launcher-assets/images/game_launcher/launcher_marineford_box_v3.webp').read_bytes()
    }
    for version in (1,2):
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
        created='2026-11-05T05:00:00.000Z'
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
    print('Prepared independent Marineford program fixtures')

if __name__=='__main__':
    main()
