'use strict';
// Screenshot of the production UI with labelled-in-report demo fixtures.
// No real account is loaded and no player comments/currency are changed.
const fs = require('node:fs'), path = require('node:path');
const { setup, chromium, report } = require('./launcher_guestbook_danmaku_qa');
const out = 'D:/Codex_QA/launcher-guestbook-r56/ui';
(async () => {
  const browser = await chromium.launch({executablePath:process.env.LAUNCHER_PROFILE_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu']});
  try {
    const page = await setup(browser,{width:1440,height:1000});
    await page.evaluate(() => {
      const q=window.__guestbookQa,notes=q.shop.catalog.filter(x=>x.type==='comment_style');
      const messages=['今天的海風很舒服，下次一起出航！','釣到新魚了！下次帶你去那個釣點。','留言借我放一下：船長，記得吃飯！','新世界航海錄，今晚一起冒險。','剛剛那盤霸海戰棋太精彩了！','甲板佈置得好漂亮，坐一下再走。','路過留個紀念，祝你今天滿載而歸！','你的收藏又增加了，真想一起參觀。','海賊桌遊開桌啦，留一個位子給我！'];
      q.profiles[42].name='草帽船長';
      q.comments[42]=messages.map((body,i)=>({id:200-i,authorUserId:i%2?42:44,authorName:['草帽船長','航海士小雨','甲板上的釣手'][i%3],authorAvatar:[63,65,8][i%3],body,createdAt:Date.now()-i*60000,styleId:notes[i].id,style:notes[i]}));
      window.LauncherProfileShop.openProfile(0);
    });
    await page.waitForFunction(()=>document.querySelector('#profileGuestbookList .captain-guestbook-entry')?.dataset.commentId==='200');
    await page.evaluate(()=>document.getElementById('profileGuestbookStage').scrollIntoView({block:'center'}));
    await page.waitForTimeout(600);
    const stage=page.locator('#profileGuestbookStage');
    await stage.screenshot({path:path.join(out,'guestbook-announcement.png'),animations:'disabled'});
    await page.locator('#profileGuestbookRead').click();
    await stage.screenshot({path:path.join(out,'guestbook-reading.png'),animations:'disabled'});
    await page.locator('#profileGuestbookList .captain-guestbook-entry').first().click();
    await page.locator('#profileCommentReadDialog').screenshot({path:path.join(out,'guestbook-detail.png'),animations:'disabled'});
    await page.locator('#profileCommentReadClose').click();
    for (const tab of ['guestbook_style','comment_style']) {
      await page.evaluate(tab=>window.LauncherProfileShop.openShopCategory(tab),tab);
      await page.waitForFunction(tab=>document.querySelector('#shopGrid .shop-item')?.dataset.type===tab,tab);
      await page.locator('#shopCategoryTabs').evaluate(el=>el.scrollIntoView({block:'start'}));
      await page.waitForTimeout(250);
      await page.screenshot({path:path.join(out,'shop-'+tab+'.png'),animations:'disabled'});
    }
    await page.evaluate(() => {
      const q=window.__guestbookQa,notes=q.shop.catalog.filter(x=>x.type==='comment_style');
      q.comments[42]=notes.map((style,i)=>({id:500-i,authorUserId:42,authorName:'航海者的留言',authorAvatar:63,body:'今天的海風很舒服，下次一起出航！收藏新的回憶，留下航海的足跡。',createdAt:Date.now(),styleId:style.id,style}));
      window.LauncherProfileShop.openProfile(0);
    });
    await page.waitForFunction(()=>document.querySelector('#profileGuestbookList .captain-guestbook-entry')?.dataset.commentId==='500');
    if(await stage.getAttribute('data-reading')!=='true')await page.locator('#profileGuestbookRead').click();
    await stage.screenshot({path:path.join(out,'guestbook-all-papers.png'),animations:'disabled'});
    fs.mkdirSync(path.join(out,'paper-previews'),{recursive:true});
    const papers=page.locator('#profileGuestbookList .captain-danmaku-sequence:not(.is-duplicate) .captain-guestbook-entry');
    for(let i=0;i<await papers.count();i++){
      const paper=papers.nth(i),key=await paper.getAttribute('data-note-style');
      await paper.screenshot({path:path.join(out,'paper-previews',key+'.png'),animations:'disabled'});
    }
    await page.evaluate(() => {
      const q=window.__guestbookQa,entry=q.comments[42].find(x=>x.style.key==='sunny-pass');
      entry.body='草帽航海團的留言測試：'.repeat(24).slice(0,240);
      window.LauncherProfileShop.openProfile(0);
    });
    await page.waitForFunction(()=>document.querySelector('#profileGuestbookList [data-note-style=sunny-pass] p')?.textContent.length===240);
    await page.locator('#profileGuestbookList .captain-danmaku-sequence:not(.is-duplicate) [data-note-style=sunny-pass]').click();
    await page.locator('#profileCommentReadDialog').screenshot({path:path.join(out,'guestbook-sunny-full-text.png'),animations:'disabled'});
    const paperChecks=await page.evaluate(()=>{
      const card=document.querySelector('#profileCommentReadBody .captain-guestbook-entry'),p=card.querySelector('p'),a=card.getBoundingClientRect(),b=p.getBoundingClientRect();
      return{fullTextLength:p.textContent.length,insidePaper:b.left>=a.left&&b.right<=a.right&&b.bottom<=a.bottom,noHorizontalOverflow:card.scrollWidth===card.clientWidth};
    });
    if(paperChecks.fullTextLength!==240||!paperChecks.insidePaper||!paperChecks.noHorizontalOverflow)throw new Error('Sunny paper full-text layout failed '+JSON.stringify(paperChecks));
    fs.writeFileSync(path.join(out,'gallery-report.json'),JSON.stringify({status:'CAPTURED',scope:'Production renderer with demo comments, no formal account.',sourceHashes:report.sourceHashes,missingAssets:report.missingAssets,paperChecks,screenshots:['guestbook-announcement.png','guestbook-reading.png','guestbook-detail.png','shop-guestbook_style.png','shop-comment_style.png','guestbook-all-papers.png','guestbook-sunny-full-text.png']},null,2));
    console.log('Captured guestbook, reading and detail screenshots.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
