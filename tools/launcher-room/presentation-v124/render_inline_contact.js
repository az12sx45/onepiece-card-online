'use strict';
const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/13827bafdc0b5422/bin/node_modules/playwright');
const root=path.resolve(__dirname,'../../..');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
const page=await browser.newPage({viewport:{width:960,height:360}});
await page.setContent('<html><head><meta charset="utf-8"></head><body><div id="sample"></div></body></html>');
await page.addStyleTag({content:fs.readFileSync(path.join(root,'desktop/launcher-room.css'),'utf8')+'\nbody{margin:0;font-family:Arial;background:#08232c;color:#eed9ac} #sample{width:960px;height:360px;background:linear-gradient(#08232c 0 50%,#b58b50 50% 100%)} .contact-label{position:absolute;top:128px;width:130px;text-align:center;font-size:13px}'});
await page.evaluate(()=>{const root=document.getElementById('sample');const icons=[['roomCompanionTalk','CHAT'],['roomLifeWork','WORK'],['roomLifeCall','CALL'],['roomLifeGift','GIFT'],['roomLifeTrain','TRAIN'],['roomLifeStatus','DETAILS']];
for(let row=0;row<2;row++)for(let i=0;i<icons.length;i++){const wrap=document.createElement('div');wrap.className='room-companion-actions';const b=document.createElement('button');b.id=icons[i][0];b.style.left=(54+i*154)+'px';b.style.top=(55+row*180)+'px';if(i===0)b.className='is-wheel-current';wrap.append(b);root.append(wrap);const label=document.createElement('span');label.className='contact-label';label.style.left=(16+i*154)+'px';label.style.top=(125+row*180)+'px';label.textContent=icons[i][1];root.append(label);}});
await page.screenshot({path:path.join(__dirname,'review-evidence/icons-contact.png')});console.log('Rendered the six production inline SVG controls on dark sea and warm floor colors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
