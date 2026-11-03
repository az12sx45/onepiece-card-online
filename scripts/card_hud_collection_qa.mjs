import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Exact retained v063 mobile presentation plus the current online HTML. This
// suite changes no product files and does not simulate a physical device.
const require=createRequire(import.meta.url);
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mobileRoot='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const engine=require(root+'/server/engine.js');
const output=process.env.CARD_HUD_QA_OUT||'D:/Codex_QA/card-hud-collection-20261103';
const selection=(process.env.CARD_HUD_QA_MODES||'desktop,android,ios').split(',');
const report={passed:false,scope:'Original Card HTML, engine-authorized visible state and original UI handlers; desktop Chromium, exact v063 Android Chromium and exact v063 iOS Windows WebKit. Isolated socket fixture, not multiplayer, real account or physical-device acceptance.',limitations:['Off-turn held cards retain their existing tucked position (card-hand-dock.css). This suite checks that the redesigned self panel does not cover held cards; it does not certify every hand interaction.','Windows WebKit with the exact retained iOS bundle is browser-engine compatibility evidence, not physical iPhone acceptance.'],checks:[],errors:[],screenshots:[],bundles:{},cases:[]};
fs.mkdirSync(output,{recursive:true});
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function check(name,pass,detail){report.checks.push({name,pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));}
const sourceFiles=['public/game.html','public/js/card-desktop-table.js','public/css/card-desktop-table.css'];
report.source=sourceFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
const bundles={
  android:{root:process.env.CARD_HUD_ANDROID_ASSETS||mobileRoot+'/android/app/src/main/assets/mobile',expected:{js:'583b21edddae3e0ebc2ec464282e96cd680196215d2758546d3ac99fc6bfb5a5',css:'8348d1e9c0b0a27ca2e3e06457b3a883e17159b7796b2334041c446aa96cf3b2'},provenance:'Compared directly with assets/mobile/* inside retained D:/Codex_QA/marineford-box-20261101/PO-v063.apk; no extracted copies.'},
  ios:{root:process.env.CARD_HUD_IOS_ASSETS||'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile',expected:{js:'15567712b4b30f5587bc44ea6c9fcec3932cd5dabe19be7f4c295ce46d051b2b',css:'a21a4361ee5cd306c6c97f9b3e62266b9d902d466ab7e3137e874b7e2948acf0'},provenance:'Compared directly with Payload/PO.app/launcher-web/mobile/* inside retained D:/Codex_QA/marineford-box-20261101/PO-iOS-v063-UNSIGNED.ipa; no extracted copies.'}
};
for(const mode of selection.filter(x=>x!=='desktop')){
  const b=bundles[mode];if(!b)throw Error('Unknown mode '+mode);
  b.js=fs.readFileSync(path.join(b.root,'game-mobile.js'));b.css=fs.readFileSync(path.join(b.root,'game-mobile.css'));
  report.bundles[mode]={root:b.root,provenance:b.provenance,js:{bytes:b.js.length,sha256:sha(b.js)},css:{bytes:b.css.length,sha256:sha(b.css)}};
  check(mode+' retained v063 JS identity',sha(b.js)===b.expected.js,report.bundles[mode].js);
  check(mode+' retained v063 CSS identity',sha(b.css)===b.expected.css,report.bundles[mode].css);
}
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const socketStub=`window.__sent=[];window.__handlers={};window.__any=[];window.__deliver=(name,data)=>{for(const cb of window.__any)cb(name,data);for(const cb of [...(window.__handlers[name]||[])])cb(data)};window.io=()=>({connected:true,id:'hud-qa',onAny(cb){window.__any.push(cb);return this},on(name,cb){(window.__handlers[name]??=[]).push(cb);return this},once(){return this},listeners(name){return [...(window.__handlers[name]||[])]},off(name,fn){window.__handlers[name]=(window.__handlers[name]||[]).filter(x=>x!==fn);return this},emit(...args){window.__sent.push(args);return this},disconnect(){},connect(){}});`;
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  const match=u.pathname.match(/^\/__qa_bundle\/(android|ios)\.(js|css)$/);
  if(match){const b=bundles[match[1]],kind=match[2];res.writeHead(200,{'content-type':mime['.'+kind]});res.end(b[kind]);return;}
  if(u.pathname.includes('socket.io.min.js')){res.writeHead(200,{'content-type':'application/javascript'}).end(socketStub);return;}
  if(/\.(mp3|mp4|ogg|wav|webm|m4a)$/i.test(u.pathname)){res.writeHead(204).end();return;}
  const file=path.resolve(root,'public','.'+decodeURIComponent(u.pathname));
  if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
  try{
    const ext=path.extname(file);let data=fs.readFileSync(fs.existsSync(file)?file:path.join(mobileRoot,'public',path.relative(path.join(root,'public'),file)));
    if(u.pathname==='/game.html'&&u.searchParams.get('qaBundle')==='android')data=Buffer.from(data.toString().replace(/<head([^>]*)>/i,'<head$1><link rel="stylesheet" href="/__qa_bundle/android.css"><script src="/__qa_bundle/android.js"></script>'));
    res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream'}).end(data);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const desktopUA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1';
const androidUA='Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)';
const iosUA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)';
function raw(ids=[1,7,19],actor=2){
  const s=engine.createInitialState(6);Object.assign(s,{phase:'playing',startSeat:2,nextRoundStart:0,turnIndex:actor,turnStep:'choose',venues:[{name:'巴拉蒂'},{name:'和之國'}],discard:[0,2,6]});
  s.players.forEach((p,i)=>Object.assign(p,{alive:true,hand:i===actor?4:i+2,tempDraw:i===actor?6:null,gold:10+i,displayName:['測試船長','索隆','娜美','香吉士','騙人布','喬巴'][i],client:{name:['測試船長','索隆','娜美','香吉士','騙人布','喬巴'][i],avatar:i+1}}));
  Object.assign(s.players[0],{protected:true,dodging:true,frozen:true,skipNext:true,iceArmed:true});s.players[0].client.offline=true;Object.assign(s.players[1],{frozen:true,skipNext:true,iceArmed:true});
  s.deluxeUnlocks={0:ids,1:[3,18]};return s;
}
async function setState(page,s,viewer=0){
  const visible=engine.getVisibleState(s,viewer);
  check('visible state excludes every server-side collection map',!Object.hasOwn(visible,'deluxeUnlocks'));
  await page.evaluate(({s,viewer})=>{state=s;me.playerId=viewer;me.roomId='HUD-COLLECTION-QA';me.secret='fixture';render();window.__deliver('STATE',s);},{s:visible,viewer});
  await page.waitForFunction(()=>document.documentElement.dataset.cardMenuLayout==='v3'&&CardPhonePresentation?.ownCollectionVersion==='2'&&document.querySelector('#phoneSelfPlayer[data-self-design="captain-v1"] .phone-self-collection-label>b'));
  if(await page.locator('#phoneVenueIntro:not([hidden])').count())await page.locator('#phoneVenueContinue').click();
  await page.waitForFunction(()=>!CardPhonePresentation.presentationQueueSize()&&!CardPhonePresentation.presentationEffectsBusy(),{},{timeout:30000});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
async function closeSheet(p){await p.locator('#phoneCardSheet .phone-card-sheet-head button').click();await p.waitForFunction(()=>document.getElementById('phoneCardSheet').hidden);}
async function tap(p,mode,selector){if(mode==='desktop')await p.locator(selector).click();else await p.locator(selector).tap();}
async function clearActions(p){await p.evaluate(()=>window.__sent=[]);}
async function noActions(p,name){check(name,await p.evaluate(()=>!window.__sent.some(e=>e[0]==='ACTION')));}
async function screenshot(p,name){if(report.screenshots.length>=4||process.env.CARD_HUD_QA_NO_SHOTS)return;await p.locator('img').evaluateAll(ns=>Promise.all(ns.filter(n=>n.getClientRects().length&&!n.loading?.includes('lazy')).map(n=>n.decode().catch(()=>{}))));const file=path.join(output,name+'.png');await p.screenshot({path:file});report.screenshots.push(file);}
async function geometry(p,label){
  const g=await p.evaluate(()=>{
    const r=n=>n?.getBoundingClientRect().toJSON(),inside=b=>b&&b.width>0&&b.height>0&&b.left>=-1&&b.top>=-1&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1;
    const overlaps=(a,b)=>a&&b&&a.left<b.right-1&&a.right>b.left+1&&a.top<b.bottom-1&&a.bottom>b.top+1;
    const menu=document.getElementById('phoneCardMenu'),log=document.getElementById('phoneCompactLog'),resource=document.getElementById('phoneMatchResources'),chest=document.getElementById('phoneTreasure');
    const controls=[menu,log].map(n=>({id:n.id,rect:r(n),inside:inside(r(n)),hit:(()=>{const b=r(n),top=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return n===top||n.contains(top);})()}));
    const rows=[...document.querySelectorAll('main #players>[data-seat-self="false"]')].map(n=>({id:n.dataset.seatId,rect:r(n),plate:r(n.querySelector('.phone-seat-card')),active:n.dataset.seatActive})).sort((a,b)=>a.rect.left-b.rect.left);
    const self=r(document.getElementById('phoneSelfPlayer')),hand=[...document.querySelectorAll('.phone-card-held img')].filter(n=>n.getClientRects().length).map(r);
    const avatar=document.querySelector('#phoneSelfPlayer .phone-seat-avatar'),ab=r(avatar),top=document.elementFromPoint(ab.x+ab.width/2,ab.y+ab.height/2);
    return {width:innerWidth,height:innerHeight,padding:Number.parseFloat(getComputedStyle(document.getElementById('players')).paddingTop),controls,resource:r(resource),chest:r(chest),controlsInResource:controls.every(x=>resource.contains(document.getElementById(x.id))),singleton:document.querySelectorAll('#phoneCardMenu').length===1&&document.querySelectorAll('#phoneCompactLog').length===1,original:controls.every(x=>window.__originalHudButtons[x.id]===document.getElementById(x.id)&&window.__originalHudHandlers[x.id]===document.getElementById(x.id).onclick),rows,self,hand,selfInside:inside(self),selfAvatarHit:top===avatar||avatar.contains(top),selfAvatarTop:{tag:top?.tagName,id:top?.id,cls:top?.className},selfCoversHand:hand.some(b=>overlaps(self,b)),controlsOverlap:overlaps(controls[0].rect,controls[1].rect),chestOverlap:controls.some(x=>overlaps(x.rect,r(chest))),rowsInside:rows.every(x=>inside(x.rect)&&inside(x.plate)),rowsOverlap:rows.some((x,i)=>i&&overlaps(x.plate,rows[i-1].plate))};
  });
  check(label+' original singleton control nodes and click handlers',g.singleton&&g.original&&g.controlsInResource,g);
  check(label+' compact menu/log sit above treasure without overlap',g.controls.every(x=>x.inside&&x.hit&&x.rect.width<=96&&x.rect.height<=34&&x.rect.bottom<=g.resource.top+1)&&!g.controlsOverlap&&!g.chestOverlap,g.controls);
  check(label+' five raised opponent plates remain separated on screen',g.rows.length===5&&g.padding<=14&&g.rowsInside&&!g.rowsOverlap,g);
  check(label+' larger self plate is inside viewport and clear of held cards',g.selfInside&&!g.selfCoversHand&&g.self.width>Math.max(...g.rows.map(x=>x.rect.width))*1.1,g);
  check(label+' captain portrait center receives pointer events',g.selfAvatarHit,g.selfAvatarTop);
  const design=await p.evaluate(async()=>{
    const self=document.getElementById('phoneSelfPlayer'),panel=self.querySelector('.phone-seat-card'),opponent=document.querySelector('main #players>[data-seat-self="false"] .phone-seat-card'),avatar=self.querySelector('.phone-seat-avatar'),badge=self.querySelector('.phone-self-collection-label');
    const box=panel.getBoundingClientRect(),a=avatar.getBoundingClientRect(),bg=getComputedStyle(panel).backgroundImage,url=bg.match(/^url\(["']?(.*?)["']?\)$/)?.[1],img=new Image();if(url){img.src=url;await img.decode();}
    const fits=n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1;};
    const next=self.querySelector('.phone-seat-next'),nb=next.getBoundingClientRect(),statusNodes=[...self.querySelectorAll('.phone-seat-status-icon')];
    return {design:self.dataset.selfDesign,independentClass:panel.classList.contains('phone-self-captain'),backgroundDifferent:bg!==getComputedStyle(opponent).backgroundImage,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,ratio:box.width/box.height,avatar:{centerX:(a.x+a.width/2-box.x)/box.width,centerY:(a.y+a.height/2-box.y)/box.height,widthRatio:a.width/box.width,circle:Math.abs(a.width-a.height)<1,inside:fits(avatar)},collection:{label:badge?.querySelector('span')?.textContent,count:badge?.querySelector('b')?.textContent,inside:badge&&[badge,...badge.children].every(fits)},next:{visible:!next.hidden&&nb.width>0&&nb.height>0,inside:fits(next),reason:next.dataset.reason,clearOfStatuses:statusNodes.every(n=>{const b=n.getBoundingClientRect();return nb.right<=b.left+1||nb.left>=b.right-1||nb.bottom<=b.top+1||nb.top>=b.bottom-1;})},statuses:statusNodes.map(n=>({key:n.dataset.status,inside:fits(n)}))};
  });
  check(label+' self uses independent captain art at its original 1900:828 ratio',design.design==='captain-v1'&&design.independentClass&&design.backgroundDifferent&&design.naturalWidth===1900&&design.naturalHeight===828&&Math.abs(design.ratio-1900/828)<.01,design);
  check(label+' portrait fits the new captain socket',design.avatar.inside&&design.avatar.circle&&Math.abs(design.avatar.centerX-.192)<.005&&Math.abs(design.avatar.centerY-.408)<.005&&Math.abs(design.avatar.widthRatio-.253)<.005,design.avatar);
  check(label+' two-line collection label and every status fit inside captain panel',design.collection.label==='豪華卡'&&/^\d+\/20$/.test(design.collection.count)&&design.collection.inside&&design.statuses.length===6&&design.statuses.every(x=>x.inside),design);
  check(label+' next-starter flag fits beside all six statuses',design.next.visible&&design.next.inside&&design.next.reason==='roger'&&design.next.clearOfStatuses,design.next);
  g.captainDesign=design;
  return g;
}
async function collection(p,mode,ids,label){
  await clearActions(p);await tap(p,mode,'#phoneSelfPlayer .phone-seat-avatar');
  await p.locator('#phoneCardSheet .phone-deluxe-collection').waitFor({state:'visible'});
  check(label+' opens private collection title',await p.locator('#phoneCardSheetTitle').innerText()==='我的豪華卡');
  const cards=await p.locator('.phone-deluxe-grid>.phone-deluxe-card').evaluateAll(ns=>ns.map(n=>({id:Number(n.dataset.cardId),src:n.querySelector('img')?.getAttribute('src')})));
  check(label+' renders exactly authorized IDs with deluxe artwork',JSON.stringify(cards.map(x=>x.id))===JSON.stringify(ids)&&cards.every(x=>x.src?.endsWith('/'+x.id+'.webp')&&x.src.includes('images/cards_lux/')),cards);
  check(label+' correct private progress',await p.locator('.phone-deluxe-progress').innerText().then(s=>s.includes(ids.length+' / 20')&&s.includes('只有你可見')));
  if(ids.length){await p.locator('.phone-deluxe-card img').first().evaluate(n=>n.decode());check(label+' deluxe image decodes',await p.locator('.phone-deluxe-card img').first().evaluate(n=>n.naturalWidth>100));}
  else check(label+' empty collection explanation is available',await p.locator('.phone-deluxe-empty').isVisible());
  await noActions(p,label+' inspection emits no ACTION');
}
async function handButtons(p,mode,label){
  const s=raw([],0);s.venues=[];Object.assign(s.players[0],{protected:false,dodging:false,frozen:false,skipNext:false,iceArmed:false});s.players[0].client.offline=false;
  await setState(p,s);await clearActions(p);
  const events=await p.locator('#myPlayZone>.grid').evaluate(n=>({grid:getComputedStyle(n).pointerEvents,buttons:[...n.querySelectorAll(':scope>button')].map(b=>({id:b.id,pointer:getComputedStyle(b).pointerEvents,disabled:b.disabled,original:typeof b.onclick==='function'}))}));
  check(label+' original card buttons remain enabled over transparent grid',events.grid==='none'&&events.buttons.length===2&&events.buttons.every(x=>x.pointer==='auto'&&!x.disabled&&x.original),events);
  for(const [id,card] of [['playHand',4],['playDrawn',6]]){
    // Closing inspection restores focus while the existing 260ms hand fan
    // retracts. Let that real transition finish before choosing a touch point.
    await p.waitForTimeout(320);
    for(let attempt=0;attempt<2&&!await p.locator('#phoneCardSheet').isVisible();attempt++){
      if(mode==='desktop')await p.locator('#'+id).click();
      else{
        const point=await p.locator('#'+id).evaluate(n=>{const r=n.getBoundingClientRect(),x=r.x+r.width/2,y=Math.min(innerHeight-8,Math.max(8,r.top+Math.min(20,r.height/2))),top=document.elementFromPoint(x,y);return {x,y,hit:!!top&&(n===top||n.contains(top)),top:top?.id||top?.className};});
        check(label+' '+id+' receives an actual visible-card touch',point.hit,point);await p.touchscreen.tap(point.x,point.y);
      }
      await p.waitForTimeout(320);
    }
    check(label+' '+id+' opens its original hand inspector',await p.locator('#phoneCardSheet').getAttribute('data-inspect-kind')==='hand'&&await p.locator('.phone-card-inspector-art img').getAttribute('src').then(src=>src.endsWith('/'+card+'.webp')));
    await closeSheet(p);
  }
  await noActions(p,label+' inspecting either card emits no ACTION');
}
let browser,page;
try{
  for(const mode of selection){
    browser=mode==='ios'?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions']});
    let sizes=mode==='desktop'?[[1366,768],[1024,600]]:mode==='android'?[[844,390],[844,316],[740,320],[740,316],[640,320],[640,316]]:[[844,390],[640,320]];
    if(process.env.CARD_HUD_QA_VIEWPORTS)sizes=process.env.CARD_HUD_QA_VIEWPORTS.split(',').map(s=>{const match=s.match(/^(\d+)x(\d+)$/);if(!match)throw Error('Invalid viewport '+s);return [Number(match[1]),Number(match[2])];});
    if(process.env.CARD_HUD_QA_QUICK)sizes=[mode==='android'?[740,320]:sizes[0]];
    for(const [width,height] of sizes){
      const label=mode+' '+width+'x'+height;
      const ctx=await browser.newContext({viewport:{width,height},hasTouch:mode!=='desktop',isMobile:mode!=='desktop',userAgent:mode==='desktop'?desktopUA:mode==='ios'?iosUA:androidUA,serviceWorkers:'block'});
      await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      await ctx.addInitScript(()=>{
        window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;HTMLMediaElement.prototype.play=function(){return Promise.resolve();};HTMLMediaElement.prototype.load=function(){};HTMLMediaElement.prototype.pause=function(){};
        window.__originalHudButtons={};window.__originalHudHandlers={};
        new MutationObserver(()=>{for(const id of ['phoneCardMenu','phoneCompactLog']){const n=document.getElementById(id);if(n&&!window.__originalHudButtons[id]){window.__originalHudButtons[id]=n;window.__originalHudHandlers[id]=n.onclick;}}}).observe(document,{childList:true,subtree:true});
      });
      if(mode==='ios')await ctx.addInitScript({content:bundles.ios.js.toString()+`\ndocument.addEventListener('DOMContentLoaded',()=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/__qa_bundle/ios.css';document.head.append(link);},{once:true});`});
      page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push({case:label,message:e.message}));
      await page.goto(origin+'/game.html?qaBundle='+mode,{waitUntil:'load'});await setState(page,raw());
      const g=await geometry(page,label+' opponent active');report.cases.push({label,geometry:g});
      if(mode==='desktop'&&width===1366||mode==='android'&&width===740&&height===320)await screenshot(page,mode+'-'+width+'-table');
      if(mode==='android'&&width===740&&height===320&&!process.env.CARD_HUD_QA_NO_SHOTS){report.captainPreview=path.join(output,'self-captain-preview.png');await page.locator('#phoneSelfPlayer').screenshot({path:report.captainPreview});}
      await clearActions(page);await tap(page,mode,'#phoneCardMenu');await page.locator('#cardMenuChoices').waitFor({state:'visible'});check(label+' original menu opens usable controls',await page.locator('#cardMenuChoices>button').count()>0);await closeSheet(page);
      await tap(page,mode,'#phoneCompactLog');check(label+' original log opens retained logBox',await page.locator('#phoneCardSheet #logBox').count()===1&&await page.locator('#phoneCardSheet').isVisible());await closeSheet(page);await noActions(page,label+' menu and log emit no ACTION');
      await collection(page,mode,[1,7,19],label+' three cards');
      if(mode==='android'&&width===640&&height===320||mode==='ios'&&width===844)await screenshot(page,mode+'-'+width+'-collection');
      await closeSheet(page);
      for(const key of ['Enter',' ']){await page.locator('#phoneSelfPlayer').focus();await page.keyboard.press(key===' '?'Space':key);check(label+' self keyboard '+JSON.stringify(key)+' opens collection',await page.locator('.phone-deluxe-collection').isVisible());await closeSheet(page);}
      await clearActions(page);await tap(page,mode,'#phoneSelfPlayer [data-status="protected"]');check(label+' own status retains rule inspection',await page.locator('.phone-status-detail h3').innerText()==='護盾'&&await page.locator('#phoneCardSheet .phone-deluxe-collection').count()===0);await closeSheet(page);await noActions(page,label+' status emits no ACTION');
      await setState(page,raw([],0));await geometry(page,label+' self active');await collection(page,mode,[],label+' zero cards');await closeSheet(page);
      await setState(page,raw(Array.from({length:20},(_,i)=>i),0));await collection(page,mode,Array.from({length:20},(_,i)=>i),label+' full collection');
      await page.locator('.phone-deluxe-card').last().scrollIntoViewIfNeeded();check(label+' full collection scrolls without horizontal overflow',await page.locator('#phoneCardSheet .phone-card-sheet-body').evaluate(n=>n.scrollWidth<=n.clientWidth+1));await closeSheet(page);
      await setState(page,raw());await collection(page,mode,[1,7,19],label+' before viewer change');await setState(page,raw(),1);check(label+' viewer change closes previous private collection',await page.locator('#phoneCardSheet').evaluate(n=>n.hidden));await collection(page,mode,[3,18],label+' new authorized viewer');await closeSheet(page);
      await handButtons(page,mode,label);
      await setState(page,raw());await clearActions(page);await page.evaluate(()=>{showTarget('選擇目標',i=>sendAction('PICK_TARGET',{target:i}),{allowSelf:true});});await page.waitForFunction(()=>!!document.documentElement.dataset.cardDirectTargets);await tap(page,mode,'#phoneSelfPlayer .phone-seat-avatar');
      const actions=await page.evaluate(()=>window.__sent.filter(x=>x[0]==='ACTION'));check(label+' self target forwards exactly one original own ID',actions.length===1&&actions[0][1].type==='PICK_TARGET'&&actions[0][1].payload.target===0,actions);check(label+' self targeting does not open collection',await page.locator('#phoneCardSheet .phone-deluxe-collection').count()===0);
      check(label+' no browser page errors',!report.errors.some(x=>x.case===label),report.errors);save();await ctx.close();page=null;
    }
    await browser.close();browser=null;
  }
  check('tested product source bytes stayed unchanged during the suite',report.source.every(x=>sha(fs.readFileSync(path.join(root,x.file)))===x.sha256),report.source);
  report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;if(page)try{await page.screenshot({path:path.join(output,'failure.png')});report.failureScreenshot=path.join(output,'failure.png');}catch{} }
finally{await browser?.close();await new Promise(r=>server.close(r));save();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,failure:report.failure,report:path.join(output,'report.json'),screenshots:report.screenshots}));}
