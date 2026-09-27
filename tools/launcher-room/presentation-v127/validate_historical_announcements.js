'use strict';
// Re-execute v126 with its committed runtime. The original art, evidence and
// review files stay in the checkout and are still verified by the old gates.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const BASELINE='92a11b3c5c1c8e21eea5ab84917dd5c8c5e8d441';
const REVIEW='docs/LAUNCHER_ANNOUNCEMENTS_20260927.json';
const NORMALIZATION='CRLF to LF only; all other bytes remain significant';
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const normalized=bytes=>sha256(bytes.toString('utf8').replace(/\r\n/g,'\n'));
const git=(root,args)=>cp.execFileSync('git',['-c','safe.directory='+path.resolve(root),...args],{cwd:root,windowsHide:true,maxBuffer:64*1024*1024,timeout:30000});
function execute(root){
 root=path.resolve(root);assert.equal(git(root,['rev-parse','--verify',BASELINE+'^{commit}']).toString().trim(),BASELINE);
 const blobs=new Map(),committed=file=>{if(!blobs.has(file))blobs.set(file,git(root,['cat-file','blob',BASELINE+':'+file]));return blobs.get(file);};
 const review=JSON.parse(committed(REVIEW));
 const validators=git(root,['ls-tree','-r','--name-only',BASELINE,'tools/launcher-room/presentation-v126']).toString().trim().split(/\r?\n/).filter(file=>file.endsWith('.js'));
 for(const file of [REVIEW,...validators])assert.equal(normalized(fs.readFileSync(path.join(root,file))),normalized(committed(file)),'Historical v126 review/gate was modified: '+file);
 const scripts=['scripts/launcher_announcements_client_qa.js','scripts/launcher_announcements_production_visual_qa.js','scripts/launcher_profile_bgm_client_qa.js'];
 const overlay=new Set([...Object.keys(review.runtime),...scripts,'public/desktop/catalog-v3.json']);
 for(const key of ['serverQA','aceQA','clientQA','productionVisualQA','bgmServerQA','bgmClientQA']){
  const report=JSON.parse(committed(review[key].path));
  for(const file of Object.keys(report.sourceSha256||{}))overlay.add(/^(desktop|server|scripts|config)\//.test(file)?file:'desktop/'+file);
 }
 const runtimeProof=Object.entries(review.runtime).map(([file,digest])=>{assert.equal(normalized(committed(file)),digest,'Committed v126 source differs from its review: '+file);return{path:file,normalizedSha256:digest};});
 const rawRead=fs.readFileSync,oldJs=Module._extensions['.js'],oldJson=Module._extensions['.json'];
 const relative=file=>typeof file==='string'?path.relative(root,path.resolve(file)).split(path.sep).join('/') : '';
 fs.readFileSync=function(file,options){const rel=relative(file);if(!overlay.has(rel))return rawRead.apply(this,arguments);const bytes=committed(rel),encoding=typeof options==='string'?options:options?.encoding;return encoding?bytes.toString(encoding):Buffer.from(bytes);};
 Module._extensions['.js']=(module,file)=>{const rel=relative(file);if(overlay.has(rel))module._compile(committed(rel).toString('utf8'),file);else oldJs(module,file);};
 Module._extensions['.json']=(module,file)=>{const rel=relative(file);if(overlay.has(rel))module.exports=JSON.parse(committed(rel));else oldJson(module,file);};
 try{
  for(const file of overlay)delete require.cache[path.join(root,file)];
  const result=require(path.join(root,'tools/launcher-room/presentation-v126/validate_release')).validate(root);
  return{...result,announcementsBaseline:BASELINE,announcementsRuntimeProof:runtimeProof,historicalOnly:true};
 }finally{fs.readFileSync=rawRead;Module._extensions['.js']=oldJs;Module._extensions['.json']=oldJson;}
}
function validateHistorical(root){
 // Exact-root trust applies to this subprocess and its historical child gates;
 // it does not change Git's global/system configuration.
 const env={...process.env,GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'safe.directory',GIT_CONFIG_VALUE_0:path.resolve(root)};
 return JSON.parse(cp.execFileSync(process.execPath,[__filename,'--isolated',path.resolve(root)],{cwd:root,env,windowsHide:true,maxBuffer:32*1024*1024,timeout:240000}));
}
module.exports={BASELINE,REVIEW,NORMALIZATION,sha256,normalized,git,validateHistorical};
if(require.main===module){if(process.argv[2]==='--isolated')process.stdout.write(JSON.stringify(execute(process.argv[3])));else{const result=validateHistorical(process.argv[2]||path.resolve(__dirname,'../../..'));console.log(JSON.stringify({complete:result.complete,baseline:BASELINE,runtime:result.announcementsRuntimeProof.length,reservedArt:result.reserved.assets,captures:result.artBrowser.captures}));}}
