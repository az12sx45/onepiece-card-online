'use strict';

// Actual launcher markup, styles, and renderer with an isolated preload fixture.
// Server mutations are covered separately by launcher_guestbook_styles_qa.js.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const S = require('../server/launcher-profile-shop');
const runtimeRoot = 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node';
const bundled = fs.existsSync(runtimeRoot) && fs.readdirSync(runtimeRoot).map(x => path.join(runtimeRoot,x,'bin/node_modules/playwright')).find(x => fs.existsSync(path.join(x,'package.json')));
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || bundled || 'playwright');
const root = path.resolve(__dirname,'..');
const out = process.env.LAUNCHER_GUESTBOOK_UI_QA_OUT || 'D:/Codex_QA/launcher-shop-r58/guestbook-regression';
const styleNames = ['launcher.css','launcher-social.css','launcher-profile-shop.css','launcher-room.css','launcher-room-ambience.css','launcher-room-aquarium.css','launcher-room-minigames.css','launcher-announcements.css'];
const inputs = ['launcher.html',...styleNames,'launcher-profile-shop.js','launcher-social.js'];
const sources = Object.fromEntries(inputs.map(name => [name,fs.readFileSync(path.join(root,'desktop',name),'utf8')]));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const report = { status:'RUNNING', scope:'Real launcher renderer in Chromium with mocked preload; no real account, server or currency mutation.', checks:[], missingAssets:[], errors:[], screenshots:[], sourceHashes:Object.fromEntries(inputs.map(name=>[name,hash(sources[name])])) };
fs.mkdirSync(out,{recursive:true});
const save = () => fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const check = (name,pass,detail) => {report.checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});save();assert.ok(pass,name+(detail===undefined?'':': '+JSON.stringify(detail)));};
const boards=S.CATALOG.filter(x=>x.type==='guestbook_style'),notes=S.CATALOG.filter(x=>x.type==='comment_style'),newAvatars=S.CATALOG.filter(x=>x.type==='avatar'&&x.key>=63);
const ownIds=[...boards,...notes,...newAvatars].map(x=>x.id);
const mkRow=(id,name,own,appearance)=>({user_id:id,name,avatar:'8',stats:{launcherWalletV1:{coins:500,lastGrantDay:new Date().toISOString().slice(0,10)},launcherOwnedV1:{items:own},launcherAppearanceV1:appearance,client:{social:{friends:[42,44]}}}});
const ownerRow=mkRow(42,'測試船長',ownIds,{avatarId:222,guestbookStyleId:boards[0].id,commentStyleId:notes[0].id});
const friendRow=mkRow(44,'好友航海士',[boards[1].id,'ava-63'],{avatarId:63,guestbookStyleId:boards[1].id});
const fullBody='航'.repeat(240)+'🚢😊';
const comments=[
  {id:100,authorUserId:44,authorName:'好友航海士',authorAvatar:63,body:fullBody,createdAt:1780000000000,styleId:notes[0].id,style:notes[0]},
  {id:99,authorUserId:42,authorName:'測試船長',authorAvatar:222,body:'<img src=x onerror="window.__xss=1"> 航程順利！',createdAt:1780000000000,styleId:notes[1].id,style:notes[1]},
  {id:98,authorUserId:44,authorName:'<script>window.__xss=2</script>',authorAvatar:63,body:'舊版素紙留言',createdAt:1780000000000},
  ...Array.from({length:6},(_,i)=>({id:97-i,authorUserId:i%2?42:44,authorName:i%2?'測試船長':'好友航海士',authorAvatar:i%2?222:63,body:['一起在甲板吹海風！','今天釣到最大的魚了！','下次一起挑戰霸海戰棋！'][i%3],createdAt:1780000000000,styleId:notes[i+2].id,style:notes[i+2]}))
];
const blankPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZnwAAAABJRU5ErkJggg==','base64');

