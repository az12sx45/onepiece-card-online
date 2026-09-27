'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const gate=require('./validate_release'),history=require('./validate_historical_announcements');
const clone=value=>JSON.parse(JSON.stringify(value));
function run(root,options={}){
 const read=gate.reader(root,options),review=JSON.parse(read(gate.REVIEW_PATH)),legacy=history.validateHistorical(root),checks=[];
 gate.validateReview(root,review,legacy,options);checks.push({name:'actual-complete-review-accepted',status:'PASS'});
 function rejected(name,change){const candidate=clone(review),overlays=new Map();change(candidate,overlays);const original=fs.readFileSync;
  fs.readFileSync=function(file,encoding){for(const [relative,bytes]of overlays){const full=path.resolve(String(file));if(full===path.resolve(root,relative)||options.staging&&full===path.resolve(options.staging,relative))return typeof encoding==='string'?bytes.toString(encoding):Buffer.from(bytes);}return original.apply(this,arguments);};
  try{assert.throws(()=>gate.validateReview(root,candidate,legacy,options),undefined,name);checks.push({name,status:'PASS'});}finally{fs.readFileSync=original;}
 }
 const inject=(candidate,overlays,file,value)=>{const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');overlays.set(file,bytes);const digest=history.sha256(bytes);if(candidate.runtime[file])candidate.runtime[file]=history.normalized(bytes);for(const item of candidate.evidence)if(item.path===file)item.sha256=digest;for(const item of Object.values(candidate))if(item&&typeof item==='object'&&!Array.isArray(item)&&item.path===file)item.sha256=digest;};
 rejected('human-acceptance-cannot-be-invented',r=>r.humanAcceptance=true);
 rejected('blocking-issue-prevents-release',r=>r.blockingIssues.push('unreviewed character'));
 rejected('wrong-launcher-version-rejected',r=>r.releaseVersion='1.2.6');
 rejected('missing-runtime-binding-rejected',r=>delete r.runtime['server/launcher-minigames.js']);
 rejected('changed-current-runtime-rejected',r=>r.runtime['server/launcher-minigames.js']='0'.repeat(64));
 rejected('altered-historical-review-rejected',r=>r.historicalReview.sha256='0'.repeat(64));
 rejected('catalog-mutation-in-launcher-scope-rejected',r=>r.releaseScope.push('public/desktop/catalog-v3.json'));
 rejected('wrong-formal-authority-rejected',(r,o)=>{const value=JSON.parse(read(r.formalCatalogSnapshot.path));value.authorityRoot='D:/LatticeTest';inject(r,o,r.formalCatalogSnapshot.path,value);});
 rejected('historical-announcement-overwrite-rejected',(r,o)=>{const value=JSON.parse(read('config/launcher-announcements-v1.json'));value.announcements[0].body.push('被錯誤改寫的既有公告內容');inject(r,o,'config/launcher-announcements-v1.json',value);});
 rejected('missing-current-update-announcement-rejected',(r,o)=>{const value=JSON.parse(read('config/launcher-announcements-v1.json'));value.announcements=value.announcements.filter(entry=>entry.requiredRelease?.version!=='1.2.7');inject(r,o,'config/launcher-announcements-v1.json',value);});
 rejected('unreleased-character-flag-change-rejected',(r,o)=>{const value=JSON.parse(read('config/launcher-crew-release-v1.json'));value.characters.sabo=true;inject(r,o,'config/launcher-crew-release-v1.json',value);});
 rejected('missing-gpt-asset-rejected',(r,o)=>{const value=JSON.parse(read(r.minigameArt.path));value.assets.pop();inject(r,o,r.minigameArt.path,value);});
 rejected('non-gpt-art-provenance-rejected',(r,o)=>{const value=JSON.parse(read(r.minigameArt.path));value.tool='css mock';inject(r,o,r.minigameArt.path,value);});
 rejected('reassembled-robin-anatomy-rejected',(r,o)=>{const value=JSON.parse(read(r.robinArt.path));value.anatomyReassembled=true;inject(r,o,r.robinArt.path,value);});
 rejected('failed-server-test-rejected',(r,o)=>{const value=JSON.parse(read(r.serverQA.path));value.results[0].status='FAIL';inject(r,o,r.serverQA.path,value);});
 rejected('qa-against-other-source-rejected',(r,o)=>{const value=JSON.parse(read(r.serverQA.path));value.sourceHashes['server/launcher-minigames.js']='0'.repeat(64);inject(r,o,r.serverQA.path,value);});
 rejected('missing-visual-observation-rejected',(r,o)=>{const value=JSON.parse(read(r.visualReview.path));value.images=value.images.filter(item=>item.subject==='minigames');inject(r,o,r.visualReview.path,value);});
 rejected('forged-visual-human-acceptance-rejected',(r,o)=>{const value=JSON.parse(read(r.visualReview.path));value.humanAcceptance=true;inject(r,o,r.visualReview.path,value);});
 const report={schema:'launcher-v127-gate-negative-qa/1',status:'PASS',checks:checks.length,results:checks,reviewSha256:history.sha256(read(gate.REVIEW_PATH)),scriptSha256:history.sha256(fs.readFileSync(__filename)),humanAcceptance:false,stagingCandidate:Boolean(options.staging),createdAt:new Date().toISOString()};
 if(options.report)fs.writeFileSync(options.report,JSON.stringify(report,null,2)+'\n');return{status:'PASS',checks:checks.length,report:options.report||null};
}
module.exports={run};
if(require.main===module){const args=process.argv.slice(2),option=key=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};console.log(JSON.stringify(run(option('--root')||path.resolve(__dirname,'../../..'),{staging:option('--staging'),report:option('--report')})));}
