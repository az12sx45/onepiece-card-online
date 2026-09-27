'use strict';
// Actual Chromium UI with isolated IPC fixtures; no production data or payments.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'tools/launcher-room/presentation-v123/review-evidence');
process.env.LAUNCHER_LIFE_INTEGRATION_OUT=out;
const {create,advance,chromium,setBrowser}=require('./launcher_radial_fixture');
const ids=['roomCompanionTalk','roomLifeWork','roomLifeCall','roomLifeGift','roomLifeTrain','roomLifeStatus'];
const hashes=()=>Object.fromEntries(['launcher-room.js','launcher-room.css','launcher-life-room.js','launcher.html'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'desktop',f))).digest('hex')]));
const before=hashes(),results=[];
const normalizedHashes=()=>Object.fromEntries(Object.keys(before).map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'desktop',f),'utf8').replace(/\r\n/g,'\n')).digest('hex')]));
let page,errors;
const selected=()=>page.locator('#roomCompanionWheel').getAttribute('data-selected-action');
const calls=()=>page.evaluate(()=>window.__integration.calls.filter(x=>!['checkpoint','event.record'].includes(x.type)));
async function open(key='luffy') {
  await page.locator('#roomStage').scrollIntoViewIfNeeded();
  await page.evaluate(()=>document.getElementById('roomStage').scrollIntoView({block:'center',behavior:'instant'}));
  await page.locator(`[data-room-key="c:room-character-${key}"]`).click();await advance(page,350);
  assert.equal(await page.locator('#roomCompanionPanel').isVisible(),true);
}
async function turn(steps=1){await page.locator('#roomCompanionWheel').dispatchEvent('wheel',{deltaY:steps*48,deltaMode:0});await advance(page,650);}
async function choose(id){for(let i=0;i<6&&await selected()!==id;i++)await turn();assert.equal(await selected(),id);}
async function shot(name){await page.screenshot({path:path.join(out,`${name}.png`)});}
async function bounds() {
  const state=await page.evaluate(()=>({width:innerWidth,height:innerHeight,buttons:[...document.querySelectorAll('#roomCompanionActions button')].filter(el=>!el.hidden&&el.getAttribute('aria-hidden')==='false').map(el=>({id:el.id,...el.getBoundingClientRect().toJSON()}))}));
  assert.ok(state.buttons.length>=1);
  for(const b of state.buttons){assert.ok(b.x>=0&&b.y>=0&&b.right<=state.width+.1&&b.bottom<=state.height+.1,JSON.stringify(b));assert.ok(Math.abs(b.width-b.height)<.1);}
  return state;
}
async function test(name,run){await run();assert.deepEqual(errors,[]);results.push({name,status:'PASS'});console.log('PASS',name);}
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});setBrowser(browser);
try {
 ({page,errors}=await create({owned:['luffy','zoro'],furniture:[{key:'map-table',col:8,row:1}]}));
 await test('five separate translucent circles; no rectangular backplate',async()=>{
   await open();const b=await bounds();assert.equal(b.buttons.length,5);
   const ui=await page.locator('#roomCompanionPanel').evaluate(el=>({side:el.dataset.side,bg:getComputedStyle(el).backgroundColor,border:getComputedStyle(el).borderWidth,buttons:[...el.querySelectorAll('.room-companion-actions button')].filter(b=>b.getAttribute('aria-hidden')==='false').map(b=>({radius:getComputedStyle(b).borderRadius,bg:getComputedStyle(b).backgroundColor,transform:getComputedStyle(b).transform,glyph:getComputedStyle(b,'::before').maskImage}))}));
   assert.equal(ui.side,'right');assert.equal(ui.bg,'rgba(0, 0, 0, 0)');
   for(const b of ui.buttons){assert.equal(b.radius,'50%');assert.match(b.bg,/rgba\(/);assert.notEqual(b.glyph,'none');const m=b.transform.match(/matrix\(([^)]+)\)/)[1].split(',').map(Number);assert.equal(m[1],0);assert.equal(m[2],0);}
   await shot('radial-desktop');
 });
 await test('mouse wheel traverses every action and wraps without page scroll or command',async()=>{
   const initial=await calls(),scroll=await page.evaluate(()=>[scrollY,document.querySelector('.profile-voyage-scroll')?.scrollTop]);
   const box=await page.locator('#roomCompanionWheel').boundingBox();await page.mouse.move(box.x+136,box.y+136);await page.mouse.wheel(0,64);await page.clock.runFor(100);await advance(page,650);
   assert.equal(await selected(),ids[1]);await shot('radial-turned');
   for(const id of ids.slice(2)){await turn();assert.equal(await selected(),id);}await turn();assert.equal(await selected(),ids[0]);
   assert.deepEqual(await calls(),initial);assert.deepEqual(await page.evaluate(()=>[scrollY,document.querySelector('.profile-voyage-scroll')?.scrollTop]),scroll);
 });
 await test('line-mode wheel and keyboard activate details; sheet scroll leaves arc unchanged',async()=>{
   await page.locator('#roomCompanionWheel').dispatchEvent('wheel',{deltaY:-3,deltaMode:1});await advance(page,650);assert.equal(await selected(),'roomLifeStatus');
   await page.locator('#roomCompanionWheel').focus();await page.keyboard.press('Enter');await advance(page,50);
   assert.equal(await page.locator('#roomCompanionSheet').isVisible(),true);assert.match(await page.locator('#roomLifeDetails').innerText(),/精神/);
   await page.locator('#roomCompanionSheet').dispatchEvent('wheel',{deltaY:90});await advance(page,50);assert.equal(await selected(),'roomLifeStatus');await shot('radial-details');
   await page.locator('#roomCompanionSheetClose').click();assert.equal(await page.locator('#roomCompanionSheet').isVisible(),false);
   await page.keyboard.press('ArrowRight');await advance(page,650);assert.equal(await selected(),'roomCompanionTalk');
   await page.keyboard.press('Escape');assert.equal(await page.locator('#roomCompanionPanel').isVisible(),false);
   assert.equal(await page.evaluate(()=>document.activeElement?.dataset.roomKey),'c:room-character-luffy');
 });
 await test('direct icon selection opens work choices without assigning work',async()=>{
   await open();const initial=await calls();await page.locator('#roomLifeWork').click();await advance(page,50);
   assert.equal(await selected(),'roomLifeWork');assert.ok(await page.locator('#roomLifeWorkChoices button').count()>0);assert.deepEqual(await calls(),initial);await shot('radial-work');
   await page.locator('#roomCompanionSheetClose').click();
 });
 await test('gift requires two clicks; close resets confirmation; exactly one five-coin charge',async()=>{
   await choose('roomLifeGift');const initial=await calls();await page.locator('#roomLifeGift').click();assert.equal(await page.locator('#roomLifeGift').getAttribute('data-confirm'),'true');assert.deepEqual(await calls(),initial);
   await page.locator('#roomCompanionClose').click();await open();await choose('roomLifeGift');assert.equal(await page.locator('#roomLifeGift').getAttribute('data-confirm'),null);
   await page.locator('#roomLifeGift').click();assert.deepEqual(await calls(),initial);await page.locator('#roomLifeGift').click();await advance(page,500);
   const gifts=(await calls()).filter(x=>x.type==='character.interact'&&x.payload.action==='gift');assert.equal(gifts.length,1);assert.equal(await page.evaluate(()=>window.__integration.db[42].wallet.coins),95);
 });
 await test('drag rotates without accidental action; release outside clears drag',async()=>{
   await page.locator('#roomCompanionClose').click();await open();const initial=await calls();const box=await page.locator('#roomCompanionWheel').boundingBox();
   await page.mouse.move(box.x+136,box.y+136);await page.mouse.down();await page.mouse.move(box.x+136,box.y+188,{steps:5});await page.mouse.up();await advance(page,650);
   assert.notEqual(await selected(),'roomCompanionTalk');assert.deepEqual(await calls(),initial);
   const pre=await selected();await page.mouse.move(box.x+187,box.y+136);await page.mouse.down();await page.mouse.move(box.x+193,box.y+140);await page.mouse.up();await page.mouse.move(box.x+180,box.y+195);await advance(page,650);
   assert.equal(await selected(),pre);assert.deepEqual(await calls(),initial);
   await page.locator('#roomCompanionWheel').dispatchEvent('pointerdown',{pointerId:27,pointerType:'touch',button:0,clientY:100});await page.locator('#roomCompanionWheel').dispatchEvent('pointercancel',{pointerId:27,pointerType:'touch'});
   await choose('roomLifeStatus');await page.locator('#roomLifeStatus').click();assert.equal(await page.locator('#roomCompanionSheet').isVisible(),true);
 });
 await test('navigation/account/edit mode close wheel and reset state',async()=>{
   await page.evaluate(()=>window.LauncherRoom.onVisible('shop'));assert.equal(await page.locator('#roomCompanionPanel').isVisible(),false);
   await page.evaluate(()=>window.LauncherRoom.onVisible('profile'));await open();assert.equal(await selected(),'roomCompanionTalk');
   await page.evaluate(()=>window.LauncherRoom.openEditor());await advance(page,200);assert.equal(await page.locator('#roomCompanionPanel').isVisible(),false);assert.equal(await page.locator('#roomEditor').isVisible(),true);
   await page.locator('#roomCancel').click();await open();await page.evaluate(()=>window.__integration.use(43));await advance(page,500);assert.equal(await page.locator('#roomCompanionPanel').isVisible(),false);
 });
 await page.close();({page,errors}=await create({owned:['luffy'],furniture:[{key:'map-table',col:8,row:1}]}));
 await test('work button assigns the selected station through the existing command path',async()=>{
   await open();await page.locator('#roomLifeWork').click();await page.locator('#roomLifeWorkChoices button').first().click();await advance(page,500);
   const work=(await calls()).filter(x=>x.type==='work.reserve');assert.equal(work.length,1);assert.equal(work[0].payload.itemId,'room-character-luffy');assert.equal(work[0].payload.stationId,'room-furniture-map-table');
   assert.equal(await page.locator('#roomCompanionSheet').isVisible(),false);
 });await page.close();({page,errors}=await create({owned:['luffy'],visitor:true}));
 await test('friend room exposes details only and no mutating commands',async()=>{
   await open();const b=await bounds();assert.deepEqual(b.buttons.map(x=>x.id),['roomLifeStatus']);await turn();assert.equal(await selected(),'roomLifeStatus');await page.locator('#roomLifeStatus').click();assert.equal(await page.locator('#roomCompanionSheet').isVisible(),true);assert.deepEqual(await calls(),[]);await shot('radial-friend');
 });await page.close();
 for(const [width,height,name] of [[390,844,'mobile'],[320,568,'narrow'],[900,300,'short']]) {
   ({page,errors}=await create({owned:['luffy']}));await page.setViewportSize({width,height});
   await test(`${name} viewport keeps circles and details within screen`,async()=>{
     await open();await bounds();await shot('radial-'+name);await choose('roomLifeStatus');await page.locator('#roomLifeStatus').click();
     const b=await page.locator('#roomCompanionSheet').boundingBox();assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width+.1&&b.y+b.height<=height+.1);await shot('radial-'+name+'-details');await page.locator('#roomCompanionSheetClose').click();
   });await page.close();
 }
 ({page,errors}=await create({owned:['luffy']}));
 await test('right-edge character mirrors semicircle and reduced motion switches instantly',async()=>{
   // Move the isolated fixture's character to the right edge through profile data.
   await page.evaluate(()=>{const f=window.__integration;f.db[42].profile.room.characters[0].x=900;f.db[42].profile.room.characters[0].y=480;f.db[42].profile.room.revision++;f.db[42].profile.roomItems.characters[0].x=900;f.db[42].profile.roomItems.characters[0].y=480;f.refresh();});await advance(page,500);
   await page.emulateMedia({reducedMotion:'reduce'});await open();assert.equal(await page.locator('#roomCompanionPanel').getAttribute('data-side'),'left');await bounds();
   await page.locator('#roomCompanionWheel').dispatchEvent('wheel',{deltaY:48});assert.equal(await selected(),'roomLifeWork');await advance(page,100);await shot('radial-edge');
   for(let i=0;i<12;i++) {
     const states=await page.locator('#roomCompanionActions button').evaluateAll(buttons=>buttons.map(b=>({id:b.id,hidden:b.getAttribute('aria-hidden')==='true',opacity:getComputedStyle(b).opacity,pointer:getComputedStyle(b).pointerEvents,tabIndex:b.tabIndex,glyph:getComputedStyle(b,'::before').visibility})));
     for(const b of states)if(b.hidden){assert.equal(b.opacity,'0');assert.equal(b.pointer,'none');assert.equal(b.tabIndex,-1);}else{assert.ok(Number(b.opacity)>0);assert.equal(b.glyph,'visible',b.id);}
     await page.locator('#roomCompanionWheel').dispatchEvent('wheel',{deltaY:48});await advance(page,100);
   }
 });await page.close();
 assert.deepEqual(hashes(),before);
 const report={status:'PASS',kind:'release-source-actual-chromium-isolated-ipc',iconMode:'inline-svg-restored-user-request',productionDeployed:false,recordedAt:new Date().toISOString(),checks:results,sourceSha256:before,sourceNormalizedSha256:normalizedHashes(),sourceHashNormalization:'CRLF to LF only; all other bytes remain significant',limitations:['IPC uses isolated fixtures; no real purchases or production data','Synthetic touch cancellation; no physical touch-device acceptance','Browser report alone does not certify installer or public deployment']};
 fs.writeFileSync(path.join(out,'RADIAL_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(`PASS ${results.length} scenarios`);
}catch(error){fs.writeFileSync(path.join(out,'RADIAL_QA_FAILURE.json'),JSON.stringify({status:'FAIL',checks:results,error:String(error.stack||error),sourceSha256:before},null,2));if(page)await shot('radial-failure').catch(()=>{});throw error;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

