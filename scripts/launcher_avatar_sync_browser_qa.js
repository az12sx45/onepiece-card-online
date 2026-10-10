'use strict';
// Run against launcher_avatar_sync_server_qa.js with AVATAR_QA_KEEP_SERVER=1.
// Two independent browser contexts; real entry pages and live isolated server.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.LAUNCHER_GUESTBOOK_UI_QA_OUT='D:/Codex_QA/launcher-shop-r58/browser-fixture';
const {chromium}=require('./launcher_guestbook_danmaku_qa');
const root=path.resolve(__dirname,'..'),out='D:/Codex_QA/launcher-shop-r58/game-browser';
const origin='http://127.0.0.1:41958';
const report={status:'RUNNING',scope:'Two independent browser contexts against production server with isolated PGlite. Production entry sources with only hardcoded API origin remapped to loopback. Card alias routes emulate verified runtime package paths.',checks:[],screenshots:[],errors:[]};
fs.mkdirSync(out,{recursive:true});
function save(){fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));}
async function main(){
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:[]});
  let active;
  try{
    const pages=[];
    for(const [userId,secret,avatar] of [[1,'r58-qa-owner',222],[2,'r58-qa-friend',123]]){
      const context=await browser.newContext({viewport:{width:1440,height:1000}});
      await context.grantPermissions(['local-network-access'],{origin});
      await context.route(origin+'/**',async route=>{
        const p=new URL(route.request().url()).pathname;
        if(p.endsWith('.html')){
          const source=path.resolve(root,'public','.'+p);
          assert(source.startsWith(path.join(root,'public')+path.sep));
          return route.fulfill({contentType:'text/html',body:fs.readFileSync(source,'utf8').replaceAll('https://onepiece-card-online.onrender.com',origin)});
        }
        return route.continue();
      });
      await context.addInitScript(({userId,secret})=>{localStorage.setItem('opSecret',secret);localStorage.setItem('op_secret',secret);localStorage.setItem('op_user_id',String(userId));localStorage.setItem('op_device_id','r58-browser-'+userId);localStorage.setItem('op_avatar','8');localStorage.setItem('op_player_avatar','8');}, {userId,secret});
      // The packaged legacy Card alias and Board paths share the same WebP.
      await context.route('**/images/avatars/*.webp',route=>{
        const m=new URL(route.request().url()).pathname.match(/\/avatars\/(\d+)\.webp$/);
        if(m&&Number(m[1])>=51&&Number(m[1])<=222){
          const file=path.join(root,'public/images/board/avatars',m[1]+'.webp');
          if(!fs.existsSync(file)){(report.missingAssets??=[]).push(m[1]);return route.fulfill({status:404,body:'Pending asset'});}
          return route.fulfill({path:file,contentType:'image/webp'});
        }
        return route.continue();
      });
      const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push({userId,message:e.message}));
      // Current Chrome separates loopback from the older local-network permission.
      // Grant only this disposable QA context access to its isolated test server.
      const cdp=await context.newCDPSession(page),target=await cdp.send('Target.getTargetInfo');
      await cdp.send('Browser.setPermission',{permission:{name:'loopback-network'},setting:'granted',origin,browserContextId:target.targetInfo.browserContextId});
      page.on('websocket',ws=>{(report.sockets??=[]).push({userId,url:ws.url()});});
      page.on('console',m=>{if(m.type()==='error')(report.consoleErrors??=[]).push(m.text().slice(0,400));});
      pages.push({page,context,userId,secret,avatar});
    }
    for(const game of ['card','board','chess']){
      for(const {page,userId,avatar}of pages){
        active=page;
        const entry=game==='card'?'start.html':game==='board'?'board_start.html':'chess/index.html';
        await page.goto(origin+'/'+entry,{waitUntil:'domcontentloaded'});
        if(game==='card'){await page.waitForFunction(()=>window.__stageNow==='press'||window.__cloudProfile);await page.keyboard.press('Enter');}
        else{await page.locator(game==='board'?'#boardEntryStartBtn':'#battleEntryStartBtn').click();}
        await page.waitForFunction(({game,avatar})=>{
          if(game==='card')return window.__cloudProfile?.playerAvatar===avatar;
          const img=document.querySelector('#playerAvatar');return img?.src.includes('/'+avatar+'.webp');
        },{game,avatar},{timeout:30000});
        const visible=await page.waitForFunction(avatar=>[...document.images].some(img=>new RegExp('/'+avatar+'\\.webp(?:[?#]|$)').test(img.src)&&img.complete&&img.naturalWidth===735&&img.getBoundingClientRect().width>15),avatar);
        assert(visible);report.checks.push(game+' account '+userId+' renders current 735px avatar '+avatar+' after stale local bootstrap');
        await page.screenshot({path:out+'/'+game+'-'+userId+'.png'});report.screenshots.push(game+'-'+userId+'.png');save();
      }
      // Each game draws friends from the same server projection. Both windows
      // stay open here so online presence and the opposite avatar are real.
      for(const {page,userId}of pages){
        const expected=userId===1?123:222;
        if(game==='board')await page.evaluate(()=>window.BoardShared.openFriends());
        if(game==='chess')await page.evaluate(()=>window.BattleSocial.openDock());
        if(game==='card')await page.evaluate(()=>{document.getElementById('friendDock')?.classList.remove('collapsed');});
        await page.waitForFunction(expected=>[...document.images].some(img=>img.src.includes('/'+expected+'.webp')&&img.complete&&img.naturalWidth===735),expected,{timeout:30000});
        report.checks.push(game+' friend '+expected+' loads same shared artwork');save();
      }
    }
    const a=pages[0].page;
    active=a;
    await a.goto(origin+'/profile.html',{waitUntil:'domcontentloaded'});
    await a.waitForFunction(()=>document.querySelector('#avatarImg')?.src.includes('/222.webp')&&document.querySelector('#avatarImg').naturalWidth===735);
    report.checks.push('Card profile renders new avatar and cloud ownership');
    await a.locator('#avatarBox').click();await a.locator('button.avaBtn').filter({has:a.locator('img[alt="avatar-123"]')}).click();await a.locator('#avatarSave').click();
    await a.waitForFunction(()=>document.querySelector('#avatarImg')?.src.includes('/123.webp')&&getComputedStyle(document.querySelector('#avatarModalBack')).display==='none');
    report.checks.push('Card profile explicit picker applies owned avatar through real server');
    await a.reload({waitUntil:'domcontentloaded'});await a.waitForFunction(()=>document.querySelector('#avatarImg')?.src.includes('/123.webp'));
    report.checks.push('Reload retains shared avatar despite stale local bootstrap');
    await a.setViewportSize({width:540,height:900});
    await a.locator('#avatarBox').click();
    await a.locator('button.avaBtn').filter({has:a.locator('img[alt="avatar-222"]')}).click();
    const fits=await a.locator('#avatarSave').evaluate(n=>{const b=n.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&b.top>=0&&b.bottom<=innerHeight;});assert(fits);
    if(process.env.AVATAR_QA_REQUIRE_ALL_ART==='1')await a.waitForFunction(()=>[...document.querySelectorAll('#avaGrid img')].filter(n=>{const b=n.getBoundingClientRect();return b.bottom>100&&b.top<innerHeight-80;}).every(n=>n.complete&&n.naturalWidth===735));
    await a.locator('#avaGrid img').evaluateAll(nodes=>Promise.all(nodes.filter(n=>{const b=n.getBoundingClientRect();return b.bottom>100&&b.top<innerHeight-80;}).map(n=>n.decode())));
    await a.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    report.pickerImageGeometry=await a.locator('#avaGrid img').evaluateAll(nodes=>nodes.filter(n=>{const b=n.parentElement.getBoundingClientRect();return b.bottom>110&&b.top<innerHeight-100;}).map(n=>({id:n.alt,image:n.getBoundingClientRect().toJSON(),button:n.parentElement.getBoundingClientRect().toJSON(),loaded:n.naturalWidth})));
    assert(report.pickerImageGeometry.every(n=>n.image.height>n.button.height*.8),'All visible portrait pixels fill their circle');
    await a.screenshot({path:out+'/profile-narrow.png'});report.screenshots.push('profile-narrow.png');
    await a.locator('#avatarCancel').click();report.checks.push('222-item picker scrolls with Apply/Cancel visible at 540px; cancel preserves selection');
    assert.equal(report.errors.length,0,JSON.stringify(report.errors));
    if(process.env.AVATAR_QA_REQUIRE_ALL_ART==='1')assert.equal((report.missingAssets||[]).length,0,'All final art installed');
    report.status='PASS';save();console.log(JSON.stringify({status:'PASS',checks:report.checks.length,report:out+'/report.json'}));
  }catch(e){report.status='FAIL';report.failure=e.stack;if(active){report.debug=await active.evaluate(()=>({stage:window.__stageNow,profile:window.__cloudProfile,body:document.body.innerText.slice(0,1600)})).catch(()=>null);await active.screenshot({path:out+'/failure.png'}).catch(()=>{});}save();throw e;}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
