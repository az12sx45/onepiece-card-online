'use strict';
// Real UI/assets in Chromium with account transport fixtures. Real ledger and
// probability/timing enforcement is covered by launcher_fishing_forge_qa.js.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.LAUNCHER_FISH_JOURNAL_QA_OUT||'D:/Codex_QA/launcher-fishing-r43/journal';
const runtime=path.join(process.env.LOCALAPPDATA,'OpenAI/Codex/runtimes/cua_node');
const pw=fs.readdirSync(runtime).map(n=>path.join(runtime,n,'bin/node_modules/playwright')).find(fs.existsSync);
const E=require('../server/launcher-fishing-v5'),B=require('../server/launcher-fishing-balance');const {chromium}=require(pw);const checks=[],missing=[],errors=[];
const pass=(name,v)=>{assert.ok(v,name);checks.push(name);};
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const [label,width,height] of [['desktop',1440,900],['minimum',960,640]]){
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('opui://**',route=>{const p=path.join(root,'public',new URL(route.request().url()).pathname);if(fs.existsSync(p))return route.fulfill({path:p});missing.push(p);return route.fulfill({status:404,body:''});});
  await page.setContent('<html><body><button id="previous">個人頁</button></body></html>');
  for(const file of ['launcher.css','launcher-room-aquarium.css'])await page.addStyleTag({path:path.join(root,'desktop',file)});
  for(const file of ['launcher-room-aquarium.js'])await page.addScriptTag({path:path.join(root,'desktop',file)});
  await page.evaluate(profiles=>{
   const data={fishCollection:[],fishDex:['glistening-saury'],fishRecords:{'glistening-saury':{minCatch:{lengthCm:16.4,spotId:'shore',baitId:'worm'},maxCatch:{lengthCm:31.8,spotId:'reef',baitId:'shrimp'},grounds:[{spotId:'reef',baitId:'shrimp',count:2}]}},coins:200,rod:{characters:{'room-character-luffy':{level:0,nextCost:20},'room-character-zoro':{level:7,nextCost:70}}}};
   for(const [id,v]of Object.entries(profiles))if(id.startsWith('room-character-')&&!data.rod.characters[id])data.rod.characters[id]={level:0,nextCost:20};for(const [id,v]of Object.entries(data.rod.characters))v.stats=profiles[id];window.fixture=data;window.owner=true;window.commands=[];let active;
   window.journal=OnePieceFishingJournal.create({owner:()=>window.owner,life:()=>data,name:id=>id.endsWith('zoro')?'索隆':'魯夫',refresh:async()=>{},command:async(type,payload)=>{
    window.commands.push({type,payload});await new Promise(r=>setTimeout(r,80));
    if(payload.disposition==='forge_start'){active={id:'forge-id',startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+15000).toISOString(),hits:[]};return{ok:true,forge:structuredClone(active),serverNow:new Date().toISOString()};}
    active.hits.push(100);if(active.hits.length<3)return{ok:true,forge:structuredClone(active)};
    data.coins-=20;data.rod.characters[payload.recipientId].level++;data.rod.characters[payload.recipientId].stats=profiles.nextLuffy;return{ok:true,receipt:{success:true,chance:100,level:data.rod.characters[payload.recipientId].level}};
   }});const dock=OnePieceFishingJournal.createShortcuts((id,tab)=>journal.open(id,tab));dock.hidden=false;document.querySelector('.fishing-journal-shortcut-rods').click();
  },Object.assign({nextLuffy:{...B.typedRodStats(1,'luffy'),performance:E.rodPerformance(1,'luffy')}},Object.fromEntries(['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe','ace','sabo','law'].map(k=>['room-character-'+k,k==='zoro'?7:0]).map(([id,level])=>[id,{...B.typedRodStats(level,id.slice(15)),performance:E.rodPerformance(level,id.slice(15))}]))));
  pass(label+' distinct distance and stamina metrics',(await page.locator('[data-stat=distance]').textContent()).includes('公尺/秒')&&(await page.locator('[data-stat=stamina]').textContent()).includes('體力/秒'));await page.screenshot({path:path.join(out,label+'-rods.png')});
  pass(label+' rod and reference text fit the paper content',await page.locator('.fishing-journal-content').evaluate(n=>{const b=n.getBoundingClientRect();return [...n.querySelectorAll('.fishing-journal-rod,.fishing-rod-reference')].every(v=>v.getBoundingClientRect().bottom<=b.bottom+1);}));
  pass(label+' fixed upgrade button visible without scrolling',await page.locator('.fishing-journal-upgrade').evaluate(n=>{const r=n.getBoundingClientRect();return r.bottom<innerHeight&&r.top>0;}));
  const tabHover=page.getByRole('button',{name:'個人釣竿',exact:true});await tabHover.hover();pass(label+' hover retains painted button instead of black background',await tabHover.evaluate(n=>getComputedStyle(n).backgroundImage.includes('button-plate.webp')));
  for(const k of ['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe','ace','sabo','law']){await page.locator('.fishing-journal-character').selectOption('room-character-'+k);await page.waitForFunction(()=>{const i=document.querySelector('.fishing-journal-rod-image');return i?.complete&&i.naturalWidth>=1000;});pass(label+' '+k+' uses independent advertising artwork',await page.locator('.fishing-journal-rod-image').getAttribute('src').then(src=>src.endsWith('/'+k+'.webp')));}
  await page.locator('.fishing-journal-character').selectOption('room-character-luffy');await page.locator('.fishing-journal-rod').click();pass(label+' full rod presentation opens large preview',await page.locator('.fishing-rod-preview-image').isVisible());await page.screenshot({path:path.join(out,label+'-advertisement.png')});await page.keyboard.press('Escape');pass(label+' closing preview returns to journal',await page.locator('.fishing-rod-preview').count()===0&&await page.locator('.fishing-journal').isVisible());
  pass(label+' single upgrade action',await page.locator('.fishing-journal-upgrade').count()===1);
  pass(label+' generated journal background',await page.locator('.fishing-journal').evaluate(n=>getComputedStyle(n).backgroundImage.includes('journal.webp')));
  await page.locator('.fishing-journal-character').selectOption('room-character-zoro');
  pass(label+' character rod shows own level',(await page.locator('.fishing-rod-showcase').textContent()).includes('+7'));
  await page.locator('.fishing-journal-character').selectOption('room-character-luffy');
  await page.locator('.fishing-journal-upgrade').click();await page.locator('.fishing-forge-tap').waitFor();
  const before=await page.locator('.fishing-forge-pointer').evaluate(n=>n.getBoundingClientRect().left);await page.waitForTimeout(180);
  pass(label+' timing needle moves',Math.abs(before-await page.locator('.fishing-forge-pointer').evaluate(n=>n.getBoundingClientRect().left))>10);
  pass(label+' starting forge costs nothing',await page.evaluate(()=>fixture.coins===200));
  await page.screenshot({path:path.join(out,label+'-forge.png')});
  for(let i=0;i<3;i++){await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('Space');await page.waitForTimeout(350);pass(label+' Space registers tap '+(i+1),await page.evaluate(i=>commands.filter(c=>c.payload.disposition==='forge_tap').length===i+1,i));}
  pass(label+' three taps increase own rod only',await page.evaluate(()=>fixture.rod.characters['room-character-luffy'].level===1&&fixture.rod.characters['room-character-zoro'].level===7));
  pass(label+' one charge on completion',await page.evaluate(()=>fixture.coins===180));
  pass(label+' upgrade refreshes detailed abilities',(await page.locator('[data-stat=special]').textContent()).includes(String(B.typedRodStats(1,'luffy').special)));
  pass(label+' correct success result displayed',(await page.locator('.fishing-journal-feedback').textContent()).includes('100%'));
  await page.getByRole('button',{name:'魚圖鑑',exact:true}).click();
  pass(label+' discovery survives no remaining fish',(await page.locator('.fishing-dex-count').textContent()).includes('1 /'));
  pass(label+' unknown names hidden',await page.locator('.fishing-dex-card[data-discovered=false] strong').evaluateAll(ns=>ns.every(n=>n.textContent==='????????????')));
  pass(label+' undiscovered fish black silhouettes',await page.locator('.fishing-dex-card[data-discovered=false] img').evaluateAll(ns=>ns.every(n=>getComputedStyle(n).filter==='brightness(0)')));
  pass(label+' fish cards use generated art',await page.locator('.fishing-dex-card').first().evaluate(n=>getComputedStyle(n).backgroundImage.includes('card.webp')));
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
  const bounds=await page.locator('.fishing-journal').evaluate(n=>{const b=n.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight;});pass(label+' journal fits desktop viewport',bounds);
  await page.screenshot({path:path.join(out,label+'-dex.png')});
  await page.getByRole('button',{name:/查看.*最大最小與釣點紀錄/}).click();const text=await page.locator('.fishing-dex-records').textContent();pass(label+' maximum and minimum measurements',text.includes('31.8 cm')&&text.includes('16.4 cm'));pass(label+' records carry actual sea and bait',text.includes('珊瑚礁邊 · 蝦餌')&&text.includes('近岸水流 · 蟲餌'));await page.evaluate(()=>document.fonts.ready);pass(label+' local handwritten font loaded',await page.evaluate(()=>document.fonts.check('18px "LXGW WenKai TC Journal"','漁獲圖鑑最大紀錄')));pass(label+' records directly use original book page',await page.locator('.fishing-dex-records').evaluate(n=>getComputedStyle(n).backgroundImage==='none'));pass(label+' buttons use drawn plate',await page.locator('.fishing-dex-back').evaluate(n=>getComputedStyle(n).backgroundImage.includes('button-plate.webp')));await page.screenshot({path:path.join(out,label+'-records.png')});
  pass(label+' separate detail hides fish grid',await page.locator('.fishing-dex-grid').count()===0);await page.getByRole('button',{name:'‹ 返回圖鑑'}).click();pass(label+' back restores fish grid',await page.locator('.fishing-dex-grid').count()===1);await page.getByRole('button',{name:'下一頁 ›'}).click();pass(label+' pages navigate',(await page.locator('.fishing-dex-pages').textContent()).includes('2 /'));
  await page.getByRole('button',{name:'關閉',exact:true}).click();const dex=page.locator('.fishing-journal-shortcut-dex'),rect=await dex.boundingBox();await dex.hover();const stability=await dex.evaluate(async n=>{const a=n.getBoundingClientRect(),states=[];for(let i=0;i<15;i++){await new Promise(r=>setTimeout(r,70));let host=document.querySelector('#profileRefreshFixture');if(!host){host=document.createElement('section');host.id='profileRefreshFixture';document.body.prepend(host);}host.style.transform='translateX('+i+'px)';host.innerHTML='<p>房間刷新 '+i+'</p>';const b=n.getBoundingClientRect();states.push({x:b.x,y:b.y,w:b.width,h:b.height,opacity:getComputedStyle(n).opacity,transform:getComputedStyle(n).transform});}return states.every(v=>Math.abs(v.x-a.x)<.1&&Math.abs(v.y-a.y)<.1&&v.w===a.width&&v.h===a.height&&v.opacity==='1'&&v.transform==='none');});pass(label+' sustained hover and room refresh do not flash or move shortcut',stability);pass(label+' dock is mounted outside profile refresh containers',await dex.evaluate(n=>n.parentElement.parentElement===document.body));pass(label+' shortcuts have large full hit areas',rect.width>=160&&rect.height>=60);await page.mouse.click(rect.x+12,rect.y+rect.height/2);pass(label+' shortcut padding opens dex',(await page.locator('.fishing-journal-header').textContent()).includes('漁獲圖鑑'));await page.getByRole('button',{name:'關閉',exact:true}).click();await page.evaluate(()=>{owner=false;journal.open();});pass(label+' friend cannot forge with owner inventory',await page.locator('.fishing-journal').count()===0);
  await page.close();
 }
 pass('no missing generated or fish assets',missing.length===0);pass('no browser runtime errors',errors.length===0);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',checks,missing,errors},null,2));console.log('PASS '+checks.length+' journal UI checks');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
