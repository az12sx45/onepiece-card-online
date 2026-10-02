'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const out=process.env.LAUNCHER_FISH_CONTROLS_QA_OUT||'D:/Codex_QA/launcher-fishing-controls-1.2.19/browser';
const runtimeBase=path.join(process.env.LOCALAPPDATA||'','OpenAI/Codex/runtimes/cua_node');
const playwrightPath=fs.existsSync(runtimeBase)?fs.readdirSync(runtimeBase)
  .map(name=>path.join(runtimeBase,name,'bin/node_modules/playwright')).find(fs.existsSync):null;
const {chromium}=require(process.env.BOARD_QA_PLAYWRIGHT||playwrightPath||'playwright');
const chrome=process.env.BOARD_QA_CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const checks=[],pageErrors=[],missingAssets=[];
let server,browser;

function check(name,actual,expected){assert.deepEqual(actual,expected,name);checks.push(name);}
const zone=power=>power<35?'near':power<70?'mid':'far';
const target=power=>({x:Math.round((46+.35*power)*100)/100,y:Math.round((55-.21*power)*100)/100});
const html='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%;background:#071b27;color:#fff;font-family:Arial,"Microsoft JhengHei",sans-serif}</style><link rel="stylesheet" href="/desktop/launcher-room-minigames.css"><body><script src="/desktop/launcher-room-minigames.js"></script></body></html>';
function startServer(){
  server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'');
    if(!rel){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
    if(!['desktop/launcher-room-minigames.js','desktop/launcher-room-minigames.css'].includes(rel)){
      res.writeHead(404);res.end();return;
    }
    res.setHeader('Content-Type',rel.endsWith('.css')?'text/css':'text/javascript');
    res.end(fs.readFileSync(path.join(root,rel)));
  });
  return new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
}

async function installHarness(page){
  await page.route('opui://**',route=>{
    const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');
    const file=path.join(root,'public',rel);
    if(rel.includes('..')||!fs.existsSync(file)){
      missingAssets.push(rel);return route.fulfill({status:404,body:'missing'});
    }
    return route.fulfill({path:file});
  });
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
  await page.evaluate(()=>{
    const copy=value=>JSON.parse(JSON.stringify(value));
    const stamp=ms=>new Date(ms).toISOString();
    window.__qa={calls:[],serial:0,game:null,holdSync:false,syncWaiting:false,
      castPointerDown:false,releaseSync:null,holdControl:false,controlWaiting:false,releaseControl:null,
      highTension:false,holdPay:false,payWaiting:false,releasePay:null};
    function response(){return{ok:true,serverNow:stamp(Date.now()),minigame:copy(__qa.game)};}
    function command(type,payload){
      __qa.calls.push({type,payload:copy(payload),at:Date.now()});
      if(type==='minigame.start'){
        const id=++__qa.serial;
        __qa.game={id:`browser-${id}`,token:'qa-token',state:'playing',kind:'fishing',
          characterId:'room-character-luffy',baitId:payload.baitId,spotId:payload.spotId,
          fishingVersion:4,roundIndex:0,totalRounds:1,challenge:{id:`round-${id}`,
            fishingVersion:4,stage:'cast',motionSeed:1,distance:100,tension:10}};
        return Promise.resolve(response());
      }
      if(type==='minigame.cancel'){__qa.game=null;return Promise.resolve({ok:true});}
      if(type!=='minigame.answer'||!__qa.game)return Promise.resolve({ok:false,error:'invalid_minigame'});
      const action=payload.counterMoves?.[0],round=__qa.game.challenge,at=Date.now();
      if(action==='sync'&&__qa.holdSync&&__qa.castPointerDown){
        return new Promise(resolve=>{__qa.syncWaiting=true;__qa.releaseSync=()=>{
          __qa.syncWaiting=false;__qa.holdSync=false;resolve(response());
        };});
      }
      if(action==='cast'){
        const power=payload.castPower;
        round.stage='wait';round.castZone=payload.castZone;
        round.castTarget={x:Math.round((.46+.0035*power)*10000)/10000,
          y:Math.round((.55-.0021*power)*10000)/10000};
        round.motionStartedAt=stamp(at);round.nibbleAt=stamp(at+350);
        round.biteAt=stamp(at+650);round.hookUntil=stamp(at+4500);
      }else if(action==='hook'){
        round.stage='fight';round.hookedAt=stamp(at);round.fightUntil=stamp(at+55000);
        round.distance=78;round.tension=__qa.highTension?90:62;
        if(__qa.highTension){round.control={reeling:true,steer:0,paying:false};round.controlLeaseUntil=stamp(at+2000);}
      }else if(action==='control'&&round.stage==='fight'){
        round.control={reeling:payload.reeling,steer:payload.steer,paying:payload.paying};
        round.controlLeaseUntil=stamp(at+2000);
        round.tension=Math.max(0,Math.min(100,round.tension+(payload.paying?-12:payload.reeling?4:-2)));
        round.distance=Math.max(0,Math.min(100,round.distance+(payload.paying?4:payload.reeling?-2:0)));
        if(__qa.holdControl&&payload.reeling){
          return new Promise(resolve=>{__qa.controlWaiting=true;__qa.releaseControl=()=>{
            __qa.controlWaiting=false;__qa.holdControl=false;resolve(response());
          };});
        }
        if(__qa.holdPay&&payload.paying){
          return new Promise(resolve=>{__qa.payWaiting=true;__qa.releasePay=()=>{
            __qa.payWaiting=false;__qa.holdPay=false;resolve(response());
          };});
        }
      }
      return Promise.resolve(response());
    }
    window.__minigame=OnePieceRoomMinigames.create({fishCollection:()=>[],command,
      onOpen:()=>{},onClose:()=>{},onResult:()=>{}});
    __minigame.open({kind:'fishing',characterId:'room-character-luffy'});
  });
}

