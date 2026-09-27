'use strict';
// Mutations are isolated JSON copies. No artifact, source or formal file changes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const historical=require('../presentation-v122/validate_historical_life');
const preservation=require('./validate_historical_interaction'),release=require('./validate_release'),art=require('./validate_reserved');
function run(root){
 const legacy=preservation.validateHistorical(root),read=file=>JSON.parse(fs.readFileSync(historical.safePath(root,file),'utf8'));
 const review=read(release.REVIEW_PATH);assert.equal(release.validateReview(root,review,legacy).complete,true);
 const checks=[{name:'actual frozen reserved review passes',status:'PASS'}];
 function rejectAction(name,action,expected){let message;try{action();}catch(error){message=error.message;}assert(message&&expected.test(message),'Gate failed expected refusal: '+name+' / '+message);checks.push({name,status:'PASS',expectedRefusal:message});}
 const reject=(name,mutate,expected)=>{const copy=structuredClone(review);mutate(copy);rejectAction(name,()=>release.validateReview(root,copy,legacy),expected);};
 reject('draft cannot release',r=>{r.status='DRAFT';},/review is incomplete/);
 reject('older version cannot release',r=>{r.releaseVersion='1.2.4';},/1\.2\.5/);
 reject('blocking issue cannot release',r=>{r.blockingIssues=['unfinished art'];},/deep-equal/);
 reject('model review cannot claim human acceptance',r=>{r.humanAcceptance=true;},/not human acceptance/);
 reject('current runtime coverage cannot be omitted',r=>{delete r.runtime['desktop/launcher-reserved-crew.js'];},/exactly 25/);
 reject('changed runtime cannot reuse review',r=>{r.runtime['server/launcher-crew-release.js']='0'.repeat(64);},/Changed reviewed reserved runtime/);
 reject('new runtime variants cannot bypass checks',r=>{r.approvedRuntimeVariants['desktop/launcher-reserved-crew.js']=[];},/immutable formal Board variant/);
 reject('canonical Board hash cannot be rewritten',r=>{r.runtime['server/desktop-distribution.js']='0'.repeat(64);},/Changed reviewed reserved runtime|strictly equal/);
 reject('unexpected art manifest cannot release',r=>{r.art.path='missing.json';},/strictly equal/);
 reject('changed manifest cannot reuse review',r=>{r.art.sha256='0'.repeat(64);},/Reserved evidence changed/);
 reject('old evidence directory cannot masquerade as new review',r=>{r.evidence[0].path='tools/launcher-room/presentation-v124/review-evidence/old.json';},/presentation-v125/);
 reject('duplicate evidence rejected',r=>{r.evidence.push({...r.evidence[0]});},/Duplicate evidence/);
 reject('changed evidence rejected',r=>{r.evidence[0].sha256='0'.repeat(64);},/Reserved evidence changed/);
 rejectAction('all five QA references must be independently bound',()=>{
   for(const field of ['serverQA','clientQA','browserQA','artBrowserQA','visualReview']){
     const copy=structuredClone(review);copy[field]={path:'missing.json',sha256:'0'.repeat(64)};
     assert.throws(()=>release.validateReview(root,copy,legacy),/not bound|Actual art browser QA must bind/,'Unbound '+field+' must fail');
   }
   throw new Error('All five unbound QA reports rejected');
 },/All five unbound QA reports rejected/);
 reject('missing concrete review method rejected',r=>{r.method='';},/actual review method/);
 reject('missing limitations rejected',r=>{r.limitations=[];},/evidence limitations/);
 const manifest=read(art.MANIFEST);
 rejectAction('missing reserved asset rejected',()=>{const copy=structuredClone(manifest);copy.items.pop();art.validate(root,copy);},/Exactly 68/);
 rejectAction('unfinished exporter rejected',()=>{const copy=structuredClone(manifest);copy.status='PENDING';art.validate(root,copy);},/export is incomplete/);
 rejectAction('shipping release flag cannot silently activate',()=>release.validateConfig({schemaVersion:1,rosterRevision:1,characters:{ace:true,sabo:false,law:false,hancock:false}}),/explicitly false/);
 rejectAction('unfinalized export cannot release',()=>{const copy=structuredClone(manifest);copy.exportContractFinalized=false;art.validate(root,copy);},/not been finalized/);
 rejectAction('synthetic fixture sources cannot release',()=>{const copy=structuredClone(manifest);copy.fixtureSources=true;art.validate(root,copy);},/Synthetic fixture sources cannot/);
 rejectAction('wrong atlas geometry cannot release',()=>{const copy=structuredClone(manifest);copy.items[0].cell=128;art.validate(root,copy);},/strictly equal/);
 rejectAction('assembled body parts cannot release',()=>{const copy=structuredClone(manifest);copy.items[0].frames[0].anatomyReassembled=true;art.validate(root,copy);},/deep-equal|strictly equal/);
 assert.equal(checks.length,24,'Maintain all 24 meaningful refusal concepts');
 return {status:'PASS',kind:'real-review-gate-negative-tests',releaseVersion:'1.2.5',reviewSha256:historical.sha256(fs.readFileSync(historical.safePath(root,release.REVIEW_PATH))),testScriptSha256:historical.sha256(fs.readFileSync(__filename)),recordedAt:new Date().toISOString(),productionDeployed:false,humanAcceptance:false,checks,limitations:['JSON integrity refusal probes are not art review, real-account testing or deployment.']};
}
module.exports={run};
if(require.main===module){const result=run(path.resolve(__dirname,'../../..'));if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,checks:result.checks.length,productionDeployed:false}));}
