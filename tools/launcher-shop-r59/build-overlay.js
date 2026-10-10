'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{spawnSync,execFileSync}=require('child_process');
const root=path.resolve(__dirname,'../..'),qa='D:/Codex_QA/launcher-shop-r59',baseline='14b85203384077a1d2705aa278921b7d6d93b961';
const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:128*1024*1024,windowsHide:true}),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceCommit=git('rev-parse','HEAD').toString().trim();assert.notEqual(sourceCommit,baseline);
const previous=JSON.parse(git('cat-file','blob',baseline+':public/desktop/launcher-content-v1.json'));assert.equal(previous.revision,58);
assert.deepEqual(JSON.parse(fs.readFileSync(root+'/public/desktop/launcher-content-v1.json')),previous,'Published baseline changed');
const spec=JSON.parse(git('cat-file','blob',sourceCommit+':tools/launcher-shop-r59/release-assets.json'));
const changed=[...spec.rendererFiles,...spec.avatarIds.map(id=>`images/board/avatars/${id}.webp`),'images/launcher_announcements/launcher-avatar-r59.webp'];
const args=[root+'/tools/desktop-r2-publisher/launcher-content-manifest.js','build','--repo-root',root,'--core-version','1.2.23','--revision','59','--carry-from',root+'/public/desktop/launcher-content-v1.json','--output',qa+'/unsigned-r59.json'];
for(const item of changed)args.push('--include',item);
const done=spawnSync(process.execPath,args,{stdio:'inherit',cwd:root});if(done.status)process.exit(done.status||1);
const manifest=JSON.parse(fs.readFileSync(qa+'/unsigned-r59.json')),allow=new Set(changed),old=new Map(previous.files.map(f=>[f.path,f]));
assert.deepEqual(manifest.files.map(f=>f.path).sort(),[...new Set([...old.keys(),...changed])].sort());
for(const f of manifest.files){
  if(allow.has(f.path)){const source=(f.path.startsWith('images/')?'public/':'desktop/')+f.path,bytes=git('cat-file','blob',sourceCommit+':'+source);assert.equal(f.bytes,bytes.length,source);assert.equal(f.sha256,hash(bytes),'Uncommitted source bytes: '+source);}
  else assert.deepEqual(f,old.get(f.path),'Unreviewed carry change: '+f.path);
}
fs.writeFileSync(qa+'/renderer-inventory-report.json',JSON.stringify({status:'PASS',revision:59,sourceCommit,changedPaths:changed,files:manifest.files.length,carryPolicy:'Exact r58 signed bytes/SHA preserved. Changed files match source commit.'},null,2));
console.log('r59 inventory PASS '+changed.length+' reviewed paths');
