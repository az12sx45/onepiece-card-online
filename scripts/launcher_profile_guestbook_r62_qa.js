'use strict';
// r62 real-renderer profile and guestbook regression with isolated preload fixtures.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = process.env.LAUNCHER_PROFILE_GUESTBOOK_R62_QA_ROOT || path.resolve(__dirname,'..');
const out = process.env.LAUNCHER_PROFILE_GUESTBOOK_R62_QA_OUT || 'D:/Codex_QA/launcher-profile-r62/renderer';
fs.mkdirSync(out,{recursive:true});
process.env.LAUNCHER_GUESTBOOK_UI_QA_OUT = out+'/fixture';
const fixture = require(root+'/scripts/launcher_guestbook_danmaku_qa.js');
const S = require(root+'/server/launcher-profile-shop');
const report={status:'RUNNING',scope:'Actual launcher HTML/CSS/renderer with isolated mocked preload. No real player mutations.',checks:[],errors:[],screenshots:[],sourceHashes:{}};
for(const file of ['desktop/launcher.html','desktop/launcher-profile-shop.css','desktop/launcher-profile-shop.js'])report.sourceHashes[file]=crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex');
const save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
const check=(name,pass,details)=>{report.checks.push({name,pass:!!pass,...(details===undefined?{}:{details})});save();};
const cfg={open:'#profileGuestbookCompose',dialog:'#profileCommentComposeDialog',close:'#profileCommentComposeClose',noteButtons:'#profileCommentPaperGrid .captain-paper-choice[data-style-id]'};
const noteButtons=cfg.noteButtons;
const boards=S.CATALOG.filter(x=>x.type==='guestbook_style'),notes=S.CATALOG.filter(x=>x.type==='comment_style');
const ownIds=S.CATALOG.map(x=>x.id);
const makeOwner=backgroundId=>S.toPublicProfile({user_id:42,name:'資深航海王迷',avatar:'8',stats:{launcherWalletV1:{coins:500},launcherOwnedV1:{items:ownIds},launcherAppearanceV1:{avatarId:222,backgroundId,decorations:{header:'decor-header-chopper',side:'decor-side-zoro',footer:'decor-footer-robin'},decorationPlacement:{header:{x:90,y:10,scale:1},side:{x:90,y:50,scale:1},footer:{x:90,y:90,scale:1}},guestbookStyleId:boards[0].id,commentStyleId:notes[0].id},client:{social:{friends:[44]}}}},true);
const box=async locator=>locator.evaluate(n=>n.getBoundingClientRect().toJSON());
async function shot(page,label){const file=out+'/'+label+'.png';await page.screenshot({path:file});report.screenshots.push(file);save();}
async function restoreOwner(page,profile){await page.evaluate(p=>{window.__guestbookQa.profiles[42]=p;window.LauncherProfileShop.openProfile(0);},profile);await page.waitForFunction(()=>document.getElementById('profileHeroName').textContent==='資深航海王迷');}
async function openComposer(page){await page.locator(cfg.open).click();await page.waitForFunction(selector=>document.querySelector(selector)?.open,cfg.dialog);}
async function closeComposer(page){await page.locator(cfg.close).click();await page.waitForFunction(selector=>!document.querySelector(selector)?.open,cfg.dialog);}
async function reloadComments(page,entries){await page.evaluate(entries=>{window.__guestbookQa.comments[42]=entries;window.LauncherProfileShop.openProfile(0);},entries);await page.waitForFunction(count=>document.querySelectorAll('#profileGuestbookList .captain-danmaku-sequence:not(.is-duplicate) .captain-guestbook-entry').length===count,entries.length);}
async function runViewport(browser,vp){
 const label=vp.width+'x'+vp.height, page=await fixture.setup(browser,vp);page.setDefaultTimeout(10000);
 try{
  const originalComments=await page.evaluate(()=>structuredClone(window.__guestbookQa.comments[42]));
  await page.locator('#profileHero').scrollIntoViewIfNeeded();
  const main=await box(page.locator('#profileHero'));
  check(label+' main card compact',main.width<=1002&&main.height<=282,main);
  await shot(page,label+'-default-profile');
  await page.locator('#profileCardEdit').click();
  const preview=await box(page.locator('.captain-card-preview'));
  check(label+' main and preview composition ratio match',Math.abs(preview.width/preview.height-main.width/main.height)/(main.width/main.height)<.05,{main,preview});
  await page.locator('#profileCardName').fill('未儲存的名稱');
  check(label+' card preview immediately follows text',await page.locator('.captain-card-preview .captain-hero-copy h3').textContent()==='未儲存的名稱');
  await page.locator('#profileCardAvatarChoose').click();
  await page.locator('#avatarPickerGrid [data-avatar-id="221"]').click();
  await page.locator('#avatarPickerApply').click();
  await page.waitForFunction(()=>!document.getElementById('avatarPickerDialog').open);
  check(label+' avatar choice updates draft preview',/221\.webp$/.test(await page.locator('.captain-card-preview .captain-hero-avatar > img').getAttribute('src')));
  await page.locator('#profileCardCancel').click();
  check(label+' cancelling card avoids mutation',await page.evaluate(()=>!window.__guestbookQa.calls.some(x=>x[0]==='command'&&x[1].payload.operation==='card.set')));
  check(label+' cancelled name does not leak to profile',await page.locator('#profileHeroName').textContent()!=='未儲存的名稱');
  const paid=makeOwner('background-luffy');await restoreOwner(page,paid);
  await page.waitForFunction(()=>document.getElementById('profileHero').classList.contains('has-card-art'));
  await page.locator('#profileHero').scrollIntoViewIfNeeded();await shot(page,label+'-paid-profile');
  const art=await page.locator('#profileHeroArt').evaluate(n=>({rect:n.getBoundingClientRect().toJSON(),size:getComputedStyle(n).backgroundSize,radius:getComputedStyle(n).borderRadius,border:getComputedStyle(n).borderWidth,shadow:getComputedStyle(n).boxShadow}));
  check(label+' paid background uses full image containment',art.size.split(',').some(x=>x.trim()==='contain'),art);
  check(label+' paid card keeps three decorations',await page.locator('#profileHeroStickers img').count()===3);
  await page.locator('#profileCardEdit').click();await shot(page,label+'-paid-editor');
  const paidMain=await box(page.locator('#profileHero')),paidPreview=await box(page.locator('.captain-card-preview'));
  check(label+' paid preview matches main ratio',Math.abs(paidMain.width/paidMain.height-paidPreview.width/paidPreview.height)/(paidMain.width/paidMain.height)<.05,{paidMain,paidPreview});
  await page.locator('#profileCardClose').click();
  const stage=page.locator('#profileGuestbookStage');await stage.scrollIntoViewIfNeeded();await page.mouse.move(1,1);
  const st=await box(stage);check(label+' guestbook stays compact',st.width<=842&&st.height<=482,st);
  check(label+' no unnecessary earlier-message button',await page.locator('#profileGuestbookMore').isHidden());
  check(label+' catalog retains 10 boards and 20 stationery designs',boards.length===10&&notes.length===20,{boards:boards.length,notes:notes.length});
  const track=page.locator('.captain-danmaku-track').first();
  const x=()=>track.evaluate(n=>new DOMMatrixReadOnly(getComputedStyle(n).transform).m41);
  await page.waitForTimeout(120);const x1=await x();await page.waitForTimeout(280);const x2=await x();
  check(label+' danmaku actually moves',Math.abs(x2-x1)>3,{x1,x2});
  await page.locator('#profileGuestbookMotion').click();const pause1=await x();await page.waitForTimeout(150);check(label+' pause button stops movement',Math.abs(await x()-pause1)<.3);
  await page.locator('#profileGuestbookMotion').click();
  await page.locator('#profileGuestbookRead').click();
  check(label+' reading mode stops and hides duplicate notes',await stage.getAttribute('data-reading')==='true'&&await track.evaluate(n=>getComputedStyle(n).animationName==='none')&&await page.locator('.is-duplicate').first().isHidden());
  check(label+' stored XSS strings remain inert text',await page.evaluate(()=>!window.__xss&&!document.querySelector('#profileGuestbookList script,#profileGuestbookList p img')));
  await page.locator('[data-comment-id="100"]').first().click();
  check(label+' full reader preserves long stored text',await page.locator('#profileCommentReadBody p').textContent()===originalComments[0].body);
  await shot(page,label+'-full-note-reader');
  check(label+' owner can moderate friend message',await page.locator('#profileCommentReadBody button').count()===1);
  await page.locator('#profileCommentReadBody button').click();await page.locator('#profileCommentDeleteCancel').click();
  check(label+' delete cancellation sends no mutation',await page.evaluate(()=>window.__guestbookQa.calls.filter(x=>x[0]==='delete').length===0));
  await page.locator('#profileCommentReadClose').click();await page.locator('#profileGuestbookRead').click();
  await stage.scrollIntoViewIfNeeded();await page.mouse.move(1,1);await shot(page,label+'-guestbook');
  await openComposer(page);
  check(label+' composer fits viewport',await page.locator(cfg.dialog).evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}));
  check(label+' all owned stationery plus default are visible choices',await page.locator(noteButtons).count()===21,await page.locator(noteButtons).count());
  const paperGeometry=await page.locator(noteButtons).evaluateAll(nodes=>nodes.map(n=>{const b=n.getBoundingClientRect(),art=n.firstElementChild.getBoundingClientRect(),label=n.lastElementChild.getBoundingClientRect();return{id:n.dataset.styleId,card:b.toJSON(),art:art.toJSON(),label:label.toJSON(),fits:art.bottom<=b.bottom+1&&label.bottom<=b.bottom+1&&art.top>=b.top-1&&label.top>=art.bottom-1};}));
  check(label+' stationery thumbnails and names fit each choice',paperGeometry.every(x=>x.fits),paperGeometry.filter(x=>!x.fits));
  await page.locator(noteButtons+'[data-style-id="'+notes[6].id+'"]').click();
  check(label+' clicking a paper thumbnail selects it',await page.locator(noteButtons+'[data-style-id="'+notes[6].id+'"]').getAttribute('aria-pressed')==='true'&&await page.locator('#profileCommentStyle').inputValue()===notes[6].id);
  const input=page.locator('#profileGuestbookInput');await input.fill('');await input.pressSequentially('航'.repeat(250),{delay:0});
  check(label+' input enforces 240-character maximum',(await input.inputValue()).length===240);
  await input.fill('今天一起出航！<img src=x onerror="window.__xss=1">');
  check(label+' paper preview follows typed message',await page.locator('#profileCommentPreview #profileGuestbookInput').inputValue().then(t=>t.includes('今天一起出航！')));
  check(label+' preview XSS stays inert',await page.evaluate(()=>!window.__xss&&!document.querySelector('#profileCommentPreview script,#profileCommentPreview p img')));
  await shot(page,label+'-composer');
  await closeComposer(page);
  check(label+' cancelling composer does not post',await page.evaluate(()=>!window.__guestbookQa.calls.some(x=>x[0]==='command'&&x[1].payload.operation==='comment.post')));
  await page.evaluate(()=>window.LauncherProfileShop.openProfile(44));await page.waitForFunction(()=>document.getElementById('profileGuestbookTheme').textContent==='梅利號航海日誌');
  check(label+' friend card has no edit actions',await page.locator('#profileCardEdit').isHidden()&&await page.locator('#profileAvatarEdit').isHidden());
  await page.locator('#profileGuestbookRead').click();await page.locator('[data-comment-id="100"]').first().click();
  check(label+' visitor cannot delete another author',await page.locator('#profileCommentReadBody button').count()===0);await page.locator('#profileCommentReadClose').click();
  await page.locator('[data-comment-id="99"]').first().click();check(label+' visitor can delete own note',await page.locator('#profileCommentReadBody button').count()===1);await page.locator('#profileCommentReadClose').click();
  await openComposer(page);await input.fill('給好友的考古學家便條 🚢');
  await page.locator('#profileCommentStyle').selectOption(notes[6].id,{force:true});
  await page.evaluate(()=>{window.__guestbookQa.deferPost=true;document.getElementById('profileGuestbookPost').click();document.getElementById('profileGuestbookPost').click();});
  await page.waitForFunction(()=>window.__guestbookQa.postResolvers.length===1);
  const posts=await page.evaluate(()=>window.__guestbookQa.calls.filter(x=>x[0]==='command'&&x[1].payload.operation==='comment.post'));
  check(label+' double submit creates only one post',posts.length===1);
  check(label+' post captures friend and selected owned paper',posts[0]?.[1].payload.userId===44&&posts[0]?.[1].payload.styleId===notes[6].id,posts.map(x=>({userId:x[1].payload.userId,styleId:x[1].payload.styleId})));
  await page.evaluate(()=>{window.__guestbookQa.deferPost=false;window.__guestbookQa.postResolvers.shift()();});
  await page.waitForFunction(()=>document.querySelector('#profileGuestbookList [data-comment-id="101"]'));
  if(await page.locator(cfg.dialog).evaluate(n=>n.open))await closeComposer(page);
  await page.locator('[data-comment-id="101"]').first().click();await page.locator('#profileCommentReadBody button').click();await page.locator('#profileCommentDeleteConfirm').click();await page.waitForFunction(()=>!document.querySelector('#profileGuestbookList [data-comment-id="101"]'));
  check(label+' delete removes all duplicate copies',await page.locator('#profileGuestbookList [data-comment-id="101"]').count()===0);
  await restoreOwner(page,paid);
  if(await stage.getAttribute('data-reading')==='true')await page.locator('#profileGuestbookRead').click();
  await reloadComments(page,[]);check(label+' empty board shows meaningful state',await page.locator('.captain-guestbook-empty').count()===1);await stage.scrollIntoViewIfNeeded();await shot(page,label+'-empty');
  await reloadComments(page,[originalComments[3]]);check(label+' single-note board has one canonical note',await page.locator('.captain-danmaku-sequence:not(.is-duplicate) .captain-guestbook-entry').count()===1);await stage.scrollIntoViewIfNeeded();await shot(page,label+'-single');
  await reloadComments(page,originalComments);await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.getElementById('profileGuestbookStage').dataset.reading==='true');check(label+' reduced motion opens static reading',await stage.getAttribute('data-reading')==='true');
  check(label+' no page horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }catch(e){report.errors.push({label,error:e.stack||String(e)});await shot(page,label+'-failure').catch(()=>{});save();}
 finally{await page.close();}
}
(async()=>{save();const browser=await fixture.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-gpu','--disable-background-timer-throttling']});try{for(const vp of [{width:1440,height:900},{width:960,height:640}])await runViewport(browser,vp);}finally{await browser.close();}
 report.rendererErrors=fixture.report.errors;report.missingAssets=fixture.report.missingAssets;
 check('all local fixture assets resolve',!report.missingAssets.length,report.missingAssets);
 check('no uncaught renderer errors',!report.rendererErrors.length,report.rendererErrors);
 report.sourceChangedDuringRun=Object.entries(report.sourceHashes).some(([file,sha])=>sha!==crypto.createHash('sha256').update(fs.readFileSync(root+'/'+file)).digest('hex'));
 check('source stable during independent audit',!report.sourceChangedDuringRun);
 report.status=!report.errors.length&&report.checks.every(x=>x.pass)?'PASS':'FAIL';save();console.log(JSON.stringify({status:report.status,checks:report.checks.length,failed:report.checks.filter(x=>!x.pass).map(x=>x.name),errors:report.errors,report:out+'/report.json'},null,2));if(report.status!=='PASS')process.exitCode=1;
})().catch(e=>{report.status='FAIL';report.errors.push({error:e.stack||String(e)});save();console.error(e);process.exitCode=1;});