async function setup(browser,viewport){
  const page=await browser.newPage({viewport});
  await page.emulateMedia({reducedMotion:'no-preference'});
  page.setDefaultTimeout(12000);
  page.on('pageerror',error=>report.errors.push({viewport,error:error.stack||error.message}));
  await page.route('opui://**',route=>{
    const relative=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');
    const target=path.resolve(root,'public',relative);
    if(target.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(target))return route.fulfill({path:target});
    if(!report.missingAssets.includes(relative))report.missingAssets.push(relative);
    return route.fulfill({contentType:'image/png',body:blankPng});
  });
  const html=sources['launcher.html'].replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/i,'').replace(/<link[^>]+rel="stylesheet"[^>]*>/gi,'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<body data-stage="boot">','<body data-stage="app">').replace('<main class="launcher-app screen" id="launcherApp" hidden>','<main class="launcher-app screen is-active" id="launcherApp">');
  await page.route('http://127.0.0.1/guestbook-qa',route=>route.fulfill({contentType:'text/html',body:html}));
  await page.goto('http://127.0.0.1/guestbook-qa',{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:styleNames.map(name=>sources[name]).join('\n')});
  await page.evaluate(({mine,friend,shop,comments})=>{
    document.getElementById('bootScreen').hidden=true;document.getElementById('bootScreen').classList.remove('is-active');
    const copy=x=>structuredClone(x);
    const qa=window.__guestbookQa={profiles:{42:mine,44:friend},shop,comments:{42:copy(comments),44:copy(comments)},calls:[],deferPost:false,postResolvers:[],replays:{},nextId:101,socialAccount:42,deferAvatars:false,avatarResolvers:[]};
    window.onePieceDesktop={
      async getLauncherProfile(id=0){qa.calls.push(['profile',id]);return{ok:true,profile:copy(qa.profiles[id||42])};},
      async getLauncherShop(){qa.calls.push(['shop']);return{ok:true,shop:copy(qa.shop)};},
      async getLauncherComments(id=0){qa.calls.push(['comments',id]);return{ok:true,enabled:true,ownerUserId:id||42,comments:copy(qa.comments[id||42]),hasMore:false,nextBeforeId:null};},
      async deleteLauncherComment(id){qa.calls.push(['delete',id]);for(const list of Object.values(qa.comments)){const index=list.findIndex(x=>x.id===id);if(index>=0)list.splice(index,1);}return{ok:true,messageId:id};},
      async saveLauncherCard(card){qa.calls.push(['legacy-card',copy(card)]);qa.profiles[42].card=copy(card);return{ok:true,profile:copy(qa.profiles[42]),shop:copy(qa.shop)};},
      async commandLauncherLife(c){
        qa.calls.push(['command',copy(c)]);const p=c.payload;
        if(p.scope!=='launcher-profile-v1'||c.type!=='event.record')return{ok:false,error:'invalid_profile_command'};
        if(p.operation==='social.avatars'){const owner=qa.socialAccount;if(qa.deferAvatars)await new Promise(resolve=>qa.avatarResolvers.push(resolve));return{ok:true,avatars:[{userId:44,avatar:owner===42?222:63}]};}
        if(p.operation==='comment.post'){
          if(qa.deferPost)await new Promise(resolve=>qa.postResolvers.push(resolve));
          if(qa.replays[c.requestId])return{ok:true,comment:copy(qa.replays[c.requestId]),duplicate:true};
          const style=qa.shop.catalog.find(x=>x.id===p.styleId)||{id:'comment-style-default',name:'素紙便條'};
          const entry={id:qa.nextId++,authorUserId:42,authorName:'測試船長',authorAvatar:222,body:p.body,createdAt:Date.now(),styleId:style.id,style};
          qa.comments[p.userId||42].unshift(entry);qa.replays[c.requestId]=entry;return{ok:true,comment:copy(entry)};
        }
        if(p.operation==='card.set'){qa.profiles[42].card=copy(p.card);return{ok:true,profile:copy(qa.profiles[42]),shop:copy(qa.shop)};}
        const item=qa.shop.catalog.find(x=>x.id===p.itemId);
        if(p.operation==='shop.buy'){
          const key=item.type==='comment_style'?'commentStyles':item.type==='guestbook_style'?'guestbookStyles':'avatars';qa.shop.owned[key].push(item.type==='avatar'?item.key:item.id);qa.shop.wallet.coins-=item.price;
        }else if(p.operation==='shop.equip'){
          const key=item?.type==='comment_style'||p.itemId==='comment-style-default'?'commentStyleId':item?.type==='guestbook_style'||p.itemId==='guestbook-style-default'?'guestbookStyleId':'avatar';
          const value=key==='avatar'?item.key:p.itemId;qa.shop.equipped[key]=value;
          if(key==='avatar')qa.profiles[42].avatar=value;else{qa.profiles[42].appearance[key]=value;qa.profiles[42].appearanceItems[key==='guestbookStyleId'?'guestbookStyle':'commentStyle']=item||null;}
        }
        return{ok:true,profile:copy(qa.profiles[42]),shop:copy(qa.shop)};
      },
      onSocialState(fn){qa.socialListener=fn;},
      async getSocialState(){return{ok:true,state:{userId:qa.socialAccount,ready:true,friends:[{userId:44,name:'好友航海士',avatar:8,online:true,page:'desktop-launcher'}],requestsIn:[],requestsOut:[],unread:{},conversations:{}}};},
      async socialRequest(){return{ok:true};}
    };
    window.launcherSwitchPanel=panel=>{
      for(const id of ['library','downloads','social','profile','shop'])document.getElementById(id+'Panel').hidden=id!==panel;
      document.querySelectorAll('.nav-button[data-panel]').forEach(b=>b.classList.toggle('is-active',b.dataset.panel===panel));
      window.LauncherProfileShop?.onVisible(panel);
    };
  },{mine:S.toPublicProfile(ownerRow,true),friend:S.toPublicProfile(friendRow,false),shop:S.toShop(ownerRow),comments});
  await page.addScriptTag({content:sources['launcher-profile-shop.js']});
  await page.addScriptTag({content:sources['launcher-social.js']});
  await page.evaluate(()=>{window.LauncherProfileShop.setAccount({authenticated:true,profile:{userId:42,name:'測試船長'}});window.LauncherProfileShop.openProfile(0);});
  await page.waitForFunction(()=>document.querySelectorAll('#profileGuestbookList .captain-guestbook-entry').length>=18&&document.getElementById('profileCommentStyle').options.length===21);
  return page;
}

