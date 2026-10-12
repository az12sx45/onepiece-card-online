'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),cp=require('child_process');
const C=require('../../scripts/desktop_program_package_common');
const root=path.resolve(__dirname,'../..'),qa='D:/Codex_QA/launcher-avatar-r60';
const git=(...a)=>cp.execFileSync('git',a,{cwd:root,maxBuffer:128*1024*1024,windowsHide:true});
const blob=(ref,p)=>git('cat-file','blob',ref+':'+p),head=git('rev-parse','HEAD').toString().trim();
const spec=JSON.parse(blob(head,'tools/launcher-avatar-r60/release-spec.json'));
git('merge-base','--is-ancestor',spec.baseline,head);assert.notEqual(head,spec.baseline);
const previous=C.validateCatalog(JSON.parse(blob(spec.baseline,'public/desktop/catalog-v3.json')));
assert.deepEqual(JSON.parse(fs.readFileSync(root+'/public/desktop/catalog-v3.json')),previous,'Release baseline moved');
const config=JSON.parse(blob(head,'config/desktop-program-packages-v1.json'));
assert.deepEqual(config,JSON.parse(blob(spec.baseline,'config/desktop-program-packages-v1.json')));
const catalog={...previous,createdAt:new Date().toISOString(),games:{...previous.games}},records=new Map(),games={};
const output=qa+'/packages';fs.mkdirSync(output+'/desktop/manifests',{recursive:true});
for(const game of C.GAME_IDS){
  const oldBytes=blob(spec.baseline,'public/'+previous.games[game].manifestPath);assert.equal(C.sha256Bytes(oldBytes),previous.games[game].manifestSha256);
  const old=C.validateManifest(JSON.parse(oldBytes),game),entries=new Map(old.assets.map(x=>[x.path,x])),changed=[];
  for(const p of spec.gamePrograms){if(!entries.has(p))continue;assert(config.games[game].programFiles.includes(p));const bytes=blob(head,'public/'+p),sha256=C.sha256Bytes(bytes);if(sha256===entries.get(p).sha256)continue;const t=C.classifyPath(p);entries.set(p,{path:p,kind:t.kind,mime:t.mime,size:bytes.length,sha256});changed.push(p);if(!records.has(sha256))records.set(sha256,{sha256,size:bytes.length,kind:t.kind,mime:t.mime,key:C.objectKeyForSha256(sha256),games:[],sources:[]});const r=records.get(sha256);r.games.push(game);if(!r.sources.includes(p))r.sources.push(p);}
  for(const p of config.games[game].programFiles)assert.equal(C.sha256Bytes(blob(head,'public/'+p)),entries.get(p)?.sha256,'Unreviewed program drift: '+game+'/'+p);
  for(const a of old.assets)if(!changed.includes(a.path))assert.deepEqual(entries.get(a.path),a,'Unrelated asset changed');
  if(!changed.length){games[game]={previous:old.releaseId,current:old.releaseId,changedPaths:[],preservedFiles:old.assets.length};continue;}
  const assets=[...entries.values()].sort((a,b)=>C.comparePaths(a.path,b.path)),digest=C.sha256Bytes(JSON.stringify(assets));
  const m={...old,releaseId:'package-'+digest.slice(0,16),createdAt:catalog.createdAt,assetSetSha256:digest,assets,totalFiles:assets.length,totalBytes:assets.reduce((n,a)=>n+a.size,0),byKind:C.calculateByKind(assets)};C.validateManifest(m,game);
  const name=`desktop/manifests/${game}-${m.releaseId}.json`,bytes=Buffer.from(C.canonicalJson(m));fs.writeFileSync(output+'/'+name,bytes,{flag:'wx'});
  catalog.games[game]={releaseId:m.releaseId,manifestPath:name,manifestSha256:C.sha256Bytes(bytes),entryPath:m.entryPath,totalFiles:m.totalFiles,totalBytes:m.totalBytes};
  games[game]={previous:old.releaseId,current:m.releaseId,changedPaths:changed,preservedFiles:assets.length-changed.length};
}
assert(games.board.changedPaths.length>0);C.validateCatalog(catalog);fs.writeFileSync(output+'/desktop/catalog-v3.json',C.canonicalJson(catalog),{flag:'wx'});
const packageReport={status:'BUILT',sourceCommit:head,baseline:spec.baseline,createdAt:catalog.createdAt,games,records:[...records.values()],uniqueDeltaBytes:[...records.values()].reduce((n,r)=>n+r.size,0)};
fs.writeFileSync(output+'/package-report.json',JSON.stringify(packageReport,null,2));
const oldOverlay=JSON.parse(blob(spec.baseline,'public/desktop/launcher-content-v1.json'));assert.equal(oldOverlay.revision,59);
const changed=[...spec.rendererFiles,...spec.images],args=[root+'/tools/desktop-r2-publisher/launcher-content-manifest.js','build','--repo-root',root,'--core-version',spec.coreVersion,'--revision',String(spec.revision),'--carry-from',root+'/public/desktop/launcher-content-v1.json','--output',qa+'/unsigned-r60.json'];
assert.deepEqual(JSON.parse(fs.readFileSync(root+'/public/desktop/launcher-content-v1.json')),oldOverlay);
for(const p of changed)args.push('--include',p);cp.execFileSync(process.execPath,args,{cwd:root,stdio:'inherit',windowsHide:true});
const manifest=JSON.parse(fs.readFileSync(qa+'/unsigned-r60.json')),oldFiles=new Map(oldOverlay.files.map(f=>[f.path,f]));
assert.deepEqual(manifest.files.map(f=>f.path).sort(),[...new Set([...oldFiles.keys(),...changed])].sort());
for(const f of manifest.files){if(changed.includes(f.path)){const b=blob(head,(f.path.startsWith('images/')?'public/':'desktop/')+f.path);assert.equal(f.sha256,C.sha256Bytes(b),'Working source bytes must equal committed source: '+f.path);assert.equal(f.bytes,b.length);}else assert.deepEqual(f,oldFiles.get(f.path));}
fs.writeFileSync(qa+'/renderer-inventory-report.json',JSON.stringify({status:'PASS',sourceCommit:head,revision:60,files:manifest.files.length,changedPaths:changed,carryPolicy:'Exact signed r59 entries preserved; latest Board smooth-sailing programs retained'},null,2));
if(process.argv.includes('--promote')){for(const [game,m]of Object.entries(catalog.games))if(m.releaseId!==previous.games[game].releaseId)fs.copyFileSync(output+'/'+m.manifestPath,root+'/public/'+m.manifestPath,fs.constants.COPYFILE_EXCL);fs.copyFileSync(output+'/desktop/catalog-v3.json',root+'/public/desktop/catalog-v3.json');}
console.log(JSON.stringify({status:'PASS',sourceCommit:head,games,uniqueGameBytes:packageReport.uniqueDeltaBytes,overlayFiles:manifest.files.length},null,2));
