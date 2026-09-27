'use strict';
// Re-run the immutable 1.2.5 gate in an isolated process with its committed
// runtime. All art and evidence are read and verified from this checkout.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const BASELINE='435cb91f44cb7674fbcfd5b9674a9d07cf469c05';
const REVIEW='docs/LAUNCHER_RESERVED_CREW_20260927.json';
const NORMALIZATION='CRLF to LF only; all other bytes remain significant';
const normalized=bytes=>crypto.createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g,'\n')).digest('hex');
function execute(root){
 root=path.resolve(root);
 const git=args=>cp.execFileSync('git',args,{cwd:root,windowsHide:true,maxBuffer:64*1024*1024,timeout:30000});
 assert.equal(git(['rev-parse','--verify',BASELINE+'^{commit}']).toString().trim(),BASELINE);
 const blobs=new Map(),committed=file=>{if(!blobs.has(file))blobs.set(file,git(['cat-file','blob',BASELINE+':'+file]));return blobs.get(file);};
 const review=JSON.parse(committed(REVIEW));
 const validatorFiles=git(['ls-tree','-r','--name-only',BASELINE,'tools/launcher-room/presentation-v125']).toString().trim().split(/\r?\n/).filter(file=>file.endsWith('.js'));
 for(const file of [REVIEW,...validatorFiles])assert.equal(normalized(fs.readFileSync(path.join(root,file))),normalized(committed(file)),'Immutable v125 evidence/gate changed: '+file);
 const oldGate=require(path.join(root,'tools/launcher-room/presentation-v125/validate_release'));
 const oldArt=require(path.join(root,'tools/launcher-room/presentation-v125/validate_art_browser'));
 const overlay=new Set([...Object.keys(review.runtime),...oldGate.SERVER_SOURCES,...oldGate.CLIENT_SOURCES.map(file=>'desktop/'+file),...oldArt.SOURCES.map(file=>'desktop/'+file),oldArt.SCRIPT,'scripts/launcher_reserved_crew_client_qa.js','scripts/launcher_reserved_crew_browser_qa.js']);
 const runtimeProof=Object.entries(review.runtime).map(([file,digest])=>{assert.equal(normalized(committed(file)),digest,'Committed reviewed source mismatch: '+file);return {path:file,normalizedSha256:digest};});
 const rawRead=fs.readFileSync;
 const relative=file=>typeof file==='string'?path.relative(root,path.resolve(file)).split(path.sep).join('/') : '';
 fs.readFileSync=function(file,options){const rel=relative(file);if(!overlay.has(rel))return rawRead.apply(this,arguments);const bytes=committed(rel),encoding=typeof options==='string'?options:options?.encoding;return encoding?bytes.toString(encoding):Buffer.from(bytes);};
 const oldJs=Module._extensions['.js'],oldJson=Module._extensions['.json'];
 Module._extensions['.js']=(module,file)=>{const rel=relative(file);if(overlay.has(rel))module._compile(committed(rel).toString('utf8'),file);else oldJs(module,file);};
 Module._extensions['.json']=(module,file)=>{const rel=relative(file);if(overlay.has(rel))module.exports=JSON.parse(committed(rel));else oldJson(module,file);};
 try {
  for(const file of overlay)delete require.cache[path.join(root,file)];
  const result=oldGate.validate(root);
  return {...result,reservedBaseline:BASELINE,reservedRuntimeProof:runtimeProof,historicalOnly:true};
 }finally{fs.readFileSync=rawRead;Module._extensions['.js']=oldJs;Module._extensions['.json']=oldJson;}
}
function validateHistorical(root){return JSON.parse(cp.execFileSync(process.execPath,[__filename,'--isolated',path.resolve(root)],{cwd:root,windowsHide:true,maxBuffer:16*1024*1024,timeout:180000}));}
module.exports={BASELINE,REVIEW,NORMALIZATION,validateHistorical};
if(require.main===module){if(process.argv[2]==='--isolated')process.stdout.write(JSON.stringify(execute(process.argv[3])));else {const r=validateHistorical(path.resolve(__dirname,'../../..'));console.log(JSON.stringify({complete:r.complete,baseline:BASELINE,artAssets:r.reserved.assets,captures:r.artBrowser.captures,runtime:r.reservedRuntimeProof.length}));}}
