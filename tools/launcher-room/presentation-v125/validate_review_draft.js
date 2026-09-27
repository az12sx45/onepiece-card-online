'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const historical=require('../presentation-v122/validate_historical_life');
const preservation=require('./validate_historical_interaction');
const release=require('./validate_release');
function captureRuntime(root){
  const legacy=preservation.validateHistorical(root),runtime={};
  for(const file of [...Object.keys(legacy.interaction.review.runtime),...release.EXTRA_RUNTIME])runtime[file]=historical.normalizedSha256(fs.readFileSync(historical.safePath(root,file)));
  for(const [file,variants]of Object.entries(legacy.life.review.approvedRuntimeVariants)){
    assert([legacy.life.review.runtime[file],...variants.map(item=>item.normalizedSha256)].includes(runtime[file]),'Unapproved formal Board variant');runtime[file]=legacy.life.review.runtime[file];
  }
  return {runtimeHashNormalization:historical.NORMALIZATION,runtime,approvedRuntimeVariants:JSON.parse(JSON.stringify(legacy.life.review.approvedRuntimeVariants))};
}
function captureEvidence(root,files){return files.map(file=>{assert(file.startsWith(release.EVIDENCE_PREFIX));const bytes=fs.readFileSync(historical.safePath(root,file));const screenshot=file.endsWith('.png');return {path:file,kind:screenshot?'screenshot':'report',sha256:historical.sha256(bytes),...(screenshot?{pixels:require('../presentation-v124/validate_release').pngSize(bytes)}:{})};});}
function createDraft(root){return {schema:'launcher-reserved-crew/1',releaseVersion:'1.2.5',interactionBaseline:preservation.BASELINE,
  status:'DRAFT',blockingIssues:['Awaiting completed reserved artwork, actual pixel/Chromium QA and explicit per-character visual review.'],humanAcceptance:false,method:'',
  limitations:['Automated tests and model inspection are not human playtest acceptance. All four shipping release flags remain false.'],...captureRuntime(root),
  art:{path:'tools/launcher-room/reserved-v1/manifest.json',sha256:''},serverQA:null,clientQA:null,browserQA:null,artBrowserQA:null,visualReview:null,evidence:[]};}
module.exports={captureRuntime,captureEvidence,createDraft};
if(require.main===module){const root=path.resolve(__dirname,'../../..'),mode=process.argv[2];assert(['--capture-runtime','--write-draft'].includes(mode));if(mode==='--capture-runtime')console.log(JSON.stringify(captureRuntime(root),null,2));else{fs.writeFileSync(historical.safePath(root,release.REVIEW_PATH),JSON.stringify(createDraft(root),null,2)+'\n',{flag:'wx'});console.log('DRAFT only; release remains blocked pending real evidence.');}}
