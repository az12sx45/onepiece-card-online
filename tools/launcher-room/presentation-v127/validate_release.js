'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const historical=require('./validate_historical_announcements');
const REVIEW_PATH='docs/LAUNCHER_MINIGAMES_20260928.json';
const EVIDENCE_PREFIX='tools/launcher-room/presentation-v127/review-evidence/';
const MINIGAME_MANIFEST='tools/launcher-room/presentation-v127/minigame-art.json';
const ROBIN_MANIFEST='tools/launcher-room/robin-v2/manifest.json';
const MINIGAME_ASSETS=['deck','cargo-food','cargo-tools','cargo-books'].map(key=>'public/images/launcher_room/minigames_v1/'+key+'.webp');
const DIRECTIONS=['east','west','north','south'];
const ROBIN_ASSETS=['portrait.webp',...['walk','acting'].flatMap(kind=>DIRECTIONS.map(direction=>kind+'/'+direction+'.webp')),...['work','read'].flatMap(action=>DIRECTIONS.map(direction=>'life/'+action+'-'+direction+'.webp')),...['eat','rest','sleep','train'].map(action=>'life/'+action+'-south.webp')].map(file=>'public/images/launcher_room/robin_v2/'+file);
const ADDITIONAL_RUNTIME=['desktop/launcher-room-minigames.js','desktop/launcher-room-minigames.css','server/launcher-minigames.js'];
const FORMAL_ROOT='D:/Codex_Release_Worktrees/board-voyage-records-v1';
const CATALOGS=['public/desktop/catalog-v2.json','public/desktop/catalog-v3.json'];
const normalized=historical.normalized,sha256=historical.sha256;
function safe(root,file){assert(typeof file==='string'&&file&&!file.includes('\\')&&!path.isAbsolute(file)&&!file.split('/').includes('..'),'Unsafe release-relative path');const result=path.resolve(root,file);assert(result.startsWith(path.resolve(root)+path.sep));return result;}
function reader(root,options={}){return file=>{const staged=options.staging?safe(options.staging,file):null;return fs.readFileSync(staged&&fs.existsSync(staged)?staged:safe(root,file));};}
function checkBound(read,binding){assert(binding&&typeof binding.path==='string');assert.match(binding.sha256,/^[a-f0-9]{64}$/);const bytes=read(binding.path);assert.equal(sha256(bytes),binding.sha256,'Evidence/art changed: '+binding.path);if(binding.bytes!==undefined)assert.equal(bytes.length,binding.bytes);return bytes;}
function verifySources(read,sources,prefix='',proofs){
 assert(sources&&typeof sources==='object'&&!Array.isArray(sources));assert(Object.keys(sources).length>=3,'QA source bindings missing');
 for(const [file,digest]of Object.entries(sources)){const relative=prefix+file,proof=proofs?.[relative];assert.match(digest,/^[a-f0-9]{64}$/);assert.equal(proof?.sha256,digest,'QA raw-source proof differs: '+relative);assert.match(proof.normalizedSha256,/^[a-f0-9]{64}$/);assert.equal(normalized(read(relative)),proof.normalizedSha256,'Tested source changed beyond CRLF: '+relative);}
}
function resultChecks(report){const checks=Array.isArray(report.checks)?report.checks:report.results;assert(Array.isArray(checks)&&checks.length>0);assert(checks.every(item=>item.status==='PASS'||item.pass===true),'QA contains failures');return checks;}
function validateNotes(root,read,version){
 const config=JSON.parse(read('config/launcher-announcements-v1.json'));
 const previous=JSON.parse(historical.git(root,['cat-file','blob',historical.BASELINE+':config/launcher-announcements-v1.json']));
 assert.equal(config.schemaVersion,1);assert(config.revision>previous.revision);assert(Array.isArray(config.announcements));
 const notes=new Map();for(const entry of config.announcements){assert(!notes.has(entry.id),'Duplicate notice');notes.set(entry.id,entry);}
 for(const entry of previous.announcements)if(entry.status==='published')assert.deepEqual(notes.get(entry.id),entry,'Published notice must stay unchanged: '+entry.id);
 const current=config.announcements.filter(entry=>entry.status==='published'&&entry.scope==='launcher'&&entry.category==='update'&&entry.requiredRelease?.kind==='launcher'&&entry.requiredRelease.version===version);
 assert(current.length>=1,'Current launcher update needs a release-gated announcement');
 for(const note of current){assert(typeof note.title==='string'&&note.title.length>=4);assert(typeof note.summary==='string'&&note.summary.length>=12);assert(Number.isFinite(Date.parse(note.publishedAt)));assert(Array.isArray(note.body)&&note.body.every(line=>typeof line==='string'&&line.length>=8));}
 const body=current.flatMap(note=>note.body).join(' ');for(const word of ['羅賓','補給','特訓','10','親密度'])assert(body.includes(word),'Release notes omit '+word);
 assert(!config.announcements.some(entry=>entry.status==='published'&&['room-character-sabo','room-character-law','room-character-hancock'].includes(entry.requiresCharacterId)),'Preloaded characters remain closed');
 // This release adds no game package. Existing live game catalog variants are
 // preserved separately; do not invent game notes merely to match an old tree.
 return{entries:config.announcements.length,currentNotes:current.length,scopes:['launcher','shop','card','board','chess']};
}
function validateCatalogs(root,read,review){
 const bytes=checkBound(read,review.formalCatalogSnapshot),snapshot=JSON.parse(bytes);
 assert.equal(snapshot.schema,'launcher-v127-formal-catalog-baseline/1');assert.equal(path.resolve(snapshot.authorityRoot).toLowerCase(),path.resolve(FORMAL_ROOT).toLowerCase());assert(Number.isFinite(Date.parse(snapshot.capturedAt)));
 assert.deepEqual(snapshot.files.map(item=>item.path).sort(),[...CATALOGS].sort());
 assert(Array.isArray(review.releaseScope)&&review.releaseScope.length>0);assert(!review.releaseScope.some(file=>CATALOGS.includes(file)),'This launcher release must not write game catalogs');
 const formal=path.resolve(root).toLowerCase()===path.resolve(FORMAL_ROOT).toLowerCase();
 for(const binding of snapshot.files){assert.match(binding.sha256,/^[a-f0-9]{64}$/);const current=read(binding.path),digest=sha256(current);const original=historical.git(root,['cat-file','blob',historical.BASELINE+':'+binding.path]);assert(digest===binding.sha256||!formal&&normalized(current)===normalized(original),'Game catalog changed outside this launcher scope: '+binding.path);}
 return{formalSnapshotSha256:sha256(bytes),gameCatalogsWritten:false};
}
function validateArt(read,review){
 assert.equal(review.minigameArt.path,MINIGAME_MANIFEST);const mini=JSON.parse(checkBound(read,review.minigameArt));
 assert.equal(mini.schema,'launcher-minigame-gpt-art/1');assert.equal(mini.tool,'built-in image_gen');assert.deepEqual(mini.assets.map(item=>item.path).sort(),[...MINIGAME_ASSETS].sort());
 for(const item of mini.assets){const bytes=checkBound(read,item);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert(item.bytes>1000);checkBound(read,item.original);assert(item.original.path.startsWith('tools/launcher-room/presentation-v127/source-png/'));assert(typeof item.promptBrief==='string'&&item.promptBrief.length>20);if(!item.path.endsWith('/deck.webp')){assert.equal(item.width,384);assert.equal(item.height,384);assert.equal(item.alpha,true);}}
 assert.equal(review.robinArt.path,ROBIN_MANIFEST);const robin=JSON.parse(checkBound(read,review.robinArt));
 assert.equal(robin.schema,'one-piece-robin-redraw/2');assert.equal(robin.status,'PASS');assert.equal(robin.humanAcceptance,false);assert.equal(robin.anatomyReassembled,false);assert.equal(robin.mirrored,false);assert.deepEqual(robin.items.map(item=>item.asset).sort(),[...ROBIN_ASSETS].sort());
 for(const source of Object.values(robin.sources)){for(const key of ['image','prompt','receipt'])checkBound(read,source[key]);const receipt=JSON.parse(read(source.receipt.path));assert.equal(receipt.tool,'image_gen.imagegen');assert.equal(receipt.generator,'gpt-image');}
 for(const item of robin.items){
  const bytes=checkBound(read,{path:item.asset,sha256:item.sha256,bytes:item.bytes});assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert(Number.isSafeInteger(item.cell)&&item.cell>=256);assert(Number.isSafeInteger(item.frames)&&item.frames>=1);assert.deepEqual(item.dimensions,[item.cell*item.frames,item.cell]);
  assert(Array.isArray(item.sourceBindings)&&item.sourceBindings.length>0,'Robin source provenance required');for(const source of item.sourceBindings)checkBound(read,source);
  assert.equal(item.frameRecords.length,item.frames);for(const frame of item.frameRecords){const source=robin.sources[frame.source];assert(source,'Unknown Robin original frame source');assert.equal(frame.anatomyReassembled,false);assert.equal(frame.mirrored,false);for(const key of ['image','prompt','receipt'])assert(item.sourceBindings.some(binding=>binding.path===source[key].path&&binding.sha256===source[key].sha256),'Frame source missing from atlas bindings');const transform=frame.inverseWholeImageTransform;assert(Array.isArray(transform)&&transform.length===6&&transform.every(Number.isFinite));assert(transform[0]>0&&transform[0]===transform[4]&&transform[1]===0&&transform[3]===0,'Only uniform complete-figure transform is reviewed');}
  if(item.asset.includes('/walk/')){assert.equal(item.cell,384);assert.equal(item.frames,4);}if(item.asset.includes('/acting/')){assert.equal(item.cell,256);assert.equal(item.frames,8);}
 }
 return{mini,robin,items:[...mini.assets.map(item=>({asset:item.path,assetSha256:item.sha256,assetBytes:item.bytes})),...robin.items.map(item=>({asset:item.asset,assetSha256:item.sha256,assetBytes:item.bytes}))]};
}
function validateReview(root,review,legacy,options={}){
 const read=reader(root,options),json=file=>JSON.parse(read(file));
 assert.equal(review.schema,'launcher-room-minigames-release/1');assert.equal(review.releaseVersion,'1.2.7');assert.equal(review.status,'PASS_WITH_NOTES');assert.equal(review.humanAcceptance,false);assert.deepEqual(review.blockingIssues,[]);assert.equal(review.baseline,historical.BASELINE);assert.equal(review.runtimeHashNormalization,historical.NORMALIZATION);
 assert.equal(review.historicalReview.path,historical.REVIEW);assert.equal(review.historicalReview.sha256,sha256(read(historical.REVIEW)));
 const runtime=[...Object.keys(legacy.review.runtime),...ADDITIONAL_RUNTIME];assert.deepEqual(Object.keys(review.runtime).sort(),runtime.sort());
 assert.deepEqual(review.approvedRuntimeVariants,legacy.review.approvedRuntimeVariants,'Only unchanged historical formal Board variant is allowed');
 for(const [file,digest]of Object.entries(review.runtime)){const actual=normalized(read(file));assert([digest,...(review.approvedRuntimeVariants[file]||[]).map(item=>item.normalizedSha256)].includes(actual),'Current reviewed runtime changed: '+file);}
 assert.equal(json('desktop/package.json').version,review.releaseVersion);
 assert.deepEqual(json('config/launcher-crew-release-v1.json'),{schemaVersion:1,rosterRevision:2,characters:{ace:true,sabo:false,law:false,hancock:false}});
 const announcements=validateNotes(root,read,review.releaseVersion),catalogs=validateCatalogs(root,read,review),art=validateArt(read,review);
 const evidence=new Map();for(const item of review.evidence){assert(item.path.startsWith(EVIDENCE_PREFIX)&&!evidence.has(item.path));checkBound(read,item);evidence.set(item.path,item);}
 const reports={};for(const key of ['serverQA','clientQA','robinQA','lifeQA','aceQA']){assert.equal(evidence.get(review[key].path)?.sha256,review[key].sha256,'Report not bound in evidence: '+key);const report=JSON.parse(checkBound(read,review[key]));assert(report.status==='PASS'||report.ok===true);assert.equal(report.humanAcceptance??false,false);reports[key]={report,checks:resultChecks(report)};}
 assert.equal(review.qaSourceNormalization,historical.NORMALIZATION);
 const server=reports.serverQA.report;assert(reports.serverQA.checks.length>=96);verifySources(read,server.sourceHashes,'',review.qaSourceProofs);assert.deepEqual(Object.keys(server.sourceHashes).sort(),['server/launcher-life-store.js','server/launcher-minigames.js','scripts/launcher_minigames_server_qa.js'].sort());
 assert(reports.lifeQA.checks.length>=160);assert(reports.aceQA.checks.length>=226);verifySources(read,reports.aceQA.report.sourceSha256,'',review.qaSourceProofs);
 const client=reports.clientQA.report;assert.equal(client.schema,'launcher-minigames-client-qa/1');assert(reports.clientQA.checks.length>=10);verifySources(read,client.sourceSha256,'',review.qaSourceProofs);assert(client.limitations.some(line=>/Automated Chromium/.test(line)));assert(client.limitations.some(line=>/Real service/.test(line)));
 for(const key of ['desktop/launcher-room-minigames.js','desktop/launcher-room-minigames.css','desktop/launcher-life-room.js','desktop/auth-service.js','desktop/launcher.html','server/launcher-life-store.js','server/launcher-minigames.js','scripts/launcher_minigames_client_qa.js'])assert(Object.hasOwn(client.sourceSha256,key),'Missing client QA source '+key);
 const robin=reports.robinQA.report;assert.equal(robin.schema,'one-piece-robin-scale-qa/1');assert(reports.robinQA.checks.length>=8);assert.deepEqual(robin.startedSources,robin.completedSources);assert(Object.hasOwn(robin.completedSources,'launcher-room.js'),'Robin portrait route must be included in browser source proof');verifySources(read,robin.completedSources,'desktop/',review.qaSourceProofs);assert.equal(robin.testScriptSha256,sha256(read('scripts/launcher_robin_scale_qa.js')));assert(/Real headless Chromium/.test(robin.scope));
 for(const [key,report]of [['clientQA',client],['robinQA',robin]]){assert(report.captures.length>=2);for(const capture of report.captures){const file=capture.path.startsWith(EVIDENCE_PREFIX)?capture.path:path.posix.join(path.posix.dirname(review[key].path),capture.path);assert.equal(evidence.get(file)?.sha256,capture.sha256,'Browser capture not bound: '+file);}}
 const visual=JSON.parse(checkBound(read,review.visualReview));assert.equal(evidence.get(review.visualReview.path)?.sha256,review.visualReview.sha256);assert(['PASS','PASS_WITH_NOTES'].includes(visual.status));assert.equal(visual.humanAcceptance,false);assert.deepEqual(visual.blockingIssues,[]);assert(typeof visual.method==='string'&&visual.method.length>20);assert(Array.isArray(visual.images)&&visual.images.length>=4);assert.deepEqual([...new Set(visual.images.map(item=>item.subject))].sort(),['minigames','robin']);for(const item of visual.images){assert.equal(evidence.get(item.path)?.sha256,item.sha256,'Visual review must identify actual current captured pixels');}
 return{...legacy,complete:true,review,historicalOnly:false,announcements,catalogs,serverChecks:reports.serverQA.checks.length,aceChecks:reports.aceQA.checks.length,functionalChecks:reports.clientQA.checks.length,interactionChecks:reports.clientQA.checks.length,robinChecks:reports.robinQA.checks.length,newAssets:art.items.length,newArt:{manifest:{items:art.items},minigames:art.mini,robin:art.robin},currentRuntimeFiles:runtime.length,activeCharacters:11};
}
function validate(root,options={}){const read=reader(root,options),review=JSON.parse(read(REVIEW_PATH));return validateReview(root,review,historical.validateHistorical(root),options);}
module.exports={validate,validateReview,validateNotes,validateCatalogs,validateArt,reader,REVIEW_PATH,EVIDENCE_PREFIX,MINIGAME_MANIFEST,ROBIN_MANIFEST,MINIGAME_ASSETS,ROBIN_ASSETS,ADDITIONAL_RUNTIME,FORMAL_ROOT,CATALOGS};
if(require.main===module){const args=process.argv.slice(2),rootIndex=args.indexOf('--root'),stageIndex=args.indexOf('--staging'),root=rootIndex>=0?args[rootIndex+1]:path.resolve(__dirname,'../../..');const result=validate(root,{staging:stageIndex>=0?args[stageIndex+1]:undefined});console.log(JSON.stringify({complete:true,version:result.review.releaseVersion,serverChecks:result.serverChecks,clientChecks:result.functionalChecks,robinChecks:result.robinChecks,newAssets:result.newAssets,historicalBaseline:result.announcementsBaseline,stagingCandidate:stageIndex>=0,humanAcceptance:false}));}
