"use strict";
// Run the unchanged 1.2.4 review against its exact committed 22 runtime blobs.
// Historical art and evidence are still verified from this checkout.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm'),assert=require('node:assert/strict');
const historical=require('../presentation-v122/validate_historical_life');
const previous=require('../presentation-v124/validate_historical_radial');
const BASELINE='b8a459e8a5ed49aead8aee93b96a76728e02b537';
const REVIEW='docs/LAUNCHER_ROOM_INTERACTION_20260927.json';
const VALIDATOR='tools/launcher-room/presentation-v124/validate_release.js';
const HD='tools/launcher-room/presentation-v124/validate_hd.js';
const WEBP='tools/launcher-room/validate-fullbody-manifest.js';
const PINNED=Object.freeze({
  "docs/LAUNCHER_ROOM_INTERACTION_20260927.json": "c18777e9af533b19f67d0b43a8dbc9692ad54e6182d578b3b3cf044b940c2dda",
  "tools/launcher-room/presentation-v124/validate_release.js": "09dc7255550108475d70f2a46bc8bc6af02ec40cf58ac3244a8d38a04a6dc364",
  "tools/launcher-room/presentation-v124/validate_historical_radial.js": "512ffb1e006116a161223e5a49e300d897b2b3df4251bb7f04f3d242831351be",
  "tools/launcher-room/presentation-v124/validate_hd.js": "1534b65912ac2c68efa236e3610c382a919b295939c818d056b6e8a395e2cbd1",
  "tools/launcher-room/validate-fullbody-manifest.js": "d69f1677617dd8a13ecf6ac4b98c2c192d80384cce15121bbb29438f8da9bb0e"
});
function validateHistorical(root){
 root=path.resolve(root);const legacy=previous.validateHistorical(root);
 const git=args=>cp.execFileSync('git',args,{cwd:root,windowsHide:true,maxBuffer:64*1024*1024,timeout:30000});
 assert.equal(git(['rev-parse','--verify',BASELINE+'^{commit}']).toString().trim(),BASELINE);
 const blobs=new Map();const committed=file=>{historical.safePath(root,file);if(!blobs.has(file))blobs.set(file,git(['cat-file','blob',BASELINE+':'+file]));return blobs.get(file);};
 for(const [file,digest]of Object.entries(PINNED)){
  assert.equal(historical.normalizedSha256(committed(file)),digest,'Historical interaction baseline changed: '+file);
  assert.equal(historical.normalizedSha256(fs.readFileSync(historical.safePath(root,file))),digest,'Immutable 1.2.4 review/gate changed: '+file);
 }
 const review=JSON.parse(committed(REVIEW)),runtimePaths=new Set(Object.keys(review.runtime));assert.equal(runtimePaths.size,22);
 const runtimeProof=[...runtimePaths].map(file=>{const bytes=committed(file);assert.equal(historical.normalizedSha256(bytes),review.runtime[file],'Historical interaction runtime differs: '+file);return {path:file,rawSha256:historical.sha256(bytes),normalizedSha256:review.runtime[file]};});
 const readFileSync=(file,options)=>{const rel=path.relative(root,path.resolve(file)).split(path.sep).join('/');if(!runtimePaths.has(rel))return fs.readFileSync(file,options);const bytes=committed(rel),encoding=typeof options==='string'?options:options&&options.encoding;return encoding?bytes.toString(encoding):Buffer.from(bytes);};
 const context=vm.createContext({Buffer,console}),loaded=new Map(),allowed=new Set([VALIDATOR,HD,WEBP]);
 const load=relative=>{
  assert(allowed.has(relative),'Unexpected historical interaction module: '+relative);if(loaded.has(relative))return loaded.get(relative).exports;
  const module={exports:{}};loaded.set(relative,module);
  const localRequire=name=>{
   if(name==='node:fs')return Object.freeze({readFileSync,statSync:fs.statSync.bind(fs)});
   if(['node:path','node:assert/strict','node:crypto'].includes(name))return require(name);
   if(name==='../presentation-v122/validate_historical_life')return historical;
   if(name==='./validate_historical_radial')return previous;
   return load(path.relative(root,path.resolve(root,path.dirname(relative),name+'.js')).split(path.sep).join('/'));
  };
  const filename=historical.safePath(root,relative);
  const wrapper=new vm.Script('(function(module,exports,require,__filename,__dirname){\n'+committed(relative).toString('utf8')+'\n})',{filename:BASELINE+':'+relative}).runInContext(context);
  wrapper(module,module.exports,localRequire,filename,path.dirname(filename));return module.exports;
 };
 const oldContext={...legacy,validateCurrentRuntime:checked=>{for(const [file,digest]of Object.entries(checked.runtime)){assert(runtimePaths.has(file),'Unexpected historical interaction source');assert.equal(historical.normalizedSha256(committed(file)),digest,'Historical interaction source changed: '+file);}}};
 const realmReview=new vm.Script('JSON.parse('+JSON.stringify(committed(REVIEW).toString('utf8'))+')').runInContext(context);
 const result=load(VALIDATOR).validateReview(root,realmReview,oldContext);
 return {...legacy,interaction:result,interactionBaseline:BASELINE,interactionRuntimeProof:runtimeProof};
}
module.exports={validateHistorical,BASELINE,REVIEW,VALIDATOR,PINNED};
if(require.main===module){const r=validateHistorical(path.resolve(__dirname,'../../..'));console.log(JSON.stringify({complete:r.interaction.complete,historicalInteractionRuntime:r.interactionRuntimeProof.length,baseline:BASELINE,hdAssets:r.interaction.hd.assets}));}
