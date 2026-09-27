'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),Module=require('node:module');
const old=require('../presentation-v127/validate_historical_announcements');
const BASELINE='6dc1fcf32c13225e108b32767251c20098eefed4',REVIEW='docs/LAUNCHER_MINIGAMES_20260928.json',REVIEW_SHA='5da1b92a51b94580a073965c128b4ff1958b66cb4ec9a9be19041c8480410430';
const MANIFEST='tools/launcher-room/expansion-v128/historical-v127/manifest.json';
const MANIFEST_SHA='31c9d69b7592c099d2853eb56d1a43f49e82e7f6570fcfa83afbeb644642f366';
function safe(root,file){assert(typeof file==='string'&&file&&!file.includes('\\')&&!path.isAbsolute(file)&&!file.split('/').includes('..'));const result=path.resolve(root,file);assert(result.startsWith(path.resolve(root)+path.sep));return result;}
function execute(root){
 root=path.resolve(root);assert.equal(old.git(root,['rev-parse','--verify',BASELINE+'^{commit}']).toString().trim(),BASELINE);
 const reviewBytes=fs.readFileSync(safe(root,REVIEW));assert.equal(old.sha256(reviewBytes),REVIEW_SHA,'Immutable 1.2.7 review changed');const review=JSON.parse(reviewBytes);
 const expected=[...new Set([...Object.keys(review.runtime),...Object.keys(review.qaSourceProofs),'public/desktop/catalog-v2.json','public/desktop/catalog-v3.json','scripts/launcher_robin_scale_qa.js'])].sort();
 const manifestBytes=fs.readFileSync(safe(root,MANIFEST));assert.equal(old.sha256(manifestBytes),MANIFEST_SHA,'Portable historical manifest changed');const manifest=JSON.parse(manifestBytes);assert.equal(manifest.schema,'launcher-v127-portable-history/1');assert.equal(manifest.sourceReview.path,REVIEW);assert.equal(manifest.sourceReview.sha256,REVIEW_SHA);assert.equal(manifest.originalGatePassed,true);assert.deepEqual(manifest.files.map(item=>item.path).sort(),expected);
 const overlay=new Map();for(const item of manifest.files){assert.equal(item.snapshot,'tools/launcher-room/expansion-v128/historical-v127/files/'+item.path);const bytes=fs.readFileSync(safe(root,item.snapshot));assert.equal(old.sha256(bytes),item.sha256);assert.equal(bytes.length,item.bytes);assert.equal(old.normalized(bytes),item.normalizedSha256);if(review.runtime[item.path])assert.equal(item.normalizedSha256,review.runtime[item.path],'Snapshot differs from original reviewed runtime: '+item.path);if(review.qaSourceProofs[item.path])assert.equal(item.normalizedSha256,review.qaSourceProofs[item.path].normalizedSha256);overlay.set(item.path,bytes);}
 const formal=path.resolve(root).toLowerCase()===path.resolve('D:/Codex_Release_Worktrees/board-voyage-records-v1').toLowerCase(),catalogContext={mode:formal?'formal-pinned':'frozen-candidate',files:[]};
 if(formal){
  // The immutable v127 validator intentionally requires its recorded formal
  // catalog when its root is the authority tree. Preserve that original rule;
  // the portable candidate catalog is only the historical build's variant.
  const snapshotBytes=fs.readFileSync(safe(root,review.formalCatalogSnapshot.path));assert.equal(old.sha256(snapshotBytes),review.formalCatalogSnapshot.sha256,'Original formal catalog snapshot changed');const snapshot=JSON.parse(snapshotBytes);assert.equal(snapshot.schema,'launcher-v127-formal-catalog-baseline/1');assert.equal(path.resolve(snapshot.authorityRoot).toLowerCase(),path.resolve(root).toLowerCase());assert.deepEqual(snapshot.files.map(item=>item.path).sort(),['public/desktop/catalog-v2.json','public/desktop/catalog-v3.json']);
  for(const item of snapshot.files){const actual=fs.readFileSync(safe(root,item.path));assert.equal(old.sha256(actual),item.sha256,'Actual formal catalog differs from original approved bytes: '+item.path);overlay.set(item.path,actual);catalogContext.files.push({path:item.path,sha256:item.sha256});}
 }else for(const file of ['public/desktop/catalog-v2.json','public/desktop/catalog-v3.json'])catalogContext.files.push({path:file,sha256:old.sha256(overlay.get(file))});
 assert.equal(JSON.parse(overlay.get('desktop/package.json')).version,'1.2.7');
 // Pin original validator source to the deployed ancestor, never a new copy.
 for(const file of old.git(root,['ls-tree','-r','--name-only',BASELINE,'tools/launcher-room/presentation-v127']).toString().trim().split(/\r?\n/).filter(file=>file.endsWith('.js')))assert.equal(old.normalized(fs.readFileSync(safe(root,file))),old.normalized(old.git(root,['cat-file','blob',BASELINE+':'+file])),'Immutable 1.2.7 validator changed: '+file);
 const rawRead=fs.readFileSync,oldJs=Module._extensions['.js'],oldJson=Module._extensions['.json'],relative=file=>typeof file==='string'?path.relative(root,path.resolve(file)).split(path.sep).join('/'):'';
 fs.readFileSync=function(file,options){const bytes=overlay.get(relative(file));if(!bytes)return rawRead.apply(this,arguments);const encoding=typeof options==='string'?options:options?.encoding;return encoding?bytes.toString(encoding):Buffer.from(bytes);};
 Module._extensions['.js']=(module,file)=>{const bytes=overlay.get(relative(file));if(bytes)module._compile(bytes.toString('utf8'),file);else oldJs(module,file);};
 Module._extensions['.json']=(module,file)=>{const bytes=overlay.get(relative(file));if(bytes)module.exports=JSON.parse(bytes);else oldJson(module,file);};
 try{for(const file of overlay.keys())delete require.cache[safe(root,file)];const result=require(path.join(root,'tools/launcher-room/presentation-v127/validate_release')).validate(root);return{...result,historicalV127:true,v127ReviewSha256:REVIEW_SHA,v127OverlayFiles:overlay.size,v127OverlaySha256:old.sha256(rawRead(safe(root,MANIFEST))),v127CatalogContext:catalogContext};}
 finally{fs.readFileSync=rawRead;Module._extensions['.js']=oldJs;Module._extensions['.json']=oldJson;}
}
function validateHistorical(root){const env={...process.env,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:path.resolve(root)};return JSON.parse(cp.execFileSync(process.execPath,[__filename,'--isolated',path.resolve(root)],{cwd:root,env,windowsHide:true,maxBuffer:64*1024*1024,timeout:240000}));}
module.exports={BASELINE,REVIEW,REVIEW_SHA,MANIFEST,safe,sha256:old.sha256,normalized:old.normalized,NORMALIZATION:old.NORMALIZATION,git:old.git,validateHistorical};
if(require.main===module){if(process.argv[2]==='--isolated')process.stdout.write(JSON.stringify(execute(process.argv[3])));else{const result=validateHistorical(process.argv[2]||path.resolve(__dirname,'../../..'));console.log(JSON.stringify({complete:result.complete,version:result.review.releaseVersion,overlayFiles:result.v127OverlayFiles,originalReviewSha256:result.v127ReviewSha256}));}}
