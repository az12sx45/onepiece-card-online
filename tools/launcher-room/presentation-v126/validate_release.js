'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const historical=require('../presentation-v122/validate_historical_life');
const preserved=require('./validate_historical_reserved');
const formalVariant=require('./validate_formal_variant');
const priorAttempt=require('./validate_prior_attempt');
const REVIEW_PATH='docs/LAUNCHER_ANNOUNCEMENTS_20260927.json';
const EVIDENCE_PREFIX='tools/launcher-room/presentation-v126/review-evidence/';
const REPORTS=Object.freeze({serverQA:EVIDENCE_PREFIX+'ANNOUNCEMENTS_SERVER_QA.json',aceQA:EVIDENCE_PREFIX+'ACE_RELEASE_QA.json',clientQA:EVIDENCE_PREFIX+'ANNOUNCEMENTS_CLIENT_QA.json',productionVisualQA:EVIDENCE_PREFIX+'ANNOUNCEMENTS_PRODUCTION_VISUAL_QA.json',bgmServerQA:EVIDENCE_PREFIX+'PROFILE_BGM_SERVER_QA.json',bgmClientQA:EVIDENCE_PREFIX+'PROFILE_BGM_CLIENT_QA.json'});
const QA_SOURCES=Object.freeze({
 bgmServerQA:['server/launcher-profile-shop.js','server/launcher-life-store.js','server/launcher-crew-release.js','server/index.js','config/launcher-crew-release-v1.json','config/launcher-announcements-v1.json','scripts/launcher_profile_bgm_server_qa.js'],
 bgmClientQA:['launcher-profile-shop.js','launcher-profile-shop.css','launcher.html','launcher.js','main.js','auth-service.js'],
 serverQA:['config/launcher-announcements-v1.json','config/launcher-crew-release-v1.json','server/launcher-announcements.js','server/launcher-crew-release.js','server/launcher-profile-shop.js','server/index.js','server/desktop-distribution.js','desktop/launcher-update-service.js','scripts/launcher_announcements_server_qa.js'],
 aceQA:['config/launcher-crew-release-v1.json','server/launcher-crew-release.js','server/launcher-profile-shop.js','server/launcher-life.js','server/launcher-life-store.js','server/index.js','desktop/auth-service.js','desktop/launcher-reserved-crew.js','desktop/launcher-life-data.js','scripts/launcher_ace_release_qa.js'],
 clientQA:['main.js','preload.js','auth-service.js','launcher.html','launcher.js','launcher-updates-ui.js','launcher-profile-shop.js','launcher-announcements.js','launcher-announcements.css']
});
const ADDITIONAL_RUNTIME=Object.freeze(['desktop/launcher-announcements.js','desktop/launcher-announcements.css','server/launcher-announcements.js','config/launcher-announcements-v1.json','desktop/package.json','desktop/package-lock.json','desktop/launcher-updates-ui.js']);
const read=(root,file)=>fs.readFileSync(historical.safePath(root,file));
const json=(root,file)=>JSON.parse(read(root,file));
function validateConfig(config){assert.deepEqual(config,{schemaVersion:1,rosterRevision:2,characters:{ace:true,sabo:false,law:false,hancock:false}},'Only Ace may be released in this update');}
function validateAppendOnly(previous,current){
 const next=new Map(current.announcements.map(entry=>[entry.id,entry]));
 for(const entry of previous.announcements||[])if(entry.status==='published')assert.deepEqual(next.get(entry.id),entry,'Published announcement '+entry.id+' must be retained unchanged; publish a correction with a new ID');
}
function validateAnnouncements(root,config){
 assert.equal(config.schemaVersion,1);assert(Number.isSafeInteger(config.revision)&&config.revision>0);assert(Array.isArray(config.announcements));
 const ids=new Set(),allowedScopes=['launcher','shop','card','board','chess'];
 for(const entry of config.announcements){
  assert(typeof entry.id==='string'&&entry.id&&!ids.has(entry.id),'Announcement IDs must be unique');ids.add(entry.id);
  assert(allowedScopes.includes(entry.scope));assert(['published','draft'].includes(entry.status));
  assert(typeof entry.title==='string'&&entry.title.trim().length>=4);assert(typeof entry.summary==='string'&&entry.summary.trim().length>=12);
  assert(Array.isArray(entry.body)&&entry.body.length&&entry.body.every(line=>typeof line==='string'&&line.trim().length>=8),'Meaningful explicit update descriptions required');
  assert(Number.isFinite(Date.parse(entry.publishedAt)),'Valid publication time required');
  if(['card','board','chess'].includes(entry.scope)){assert.equal(entry.requiredRelease?.kind,entry.scope);assert.match(entry.requiredRelease.releaseId,/^package-[a-f0-9]{16}$/);}
  else {assert.equal(entry.requiredRelease?.kind,'launcher');assert.match(entry.requiredRelease.version,/^\d+\.\d+\.\d+$/);}
 }
 const version=json(root,'desktop/package.json').version;
 const current=config.announcements.filter(entry=>entry.status==='published'&&entry.requiredRelease?.kind==='launcher'&&entry.requiredRelease.version===version);
 assert(current.some(entry=>entry.scope==='launcher'&&entry.category==='update'),'Missing launcher release note for '+version);
 assert(current.some(entry=>entry.scope==='launcher'&&/BGM/.test(entry.body.join(' '))&&/自動播放/.test(entry.body.join(' '))),'Current release notes must describe profile BGM autoplay');
 assert(current.some(entry=>entry.requiresCharacterId==='room-character-ace'&&entry.cta?.kind==='shop'&&entry.cta.itemId==='room-character-ace'&&/艾斯/.test(entry.title)),'Ace listing must have its own internal shop announcement');
 for(const entry of current)assert(!['room-character-sabo','room-character-law','room-character-hancock'].includes(entry.requiresCharacterId),'Unreleased characters cannot be announced as available');
 const oldNotesPath='config/launcher-announcements-v1.json';
 if(cp.execFileSync('git',['ls-tree','--name-only',preserved.BASELINE,oldNotesPath],{cwd:root,windowsHide:true}).toString().trim()){const previous=JSON.parse(cp.execFileSync('git',['cat-file','blob',preserved.BASELINE+':'+oldNotesPath],{cwd:root,windowsHide:true}));validateAppendOnly(previous,config);}
 const oldCatalog=JSON.parse(cp.execFileSync('git',['cat-file','blob',preserved.BASELINE+':public/desktop/catalog-v3.json'],{cwd:root,windowsHide:true}));
 const catalog=json(root,'public/desktop/catalog-v3.json');
 for(const key of ['card','board','chess'])if(catalog.games[key].releaseId!==oldCatalog.games[key].releaseId){assert(config.announcements.some(entry=>entry.status==='published'&&entry.scope===key&&entry.category==='update'&&entry.requiredRelease?.releaseId===catalog.games[key].releaseId),'Missing '+key+' release note for '+catalog.games[key].releaseId);}
 return {entries:config.announcements.length,currentNotes:current.length,scopes:allowedScopes};
}
function validateSources(root,report){
 assert(report.sourceSha256&&typeof report.sourceSha256==='object','QA must bind tested sources');
 const files=Object.keys(report.sourceSha256);assert(files.length>=3,'QA source coverage missing');
 for(const file of files){
  const relative=file.startsWith('desktop/')||file.startsWith('server/')||file.startsWith('scripts/')||file.startsWith('config/')?file:'desktop/'+file;
  assert.match(report.sourceSha256[file],/^[a-f0-9]{64}$/);
  const normalized=report.sourceNormalizedSha256?.[file];
  if(normalized){const actual=historical.normalizedSha256(read(root,relative));if(relative===formalVariant.FILE){const variant=formalVariant.validate(root);assert.equal(normalized,variant.reviewedBaseNormalizedSha256);assert([normalized,variant.normalizedSha256].includes(actual),'Formal Board source differs from exact allowed delta');}else assert.equal(normalized,actual,'Tested source changed: '+relative);}
  else assert.equal(report.sourceSha256[file],historical.sha256(read(root,relative)),'Tested source changed: '+relative);
 }
}
function validateReview(root,review,legacy){
 assert.equal(review.schema,'launcher-announcements-release/1');assert.equal(review.releaseVersion,'1.2.6');assert.equal(review.status,'PASS_WITH_NOTES');assert.equal(review.humanAcceptance,false);assert.deepEqual(review.blockingIssues,[]);
 assert.deepEqual(review.priorAttempt,priorAttempt.validate(root),'First-pass evidence must remain preserved as superseded history');
 assert.equal(review.reservedBaseline,preserved.BASELINE);assert.equal(review.runtimeHashNormalization,historical.NORMALIZATION);
 assert.equal(review.historicalReview.path,preserved.REVIEW);assert.equal(review.historicalReview.sha256,historical.sha256(read(root,preserved.REVIEW)));
 assert.deepEqual(review.approvedRuntimeVariants,{[formalVariant.FILE]:[formalVariant.validate(root)]},'Only the exact preserved Board event insertion is approved');
 const runtime=[...Object.keys(legacy.review.runtime),...ADDITIONAL_RUNTIME];assert.deepEqual(Object.keys(review.runtime).sort(),runtime.sort());
 for(const [file,digest]of Object.entries(review.runtime)){const actual=historical.normalizedSha256(read(root,file));assert([digest,...(review.approvedRuntimeVariants?.[file]||[]).map(item=>item.normalizedSha256)].includes(actual),'Current runtime changed: '+file);}
 validateConfig(json(root,'config/launcher-crew-release-v1.json'));
 const announcements=validateAnnouncements(root,json(root,'config/launcher-announcements-v1.json'));
 const shop=require(path.join(root,'server/launcher-profile-shop.js')),life=require(path.join(root,'server/launcher-life.js'));
 const ids=shop.CATALOG.filter(item=>item.type==='room_character').map(item=>item.id);
 assert.equal(ids.length,11);assert(ids.includes('room-character-ace'));assert(!ids.some(id=>/-(sabo|law|hancock)$/.test(id)));assert.equal(life.CREW.length,11);assert(life.CREW.includes('ace'));
 const evidence=new Map();for(const item of review.evidence){assert(item.path.startsWith(EVIDENCE_PREFIX)&&!evidence.has(item.path));assert.equal(item.sha256,historical.sha256(read(root,item.path)),'Current QA evidence changed');evidence.set(item.path,item);}
 const reports={};for(const [name,file]of Object.entries(REPORTS)){
  assert.equal(review[name].path,file);assert.equal(review[name].sha256,evidence.get(file)?.sha256);const report=json(root,file);assert(report.status==='PASS'||report.ok===true);assert.equal(report.humanAcceptance??false,false);
  const checks=Array.isArray(report.checks)?report.checks:report.results;assert(Array.isArray(checks)&&checks.length>0&&checks.every(item=>item.status==='PASS'),'Incomplete '+name);assert.deepEqual(Object.keys(report.sourceSha256).sort(),[...QA_SOURCES[name==='productionVisualQA'?'clientQA':name]].sort(),'QA source coverage differs: '+name);validateSources(root,report);if(['clientQA','productionVisualQA','bgmClientQA'].includes(name))assert.equal(report.testScriptSha256,historical.sha256(read(root,{clientQA:'scripts/launcher_announcements_client_qa.js',productionVisualQA:'scripts/launcher_announcements_production_visual_qa.js',bgmClientQA:'scripts/launcher_profile_bgm_client_qa.js'}[name])),'Client test script changed');reports[name]={report,checks:checks.length};
 }
 assert(reports.aceQA.checks>=211,'Preserve complete Ace release/economy/legacy tests');assert(reports.clientQA.checks>=10,'Actual browser announcement interaction coverage required');assert(reports.serverQA.checks>=10,'Server announcement lifecycle coverage required');
 assert(/Chromium|Chrome/.test(reports.clientQA.report.scope||''),'Actual Chromium UI required');
 const bgmServer=reports.bgmServerQA.report,bgm=reports.bgmClientQA.report;
 assert.equal(bgmServer.kind,'isolated-in-memory-PGlite-profile-BGM-QA');assert.equal(reports.bgmServerQA.checks,32);assert.equal(bgmServer.sourceStable,true);
 assert.equal(bgm.schema,'one-piece-launcher-profile-bgm-client-qa/1');assert.equal(bgm.humanAcceptance,false);assert.equal(bgm.checks,15);assert.equal(reports.bgmClientQA.checks,15);
 assert(/Actual headless Chromium/.test(bgm.scope)&&/No autoplay-policy browser override/.test(bgm.scope)&&/No physical speaker/.test(bgm.scope),'Keep native playback, injected failures and listening limitations explicit');
 assert.equal(bgm.fixtureScriptSha256,historical.sha256(read(root,'scripts/launcher_announcements_client_qa.js')));assert.deepEqual(bgm.errors,[]);
 assert.deepEqual(bgm.realAudioAssets.map(item=>item.path).sort(),['public/audio/bgm/track01.mp3','public/audio/profile_bgm/harbor.ogg','public/audio/profile_bgm/night-watch.ogg','public/audio/profile_bgm/voyage.ogg']);
 for(const asset of bgm.realAudioAssets){const bytes=read(root,asset.path);assert.equal(bytes.length,asset.bytes);assert.equal(historical.sha256(bytes),asset.sha256);const url='opui://launcher/'+asset.path.slice('public/'.length);assert(bgm.audioObservations.some(item=>item.src===url&&item.currentTime>0.1&&item.duration>1&&item.paused===false&&item.muted===false&&item.volume>0&&item.readyState>=3&&item.loop===true&&item.error===null),'Actual unmuted native playback missing for '+asset.path);}
 assert(bgm.audioObservations.some(item=>item.muted===true&&item.volume>0),'Listener mute persistence was not observed');
 const requiredBgmChecks=['existing-op-track01-mp3-autoplays-native-unmuted-in-same-profile-player','self-entry-autoplays-real-unmuted-looping-ogg','friend-entry-replaces-owner-song-with-single-audio-element','late-profile-response-cannot-play-over-new-friend','late-play-promise-cannot-stop-new-friend-song','leaving-during-load-stays-silent-and-cached-return-autoplays','listener-mute-volume-persist-across-friend-visits-and-reload','injected-autoplay-denial-is-explained-and-one-real-click-recovers','no-song-and-invalid-or-mismatched-assets-remain-silent','logout-stops-clears-source-and-no-real-purchase-or-browser-error'];
 for(const name of requiredBgmChecks)assert(bgm.results.some(item=>item.name===name&&item.status==='PASS'),'Missing BGM lifecycle coverage: '+name);
 const production=reports.productionVisualQA.report;
 assert.equal(production.schema,'one-piece-launcher-announcements-production-visual-qa/1');assert.equal(production.checks,3);assert.equal(production.humanAcceptance,false);
 assert.equal(production.fixtureScriptSha256,historical.sha256(read(root,'scripts/launcher_announcements_client_qa.js')));
 assert.equal(production.config.path,'config/launcher-announcements-v1.json');assert.equal(production.config.sha256,historical.sha256(read(root,production.config.path)));
 assert.deepEqual(production.config.noticeIds,['crew-ace-1.2.6','launcher-1.2.6-announcements']);
 assert.deepEqual(production.results.map(item=>item.name),['actual-config-only-two-notices-center-open-keeps-both-unread','natural-detail-scroll-exposes-entire-cta-inside-visible-panel','non-force-cta-click-opens-ace-product-without-purchase']);
 for(const report of [reports.clientQA.report,production,bgm]){
  const captures=report.captures||[];assert(captures.length>=2,'Desktop and narrow captures required');
  for(const capture of captures){const file=capture.path.startsWith(EVIDENCE_PREFIX)?capture.path:EVIDENCE_PREFIX+capture.path;assert.equal(evidence.get(file)?.sha256,capture.sha256,'Current browser capture must be bound');if(report===production){assert.equal(capture.syntheticAnnouncements,false);assert.deepEqual(capture.noticeIds,production.config.noticeIds);}}
 }
 const visualPath=EVIDENCE_PREFIX+'independent-visual-review.json';assert(evidence.has(visualPath),'Root independent UI review required');
 const visual=json(root,visualPath);assert.equal(visual.status,'PASS');assert.equal(visual.humanAcceptance,false);assert(typeof visual.method==='string'&&visual.method.length>=20);assert(visual.images.length>=2);
 for(const item of visual.images){assert.equal(evidence.get(item.path)?.sha256,item.sha256,'Root inspected a different UI capture');}

 return {...legacy,complete:true,review,announcements,serverChecks:reports.serverQA.checks,aceChecks:reports.aceQA.checks,functionalChecks:reports.clientQA.checks,interactionChecks:reports.clientQA.checks,productionVisualChecks:reports.productionVisualQA.checks,bgmServerChecks:reports.bgmServerQA.checks,bgmClientChecks:reports.bgmClientQA.checks,currentRuntimeFiles:runtime.length,activeCharacters:11,historicalOnly:false};
}
function validate(root){return validateReview(root,json(root,REVIEW_PATH),preserved.validateHistorical(root));}
module.exports={validate,validateReview,validateConfig,validateAnnouncements,validateAppendOnly,validateSources,REVIEW_PATH,EVIDENCE_PREFIX,REPORTS,ADDITIONAL_RUNTIME};
if(require.main===module){const result=validate(path.resolve(__dirname,'../../..'));console.log(JSON.stringify({complete:true,version:result.review.releaseVersion,activeCharacters:result.activeCharacters,announcementNotes:result.announcements.currentNotes,serverChecks:result.serverChecks,aceChecks:result.aceChecks,clientChecks:result.functionalChecks,bgmServerChecks:result.bgmServerChecks,bgmClientChecks:result.bgmClientChecks,reservedAssets:result.reserved.assets,historicalArtCaptures:result.artBrowser.captures,humanAcceptance:false}));}
