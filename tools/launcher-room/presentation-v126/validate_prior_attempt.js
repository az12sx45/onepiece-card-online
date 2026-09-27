'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const PREFIX='tools/launcher-room/presentation-v126/review-history/before-profile-bgm/';
const MANIFEST=PREFIX+'ARCHIVE.json';
const MANIFEST_SHA='3328ab192ab5b3af573407c4ea69274a5e3af95a82e5a0460cef4cbefe37e09a';
const REVIEW_SHA='b4eee5e1d2380dea8e723ce062f2d75ea58ac2a0df95af568f15b52c115d27ef';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function validate(root){
 const read=relative=>{assert(typeof relative==='string'&&!relative.includes('..')&&!path.isAbsolute(relative));return fs.readFileSync(path.join(root,PREFIX,relative));};
 const bytes=read('ARCHIVE.json');assert.equal(sha(bytes),MANIFEST_SHA);const record=JSON.parse(bytes);
 assert.equal(record.status,'SUPERSEDED_BY_ADDED_BGM_REQUIREMENT');assert.equal(record.productionDeployed,false);assert.equal(record.originalReviewSha256,REVIEW_SHA);assert.equal(sha(read(record.originalReview)),REVIEW_SHA);
 const review=JSON.parse(read(record.originalReview));assert.equal(record.evidence.length,13);assert.equal(record.runtime.length,32);
 for(const item of record.evidence){assert.equal(sha(read(item.archivedPath)),item.sha256);assert(review.evidence.some(e=>e.path===item.originalPath&&e.sha256===item.sha256));}
 for(const item of record.runtime){assert.equal(item.matchedWhenArchived,true);const source=read(item.archivedPath);assert.equal(sha(source),item.rawSha256);assert.equal(sha(Buffer.from(source.toString('utf8').replace(/\r\n/g,'\n'))),item.reviewedNormalizedSha256);assert.equal(review.runtime[item.originalPath],item.reviewedNormalizedSha256);}
 return {status:'PRESERVED_SUPERSEDED_ATTEMPT',manifest:{path:MANIFEST,sha256:MANIFEST_SHA},reviewSha256:REVIEW_SHA,evidenceFiles:13,runtimeFiles:32,finalAcceptance:false};
}
module.exports={validate,MANIFEST,MANIFEST_SHA};
if(require.main===module)console.log(JSON.stringify(validate(path.resolve(__dirname,'../../..'))));
