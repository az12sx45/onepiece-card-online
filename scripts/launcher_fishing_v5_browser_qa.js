'use strict';

// Browser interaction and geometry QA. The command transport uses the real
// launcher-minigames core; only account storage and final reward settlement
// are replaced with an in-process fixture. This is deliberately not a claim
// that a live account or a physical Wii controller was tested.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const minigames=require('../server/launcher-minigames');
const fishingV5=require('../server/launcher-fishing-v5');
const root=path.resolve(__dirname,'..');
const out=process.env.LAUNCHER_FISH_V5_BROWSER_QA_OUT||'D:/Codex_QA/launcher-fishing-wii-1.2.22/browser-final-r7';
const runtimeBase=path.join(process.env.LOCALAPPDATA||'','OpenAI/Codex/runtimes/cua_node');
const playwrightPath=fs.existsSync(runtimeBase)?fs.readdirSync(runtimeBase)
  .map(name=>path.join(runtimeBase,name,'bin/node_modules/playwright')).find(fs.existsSync):null;
const {chromium}=require(process.env.BOARD_QA_PLAYWRIGHT||playwrightPath||'playwright');
const chrome=process.env.BOARD_QA_CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const html='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%;background:#071b27;color:#fff;font-family:Arial,"Microsoft JhengHei",sans-serif}</style><link rel="stylesheet" href="/desktop/launcher-room-minigames.css"><body><script src="/desktop/launcher-room-minigames.js"></script></body></html>';
const sessions=new Map(),checks=[],pageErrors=[],missingAssets=[];
const forcedSpecies=new Map([['light-force','lovely-angel'],['heavy-force','golden-whale'],
  ['flick-up','glistening-saury'],['flick-right','glistening-saury'],['flick-left','glistening-saury']]);
