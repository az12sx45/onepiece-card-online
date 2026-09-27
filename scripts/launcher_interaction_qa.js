'use strict';
// Actual Chromium input, production rendering and isolated IPC. No real account or purchase.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const out=process.env.LAUNCHER_INTERACTION_QA_OUT||'C:/Users/王曜瑋/Documents/Codex/2026-04-20-1-2-start-html-game-html/artifacts/launcher-room-interaction-1.2.4/qa';
process.env.LAUNCHER_LIFE_INTEGRATION_OUT=out;
const {create,advance,snap,chromium,setBrowser}=require('./launcher_radial_fixture');
const files=['launcher-room.js','launcher-room.css','launcher-life-room.js','launcher-life.js','launcher-room-motion.js','main.js','launcher.html'];
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const hashes=(normalized=false)=>Object.fromEntries(files.map(file=>{let value=fs.readFileSync(path.join(root,'desktop',file));if(normalized)value=value.toString('utf8').replace(/\r\n/g,'\n');return[file,sha(value)];}));
const sourceSha256=hashes(),sourceNormalizedSha256=hashes(true),ids=['roomCompanionTalk','roomLifeWork','roomLifeCall','roomLifeGift','roomLifeTrain','roomLifeStatus'];
const reproduce=process.argv.includes('--reproduce'),checks=[];let page,errors;
const selected=()=>page.locator('#roomCompanionWheel').getAttribute('data-selected-action');
const calls=()=>page.evaluate(()=>window.__integration.calls.filter(call=>!['checkpoint','event.record'].includes(call.type)));
async function open(key='luffy') {
 if(await page.locator('#roomCompanionPanel').isVisible())await page.locator('#roomCompanionClose').click();
 await page.evaluate(()=>document.getElementById('roomStage').scrollIntoView({block:'center',behavior:'instant'}));
 await page.locator('[data-room-key="c:room-character-'+key+'"]').click();await advance(page,400);
 assert(await page.locator('#roomCompanionPanel').isVisible());
}
async function wheel(delta,target='icon',settle=650) {
 const box=target==='icon'?await page.locator('#'+await selected()).boundingBox():await page.locator('#roomCompanionWheel').boundingBox();
 const point=target==='icon'?{x:box.x+box.width/2,y:box.y+box.height/2}:{x:box.x+6,y:box.y+30};
 await page.mouse.move(point.x,point.y);
 const hit=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id||document.elementFromPoint(x,y)?.className,point);
 await page.mouse.wheel(0,delta);await page.waitForTimeout(20);await advance(page,settle);
 return {selected:await selected(),hit,point};
}
async function choose(id) {
 for(let i=0;i<6&&await selected()!==id;i++){await page.locator('#roomCompanionWheel').focus();await page.keyboard.press('ArrowDown');await advance(page,400);}
 assert.equal(await selected(),id);
}
async function check(name,fn) {
 try{const evidence=await fn();assert.deepEqual(errors,[]);checks.push({name,status:'PASS',...evidence});console.log('PASS '+name);}
 catch(error){checks.push({name,status:'FAIL',error:String(error.stack||error)});console.log('FAIL '+name+': '+error.message);if(!reproduce)throw error;}
}
async function wheelCoverage() {
 const evidence=[];
 for(const target of ['icon','blank'])for(const delta of [100,120,-100,-120]) {
  await open();const initialCalls=await calls(),beforeScroll=await page.evaluate(()=>[scrollY,document.querySelector('.profile-voyage-scroll')?.scrollTop]),sequence=[await selected()],hits=[];
  for(let i=0;i<6;i++){const result=await wheel(delta,target);sequence.push(result.selected);hits.push(result.hit);}
  evidence.push({target,delta,sequence,hits,reachable:[...new Set(sequence)]});
  assert.deepEqual(await calls(),initialCalls,'scrolling may not execute actions');
  assert.deepEqual(await page.evaluate(()=>[scrollY,document.querySelector('.profile-voyage-scroll')?.scrollTop]),beforeScroll,'wheel may not scroll page');
 }
 fs.writeFileSync(path.join(out,reproduce?'wheel-baseline-evidence.json':'wheel-reachability-evidence.json'),JSON.stringify(evidence,null,2));
 for(const entry of evidence){assert.equal(entry.reachable.length,6,JSON.stringify(entry));assert.equal(entry.sequence[6],entry.sequence[0],'six physical notches wrap once');}
 return {samples:evidence};
}
async function fresh(options={owned:['luffy'],furniture:[{key:'map-table',col:8,row:1}]}) {
 if(page)await page.close();({page,errors}=await create(options));
}
const actor=async(key='luffy')=>(await snap(page)).walkers.find(w=>w.key===key);
async function stillFacing(key='luffy',ms=8000) {
 const start=await actor(key),samples=[];assert.equal(start.attention,true,'selected actor exposes transient attention');
 await advance(page,ms,async state=>{
  const w=state.walkers.find(w=>w.key===key);assert.equal(w.attention,true);assert.equal(w.direction,'south','whole-body renderer faces viewer');
  assert.equal(w.route.length,0);assert(Math.hypot(w.x-start.x,w.y-start.y)<.01,'selected actor moved');
  const dom=await page.locator('[data-room-key="c:room-character-'+key+'"]').evaluate(node=>({direction:node.dataset.direction,pose:node.dataset.pose,walking:node.classList.contains('is-walking'),canvasHidden:node.querySelector('.room-walk-sprite')?.hidden}));
  assert.equal(dom.direction,'south');assert.equal(dom.walking,false);assert.notEqual(dom.pose,'walk');assert.equal(dom.canvasHidden,false,'whole-body canvas remains visible');
  samples.push({x:w.x,y:w.y,direction:w.direction,mode:w.mode,...dom});
 });return samples;
}
async function pendingAndRapid() {
 await open();const initial=await calls(),sequence=[await selected()];
 for(let i=0;i<6;i++){const s=await wheel(120,'icon',80);sequence.push(s.selected);assert.equal(s.selected,ids[(i+1)%6]);}
 await advance(page,700);assert.equal(await selected(),ids[0]);
 await page.locator('#roomCompanionClose').click();
 await page.evaluate(()=>{const api=window.onePieceDesktop;window.__savedCharacterGet=api.getLauncherCharacter;api.getLauncherCharacter=id=>new Promise(resolve=>{window.__resolveCharacter=()=>resolve({ok:true,character:{itemId:id,affinity:23,talksRemainingToday:6}});});});
 await open();const pendingSequence=[await selected()];for(let i=0;i<3;i++)pendingSequence.push((await wheel(100,'icon')).selected);
 assert.equal(await selected(),'roomLifeGift');
 await page.evaluate(()=>{window.onePieceDesktop.getLauncherCharacter=window.__savedCharacterGet;window.__resolveCharacter();});await advance(page,1000);
 assert.equal(await selected(),'roomLifeGift','late character reply must not reset wheel position');
 assert.match(await page.locator('#roomCompanionAffinity').textContent(),/^23\s*\/\s*100$/);
 for(let i=0;i<3;i++)pendingSequence.push((await wheel(120,'blank')).selected);assert.equal(new Set(pendingSequence).size,6);
 await page.locator('#roomCompanionClose').click();await open();
 for(let i=0;i<6;i++)await wheel(8,'blank',30);await advance(page,500);assert.equal(await selected(),'roomLifeWork','small trackpad deltas accumulate one action');
 assert.deepEqual(await calls(),initial);return{rapidSequence:sequence,pendingSequence,smallDeltaEvents:6,smallDeltaSize:8};
}
async function selectedFrontAndStill() {
 await fresh();await page.evaluate(()=>{window.__launcherRoomTest.lifeCancel('luffy');window.__launcherRoomTest.route('luffy',{col:12,row:5});});await advance(page,850);
 const before=await actor();assert(before.route.length>0,'fixture must start from an actually walking actor');
 await open();const focused=await actor();assert(Math.hypot(before.x-focused.x,before.y-focused.y)<1,'selection may not snap actor position');
 const initial=await calls(),samples=await stillFacing();assert.deepEqual(await calls(),initial,'selecting or observing must not issue mutations');
 await choose('roomLifeStatus');await page.locator('#roomLifeStatus').click();await advance(page,100);assert(await page.locator('#roomCompanionSheet').isVisible());await stillFacing('luffy',1500);
 await page.locator('#roomCompanionSheetClose').click();await page.screenshot({path:path.join(out,'selected-front-facing.png')});
 return{walkingBefore:before,focusedAfter:await actor(),samples,detailsPreservesFocus:true};
}
async function explicitActions() {
 await fresh({owned:['luffy'],furniture:[{key:'map-table',col:8,row:1}]});await open();await choose('roomLifeCall');await page.locator('#roomLifeCall').click();await advance(page,400);
 assert.equal(await page.locator('#roomCompanionPanel').isVisible(),false,'successful explicit call releases menu focus');
 assert.equal((await calls()).filter(c=>c.type==='character.interact'&&c.payload.action==='call').length,1);
 const callSamples=[];let callArrived=false;
 for(let i=0;i<160;i++){await advance(page,500);const s=await snap(page);callSamples.push(s.walkers[0]);if(s.walkers[0].route.length===0&&s.nodes.some(n=>n.speech)){callArrived=true;break;}}
 assert(callArrived,'call reaches its target and responds');assert(callSamples.some(w=>!w.attention));
 await fresh({owned:['luffy'],furniture:[{key:'map-table',col:8,row:1}]});await open();await choose('roomLifeWork');await page.locator('#roomLifeWork').click();await page.locator('#roomLifeWorkChoices button').first().click();await advance(page,400);
 assert.equal(await page.locator('#roomCompanionPanel').isVisible(),false,'successful explicit work releases menu focus');
 assert.equal((await calls()).filter(c=>c.type==='work.reserve').length,1);
 let active=false;const workSamples=[];
 for(let i=0;i<160;i++){await advance(page,500);workSamples.push(await actor());if((await calls()).some(c=>c.type==='work.activate')){active=true;break;}}
 assert(active,'assigned job must physically reach the station before activation');assert.equal((await calls()).filter(c=>c.type==='work.cancel').length,0);
 return{callSamples,callArrived,workSamples,workActivated:active};
}
async function closeRestores() {
 // Uses the actual job activated by explicitActions, preserving paid-job authority.
 const before=await snap(page),job=before.life.jobs[0];assert(job&&job.status==='active');
 const initial=await calls();await open();const held=await actor();const samples=await stillFacing('luffy',8000);
 assert.equal((await snap(page)).life.jobs[0].jobId,job.jobId,'focus must preserve paid job identity');
 assert.deepEqual(await calls(),initial,'opening/holding paid worker must not cancel or complete its job');
 await page.locator('#roomCompanionClose').click();await advance(page,2500);const resumed=await snap(page),w=resumed.walkers[0];
 assert.equal(w.attention,false,'closing menu releases attention');assert.equal(resumed.life.jobs[0].jobId,job.jobId);assert.equal((await calls()).filter(c=>c.type==='work.cancel').length,0);
 assert(resumed.life.tasks.some(t=>t.jobId===job.jobId),'paid task resumes');
 // Independently ensure a interrupted ordinary walking route resumes after close.
 await fresh({owned:['luffy']});await page.evaluate(()=>{window.__launcherRoomTest.lifeCancel('luffy');window.__launcherRoomTest.route('luffy',{col:12,row:5});});await advance(page,700);await open();const stopped=await actor();await stillFacing('luffy',1000);await page.locator('#roomCompanionClose').click();await advance(page,1500);const moving=await actor();
 assert.equal(moving.attention,false);assert(Math.hypot(moving.x-stopped.x,moving.y-stopped.y)>1,'ordinary route resumes after menu closes');
 return{preservedJobId:job.jobId,held,samples,resumedWorker:w,ordinaryRoute:{stopped,moving}};
}
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});setBrowser(browser);
try{
 ({page,errors}=await create({owned:['luffy'],furniture:[{key:'map-table',col:8,row:1}]}));
 await check('wheel-physical-notch-all-actions',wheelCoverage);
 if(!reproduce){
  await check('wheel-rapid-and-pending-resync',pendingAndRapid);
  await check('selected-character-front-and-still',selectedFrontAndStill);
  await check('explicit-call-and-work-still-operate',explicitActions);
  await check('menu-close-restores-autonomy',closeRestores);
 }
 if(!reproduce)assert.equal(checks.length,5,'five interaction regressions must be present before final acceptance');
}catch(error){if(!checks.some(c=>c.status==='FAIL'))checks.push({name:'runner',status:'FAIL',error:String(error.stack||error)});}
finally{
 const sourceStable=JSON.stringify(hashes())===JSON.stringify(sourceSha256);
 const report={status:checks.every(c=>c.status==='PASS')&&sourceStable?'PASS':'FAIL',kind:reproduce?'baseline-actual-chromium-isolated-ipc':'release-source-actual-chromium-isolated-ipc',productionDeployed:false,recordedAt:new Date().toISOString(),checks,sourceSha256,sourceNormalizedSha256,sourceHashNormalization:'CRLF to LF only; all other bytes remain significant',testScriptSha256:sha(fs.readFileSync(__filename)),sourceStable,limitations:['IPC and ownership use isolated fixtures; no production account, purchase or database touched','Playwright animation clock is deterministic; no human or physical-device acceptance','This report alone does not prove packaged installer or public deployment']};
 fs.writeFileSync(path.join(out,reproduce?'INTERACTION_BASELINE.json':'INTERACTION_QA.json'),JSON.stringify(report,null,2)+'\n');
 if(page)await page.screenshot({path:path.join(out,reproduce?'interaction-baseline.png':'interaction-final.png')}).catch(()=>{});
 await browser.close();console.log(JSON.stringify({status:report.status,checks:checks.length,out}));if(!reproduce&&report.status!=='PASS')process.exitCode=1;
}})().catch(e=>{console.error(e);process.exitCode=1;});

