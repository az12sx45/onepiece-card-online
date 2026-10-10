'use strict';
// Real shop, isolated profile fixture; no published/player transaction.
const fs=require('fs'),path=require('path');
process.env.LAUNCHER_GUESTBOOK_UI_QA_OUT='D:/Codex_QA/launcher-shop-r59/announcement';
const {setup,chromium}=require('./launcher_guestbook_danmaku_qa');
const out=process.env.LAUNCHER_GUESTBOOK_UI_QA_OUT;
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});try{
  const page=await setup(browser,{width:1440,height:900});
  await page.evaluate(()=>window.LauncherProfileShop.openShopCategory('avatar'));
  await page.locator('#shopGrid [data-item-id="ava-152"] .shop-item-image').evaluate(n=>n.click());
  await page.waitForFunction(()=>{const d=document.querySelector('#shopItemPreviewDialog'),i=d.querySelector('img');return d.open&&d.dataset.itemId==='ava-152'&&i.complete&&i.naturalWidth===735;});
  await page.locator('#shopItemPreviewDialog img').evaluate(async i=>{await i.decode();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
  await page.screenshot({path:path.join(out,'avatar-152.png')});
  console.log('Captured actual r59 shop preview');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