const flickSeeds={'flick-up':48,'flick-right':56,'flick-left':57};
let server,browser;
const check=(name,condition)=>{assert(condition,name);checks.push(name);};
const readJson=req=>new Promise((resolve,reject)=>{
  let body='';req.on('data',part=>{body+=part;if(body.length>100000)reject(new Error('QA request too large'));});
  req.on('end',()=>{try{resolve(JSON.parse(body));}catch(error){reject(error);}});req.on('error',reject);
});
const respond=(res,data)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
async function command(client,type,payload){
  const now=new Date();let session=sessions.get(client);
  if(type==='minigame.start'){
    const version=client==='legacy'?4:5;
    session=minigames.create('fishing','room-character-luffy',1,now,false,'supply',version,
      payload.baitId||'worm',payload.spotId||'shore',0,payload.flickMode===true&&Object.hasOwn(flickSeeds,client));
    session.challenge.motionSeed=flickSeeds[client]??70;sessions.set(client,session);
    return{ok:true,serverNow:now.toISOString(),minigame:minigames.view(session)};
  }
  if(type==='minigame.cancel'){
    if(session)session.state='cancelled';sessions.delete(client);
    return{ok:true,serverNow:now.toISOString()};
  }
  if(type==='fish.place')return{ok:true,serverNow:now.toISOString()};
  if(!session)return{ok:false,error:'invalid_minigame_session',serverNow:now.toISOString()};
  if(type==='minigame.answer'){
    const result=minigames.answer(session,payload,now);
    // A fixture selects two existing fish after a genuine cast. The product
    // route has no client-selectable species and the real answer core still
    // decides the bite, fight, and strength changes.
    if(result&&!result.error&&payload.counterMoves?.[0]==='cast'&&forcedSpecies.has(client))
      session.catchSpeciesId=forcedSpecies.get(client);
    return{ok:!result.error,...result,serverNow:now.toISOString(),minigame:minigames.view(session)};
  }
  if(type==='minigame.finish'){
    if(session.roundIndex!==1)return{ok:false,error:'minigame_not_ready',serverNow:now.toISOString()};
    session.state='completed';
    session.result={passed:session.feedback?.reason==='landed',
      ...(session.feedback?.reason==='landed'?{catch:{id:`browser-fish-${client}`,speciesId:'balloon-catfish',label:'氣球鯰魚',
        ...(client==='desktop'?{rarity:'legendary'}:{})}}:{})};
    return{ok:true,serverNow:now.toISOString(),minigame:minigames.view(session)};
  }
  return{ok:false,error:'invalid_qa_command',serverNow:now.toISOString()};
}
async function serve(){
  server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost'),rel=decodeURIComponent(url.pathname).replace(/^\//,'');
      const client=url.searchParams.get('client')||'desktop';
      if(rel==='qa-command'&&req.method==='POST'){
        const {type,payload}=await readJson(req);respond(res,await command(client,type,payload));return;
      }
      if(rel==='qa-land'&&req.method==='POST'){
        const session=sessions.get(client);
        if(!session||session.challenge?.stage!=='fight'){respond(res,{ok:false});return;}
        // UI settlement fixture: the engine itself still decides the landing
        // on the next genuine sync/control call.
        session.challenge.distance=-1;session.challenge.strength=Math.max(50,session.challenge.strength);
        respond(res,{ok:true});return;
      }
      if(rel==='qa-miss'&&req.method==='POST'){
        const session=sessions.get(client);
        if(!session||session.challenge?.stage!=='wait'){respond(res,{ok:false});return;}
        // The normal timeout action settles a bite that was missed; only its
        // authoritative deadline is accelerated for this sound regression.
        session.challenge.hookUntil=new Date(Date.now()-1000).toISOString();
        respond(res,{ok:true});return;
      }
      if(rel==='qa-cast-target'&&req.method==='POST'){
        const session=sessions.get(client),{zone}=await readJson(req);
        if(session?.challenge?.stage!=='wait'||!['near','far'].includes(zone)){
          respond(res,{ok:false});return;
        }
        // Visual fixture: keep the real cast round waiting while the same
        // renderer is sampled at two server-authoritative landing points.
        session.challenge.castTarget={...minigames.FISHING_CAST_ZONES[zone]};
        session.challenge.castZone=zone;
        const later=Date.now()+12000;
        session.challenge.nibbleAt=new Date(later-1150).toISOString();
        session.challenge.biteAt=new Date(later).toISOString();
        session.challenge.hookUntil=new Date(later+3000).toISOString();
        respond(res,{ok:true});return;
      }
      if(rel==='qa-distance'&&req.method==='POST'){
        const session=sessions.get(client),{distance}=await readJson(req);
        if(!session||session.challenge?.stage!=='fight'||!Number.isFinite(distance)||distance<10||distance>90){
          respond(res,{ok:false});return;
        }
        // Test bridge only: let the real sync core publish two controlled
        // distances so the ruler's travel direction can be inspected.
        session.challenge.distance=distance;
        respond(res,{ok:true});return;
      }
      if(rel==='qa-strength'&&req.method==='POST'){
        const session=sessions.get(client),{strength}=await readJson(req);
        if(!session||session.challenge?.stage!=='fight'||!Number.isFinite(strength)||strength<10||strength>90){
          respond(res,{ok:false});return;
        }
        session.challenge.strength=strength;session.challenge.tension=100-strength;
        respond(res,{ok:true});return;
      }
      if(!rel){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
      if(!['desktop/launcher-room-minigames.js','desktop/launcher-room-minigames.css'].includes(rel)){
        res.writeHead(404);res.end();return;
      }
      res.setHeader('Content-Type',rel.endsWith('.css')?'text/css':'text/javascript');
      res.end(fs.readFileSync(path.join(root,rel)));
    }catch(error){res.writeHead(500);res.end(error.stack||String(error));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
}
async function setup(page,client){
  await page.route('opui://**',route=>{
    const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');
    const file=path.join(root,'public',rel);
    if(rel.includes('..')||!fs.existsSync(file)){missingAssets.push(rel);return route.fulfill({status:404,body:'missing'});}
    return route.fulfill({path:file});
  });
  page.on('pageerror',error=>pageErrors.push(`${client}: ${error.message}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
  await page.evaluate(client=>{
    window.__qa={client,calls:[],responses:[],pointerEvents:[],soundStarts:[],noiseStarts:[],audioCloses:0,audioSuspends:0};
    if(window.OscillatorNode){
      const start=OscillatorNode.prototype.start;
      OscillatorNode.prototype.start=function(...args){__qa.soundStarts.push({at:performance.now(),frequency:this.frequency.value});return start.apply(this,args);};
    }
    if(window.AudioBufferSourceNode){
      const start=AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start=function(...args){__qa.noiseStarts.push(performance.now());return start.apply(this,args);};
    }
    if(window.AudioContext){
      const createOscillator=AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator=function(...args){__qa.audioContext=this;return createOscillator.apply(this,args);};
      const close=AudioContext.prototype.close;
      AudioContext.prototype.close=function(...args){__qa.audioCloses++;return close.apply(this,args);};
      const suspend=AudioContext.prototype.suspend;
      AudioContext.prototype.suspend=function(...args){__qa.audioSuspends++;return suspend.apply(this,args);};
    }
    for(const type of ['pointerdown','pointerup','pointercancel','click'])document.addEventListener(type,event=>{
      if(event.target.closest?.('.room-fishing-v4-cast'))__qa.pointerEvents.push({type,button:event.button,
        pointerType:event.pointerType,detail:event.detail,disabled:event.target.closest('.room-fishing-v4-cast')?.disabled,
        phase:__minigame?.inspect?.().phase,charging:document.querySelector('.room-fishing-v4-sea')?.dataset.charging,
        power:Number(document.querySelector('.room-fishing-v4-cast-track')?.getAttribute('aria-valuenow'))});
    },true);
    const command=async(type,payload)=>{
      __qa.calls.push({type,payload:JSON.parse(JSON.stringify(payload)),at:Date.now()});
      const response=await fetch(`/qa-command?client=${client}`,{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({type,payload})});
      const data=await response.json();__qa.responses.push({type,data,at:Date.now()});return data;
    };
    window.__minigame=OnePieceRoomMinigames.create({fishCollection:()=>[],command,
      onOpen:()=>{},onClose:()=>{},onResult:()=>{}});
    __minigame.open({kind:'fishing',characterId:'room-character-luffy'});
  },client);
}
const actionCalls=(page,move)=>page.evaluate(move=>__qa.calls.filter(item=>
  item.type==='minigame.answer'&&item.payload.counterMoves?.[0]===move),move);
async function snapshot(page,name){
  await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true});
}
async function holdPointer(page,locator,ms,ratio=.5){
  const box=await locator.boundingBox();assert(box,'control hit area must be visible');
  const x=box.x+box.width*ratio,y=box.y+box.height*.5;
  await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(ms);await page.mouse.up();
}
async function oscillatingCast(page,locator){
  const box=await locator.boundingBox();assert(box,'cast button hit area');
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();
  const samples=[];
  for(const delay of [350,850,1250,700]){
    await page.waitForTimeout(delay);
    samples.push({at:Date.now(),power:(await visual(page)).castPower});
  }
  await page.mouse.up();
  return samples;
}
async function lineGeometry(page){
  return page.locator('.room-fishing-v4-sea').evaluate(sea=>{
    const rod=sea.querySelector('.room-fishing-v4-rod');
    const lines=[...sea.querySelectorAll('.room-fishing-v4-line path')];
    const d=lines[0]?.getAttribute('d')||'';
    const move=/^M\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(d);
    const finish=/\s(-?[\d.]+)\s+(-?[\d.]+)$/.exec(d);
    if(!move||!finish)return null;
    const width=rod.offsetWidth,height=rod.offsetHeight;
    const style=getComputedStyle(rod),origin=style.transformOrigin.split(' ').map(parseFloat);
    let tip,artWidth=width,artHeight=height;
    const atlasMarker=rod.querySelector('.room-fishing-v5-rod-tip');
    if(atlasMarker){
      const marker=atlasMarker.getBoundingClientRect(),scene=sea.getBoundingClientRect();
      tip={x:marker.left+marker.width/2-scene.left,y:marker.top+marker.height/2-scene.top};
    }else{
      if(!rod.naturalWidth||!rod.naturalHeight)return null;
      artWidth=Math.min(width,height*rod.naturalWidth/rod.naturalHeight);
      artHeight=artWidth*rod.naturalHeight/rod.naturalWidth;
      const localX=(width-artWidth)/2+artWidth*1484/1536;
      const localY=(height-artHeight)/2+artHeight*42/1024;
      const matrix=new DOMMatrixReadOnly(style.transform),dx=localX-origin[0],dy=localY-origin[1];
      tip={x:rod.offsetLeft+origin[0]+matrix.a*dx+matrix.c*dy+matrix.e,
        y:rod.offsetTop+origin[1]+matrix.b*dx+matrix.d*dy+matrix.f};
    }
    const start={x:Number(move[1])*sea.clientWidth/1000,y:Number(move[2])*sea.clientHeight/600};
    const svg=sea.querySelector('.room-fishing-v4-line'),svgRect=svg.getBoundingClientRect();
    const end={x:svgRect.left+Number(finish[1])*svgRect.width/1000,
      y:svgRect.top+Number(finish[2])*svgRect.height/600};
    const bobber=sea.querySelector('.room-fishing-v4-bobber'),bobRect=bobber.getBoundingClientRect();
    const bobStyle=getComputedStyle(bobber),scale=parseFloat(bobStyle.scale)||1;
    const tilt=(parseFloat(sea.style.getPropertyValue('--bob-tilt'))||0)*Math.PI/180;
    const paintedWidth=Math.min(bobber.offsetWidth,bobber.offsetHeight*bobber.naturalWidth/bobber.naturalHeight);
    const paintedHeight=paintedWidth*bobber.naturalHeight/bobber.naturalWidth;
    // The bobber image's transparent top-ring hole spans source y=95..187,
    // centered at 141/1199; use painted content, not its letterboxed CSS box.
    const radius=paintedHeight*(.5-141/1199)*scale*(sea.dataset.biting==='true'?.82:1);
    const center={x:(bobRect.left+bobRect.right)/2,y:(bobRect.top+bobRect.bottom)/2};
    const ring={x:center.x+Math.sin(tilt)*radius,y:center.y-Math.cos(tilt)*radius};
    const splash=sea.querySelector('.room-fishing-v4-splash'),splashRect=splash.getBoundingClientRect();
    const splashCenter={x:(splashRect.left+splashRect.right)/2,y:(splashRect.top+splashRect.bottom)/2};
    const rodRect=rod.getBoundingClientRect();
    return{paths:lines.map(line=>line.getAttribute('d')),
      rod:{naturalWidth:rod.naturalWidth||0,naturalHeight:rod.naturalHeight||0,
        offsetLeft:rod.offsetLeft,offsetTop:rod.offsetTop,offsetWidth:width,offsetHeight:height,
        contentWidth:artWidth,contentHeight:artHeight,transform:style.transform,
        transformOrigin:style.transformOrigin,
        rect:{x:rodRect.x,y:rodRect.y,width:rodRect.width,height:rodRect.height}},
      tipGap:Math.hypot(tip.x-start.x,tip.y-start.y),ringGap:Math.hypot(end.x-ring.x,end.y-ring.y),
      splashGap:Math.hypot(end.x-splashCenter.x,end.y-splashCenter.y),
      start,end,ring,center,splashCenter,bobber:{rect:{x:bobRect.x,y:bobRect.y,width:bobRect.width,height:bobRect.height},
        offsetWidth:bobber.offsetWidth,offsetHeight:bobber.offsetHeight,naturalWidth:bobber.naturalWidth,
        naturalHeight:bobber.naturalHeight,paintedWidth,paintedHeight,scale,
        tiltDegrees:tilt*180/Math.PI,transform:bobStyle.transform},
      sea:{width:sea.clientWidth,height:sea.clientHeight},svg:{width:svgRect.width,height:svgRect.height}};
  });
}
async function visual(page){
  return page.locator('.room-fishing-v4-sea').evaluate(sea=>({
    fishX:parseFloat(sea.style.getPropertyValue('--fish-x')),
    fishY:parseFloat(sea.style.getPropertyValue('--fish-y')),
    floatX:parseFloat(sea.style.getPropertyValue('--float-x')),
    floatY:parseFloat(sea.style.getPropertyValue('--float-y')),
    strength:Number(document.querySelector('.room-fishing-v5-dial')?.getAttribute('aria-valuenow')||
      sea.querySelector('.room-fishing-v4-gauge')?.getAttribute('aria-valuenow')),
    direction:sea.dataset.pullDirection,run:sea.dataset.runState,
    steer:sea.dataset.steer,reeling:sea.dataset.reeling,paying:sea.dataset.paying,
    directionPills:sea.querySelectorAll('.room-fishing-v5-bearing,.room-fishing-v5-aim').length,
    castPower:Number(sea.querySelector('.room-fishing-v4-cast-track').getAttribute('aria-valuenow')),
    pullIntensity:Number.parseFloat(sea.style.getPropertyValue('--pull-intensity')),
    pullBend:Number.parseFloat(sea.style.getPropertyValue('--pull-bend')),
    bobTilt:Number.parseFloat(sea.style.getPropertyValue('--bob-tilt')),
    pullPeriod:Number.parseFloat(sea.style.getPropertyValue('--pull-period')),
    splashOpacity:Number(getComputedStyle(sea.querySelector('.room-fishing-v4-splash')).opacity),
    pullDial:Number(document.querySelector('.room-fishing-v5-dial')?.getAttribute('aria-valuenow')),
    pullArcGrade:Number(document.querySelector('.room-fishing-v5-pull-arc')?.getAttribute('aria-valuenow')),
    pullArcFill:Number.parseFloat(document.querySelector('.room-fishing-v5-hud')?.style.getPropertyValue('--pull-fill')),
    pullNeedleY:Number.parseFloat(document.querySelector('.room-fishing-v5-hud')?.style.getPropertyValue('--pull-needle-y')),
    rodTransform:getComputedStyle(sea.querySelector('.room-fishing-v4-rod')).transform,
    rodAngle:(()=>{const matrix=new DOMMatrixReadOnly(getComputedStyle(sea.querySelector('.room-fishing-v4-rod')).transform);
      return Math.atan2(matrix.b,matrix.a)*180/Math.PI;})()
  }));
}
async function bobberVisible(page){
  return page.locator('.room-fishing-v4-sea').evaluate(sea=>{
    const bobber=sea.querySelector('.room-fishing-v4-bobber'),cue=sea.querySelector('.room-fishing-v4-direction');
    const a=bobber.getBoundingClientRect(),b=cue?.getBoundingClientRect(),s=sea.getBoundingClientRect();
    const overlap=b?Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*
      Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)):0;
    return{loaded:bobber.complete&&bobber.naturalWidth>0,inside:a.left>=s.left&&a.right<=s.right&&
      a.top>=s.top&&a.bottom<=s.bottom,overlap,opacity:Number(getComputedStyle(bobber).opacity),
      bobber:{x:a.x,y:a.y,width:a.width,height:a.height},cue:b?{x:b.x,y:b.y,width:b.width,height:b.height}:null};
  });
}
async function fightWaterVisual(page){
  return page.locator('.room-fishing-v4-sea').evaluate(sea=>{
    const bobber=sea.querySelector('.room-fishing-v4-bobber'),splash=sea.querySelector('.room-fishing-v4-splash');
    const splashBox=splash.getBoundingClientRect(),seaBox=sea.getBoundingClientRect();
    return{bobberHidden:getComputedStyle(bobber).display==='none'||getComputedStyle(bobber).visibility==='hidden',
      splashLoaded:splash.complete&&splash.naturalWidth>0,
      splashVisible:Number(getComputedStyle(splash).opacity)>.1&&splashBox.width>0&&splashBox.height>0,
      splashInside:splashBox.left>=seaBox.left-1&&splashBox.right<=seaBox.right+1&&
        splashBox.top>=seaBox.top-1&&splashBox.bottom<=seaBox.bottom+1};
  });
}
async function waterPerspective(page){
  return page.locator('.room-fishing-v4-sea').evaluate(sea=>{
    const seaBox=sea.getBoundingClientRect();
    const splash=sea.querySelector('.room-fishing-v4-splash').getBoundingClientRect();
    const bobber=sea.querySelector('.room-fishing-v4-bobber').getBoundingClientRect();
    return{floatX:parseFloat(sea.style.getPropertyValue('--float-x')),
      floatY:parseFloat(sea.style.getPropertyValue('--float-y')),
      splashWidth:splash.width,splashHeight:splash.height,
      splashX:(splash.left+splash.right)/2-seaBox.left,
      splashY:(splash.top+splash.bottom)/2-seaBox.top,
      bobberWidth:bobber.width,bobberHeight:bobber.height,
      bobberX:(bobber.left+bobber.right)/2-seaBox.left,
      bobberY:(bobber.top+bobber.bottom)/2-seaBox.top,
      seaWidth:seaBox.width,seaHeight:seaBox.height};
  });
}
async function headerVisible(page){
  return page.locator('.room-minigame-card').evaluate(card=>{
    const eyebrow=card.querySelector('.room-minigame-head .room-minigame-eyebrow');
    const a=eyebrow.getBoundingClientRect(),b=card.getBoundingClientRect();
    return{visible:a.top>=b.top+1&&a.bottom<=b.bottom-1&&a.top>=0&&a.bottom<=innerHeight,
      eyebrowTop:a.top,cardTop:b.top,scrollTop:card.scrollTop};
  });
}
async function fightUiGeometry(page){
  return page.locator('.room-minigame-card').evaluate(card=>{
    const hud=card.querySelector('.room-fishing-v5-hud'),progress=card.querySelector('.room-minigame-progress');
    const sea=card.querySelector('.room-fishing-v4-sea'),controls=sea.querySelector('.room-fishing-v4-fight-controls');
    const cardBox=card.getBoundingClientRect(),progressBox=progress.getBoundingClientRect();
    const hudBox=hud?.getBoundingClientRect(),controlBox=controls.getBoundingClientRect(),seaBox=sea.getBoundingClientRect();
    const fits=rect=>rect&&rect.width>0&&rect.height>0&&rect.left>=cardBox.left-1&&
      rect.right<=cardBox.right+1&&rect.top>=0&&rect.bottom<=innerHeight+1;
    return{hudVisible:fits(hudBox)&&[...hud.children].every(child=>
      getComputedStyle(child).display==='none'||fits(child.getBoundingClientRect())),
      controlsVisible:fits(controlBox)&&[...controls.querySelectorAll('button')].every(button=>fits(button.getBoundingClientRect())),
      compactRightPad:controlBox.left>=seaBox.left+seaBox.width*.72&&controlBox.right<=seaBox.right&&
        controlBox.top>=seaBox.top+seaBox.height*.2&&controlBox.bottom<=seaBox.top+seaBox.height*.72&&
        controlBox.height<seaBox.height*.44,
      noHorizontalOverflow:card.scrollWidth<=card.clientWidth+1&&progress.scrollWidth<=progress.clientWidth+1,
      hudBox:hudBox&&{left:hudBox.left,right:hudBox.right,top:hudBox.top,bottom:hudBox.bottom},
      progressBox:{left:progressBox.left,right:progressBox.right,top:progressBox.top,bottom:progressBox.bottom},
      controlBox:{left:controlBox.left,right:controlBox.right,top:controlBox.top,bottom:controlBox.bottom}};
  });
}
async function fightMeterState(page){
  return page.locator('.room-fishing-v5-hud').evaluate(hud=>{
    const challenge=window.__qa.responses.filter(item=>
      item.data?.minigame?.challenge?.stage==='fight').at(-1)?.data.minigame.challenge;
    const dial=hud.querySelector('.room-fishing-v5-dial'),dialBox=dial.getBoundingClientRect();
    const arc=hud.querySelector('.room-fishing-v5-pull-arc');
    const progress=hud.querySelector('.room-fishing-v5-catch-track');
    const rail=hud.querySelector('.room-fishing-v5-catch-rail').getBoundingClientRect();
    const fill=hud.querySelector('.room-fishing-v5-catch-fill').getBoundingClientRect();
    const marker=hud.querySelector('.room-fishing-v5-rail-marker').getBoundingClientRect();
    const pressureRing=hud.querySelector('.room-fishing-v5-pressure-ring');
    const pressureBox=pressureRing.getBoundingClientRect();
    return{challenge:challenge&&{pullIntensity:challenge.pullIntensity,strength:challenge.strength,
      maxStrength:challenge.maxStrength,distance:challenge.distance,castTarget:challenge.castTarget},
       dial:Number(dial.getAttribute('aria-valuenow')),dialVisible:dialBox.width>=90&&dialBox.height>=90,
       pressureAngle:Number.parseFloat(hud.style.getPropertyValue('--pressure-angle')),
       pressureRingVisible:pressureBox.width>=80&&getComputedStyle(pressureRing).display!=='none',
       pressureRisk:hud.dataset.pressureRisk,
       pressureColor:getComputedStyle(hud).getPropertyValue('--pressure-tone').trim(),
       ringGradient:getComputedStyle(pressureRing).backgroundImage,
       pressureLabel:hud.querySelector('.room-fishing-v5-strength-copy>span')?.textContent,
      arcGrade:Number(arc.getAttribute('aria-valuenow')),
      arcFill:Number.parseFloat(hud.style.getPropertyValue('--pull-fill')),
      needleX:Number.parseFloat(hud.style.getPropertyValue('--pull-needle-x')),
      needleY:Number.parseFloat(hud.style.getPropertyValue('--pull-needle-y')),
      needleVisible:(()=>{const box=hud.querySelector('.room-fishing-v5-pull-needle').getBoundingClientRect();
        return box.width>=10&&box.height>=6;})(),
      staticOuterRing:getComputedStyle(dial,'::after').transform==='none'&&
        getComputedStyle(dial,'::after').animationName==='none',
      arcVisible:arc.getBoundingClientRect().width>=50,
       strengthHint:hud.querySelector('.room-fishing-v5-strength-value')?.textContent,
       pressure:hud.querySelector('.room-fishing-v5-pressure-value').textContent,
      distanceLabel:hud.querySelector('.room-fishing-v5-distance').textContent,
      progress:Number(progress.getAttribute('aria-valuenow')),
      fillRatio:rail.width>0?fill.width/rail.width:NaN,
      markerRatio:rail.width>0?((marker.left+marker.right)/2-rail.left)/rail.width:NaN,
      markerCenter:(marker.left+marker.right)/2,
      progressVisible:rail.width>=100&&rail.height>=10};
  });
}
function meterMatchesServer(meter){
  const server=meter.challenge;if(!server)return false;
  const grade=server.pullIntensity<.25?0:server.pullIntensity<.58?1:server.pullIntensity<.82?2:3;
  const remaining=Math.round(server.strength/server.maxStrength*100);
  const ratio=server.strength/server.maxStrength;
  const risk=ratio<=.26?'danger':ratio<=.52?'warning':'safe';
  const castFarness=Math.max(0,Math.min(1,(.55-(server.castTarget?.y??.45))/.21));
  const meters=(server.distance/100*(18+36*castFarness)).toFixed(1)+' m';
  return Math.abs(meter.dial-remaining)<=2&&meter.pressureRingVisible&&
    Math.abs(meter.pressureAngle-meter.dial*3)<2&&meter.pressure===`${meter.dial}%`&&
    meter.pressureRisk===risk&&meter.pressureLabel==='耐壓'&&meter.strengthHint==='0% 斷線'&&
    meter.ringGradient.includes('conic-gradient')&&
    meter.arcGrade===grade&&Math.abs(meter.arcFill-server.pullIntensity*100)<1&&
    Math.abs(meter.needleX-(21+54*Math.sin(Math.PI*server.pullIntensity)))<1&&
    Math.abs(meter.needleY-(88-76*server.pullIntensity))<1&&
    meter.progress===Math.round(server.distance)&&meter.distanceLabel===meters&&
    Math.abs(meter.fillRatio-meter.progress*.82/100)<.035&&
    Math.abs(meter.markerRatio-(.11+meter.progress*.82/100))<.035;
}
async function resultActionVisible(page){
  return page.locator('.room-minigame-card').evaluate(card=>{
    const buttons=[...card.querySelectorAll('.room-minigame-result-actions button')];
    const bounds=card.getBoundingClientRect();
    return{visible:buttons.some(button=>{
      const r=button.getBoundingClientRect();
      return r.width>0&&r.height>0&&r.top>=bounds.top&&r.bottom<=bounds.bottom&&
        r.top>=0&&r.bottom<=innerHeight;
    }),buttons:buttons.map(button=>({text:button.textContent,top:button.getBoundingClientRect().top,
      bottom:button.getBoundingClientRect().bottom})),cardBottom:bounds.bottom,scrollTop:card.scrollTop};
  });
}
async function catchArtVisible(page){
  return page.locator('.room-minigame-card').evaluate(card=>{
    const art=card.querySelector('.room-fishing-v3-catch-art');
    const actions=card.querySelector('.room-minigame-result-actions');
    const a=art.getBoundingClientRect(),b=card.getBoundingClientRect(),c=actions.getBoundingClientRect();
    return{loaded:art.complete&&art.naturalWidth>0,fullyVisible:a.width>0&&a.height>0&&
      a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom&&
      a.top>=0&&a.bottom<=innerHeight,separateFromActions:a.bottom<c.top,
      fish:{top:a.top,bottom:a.bottom,width:a.width,height:a.height},actionTop:c.top};
  });
}
async function begin(page,label){
  check(`${label}: intro has no separate sound control`,
    await page.locator('.room-fishing-v4-intro-scene .room-fishing-sfx').count()===0);
  await page.getByRole('button',{name:'開始釣魚'}).click();
  await page.locator('.room-fishing-v4-sea[data-stage="cast"]').waitFor();
  check(`${label}: v5 is selected`,await page.locator('.fishing-v5').count()===1);
  check(`${label}: v5 server core starts`,sessions.get(label)?.challenge.fishingVersion===5);
  check(`${label}: v5 removes old dial and side card`,await page.locator('.room-fishing-v4-gauge,.room-fishing-v4-direction').count()===0);
  await snapshot(page,`${label}-cast`);
}
async function castAndHook(page,label){
  const cast=page.locator('.room-fishing-v4-cast');await cast.scrollIntoViewIfNeeded();
  const soundBeforeCast=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length}));
  const powerBefore=(await visual(page)).castPower;
  const sweep=label==='desktop'?await oscillatingCast(page,cast):null;
  if(!sweep)await holdPointer(page,cast,730);
  await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor({timeout:5000});
  const soundAfterCast=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length}));
  check(`${label}: charged cast, release and confirmed splash emit layered original audio`,
    soundAfterCast.tones-soundBeforeCast.tones>=3&&soundAfterCast.noise-soundBeforeCast.noise>=2);
  const calls=await actionCalls(page,'cast'),power=calls.at(-1)?.payload.castPower;
  const pointerEvents=await page.evaluate(()=>__qa.pointerEvents);
  fs.writeFileSync(path.join(out,`${label}-cast-diagnostics.json`),JSON.stringify({power,powerBefore,sweep,calls,pointerEvents},null,2));
  if(sweep){
    check(`${label}: power rises then falls during a held cast`,sweep[1].power>=80&&sweep[2].power<=25&&
      sweep[1].power-sweep[0].power>=40&&sweep[3].power-sweep[2].power>=25);
    check(`${label}: power begins a second sweep before release`,sweep[3].power>=35&&sweep[3].power<=85);
  }
  check(`${label}: cast sends power at pointer release`,Number.isInteger(power)&&power>=0&&power<=100&&
    Math.abs(power-pointerEvents.filter(event=>event.type==='pointerup').at(-1)?.power)<=8);
  check(`${label}: cast zone matches released power`,calls.at(-1)?.payload.castZone===
    (power<35?'near':power<70?'mid':'far'));
  check(`${label}: server uses matching zone`,sessions.get(label)?.challenge.castZone===calls.at(-1)?.payload.castZone);
  const transition=await page.locator('.room-fishing-v4-sea').evaluate(sea=>({
    castRelease:sea.classList.contains('cast-release'),
    lineSettling:sea.classList.contains('line-settling'),
    lineOpacity:Number(getComputedStyle(sea.querySelector('.room-fishing-v4-line-thread')).opacity)}));
  fs.writeFileSync(path.join(out,`${label}-cast-transition.json`),JSON.stringify(transition,null,2));
  check(`${label}: cast swing cannot show a detached line`,!transition.lineSettling||transition.lineOpacity<.1);
  await snapshot(page,`${label}-cast-transition`);
  // The cast-release rod pose has a short transition; inspect the settled
  // waiting pose separately from the snap animation.
  await page.waitForTimeout(950);
  const waitHeader=await headerVisible(page);
  check(`${label}: header fully visible while waiting`,waitHeader.visible);
  check(`${label}: hook available only after bite`,await page.locator('.room-fishing-v4-hook').isDisabled()||
    await page.locator('.room-fishing-v4-sea').getAttribute('data-biting')==='true');
  const waitLine=await lineGeometry(page);check(`${label}: waiting line joins rod and bobber`,
    waitLine&&waitLine.tipGap<3&&waitLine.ringGap<8&&waitLine.paths[0]===waitLine.paths[1]);
  fs.writeFileSync(path.join(out,`${label}-wait-line-diagnostics.json`),JSON.stringify(waitLine,null,2));
  const waitBobber=await bobberVisible(page);
  check(`${label}: waiting bobber fully visible`,waitBobber.loaded&&waitBobber.inside&&waitBobber.opacity>.5&&waitBobber.overlap===0);
  check(`${label}: waiting sea hides decorative fish silhouette`,await page.locator('.room-fishing-v4-fish').evaluate(fish=>
    getComputedStyle(fish).display==='none'));
  await snapshot(page,`${label}-wait`);
  const soundBeforeBite=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length}));
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:7500});
  check(`${label}: hook enabled on full sink`,await page.locator('.room-fishing-v4-hook').isEnabled());
  const biteSounds=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length}));
  check(`${label}: one fish bite emits a distinct three-part cue and water accent`,
    biteSounds.tones-soundBeforeBite.tones===3&&biteSounds.noise-soundBeforeBite.noise===1);
  await page.waitForTimeout(160);
  check(`${label}: bite cue does not repeat each animation frame`,
    await page.evaluate(()=>__qa.soundStarts.length)===biteSounds.tones);
  const soundBeforeHook=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length}));
  await page.locator('.room-fishing-v4-hook').click();
  await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor({timeout:5000});
  const soundAfterHook=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length}));
  check(`${label}: confirmed hook has a separate line-set sound`,
    soundAfterHook.tones-soundBeforeHook.tones>=2&&soundAfterHook.noise-soundBeforeHook.noise>=1);
  check(`${label}: genuine server hook accepted`,(await actionCalls(page,'hook')).length===1&&sessions.get(label)?.challenge.stage==='fight');
  const fightLine=await lineGeometry(page);
  fs.writeFileSync(path.join(out,`${label}-fight-line-diagnostics.json`),JSON.stringify(fightLine,null,2));
  check(`${label}: fighting line joins rod and water splash`,
    fightLine&&fightLine.tipGap<3&&fightLine.splashGap<4);
  const fightHeader=await headerVisible(page);
  check(`${label}: header fully visible while fighting`,fightHeader.visible);
  const waterVisual=await fightWaterVisual(page);
  check(`${label}: fight hides bobber and shows water splash`,waterVisual.bobberHidden&&
    waterVisual.splashLoaded&&waterVisual.splashVisible&&waterVisual.splashInside);
  check(`${label}: fighting sea hides decorative fish silhouette`,await page.locator('.room-fishing-v4-fish').evaluate(fish=>
    getComputedStyle(fish).display==='none'));
  check(`${label}: compact fight UI has no old dial or side card`,await page.locator('.room-fishing-v4-gauge,.room-fishing-v4-direction').count()===0);
  check(`${label}: fishing HUD has no fish or rod direction pills`,await page.locator('.room-fishing-v5-bearing,.room-fishing-v5-aim').count()===0);
  const geometry=await fightUiGeometry(page);
  fs.writeFileSync(path.join(out,`${label}-fight-geometry.json`),JSON.stringify(geometry,null,2));
  check(`${label}: strength and direction HUD fits viewport`,geometry.hudVisible&&geometry.noHorizontalOverflow);
  check(`${label}: fighting actions visible and reachable`,geometry.controlsVisible);
  check(`${label}: control pad stays compact on the right`,geometry.compactRightPad);
  check(`${label}: releasing the reel pays line automatically without a pay button`,
    await page.locator('.room-fishing-v4-pay,.room-fishing-sfx').count()===0&&
    (await page.locator('.room-fishing-v4-reel').textContent()).includes('鬆開自動放線'));
  const meter=await fightMeterState(page);
  check(`${label}: line wheel, pull arc and distance ruler are visible`,
    meter.dialVisible&&meter.arcVisible&&meter.progressVisible&&meter.needleVisible&&meter.staticOuterRing);
  check(`${label}: wheel, arc and ruler match server`,meterMatchesServer(meter));
  await snapshot(page,`${label}-fight`);
}
async function fightInteraction(page,label){
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.runState==='surge',null,{timeout:8000});
  const initial=await visual(page),sign=initial.direction==='left'?-1:initial.direction==='right'?1:0;
  check(`${label}: fish surge gives lateral direction`,sign!==0);
  check(`${label}: fish direction is carried by water motion without direction pills`,initial.directionPills===0);
  const activeWater=await fightWaterVisual(page);
  check(`${label}: surge retains water splash without a bobber`,activeWater.bobberHidden&&activeWater.splashVisible);
  await snapshot(page,`${label}-surge-start`);
  const motion=[initial];for(let index=0;index<7;index++){
    await page.waitForTimeout(95);motion.push(await visual(page));
  }
  fs.writeFileSync(path.join(out,`${label}-fish-motion.json`),JSON.stringify(motion,null,2));
  const moved=motion.at(-1);
  check(`${label}: visible fish moves laterally during the run`,motion.some((sample,index)=>
    index>0&&sample.run==='surge'&&Math.abs(sample.fishX-motion[index-1].fishX)>.12));
  check(`${label}: water splash follows visible fish`,Math.abs(moved.floatX-moved.fishX)<.02);
  const directed=motion.filter(sample=>sample.run==='surge'&&sample.direction===initial.direction);
  check(`${label}: splash travels toward the fish's left or right run`,
    directed.length>1&&sign*(directed.at(-1).floatX-directed[0].floatX)>1.5);
  const water=await waterPerspective(page);
  check(`${label}: splash image stays centered on lateral water point`,
    Math.abs(water.splashX-water.floatX*water.seaWidth/100)<5);
  const reel=page.locator('.room-fishing-v4-reel');await reel.scrollIntoViewIfNeeded();
  const box=await reel.boundingBox();assert(box,`${label}: reel hit area`);
  const x=box.x+box.width*(sign<0?.18:.82),y=box.y+box.height*.5;
  const beforeControls=(await actionCalls(page,'control')).length;
  const soundBeforeReel=await page.evaluate(()=>__qa.soundStarts.length);
  await page.mouse.move(x,y);await page.mouse.down();await page.waitForTimeout(600);
  await page.evaluate(()=>{
    const crank=document.querySelector('.room-fishing-v5-rod-crank');
    __qa.rodFrameHistory=[crank?.dataset.frame];
    __qa.rodFrameObserver?.disconnect();
    __qa.rodFrameObserver=new MutationObserver(()=>__qa.rodFrameHistory.push(crank.dataset.frame));
    __qa.rodFrameObserver.observe(crank,{attributes:true,attributeFilter:['data-frame']});
  });
  const reelBefore=await page.locator('.room-fishing-v5-dial-spool').evaluate(wheel=>({
    transform:getComputedStyle(wheel).transform,animation:getComputedStyle(wheel).animationName,
    movement:wheel.closest('.room-fishing-v5-hud').dataset.reelDirection,
    signedRate:Number(wheel.closest('.room-fishing-v5-hud').dataset.reelRate),
    angle:(()=>{const matrix=new DOMMatrixReadOnly(getComputedStyle(wheel).transform);
      return Math.atan2(matrix.b,matrix.a)*180/Math.PI;})(),
    art:getComputedStyle(wheel).backgroundImage,
    outerAnimation:getComputedStyle(wheel.parentElement,'::after').animationName,
    outerTransform:getComputedStyle(wheel.parentElement,'::after').transform,
    crank:(()=>{const handle=wheel.querySelector('.room-fishing-v5-dial-crank');const box=handle?.getBoundingClientRect();
      return{attached:handle?.parentElement===wheel,width:box?.width,height:box?.height,
        topKnob:getComputedStyle(handle,'::before').backgroundImage,
        bottomKnob:getComputedStyle(handle,'::after').backgroundImage,
        hub:getComputedStyle(wheel.parentElement.querySelector('.room-fishing-v5-dial-hub')).display};})(),
    rodCrank:(()=>{const handle=document.querySelector('.room-fishing-v5-rod-crank');
      const scene=handle?.closest('.room-fishing-v4-sea')?.getBoundingClientRect();
      const box=handle?.getBoundingClientRect();
      return{frame:Number(handle?.dataset.frame),art:getComputedStyle(handle).backgroundImage,
        position:getComputedStyle(handle).backgroundPosition,
        rect:box&&{left:box.left,top:box.top,right:box.right,bottom:box.bottom},
        scene:scene&&{left:scene.left,top:scene.top,right:scene.right,bottom:scene.bottom},
        visible:Boolean(box&&scene&&box.left<scene.right&&box.right>scene.left&&
          box.top<scene.bottom&&box.bottom>scene.top)};})(),
    label:document.querySelector('.room-fishing-v5-strength-copy>span')?.textContent}));
  const reelPressure=await fightMeterState(page);
  await page.waitForTimeout(140);
  const reelAfter=await page.locator('.room-fishing-v5-dial-spool').evaluate(wheel=>{
    const box=wheel.querySelector('.room-fishing-v5-dial-crank').getBoundingClientRect();
    const matrix=new DOMMatrixReadOnly(getComputedStyle(wheel).transform);
    return{transform:getComputedStyle(wheel).transform,angle:Math.atan2(matrix.b,matrix.a)*180/Math.PI,
      crankWidth:box.width,crankHeight:box.height,
      rodFrame:Number(document.querySelector('.room-fishing-v5-rod-crank')?.dataset.frame)};
  });
  const reelDelta=(reelAfter.angle-reelBefore.angle+540)%360-180;
  fs.writeFileSync(path.join(out,`${label}-reel-first-sample.json`),JSON.stringify({reelBefore,reelAfter,reelDelta,serverDistance:sessions.get(label)?.challenge.distance,serverControl:sessions.get(label)?.challenge.control},null,2));
  check(`${label}: inner reel rotates from signed line motion while brass rim stays fixed`,reelBefore.animation==='none'&&
    reelBefore.art.includes('hud-reel-v2.webp')&&reelBefore.transform!==reelAfter.transform&&
    reelBefore.outerAnimation==='none'&&reelBefore.outerTransform==='none'&&reelBefore.label==='耐壓');
  check(`${label}: held reel follows the actual signed line direction`,
    Math.abs(reelBefore.signedRate)>.2&&
    reelBefore.movement===(reelBefore.signedRate>0?'in':'out')&&
    reelDelta*reelBefore.signedRate>3);
  check(`${label}: reeling produces mechanical sound tied to rotation`,
    await page.evaluate(()=>__qa.soundStarts.length)>soundBeforeReel);
  check(`${label}: visible crank is attached to and travels with inner reel`,reelBefore.crank.attached&&
    Math.hypot(reelBefore.crank.width,reelBefore.crank.height)>70&&
    reelBefore.crank.topKnob.includes('gradient')&&reelBefore.crank.bottomKnob.includes('gradient')&&
    reelBefore.crank.hub==='block'&&
    Math.abs(reelBefore.crank.width-reelAfter.crankWidth)+
      Math.abs(reelBefore.crank.height-reelAfter.crankHeight)>3);
  const reelFrame=angle=>Math.floor((((angle+360)%360)/90))%4;
  check(`${label}: character rod crank uses its registered four-frame art`,reelBefore.rodCrank.visible&&
    reelBefore.rodCrank.art.includes('rod-no-line-v1.webp')&&
    reelBefore.rodCrank.frame===reelFrame(reelBefore.angle)&&
    reelAfter.rodFrame===reelFrame(reelAfter.angle));
  await page.waitForTimeout(1560);
  const rodFrameHistory=await page.evaluate(()=>{
    __qa.rodFrameObserver?.disconnect();return __qa.rodFrameHistory;
  });
  check(`${label}: character rod crank cycles through painted frames while reeling`,
    new Set(rodFrameHistory).size>=3);
  const held=await visual(page);
  const heldMeter=await fightMeterState(page);
  check(`${label}: holding the reel visibly drains the outer line-strength ring`,
    heldMeter.dial<reelPressure.dial-3&&heldMeter.pressureAngle<reelPressure.pressureAngle-9&&
    meterMatchesServer(heldMeter));
  check(`${label}: pointer reel steers the visible rod toward the fish`,held.steer===String(sign)&&held.reeling==='true');
  fs.writeFileSync(path.join(out,`${label}-reeling-line-diagnostics.json`),JSON.stringify(await lineGeometry(page),null,2));
  await snapshot(page,`${label}-reeling`);
  await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v5-hud')?.dataset.reelDirection==='out',null,{timeout:2000});
  const fishPullBefore=await page.locator('.room-fishing-v5-dial-spool').evaluate(wheel=>({
    angle:Math.atan2(new DOMMatrixReadOnly(getComputedStyle(wheel).transform).b,
      new DOMMatrixReadOnly(getComputedStyle(wheel).transform).a)*180/Math.PI,
    rate:Number(wheel.closest('.room-fishing-v5-hud').dataset.reelRate)}));
  await page.waitForTimeout(180);
  const fishPullAfter=await page.locator('.room-fishing-v5-dial-spool').evaluate(wheel=>{
    const matrix=new DOMMatrixReadOnly(getComputedStyle(wheel).transform);
    return Math.atan2(matrix.b,matrix.a)*180/Math.PI;
  });
  const fishPullDelta=(fishPullAfter-fishPullBefore.angle+540)%360-180;
  check(`${label}: fish draws line backward with the reel released`,
    fishPullBefore.rate<0&&fishPullDelta< -4&&fishPullDelta> -150);
  const controls=(await actionCalls(page,'control')).slice(beforeControls);
  check(`${label}: held control refreshes server lease`,controls.filter(c=>c.payload.reeling&&c.payload.steer===sign).length>=2);
  check(`${label}: reel release reaches server`,controls.some(c=>c.payload.reeling===false));
  check(`${label}: release retains rod direction`,(await visual(page)).steer===String(sign));
  check(`${label}: fight meters still follow server after reel input`,meterMatchesServer(await fightMeterState(page)));
  const line=await lineGeometry(page);check(`${label}: line stays attached to splash after steering`,line&&line.tipGap<3&&line.splashGap<4);
  fs.writeFileSync(path.join(out,`${label}-surge-line-diagnostics.json`),JSON.stringify(line,null,2));
  const surgeWater=await fightWaterVisual(page);
  check(`${label}: surge water splash remains visible`,surgeWater.bobberHidden&&surgeWater.splashVisible);
  await snapshot(page,`${label}-surge`);
  const automaticLine=await page.locator('.room-fishing-v5-dial-spool').evaluate(wheel=>({
    movement:wheel.closest('.room-fishing-v5-hud').dataset.reelDirection,
    signedRate:Number(wheel.closest('.room-fishing-v5-hud').dataset.reelRate),
    animation:getComputedStyle(wheel).animationName,
    attached:wheel.querySelector('.room-fishing-v5-dial-crank')?.parentElement===wheel,
    label:document.querySelector('.room-fishing-v5-strength-copy>span')?.textContent}));
  const automaticPressure=await fightMeterState(page);
  check(`${label}: line goes out as soon as reeling stops`,automaticLine.movement==='out'&&
    automaticLine.signedRate<0&&automaticLine.animation==='none'&&automaticLine.attached&&
    automaticLine.label==='耐壓');
  check(`${label}: automatic payout keeps the outer ring tied to server strength`,
    meterMatchesServer(automaticPressure)&&automaticPressure.pressureRingVisible);
  fs.writeFileSync(path.join(out,`${label}-reel-motion.json`),JSON.stringify({
    winding:{before:reelBefore,after:reelAfter,delta:reelDelta,pressure:reelPressure},
    automaticLine:{visual:automaticLine,pressure:automaticPressure,delta:fishPullDelta}},null,2));
  await snapshot(page,`${label}-automatic-payout`);
  check(`${label}: reel keeps reflecting fish draw while resting`,
    await page.locator('.room-fishing-v5-hud').getAttribute('data-reel-direction')==='out');
  const paid=(await actionCalls(page,'control')).slice(beforeControls);
  check(`${label}: automatic payout needs no paying action`,paid.some(c=>c.payload.reeling===false)&&
    paid.every(c=>c.payload.paying!==true));
  const before=(await visual(page)).strength;
  await page.waitForTimeout(1100);
  const after=(await visual(page)).strength;
  check(`${label}: line strength recovers after release`,after>=before);
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.runState==='calm',null,{timeout:10000});
  const calmBox=await reel.boundingBox();assert(calmBox,`${label}: calm reel hit area`);
  await page.mouse.move(calmBox.x+calmBox.width*.5,calmBox.y+calmBox.height*.5);await page.mouse.down();
  await page.waitForTimeout(400);
  const calmBefore=await page.locator('.room-fishing-v5-dial-spool').evaluate(wheel=>{
    const matrix=new DOMMatrixReadOnly(getComputedStyle(wheel).transform),hud=wheel.closest('.room-fishing-v5-hud');
    return{angle:Math.atan2(matrix.b,matrix.a)*180/Math.PI,rate:Number(hud.dataset.reelRate),direction:hud.dataset.reelDirection};
  });
  await page.waitForTimeout(140);
  const calmAfter=await page.locator('.room-fishing-v5-dial-spool').evaluate(wheel=>{
    const matrix=new DOMMatrixReadOnly(getComputedStyle(wheel).transform);
    return Math.atan2(matrix.b,matrix.a)*180/Math.PI;
  });
  await page.mouse.up();
  const calmDelta=(calmAfter-calmBefore.angle+540)%360-180;
  fs.writeFileSync(path.join(out,`${label}-calm-reel-sample.json`),JSON.stringify({calmBefore,calmAfter,calmDelta,fishPullBefore,server:sessions.get(label)?.challenge&&{distance:sessions.get(label).challenge.distance,runState:sessions.get(label).challenge.runState,pullDirection:sessions.get(label).challenge.pullDirection,control:sessions.get(label).challenge.control}},null,2));
  check(`${label}: calm water lets recovered line wind clockwise faster than idle fish draw`,
    calmBefore.direction==='in'&&calmBefore.rate>2&&calmDelta>20&&calmDelta<150&&
    calmBefore.rate>Math.abs(fishPullBefore.rate));
  const soundsBeforeNextReel=await page.evaluate(()=>__qa.soundStarts.length);
  await holdPointer(page,reel,420);
  check(`${label}: the next reel still makes mechanical sound without a visible audio toggle`,
    await page.evaluate(()=>__qa.soundStarts.length)>soundsBeforeNextReel);
  const beforeBlur=await page.evaluate(()=>{const state={sounds:__qa.soundStarts.length,suspends:__qa.audioSuspends,
    state:__qa.audioContext?.state};window.dispatchEvent(new Event('blur'));
    return{...state,soundsAtBlur:__qa.soundStarts.length};});
  await page.waitForTimeout(220);
  const afterBlur=await page.evaluate(()=>({sounds:__qa.soundStarts.length,suspends:__qa.audioSuspends,state:__qa.audioContext?.state}));
  fs.writeFileSync(path.join(out,`${label}-audio-blur.json`),JSON.stringify({beforeBlur,afterBlur},null,2));
  check(`${label}: lost focus suspends fishing audio and stops clicks`,
    afterBlur.state==='suspended'&&afterBlur.sounds===beforeBlur.soundsAtBlur);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  const card=await page.locator('.room-minigame-card').boundingBox();
  check(`${label}: modal stays inside viewport`,card&&card.width<=page.viewportSize().width+1&&
    card.x>=-1&&card.x+card.width<=page.viewportSize().width+1);
}
async function verifyDistanceRuler(page,label){
  const setDistance=async target=>{
    const response=await page.evaluate(({client,distance})=>fetch(`/qa-distance?client=${client}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({distance})
    }).then(result=>result.json()),{client:label,distance:target});
    check(`${label}: distance fixture accepted ${target}`,response.ok===true);
    await page.waitForFunction(target=>{
      const value=Number(document.querySelector('.room-fishing-v5-catch-track')?.getAttribute('aria-valuenow'));
      return Math.abs(value-target)<10;
    },target,{timeout:4000});
    await page.waitForTimeout(300);
    const meter=await fightMeterState(page);
    return{...meter,water:await waterPerspective(page)};
  };
  const far=await setDistance(72);
  await snapshot(page,`${label}-ruler-far`);
  const near=await setDistance(28);
  fs.writeFileSync(path.join(out,`${label}-distance-ruler.json`),JSON.stringify({far,near},null,2));
  check(`${label}: fish marker travels toward boat when server distance falls`,
    far.progress-near.progress>=30&&far.markerCenter-near.markerCenter>50&&
    far.fillRatio-near.fillRatio>.3);
  check(`${label}: distance ruler remains bound to server`,meterMatchesServer(far)&&meterMatchesServer(near));
  check(`${label}: projected fish depth controls a compact water splash`,
    near.water.splashWidth>far.water.splashWidth*1.1&&
    near.water.splashWidth<=105&&far.water.splashWidth<=105);
  check(`${label}: nearer fish pulls splash toward foreground`,
    near.water.splashY-far.water.splashY>near.water.seaHeight*.025);
  const edgeSplash=await page.locator('.room-fishing-v4-sea').evaluate(sea=>{
    const splash=sea.querySelector('.room-fishing-v4-splash');
    const priorX=sea.style.getPropertyValue('--float-x'),priorWidth=sea.style.getPropertyValue('--splash-width');
    const maxWidth=Math.max(75,Math.min(120,sea.clientWidth*.13))*.82;
    sea.style.setProperty('--splash-width',`${maxWidth}px`);
    const samples=[18,82].map(x=>{
      sea.style.setProperty('--float-x',`${x}%`);
      const box=splash.getBoundingClientRect(),bounds=sea.getBoundingClientRect();
      return{left:box.left-bounds.left,right:box.right-bounds.left,seaWidth:bounds.width};
    });
    sea.style.setProperty('--float-x',priorX);sea.style.setProperty('--splash-width',priorWidth);
    return samples;
  });
  check(`${label}: largest near-shore splash fits left and right sea edges`,edgeSplash.every(sample=>
    sample.left>=-1&&sample.right<=sample.seaWidth+1));
  await snapshot(page,`${label}-ruler-near`);
}
async function verifyLineWheel(page,label){
  const setStrength=async target=>{
    const response=await page.evaluate(({client,strength})=>fetch(`/qa-strength?client=${client}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strength})
    }).then(result=>result.json()),{client:label,strength:target});
    check(`${label}: line-strength fixture accepted ${target}`,response.ok===true);
    await page.waitForFunction(target=>{
      const value=Number(document.querySelector('.room-fishing-v5-dial')?.getAttribute('aria-valuenow'));
      // The server restores line strength while the fixture waits for its next 1 s sync.
      return Math.abs(value-target)<15;
    },target,{timeout:4000});
    // Let the ring's 220 ms color/angle transition finish before inspecting or capturing it.
    await page.waitForTimeout(330);
    return fightMeterState(page);
  };
  const safe=await setStrength(80);
  await snapshot(page,`${label}-wheel-safe`);
  const beforeStress=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length}));
  const warning=await setStrength(34);
  const warningStress=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length}));
  await snapshot(page,`${label}-wheel-warning`);
  const danger=await setStrength(12);
  const dangerStress=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length}));
  check(`${label}: warning and danger each sound line stress without a continuous loop`,
    warningStress.tones>beforeStress.tones&&warningStress.noise>beforeStress.noise&&
    dangerStress.tones>warningStress.tones&&dangerStress.noise>warningStress.noise);
  fs.writeFileSync(path.join(out,`${label}-line-wheel.json`),JSON.stringify({safe,warning,danger},null,2));
  check(`${label}: the outer ring drains with server line strength`,
    safe.dial-warning.dial>30&&warning.dial-danger.dial>15&&
    safe.pressureAngle-warning.pressureAngle>90&&warning.pressureAngle-danger.pressureAngle>45);
  check(`${label}: remaining line strength uses visible green, yellow and red states`,
    [safe,warning,danger].map(state=>state.pressureRisk).join(',')==='safe,warning,danger'&&
    new Set([safe.pressureColor,warning.pressureColor,danger.pressureColor]).size===3&&
    [safe,warning,danger].every(state=>state.pressureColor.length>0));
  check(`${label}: remaining line readout follows server and shows break threshold`,
    [safe,warning,danger].every(meterMatchesServer));
  await snapshot(page,`${label}-wheel-weak`);
  await setStrength(80);
}
function verifyZeroStrengthBreak(){
  const hookedAt=new Date('2026-10-03T00:00:00.000Z');
  const round=fishingV5.create('qa-zero-strength',hookedAt,0);
  fishingV5.hook(round,hookedAt,1,'golden-whale');
  round.strength=.001;
  fishingV5.control(round,hookedAt,true,0);
  const result=fishingV5.simulate(round,new Date(hookedAt.getTime()+100),1);
  check('zero remaining line strength snaps the line in the real fight engine',
    result==='line_snapped'&&round.strength===0);
}
async function settle(page,label){
  const soundsBeforeLanding=await page.evaluate(()=>__qa.soundStarts.length);
  const response=await page.evaluate(client=>fetch(`/qa-land?client=${client}`,{method:'POST'}).then(r=>r.json()),label);
  check(`${label}: settlement fixture armed`,response.ok===true);
  await page.locator('.room-fishing-v3-result.caught').waitFor({timeout:6000});
  await page.waitForFunction(()=>{const img=document.querySelector('.room-fishing-v3-catch-art');return img?.complete&&img.naturalWidth>0;});
  check(`${label}: server core decided landing`,sessions.get(label)?.feedback?.reason==='landed');
  const soundsAfterLanding=await page.evaluate(()=>__qa.soundStarts.length);
  check(`${label}: confirmed catch plays its rarity stinger or ordinary fallback`,
    sessions.get(label)?.result?.catch&&soundsAfterLanding-soundsBeforeLanding>=
      (sessions.get(label).result.catch.rarity==='legendary'?7:4));
  check(`${label}: result fish image visible`,await page.locator('.room-fishing-v3-catch-art').isVisible());
  const catchArt=await catchArtVisible(page);
  check(`${label}: complete fish art fits without covering actions`,catchArt.loaded&&catchArt.fullyVisible&&catchArt.separateFromActions);
  check(`${label}: catch has a species name`,(await page.locator('.room-fishing-v3-catch-name').textContent()).trim()==='氣球鯰魚');
  const visibleAction=await resultActionVisible(page);
  check(`${label}: at least one continue or return action visible`,visibleAction.visible);
  await page.waitForTimeout(1300);
  check(`${label}: catch stays until player chooses`,await page.locator('.room-fishing-v3-result.caught').isVisible());
  await snapshot(page,`${label}-catch`);
  const previousId=sessions.get(label).id;
  await page.getByRole('button',{name:'看完了，再釣一竿'}).click();
  await page.locator('.room-fishing-v4-sea[data-stage="cast"]').waitFor({timeout:5000});
  check(`${label}: next cast starts new v5 session`,sessions.get(label).id!==previousId&&
    sessions.get(label).challenge.fishingVersion===5);
  await holdPointer(page,page.locator('.room-fishing-v4-cast'),180);
  await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor({timeout:5000});
  const soundsBeforeMiss=await page.evaluate(()=>__qa.soundStarts.length);
  const miss=await page.evaluate(client=>fetch(`/qa-miss?client=${client}`,{method:'POST'}).then(r=>r.json()),label);
  check(`${label}: missed-bite deadline fixture armed`,miss.ok===true);
  await page.locator('.room-fishing-v3-result.miss').waitFor({timeout:10000});
  check(`${label}: missed fish plays its own descending failure cue`,
    sessions.get(label)?.feedback?.reason==='missed_bite'&&
    await page.evaluate(()=>__qa.soundStarts.length)>=soundsBeforeMiss+2);
  const beforeClose=await page.evaluate(()=>__qa.audioCloses);
  await page.evaluate(()=>__minigame.dismiss());
  await page.waitForTimeout(140);
  check(`${label}: closing fishing modal releases its AudioContext`,
    await page.evaluate(()=>__qa.audioCloses)>beforeClose);
}
async function runV5(label,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await context.newPage();
  try{await setup(page,label);await begin(page,label);await castAndHook(page,label);
    await fightInteraction(page,label);await verifyDistanceRuler(page,label);
    await verifyLineWheel(page,label);await settle(page,label);
  }finally{await context.close();}
}
async function runFlick(label,width,height){
  const direction=label.slice('flick-'.length);
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await context.newPage();
  try{
    await setup(page,label);
    await page.getByRole('button',{name:'開始釣魚'}).click();
    await page.locator('.room-fishing-v4-sea[data-stage="cast"]').waitFor();
    check(`${label}: new client opts into gesture rounds`,(await page.evaluate(()=>__qa.calls.find(call=>
      call.type==='minigame.start')?.payload.flickMode))===true&&sessions.get(label)?.flickMode===true);
    await holdPointer(page,page.locator('.room-fishing-v4-cast'),180);
    await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor();
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:8000});
    await page.locator('.room-fishing-v4-hook').click();
    await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor();
    await page.waitForFunction(expected=>document.querySelector('.room-fishing-v5-flick-cue')?.dataset.direction===expected&&
      document.querySelector('.room-fishing-v5-flick-cue')?.dataset.active==='true',direction,{timeout:1300});
    check(`${label}: real fish surge publishes the matching cue`,sessions.get(label)?.challenge.flickCue?.direction===direction&&
      (await page.locator('.room-fishing-v4-sea').getAttribute('data-flick-cue'))===direction);
    const meterBefore=await fightMeterState(page);
    check(`${label}: existing reel meter remains visible`,meterBefore.dialVisible&&meterBefore.arcVisible&&meterBefore.progressVisible);
    if(direction==='up')await snapshot(page,'flick-up-cue');
    if(direction==='up')await page.keyboard.press('ArrowUp');
    else{
      const sea=await page.locator('.room-fishing-v4-sea').boundingBox();assert(sea);
      const x=sea.x+sea.width*.52,y=sea.y+sea.height*.58;
      await page.mouse.move(x,y);await page.mouse.down();
      await page.mouse.move(x+(direction==='left'?-90:90),y,{steps:5});await page.mouse.up();
    }
    await page.waitForTimeout(90);
    const activeLine=await lineGeometry(page);
    check(`${label}: line follows rod during the flick`,activeLine&&activeLine.tipGap<4);
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.flickFeedback==='success',null,{timeout:1800});
    const calls=await actionCalls(page,'flick');
    check(`${label}: gesture sends one matching one-shot action`,calls.length===1&&
      calls[0].payload.flickDirection===direction&&calls[0].payload.flickCueId===1);
    check(`${label}: server accepts the flick`,sessions.get(label)?.challenge.flickFeedback?.result==='hit'&&
      sessions.get(label)?.challenge.flickCue===null);
    await page.waitForTimeout(520);
    const line=await lineGeometry(page);
    check(`${label}: animated rod keeps line attached`,line&&line.tipGap<3&&line.splashGap<4);
    await snapshot(page,`${label}-success`);
  }finally{await context.close();}
}
async function runCastDepth(label,width,height){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
  const page=await context.newPage();
  try{
    await setup(page,label);
    await page.getByRole('button',{name:'開始釣魚'}).click();
    await page.locator('.room-fishing-v4-sea[data-stage="cast"]').waitFor();
    await holdPointer(page,page.locator('.room-fishing-v4-cast'),180);
    await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor();
    const sample=async(zone,targetX)=>{
      const result=await page.evaluate(({client,zone})=>fetch(`/qa-cast-target?client=${client}`,{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({zone})
      }).then(response=>response.json()),{client:label,zone});
      check(`${label}: ${zone} landing fixture accepted`,result.ok===true);
      await page.waitForFunction(target=>Math.abs(parseFloat(document.querySelector('.room-fishing-v4-sea')
        ?.style.getPropertyValue('--float-x'))-target)<.15,targetX,{timeout:3500});
      const visual=await waterPerspective(page);
      await snapshot(page,`${label}-${zone}-depth`);
      return visual;
    };
    const near=await sample('near',46),far=await sample('far',81);
    fs.writeFileSync(path.join(out,`${label}-cast-depth.json`),JSON.stringify({near,far},null,2));
    check(`${label}: near cast bobber visibly larger than far cast`,
      near.bobberWidth/far.bobberWidth>1.7&&near.bobberHeight/far.bobberHeight>1.7);
    check(`${label}: both cast bobbers stay small against the sea`,
      near.bobberWidth<46&&far.bobberWidth<24);
    check(`${label}: near cast splash visibly larger than far cast`,near.splashWidth/far.splashWidth>2);
    check(`${label}: near cast splash does not dominate the foreground`,near.splashWidth<105);
    check(`${label}: cast distance shifts bobber across sea perspective`,
      near.bobberX<far.bobberX-near.seaWidth*.25&&
      near.bobberY>far.bobberY+near.seaHeight*.06);
    check(`${label}: cast bobbers remain inside sea`,[near,far].every(sample=>
      sample.bobberX-sample.bobberWidth/2>=0&&sample.bobberX+sample.bobberWidth/2<=sample.seaWidth&&
      sample.bobberY-sample.bobberHeight/2>=0&&sample.bobberY+sample.bobberHeight/2<=sample.seaHeight));
  }finally{await context.close();}
}
async function runLegacy(){
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
  try{
    await setup(page,'legacy');await page.getByRole('button',{name:'開始釣魚'}).click();
    await page.locator('.room-fishing-v4-sea[data-stage="cast"]').waitFor();
    check('legacy: v4 session renders without v5 marker',await page.locator('.fishing-v4:not(.fishing-v5)').count()===1);
    check('legacy: tension meter preserved',await page.locator('.room-fishing-v4-gauge').getAttribute('aria-label')==='釣線張力');
    await holdPointer(page,page.locator('.room-fishing-v4-cast'),180);
    try{await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor({timeout:6000});}
    catch(error){
      const diagnostic=await page.evaluate(()=>({stage:document.querySelector('.room-fishing-v4-sea')?.dataset.stage,
        feedback:document.querySelector('[data-testid=minigame-feedback]')?.textContent,
        castDisabled:document.querySelector('.room-fishing-v4-cast')?.disabled,
        pointerEvents:__qa.pointerEvents,calls:__qa.calls,responses:__qa.responses}));
      fs.writeFileSync(path.join(out,'legacy-cast-failure.json'),JSON.stringify({diagnostic,server:sessions.get('legacy')},null,2));
      throw error;
    }
    check('legacy: cast accepted by v4 core',sessions.get('legacy')?.challenge.stage==='wait');
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:7500});
    await page.locator('.room-fishing-v4-hook').click();
    await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor();
    check('legacy: v4 hook still accepted',sessions.get('legacy')?.challenge.stage==='fight');
    await holdPointer(page,page.locator('.room-fishing-v4-reel'),350);
    check('legacy: v4 reel control still reaches core',(await actionCalls(page,'control')).some(call=>call.payload.reeling));
    await snapshot(page,'legacy-v4-wait');
  }finally{await context.close();}
}
async function forceProbe(label){
  const context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const page=await context.newPage();
  try{
    await setup(page,label);await begin(page,label);await castAndHook(page,label);
    check(`${label}: fixture selected the requested real fish`,sessions.get(label)?.catchSpeciesId===forcedSpecies.get(label));
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.runState==='surge',null,{timeout:8500});
    await page.waitForTimeout(230);
    const line=await lineGeometry(page);
    const samples=[];let serverIntensityAtSample,publicIntensityAtSample;
    for(let index=0;index<7;index++){
      samples.push(await visual(page));
      if(index===0){
        serverIntensityAtSample=sessions.get(label).challenge.pullIntensity;
        publicIntensityAtSample=await page.evaluate(()=>__qa.responses.filter(item=>
          item.data?.minigame?.challenge?.stage==='fight').at(-1)?.data.minigame.challenge.pullIntensity);
      }
      await page.waitForTimeout(80);
    }
    await snapshot(page,`${label}-surge`);
    return{label,speciesId:forcedSpecies.get(label),samples,line,
      serverIntensityAtSample,publicIntensityAtSample};
  }finally{await context.close();}
}
async function runForceComparison(){
  const light=await forceProbe('light-force'),heavy=await forceProbe('heavy-force');
  fs.writeFileSync(path.join(out,'species-force-comparison.json'),JSON.stringify({light,heavy},null,2));
  const first=pair=>pair.samples[0];
  check('species: real core exposes different force intensity for two fish',
    heavy.serverIntensityAtSample-light.serverIntensityAtSample>.18&&
    first(heavy).pullIntensity-first(light).pullIntensity>.18&&
    Math.abs(first(heavy).pullIntensity-heavy.publicIntensityAtSample)<.02&&
    Math.abs(first(light).pullIntensity-light.publicIntensityAtSample)<.02);
  check('species: stronger fish visibly bends rod farther',
    Math.abs(heavy.samples.reduce((sum,item)=>sum+item.rodAngle,0)/heavy.samples.length-
      light.samples.reduce((sum,item)=>sum+item.rodAngle,0)/light.samples.length)>2&&
    Math.abs(first(heavy).pullBend)-Math.abs(first(light).pullBend)>2);
  check('species: stronger fish has faster visible pull rhythm',
    first(light).pullPeriod-first(heavy).pullPeriod>75);
  check('species: stronger fish visibly enlarges water splash',
    first(heavy).splashOpacity-first(light).splashOpacity>.1);
  check('species: stronger fish visibly moves tension arc farther',
    first(heavy).pullArcGrade-first(light).pullArcGrade>=2&&
    first(heavy).pullArcFill-first(light).pullArcFill>30&&
    first(light).pullNeedleY-first(heavy).pullNeedleY>20);
}
async function main(){
  fs.mkdirSync(out,{recursive:true});await serve();
  browser=await chromium.launch({executablePath:chrome,headless:true});
  try{
    verifyZeroStrengthBreak();
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='desktop')await runV5('desktop',1440,900);
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='minimum')await runV5('minimum',960,640);
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='flick'){
      await runFlick('flick-up',1440,900);
      await runFlick('flick-left',1440,900);
      await runFlick('flick-right',960,640);
    }
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='depth'){
      await runCastDepth('depth-desktop',1440,900);
      await runCastDepth('depth-minimum',960,640);
    }
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='legacy')await runLegacy();
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='force')await runForceComparison();
    check('no browser script errors',pageErrors.length===0);
    check('all image assets loaded',missingAssets.length===0);
    const report={status:'PASS',checks:checks.length,results:checks,pageErrors,missingAssets,
      note:'Browser command bridge invokes the real minigames core; account storage and final reward settlement are fixtures. QA-land only moves a fish near shore for result UI coverage.'};
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
    console.log(`PASS ${checks.length} v5 browser checks`);
  }finally{await browser?.close();await new Promise(resolve=>server?.close(resolve));}
}
main().catch(error=>{
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'FAIL',checks:checks.length,
    results:checks,error:error.stack||String(error),pageErrors,missingAssets},null,2));
  console.error(error.stack||error);process.exitCode=1;
});
