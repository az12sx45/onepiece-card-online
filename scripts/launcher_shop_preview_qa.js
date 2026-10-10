'use strict';
// Real renderer, CSS and artwork; isolated preload fixture, never real purchases.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=process.env.LAUNCHER_SHOP_PREVIEW_QA_OUT||'D:/Codex_QA/launcher-shop-r57/preview';
process.env.LAUNCHER_GUESTBOOK_UI_QA_OUT=out;
const {setup,chromium,report:fixture}=require('./launcher_guestbook_danmaku_qa');
const {CATALOG}=require('../server/launcher-profile-shop');
const report={status:'RUNNING',scope:'Actual launcher renderer with isolated preload. No formal account writes.',checks:[],screenshots:[],sourceHashes:fixture.sourceHashes};
fs.mkdirSync(out,{recursive:true});
const save=()=>fs.writeFileSync(path.join(out,'preview-report.json'),JSON.stringify(report,null,2));
const check=(name,ok,detail)=>{report.checks.push({name,pass:!!ok,...(detail===undefined?{}:{detail})});save();assert.ok(ok,name+': '+JSON.stringify(detail));};
async function shot(page,name,selector='#shopItemPreviewDialog'){const file=path.join(out,name+'.png');await page.locator(selector).screenshot({path:file});report.screenshots.push(file);}
async function category(page,type){await page.evaluate(type=>window.LauncherProfileShop.openShopCategory(type),type);await page.waitForFunction(type=>document.querySelector('#shopGrid .shop-item')?.dataset.type===type,type);}
async function preview(page,id,real=false){const button=page.locator('#shopGrid [data-item-id="'+id+'"] .shop-item-image');if(real)await button.click();else await button.evaluate(n=>n.click());await page.waitForFunction(id=>{const d=document.getElementById('shopItemPreviewDialog');return d.open&&d.dataset.itemId===id;},id);await page.waitForFunction(()=>[...document.querySelectorAll('#shopItemPreviewStage img')].every(n=>n.complete));}
async function close(page){await page.locator('#shopItemPreviewClose').click();await page.waitForFunction(()=>!document.getElementById('shopItemPreviewDialog').open);await page.waitForTimeout(20);}
async function main(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.LAUNCHER_PROFILE_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-gpu']});
 try{
  const page=await setup(browser,{width:1440,height:1000});
  const collection=CATALOG.filter(x=>!['wall','flag'].includes(x.type)&&(x.type!=='avatar'||x.key>=51));
  await page.evaluate(items=>{const c=window.__guestbookQa.profiles[42].collection.launcher;c.itemIds=items.map(x=>x.id);c.items=items;window.LauncherProfileShop.openProfile(0);},collection);
  await page.locator('#profileCollectionTabs button').filter({hasText:'展示室'}).click();
  check('collection above 150 preserves last new avatar and true count',(await page.locator('#profileCollectionCount').textContent()).includes(String(collection.length))&&(await page.locator('#profileCollectionGrid').textContent()).includes('魯夫・尼卡・霓光'));
  const allTypes=[...new Set(CATALOG.map(x=>x.type))];
  for(const type of allTypes){
   await category(page,type);
   const items=CATALOG.filter(x=>x.type===type);
   check(type+' count',await page.locator('#shopGrid .shop-item').count()===items.length);
   for(const item of items){
    await preview(page,item.id,item===items[0]);
    const state=await page.locator('#shopItemPreviewDialog').evaluate(n=>{const b=n.getBoundingClientRect(),img=n.querySelector('.shop-large-preview-image'),s=img&&getComputedStyle(img);return{title:n.querySelector('h2').textContent,fits:b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight,hasContent:!!n.querySelector('#shopItemPreviewStage').children.length,img:img?{width:img.naturalWidth,height:img.naturalHeight,fit:s.objectFit,radius:s.borderRadius,hidden:img.hidden,source:img.src}:null};});
    check(item.id+' large preview',state.title===item.name&&state.fits&&state.hasContent&&(!state.img||(state.img.fit==='contain'&&!state.img.hidden)),state);
    if(item===items[0])await shot(page,type+'-preview');
    if(item.id==='frame-luffy')check('rectangular frame retains full transparent source',state.img.width===1599&&state.img.height===900&&state.img.radius==='0px');
    if(item.type==='room_character')check(item.id+' uses verified portrait',state.img.source.includes('/portrait_v3/')||state.img.source.includes('/portrait_v4/')||state.img.source===item.asset);
    await close(page);
   }
  }
  check('preview never purchases or equips',await page.evaluate(()=>!window.__guestbookQa.calls.some(x=>x[0]==='command'&&['shop.buy','shop.equip'].includes(x[1].payload.operation))));
  await category(page,'guestbook_style');
  const button=page.locator('#shopGrid .shop-item-image').first();await button.focus();await page.keyboard.press('Enter');
  check('Enter opens accessible preview',await page.locator('#shopItemPreviewDialog').evaluate(n=>n.open));await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.getElementById('shopItemPreviewDialog').open);
  check('Escape restores preview trigger focus',await button.evaluate(n=>n===document.activeElement));
  await page.keyboard.press('Space');check('Space opens preview',await page.locator('#shopItemPreviewDialog').evaluate(n=>n.open));
  await page.evaluate(()=>window.launcherSwitchPanel('profile'));check('page navigation closes board product preview',await page.locator('#shopItemPreviewDialog').evaluate(n=>!n.open));
  await page.locator('#profileGuestbookPreview').click();check('profile board offers clean full-art view',await page.locator('#shopItemPreviewDialog').evaluate(n=>n.open&&n.dataset.type==='guestbook_style'));await close(page);
  await category(page,'bgm');await preview(page,CATALOG.find(x=>x.type==='bgm').id);
  const listen=page.locator('#shopItemPreviewActions .shop-preview-button');
  check('BGM preview retains 30 second listen button',await listen.count()===1);
  await page.evaluate(()=>{HTMLMediaElement.prototype.play=function(){window.__lastPreviewAudio=this;this.__qaPaused=false;return new Promise(r=>window.__resolvePreviewAudio=r);};HTMLMediaElement.prototype.pause=function(){this.__qaPaused=true;};});
  await listen.click();check('modal audio loading and cancellation visible',(await listen.textContent()).includes('取消')&&await listen.getAttribute('aria-pressed')==='true');
  await listen.click();check('modal cancel resets feedback',await listen.getAttribute('aria-pressed')==='false'&&await page.evaluate(()=>window.__lastPreviewAudio.__qaPaused));
  await listen.click();await page.evaluate(()=>window.__resolvePreviewAudio());await page.waitForFunction(()=>document.querySelector('#shopItemPreviewActions button').textContent==='停止試聽');
  check('modal playback and grid controls agree',await listen.getAttribute('aria-pressed')==='true'&&await page.locator('#shopGrid .shop-preview-button[aria-pressed=true]').count()===1);
  await page.evaluate(()=>{Object.defineProperty(window.__lastPreviewAudio,'currentTime',{configurable:true,get:()=>30});window.__lastPreviewAudio.dispatchEvent(new Event('timeupdate'));});
  check('modal preview stops at 30 seconds',await listen.getAttribute('aria-pressed')==='false'&&await page.evaluate(()=>window.__lastPreviewAudio.__qaPaused));
  await listen.click();await page.evaluate(()=>window.__resolvePreviewAudio());await close(page);
  check('closing modal stops playback',await page.evaluate(()=>window.__lastPreviewAudio.__qaPaused&&!window.__lastPreviewAudio.hasAttribute('src')));
  await page.evaluate(()=>{window.__guestbookQa.shop.preview=true;window.__guestbookQa.shop.wallet.coins=0;});await category(page,'avatar');await preview(page,'ava-31',true);
  check('anonymous/zero balance can preview',await page.locator('#shopItemPreviewDialog').evaluate(n=>n.open));await close(page);
  await preview(page,'ava-32');await page.evaluate(()=>window.LauncherProfileShop.setAccount({authenticated:false}));check('account change closes preview',await page.locator('#shopItemPreviewDialog').evaluate(n=>!n.open));
  await page.close();
  for(const viewport of [{width:1440,height:1000},{width:960,height:640},{width:540,height:850}]){
   const p=await setup(browser,viewport),stage=p.locator('#profileGuestbookStage');
   const comments=await p.evaluate(()=>structuredClone(window.__guestbookQa.comments[42]));
   for(const count of [0,1,9]){
    await p.evaluate(comments=>{window.__guestbookQa.comments[42]=comments;window.LauncherProfileShop.openProfile(0);},comments.slice(0,count));
    await p.waitForTimeout(160);
    const size=await stage.evaluate(n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return{width:b.width,height:b.height,fit:s.backgroundSize,lanes:n.querySelectorAll('.captain-danmaku-lane').length};});
    check(viewport.width+' board complete with '+count+' comments',size.fit==='contain'&&Math.abs(size.height-Math.max(190,size.width*9/16))<3,size);
   }
   await stage.scrollIntoViewIfNeeded();await shot(p,viewport.width+'-board', '#profileGuestbookStage');
   await p.locator('#profileGuestbookRead').click();
   const reading=await stage.evaluate(n=>{const b=n.getBoundingClientRect(),l=n.querySelector('.captain-guestbook-list');return{width:b.width,height:b.height,client:l.clientHeight,scroll:l.scrollHeight,overflow:getComputedStyle(l).overflowY};});
   check(viewport.width+' reader stays inside board',Math.abs(reading.height-Math.max(190,reading.width*9/16))<3&&reading.overflow==='auto',reading);
   await p.locator('#profileGuestbookRead').click();
   for(const board of CATALOG.filter(x=>x.type==='guestbook_style')){
    await p.evaluate(board=>{const q=window.__guestbookQa.profiles[42];q.appearance.guestbookStyleId=board.id;q.appearanceItems.guestbookStyle=board;window.LauncherProfileShop.openProfile(0);},board);await p.waitForTimeout(70);
    check(viewport.width+' '+board.id+' uncropped',await stage.evaluate((n,asset)=>n.style.getPropertyValue('--board-art').includes(asset)&&getComputedStyle(n).backgroundSize==='contain',board.asset));
   }
   await category(p,'frame');await preview(p,'frame-luffy',true);await shot(p,viewport.width+'-frame');await close(p);
   check(viewport.width+' page has no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.close();
  }
  report.missingAssets=fixture.missingAssets;report.errors=fixture.errors;
  const pending=fixture.missingAssets.filter(x=>/^images\/board\/avatars\/(9[3-9]|1[01][0-9]|12[0-2])\.webp$/.test(x));
  check('no missing existing artwork',fixture.missingAssets.length===pending.length,fixture.missingAssets);
  check('no renderer exceptions',fixture.errors.length===0,fixture.errors);
  if(pending.length&&process.env.ALLOW_PENDING_AVATARS==='1')report.status='PENDING_ART';else{check('all 30 avatar assets installed',pending.length===0,pending);report.status='PASS';}
  save();console.log(JSON.stringify({status:report.status,checks:report.checks.length,screenshots:report.screenshots.length,pending:pending.length}));
 }catch(error){report.status='FAIL';report.error=error.stack;save();throw error;}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
