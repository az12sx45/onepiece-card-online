'use strict';
// Extend the current published packages; preserve every unrelated asset record.
// Card's legacy image path aliases point to exactly the same content hash.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{execFileSync}=require('child_process');
const C=require('./desktop_program_package_common');
const root=path.resolve(__dirname,'..');
const BASELINE='15d3eb7af';
const changedPrograms=['start.html','profile.html','game.html'];
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:128*1024*1024,windowsHide:true});
const blob=(ref,p)=>git('cat-file','blob',ref+':'+p);
function build(output,promote=false){
  const head=git('rev-parse','HEAD').toString().trim();
  assert.notEqual(head.slice(0,9),BASELINE,'Commit reviewed source before packaging.');
  git('merge-base','--is-ancestor',BASELINE,head);
  const previous=C.validateCatalog(JSON.parse(blob(BASELINE,'public/desktop/catalog-v3.json')));
  const config=JSON.parse(blob(head,'config/desktop-program-packages-v1.json'));
  assert.deepEqual(config,JSON.parse(blob(BASELINE,'config/desktop-program-packages-v1.json')),'Program inventory is unchanged.');
  const now=new Date().toISOString(),catalog={...previous,createdAt:now,sourceTrees:{...previous.sourceTrees,images:git('rev-parse',head+':public/images').toString().trim()},games:{...previous.games}};
  const changed=new Map(),summaries={};
  const record=(logical,source=logical)=>{
    const bytes=blob(head,'public/'+source),type=C.classifyPath(logical);assert(type);
    const entry={path:logical,kind:type.kind,mime:type.mime,size:bytes.length,sha256:C.sha256Bytes(bytes)};
    if(!changed.has(entry.sha256))changed.set(entry.sha256,{sha256:entry.sha256,size:entry.size,kind:entry.kind,mime:entry.mime,key:C.objectKeyForSha256(entry.sha256),games:[],sources:[]});
    const data=changed.get(entry.sha256);if(!data.sources.includes(logical))data.sources.push(logical);
    return entry;
  };
  fs.mkdirSync(output,{recursive:true});
  for(const game of C.GAME_IDS){
    const oldBytes=blob(BASELINE,'public/'+previous.games[game].manifestPath);
    assert.equal(C.sha256Bytes(oldBytes),previous.games[game].manifestSha256);
    const old=C.validateManifest(JSON.parse(oldBytes),game),byPath=new Map(old.assets.map(x=>[x.path,x]));
    const allowed=new Set();
    if(game==='card')for(const p of changedPrograms){byPath.set(p,record(p));allowed.add(p);}
    for(let id=51;id<=222;id++){
      const source=`images/board/avatars/${id}.webp`;byPath.set(source,record(source));allowed.add(source);
      if(game==='card'){const alias=`images/avatars/${id}.webp`;byPath.set(alias,record(alias,source));allowed.add(alias);}
    }
    for(const a of old.assets)if(!allowed.has(a.path))assert.deepEqual(byPath.get(a.path),a);
    // Every configured program must match this exact source commit. Preserve
    // all baseline executable bytes except the three reviewed Card documents.
    for(const p of config.games[game].programFiles){
      const actual=blob(head,'public/'+p),expected=byPath.get(p);
      assert(expected&&C.sha256Bytes(actual)===expected.sha256,'Unreviewed program drift: '+game+'/'+p);
    }
    const assets=[...byPath.values()].sort((a,b)=>C.comparePaths(a.path,b.path)),digest=C.sha256Bytes(JSON.stringify(assets));
    const manifest={schema:3,gameId:game,releaseId:'package-'+digest.slice(0,16),createdAt:now,entryPath:old.entryPath,assetSetSha256:digest,totalFiles:assets.length,totalBytes:assets.reduce((n,a)=>n+a.size,0),byKind:C.calculateByKind(assets),assets};
    C.validateManifest(manifest,game);
    const name=`desktop/manifests/${game}-${manifest.releaseId}.json`,bytes=Buffer.from(C.canonicalJson(manifest));
    fs.mkdirSync(path.join(output,'desktop/manifests'),{recursive:true});fs.writeFileSync(path.join(output,name),bytes,{flag:'wx'});
    catalog.games[game]={releaseId:manifest.releaseId,manifestPath:name,manifestSha256:C.sha256Bytes(bytes),entryPath:manifest.entryPath,totalFiles:manifest.totalFiles,totalBytes:manifest.totalBytes};
    const delta=assets.filter(a=>old.assets.find(b=>b.path===a.path)?.sha256!==a.sha256);
    for(const a of delta){const r=changed.get(a.sha256);assert(r);if(!r.games.includes(game))r.games.push(game);}
    summaries[game]={previous:old.releaseId,current:manifest.releaseId,changedPaths:delta.map(x=>x.path),changedLogicalBytes:delta.reduce((n,a)=>n+a.size,0),preservedFiles:old.assets.filter(a=>!allowed.has(a.path)).length};
  }
  C.validateCatalog(catalog);
  fs.writeFileSync(path.join(output,'desktop/catalog-v3.json'),C.canonicalJson(catalog),{flag:'wx'});
  const records=[...changed.values()].filter(x=>x.games.length).map(x=>({...x,sources:x.sources.sort(),games:x.games.sort()}));
  const report={status:'BUILT',baseline:git('rev-parse',BASELINE).toString().trim(),sourceCommit:head,createdAt:now,games:summaries,records,uniqueDeltaBytes:records.reduce((n,r)=>n+r.size,0)};
  fs.writeFileSync(path.join(output,'shared-avatar-package-report.json'),JSON.stringify(report,null,2));
  if(promote){
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'public/desktop/catalog-v3.json'))),previous,'Catalog moved during work.');
    for(const g of Object.values(catalog.games))fs.copyFileSync(path.join(output,g.manifestPath),path.join(root,'public',g.manifestPath),fs.constants.COPYFILE_EXCL);
    fs.copyFileSync(path.join(output,'desktop/catalog-v3.json'),path.join(root,'public/desktop/catalog-v3.json'));
  }
  return report;
}
if(require.main===module){const out=process.argv[2];assert(out&&path.isAbsolute(out),'Absolute output directory required.');const r=build(out,process.argv.includes('--promote'));console.log(JSON.stringify({status:r.status,sourceCommit:r.sourceCommit,games:r.games,uniqueDeltaBytes:r.uniqueDeltaBytes},null,2));}
module.exports={build};
