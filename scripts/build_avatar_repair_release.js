'use strict';
// r59: replace only reviewed portrait records in the three published packages.
// Existing executable programs and unrelated artwork remain byte-identical.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const C=require('./desktop_program_package_common');
const root=path.resolve(__dirname,'..'),BASELINE='14b85203384077a1d2705aa278921b7d6d93b961';
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:128*1024*1024,windowsHide:true});
const blob=(ref,p)=>git('cat-file','blob',ref+':'+p);
function build(output,promote=false){
  const head=git('rev-parse','HEAD').toString().trim();assert.notEqual(head,BASELINE,'Commit reviewed source first.');
  git('merge-base','--is-ancestor',BASELINE,head);
  const ids=JSON.parse(blob(head,'tools/launcher-shop-r59/release-assets.json')).avatarIds;
  assert(Array.isArray(ids)&&ids.length>0&&new Set(ids).size===ids.length);
  for(const id of ids)assert(Number.isInteger(id)&&id>=1&&id<=222);
  const previous=C.validateCatalog(JSON.parse(blob(BASELINE,'public/desktop/catalog-v3.json')));
  const config=JSON.parse(blob(head,'config/desktop-program-packages-v1.json'));
  assert.deepEqual(config,JSON.parse(blob(BASELINE,'config/desktop-program-packages-v1.json')));
  const now=new Date().toISOString(),catalog={...previous,createdAt:now,sourceTrees:{...previous.sourceTrees,images:git('rev-parse',head+':public/images').toString().trim()},games:{...previous.games}};
  const changed=new Map(),summaries={};
  fs.mkdirSync(output,{recursive:true});
  for(const game of C.GAME_IDS){
    const oldBytes=blob(BASELINE,'public/'+previous.games[game].manifestPath);assert.equal(C.sha256Bytes(oldBytes),previous.games[game].manifestSha256);
    const old=C.validateManifest(JSON.parse(oldBytes),game),byPath=new Map(old.assets.map(x=>[x.path,x])),allowed=new Set();
    for(const id of ids){
      const source=`images/board/avatars/${id}.webp`,bytes=blob(head,'public/'+source),type=C.classifyPath(source),sha256=C.sha256Bytes(bytes);
      for(const logical of game==='card'?[source,`images/avatars/${id}.webp`]:[source]){
        assert(byPath.has(logical),'Missing existing portrait: '+logical);
        assert.notEqual(byPath.get(logical).sha256,sha256,'Unchanged portrait listed: '+logical);
        byPath.set(logical,{path:logical,kind:type.kind,mime:type.mime,size:bytes.length,sha256});allowed.add(logical);
        if(!changed.has(sha256))changed.set(sha256,{sha256,size:bytes.length,kind:type.kind,mime:type.mime,key:C.objectKeyForSha256(sha256),games:[],sources:[]});
        const r=changed.get(sha256);if(!r.games.includes(game))r.games.push(game);if(!r.sources.includes(logical))r.sources.push(logical);
      }
    }
    for(const a of old.assets)if(!allowed.has(a.path))assert.deepEqual(byPath.get(a.path),a);
    for(const p of config.games[game].programFiles)assert.equal(C.sha256Bytes(blob(head,'public/'+p)),byPath.get(p)?.sha256,'Unreviewed program drift: '+p);
    const assets=[...byPath.values()].sort((a,b)=>C.comparePaths(a.path,b.path)),digest=C.sha256Bytes(JSON.stringify(assets));
    const manifest={schema:3,gameId:game,releaseId:'package-'+digest.slice(0,16),createdAt:now,entryPath:old.entryPath,assetSetSha256:digest,totalFiles:assets.length,totalBytes:assets.reduce((n,a)=>n+a.size,0),byKind:C.calculateByKind(assets),assets};C.validateManifest(manifest,game);
    const name=`desktop/manifests/${game}-${manifest.releaseId}.json`,bytes=Buffer.from(C.canonicalJson(manifest));
    fs.mkdirSync(path.join(output,'desktop/manifests'),{recursive:true});fs.writeFileSync(path.join(output,name),bytes,{flag:'wx'});
    catalog.games[game]={releaseId:manifest.releaseId,manifestPath:name,manifestSha256:C.sha256Bytes(bytes),entryPath:manifest.entryPath,totalFiles:manifest.totalFiles,totalBytes:manifest.totalBytes};
    const delta=assets.filter(a=>old.assets.find(b=>b.path===a.path)?.sha256!==a.sha256);
    assert.equal(delta.length,ids.length*(game==='card'?2:1));
    summaries[game]={previous:old.releaseId,current:manifest.releaseId,changedPaths:delta.map(x=>x.path),changedLogicalBytes:delta.reduce((n,a)=>n+a.size,0),preservedFiles:old.assets.filter(a=>!allowed.has(a.path)).length};
  }
  C.validateCatalog(catalog);fs.writeFileSync(path.join(output,'desktop/catalog-v3.json'),C.canonicalJson(catalog),{flag:'wx'});
  const records=[...changed.values()].map(r=>({...r,sources:r.sources.sort(),games:r.games.sort()}));
  const report={status:'BUILT',baseline:BASELINE,sourceCommit:head,createdAt:now,avatarIds:ids,games:summaries,records,uniqueDeltaBytes:records.reduce((n,r)=>n+r.size,0)};
  fs.writeFileSync(path.join(output,'shared-avatar-package-report.json'),JSON.stringify(report,null,2));
  if(promote){
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'public/desktop/catalog-v3.json'))),previous,'Catalog moved during work.');
    for(const g of Object.values(catalog.games))fs.copyFileSync(path.join(output,g.manifestPath),path.join(root,'public',g.manifestPath),fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(path.join(output,'desktop/catalog-v3.json'),path.join(root,'public/desktop/catalog-v3.json'));
  }
  return report;
}
if(require.main===module){const out=process.argv[2];assert(out&&path.isAbsolute(out));const r=build(out,process.argv.includes('--promote'));console.log(JSON.stringify({status:r.status,sourceCommit:r.sourceCommit,avatarIds:r.avatarIds,games:r.games,uniqueDeltaBytes:r.uniqueDeltaBytes},null,2));}
module.exports={build};
