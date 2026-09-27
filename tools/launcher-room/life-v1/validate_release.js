'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const NORMALIZATION='CRLF to LF only; all other bytes remain significant';
// This is one reviewed formal merge, not a general-purpose hash bypass.
const FORMAL_BOARD_VARIANT=Object.freeze({
 file:'server/desktop-distribution.js',
 base:'e8cb79e37cedada32cbbaa0a2f67d54d000a61fb121bff5657497515b1a96d85',
 digest:'c9330072bab54d00370735b6fcc01bbcef76e101183dc42b9222e0f4d5769255',
 reason:'Preserve formal Board media policy: the launcher merge adds only LAUNCHER_LIFE_GET and LAUNCHER_LIFE_COMMAND; the candidate-only three-line Board depth manifest exception is not copied into the formal authority.',
 patchPath:'tools/launcher-room/life-v1/review-evidence/formal-merge/desktop-distribution.js.patch',
 patchSha256:'758e224a4e496ffcacc8ed1c4250a91286cb5576dd705195a9737a43943eafce',
 readbackPath:'tools/launcher-room/life-v1/review-evidence/formal-merge/desktop-distribution-readback.json',
 authorityRoot:'D:\\Codex_Release_Worktrees\\board-voyage-records-v1',
 candidateOnlyBlock:"    // The reviewed Board depth catalog is package metadata fetched at runtime,\n    // not media redirected through R2. Allow only this exact JSON for Electron.\n    if (pathname === '/images/board-depth/v1/manifest.json' && isDesktopRenderer(req.headers)) return next();\n"
});
function validateReviewedRuntime(root,review){
 const full=relative=>{assert(typeof relative==='string'&&!path.isAbsolute(relative));const p=path.resolve(root,relative);assert(p.startsWith(path.resolve(root)+path.sep));return p;};
 const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 const read=relative=>fs.readFileSync(full(relative));
 assert.equal(review.runtimeHashNormalization,NORMALIZATION);
 assert(review.runtime&&typeof review.runtime==='object'&&!Array.isArray(review.runtime));
 const variants=review.approvedRuntimeVariants===undefined?{}:review.approvedRuntimeVariants;
 assert(variants&&typeof variants==='object'&&!Array.isArray(variants));
 for(const [file,entries] of Object.entries(variants)){
  const approved=FORMAL_BOARD_VARIANT;
  assert.equal(file,approved.file,'Runtime variants are restricted to the reviewed formal Board merge');
  assert(Array.isArray(entries)&&entries.length===1,'Exactly one reviewed formal variant is permitted');
  const variant=entries[0];
  assert.equal(review.runtime[file],approved.base,'Formal variant base must match its reviewed runtime');
  assert.equal(variant.reviewedBaseNormalizedSha256,approved.base);
  assert.equal(variant.normalizedSha256,approved.digest,'Unapproved formal runtime digest');
  assert.equal(variant.reason,approved.reason,'Missing or changed formal-merge reason');
  assert(variant.evidence&&variant.evidence.patch&&variant.evidence.formalReadback,'Formal variant needs patch and direct readback evidence');
  const patch=variant.evidence.patch,readback=variant.evidence.formalReadback;
  assert.equal(patch.path,approved.patchPath);assert.equal(patch.sha256,approved.patchSha256);
  assert.equal(hash(read(patch.path)),approved.patchSha256,'Changed formal merge patch evidence');
  assert.equal(readback.path,approved.readbackPath);assert.match(readback.sha256,/^[a-f0-9]{64}$/);
  const bytes=read(readback.path);assert.equal(hash(bytes),readback.sha256,'Changed formal runtime readback evidence');
  const proof=JSON.parse(bytes.toString('utf8'));
  assert.equal(proof.schema,'launcher-life-formal-runtime-readback/1');
  assert.equal(proof.runtimePath,approved.file);assert.equal(proof.normalization,NORMALIZATION);
  assert.equal(proof.authorityRoot,approved.authorityRoot);assert.equal(proof.reason,approved.reason);
  assert.equal(proof.candidateNormalizedSha256,approved.base);assert.equal(proof.formalNormalizedSha256,approved.digest);
  assert.equal(proof.patchSha256,approved.patchSha256);assert.equal(proof.onlyDifferenceVerified,true);
  assert.equal(proof.candidateOnlyBlock,approved.candidateOnlyBlock);
 }
 for(const [file,digest] of Object.entries(review.runtime)){
  assert.match(digest,/^[a-f0-9]{64}$/);
  const actual=hash(read(file).toString('utf8').replace(/\r\n/g,'\n'));
  if(actual===digest)continue;
  const approved=variants[file]?.some(variant=>variant.normalizedSha256===actual);
  assert(approved,`Changed reviewed life runtime: ${file}`);
 }
 return true;
}
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
 validateReviewedRuntime(root,review);
 for(const file of ['desktop/launcher-room.js','desktop/launcher-room.css','desktop/launcher-profile-shop.js','desktop/launcher-life-room.js','desktop/launcher-life.js'])assert(review.runtime[file],`Missing runtime coverage ${file}`);
 return {complete:true,assets:manifest.items.length,atlases:expected.length,frames:expected.length*4,review,manifest,humanAcceptance:false};
}
module.exports={validate,validateReviewedRuntime};
if(require.main===module){const value=validate(path.resolve(__dirname,'../../..'));console.log(JSON.stringify({complete:value.complete,assets:value.assets,atlases:value.atlases,frames:value.frames,humanAcceptance:false}));}
