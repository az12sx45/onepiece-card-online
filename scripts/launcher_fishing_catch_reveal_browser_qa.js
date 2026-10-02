'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const out=process.env.LAUNCHER_FISH_CATCH_QA_OUT||'D:/Codex_QA/launcher-fishing-visual-1.2.20/catch';
const runtimeBase=path.join(process.env.LOCALAPPDATA||'','OpenAI/Codex/runtimes/cua_node');
const playwrightPath=fs.existsSync(runtimeBase)?fs.readdirSync(runtimeBase)
  .map(name=>path.join(runtimeBase,name,'bin/node_modules/playwright')).find(fs.existsSync):null;
const {chromium}=require(process.env.BOARD_QA_PLAYWRIGHT||playwrightPath||'playwright');
const chrome=process.env.BOARD_QA_CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const checks=[];
const pageErrors=[];
const missingAssets=[];
let server,browser;

function check(name,actual,expected){assert.deepEqual(actual,expected,name);checks.push(name);}
function serve(){
  server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
    if(!rel){res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:#071b27;color:#fff;font-family:Arial,sans-serif}</style><link rel="stylesheet" href="/desktop/launcher-room-minigames.css"><body><script src="/desktop/launcher-room-minigames.js"></script></body></html>');return;}
    if(!['desktop/launcher-room-minigames.js','desktop/launcher-room-minigames.css'].includes(rel)){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',rel.endsWith('.css')?'text/css':'text/javascript');
    res.end(fs.readFileSync(path.join(root,rel)));
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
}
async function setup(page){
  await page.route('opui://**',route=>{
    const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');
    const file=path.join(root,'public',rel);
    if(rel.includes('..')||!fs.existsSync(file)){missingAssets.push(rel);return route.fulfill({status:404,body:'missing'});}
    return route.fulfill({path:file});
  });
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
  await page.evaluate(()=>{
    const copy=value=>JSON.parse(JSON.stringify(value));
    const stamp=ms=>new Date(ms).toISOString();
    window.__qa={serial:0,starts:0,placed:0,game:null};
    const response=()=>({ok:true,serverNow:stamp(Date.now()),minigame:copy(__qa.game)});
    async function command(type,payload){
      if(type==='minigame.start'){
        const id=++__qa.serial;__qa.starts++;
        __qa.game={id:`catch-${id}`,token:'qa-token',state:'playing',kind:'fishing',
          characterId:'room-character-luffy',baitId:payload.baitId,spotId:payload.spotId,
          fishingVersion:4,roundIndex:0,totalRounds:1,attempt:1,
          challenge:{id:`round-${id}`,fishingVersion:4,stage:'cast',motionSeed:1,distance:100,tension:10}};
        return response();
      }
      if(type==='fish.place'){__qa.placed++;return{ok:true};}
      if(type==='minigame.cancel'){__qa.game=null;return{ok:true};}
      if(type!=='minigame.answer'||!__qa.game)return{ok:false,error:'invalid_minigame'};
      const action=payload.counterMoves?.[0],round=__qa.game.challenge,at=Date.now();
      if(action==='cast'){
        round.stage='wait';round.castZone=payload.castZone;
        round.castTarget={x:.46+.0035*payload.castPower,y:.55-.0021*payload.castPower};
        round.motionStartedAt=stamp(at-1300);round.nibbleAt=stamp(at-800);
        round.biteAt=stamp(at-300);round.hookUntil=stamp(at+4000);
      }else if(action==='hook'){
        round.stage='fight';round.hookedAt=stamp(at);round.fightUntil=stamp(at+50000);
        round.distance=8;round.tension=22;
      }else if(action==='control'&&round.stage==='fight'&&payload.reeling){
        __qa.game.state='completed';
        __qa.game.result={passed:true,catch:{id:`fish-${__qa.serial}`,speciesId:'balloon-catfish',label:'氣球鯰魚'}};
      }
      return response();
    }
    window.__minigame=OnePieceRoomMinigames.create({fishCollection:()=>[],command,
      onOpen:()=>{},onClose:()=>{},onResult:()=>{}});
    __minigame.open({kind:'fishing',characterId:'room-character-luffy'});
  });
}
async function reachFight(page){
  await page.getByRole('button',{name:'開始釣魚'}).click();
  await page.locator('.room-fishing-v4-sea[data-stage="cast"]').waitFor();
  await page.locator('.room-fishing-v4-cast').click();
  await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor();
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true');
  await page.locator('.room-fishing-v4-hook').click();
  await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor();
}
async function assertCatch(page,label){
  const result=page.locator('.room-fishing-v3-result.caught');
  await result.waitFor();
  const art=result.locator('img.room-fishing-v3-catch-art');
  await page.waitForFunction(()=>{
    const img=document.querySelector('.room-fishing-v3-catch-art');
    return img?.complete&&img.naturalWidth>0;
  });
  check(`${label}: fish named`,await result.locator('.room-fishing-v3-catch-name').textContent(),'氣球鯰魚');
  check(`${label}: fish image visible`,await art.isVisible(),true);
  check(`${label}: result heading holds focus`,await result.locator('h3').evaluate(node=>document.activeElement===node),true);
  check(`${label}: result card starts at top`,await page.locator('.room-minigame-card').evaluate(node=>node.scrollTop),0);
  const visible=await art.evaluate(img=>{
    const r=img.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;
  });
  check(`${label}: fish intersects viewport`,visible,true);
  check(`${label}: result remains active`,await page.evaluate(()=>__minigame.inspect().phase),'result');
}
async function heldKeyCatch(page,key,label){
  await reachFight(page);
  await page.locator('.room-fishing-v4-reel').focus();
  const starts=await page.evaluate(()=>__qa.starts);
  await page.keyboard.down(key);
  await assertCatch(page,label);
  await page.waitForTimeout(1050);
  check(`${label}: held key does not restart`,await page.evaluate(()=>__qa.starts),starts);
  check(`${label}: catch remains while held`,await page.locator('.room-fishing-v3-catch-art').isVisible(),true);
  await page.keyboard.up(key);
  await page.waitForTimeout(250);
  check(`${label}: key release does not restart`,await page.evaluate(()=>__qa.starts),starts);
  check(`${label}: catch remains after release`,await page.locator('.room-fishing-v3-catch-art').isVisible(),true);
}
async function nextCast(page){
  await page.getByRole('button',{name:'看完了，再釣一竿'}).click();
  await page.locator('.room-fishing-v4-sea[data-stage="cast"]').waitFor();
}
async function main(){
  fs.mkdirSync(out,{recursive:true});await serve();
  browser=await chromium.launch({executablePath:chrome,headless:true});
  try{
    const desktop=await browser.newPage({viewport:{width:1280,height:800}});
    await setup(desktop);
    await heldKeyCatch(desktop,'Space','desktop Space');
    await desktop.screenshot({path:path.join(out,'desktop-catch.png'),fullPage:true});
    await nextCast(desktop);
    check('explicit next button starts next cast',await desktop.evaluate(()=>__qa.starts),2);
    await desktop.evaluate(()=>{__minigame.dismiss();__minigame.open({kind:'fishing',characterId:'room-character-luffy'});});
    await heldKeyCatch(desktop,'Enter','desktop Enter');
    await desktop.screenshot({path:path.join(out,'desktop-enter-catch.png'),fullPage:true});
    await desktop.evaluate(()=>{__minigame.dismiss();__minigame.open({kind:'fishing',characterId:'room-character-luffy'});});
    await reachFight(desktop);
    const reel=await desktop.locator('.room-fishing-v4-reel').boundingBox();
    assert(reel,'pointer reel has a visible hit area');
    await desktop.mouse.move(reel.x+reel.width/2,reel.y+reel.height/2);
    await desktop.mouse.down();
    await assertCatch(desktop,'desktop pointer');
    await desktop.mouse.up();
    await desktop.waitForTimeout(550);
    check('pointer release over result does not restart',await desktop.evaluate(()=>__qa.starts),4);
    await desktop.getByRole('button',{name:'放進水族箱'}).click();
    check('aquarium action does not dismiss catch',await desktop.locator('.room-fishing-v3-catch-art').isVisible(),true);
    check('aquarium action sends one placement',await desktop.evaluate(()=>__qa.placed),1);

    const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await setup(mobile);
    await heldKeyCatch(mobile,'Space','mobile Space');
    await mobile.screenshot({path:path.join(out,'mobile-catch.png'),fullPage:true});
    check('no browser errors',pageErrors,[]);
    check('no missing image assets',missingAssets,[]);
    const report={status:'PASS',checks:checks.length,results:checks,pageErrors,missingAssets};
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log(`PASS ${checks.length}/${checks.length} catch reveal browser checks`);
  }finally{await browser?.close();await new Promise(resolve=>server?.close(resolve));}
}
main().catch(error=>{
  console.error(error.stack||error);
  if(pageErrors.length)console.error('page errors:',JSON.stringify(pageErrors));
  if(missingAssets.length)console.error('missing assets:',JSON.stringify(missingAssets));
  process.exitCode=1;
});