async function main(){
  const executablePath=process.env.LAUNCHER_PROFILE_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';
  save();console.log('Launching isolated guestbook renderer');
  const browser=await chromium.launch({headless:true,executablePath,args:['--disable-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  try{
    for(const viewport of [{width:1440,height:900},{width:960,height:640}]){
      console.log('Checking '+viewport.width+'x'+viewport.height);
      const page=await setup(browser,viewport),label=viewport.width+'x'+viewport.height;
      const stage=page.locator('#profileGuestbookStage'),track=page.locator('.captain-danmaku-track').first();
      await stage.evaluate(n=>n.scrollIntoView({block:'center'}));await page.mouse.move(0,0);
      const x=()=>track.evaluate(n=>new DOMMatrixReadOnly(getComputedStyle(n).transform).m41);
      await page.waitForTimeout(650);const before=await x();await page.waitForTimeout(300);const after=await x();
      check(label+' real marquee moves horizontally',Math.abs(after-before)>3,{before,after,view:await track.evaluate(n=>({animation:getComputedStyle(n).animation,animations:n.getAnimations().map(a=>({currentTime:a.currentTime,startTime:a.startTime,playState:a.playState,pending:a.pending})),timeline:document.timeline.currentTime,ready:document.readyState,stage:{...document.getElementById('profileGuestbookStage').dataset},visible:document.visibilityState,reduce:matchMedia('(prefers-reduced-motion: reduce)').matches,rect:document.getElementById('profileGuestbookStage').getBoundingClientRect().toJSON()}))});
      const firstBox=await track.locator('.captain-guestbook-entry').first().boundingBox();await page.mouse.move(Math.max(1,firstBox.x+firstBox.width/2),Math.max(1,firstBox.y+firstBox.height/2));await page.waitForTimeout(90);const paused=await x();await page.waitForTimeout(220);
      check(label+' hovering a note pauses movement',Math.abs((await x())-paused)<.1);
      check(label+' board art from owner and all 20 purchased notes',await stage.evaluate(n=>n.style.getPropertyValue('--board-art').includes('sunny-deck.webp'))&&await page.locator('#profileCommentStyle option').count()===21);
      check(label+' legacy plain note has no paid art',await page.locator('[data-comment-id="98"]').first().evaluate(n=>!n.classList.contains('has-note-art')));
      check(label+' XSS remains text without inserted executable nodes',await page.evaluate(()=>!window.__xss&&document.querySelectorAll('#profileGuestbookList p img,#profileGuestbookList script').length===0));
      await page.locator('[data-comment-id="100"]').first().click();
      check(label+' full comment preserves 240 characters plus emoji',await page.locator('#profileCommentReadBody p').textContent()===fullBody);
      check(label+' owner can moderate friend note',await page.locator('#profileCommentReadBody button').count()===1);
      check(label+' full reader fits viewport width',await page.locator('#profileCommentReadDialog').evaluate(n=>{const b=n.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth;}));
      await page.locator('#profileCommentReadClose').click();
      await page.locator('#profileGuestbookRead').click();
      check(label+' reading mode stops animations and hides duplicate copies',await stage.getAttribute('data-reading')==='true'&&await track.evaluate(n=>getComputedStyle(n).animationName==='none')&&await page.locator('.is-duplicate').first().isHidden());
      await page.locator('#profileGuestbookRead').click();
      await stage.evaluate(n=>n.scrollIntoView({block:'center'}));await page.mouse.move(0,0);
      const screen=path.join(out,label+'-guestbook.png');await stage.screenshot({path:screen});report.screenshots.push(screen);
      check(label+' document has no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));

      await page.evaluate(()=>window.LauncherProfileShop.openProfile(44));
      await page.waitForFunction(()=>document.getElementById('profileGuestbookTheme').textContent==='梅利號航海日誌');
      await page.locator('#profileGuestbookRead').click();
      await page.locator('[data-comment-id="100"]').first().click();
      check(label+' visitor cannot delete another author on friend board',await page.locator('#profileCommentReadBody button').count()===0);
      await page.locator('#profileCommentReadClose').click();await page.locator('[data-comment-id="99"]').first().click();
      check(label+' visitor may delete own note',await page.locator('#profileCommentReadBody button').count()===1);
      await page.locator('#profileCommentReadClose').click();
      await page.locator('#profileCommentStyle').selectOption(notes[6].id);
      await page.locator('#profileGuestbookInput').fill('給好友的考古學家便條 🚢');
      await page.evaluate(()=>{window.__guestbookQa.deferPost=true;document.getElementById('profileGuestbookPost').click();document.getElementById('profileGuestbookPost').click();});
      await page.waitForFunction(()=>window.__guestbookQa.postResolvers.length===1);
      check(label+' double submit sends exactly one bridged post',await page.evaluate(()=>window.__guestbookQa.calls.filter(x=>x[0]==='command'&&x[1].payload.operation==='comment.post').length===1));
      const post=await page.evaluate(()=>window.__guestbookQa.calls.find(x=>x[0]==='command'&&x[1].payload.operation==='comment.post')[1]);
      check(label+' post captures target and selected owned stationery',post.payload.userId===44&&post.payload.styleId===notes[6].id&&post.expectedRevision===0&&/^[a-zA-Z0-9_-]{8,100}$/.test(post.requestId));
      await page.evaluate(()=>{window.__guestbookQa.deferPost=false;window.__guestbookQa.postResolvers.shift()();});
      await page.waitForFunction(()=>document.getElementById('profileGuestbookList').textContent.includes('給好友的考古學家便條'));
      await page.locator('#profileCommentStyle').selectOption(notes[2].id);
      check(label+' posted note keeps snapshot after composer style change',await page.locator('[data-comment-id="101"]').first().evaluate(n=>n.style.getPropertyValue('--note-art').includes('robin-rubbing.webp')));
      await page.locator('[data-comment-id="101"]').first().click();await page.locator('#profileCommentReadBody button').click();await page.locator('#profileCommentDeleteConfirm').click();
      await page.waitForFunction(()=>!document.querySelector('#profileGuestbookList [data-comment-id="101"]'));
      check(label+' deleting own comment removes all marquee copies',await page.locator('#profileGuestbookList [data-comment-id="101"]').count()===0);

      for(const [tab,count] of [['guestbook_style',10],['comment_style',20],['avatar',192]]){
        await page.evaluate(tab=>window.LauncherProfileShop.openShopCategory(tab),tab);await page.waitForFunction(count=>document.querySelectorAll('#shopGrid .shop-item').length===count,count);
        check(label+' shop category '+tab+' complete',await page.locator('#shopGrid .shop-item').count()===count);
      }
      check(label+' all 160 extended avatars appear in shop',await page.locator('#shopGrid .shop-item').evaluateAll(nodes=>nodes.filter(n=>Number(n.dataset.itemId.slice(4))>=63).length)===160);
      await page.evaluate(()=>window.LauncherProfileShop.openProfile(0));await page.waitForFunction(()=>!document.getElementById('profileCardEdit').hidden);
      await page.locator('#profileCardEdit').click();await page.locator('#profileCardAvatar').selectOption('222');await page.locator('#profileCardName').fill('羅賓航海者');await page.locator('#profileCardSave').click();
      await page.waitForFunction(()=>window.__guestbookQa.calls.some(x=>x[0]==='command'&&x[1].payload.operation==='card.set'));
      check(label+' avatar 222 card saves through compatibility bridge',await page.evaluate(()=>window.__guestbookQa.calls.some(x=>x[0]==='command'&&x[1].payload.operation==='card.set'&&x[1].payload.card.avatarId===222)));
      await page.emulateMedia({reducedMotion:'reduce'});
      check(label+' reduced motion switches to reading mode',await stage.getAttribute('data-reading')==='true');
      await page.evaluate(()=>{window.LauncherSocial.setAccount({authenticated:true,profile:{userId:42}});window.launcherSwitchPanel('social');});
      await page.waitForFunction(()=>document.querySelector('#socialFriendsList img')?.src.endsWith('/222.webp'));
      check(label+' old core avatar 8 is replaced by social projection 222',await page.locator('#socialFriendsList img').getAttribute('src')==='opui://launcher/images/board/avatars/222.webp');
      await page.evaluate(()=>{window.__guestbookQa.deferAvatars=true;document.getElementById('socialRefresh').click();});
      await page.waitForFunction(()=>window.__guestbookQa.avatarResolvers.length===1);
      await page.evaluate(()=>{window.__guestbookQa.socialAccount=45;window.__guestbookQa.deferAvatars=false;window.LauncherSocial.setAccount({authenticated:true,profile:{userId:45}});});
      await page.waitForFunction(()=>document.querySelector('#socialFriendsList img')?.src.endsWith('/63.webp'));
      await page.evaluate(()=>window.__guestbookQa.avatarResolvers.shift()());await page.waitForTimeout(60);
      check(label+' old account delayed avatar cannot overwrite new account',await page.locator('#socialFriendsList img').getAttribute('src')==='opui://launcher/images/board/avatars/63.webp');
      check(label+' no uncaught renderer errors',!report.errors.some(x=>x.viewport.width===viewport.width),report.errors);
      await page.close();
    }
    report.missingAssets=[...new Set(report.missingAssets)];
    if(process.env.LAUNCHER_GUESTBOOK_REQUIRE_ASSETS==='1')check('all requested local assets exist',report.missingAssets.length===0,report.missingAssets);
    report.assetVerification=process.env.LAUNCHER_GUESTBOOK_REQUIRE_ASSETS==='1'?'required':'pending_generation_missing_logged';
    report.sourceChangedDuringRun=inputs.some(name=>report.sourceHashes[name]!==hash(fs.readFileSync(path.join(root,'desktop',name),'utf8')));
    report.status='PASS';save();console.log(JSON.stringify({status:report.status,checks:report.checks.length,missingAssets:report.missingAssets.length,sourceChangedDuringRun:report.sourceChangedDuringRun,report:path.join(out,'report.json')},null,2));
  }finally{await browser.close();}
}
module.exports = { setup, chromium, report };
if (require.main === module) main().catch(error=>{report.status='FAIL';report.failure=error.stack||error.message;save();console.error(error);process.exitCode=1;});
