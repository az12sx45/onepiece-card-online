'use strict';
// Real launcher DOM/renderer and real local WebP images; isolated preload only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.env.LAUNCHER_SHOP_LOCAL_QA_OUT||'D:/Codex_QA/launcher-shop-r59/local-loading';
process.env.LAUNCHER_GUESTBOOK_UI_QA_OUT=out;
const {setup,chromium,report:fixture}=require('./launcher_guestbook_danmaku_qa');
const baseline=process.argv.includes('--baseline');
const report={status:'RUNNING',scope:'Real renderer, 1500 ms delayed authenticated catalog, local opui image bytes; no formal account changes.',baseline,checks:[],metrics:{}};
fs.mkdirSync(out,{recursive:true});
const save=()=>fs.writeFileSync(path.join(out,baseline?'baseline-report.json':'report.json'),JSON.stringify(report,null,2));
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});save();assert.ok(pass,name+': '+JSON.stringify(detail));};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const page=await setup(browser,{width:1440,height:1000});
  const remote=[];page.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
  await page.evaluate(()=>{
   window.__localQa={calls:0,pending:[],delay:1500};
   window.onePieceDesktop.getLauncherShop=async()=>{const q=window.__localQa;q.calls++;await new Promise(r=>setTimeout(r,q.delay));return{ok:true,shop:structuredClone(window.__guestbookQa.shop)};};
   window.LauncherProfileShop.setAccount({authenticated:true,profile:{userId:45,name:'帳號二'}});
  });
  const cold=await page.evaluate(()=>{
   const start=performance.now();window.__shopOpenedAt=start;window.launcherSwitchPanel('shop');
   return{elapsed:performance.now()-start,count:document.querySelectorAll('#shopGrid .shop-item').length,wallet:document.getElementById('shopWallet').textContent,enabled:document.querySelectorAll('#shopGrid .shop-item-bottom button:not(:disabled)').length,calls:window.__localQa.calls};
  });
  report.metrics.cold=cold;save();
  if(!baseline){check('all 192 local portraits render before delayed cloud reply',cold.count===192&&cold.elapsed<300,cold);check('new account has no cached wallet or purchase permission',cold.wallet==='—'&&cold.enabled===0,cold);}
  if(!baseline){
   report.metrics.firstTwelveImagesReadyMs=await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('#shopGrid img')].slice(0,12).map(n=>n.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()-window.__shopOpenedAt;});
   check('first twelve local portraits decode before 1500 ms cloud reply',report.metrics.firstTwelveImagesReadyMs<1000,report.metrics.firstTwelveImagesReadyMs);
  }
  const time=Date.now();await page.waitForFunction(()=>document.getElementById('shopWallet').textContent!=='—');
  report.metrics.cloudWaitMs=Date.now()-time;
  const before=await page.evaluate(()=>{window.__localImage=document.querySelector('#shopGrid img');return window.__localQa.calls;});
  const reopen=await page.evaluate(()=>{const t=performance.now();window.launcherSwitchPanel('library');window.launcherSwitchPanel('shop');return{elapsed:performance.now()-t,calls:window.__localQa.calls,sameImage:window.__localImage===document.querySelector('#shopGrid img'),count:document.querySelectorAll('#shopGrid .shop-item').length};});
  await page.waitForTimeout(1650);
  reopen.sameImageAfterReply=await page.evaluate(()=>window.__localImage===document.querySelector('#shopGrid img'));
  report.metrics.reopen=reopen;save();
  if(!baseline){check('fresh cached reopen sends no extra catalog request',reopen.calls===before,reopen);check('reopening preserves decoded image DOM',reopen.sameImage&&reopen.sameImageAfterReply,reopen);}
  await page.evaluate(()=>{window.LauncherProfileShop.openShopCategory('wall');window.LauncherProfileShop.openShopCategory('avatar');});
  const categoryReuse=await page.evaluate(()=>window.__localImage===document.querySelector('#shopGrid img'));
  report.metrics.categoryImagePreserved=categoryReuse;
  if(!baseline)check('returning to avatar category reuses image DOM',categoryReuse);
  if(baseline){report.status='RECORDED';save();return;}
  // Simulate an account with no network, not an invented balance.
  await page.evaluate(()=>{
   window.onePieceDesktop.getLauncherShop=async()=>{window.__localQa.calls++;throw new Error('offline');};
   window.LauncherProfileShop.setAccount({authenticated:true,profile:{userId:46,name:'離線帳號'}});window.launcherSwitchPanel('shop');
  });
  await page.waitForTimeout(80);
  check('offline catalog remains complete with unavailable balance and disabled transactions',await page.evaluate(()=>document.querySelectorAll('#shopGrid .shop-item').length===192&&document.getElementById('shopWallet').textContent==='—'&&!document.querySelector('#shopGrid .shop-item-bottom button:not(:disabled)')));
  await page.locator('#shopGrid .shop-item-image').first().click();
  check('offline large image preview opens',await page.locator('#shopItemPreviewDialog').evaluate(n=>n.open));
  await page.locator('#shopItemPreviewClose').click();
  // In-flight old-account reply must not leak the wallet/ownership into a new account.
  await page.evaluate(()=>{
   window.onePieceDesktop.getLauncherShop=()=>new Promise(resolve=>{window.__localQa.calls++;window.__localQa.pending.push(resolve);});
   window.LauncherProfileShop.setAccount({authenticated:true,profile:{userId:47,name:'帳號三'}});window.launcherSwitchPanel('shop');
   window.LauncherProfileShop.setAccount({authenticated:true,profile:{userId:48,name:'帳號四'}});window.launcherSwitchPanel('shop');
  });
  check('prefetch and visible shop share one request per account',await page.evaluate(()=>window.__localQa.pending.length===2));
  await page.evaluate(()=>window.__localQa.pending[0]({ok:true,shop:structuredClone(window.__guestbookQa.shop)}));
  await page.waitForTimeout(30);
  check('stale old-account response cannot overwrite wallet',await page.locator('#shopWallet').textContent()==='—');
  await page.evaluate(()=>{const shop=structuredClone(window.__guestbookQa.shop);shop.wallet.coins=777;window.__localQa.pending[1]({ok:true,shop});});
  await page.waitForFunction(()=>document.getElementById('shopWallet').textContent==='777');
  check('new account receives only its own successful snapshot',await page.locator('#shopWallet').textContent()==='777');
  await page.evaluate(()=>{
   window.__clockNow=Date.now;Date.now=()=>window.__clockNow()+31000;
   window.__ttlImage=document.querySelector('#shopGrid img');window.__localQa.pending=[];
   window.launcherSwitchPanel('library');window.launcherSwitchPanel('shop');window.LauncherProfileShop.onVisible('shop');
  });
  check('expired balance refresh preserves images but disables transactions',await page.evaluate(()=>document.querySelector('#shopGrid img')===window.__ttlImage&&!document.querySelector('#shopGrid .shop-item-bottom button:not(:disabled)')));
  check('expired concurrent opens are coalesced',await page.evaluate(()=>window.__localQa.pending.length===1));
  await page.evaluate(()=>{
   window.LauncherProfileShop.onCompanionWalletChanged({coins:888});
   const shop=structuredClone(window.__guestbookQa.shop);shop.wallet.coins=777;window.__localQa.pending[0]({ok:true,shop});
  });
  await page.waitForTimeout(30);
  check('live earned coins survive a slower catalog snapshot',await page.locator('#shopWallet').textContent()==='888');
  // Real button flow still delegates all purchases/equips to the bridge.
  await page.evaluate(()=>{
   Date.now=()=>window.__clockNow()+62000;
   const q=window.__guestbookQa;q.shop.wallet.coins=1000000;q.shop.owned.avatars=q.shop.owned.avatars.filter(x=>x!==123);q.shop.equipped.avatar=8;
   window.onePieceDesktop.getLauncherShop=async()=>{window.__localQa.calls++;return{ok:true,shop:structuredClone(q.shop)};};
   window.LauncherProfileShop.onVisible('shop');
  });
  await page.waitForFunction(()=>document.getElementById('shopWallet').textContent==='1,000,000');
  const purchasesBefore=await page.evaluate(()=>window.__guestbookQa.calls.filter(x=>x[0]==='command'&&x[1].payload.operation==='shop.buy').length);
  await page.locator('#shopGrid [data-item-id="ava-123"] .shop-item-bottom button').evaluate(n=>n.click());
  check('local preview still asks for explicit purchase confirmation',await page.locator('#shopConfirmDialog').evaluate(n=>n.open));
  await page.locator('#shopConfirmBuy').click();
  await page.waitForFunction(()=>!document.getElementById('shopConfirmDialog').open);
  check('purchase performs one server-authoritative command and updates ownership',await page.evaluate(n=>window.__guestbookQa.calls.filter(x=>x[0]==='command'&&x[1].payload.operation==='shop.buy').length===n+1&&document.querySelector('#shopGrid [data-item-id="ava-123"] .shop-item-bottom span').textContent==='已收藏',purchasesBefore));
  await page.locator('#shopGrid [data-item-id="ava-123"] .shop-item-bottom button').evaluate(n=>n.click());
  await page.waitForFunction(()=>document.querySelector('#shopGrid [data-item-id="ava-123"] .shop-item-bottom button').textContent==='使用中');
  check('equipping still sends authenticated command',await page.evaluate(()=>window.__guestbookQa.calls.some(x=>x[0]==='command'&&x[1].payload.operation==='shop.equip'&&x[1].payload.itemId==='ava-123')));
  // A lost login must immediately discard account ownership even if the art remains.
  await page.evaluate(()=>{
   Date.now=()=>window.__clockNow()+93000;
   window.onePieceDesktop.getLauncherShop=async()=>({ok:false,error:'not authenticated'});window.LauncherProfileShop.onVisible('shop');
  });
  await page.waitForTimeout(30);
  check('expired authentication discards private shop state but retains public art',await page.evaluate(()=>document.getElementById('shopWallet').textContent==='—'&&document.querySelectorAll('#shopGrid .shop-item').length===192&&!document.querySelector('#shopGrid .shop-item-bottom button:not(:disabled)')));
  await page.evaluate(()=>window.LauncherProfileShop.setAccount({authenticated:false}));
  check('logout removes account wallet and item actions',await page.evaluate(()=>document.getElementById('shopWallet').textContent==='—'&&!document.querySelector('#shopGrid .shop-item')));
  check('no HTTP asset request during local shop work',remote.length===0,remote);
  check('no renderer exceptions',fixture.errors.length===0,fixture.errors);
  report.status='PASS';save();
 }catch(e){report.status='FAIL';report.error=e.stack;save();throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
