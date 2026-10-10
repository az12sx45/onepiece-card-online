'use strict';
// Capture the real shop renderer with isolated data for the illustrated notice.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.LAUNCHER_GUESTBOOK_UI_QA_OUT='D:/Codex_QA/launcher-shop-r58/announcement';
const {setup,chromium}=require('./launcher_guestbook_danmaku_qa');
const out=process.env.LAUNCHER_GUESTBOOK_UI_QA_OUT;
async function main(){
  const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const page=await setup(browser,{width:1440,height:900});
    await page.evaluate(()=>{window.__guestbookQa.shop.catalog=window.__guestbookQa.shop.catalog.filter(x=>x.type==='avatar'&&x.key>=123);window.LauncherProfileShop.openShopCategory('avatar');});
    await page.waitForFunction(()=>document.querySelectorAll('#shopGrid .shop-item').length===100);
    for(const id of [128,193,222]){
      await page.locator('#shopGrid [data-item-id="ava-'+id+'"] .shop-item-image').evaluate(n=>n.click());
      await page.waitForFunction(id=>{const d=document.querySelector('#shopItemPreviewDialog'),i=d.querySelector('img');return d.open&&d.dataset.itemId==='ava-'+id&&i.complete&&i.naturalWidth===735;},id);
      await page.screenshot({path:path.join(out,'avatar-'+id+'.png')});
      await page.locator('#shopItemPreviewClose').click();
    }
    assert.equal(await page.locator('#shopGrid .shop-item').count(),100);
    console.log(JSON.stringify({status:'PASS',scope:'Actual shop renderer preview screenshots; isolated fixture; no account mutation',files:[128,193,222].map(id=>path.join(out,'avatar-'+id+'.png'))}));
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
