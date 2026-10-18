'use strict';
// Read-only browser acceptance. Installer clicks are intercepted before any bytes download.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT);
const base = process.argv[2] || 'http://127.0.0.1:18938';
const out = process.argv[3];
const channel = 'https://game-assets.rihdi.tw/android/launcher-release-v1.json';
const fallback = 'https://game-assets.rihdi.tw/android/releases/26/PIRATE-ODYSSEY-v026-f63d2654a4db.apk';
const windowsFallback = 'https://game-assets.rihdi.tw/desktop/launcher/releases/1.2.24/ONE-PIECE-Tabletop-Launcher-1.2.24-x64.exe';
const cases = [
  {name:'Windows',width:1366,height:900,ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',platform:'Win32',expected:'windows-card'},
  {name:'Android portrait',width:390,height:844,ua:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',platform:'Linux armv8l',expected:'android-card'},
  {name:'Android landscape',width:844,height:390,ua:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36',platform:'Linux armv8l',expected:'android-card'},
  {name:'iPhone',width:320,height:740,ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',platform:'iPhone',expected:null},
  {name:'iPad desktop UA',width:1024,height:768,ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',platform:'MacIntel',touch:5,expected:null},
  {name:'macOS',width:1440,height:900,ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Safari/605.1.15',platform:'MacIntel',expected:null},
];
(async () => {
  const browser = await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const results=[];
  try {
    const release=await (await fetch(channel)).json();
    for (const c of [...cases,...['offline','invalid','future','no-js'].map(mode=>({...cases[1],name:mode,mode}))]) {
      const context=await browser.newContext({viewport:{width:c.width,height:c.height},userAgent:c.ua,javaScriptEnabled:c.mode!=='no-js',serviceWorkers:'block'});
      await context.addInitScript(({platform,touch})=>{
        Object.defineProperty(navigator,'platform',{get:()=>platform});
        Object.defineProperty(navigator,'userAgentData',{get:()=>undefined});
        Object.defineProperty(navigator,'maxTouchPoints',{get:()=>touch||0});
      },c);
      const requests=[],errors=[],clicks=[];
      let allowClick=false;
      await context.route('**/*', route=>{
        const url=route.request().url();
        if (/\.(apk|exe)(?:\?|$)/.test(url)) {
          if(!allowClick) errors.push('Automatic installer download');
          clicks.push(url); return route.fulfill({status:204,body:''});
        }
        requests.push(url);
        if((url===channel || url===base+'/desktop/launcher-release-v1.json') && c.mode==='offline') return route.abort();
        if(url===channel && ['invalid','future'].includes(c.mode)) {
          const r=structuredClone(release);
          if(c.mode==='invalid') r.artifact.url='https://example.com/untrusted.apk';
          else {r.versionCode=27;r.version='0.1.26-mobile-trial';r.artifact.url='https://game-assets.rihdi.tw/android/releases/27/PIRATE-ODYSSEY-v027.apk';}
          return route.fulfill({json:r,headers:{'Access-Control-Allow-Origin':'*'}});
        }
        return route.continue();
      });
      const page=await context.newPage();
      page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base+'/download',{waitUntil:'networkidle'});
      const state=await page.evaluate(()=>({
        overflow:document.documentElement.scrollWidth>innerWidth,
        recommended:document.querySelector('.recommended')?.id||null,
        first:document.querySelector('.downloads > section')?.id,
        android:document.querySelector('#android-download-link').href,
        windows:document.querySelector('#download-link').href,
        height:[...document.querySelectorAll('.download')].map(e=>e.getBoundingClientRect().height),
        note:document.querySelector('#device-note').textContent,
        version:document.querySelector('#android-release-info').textContent,
      }));
      assert(!state.overflow,c.name+' overflow');
      assert(state.height.every(h=>h>=44));
      assert.equal(state.recommended,c.mode==='no-js'?null:c.expected);
      if(c.expected==='android-card'&&c.mode!=='no-js') assert.equal(state.first,'android-card');
      if(c.expected===null) assert.match(state.note,/沒有可安裝版本/);
      assert.equal(state.android,c.mode==='future'?'https://game-assets.rihdi.tw/android/releases/27/PIRATE-ODYSSEY-v027.apk':fallback);
      assert.match(state.windows,/^https:\/\/game-assets\.rihdi\.tw\/desktop\/launcher\/releases\/.*\.exe$/);
      if(['offline','no-js'].includes(c.mode)) assert.equal(state.windows,windowsFallback);
      if(c.mode==='future') assert.match(state.version,/v027/);
      assert.equal(clicks.length,0);
      allowClick=true;
      await page.locator('#android-download-link').click();
      await page.waitForTimeout(100);
      await page.locator('#download-link').click();
      await page.waitForTimeout(100);
      assert.deepEqual(clicks,[state.android,state.windows]);
      assert.deepEqual(errors,[]);
      results.push({name:c.name,state,requests,clicks,errors,ok:true});
      if(out&&['Windows','Android portrait'].includes(c.name)) await page.screenshot({path:out.replace(/\.json$/,`-${c.name.split(' ')[0]}.png`),fullPage:true});
      await context.close();
    }
    if(out) fs.writeFileSync(out,JSON.stringify({base,ok:true,cases:results},null,2));
    console.log(JSON.stringify({ok:true,base,cases:results.length,out}));
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
