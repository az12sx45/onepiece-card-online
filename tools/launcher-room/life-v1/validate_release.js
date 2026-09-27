'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
function validate(root){
 const full=relative=>{assert(typeof relative==='string'&&!path.isAbsolute(relative));const p=path.resolve(root,relative);assert(p.startsWith(path.resolve(root)+path.sep));return p;};
 const sha=relative=>crypto.createHash('sha256').update(fs.readFileSync(full(relative))).digest('hex');
 const manifest=JSON.parse(fs.readFileSync(full('docs/LAUNCHER_LIFE_ART_20260927.json'),'utf8'));
 assert.equal(manifest.version,'1.2.0');assert.equal(manifest.canonicalCharactersOnly,true);assert.equal(manifest.generator,'OpenAI built-in image_gen');
 assert.deepEqual(manifest.shape,{cell:128,columns:4,rows:1,frames:4,root:[64,112]});
 const expected=require(path.join(root,'desktop/launcher-life-actions')).assets().map(p=>'public/images/launcher_room/life_v1/'+p);
 assert.equal(expected.length,128);assert.deepEqual(manifest.items.map(i=>i.asset).sort(),[...expected,'public/images/launcher_room/furniture/galley-stove.webp',...[0,1,2,3].map(i=>`public/images/launcher_room/furniture_views/galley-stove/${i}.webp`)].sort());
 const webpSize=require('../validate-fullbody-manifest').webpSize;
 for(const item of manifest.items){
  assert.equal(sha(item.asset),item.assetSha256,`Changed reviewed art: ${item.asset}`);
  assert.equal(fs.statSync(full(item.asset)).size,item.assetBytes);
  assert.deepEqual(webpSize(fs.readFileSync(full(item.asset))),item.assetPixels);
  if(item.asset.includes('/life_v1/')){assert.deepEqual(item.assetPixels,[512,128]);assert.equal(item.distinctFrames,4);assert.equal(item.alpha,true);assert.equal(item.clipped,false);}
 }
 assert(manifest.dependencies.length>0);
 for(const item of manifest.dependencies)assert.equal(sha(item.path),item.sha256,`Changed life provenance: ${item.path}`);
 const review=JSON.parse(fs.readFileSync(full(manifest.review),'utf8'));
 assert.equal(review.status,'PASS_WITH_NOTES');assert.deepEqual(review.blockingIssues,[]);assert.equal(review.scope,'actual-renderer-and-whole-figure-art');
 assert(review.evidence.length>0);for(const item of review.evidence)assert.equal(sha(item.path),item.sha256);
 assert.equal(review.runtimeHashNormalization,'CRLF to LF only; all other bytes remain significant');
 for(const [file,digest] of Object.entries(review.runtime))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(full(file),'utf8').replace(/\r\n/g,'\n')).digest('hex'),digest,`Changed reviewed life runtime: ${file}`);
 for(const file of ['desktop/launcher-room.js','desktop/launcher-room.css','desktop/launcher-profile-shop.js','desktop/launcher-life-room.js','desktop/launcher-life.js'])assert(review.runtime[file],`Missing runtime coverage ${file}`);
 return {complete:true,assets:manifest.items.length,atlases:expected.length,frames:expected.length*4,review,manifest,humanAcceptance:false};
}
module.exports={validate};
if(require.main===module){const value=validate(path.resolve(__dirname,'../../..'));console.log(JSON.stringify({complete:value.complete,assets:value.assets,atlases:value.atlases,frames:value.frames,humanAcceptance:false}));}