async function gesture(page,box,durationMs,points,touch){
  const y=box.y+box.height*.5;
  const x=ratio=>box.x+box.width*ratio;
  if(touch){
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x(points[0]),y,id:1}]});
    await page.waitForTimeout(durationMs);
    for(const point of points.slice(1)){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x(point),y,id:1}]});
      await page.waitForTimeout(100);
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await cdp.detach();
  }else{
    await page.mouse.move(x(points[0]),y);await page.mouse.down();
    await page.waitForTimeout(durationMs);
    for(const point of points.slice(1)){await page.mouse.move(x(point),y,{steps:5});await page.waitForTimeout(100);}
    await page.mouse.up();
  }
}
async function latestAction(page,action){
  return page.evaluate(action=>[...__qa.calls].reverse().find(call=>call.type==='minigame.answer'&&
    call.payload.counterMoves?.[0]===action)?.payload,action);
}
async function waitForControl(page,expected){
  await page.waitForFunction(expected=>__qa.calls.some(call=>call.type==='minigame.answer'&&
    call.payload.counterMoves?.[0]==='control'&&call.payload.reeling===expected.reeling&&
    call.payload.steer===expected.steer&&call.payload.paying===expected.paying),expected);
}
async function waitForLatestControl(page,expected){
  await page.waitForFunction(expected=>{
    const last=[...__qa.calls].reverse().find(call=>call.type==='minigame.answer'&&
      call.payload.counterMoves?.[0]==='control');
    return last?.payload.reeling===expected.reeling&&last?.payload.steer===expected.steer&&
      last?.payload.paying===expected.paying;
  },expected);
}
async function rodLineAlignment(page){
  return page.evaluate(()=>{
    const sea=document.querySelector('.room-fishing-v4-sea');
    const rod=sea.querySelector('.room-fishing-v4-rod');
    const d=sea.querySelector('.room-fishing-v4-line path').getAttribute('d');
    const move=/^M\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(d);
    if(!move||!rod.naturalWidth||!rod.naturalHeight)return null;
    const width=rod.offsetWidth,height=rod.offsetHeight;
    const artWidth=Math.min(width,height*rod.naturalWidth/rod.naturalHeight);
    const artHeight=artWidth*rod.naturalHeight/rod.naturalWidth;
    const localX=(width-artWidth)/2+artWidth*1484/1536;
    const localY=(height-artHeight)/2+artHeight*42/1024;
    const style=getComputedStyle(rod),origin=style.transformOrigin.split(' ').map(parseFloat);
    const matrix=new DOMMatrixReadOnly(style.transform);
    const dx=localX-origin[0],dy=localY-origin[1];
    const tip={x:rod.offsetLeft+origin[0]+matrix.a*dx+matrix.c*dy,
      y:rod.offsetTop+origin[1]+matrix.b*dx+matrix.d*dy};
    const start={x:Number(move[1])*sea.clientWidth/1000,y:Number(move[2])*sea.clientHeight/600};
    return{tip,start,gap:Math.hypot(tip.x-start.x,tip.y-start.y)};
  });
}
async function checkRodSteer(page,name,steer){
  if(steer===0)return;
  await page.waitForTimeout(240);
  const alignment=await rodLineAlignment(page);
  assert(alignment,`${name}: rod art and SVG line available`);
  check(`${name}: ${steer<0?'left':'right'} line starts at rod tip`,alignment.gap<3,true);
  await page.screenshot({path:path.join(out,`${name}-steer-${steer<0?'left':'right'}.png`),fullPage:true});
}
async function visualSample(page){
  return page.locator('.room-fishing-v4-sea').evaluate(sea=>{
    const style=sea.style;
    return{tension:Number(sea.querySelector('.room-fishing-v4-gauge').getAttribute('aria-valuenow')),
      needle:parseFloat(sea.querySelector('.room-fishing-v4-gauge-needle').style.transform.match(/-?[\d.]+/)?.[0]),
      fishX:parseFloat(style.getPropertyValue('--fish-x')),fishY:parseFloat(style.getPropertyValue('--fish-y')),
      floatX:parseFloat(style.getPropertyValue('--float-x')),floatY:parseFloat(style.getPropertyValue('--float-y')),
      fishScale:parseFloat(style.getPropertyValue('--fish-scale'))};
  });
}
async function startCast(page){
  await page.getByRole('button',{name:'開始釣魚'}).click();
  await page.locator('.room-fishing-v4-sea[data-stage="cast"]').waitFor();
  await page.locator('.room-fishing-v4-cast').scrollIntoViewIfNeeded();
}
async function reopen(page){
  await page.evaluate(()=>{__minigame.dismiss();__minigame.open({kind:'fishing',characterId:'room-character-luffy'});});
  await startCast(page);
}
async function actionCount(page,action){
  return page.evaluate(action=>__qa.calls.filter(call=>call.type==='minigame.answer'&&
    call.payload.counterMoves?.[0]===action).length,action);
}
async function keyboardCast(page,key,holdMs,expectedZone){
  await reopen(page);
  await page.locator('.room-fishing-v4-cast').focus();
  const before=await actionCount(page,'cast');
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  check(`keyboard ${key}: no cast before release`,await actionCount(page,'cast'),before);
  await page.keyboard.up(key);
  await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor({timeout:5000});
  check(`keyboard ${key}: one cast on release`,await actionCount(page,'cast')-before,1);
  const payload=await latestAction(page,'cast');
  check(`keyboard ${key}: cast zone`,payload.castZone,expectedZone);
  check(`keyboard ${key}: cast power from held duration`,
    expectedZone==='near'?payload.castPower<35:payload.castPower>=35&&payload.castPower<70,true);
}
async function runKeyboard(page,context){
  await keyboardCast(page,'Enter',740,'mid');
  await keyboardCast(page,'Space',190,'near');
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:5000});
  await page.locator('.room-fishing-v4-hook').click();
  await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor();
  const sea=page.locator('.room-fishing-v4-sea');
  await page.keyboard.down('Space');
  await waitForLatestControl(page,{reeling:true,steer:0,paying:false});
  check('keyboard fight: Space holds reel',await sea.getAttribute('data-reeling'),'true');
  await page.keyboard.down('ArrowLeft');
  await waitForLatestControl(page,{reeling:true,steer:-1,paying:false});
  check('keyboard fight: ArrowLeft steers left',await sea.getAttribute('data-steer'),'-1');
  await page.keyboard.up('ArrowLeft');
  await waitForLatestControl(page,{reeling:true,steer:0,paying:false});
  await page.keyboard.down('ArrowRight');
  await waitForLatestControl(page,{reeling:true,steer:1,paying:false});
  check('keyboard fight: ArrowRight steers right',await sea.getAttribute('data-steer'),'1');
  await page.keyboard.up('ArrowRight');
  await waitForLatestControl(page,{reeling:true,steer:0,paying:false});
  await page.keyboard.up('Space');
  await waitForLatestControl(page,{reeling:false,steer:0,paying:false});
  await page.waitForTimeout(70);
  check('keyboard fight: Space release stops reel',await sea.getAttribute('data-reeling'),'false');
  await page.keyboard.down('ArrowDown');
  await waitForLatestControl(page,{reeling:false,steer:0,paying:true});
  check('keyboard fight: ArrowDown holds pay line',await sea.getAttribute('data-paying'),'true');
  await page.keyboard.up('ArrowDown');
  await waitForLatestControl(page,{reeling:false,steer:0,paying:false});
  check('keyboard fight: ArrowDown release stops pay line',await sea.getAttribute('data-paying'),'false');

  await reopen(page);
  await page.locator('.room-fishing-v4-cast').focus();
  const before=await actionCount(page,'cast');
  await page.keyboard.down('Space');
  await page.waitForTimeout(250);
  const other=await context.newPage();
  const focusSession=await context.newCDPSession(page);
  try{
    await other.goto('about:blank');
    // Playwright keeps headless pages focused; release that emulation before
    // activating another tab so Chromium delivers an actual window blur.
    await focusSession.send('Emulation.setFocusEmulationEnabled',{enabled:false});
    await other.bringToFront();
    await page.waitForFunction(()=>__minigame.inspect().windowFocused===false,null,{timeout:5000});
    check('keyboard blur: focus loss does not submit cast',await actionCount(page,'cast'),before);
    await page.bringToFront();
    await page.keyboard.up('Space');
    await page.waitForTimeout(150);
    check('keyboard blur: held cast does not submit',await actionCount(page,'cast'),before);
    check('keyboard blur: scene remains at cast',await sea.getAttribute('data-stage'),'cast');
    check('keyboard blur: charge visual clears',await sea.getAttribute('data-charging'),'false');
  }finally{await focusSession.detach();await other.close();}
}
async function runCastDuringSync(page){
  await reopen(page);
  await page.evaluate(()=>{
    __qa.holdSync=true;__qa.syncWaiting=false;__qa.castPointerDown=false;
    document.querySelector('.room-fishing-v4-cast').addEventListener('pointerdown',()=>{
      __qa.castPointerDown=true;
    },{once:true});
  });
  const cast=page.locator('.room-fishing-v4-cast'),box=await cast.boundingBox();
  assert(box,'sync cast button visible');
  const before=await actionCount(page,'cast');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.waitForFunction(()=>__qa.syncWaiting===true,null,{timeout:3500});
  check('cast during sync: charge started before sync',await page.locator('.room-fishing-v4-sea').getAttribute('data-charging'),'true');
  await page.waitForTimeout(700);
  await page.mouse.up();
  check('cast during sync: release queues without duplicate',await actionCount(page,'cast'),before);
  await page.evaluate(()=>__qa.releaseSync());
  await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor({timeout:5000});
  check('cast during sync: sends once after response',await actionCount(page,'cast')-before,1);
  const payload=await latestAction(page,'cast');
  check('cast during sync: held power preserved',payload.castPower>=35,true);
  check('cast during sync: zone matches power',payload.castZone,zone(payload.castPower));
}
async function runVisualPredictionAndConfirm(page,name){
  await keyboardCast(page,'Space',190,'near');
  // Keep the fish's swim phase fixed while measuring the effect of reduced
  // distance; this isolates approach to the boat from its lateral swim.
  await page.evaluate(()=>{__qa.game.challenge.motionStartedAt=new Date(Date.now()+60000).toISOString();});
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:5000});
  await page.locator('.room-fishing-v4-hook').click();
  await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor();
  await page.evaluate(()=>{__qa.holdControl=true;__qa.controlWaiting=false;});
  await page.keyboard.down('Space');
  await page.waitForFunction(()=>__qa.controlWaiting===true,null,{timeout:3500});
  const first=await visualSample(page);
  await page.waitForTimeout(280);const middle=await visualSample(page);
  await page.waitForTimeout(280);const last=await visualSample(page);
  check('fight prediction: tension value changes between responses',first.tension<middle.tension&&middle.tension<last.tension,true);
  check('fight prediction: needle moves continuously',first.needle<middle.needle&&middle.needle<last.needle,true);
  check('fight prediction: unconfirmed reel keeps shadow distance',Math.abs(last.fishX-first.fishX)<.01&&Math.abs(last.fishY-first.fishY)<.01,true);
  check('fight prediction: unconfirmed reel keeps bobber distance',Math.abs(last.floatX-first.floatX)<.01&&Math.abs(last.floatY-first.floatY)<.01,true);
  check('fight prediction: unconfirmed reel keeps fish size',Math.abs(last.fishScale-first.fishScale)<.001,true);
  await page.evaluate(()=>__qa.releaseControl());
  await page.waitForFunction(()=>document.querySelector('.room-minigame-overlay')?.dataset.pending==='false');
  const acknowledged=await visualSample(page);
  await page.waitForTimeout(500);
  const approaching=await visualSample(page);
  check('fight prediction: confirmed reel brings shadow toward boat',Math.abs(approaching.fishX-44)<Math.abs(acknowledged.fishX-44)&&approaching.fishY>acknowledged.fishY,true);
  check('fight prediction: confirmed reel brings bobber toward boat',Math.abs(approaching.floatX-44)<Math.abs(acknowledged.floatX-44)&&approaching.floatY>acknowledged.floatY,true);
  check('fight prediction: confirmed reel grows fish shadow',approaching.fishScale>acknowledged.fishScale,true);
  await page.keyboard.up('Space');
  await waitForLatestControl(page,{reeling:false,steer:0,paying:false});

  await page.evaluate(()=>{__qa.game.challenge.distance=8;__qa.game.challenge.tension=32;});
  await page.keyboard.down('Space');
  await page.waitForFunction(()=>parseFloat(document.querySelector('.room-fishing-v4-sea')?.style.getPropertyValue('--fish-scale'))>1.4,null,{timeout:3500});
  await page.keyboard.up('Space');
  const shore=await visualSample(page);
  check('near shore: shadow and bobber at same approach x',Math.abs(shore.fishX-shore.floatX)<.01,true);
  check('near shore: float close to boat',Math.abs(shore.floatX-44)<3,true);
  await page.screenshot({path:path.join(out,`${name}-near-shore.png`),fullPage:true});

  for(const [key,held,label] of [
    ['Space',{reeling:true,steer:0,paying:false},'reel'],
    ['ArrowDown',{reeling:false,steer:0,paying:true},'pay']]){
    await page.keyboard.down(key);
    await waitForLatestControl(page,held);
    await page.waitForFunction(()=>document.querySelector('.room-minigame-overlay')?.dataset.pending==='false');
    await page.getByRole('button',{name:'結束並關閉挑戰'}).click();
    await page.locator('.room-minigame-confirm').waitFor();
    const sea=page.locator('.room-fishing-v4-sea');
    check(`confirm ${label}: reel neutral`,await sea.getAttribute('data-reeling'),'false');
    check(`confirm ${label}: pay neutral`,await sea.getAttribute('data-paying'),'false');
    check(`confirm ${label}: neutral server payload`,await latestAction(page,'control'),{
      sessionId:await page.evaluate(()=>__qa.game.id),token:'qa-token',roundId:await page.evaluate(()=>__qa.game.challenge.id),
      counterMoves:['control'],reeling:false,steer:0,paying:false});
    const before=await actionCount(page,'control');
    await page.waitForTimeout(1250);
    check(`confirm ${label}: no background control`,await actionCount(page,'control'),before);
    await page.keyboard.up(key);
    check(`confirm ${label}: release does not resume control`,await actionCount(page,'control'),before);
    await page.getByRole('button',{name:'繼續挑戰'}).click();
    await page.locator('.room-minigame-confirm').waitFor({state:'detached'});
  }
}
async function runDelayedPaySafety(page){
  await keyboardCast(page,'Space',190,'near');
  await page.evaluate(()=>{__qa.highTension=true;});
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:5000});
  await page.locator('.room-fishing-v4-hook').click();
  await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor();
  await page.evaluate(()=>{__qa.highTension=false;__qa.holdPay=true;});
  const before=await visualSample(page);
  check('delayed pay: starts in danger tension',before.tension>=90,true);
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(()=>__qa.payWaiting===true,null,{timeout:3500});
  await page.waitForTimeout(400);
  const unconfirmed=await visualSample(page);
  check('delayed pay: no premature safe gauge',unconfirmed.tension>=before.tension,true);
  check('delayed pay: needle does not fall before ack',unconfirmed.needle>=before.needle,true);
  await page.evaluate(()=>__qa.releasePay());
  await page.waitForFunction(()=>Number(document.querySelector('.room-fishing-v4-gauge')?.getAttribute('aria-valuenow'))<85,null,{timeout:3500});
  const accepted=await visualSample(page);
  await page.waitForTimeout(350);
  const relieved=await visualSample(page);
  check('delayed pay: confirmed line relieves tension promptly',relieved.tension<=accepted.tension-5,true);
  check('delayed pay: confirmed needle drops',relieved.needle<accepted.needle,true);
  await page.keyboard.up('ArrowDown');
  await waitForLatestControl(page,{reeling:false,steer:0,paying:false});
}
async function runExpiredControlLease(page){
  await keyboardCast(page,'Space',190,'near');
  await page.evaluate(()=>{__qa.game.challenge.motionStartedAt=new Date(Date.now()+60000).toISOString();});
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:5000});
  await page.locator('.room-fishing-v4-hook').click();
  await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor();
  await page.keyboard.down('Space');
  await waitForLatestControl(page,{reeling:true,steer:0,paying:false});
  await page.waitForFunction(()=>document.querySelector('.room-minigame-overlay')?.dataset.pending==='false');
  const confirmed=await visualSample(page);
  await page.waitForTimeout(330);
  const advancing=await visualSample(page);
  check('control lease: confirmed reel initially approaches',advancing.fishScale>confirmed.fishScale,true);
  await page.evaluate(()=>{
    __qa.firstLeaseUntil=Date.parse(__qa.game.challenge.controlLeaseUntil);
    __qa.holdControl=true;__qa.controlWaiting=false;
  });
  await page.waitForFunction(()=>__qa.controlWaiting===true,null,{timeout:2500});
  await page.waitForFunction(()=>Date.now()>__qa.firstLeaseUntil+200,null,{timeout:2500});
  const expired=await visualSample(page);
  await page.waitForTimeout(350);
  const stalled=await visualSample(page);
  check('control lease: delayed response freezes fish approach',Math.abs(stalled.fishScale-expired.fishScale)<.001&&
    Math.abs(stalled.fishX-expired.fishX)<.01&&Math.abs(stalled.fishY-expired.fishY)<.01,true);
  check('control lease: delayed response freezes bobber approach',Math.abs(stalled.floatX-expired.floatX)<.01&&
    Math.abs(stalled.floatY-expired.floatY)<.01,true);
  check('control lease: tension remains conservative',stalled.tension>=expired.tension,true);
  await page.evaluate(()=>__qa.releaseControl());
  await page.keyboard.up('Space');
  await waitForLatestControl(page,{reeling:false,steer:0,paying:false});
}
async function runMultiTouch(page,name){
  const sea=page.locator('.room-fishing-v4-sea');
  const reelBox=await page.locator('.room-fishing-v4-reel').boundingBox();
  const payBox=await page.locator('.room-fishing-v4-pay').boundingBox();
  assert(reelBox&&payBox,`${name}: fight controls visible for two fingers`);
  const reel=ratio=>({x:reelBox.x+reelBox.width*ratio,y:reelBox.y+reelBox.height*.5,id:11});
  const pay={x:payBox.x+payBox.width*.5,y:payBox.y+payBox.height*.5,id:12};
  const cdp=await page.context().newCDPSession(page);
  const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  try{
    await touch('touchStart',[reel(.5)]);
    await waitForLatestControl(page,{reeling:true,steer:0,paying:false});
    await touch('touchStart',[reel(.5),pay]);
    await waitForLatestControl(page,{reeling:false,steer:0,paying:true});
    check(`${name}: reel then pay gives pay priority`,[await sea.getAttribute('data-reeling'),await sea.getAttribute('data-paying')],['false','true']);
    await touch('touchMove',[reel(.18),pay]);
    await waitForLatestControl(page,{reeling:false,steer:-1,paying:true});
    check(`${name}: reel move cannot cancel held pay`,await sea.getAttribute('data-paying'),'true');
    await touch('touchMove',[reel(.82),pay]);
    await waitForLatestControl(page,{reeling:false,steer:1,paying:true});
    check(`${name}: reel right move keeps held pay`,await sea.getAttribute('data-reeling'),'false');
    await touch('touchEnd',[pay]);
    await waitForLatestControl(page,{reeling:true,steer:1,paying:false});
    check(`${name}: releasing pay resumes held reel`,[await sea.getAttribute('data-reeling'),await sea.getAttribute('data-paying')],['true','false']);
    await touch('touchEnd',[]);
    await waitForLatestControl(page,{reeling:false,steer:0,paying:false});

    const reversePay={...pay,id:21};
    const reverseReel=ratio=>({...reel(ratio),id:22});
    await touch('touchStart',[reversePay]);
    await waitForLatestControl(page,{reeling:false,steer:0,paying:true});
    await touch('touchStart',[reversePay,reverseReel(.5)]);
    check(`${name}: pay then reel preserves pay`,[await sea.getAttribute('data-reeling'),await sea.getAttribute('data-paying')],['false','true']);
    await touch('touchMove',[reversePay,reverseReel(.18)]);
    await waitForLatestControl(page,{reeling:false,steer:-1,paying:true});
    await touch('touchEnd',[reverseReel(.18)]);
    await waitForLatestControl(page,{reeling:false,steer:0,paying:true});
    check(`${name}: releasing reel leaves pay held`,[await sea.getAttribute('data-reeling'),await sea.getAttribute('data-paying')],['false','true']);
    await touch('touchEnd',[]);
    await waitForLatestControl(page,{reeling:false,steer:0,paying:false});
    check(`${name}: releasing final pay is neutral`,[await sea.getAttribute('data-reeling'),await sea.getAttribute('data-paying')],['false','false']);
  }finally{await cdp.detach();}
}
async function runViewport(name,width,height,touch){
  const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
  const page=await context.newPage();
  await installHarness(page);
  try{
    for(const [label,holdMs] of [['near',130],['mid',760],['far',1630]]){
      await startCast(page);
      if(label==='near')await page.screenshot({path:path.join(out,`${name}-cast.png`),fullPage:true});
      const cast=page.locator('.room-fishing-v4-cast'),box=await cast.boundingBox();
      assert(box,`${name} ${label}: cast button visible`);
      await gesture(page,box,holdMs,[.5],touch);
      await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor({timeout:5000});
      const payload=await latestAction(page,'cast');
      assert(payload,`${name} ${label}: cast payload submitted`);
      check(`${name} ${label}: cast zone from power`,payload.castZone,zone(payload.castPower));
      check(`${name} ${label}: expected cast range`,payload.castZone,label);
      check(`${name} ${label}: integer cast power`,Number.isInteger(payload.castPower)&&
        payload.castPower>=0&&payload.castPower<=100,true);
      const point=target(payload.castPower);
      const visual=await page.locator('.room-fishing-v4-sea').evaluate(sea=>({
        x:parseFloat(sea.style.getPropertyValue('--float-x')),
        y:parseFloat(sea.style.getPropertyValue('--float-y')),
        castZone:sea.dataset.castZone
      }));
      check(`${name} ${label}: continuous bobber x`,Math.abs(visual.x-point.x)<.01,true);
      check(`${name} ${label}: continuous bobber y`,Math.abs(visual.y-point.y)<.01,true);
      check(`${name} ${label}: visual cast zone`,visual.castZone,label);
      if(label!=='far'){
        await page.evaluate(()=>{__minigame.dismiss();__minigame.open({kind:'fishing',characterId:'room-character-luffy'});});
        await page.locator('.room-fishing-v4-start').waitFor();
      }
    }
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:5000});
    await page.locator('.room-fishing-v4-hook').click();
    await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor({timeout:5000});
    const sea=page.locator('.room-fishing-v4-sea');
    check(`${name}: fight gauge visible`,await page.locator('.room-fishing-v4-gauge').isVisible(),true);
    const initialTension=Number(await page.locator('.room-fishing-v4-gauge').getAttribute('aria-valuenow'));
    check(`${name}: initial gauge near server tension`,initialTension>=60&&initialTension<=62,true);
    check(`${name}: reel and pay visible`,[
      await page.locator('.room-fishing-v4-reel').isVisible(),
      await page.locator('.room-fishing-v4-pay').isVisible()],[true,true]);
    const reel=page.locator('.room-fishing-v4-reel');await reel.scrollIntoViewIfNeeded();
    const reelBox=await reel.boundingBox();assert(reelBox,`${name}: reel visible`);
    const y=reelBox.y+reelBox.height*.5,x=ratio=>reelBox.x+reelBox.width*ratio;
    if(touch){
      const cdp=await page.context().newCDPSession(page);
      const move=async(type,ratio)=>cdp.send('Input.dispatchTouchEvent',{type,
        touchPoints:type==='touchEnd'?[]:[{x:x(ratio),y,id:2}]});
      await move('touchStart',.5);await waitForLatestControl(page,{reeling:true,steer:0,paying:false});
      for(const [ratio,steer] of [[.18,-1],[.5,0],[.82,1]]){
        await move('touchMove',ratio);await waitForLatestControl(page,{reeling:true,steer,paying:false});
        check(`${name}: reel drag steer ${steer}`,await sea.getAttribute('data-steer'),String(steer));
        await checkRodSteer(page,name,steer);
      }
      await move('touchEnd',.82);await cdp.detach();
    }else{
      await page.mouse.move(x(.5),y);await page.mouse.down();
      await waitForLatestControl(page,{reeling:true,steer:0,paying:false});
      for(const [ratio,steer] of [[.18,-1],[.5,0],[.82,1]]){
        await page.mouse.move(x(ratio),y,{steps:5});await waitForLatestControl(page,{reeling:true,steer,paying:false});
        check(`${name}: reel drag steer ${steer}`,await sea.getAttribute('data-steer'),String(steer));
        await checkRodSteer(page,name,steer);
      }
      await page.mouse.up();
    }
    await waitForControl(page,{reeling:false,steer:0,paying:false});
    check(`${name}: reel release clears hold`,await sea.getAttribute('data-reeling'),'false');
    const before=Number(await page.locator('.room-fishing-v4-gauge').getAttribute('aria-valuenow'));
    const needleBefore=await page.locator('.room-fishing-v4-gauge-needle').evaluate(node=>node.style.transform);
    const pay=page.locator('.room-fishing-v4-pay');const payBox=await pay.boundingBox();assert(payBox,`${name}: pay button visible`);
    await gesture(page,payBox,220,[.5],touch);
    await waitForControl(page,{reeling:false,steer:0,paying:true});
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.paying==='false');
    const payControls=await page.evaluate(()=>__qa.calls.filter(call=>call.type==='minigame.answer'&&
      call.payload.counterMoves?.[0]==='control').map(call=>call.payload));
    const heldIndex=payControls.findLastIndex(control=>control.paying===true);
    check(`${name}: pay release sends neutral control`,heldIndex>=0&&
      payControls.slice(heldIndex+1).some(control=>control.reeling===false&&control.paying===false),true);
    const after=Number(await page.locator('.room-fishing-v4-gauge').getAttribute('aria-valuenow'));
    check(`${name}: paying reduces gauge`,after<before,true);
    check(`${name}: pay release clears hold`,await sea.getAttribute('data-paying'),'false');
    check(`${name}: gauge needle changes after paying`,
      await page.locator('.room-fishing-v4-gauge-needle').evaluate((node,prior)=>node.style.transform!==prior,needleBefore),true);
    const geometry=await page.evaluate(()=>{
      const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,right:r.right,width:r.width};};
      const sea=rect('.room-fishing-v4-sea');
      return{pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,
        cardWidth:document.querySelector('.room-minigame-card').scrollWidth,
        cardClient:document.querySelector('.room-minigame-card').clientWidth,
        sea,reel:rect('.room-fishing-v4-reel'),pay:rect('.room-fishing-v4-pay'),
        gauge:rect('.room-fishing-v4-gauge'),direction:rect('.room-fishing-v4-direction')};
    });
    check(`${name}: no page horizontal overflow`,geometry.pageWidth<=geometry.viewport+1,true);
    check(`${name}: no card horizontal overflow`,geometry.cardWidth<=geometry.cardClient+1,true);
    for(const key of ['reel','pay','gauge','direction'])
      check(`${name}: ${key} inside sea`,geometry[key].x>=geometry.sea.x-1&&geometry[key].right<=geometry.sea.right+1,true);
    await page.screenshot({path:path.join(out,`${name}-fight.png`),fullPage:true});
    if(touch)await runMultiTouch(page,name);
    else{await runKeyboard(page,context);await runCastDuringSync(page);await runVisualPredictionAndConfirm(page,name);await runDelayedPaySafety(page);await runExpiredControlLease(page);}
    check(`${name}: no pageerror`,pageErrors.length,0);
  }finally{await context.close();}
}

async function main(){
  fs.mkdirSync(out,{recursive:true});
  try{
    await startServer();
    browser=await chromium.launch({headless:true,executablePath:chrome,
      args:['--disable-gpu-shader-disk-cache']});
    await runViewport('desktop-1280',1280,800,false);
    await runViewport('mobile-390',390,844,true);
    check('all routed fishing art available',missingAssets.length,0);
    const report={schema:'launcher-fishing-controls-browser-qa/1',status:'PASS',checks:checks.length,
      results:checks,pageErrors,missingAssets,viewports:['1280x800 mouse','390x844 touch'],
      limitations:['Mocked minigame API; validates real Chromium pointer/touch UI and payloads, not server timing or physical-device touch.']};
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({status:report.status,checks:report.checks,out}));
  }catch(error){
    const report={schema:'launcher-fishing-controls-browser-qa/1',status:'FAIL',checks:checks.length,
      results:checks,pageErrors,missingAssets,error:String(error.stack||error)};
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
    throw error;
  }finally{
    if(browser)await browser.close();
    if(server)await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
