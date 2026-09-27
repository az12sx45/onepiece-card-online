'use strict';
// No acceptance is invented here: every required report, capture, source and
// independent visual review must already exist and pass validateReview.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const gate=require('./validate_release'),history=require('./validate_historical_announcements');
const REPORTS={serverQA:'server-qa.json',clientQA:'minigames-client/MINIGAMES_CLIENT_QA.json',robinQA:'robin-scale-complete/ROBIN_SCALE_QA.json',lifeQA:'life-regression.json',aceQA:'ace-regression.json'};
function walk(root,directory,result=new Set()){
 const full=path.join(root,directory);if(!fs.existsSync(full))return result;
 for(const entry of fs.readdirSync(full,{withFileTypes:true})){assert(!entry.isSymbolicLink(),'Evidence directory cannot contain links');const relative=directory+'/'+entry.name;if(entry.isDirectory())walk(root,relative,result);else if(entry.isFile())result.add(relative);}
 return result;
}
function freeze(root,options){
 root=path.resolve(root);const read=gate.reader(root,options),bind=file=>({path:file,sha256:history.sha256(read(file))});
 assert(options.scope,'Explicit reviewed release-scope JSON required');const scope=JSON.parse(fs.readFileSync(options.scope));const releaseScope=Array.isArray(scope)?scope:scope.files;assert(Array.isArray(releaseScope)&&releaseScope.every(file=>typeof file==='string'));
 const legacy=history.validateHistorical(root),evidenceFiles=walk(root,gate.EVIDENCE_PREFIX.replace(/\/$/,''));if(options.staging)walk(options.staging,gate.EVIDENCE_PREFIX.replace(/\/$/,''),evidenceFiles);
 const qaSourceProofs={};
 for(const key of ['serverQA','clientQA','aceQA','robinQA']){const report=JSON.parse(read(gate.EVIDENCE_PREFIX+REPORTS[key]));const sources=key==='serverQA'?report.sourceHashes:key==='robinQA'?report.completedSources:report.sourceSha256;for(const [file,digest]of Object.entries(sources)){const relative=(key==='robinQA'?'desktop/':'')+file,bytes=read(relative);assert.equal(history.sha256(bytes),digest,'Freeze requires exact QA source bytes before recording CRLF-only proof: '+relative);const proof={sha256:digest,normalizedSha256:history.normalized(bytes)};if(qaSourceProofs[relative])assert.deepEqual(qaSourceProofs[relative],proof);qaSourceProofs[relative]=proof;}}
 const review={schema:'launcher-room-minigames-release/1',releaseVersion:'1.2.7',baseline:history.BASELINE,recordedAt:new Date().toISOString(),status:'PASS_WITH_NOTES',humanAcceptance:false,blockingIssues:[],
  method:'Current minigame economy, real Chromium interaction, Robin renderer frames, GPT art provenance and independent visual observations are bound to exact local source/evidence. Historical v126 and older reviews run against their committed runtime and preserved evidence.',
  limitations:['Automated PGlite/browser/renderer QA is not human gameplay or physical-device acceptance.','This source review does not prove installer publication or canonical deployment.','The catalog snapshot records the exact independent formal game state; this launcher update does not modify either game catalog.'],
  runtimeHashNormalization:history.NORMALIZATION,runtime:Object.fromEntries([...Object.keys(legacy.review.runtime),...gate.ADDITIONAL_RUNTIME].map(file=>[file,history.normalized(read(file))])),approvedRuntimeVariants:legacy.review.approvedRuntimeVariants,
  historicalReview:bind(history.REVIEW),formalCatalogSnapshot:bind(gate.EVIDENCE_PREFIX+'formal-catalog-baseline.json'),releaseScope:[...new Set(releaseScope)].sort(),qaSourceNormalization:history.NORMALIZATION,qaSourceProofs,
  minigameArt:bind(gate.MINIGAME_MANIFEST),robinArt:bind(gate.ROBIN_MANIFEST),evidence:[...evidenceFiles].sort().map(bind),
  ...Object.fromEntries(Object.entries(REPORTS).map(([key,file])=>[key,bind(gate.EVIDENCE_PREFIX+file)])),visualReview:bind(gate.EVIDENCE_PREFIX+'independent-visual-review.json')};
 const result=gate.validateReview(root,review,legacy,options);
 const output=path.join(options.staging||root,gate.REVIEW_PATH);assert(!fs.existsSync(output),'Review exists; retain it as history before an explicitly new freeze');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(review,null,2)+'\n');
 return{status:'PASS',review:output,sha256:history.sha256(fs.readFileSync(output)),currentRuntimeFiles:result.currentRuntimeFiles,newAssets:result.newAssets,serverChecks:result.serverChecks,clientChecks:result.functionalChecks,robinChecks:result.robinChecks,stagingCandidate:Boolean(options.staging)};
}
module.exports={freeze,REPORTS};
if(require.main===module){const args=process.argv.slice(2),option=key=>{const i=args.indexOf(key);return i<0?undefined:args[i+1];};console.log(JSON.stringify(freeze(option('--root')||path.resolve(__dirname,'../../..'),{staging:option('--staging'),scope:option('--scope')})));}
