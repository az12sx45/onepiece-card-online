'use strict';

// Local browser + actual PostgreSQL engine in disposable memory. No production
// accounts, sockets, files or database are used by this fixture.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/df473e5367fa2b42/bin/node_modules/playwright');
const art = require('../public/js/board_adventure_art');
const { FIELD, sanitizeProfileStats, PROFILE_STATS_SQL } = require('../server/board-art-collection');
const ROOT = path.resolve(__dirname, '..');
const BASE = process.env.BOARD_QA_URL || 'http://127.0.0.1:18929';
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw Error('Isolated localhost only');
const OUTPUT = process.env.BOARD_QA_OUTPUT || 'D:/Codex_QA/draw-result-art-20260922/collection';
fs.mkdirSync(OUTPUT,{recursive:true});
const report={checks:[],errors:[],screenshots:[]};
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});if(!pass)console.error('FAIL',name,detail);}
const source=fs.readFileSync(path.join(ROOT,'server/index.js'),'utf8');
const segment=source.slice(source.indexOf('socket.on("PROFILE_UPDATE"'),source.indexOf('// MATCH HISTORY（方案B）'));
const sql=segment.match(/const \{ rows \} = await pool\.query\(\s*`([\s\S]*?)`/)[1].replace('${PROFILE_STATS_SQL}',()=>PROFILE_STATS_SQL);
const db=new PGlite();
async function update(secret,stats){return (await db.query(sql,[secret,null,null,JSON.stringify(sanitizeProfileStats(stats)),null,null,null])).rows[0];}
async function profile(secret){return (await db.query('SELECT * FROM player_profiles WHERE secret=$1',[secret])).rows[0];}
async function run(){
  check('catalog 42 groups / 126 individual images',art.definitions.length===42&&art.entries.length===126);
  check('new images 54',art.entries.filter(e=>e.group!=='sea').length===54);
  for(const group of Object.keys(art.groups))check(`${group}: every definition has three unique images`,art.definitions.filter(d=>d.group===group).every(d=>d.images.length===3&&new Set(d.images).size===3));
  const original=Math.random;Math.random=()=>{throw Error('Gameplay RNG consumed');};
  try{for(const d of art.definitions){const picks=Array.from({length:60},()=>art.pick(d.group,d.key).variant);check(`rng ${d.group}:${d.key}`,new Set(picks).size===3&&!picks.some((n,i)=>i&&n===picks[i-1]));}}finally{Math.random=original;}
  check('unknown IDs, timestamps and arrays rejected',Object.keys(art.normalizeCollection({'invented:secret:1':1,'chest:wood:1':-1,'chest:wood:2':1.2,'chest:wood:3':NaN})).length===0&&Object.keys(art.normalizeCollection([])).length===0);
  check('normalize retains individual variants only',JSON.stringify(art.normalizeCollection({'chest:wood:1':100}))==='{"chest:wood:1":100}');
  await db.exec('CREATE TABLE player_profiles (user_id SERIAL PRIMARY KEY, secret TEXT UNIQUE, name TEXT, avatar TEXT, stats JSONB, titles JSONB, bounties JSONB, recent_matches JSONB, updated_at TIMESTAMPTZ)');
  await update('qa-a',{client:{shop:{coins:777},titles:['kept']},unrelated:42});
  await Promise.all([update('qa-a',{[FIELD]:{'chest:wood:1':200}}),update('qa-a',{[FIELD]:{'impel:key:2':100}})]);
  await update('qa-a',{[FIELD]:{'chest:wood:1':90,'judicial:attack:3':300,'invalid:id:1':100}});
  let p=await profile('qa-a');
  check('actual UPSERT unions simultaneous device uploads',Object.keys(p.stats[FIELD]).length===3,p.stats[FIELD]);
  check('actual SQL preserves earliest first encounter',p.stats[FIELD]['chest:wood:1']===90);
  check('unrelated profile stats preserved',p.stats.client.shop.coins===777&&p.stats.unrelated===42&&p.stats.client.titles[0]==='kept');
  await update('qa-a',{other:4});await update('qa-a',{[FIELD]:{}});p=await profile('qa-a');
  check('unrelated/empty patch cannot erase collection',Object.keys(p.stats[FIELD]).length===3&&p.stats.other===4);
  await update('qa-b',{[FIELD]:{}});
  check('cloud accounts isolated',Object.keys((await profile('qa-b')).stats[FIELD]).length===0);
  const browser=await chromium.launch({executablePath:process.env.BOARD_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  try{
    const make=async(secret)=>{
      const context=await browser.newContext({viewport:{width:1440,height:900}});
      await context.exposeBinding('qaProfileRequest',async(_source,{event,payload})=>({ok:true,profile:event==='PROFILE_GET'?await profile(payload.secret):await update(payload.secret,payload.patch.stats)}));
      await context.route('**/qa-art',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/css/board_adventure_art.css"><style>body{margin:0;background:#061525;color:white;font-family:Arial}</style><button data-open-adventure-gallery>冒險插畫圖鑑</button><script>window.qaContext={profile:{userId:${JSON.stringify(secret)},secret:${JSON.stringify(secret)}},socket:{id:'qa-socket',connected:true,timeout(){return this},emit(event,payload,callback){window.qaProfileRequest({event,payload}).then(value=>callback(null,value),()=>callback(Error('offline')))}}};window.BoardShared={getState:()=>window.qaContext};</script><script src="/js/board_sea_event_visuals.js"></script><script src="/js/board_adventure_art.js"></script><script src="/js/board_art_collection.js"></script>`}));
      const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
      await page.goto(BASE+'/qa-art');return {context,page};
    };
    const a=await make('qa-a'),b=await make('qa-a');
    await a.page.click('[data-open-adventure-gallery]');
    await a.page.waitForFunction(()=>window.BoardArtCollection.status()==='saved');
    check('cloud pictures restored on opening',Object.keys(await a.page.evaluate(()=>BoardArtCollection.snapshot())).length===3);
    check('locked variants never reference images',await a.page.locator('.is-locked img').count()===0&&await a.page.locator('[data-art-view]').count()===3);
    check('123 locked and 3 unlocked cards',await a.page.locator('.is-locked').count()===123);
    await a.page.evaluate(()=>{qaContext.socket.connected=false;BoardArtCollection.merge({'chest:copper:1':400});});
    await b.page.evaluate(()=>BoardArtCollection.merge({'sea:supply-rescue:2':500}));
    await b.page.waitForFunction(()=>BoardArtCollection.status()==='saved');
    await a.page.evaluate(()=>{qaContext.socket.connected=true;return BoardArtCollection.sync(true);});
    check('offline encounter + other device encounter merge',Object.keys(await a.page.evaluate(()=>BoardArtCollection.snapshot())).length===5);
    check('cloud union contains all five',Object.keys((await profile('qa-a')).stats[FIELD]).length===5);
    await a.page.reload();await a.page.click('[data-open-adventure-gallery]');
    await a.page.waitForFunction(()=>BoardArtCollection.status()==='saved');
    check('new page retains permanent collection',Object.keys(await a.page.evaluate(()=>BoardArtCollection.snapshot())).length===5);
    await a.page.click('[data-art-view="chest:wood:1"]');
    const image=await a.page.locator('.adventure-gallery-detail>img').getAttribute('src');
    check('detail opens actual selected version',image.endsWith('chest-wood-1.webp'));
    await a.page.evaluate(()=>BoardArtCollection.sync(true));
    check('background sync preserves enlarged picture',await a.page.locator('.adventure-gallery-detail>img').getAttribute('src')===image);
    await a.page.click('[data-art-back]');
    for(const [label,width,height]of[['desktop',1440,900],['mobile',390,844],['landscape',932,430]]){
      await a.page.setViewportSize({width,height});
      const layout=await a.page.evaluate(()=>{const d=document.querySelector('dialog'),r=d.getBoundingClientRect();return {width:r.width,height:r.height,viewport:innerWidth,overflow:d.scrollWidth>d.clientWidth+1};});
      check(`${label}: gallery within viewport`,layout.width<=width&&layout.height<=height&&!layout.overflow,layout);
      await a.page.screenshot({path:path.join(OUTPUT,label+'.png')});report.screenshots.push(label+'.png');
    }
    await a.page.click('[data-art-filter="chest"]');await a.page.click('[data-art-only]');
    check('category and unlocked filter',await a.page.locator('[data-art-view]').count()===2&&await a.page.locator('.is-locked').count()===0);
    await a.page.keyboard.press('Escape');check('Escape closes gallery',!(await a.page.locator('dialog').evaluate(d=>d.open)));
    await a.page.evaluate(()=>{qaContext.profile={userId:'qa-b',secret:'qa-b'};BoardArtCollection.open();});
    await a.page.waitForFunction(()=>BoardArtCollection.status()==='saved');
    check('switching account does not expose prior collection',Object.keys(await a.page.evaluate(()=>BoardArtCollection.snapshot())).length===0);
    await a.page.evaluate(()=>{qaContext.profile={userId:'qa-a',secret:'qa-a'};BoardArtCollection.snapshot();qaContext.profile={userId:'qa-b',secret:'qa-b'};dispatchEvent(new StorageEvent('storage',{key:'op_board_art_collection_v1:qa-a',newValue:JSON.stringify({'chest:gold:2':600})}));});
    check('late storage notification cannot migrate old account art',Object.keys(await a.page.evaluate(()=>BoardArtCollection.snapshot())).length===0);
    await a.page.evaluate(()=>{qaContext.profile={userId:'qa-a',secret:'qa-a'};BoardArtCollection.open();});await a.page.waitForFunction(()=>BoardArtCollection.status()==='saved');
    await a.page.click('[data-art-filter="all"]');await a.page.click('[data-art-view="chest:wood:1"]');
    const signedOut=await a.page.evaluate(()=>{qaContext.profile={};return BoardArtCollection.snapshot();});
    check('signout clears in-memory collection',Object.keys(signedOut).length===0);
    check('signout removes previously enlarged private picture',await a.page.locator('.adventure-gallery-detail img').count()===0&&await a.page.locator('[data-art-view]').count()===0);
    check('no browser JS errors',report.errors.length===0,report.errors);
  }finally{await browser.close();await db.close();}
}
run().catch(e=>{report.fatal=e.stack;console.error(e);}).finally(()=>{report.ok=!report.fatal&&report.checks.every(c=>c.pass);fs.writeFileSync(path.join(OUTPUT,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,failed:report.checks.filter(c=>!c.pass).map(c=>c.name),output:OUTPUT}));if(!report.ok)process.exitCode=1;});
