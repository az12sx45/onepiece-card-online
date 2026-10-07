'use strict';
// Real UI/assets in Chromium with account transport fixtures. Real ledger and
// probability/timing enforcement is covered by launcher_fishing_forge_qa.js.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out='D:/Codex_QA/launcher-fishing-r34/journal';
const runtime=path.join(process.env.LOCALAPPDATA,'OpenAI/Codex/runtimes/cua_node');
const pw=fs.readdirSync(runtime).map(n=>path.join(runtime,n,'bin/node_modules/playwright')).find(fs.existsSync);
const {chromium}=require(pw);const checks=[],missing=[],errors=[];
const pass=(name,v)=>{assert.ok(v,name);checks.push(name);};
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const [label,width,height] of [['desktop',1440,900],['minimum',960,640],['compact',600,800]]){
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('opui://**',route=>{const p=path.join(root,'public',new URL(route.request().url()).pathname);if(fs.existsSync(p))return route.fulfill({path:p});missing.push(p);return route.fulfill({status:404,body:''});});
  await page.setContent('<html><body><button id="previous">個人頁</button></body></html>');
  for(const file of ['launcher.css','launcher-room-aquarium.css'])await page.addStyleTag({path:path.join(root,'desktop',file)});
  for(const file of ['launcher-room-aquarium.js'])await page.addScriptTag({path:path.join(root,'desktop',file)});
  await page.evaluate(()=>{
   const data={fishCollection:[],fishDex:['glistening-saury'],fishRecords:{'glistening-saury':{minCatch:{lengthCm:16.4,spotId:'shore',baitId:'worm'},maxCatch:{lengthCm:31.8,spotId:'reef',baitId:'shrimp'},grounds:[{spotId:'reef',baitId:'shrimp',count:2}]}},coins:200,rod:{characters:{'room-character-luffy':{level:0,nextCost:20},'room-character-zoro':{level:7,nextCost:70}}}};
   window.fixture=data;window.owner=true;window.commands=[];let active;
   window.journal=OnePieceFishingJournal.create({owner:()=>window.owner,life:()=>data,name:id=>id.endsWith('zoro')?'索隆':'魯夫',refresh:async()=>{},command:async(type,payload)=>{
    window.commands.push({type,payload});await new Promise(r=>setTimeout(r,80));
    if(payload.disposition==='forge_start'){active={id:'forge-id',startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+15000).toISOString(),hits:[]};return{ok:true,forge:structuredClone(active),serverNow:new Date().toISOString()};}
    active.hits.push(100);if(active.hits.length<3)return{ok:true,forge:structuredClone(active)};
    data.coins-=20;data.rod.characters[payload.recipientId].level++;return{ok:true,receipt:{success:true,chance:100,level:data.rod.characters[payload.recipientId].level}};
   }});journal.open();
  });
  pass(label+' single upgrade action',await page.locator('.fishing-journal-upgrade').count()===1);
  pass(label+' generated journal background',await page.locator('.fishing-journal').evaluate(n=>getComputedStyle(n).backgroundImage.includes('journal.webp')));
  await page.locator('.fishing-journal-character').selectOption('room-character-zoro');
  pass(label+' character rod shows own level',(await page.locator('.fishing-rod-stats').textContent()).includes('+7'));
  await page.locator('.fishing-journal-character').selectOption('room-character-luffy');
  await page.locator('.fishing-journal-upgrade').click();await page.locator('.fishing-forge-tap').waitFor();
  const before=await page.locator('.fishing-forge-pointer').evaluate(n=>n.getBoundingClientRect().left);await page.waitForTimeout(180);
  pass(label+' timing needle moves',Math.abs(before-await page.locator('.fishing-forge-pointer').evaluate(n=>n.getBoundingClientRect().left))>10);
  pass(label+' starting forge costs nothing',await page.evaluate(()=>fixture.coins===200));
  await page.screenshot({path:path.join(out,label+'-forge.png')});
  for(let i=0;i<3;i++){await page.evaluate(()=>document.activeElement.blur());await page.keyboard.press('Space');await page.waitForTimeout(350);pass(label+' Space registers tap '+(i+1),await page.evaluate(i=>commands.filter(c=>c.payload.disposition==='forge_tap').length===i+1,i));}
  pass(label+' three taps increase own rod only',await page.evaluate(()=>fixture.rod.characters['room-character-luffy'].level===1&&fixture.rod.characters['room-character-zoro'].level===7));
  pass(label+' one charge on completion',await page.evaluate(()=>fixture.coins===180));
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
  await page.getByRole('button',{name:'關閉',exact:true}).click();await page.evaluate(()=>{owner=false;journal.open();});pass(label+' friend cannot forge with owner inventory',await page.locator('.fishing-journal').count()===0);
  await page.close();
 }
 pass('no missing generated or fish assets',missing.length===0);pass('no browser runtime errors',errors.length===0);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',checks,missing,errors},null,2));console.log('PASS '+checks.length+' journal UI checks');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
