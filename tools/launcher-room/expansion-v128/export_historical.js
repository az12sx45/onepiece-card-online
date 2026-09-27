'use strict';
// Copy a small, byte-bound runtime overlay from the already reviewed 1.2.7
// build. It is source evidence, never a second implementation shipped in ASAR.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const history=require('../presentation-v127/validate_historical_announcements');
const REVIEW='docs/LAUNCHER_MINIGAMES_20260928.json',REVIEW_SHA='5da1b92a51b94580a073965c128b4ff1958b66cb4ec9a9be19041c8480410430';
const SOURCE_COMMIT='f0ece52f27d05b817b85b42185d13dab26ab057b';
function exportHistorical(root,source){
 root=path.resolve(root);source=path.resolve(source);const destination=path.join(root,'tools/launcher-room/expansion-v128/historical-v127');
 assert(!fs.existsSync(destination),'Historical snapshot already exists; never silently replace it');
 assert.equal(history.git(source,['rev-parse','HEAD']).toString().trim(),SOURCE_COMMIT);assert.equal(history.git(source,['status','--porcelain','--untracked-files=all']).toString().trim(),'');
 const reviewBytes=fs.readFileSync(path.join(source,REVIEW));assert.equal(history.sha256(reviewBytes),REVIEW_SHA);const review=JSON.parse(reviewBytes);
 const result=require(path.join(source,'tools/launcher-room/presentation-v127/validate_release')).validate(source);assert.equal(result.complete,true);
 const paths=[...new Set([...Object.keys(review.runtime),...Object.keys(review.qaSourceProofs),'public/desktop/catalog-v2.json','public/desktop/catalog-v3.json','scripts/launcher_robin_scale_qa.js'])].sort();
 const files=[];for(const file of paths){const bytes=fs.readFileSync(path.join(source,file));if(review.runtime[file])assert.equal(history.normalized(bytes),review.runtime[file]);const target=path.join(destination,'files',file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});files.push({path:file,snapshot:'tools/launcher-room/expansion-v128/historical-v127/files/'+file,sha256:history.sha256(bytes),normalizedSha256:history.normalized(bytes),bytes:bytes.length});}
 const manifest={schema:'launcher-v127-portable-history/1',sourceCommit:SOURCE_COMMIT,sourceReview:{path:REVIEW,sha256:REVIEW_SHA},createdAt:new Date().toISOString(),method:'Original 1.2.7 source gate passed in the unchanged frozen build; copied exact runtime, QA source and catalog bytes. Future validation re-executes the unchanged original gate with this overlay and retained original evidence. No dependency on the local-only build commit at validation time.',originalGatePassed:true,files};
 const output=path.join(destination,'manifest.json');fs.writeFileSync(output,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return{status:'PASS',files:files.length,manifest:output,sha256:history.sha256(fs.readFileSync(output))};
}
module.exports={exportHistorical,REVIEW,REVIEW_SHA,SOURCE_COMMIT};
if(require.main===module){assert(process.argv[2]&&process.argv[3],'Usage: export_historical.js ROOT FROZEN_SOURCE');console.log(JSON.stringify(exportHistorical(process.argv[2],process.argv[3])));}
