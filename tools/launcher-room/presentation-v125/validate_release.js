'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process'),vm=require('node:vm');
const historical=require('../presentation-v122/validate_historical_life');
const preservation=require('./validate_historical_interaction');
const oldPresentation=require('../presentation-v124/validate_release');
const art=require('./validate_reserved');
const artBrowser=require('./validate_art_browser');
const REVIEW_PATH='docs/LAUNCHER_RESERVED_CREW_20260927.json';
const EVIDENCE_PREFIX='tools/launcher-room/presentation-v125/review-evidence/';
const EXTRA_RUNTIME=Object.freeze(['desktop/launcher-reserved-crew.js','server/launcher-crew-release.js','config/launcher-crew-release-v1.json']);
const SERVER_SOURCES=Object.freeze(['config/launcher-crew-release-v1.json','server/launcher-crew-release.js','server/launcher-profile-shop.js','server/launcher-life.js','server/launcher-life-store.js','server/index.js','desktop/auth-service.js','desktop/launcher-reserved-crew.js','desktop/launcher-life-data.js','scripts/launcher_reserved_crew_server_qa.js']);
const CLIENT_SOURCES=Object.freeze(['launcher-reserved-crew.js','launcher-room.js','launcher-room-motion.js','launcher-life-actions.js','launcher-life-data.js','launcher-room-dialogue.js','launcher-life.js','launcher-life-room.js','launcher.html']);
const CLIENT_CHECKS=Object.freeze(['registry-default-denies-reserved-and-rejects-unknown-ids','legacy-ten-content-and-motion-unchanged','four-complete-profiles-and-all-46-new-pairings','four-default-dormant-despite-forged-owned-and-placed','single-released-owned-placed-character-can-request-work','release-alone-ownership-alone-placement-alone-do-not-activate','same-life-revision-roster-update-and-old-server-fallback','68-exact-asset-paths-and-no-nonexistent-specialist-clips','browser-umd-global-order-and-hd-decoder-geometry']);
const BROWSER_CHECKS=Object.freeze(['browser-old-server-forged-reserved-owned-and-placed-stays-hidden','browser-explicit-legacy-release-stamp-hides-all-four',...['ace','sabo','law','hancock'].map(key=>'browser-single-release-'+key),'browser-released-but-unowned-does-not-render','browser-released-owned-but-unplaced-does-not-render','browser-friend-profile-keeps-release-stamp-and-readonly']);
const CLIENT_NORMALIZATION='UTF-8 decoded text; replace CRLF (\\r\\n) with LF (\\n) only; no other changes.';
function readBound(root,ref){return art.readBound(root,ref);}
function sources(root,report,expected,prefix,normalization){
  assert.equal(report.sourceHashNormalization,normalization,'QA must retain exact CRLF-to-LF-only normalization');
  assert.deepEqual(Object.keys(report.sourceSha256||{}).sort(),[...expected].sort(),'QA raw source coverage differs');
  assert.deepEqual(Object.keys(report.sourceNormalizedSha256||{}).sort(),[...expected].sort(),'QA normalized source coverage differs');
  for(const file of expected){
    assert.match(report.sourceSha256[file],/^[a-f0-9]{64}$/,'Preserve actual tested raw SHA');
    assert.equal(report.sourceNormalizedSha256[file],historical.normalizedSha256(fs.readFileSync(historical.safePath(root,prefix+file))),'QA source changed: '+file);
  }
}
function validateConfig(config){
  assert.deepEqual(config,{schemaVersion:1,rosterRevision:1,characters:{ace:false,sabo:false,law:false,hancock:false}},'All four shipping flags must be explicitly false');
}
function validateDormancy(root){
  const config=JSON.parse(fs.readFileSync(historical.safePath(root,'config/launcher-crew-release-v1.json'),'utf8'));validateConfig(config);
  const shop=require(path.join(root,'server/launcher-profile-shop.js')),life=require(path.join(root,'server/launcher-life.js'));
  assert.equal(shop.CATALOG.filter(item=>item.type==='room_character').length,10,'Reserved crew must not enter the active catalog');
  assert.deepEqual([...life.CREW],['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe'],'Active server roster must stay ten');
  // Execute the old module's definitions to compare the entire old catalog and
  // fresh-account seed against the unchanged current default behavior.
  const oldSource=cp.execFileSync('git',['cat-file','blob',preservation.BASELINE+':server/launcher-profile-shop.js'],{cwd:root,windowsHide:true,maxBuffer:4*1024*1024});
  const oldModule={exports:{}};
  new vm.Script('(function(module,exports,require){\n'+oldSource.toString('utf8')+'\n})').runInNewContext({console,Buffer})(oldModule,oldModule.exports,name=>{
    assert.equal(name,'../public/js/board_adventure_art','Unexpected historical catalog dependency');return require(path.join(root,'public/js/board_adventure_art.js'));
  });
  assert.equal(JSON.stringify(shop.CATALOG),JSON.stringify(oldModule.exports.CATALOG),'Default catalog changed while reserved flags are false');
  assert.equal(JSON.stringify(shop.launcherRoom({})),JSON.stringify(oldModule.exports.launcherRoom({})),'Default room seed changed');
  assert.equal(JSON.stringify(shop.launcherOwnedItemIds({})),JSON.stringify(oldModule.exports.launcherOwnedItemIds({})),'Default owned seed changed');
  const seedTime=new Date('2026-09-27T00:00:00.000Z');
  assert.equal(JSON.stringify(shop.prepareLauncherWallet({},seedTime)),JSON.stringify(oldModule.exports.prepareLauncherWallet({},seedTime)),'Default wallet seed changed');
  assert.equal(JSON.stringify(shop.launcherCompanionState({},seedTime)),JSON.stringify(oldModule.exports.launcherCompanionState({},seedTime)),'Default companion seed changed');
  return {activeCharacters:10,reservedCharacters:4,allFlagsFalse:true,defaultCatalogUnchanged:true,defaultSeedUnchanged:true};
}
function validateReview(root,review,legacy){
  assert.equal(review.schema,'launcher-reserved-crew/1');assert.equal(review.releaseVersion,'1.2.5');
  assert.equal(review.interactionBaseline,preservation.BASELINE);
  assert.equal(review.status,'PASS_WITH_NOTES','Reserved crew review is incomplete');assert.deepEqual(review.blockingIssues,[]);
  assert.equal(review.humanAcceptance,false,'Automated/model evidence is not human acceptance');
  assert(typeof review.method==='string'&&review.method.trim().length>=40,'Record actual review method');
  assert(Array.isArray(review.limitations)&&review.limitations.length>0,'Record actual evidence limitations');
  assert.equal(review.runtimeHashNormalization,historical.NORMALIZATION);
  assert.deepEqual(review.approvedRuntimeVariants,JSON.parse(JSON.stringify(legacy.life.review.approvedRuntimeVariants)),'Preserve only the immutable formal Board variant');
  const runtime=[...Object.keys(legacy.interaction.review.runtime),...EXTRA_RUNTIME];
  assert.equal(runtime.length,25);assert.deepEqual(Object.keys(review.runtime||{}).sort(),runtime.sort(),'Current reserved runtime must cover exactly 25 files');
  for(const file of runtime){
    assert.match(review.runtime[file],/^[a-f0-9]{64}$/);
    const actual=historical.normalizedSha256(fs.readFileSync(historical.safePath(root,file)));
    const approved=[review.runtime[file],...(review.approvedRuntimeVariants[file]||[]).map(item=>item.normalizedSha256)];
    assert(approved.includes(actual),'Changed reviewed reserved runtime: '+file);
  }
  assert.equal(review.runtime['server/desktop-distribution.js'],legacy.life.review.runtime['server/desktop-distribution.js']);
  const icons=oldPresentation.validateInlineIcons(fs.readFileSync(historical.safePath(root,'desktop/launcher-room.css'),'utf8'));
  assert.equal(review.art?.path,art.MANIFEST);readBound(root,review.art);const reserved=art.validate(root);
  const evidence=new Map();
  for(const item of review.evidence||[]){
    assert(item.path.startsWith(EVIDENCE_PREFIX),'New release evidence must reside in presentation-v125');assert(!evidence.has(item.path),'Duplicate evidence');
    const bytes=readBound(root,item);
    if(item.kind==='screenshot')assert.deepEqual(item.pixels,oldPresentation.pngSize(bytes));else assert.equal(item.kind,'report');
    evidence.set(item.path,item);
  }
  const report=ref=>{assert(ref&&evidence.has(ref.path)&&evidence.get(ref.path).kind==='report','QA report is not bound in current evidence');return JSON.parse(readBound(root,ref));};
  const server=report(review.serverQA);assert.equal(server.status,'PASS');assert.equal(server.sourceStable,true);
  assert.equal(server.kind,'isolated-in-memory-PGlite-service-QA');assert.equal(server.checkCount,211);
  assert.equal(server.checks.length,211);assert(server.checks.every(item=>item.status==='PASS'),'Server release QA failed');
  sources(root,server,SERVER_SOURCES,'','CRLF-to-LF-only');
  const client=report(review.clientQA);assert.equal(client.ok,true);assert.equal(client.humanAcceptance,false);
  assert.deepEqual(client.results.map(item=>item.name).sort(),[...CLIENT_CHECKS].sort());assert(client.results.every(item=>item.status==='PASS'));
  sources(root,client,CLIENT_SOURCES,'desktop/',CLIENT_NORMALIZATION);
  assert.equal(client.testScriptSha256,historical.sha256(fs.readFileSync(historical.safePath(root,'scripts/launcher_reserved_crew_client_qa.js'))),'Client QA script changed');
  const browser=report(review.browserQA);
  assert.equal(browser.schema,'one-piece-launcher-reserved-client-qa/1');assert.equal(browser.ok,true,'Actual Chromium release wiring QA is required');
  assert.equal(browser.humanAcceptance,false);assert.equal(browser.checks,9);
  assert.deepEqual(browser.results.map(item=>item.name).sort(),[...BROWSER_CHECKS].sort());assert(browser.results.every(item=>item.status==='PASS'));
  assert(/Actual headless Chromium/.test(browser.scope)&&/not artwork decode/.test(browser.scope),'Keep real browser wiring scope distinct from art QA');
  sources(root,browser,CLIENT_SOURCES,'desktop/',CLIENT_NORMALIZATION);
  assert.equal(browser.testScriptSha256,historical.sha256(fs.readFileSync(historical.safePath(root,'scripts/launcher_reserved_crew_browser_qa.js'))),'Browser QA script changed');
  assert.equal(browser.fixtureOriginalSha256,historical.sha256(fs.readFileSync(historical.safePath(root,'scripts/launcher_radial_fixture.js'))),'Browser fixture changed');
  assert.match(browser.fixtureEffectiveSha256,/^[a-f0-9]{64}$/,'Preserve the actual browser fixture transformation hash');
  assert.equal(review.artBrowserQA?.path,artBrowser.REPORT,'Actual art browser QA must bind its current report');
  const decoded=artBrowser.validate(root,report(review.artBrowserQA),reserved,evidence);
  const visual=report(review.visualReview);assert.equal(visual.status,'PASS');assert.equal(visual.humanAcceptance,false);
  assert(Array.isArray(visual.images)&&visual.images.length>=4,'Preserve independently inspected image hashes');
  const inspected=new Map(visual.images.map(item=>[item.path,item]));assert.equal(inspected.size,visual.images.length,'Duplicate inspected image');
  for(const image of visual.images){const bound=evidence.get(image.path);assert(bound?.kind==='screenshot','Inspected image missing from frozen evidence');assert.equal(image.sha256,bound.sha256,'Inspected image changed before freeze');assert.deepEqual(image.pixels,bound.pixels);}
  assert.deepEqual(visual.items.map(item=>item.key).sort(),[...art.KEYS].sort(),'Every reserved character needs explicit visual review');
  for(const item of visual.items){
    assert.equal(item.status,'PASS');assert(typeof item.notes==='string'&&item.notes.trim().length>=32,'Record concrete visual findings for '+item.key);
    assert(Array.isArray(item.evidence)&&item.evidence.length>0);
    for(const file of item.evidence){const screenshot=evidence.get(file);assert(screenshot?.kind==='screenshot'&&inspected.has(file),'Missing reviewed reserved contact sheet');assert(screenshot.pixels[0]>=512&&screenshot.pixels[1]>=300);}
    const contact=reserved.manifest.contactSheets.find(contact=>contact.key===item.key);
    assert(item.evidence.some(file=>evidence.get(file).sha256===contact.sha256&&JSON.stringify(evidence.get(file).pixels)===JSON.stringify(contact.dimensions)),'Visual review must inspect the exact exported 81-frame contact sheet for '+item.key);
  }
  const dormancy=validateDormancy(root);
  return {complete:true,review,reserved,artBrowser:decoded,dormancy,life:legacy.life,hd:legacy.interaction.hd,icons,
    scenarios:visual.items.length,functionalChecks:client.results.length,interactionChecks:browser.results.length,
    serverChecks:server.checks.length,evidenceFiles:evidence.size,currentRuntimeFiles:runtime.length,humanAcceptance:false,
    historicalBaseline:legacy.baseline,interactionBaseline:preservation.BASELINE};
}
function validate(root){const legacy=preservation.validateHistorical(root);return validateReview(root,JSON.parse(fs.readFileSync(historical.safePath(root,REVIEW_PATH),'utf8')),legacy);}
module.exports={validate,validateReview,validateDormancy,validateConfig,REVIEW_PATH,EVIDENCE_PREFIX,EXTRA_RUNTIME,SERVER_SOURCES,CLIENT_SOURCES,CLIENT_CHECKS};
if(require.main===module){const result=validate(path.resolve(__dirname,'../../..'));console.log(JSON.stringify({complete:true,version:result.review.releaseVersion,reservedAssets:result.reserved.assets,activeCharacters:result.dormancy.activeCharacters,serverChecks:result.serverChecks,clientChecks:result.functionalChecks,artBrowserChecks:result.artBrowser.checks,artBrowserCaptures:result.artBrowser.captures,currentRuntimeFiles:result.currentRuntimeFiles,humanAcceptance:false}));}
