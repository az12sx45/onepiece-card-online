'use strict';
// Real room UI and art; isolated IPC fixtures, no player account writes.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out=process.env.LAUNCHER_POPOVER_QA_OUT||'C:/Codex_Candidates/launcher-room-popover-qa-1.2.2/popup';
process.env.LAUNCHER_LIFE_INTEGRATION_OUT=out;
const fixture=require('./launcher_life_integration_qa');
const {create,advance,snap,chromium}=fixture;
fs.mkdirSync(out,{recursive:true});
const results=[];
const hashSources=()=>Object.fromEntries(['desktop/launcher-room.js','desktop/launcher-life-room.js','desktop/launcher-room.css','desktop/launcher.html', 'scripts/launcher_life_integration_qa.js', 'scripts/launcher_room_popover_qa.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex')]));
const actor=page=>page.locator('#roomCharacters [data-room-key="c:room-character-luffy"]');
async function view(page,width=1366){await page.setViewportSize({width,height:900});await page.locator('#roomStage').scrollIntoViewIfNeeded();await page.evaluate(()=>document.querySelector('#roomStage').scrollIntoView({block:'center',behavior:'instant'}));await advance(page,100);}
async function open(page){await actor(page).click();await advance(page,50);assert(await page.locator('#roomCompanionPanel').isVisible());}
async function bounds(page){return page.evaluate(()=>{
  const a=document.querySelector('#roomCharacters [data-room-key="c:room-character-luffy"]').getBoundingClientRect(),p=document.getElementById('roomCompanionPanel'),b=p.getBoundingClientRect();
  return{actor:{x:a.x,y:a.y,width:a.width,height:a.height,right:a.right,bottom:a.bottom},panel:{x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom},width:document.documentElement.clientWidth,height:innerHeight,side:p.dataset.side,position:getComputedStyle(p).position,background:getComputedStyle(p).backgroundColor,visibility:getComputedStyle(p).visibility};
});}
function onScreen(b){assert(b.panel.x>=7&&b.panel.y>=7);assert(b.panel.right<=b.width-7&&b.panel.bottom<=b.height-7,JSON.stringify(b));assert.equal(b.position,'fixed');assert.equal(b.visibility,'visible');}
async function shot(page,name){await page.screenshot({path:path.join(out,name+'.png')});}
async function run(name,options,test){const {page,errors}=await create(options);try{await view(page);const detail=await test(page);assert.deepEqual(errors,[]);results.push({name,pass:true,...detail});console.log('PASS '+name);}catch(error){await shot(page,name+'-failure');results.push({name,pass:false,error:error.stack});console.error('FAIL '+name+' '+error.message);}finally{await page.close();}}
async function main(){const before=hashSources(),browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});fixture.setBrowser(browser);
try{
 await run('owner-anchored-actions',{owned:['luffy','zoro'],furniture:[{key:'map-table',col:8,row:1}]},async page=>{
  const scroll=await page.evaluate(()=>document.querySelector('.voyage-scroll').scrollTop);await open(page);
  assert.equal(await page.evaluate(()=>document.querySelector('.voyage-scroll').scrollTop),scroll,'opening must not scroll the profile');
  const b=await bounds(page);onScreen(b);
  const current=await page.locator('#roomCompanionActions button.is-wheel-current').boundingBox();
  assert(current&&current.x+current.width/2>=b.actor.right-4||current&&current.x+current.width/2<=b.actor.x+4,
    'the visible current action sits beside the actor; the transparent panel may overlap');
  const actionBackground=await page.locator('#roomCompanionActions button.is-wheel-current').evaluate(node=>getComputedStyle(node).backgroundColor);
  const alpha=Number(actionBackground.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/)?.[1]);
  assert(alpha>0&&alpha<1,'the action circle uses a translucent fill');
  for(const id of ['roomCompanionTalk','roomLifeWork','roomLifeCall','roomLifeGift','roomLifeTrain','roomLifeStatus']){assert(await page.locator('#'+id).isVisible());assert(await page.locator('#'+id).evaluate(el=>getComputedStyle(el,'::before').maskImage!=='none'));}
  await shot(page,'owner-desktop');
  await page.locator('#roomLifeStatus').click();assert(await page.locator('#roomCompanionDetail').isVisible());assert(await page.locator('#roomLifeDetails').isVisible());await shot(page,'details-desktop');
  await page.locator('#roomLifeStatus').click();onScreen(await bounds(page));
  // Work opens a separate minigame in the full launcher; this wheel-only
  // fixture omits that module and verifies the action circle above instead.
  await page.locator('#roomLifeGift').click();assert.equal(await page.evaluate(()=>window.__integration.calls.filter(c=>c.type==='character.interact').length),0,'gift first click is confirmation only');
  await page.locator('#roomLifeGift').click();await advance(page,100);assert.equal(await page.evaluate(()=>window.__integration.calls.filter(c=>c.type==='character.interact'&&c.payload.action==='gift').length),1);assert.equal(await page.evaluate(()=>window.__integration.db[42].wallet.coins),95);
  await page.waitForFunction(()=>document.getElementById('roomCompanionPanel').hidden);
  await open(page);await page.keyboard.press('Escape');assert(await page.locator('#roomCompanionPanel').isHidden());assert(await actor(page).evaluate(el=>document.activeElement===el));
  await actor(page).press('Enter');await advance(page,50);assert(await page.locator('#roomCompanionPanel').isVisible());await page.locator('#roomLifeClock').click();assert(await page.locator('#roomCompanionPanel').isHidden());
  await open(page);await page.evaluate(()=>window.LauncherRoom.onVisible('library'));assert(await page.locator('#roomCompanionPanel').isHidden());
  return{layout:b,giftCommands:1,keyboardAndDismiss:true};
 });
 await run('follow-edge-mobile',{owned:['luffy']},async page=>{
  await open(page);const first=await bounds(page);
  // Opening the wheel intentionally holds the selected actor facing the player.
  // Close it before asking the existing BFS navigation helper to move them.
  await page.keyboard.press('Escape');
  const route=await page.evaluate(()=>{window.__launcherRoomTest.lifeCancel('luffy');return window.__launcherRoomTest.route('luffy',{col:14,row:5});});
  assert.equal(route,true,'the east-side floor goal is reachable by BFS');
  await advance(page,7000);await open(page);
  const moved=await bounds(page);onScreen(moved);assert(Math.abs(moved.actor.x-first.actor.x)>50);assert(Math.abs(moved.panel.x-first.panel.x)>40);
  await page.evaluate(()=>{const f=window.__integration;f.db[42].profile.room.characters[0].x=875;f.db[42].profile.room.characters[0].y=495;f.use(43);f.use(42);});await advance(page,50);await open(page);
  const edge=await bounds(page);onScreen(edge);assert.equal(edge.side,'left','right edge flips the menu to the left');await shot(page,'owner-right-edge');
  await view(page,390);await page.evaluate(()=>document.querySelector('.room-stage-scroll').scrollLeft=100);await advance(page,100);
  // Scroll to the selected actor within the deliberately scrollable 480px room.
  await actor(page).scrollIntoViewIfNeeded();await advance(page,100);onScreen(await bounds(page));await shot(page,'owner-mobile');
  await page.locator('#roomLifeStatus').click();onScreen(await bounds(page));await shot(page,'details-mobile');
  await view(page,320);await actor(page).scrollIntoViewIfNeeded();await advance(page,100);onScreen(await bounds(page));await shot(page,'owner-320');
  await page.emulateMedia({reducedMotion:'reduce'});await advance(page,100);await open(page);onScreen(await bounds(page));await shot(page,'reduced-motion-mobile');
  await page.setViewportSize({width:320,height:500});await actor(page).scrollIntoViewIfNeeded();await advance(page,100);await page.evaluate(()=>window.dispatchEvent(new Event('resize')));await page.waitForTimeout(150);await shot(page,'short-viewport');onScreen(await bounds(page));
  await page.evaluate(()=>{const scroller=document.getElementById('roomStage').closest('.voyage-scroll');scroller.scrollTo({top:0,behavior:'instant'});scroller.dispatchEvent(new Event('scroll'));});await advance(page,50);await page.waitForFunction(()=>getComputedStyle(document.getElementById('roomCompanionPanel')).visibility==='hidden',null,{polling:100,timeout:2000});assert.equal((await bounds(page)).visibility,'hidden','offscreen actor hides its overlay');
  await page.evaluate(()=>window.__integration.use(43));assert(await page.locator('#roomCompanionPanel').isHidden());return{first,moved,accountSwitchClosed:true};
 });
 await run('visitor-readonly',{owned:['luffy','zoro'],visitor:true},async page=>{
  await open(page);onScreen(await bounds(page));for(const id of ['roomCompanionTalk','roomLifeWork','roomLifeCall','roomLifeGift','roomLifeTrain'])assert(await page.locator('#'+id).isHidden());
  assert(await page.locator('#roomLifeStatus').isVisible());await page.locator('#roomLifeStatus').click();assert(await page.locator('#roomLifeDetails').isVisible());assert.equal(await page.evaluate(()=>window.__integration.calls.length),0);await shot(page,'visitor-desktop');return{writes:0};
 });
 await run('editor-dismiss-and-scale',{owned:['luffy','zoro'],furniture:[{key:'map-table',col:8,row:1}]},async page=>{
  await open(page);await page.locator('#roomEditToggle').click();assert(await page.locator('#roomCompanionPanel').isHidden());assert(await page.locator('#roomEditor').isVisible());await page.locator('#roomStage').scrollIntoViewIfNeeded();await shot(page,'editor-desktop');
  const shell=await actor(page).boundingBox();assert(shell.width>100,'enlarged static editing actor');return{staticWidth:shell.width};
 });
 const after=hashSources();const report={ok:results.every(r=>r.pass)&&JSON.stringify(before)===JSON.stringify(after),generatedAt:new Date().toISOString(),checks:results.length,results,startedSources:before,completedSources:after,scope:'Real Chromium UI/production artwork. Isolated IPC fixtures and deterministic clock; no real account purchases or human/device acceptance.'};fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,out}));if(!report.ok)process.exitCode=1;
}finally{await browser.close();}}
main().catch(error=>{console.error(error);process.exitCode=1;});
