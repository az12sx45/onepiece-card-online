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
const assetRoot=path.resolve(process.env.LAUNCHER_FISH_V5_ASSET_ROOT||path.join(root,'public'));
const out=process.env.LAUNCHER_FISH_V5_BROWSER_QA_OUT||'D:/Codex_QA/launcher-fishing-wii-1.2.22/browser-final-r7';
const runtimeBase=path.join(process.env.LOCALAPPDATA||'','OpenAI/Codex/runtimes/cua_node');
const playwrightPath=fs.existsSync(runtimeBase)?fs.readdirSync(runtimeBase)
  .map(name=>path.join(runtimeBase,name,'bin/node_modules/playwright')).find(fs.existsSync):null;
  const {chromium}=require(process.env.BOARD_QA_PLAYWRIGHT||playwrightPath||'playwright');
const chrome=process.env.BOARD_QA_CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const html='<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;min-height:100%;background:#071b27;color:#fff;font-family:Arial,"Microsoft JhengHei",sans-serif}</style><link rel="stylesheet" href="/desktop/launcher-room-minigames.css"><body><script src="/desktop/launcher-room-minigames.js"></script></body></html>';
const fishingAudioDir='/pixabay_fishing_v1/';
const fishingAudioNames=['reel_in_fast.ogg','line_out_drag.ogg','line_strain.ogg'];
const sessions=new Map(),checks=[],pageErrors=[],missingAssets=[],blockedMedia=new Set();
const forcedSpecies=new Map([['power','glistening-saury'],['light-force','lovely-angel'],['heavy-force','golden-whale'],
  ['flick-up','glistening-saury'],['flick-right','glistening-saury'],['flick-left','glistening-saury'],
  ['flick-wrong','glistening-saury'],['flick-miss','glistening-saury'],
  ['flick-pre-cue-blur','glistening-saury']]);
const flickSeeds={'power':71,'flick-up':52,'flick-right':56,'flick-left':57,'flick-wrong':52,'flick-miss':52,
  'flick-pre-cue-blur':52};
let server,browser;
const check=(name,condition)=>{assert(condition,name);checks.push(name);};
const readJson=req=>new Promise((resolve,reject)=>{
  let body='';req.on('data',part=>{body+=part;if(body.length>100000)reject(new Error('QA request too large'));});
  req.on('end',()=>{try{resolve(JSON.parse(body));}catch(error){reject(error);}});req.on('error',reject);
});
const respond=(res,data)=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
async function command(client,type,payload){
  const now=new Date();let session=sessions.get(client);
  if(type==='rod.upgrade'&&client==='forge'){return {ok:true,rod:{maxLevel:99,characters:{'room-character-luffy':{level:99,nextCost:null}}},serverNow:now.toISOString()};}
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
        const {type,payload}=await readJson(req),result=await command(client,type,payload);
        // Delay delivery, not the authoritative cast, to cover a slow reply.
        if(client==='cast-latency'&&type==='minigame.answer'&&payload.counterMoves?.[0]==='cast')
          await new Promise(resolve=>setTimeout(resolve,1250));
        if(client==='power'&&payload.counterMoves?.[0]==='specialKey')await new Promise(resolve=>setTimeout(resolve,180));
        respond(res,result);return;
      }
      if(rel==='qa-land'&&req.method==='POST'){
        const session=sessions.get(client);
        if(!session||session.challenge?.stage!=='fight'){respond(res,{ok:false});return;}
        // UI settlement fixture: the engine itself still decides the landing
        // on the next genuine sync/control call.
        session.challenge.distance=-1;session.challenge.fishStamina=0;session.challenge.strength=Math.max(50,session.challenge.strength);
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
        if(session?.challenge?.stage!=='wait'||!['near','mid','far'].includes(zone)){
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
      if(rel==='qa-grade'&&req.method==='POST'){
        const session=sessions.get(client);if(session?.challenge?.stage!=='fight'){respond(res,{ok:false});return;}
        session.catchSpeciesId='golden-whale';session.challenge.rodLevel=99;fishingV5.hook(session.challenge,new Date(),1,'golden-whale');respond(res,{ok:true});return;
      }
      if(rel==='qa-power'&&req.method==='POST'){
        const session=sessions.get(client);if(!session?.challenge){respond(res,{ok:false});return;}
        session.challenge.powerCharge=6;session.challenge.fishStamina=url.searchParams.get('stamina')==='20'?20:900;
        respond(res,{ok:true});return;
      }
      if(rel==='qa-audio-calm'&&req.method==='POST'){
        const session=sessions.get(client);
        if(!session||session.challenge?.stage!=='fight'){respond(res,{ok:false});return;}
        // Hold a real V5 fight in its calm phase long enough to detect a loop
        // restart or silence. Control, line motion and settlement still run in
        // the actual server core on each one-second sync.
        const round=session.challenge;
        round.runState='calm';round.pullDirection='steady';round.phaseUntil=new Date(Date.now()+30000).toISOString();
        round.nextTurnAt=null;round.turnsRemaining=0;
        round.distance=88;round.strength=round.maxStrength=100;round.tension=0;
        respond(res,{ok:true});return;
      }
      if(!rel){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
       if(!['desktop/launcher-room-minigames.js','desktop/launcher-room-minigames.css'].includes(rel)&&
         !/^audio\/launcher_room\/pixabay_fishing_v1\/(?:reel_in_fast|line_out_drag|line_strain)\.ogg$/.test(rel)){
        res.writeHead(404);res.end();return;
      }
       res.setHeader('Content-Type',rel.endsWith('.css')?'text/css':rel.endsWith('.ogg')?'audio/ogg':'text/javascript');
       res.end(fs.readFileSync(path.join(root,rel.startsWith('audio/')?'public':'.',rel)));
    }catch(error){res.writeHead(500);res.end(error.stack||String(error));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
}
async function setup(page,client){
  await page.route('opui://**',route=>{
    const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');
    if(blockedMedia.has(client)&&rel.startsWith('audio/launcher_room/pixabay_fishing_v1/'))return route.abort('failed');
    const file=path.join(assetRoot,rel);
    if(rel.includes('..')||!fs.existsSync(file)){missingAssets.push(rel);return route.fulfill({status:404,body:'missing'});}
    return route.fulfill({path:file});
  });
  page.on('pageerror',error=>pageErrors.push(`${client}: ${error.message}`));
  await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'load'});
  await page.evaluate(client=>{
    window.__qa={client,calls:[],responses:[],pointerEvents:[],soundStarts:[],noiseStarts:[],pans:[],sampleStarts:[],sampleStops:[],sampleLoaded:[],sampleElements:[],audioCloses:0,audioSuspends:0};
    const nativeAudio=window.Audio;
    window.Audio=function(...args){
      if(__qa.blockSamples)throw Error('audio element unavailable');
      const media=new nativeAudio(...args);__qa.sampleElements.push(media);
      media.addEventListener('canplay',()=>{
        if(media.__qaLoaded)return;media.__qaLoaded=true;
        __qa.sampleLoaded.push({duration:media.duration,readyState:media.readyState,src:media.currentSrc});
      });
      return media;
    };
    window.Audio.prototype=nativeAudio.prototype;
    const nativeMediaPlay=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(...args){
      const recorded=this.src.includes('/pixabay_fishing_v1/')?{at:performance.now(),duration:this.duration,
        rate:this.playbackRate,src:this.src,volume:this.volume,loop:this.loop,readyState:this.readyState,
        lineDirection:document.querySelector('.room-fishing-v5-hud')?.dataset.reelDirection,
        promise:'pending'}:null;
      if(recorded)__qa.sampleStarts.push(recorded);
      const started=nativeMediaPlay.apply(this,args);
      if(recorded&&started?.then)started.then(()=>{recorded.promise='fulfilled';},
        error=>{recorded.promise=`rejected: ${error.name}`;});
      return started;
    };
    const nativeMediaPause=HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause=function(...args){
      if(this.src.includes('/pixabay_fishing_v1/')&&!this.paused)__qa.sampleStops.push({at:performance.now(),duration:this.duration,src:this.src});
      return nativeMediaPause.apply(this,args);
    };
    if(window.OscillatorNode){
      const start=OscillatorNode.prototype.start;
      OscillatorNode.prototype.start=function(...args){__qa.soundStarts.push({at:performance.now(),frequency:this.frequency.__qaStartValue??this.frequency.value,
        destinationFrequency:this.frequency.__qaRampTarget,type:this.type});return start.apply(this,args);};
    }
    if(window.StereoPannerNode){
      const connect=StereoPannerNode.prototype.connect;
      StereoPannerNode.prototype.connect=function(...args){
        __qa.pans.push({at:performance.now(),pan:this.pan.value});
        return connect.apply(this,args);
      };
    }
    if(window.AudioParam){
      const set=AudioParam.prototype.setValueAtTime;
      AudioParam.prototype.setValueAtTime=function(value,...args){
        if(this.__qaOscillatorFrequency)this.__qaStartValue=value;
        return set.call(this,value,...args);
      };
      const ramp=AudioParam.prototype.exponentialRampToValueAtTime;
      AudioParam.prototype.exponentialRampToValueAtTime=function(value,...args){
        if(this.__qaOscillatorFrequency)this.__qaRampTarget=value;
        return ramp.call(this,value,...args);
      };
    }
    if(window.AudioBufferSourceNode){
      const connect=AudioBufferSourceNode.prototype.connect;
      AudioBufferSourceNode.prototype.connect=function(destination,...args){
        if(destination instanceof BiquadFilterNode)this.__qaFilter=destination;
        return connect.call(this,destination,...args);
      };
      const start=AudioBufferSourceNode.prototype.start;
       AudioBufferSourceNode.prototype.start=function(...args){
         const event={at:performance.now(),duration:this.buffer?.duration||0,rate:this.playbackRate.value};
         if(this.__qaFilter)__qa.noiseStarts.push({...event,filter:this.__qaFilter.type});
          else __qa.sampleStarts.push(event);
         return start.apply(this,args);
       };
       const stop=AudioBufferSourceNode.prototype.stop;
       AudioBufferSourceNode.prototype.stop=function(...args){
         if(!this.__qaFilter)__qa.sampleStops.push({at:performance.now(),duration:this.buffer?.duration||0});
         return stop.apply(this,args);
       };
    }
    if(window.AudioContext){
      const createOscillator=AudioContext.prototype.createOscillator;
      AudioContext.prototype.createOscillator=function(...args){__qa.audioContext=this;
        const oscillator=createOscillator.apply(this,args);oscillator.frequency.__qaOscillatorFrequency=true;
        return oscillator;};
      const close=AudioContext.prototype.close;
      AudioContext.prototype.close=function(...args){__qa.audioCloses++;return close.apply(this,args);};
      const suspend=AudioContext.prototype.suspend;
      AudioContext.prototype.suspend=function(...args){__qa.audioSuspends++;return suspend.apply(this,args);};
    }
    for(const type of ['pointerdown','pointerup','pointercancel','click'])document.addEventListener(type,event=>{
      if(event.target.closest?.('.room-fishing-v4-cast'))__qa.pointerEvents.push({type,button:event.button,
        pointerType:event.pointerType,detail:event.detail,disabled:event.target.closest('.room-fishing-v4-cast')?.disabled,
        phase:__minigame?.inspect?.().phase,charging:document.querySelector('.room-fishing-v4-sea')?.dataset.charging,
        power:Number(document.querySelector('.room-fishing-v4-cast-track')?.getAttribute('aria-valuenow')),
        perfAt:performance.now()});
    },true);
    const command=async(type,payload)=>{
      __qa.calls.push({type,payload:JSON.parse(JSON.stringify(payload)),at:Date.now()});
      const response=await fetch(`/qa-command?client=${client}`,{method:'POST',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({type,payload})});
      const data=await response.json();__qa.responses.push({type,data,at:Date.now(),perfAt:performance.now(),
        move:payload?.counterMoves?.[0]});return data;
    };
    window.__minigame=OnePieceRoomMinigames.create({fishCollection:()=>[],command,
      onOpen:()=>{},onClose:()=>{},onResult:()=>{}});
    __minigame.open({kind:'fishing',characterId:'room-character-luffy'});
  },client);
   await page.waitForFunction(()=>__qa.sampleLoaded.length===3,null,{timeout:7000});
   const loaded=await page.evaluate(()=>__qa.sampleLoaded);
   fs.writeFileSync(path.join(out,`${client}-loaded-audio.json`),JSON.stringify(loaded,null,2));
   check(`${client}: three public OGG clips preload as playable media`,
     loaded.length===3&&loaded.every(clip=>clip.duration>.7&&clip.duration<8&&clip.readyState>=2&&
       fishingAudioNames.some(name=>clip.src.endsWith(`${fishingAudioDir}${name}`))));
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
    const castBait=sea.querySelector('.room-fishing-v5-cast-bait')?.getBoundingClientRect();
    const baitCenter=castBait?{x:(castBait.left+castBait.right)/2,y:(castBait.top+castBait.bottom)/2}:null;
    const rodRect=rod.getBoundingClientRect();
    return{paths:lines.map(line=>line.getAttribute('d')),
      rod:{naturalWidth:rod.naturalWidth||0,naturalHeight:rod.naturalHeight||0,
        offsetLeft:rod.offsetLeft,offsetTop:rod.offsetTop,offsetWidth:width,offsetHeight:height,
        contentWidth:artWidth,contentHeight:artHeight,transform:style.transform,
        transformOrigin:style.transformOrigin,
        rect:{x:rodRect.x,y:rodRect.y,width:rodRect.width,height:rodRect.height}},
      tipGap:Math.hypot(tip.x-start.x,tip.y-start.y),ringGap:Math.hypot(end.x-ring.x,end.y-ring.y),
      splashGap:Math.hypot(end.x-splashCenter.x,end.y-splashCenter.y),
      baitGap:baitCenter?Math.hypot(end.x-baitCenter.x,end.y-baitCenter.y):null,
      start,end,ring,center,splashCenter,baitCenter,bobber:{rect:{x:bobRect.x,y:bobRect.y,width:bobRect.width,height:bobRect.height},
        offsetWidth:bobber.offsetWidth,offsetHeight:bobber.offsetHeight,naturalWidth:bobber.naturalWidth,
        naturalHeight:bobber.naturalHeight,paintedWidth,paintedHeight,scale,
        tiltDegrees:tilt*180/Math.PI,transform:bobStyle.transform},
      sea:{width:sea.clientWidth,height:sea.clientHeight},svg:{width:svgRect.width,height:svgRect.height}};
  });
}
async function lineLayer(page){
  return page.locator('.room-fishing-v4-sea').evaluate(sea=>({
    line:Number(getComputedStyle(sea.querySelector('.room-fishing-v4-line')).zIndex),
    rod:Number(getComputedStyle(sea.querySelector('.room-fishing-v4-rod')).zIndex),
    water:Number(getComputedStyle(sea.querySelector('.room-fishing-v4-water')).zIndex),
    splash:Number(getComputedStyle(sea.querySelector('.room-fishing-v4-splash')).zIndex),
    bait:sea.querySelector('.room-fishing-v5-cast-bait')?
      Number(getComputedStyle(sea.querySelector('.room-fishing-v5-cast-bait')).zIndex):null
  }));
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
  const soundBeforeCast=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length,samples:__qa.sampleStarts.length,
    at:performance.now()}));
  const powerBefore=(await visual(page)).castPower;
  const sweep=label==='desktop'?await oscillatingCast(page,cast):null;
  if(!sweep)await holdPointer(page,cast,730);
  await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor({timeout:5000});
  const calls=await actionCalls(page,'cast'),power=calls.at(-1)?.payload.castPower;
  const pointerEvents=await page.evaluate(()=>__qa.pointerEvents);
  fs.writeFileSync(path.join(out,`${label}-cast-diagnostics.json`),JSON.stringify({power,powerBefore,sweep,calls,pointerEvents},null,2));
  if(sweep){
    check(`${label}: power rises then falls during a held cast`,sweep[1].power>=80&&sweep[2].power<=25&&
      sweep[1].power-sweep[0].power>=40&&sweep[3].power-sweep[2].power>=25);
    check(`${label}: power begins a second sweep before release`,
      sweep[3].power>sweep[2].power+25&&sweep[3].power<=100);
  }
  check(`${label}: cast sends power at pointer release`,Number.isInteger(power)&&power>=0&&power<=100&&
    Math.abs(power-pointerEvents.filter(event=>event.type==='pointerup').at(-1)?.power)<=8);
  check(`${label}: cast zone matches released power`,calls.at(-1)?.payload.castZone===
    (power<35?'near':power<70?'mid':'far'));
  check(`${label}: server uses matching zone`,sessions.get(label)?.challenge.castZone===calls.at(-1)?.payload.castZone);
  const transition=await page.locator('.room-fishing-v4-sea').evaluate(sea=>{
    const bait=sea.querySelector('.room-fishing-v5-cast-bait').getBoundingClientRect();
    return{castRelease:sea.classList.contains('cast-release'),
      castFlight:sea.classList.contains('cast-flight'),
      lineOpacity:Number(getComputedStyle(sea.querySelector('.room-fishing-v4-line-thread')).opacity),
      bait:{x:(bait.left+bait.right)/2,y:(bait.top+bait.bottom)/2}};
  });
  fs.writeFileSync(path.join(out,`${label}-cast-transition.json`),JSON.stringify(transition,null,2));
  const movingLine=await lineGeometry(page);
  check(`${label}: cast swing draws line from moving tip to flying bait`,transition.castFlight&&
    transition.lineOpacity>.3&&movingLine?.tipGap<3&&movingLine.baitGap<4);
  const castLayers=await lineLayer(page);
  check(`${label}: cast bait and water splash stay behind the foreground rod`,
    castLayers.splash<castLayers.rod&&castLayers.bait<castLayers.rod);
  await snapshot(page,`${label}-cast-transition`);
  await page.waitForFunction(()=>!document.querySelector('.room-fishing-v4-sea')?.classList.contains('cast-flight'));
  const soundAfterCast=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length,samples:__qa.sampleStarts.length}));
  check(`${label}: charged cast, release and confirmed splash play synthesized fallback`,
    soundAfterCast.tones-soundBeforeCast.tones>=3&&soundAfterCast.noise-soundBeforeCast.noise>=3);
  const castAudio=await page.evaluate(at=>({
    tones:__qa.soundStarts.filter(sound=>sound.at>=at),
    noise:__qa.noiseStarts.filter(sound=>sound.at>=at),
    samples:__qa.sampleStarts.filter(sound=>sound.at>=at)}),soundBeforeCast.at);
  check(`${label}: cast air-cut and water landing retain separate effects`,
    castAudio.noise.some(sound=>sound.filter==='bandpass')&&
    castAudio.noise.some(sound=>sound.filter==='highpass')&&
    castAudio.noise.some(sound=>sound.filter==='lowpass'));
  check(`${label}: cast and splash play distinct decoded game effects`,
    castAudio.samples.some(sound=>sound.duration>.33&&sound.duration<.38)&&
    castAudio.samples.some(sound=>sound.duration>.67&&sound.duration<.74));
  const splashAudio=castAudio.samples.find(sound=>sound.duration>.67&&sound.duration<.74);
  check(`${label}: water sound starts when the cast reaches the surface`,
    splashAudio?.at>=pointerEvents.filter(event=>event.type==='pointerup').at(-1)?.perfAt+650);
  // The cast-release rod pose has a short transition; inspect the settled
  // waiting pose separately from the snap animation.
  await page.waitForTimeout(150);
  const waitHeader=await headerVisible(page);
  check(`${label}: header fully visible while waiting`,waitHeader.visible);
  check(`${label}: hook available only after bite`,await page.locator('.room-fishing-v4-hook').isDisabled()||
    await page.locator('.room-fishing-v4-sea').getAttribute('data-biting')==='true');
  const waitLine=await lineGeometry(page);check(`${label}: waiting line joins rod and bobber`,
    waitLine&&waitLine.tipGap<3&&waitLine.ringGap<8&&waitLine.paths[0]===waitLine.paths[1]);
  const waitLayers=await lineLayer(page);check(`${label}: waiting line and splash sit behind the rod foreground`,
    waitLayers.water<waitLayers.line&&waitLayers.line<waitLayers.rod&&waitLayers.splash<waitLayers.rod);
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
  const soundBeforeHook=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length,samples:__qa.sampleStarts.length}));
  await page.locator('.room-fishing-v4-hook').click();
  await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor({timeout:5000});
  const soundAfterHook=await page.evaluate(()=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length,samples:__qa.sampleStarts.length}));
  check(`${label}: confirmed hook plays its synthesized fish-on cue`,
    soundAfterHook.tones-soundBeforeHook.tones>=2&&soundAfterHook.noise-soundBeforeHook.noise>=1);
  check(`${label}: genuine server hook accepted`,(await actionCalls(page,'hook')).length===1&&sessions.get(label)?.challenge.stage==='fight');
  const fightLine=await lineGeometry(page);
  fs.writeFileSync(path.join(out,`${label}-fight-line-diagnostics.json`),JSON.stringify(fightLine,null,2));
  check(`${label}: fighting line joins rod and water splash`,
    fightLine&&fightLine.tipGap<3&&fightLine.splashGap<4);
  const fightLayers=await lineLayer(page);check(`${label}: fighting line sits behind the rod foreground`,
    fightLayers.water<fightLayers.line&&fightLayers.line<fightLayers.rod);
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
  const soundBeforeReel=await page.evaluate(()=>({tones:__qa.soundStarts.length,samples:__qa.sampleStarts.length,at:performance.now()}));
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
      signedRate:Number(wheel.closest('.room-fishing-v5-hud').dataset.reelRate),movement:wheel.closest('.room-fishing-v5-hud').dataset.reelDirection,
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
    (Math.sign(reelBefore.signedRate)===Math.sign(reelAfter.signedRate)
      ?reelDelta*reelBefore.signedRate>3
      :reelAfter.movement===(reelAfter.signedRate>0?'in':'out')&&Math.abs(reelDelta)>1));
  check(`${label}: reel sound follows signed line direction while the fish surges`,
    await page.evaluate(at=>__qa.sampleStarts.filter(sound=>sound.at>=at&&sound.src?.endsWith('/reel_in_fast.ogg'))
      .every(sound=>sound.lineDirection==='in'),soundBeforeReel.at));
  const inwardAudio=await page.evaluate(at=>({
    tones:__qa.soundStarts.filter(sound=>sound.at>=at),
    noise:__qa.noiseStarts.filter(sound=>sound.at>=at),
    samples:__qa.sampleStarts.filter(sound=>sound.at>=at)}),soundBeforeReel.at);
  const inwardReelStarts=inwardAudio.samples.filter(sound=>sound.src?.endsWith('/reel_in_fast.ogg'));
  check(`${label}: inward reel layer loops instead of stacking at tick cadence`,
    inwardReelStarts.every((sound,index)=>sound.loop===true&&
      (index===0||sound.at-inwardReelStarts[index-1].at>=500)));
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
  const soundBeforeLineOut=await page.evaluate(()=>performance.now());
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
  // A powerful fish may already be drawing line while the reel is held. In
  // that case the outward layer remains alive across release instead of
  // making a second play() call just for the pointer transition.
  await page.waitForFunction(()=>{
    const media=__qa.sampleElements.find(item=>item.src.endsWith('/line_out_drag.ogg'));
    return media?.loop&&!media.paused&&media.volume>.1;
  },null,{timeout:2000});
  const outwardAudio=await page.evaluate(at=>({
    tones:__qa.soundStarts.filter(sound=>sound.at>=at),
    noise:__qa.noiseStarts.filter(sound=>sound.at>=at),
    samples:__qa.sampleStarts.filter(sound=>sound.src?.endsWith('/line_out_drag.ogg')||sound.at>=at)}),soundBeforeLineOut);
  check(`${label}: released fish draw starts the separate continuous line-drag layer`,
    outwardAudio.samples.some(sound=>sound.src?.endsWith('/line_out_drag.ogg')&&
      sound.loop===true&&sound.promise==='fulfilled')&&
    !outwardAudio.samples.some(sound=>sound.src?.endsWith('/reel_in_fast.ogg')));
  const lineOutPlayback=await page.evaluate(()=>{
    const media=__qa.sampleElements.find(item=>item.src.endsWith('/line_out_drag.ogg'));
    return{at:performance.now(),volume:media?.volume,paused:media?.paused,
      currentTime:media?.currentTime,duration:media?.duration,readyState:media?.readyState,muted:media?.muted};
  });
  await page.waitForTimeout(170);
  const lineOutProgress=await page.evaluate(()=>{
    const media=__qa.sampleElements.find(item=>item.src.endsWith('/line_out_drag.ogg'));
    return{at:performance.now(),paused:media?.paused,currentTime:media?.currentTime};
  });
  fs.writeFileSync(path.join(out,`${label}-line-out-playback.json`),
    JSON.stringify({lineOutPlayback,lineOutProgress},null,2));
  check(`${label}: line-out loop advances at an audible mixed level`,
    lineOutPlayback.paused===false&&lineOutProgress.paused===false&&
    lineOutPlayback.readyState>=2&&lineOutPlayback.muted===false&&
    lineOutPlayback.volume>.1&&lineOutPlayback.volume<.8&&
    (lineOutProgress.currentTime-lineOutPlayback.currentTime+lineOutPlayback.duration)%lineOutPlayback.duration>.045);
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
  const soundBeforeCalm=await page.evaluate(()=>performance.now());
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
  const reelPlayback=await page.evaluate(()=>{
    const media=__qa.sampleElements.find(item=>item.src.endsWith('/reel_in_fast.ogg'));
    const started=__qa.sampleStarts.filter(item=>item.src?.endsWith('/reel_in_fast.ogg')).at(-1);
    return{at:performance.now(),volume:media?.volume,paused:media?.paused,
      currentTime:media?.currentTime,readyState:media?.readyState,muted:media?.muted,
      started};
  });
  await page.waitForTimeout(120);
  const reelProgress=await page.evaluate(()=>{
    const media=__qa.sampleElements.find(item=>item.src.endsWith('/reel_in_fast.ogg'));
    return{at:performance.now(),volume:media?.volume,paused:media?.paused,
      currentTime:media?.currentTime,readyState:media?.readyState};
  });
  fs.writeFileSync(path.join(out,`${label}-reel-playback.json`),JSON.stringify({reelPlayback,reelProgress},null,2));
  check(`${label}: reel loop actually plays and advances at an audible mixed level`,
    reelPlayback.started?.promise==='fulfilled'&&reelPlayback.paused===false&&
    reelProgress.paused===false&&reelPlayback.muted===false&&
    reelPlayback.readyState>=2&&reelProgress.currentTime>reelPlayback.currentTime+.07&&
    reelPlayback.started?.loop===true&&reelPlayback.volume>.1&&reelPlayback.volume<.8&&
    reelProgress.volume>.1&&reelProgress.volume<.8);
  const reelStopsBefore=await page.evaluate(()=>__qa.sampleStops.length);
  await page.mouse.up();
  await page.waitForFunction(count=>__qa.sampleStops.length>count,reelStopsBefore,{timeout:1200});
  const reelReleased=await page.evaluate(()=>{
    const media=__qa.sampleElements.find(item=>item.src.endsWith('/reel_in_fast.ogg'));
    return{paused:media?.paused,currentTime:media?.currentTime,volume:media?.volume};
  });
  check(`${label}: releasing reel fades then stops the continuous layer`,
    reelReleased.paused===true&&reelReleased.currentTime===0&&
    Math.abs(reelReleased.volume-.43)<.02);
  const calmDelta=(calmAfter-calmBefore.angle+540)%360-180;
  fs.writeFileSync(path.join(out,`${label}-calm-reel-sample.json`),JSON.stringify({calmBefore,calmAfter,calmDelta,fishPullBefore,server:sessions.get(label)?.challenge&&{distance:sessions.get(label).challenge.distance,runState:sessions.get(label).challenge.runState,pullDirection:sessions.get(label).challenge.pullDirection,control:sessions.get(label).challenge.control}},null,2));
  check(`${label}: calm water lets recovered line wind clockwise faster than idle fish draw`,
    calmBefore.direction==='in'&&calmBefore.rate>2&&calmDelta>20&&calmDelta<150&&
    calmBefore.rate>Math.abs(fishPullBefore.rate));
  const calmAudio=await page.evaluate(at=>({
    tones:__qa.soundStarts.filter(sound=>sound.at>=at),
    noise:__qa.noiseStarts.filter(sound=>sound.at>=at)}),soundBeforeCalm);
  check(`${label}: actual inward winding restarts the public reel recording`,
    await page.evaluate(at=>__qa.sampleStarts.some(sound=>sound.at>=at&&
      sound.src?.endsWith('/reel_in_fast.ogg')),soundBeforeCalm));
  fs.writeFileSync(path.join(out,`${label}-fight-audio.json`),JSON.stringify({
    duringSurge:inwardAudio,inward:calmAudio,outward:outwardAudio},null,2));
  const soundsBeforeNextReel=await page.evaluate(()=>__qa.sampleStarts.filter(sound=>
    sound.src?.endsWith('/reel_in_fast.ogg')).length);
  await holdPointer(page,reel,420);
  check(`${label}: the next reel still makes mechanical sound without a visible audio toggle`,
    await page.evaluate(()=>__qa.sampleStarts.filter(sound=>
      sound.src?.endsWith('/reel_in_fast.ogg')).length)>soundsBeforeNextReel);
  const quickBox=await reel.boundingBox();assert(quickBox,`${label}: short reel hit area`);
  const quickX=quickBox.x+quickBox.width*.5,quickY=quickBox.y+quickBox.height*.5;
  const shortPointerAt=await page.evaluate(()=>performance.now());
  await page.mouse.move(quickX,quickY);await page.mouse.down();
  const shortPointer=await page.evaluate(at=>({
    engaged:__qa.soundStarts.some(sound=>sound.at>=at&&sound.type==='triangle'&&
      Math.abs(sound.frequency-680)<1&&Math.abs(sound.destinationFrequency-260)<1),
    reeling:document.querySelector('.room-fishing-v4-reel')?.dataset.reeling}),shortPointerAt);
  await page.mouse.up();
  check(`${label}: a short pointer press makes an immediate reel engagement sound`,
    shortPointer.engaged&&shortPointer.reeling==='true');
  const shortKeyAt=await page.evaluate(()=>performance.now());
  await page.keyboard.down('Space');
  const shortKey=await page.evaluate(at=>({
    engaged:__qa.soundStarts.some(sound=>sound.at>=at&&sound.type==='triangle'&&
      Math.abs(sound.frequency-680)<1&&Math.abs(sound.destinationFrequency-260)<1),
    reeling:document.querySelector('.room-fishing-v4-reel')?.dataset.reeling}),shortKeyAt);
  await page.keyboard.up('Space');
  check(`${label}: a short keyboard press makes the same reel sound`,
    shortKey.engaged&&shortKey.reeling==='true');
  const beforeBlur=await page.evaluate(()=>{const state={sounds:__qa.soundStarts.length,samples:__qa.sampleStarts.length,suspends:__qa.audioSuspends,
    state:__qa.audioContext?.state};window.dispatchEvent(new Event('blur'));
    return{...state,soundsAtBlur:__qa.soundStarts.length,samplesAtBlur:__qa.sampleStarts.length};});
  await page.waitForTimeout(220);
  const afterBlur=await page.evaluate(()=>({sounds:__qa.soundStarts.length,samples:__qa.sampleStarts.length,suspends:__qa.audioSuspends,
    state:__qa.audioContext?.state,playingMedia:__qa.sampleElements.filter(media=>media.src.includes('/pixabay_fishing_v1/')&&!media.paused).length}));
  fs.writeFileSync(path.join(out,`${label}-audio-blur.json`),JSON.stringify({beforeBlur,afterBlur},null,2));
  check(`${label}: lost focus suspends fishing audio and stops clicks`,
    afterBlur.state==='suspended'&&afterBlur.sounds===beforeBlur.soundsAtBlur&&afterBlur.samples===beforeBlur.samplesAtBlur&&afterBlur.playingMedia===0);
  const focused=await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));return{
    windowFocused:__minigame.inspect().windowFocused,
    ready:__qa.sampleElements.filter(media=>media.src.includes('/pixabay_fishing_v1/')&&media.readyState>=2).length};});
  check(`${label}: refocusing keeps three public media clips preloaded`,focused.windowFocused&&focused.ready===3);
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
    await page.waitForTimeout(800); // Separate stress fixtures beyond the production sound cooldown.
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
  const beforeStress=await page.evaluate(()=>__qa.sampleStarts.filter(sound=>
    sound.src?.endsWith('/line_strain.ogg')).length);
  const warning=await setStrength(34);
  const warningStress=await page.evaluate(()=>__qa.sampleStarts.filter(sound=>
    sound.src?.endsWith('/line_strain.ogg')).length);
  await snapshot(page,`${label}-wheel-warning`);
  const danger=await setStrength(12);
  const dangerStress=await page.evaluate(()=>__qa.sampleStarts.filter(sound=>
    sound.src?.endsWith('/line_strain.ogg')).length);
  check(`${label}: warning and danger trigger the short line-strain cue without a continuous loop`,
    warningStress>beforeStress&&dangerStress>warningStress);
  const strainPlayback=await page.evaluate(()=>{
    const media=__qa.sampleElements.find(item=>item.src.endsWith('/line_strain.ogg'));
    const started=__qa.sampleStarts.filter(item=>item.src?.endsWith('/line_strain.ogg')).at(-1);
    return{at:performance.now(),volume:media?.volume,paused:media?.paused,
      currentTime:media?.currentTime,readyState:media?.readyState,muted:media?.muted,started};
  });
  await page.waitForTimeout(110);
  const strainProgress=await page.evaluate(()=>{
    const media=__qa.sampleElements.find(item=>item.src.endsWith('/line_strain.ogg'));
    return{at:performance.now(),paused:media?.paused,currentTime:media?.currentTime};
  });
  fs.writeFileSync(path.join(out,`${label}-strain-playback.json`),
    JSON.stringify({strainPlayback,strainProgress},null,2));
  const naturallyFinished=strainProgress.paused===true&&strainProgress.currentTime===0&&
    strainPlayback.started?.duration-strainPlayback.currentTime<=
      (strainProgress.at-strainPlayback.at)/1000*strainPlayback.started?.rate+.03;
  check(`${label}: danger strain recording advances at its intentional level`,
    strainPlayback.started?.promise==='fulfilled'&&strainPlayback.paused===false&&
    strainPlayback.currentTime>.05&&
    (strainProgress.paused===false&&strainProgress.currentTime>strainPlayback.currentTime+.06||naturallyFinished)&&
    strainPlayback.readyState>=2&&
    strainPlayback.muted===false&&strainPlayback.volume>=.5&&strainPlayback.volume<=.75&&
    strainPlayback.started?.loop===false);
  const strainStarts=await page.evaluate(()=>__qa.sampleStarts.filter(sound=>
    sound.src?.endsWith('/line_strain.ogg')).map(sound=>sound.at));
  check(`${label}: surge and tension do not stack strain recordings`,
    strainStarts.every((at,index)=>index===0||at-strainStarts[index-1]>=500));
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
async function runAudioFallback(){
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
  try{
    await setup(page,'audio-fallback');
    for(const mode of ['constructor','media-error']){
      if(mode==='media-error')blockedMedia.add('audio-fallback');
      const before=await page.evaluate(mode=>{
        __minigame.dismiss();__qa.blockSamples=mode==='constructor';
        const snapshot={tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length,samples:__qa.sampleStarts.length};
        __minigame.open({kind:'fishing',characterId:'room-character-luffy'});
        return snapshot;
      },mode);
      await page.getByRole('button',{name:'開始釣魚'}).click();
      await page.locator('.room-fishing-v4-sea[data-stage="cast"]').waitFor();
      await holdPointer(page,page.locator('.room-fishing-v4-cast'),220);
      await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor({timeout:5000});
      await page.waitForFunction(()=>!document.querySelector('.room-fishing-v4-sea')?.classList.contains('cast-flight'));
      const after=await page.evaluate(sampleIndex=>({tones:__qa.soundStarts.length,noise:__qa.noiseStarts.length,
        samples:__qa.sampleStarts.length,played:__qa.sampleStarts.slice(sampleIndex)}),before.samples);
      fs.writeFileSync(path.join(out,`audio-fallback-${mode}.json`),JSON.stringify({before,after},null,2));
      check(`audio fallback: ${mode} failure keeps local cast and splash with synthesis backup`,
        after.played.some(sound=>sound.duration>.33&&sound.duration<.38)&&
        after.played.some(sound=>sound.duration>.67&&sound.duration<.74)&&
        after.tones-before.tones>=3&&after.noise-before.noise>=2);
    }
    await page.evaluate(()=>__minigame.dismiss());
  }finally{await context.close();}
}
async function runAudioContinuity(){
  const label='audio-continuity';
  const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
  try{
    await setup(page,label);await begin(page,label);await castAndHook(page,label);
    const fixture=await page.evaluate(client=>fetch(`/qa-audio-calm?client=${client}`,{method:'POST'})
      .then(response=>response.json()),label);
    check(`${label}: stable fight fixture is active`,fixture.ok===true);
    await page.waitForTimeout(1150);
    const reel=page.locator('.room-fishing-v4-reel');
    const box=await reel.boundingBox();assert(box,'continuous reel hit area');
    const x=box.x+box.width*.5,y=box.y+box.height*.5;
    const firstAt=await page.evaluate(()=>performance.now());
    await page.mouse.move(x,y);await page.mouse.down();
    await page.waitForFunction(()=>{
      const media=__qa.sampleElements.find(item=>item.src.endsWith('/reel_in_fast.ogg'));
      return media?.loop&&!media.paused&&media.volume>.1;
    },null,{timeout:2500});
    await page.waitForTimeout(4200);
    const held=await page.evaluate(at=>{
      const media=__qa.sampleElements.find(item=>item.src.endsWith('/reel_in_fast.ogg'));
      return{starts:__qa.sampleStarts.filter(item=>item.at>=at&&item.src?.endsWith('/reel_in_fast.ogg')),
        paused:media?.paused,loop:media?.loop,duration:media?.duration,volume:media?.volume,
        direction:document.querySelector('.room-fishing-v5-hud')?.dataset.reelDirection};
    },firstAt);
    fs.writeFileSync(path.join(out,`${label}-inward-sustained.json`),JSON.stringify(held,null,2));
    check(`${label}: inward motor remains one audible loop after more than four seconds`,
      held.starts.length===1&&held.starts[0].loop===true&&held.starts[0].promise==='fulfilled'&&
      held.loop===true&&held.paused===false&&held.duration<4&&held.volume>.1&&held.direction==='in');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForTimeout(650);
    const reducedMotion=await page.evaluate(()=>{
      const media=__qa.sampleElements.find(item=>item.src.endsWith('/reel_in_fast.ogg'));
      return{mediaPlaying:!media?.paused,loop:media?.loop,volume:media?.volume,
        visualDirection:document.querySelector('.room-fishing-v5-hud')?.dataset.reelDirection};
    });
    check(`${label}: reduced motion keeps motor sound while visual reel settles`,
      reducedMotion.mediaPlaying&&reducedMotion.loop===true&&reducedMotion.volume>.1&&
      reducedMotion.visualDirection==='still');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{
      const reel=__qa.sampleElements.find(item=>item.src.endsWith('/reel_in_fast.ogg'));
      const out=__qa.sampleElements.find(item=>item.src.endsWith('/line_out_drag.ogg'));
      __qa.mixTrace=[];const started=performance.now();
      const sample=()=>{__qa.mixTrace.push({at:performance.now(),in:reel?.paused?0:reel?.volume||0,
        out:out?.paused?0:out?.volume||0});
        if(performance.now()-started<800)requestAnimationFrame(sample);};sample();
    });
    const releasedAt=await page.evaluate(()=>performance.now());
    await page.mouse.up();
    await page.waitForFunction(()=>{
      const media=__qa.sampleElements.find(item=>item.src.endsWith('/line_out_drag.ogg'));
      return media?.loop&&!media.paused&&media.volume>.1;
    },null,{timeout:2500});
    await page.waitForTimeout(700);
    const transition=await page.evaluate(at=>({trace:__qa.mixTrace,
      outStarts:__qa.sampleStarts.filter(item=>item.at>=at&&item.src?.endsWith('/line_out_drag.ogg')),
      reel:__qa.sampleElements.find(item=>item.src.endsWith('/reel_in_fast.ogg'))?.paused,
      outward:__qa.sampleElements.find(item=>item.src.endsWith('/line_out_drag.ogg'))?.paused,
      direction:document.querySelector('.room-fishing-v5-hud')?.dataset.reelDirection}),releasedAt);
    fs.writeFileSync(path.join(out,`${label}-mix-transition.json`),JSON.stringify({held,transition},null,2));
    check(`${label}: release crossfades inward and outward rather than cutting to silence`,
      transition.outStarts.length===1&&transition.outStarts[0].loop===true&&
      transition.trace.some(item=>item.in>.015&&item.out>.015)&&
      transition.reel===true&&transition.outward===false&&transition.direction==='out');
    await page.waitForTimeout(3450);
    const sustainedOut=await page.evaluate(at=>{
      const media=__qa.sampleElements.find(item=>item.src.endsWith('/line_out_drag.ogg'));
      return{starts:__qa.sampleStarts.filter(item=>item.at>=at&&item.src?.endsWith('/line_out_drag.ogg')),
        loop:media?.loop,paused:media?.paused,volume:media?.volume,duration:media?.duration,
        direction:document.querySelector('.room-fishing-v5-hud')?.dataset.reelDirection,
        challenge:__minigame.inspect().game?.challenge?.stage};
    },releasedAt);
    fs.writeFileSync(path.join(out,`${label}-outward-sustained.json`),JSON.stringify(sustainedOut,null,2));
    check(`${label}: outward drag remains one audible loop after more than four seconds`,
      sustainedOut.starts.length===1&&sustainedOut.loop===true&&sustainedOut.paused===false&&
      sustainedOut.duration<4&&sustainedOut.volume>.1);
    const outStartsBeforeBlur=await page.evaluate(()=>__qa.sampleStarts.filter(item=>
      item.src?.endsWith('/line_out_drag.ogg')).length);
    const blurred=await page.evaluate(()=>{
      window.dispatchEvent(new Event('blur'));
      return{focused:__minigame.inspect().windowFocused,
        media:__qa.sampleElements.filter(item=>item.src.includes('/pixabay_fishing_v1/')&&!item.paused).length};
    });
    check(`${label}: blur immediately stops the motor loop`,blurred.focused===false&&blurred.media===0);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(()=>{
      const media=__qa.sampleElements.find(item=>item.src.endsWith('/line_out_drag.ogg'));
      return __minigame.inspect().windowFocused&&media?.loop&&!media.paused&&media.volume>.1;
    },null,{timeout:2500});
    check(`${label}: returning focus resumes outward pull from real line motion`,
      await page.evaluate(()=>__qa.sampleStarts.filter(item=>
        item.src?.endsWith('/line_out_drag.ogg')).length)>outStartsBeforeBlur);
    await page.mouse.move(x,y);await page.mouse.down();
    await page.waitForFunction(()=>{
      const media=__qa.sampleElements.find(item=>item.src.endsWith('/reel_in_fast.ogg'));
      return document.querySelector('.room-fishing-v5-hud')?.dataset.reelDirection==='in'&&
        media?.loop&&!media.paused&&media.volume>.1;
    },null,{timeout:2500});
    await page.mouse.up();
    check(`${label}: renewed winding reverses the motor layer`,
      await page.evaluate(()=>__qa.sampleStarts.filter(item=>item.src?.endsWith('/reel_in_fast.ogg')).length)>=2);
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
    await page.waitForFunction(()=>!document.querySelector('.room-fishing-v4-sea')?.classList.contains('cast-flight'));
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:8000});
    await page.evaluate(()=>{
      __qa.flickVisual=[];
      const sea=document.querySelector('.room-fishing-v4-sea');
      const observer=new MutationObserver(()=>{
        __qa.flickVisual.push({at:performance.now(),tell:sea.dataset.flickTell,
          cue:sea.dataset.flickCue});
      });
      observer.observe(sea,{attributes:true,attributeFilter:['data-flick-tell','data-flick-cue']});
      __qa.flickVisualObserver=observer;
    });
    await page.locator('.room-fishing-v4-hook').click();
    await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor();
    const cueSoundAt=await page.evaluate(()=>performance.now());
    await page.waitForFunction(expected=>document.querySelector('.room-fishing-v5-flick-cue')?.dataset.direction===expected&&
      document.querySelector('.room-fishing-v5-flick-cue')?.dataset.active==='true',direction,{timeout:1300});
    check(`${label}: real fish surge publishes the matching cue`,sessions.get(label)?.challenge.flickCue?.direction===direction&&
      (await page.locator('.room-fishing-v4-sea').getAttribute('data-flick-cue'))===direction);
    const preCueAudio=await page.evaluate(()=>({
      visual:__qa.flickVisual,
      anticipation:__qa.sampleStarts.filter(sound=>sound.duration>.37&&sound.duration<.39),
      direction:__qa.sampleStarts.filter(sound=>sound.duration>.395&&sound.duration<.42)}));
    const tellVisualAt=preCueAudio.visual.find(item=>item.tell==='true')?.at;
    const cueVisualAt=preCueAudio.visual.find(item=>item.cue===direction)?.at;
    fs.writeFileSync(path.join(out,`${label}-pre-cue-audio.json`),JSON.stringify(preCueAudio,null,2));
    check(`${label}: bright pre-cue plays once before the direction becomes visible`,
      Number.isFinite(tellVisualAt)&&Number.isFinite(cueVisualAt)&&
      preCueAudio.anticipation.length===1&&preCueAudio.anticipation[0].at<cueVisualAt-80&&
      tellVisualAt<cueVisualAt&&preCueAudio.direction.length===1);
    const meterBefore=await fightMeterState(page);
    check(`${label}: existing reel meter remains visible`,meterBefore.dialVisible&&meterBefore.arcVisible&&await page.locator('.room-fishing-fish-target').isVisible());
    const cueAudio=await page.evaluate(at=>({
      tones:__qa.soundStarts.filter(sound=>sound.at>=at),
      pans:__qa.pans.filter(item=>item.at>=at)}),cueSoundAt);
    const cueNotes={left:[[760,480],[540,310]],right:[[430,670],[590,900]],up:[[370,600],[600,1020]]}[direction];
    const cuePan={left:-.65,right:.65,up:0}[direction];
    check(`${label}: direction cue has its own two-note pitch and position`,
      cueNotes.every(([from,to])=>cueAudio.tones.some(sound=>
        Math.abs(sound.frequency-from)<2&&Math.abs(sound.destinationFrequency-to)<2))&&
      cueAudio.pans.filter(item=>Math.abs(item.pan-cuePan)<.03).length>=2);
    if(direction==='up')await snapshot(page,'flick-up-cue');
    const flickSoundAt=await page.evaluate(()=>performance.now());
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
    const flickAudio=await page.evaluate(at=>({
      tones:__qa.soundStarts.filter(sound=>sound.at>=at),
      noise:__qa.noiseStarts.filter(sound=>sound.at>=at),
      pans:__qa.pans.filter(item=>item.at>=at),
      samples:__qa.sampleStarts.filter(sound=>sound.at>=at),
      responseAt:__qa.responses.find(response=>response.move==='flick')?.perfAt}),flickSoundAt);
    const swingFrom={left:150,right:165,up:185}[direction];
    const swingStartPan={left:.48,right:-.48,up:0}[direction];
    const swingEndPan={left:-.76,right:.76,up:0}[direction];
    const swingNoise=flickAudio.noise.filter(sound=>sound.at<flickAudio.responseAt);
    check(`${label}: the player's flick starts a rising rod sweep before server hit feedback`,
      Number.isFinite(flickAudio.responseAt)&&
      flickAudio.tones.some(sound=>sound.type==='sawtooth'&&
        Math.abs(sound.frequency-swingFrom)<2&&sound.destinationFrequency>sound.frequency*2&&
        sound.at<flickAudio.responseAt)&&
      flickAudio.pans.some(item=>Math.abs(item.pan-swingEndPan)<.03&&item.at<flickAudio.responseAt)&&
      swingNoise.some(sound=>sound.filter==='bandpass'));
    check(`${label}: the audible swing has a continuous, directional air cut and line snap`,
      swingNoise.length>=4&&swingNoise.filter(sound=>sound.filter==='bandpass').length>=2&&
      swingNoise.some(sound=>sound.filter==='lowpass'&&sound.duration>=.14)&&
      swingNoise.some(sound=>sound.filter==='highpass'&&sound.duration>=.1)&&
      flickAudio.pans.some(item=>Math.abs(item.pan-swingStartPan)<.03&&item.at<flickAudio.responseAt)&&
      flickAudio.pans.some(item=>Math.abs(item.pan-swingEndPan)<.03&&item.at<flickAudio.responseAt)&&
      await page.evaluate(()=>__qa.audioContext?.state==='running'));
    check(`${label}: the player's flick plays its decoded swish before hit feedback`,
      flickAudio.samples.some(sound=>sound.duration>.29&&sound.duration<.33&&
        sound.at<flickAudio.responseAt));
    check(`${label}: flick and confirmed hit have different air-cut and impact layers`,
      flickAudio.noise.some(sound=>sound.filter==='highpass')&&
      flickAudio.noise.some(sound=>sound.filter==='lowpass')&&
      flickAudio.tones.some(sound=>sound.at>=flickAudio.responseAt&&sound.type==='triangle'&&
        Math.abs(sound.frequency-(direction==='up'?660:540))<2)&&
      flickAudio.pans.some(item=>item.at>=flickAudio.responseAt&&
        Math.abs(item.pan-({left:-.55,right:.55,up:0}[direction]))<.03));
    check(`${label}: correct direction has a separate bright confirmation chime`,flickAudio.tones.some(sound=>sound.at>=flickAudio.responseAt&&Math.abs(sound.frequency-880)<2)&&flickAudio.tones.some(sound=>sound.at>=flickAudio.responseAt&&Math.abs(sound.frequency-1320)<2));
    check(`${label}: larger rod swing stays active long enough to read`,await page.locator('.room-fishing-v5-rod').evaluate(r=>getComputedStyle(r).animationDuration==='0.62s'));
    fs.writeFileSync(path.join(out,`${label}-flick-audio.json`),JSON.stringify(flickAudio,null,2));
    const assist=await page.evaluate(()=>({
      active:document.querySelector('.room-fishing-v4-sea')?.dataset.flickAssist,
      text:document.querySelector('.room-fishing-v4-signal')?.textContent,
      until:__qa.responses.find(response=>response.move==='flick')?.data?.minigame?.challenge?.flickAssistUntil,
      badge:(()=>{
        const badge=document.querySelector('.room-fishing-v5-assist');
        const box=badge?.getBoundingClientRect(),style=badge&&getComputedStyle(badge);
        const meters=[...document.querySelectorAll('.room-fishing-v5-dial,.room-fishing-v5-pull-arc,.room-fishing-v5-distance,.room-fishing-v5-catch-track')]
          .map(element=>element.getBoundingClientRect());
        const reel=document.querySelector('.room-fishing-v4-reel')?.getBoundingClientRect();
        const cue=document.querySelector('.room-fishing-v5-flick-cue[data-active=true]')?.getBoundingClientRect();
        const overlaps=(first,second)=>first&&second&&first.right>second.left&&
          first.left<second.right&&first.bottom>second.top&&first.top<second.bottom;
        return{hidden:badge?.hidden,text:badge?.textContent,width:box?.width,height:box?.height,
          visible:style?.visibility,display:style?.display,geometry:{box,meters,reel,cue},
          coversMeter:meters.some(meter=>overlaps(box,meter)),coversReel:overlaps(box,reel),coversCue:overlaps(box,cue)};
      })()
    }));
    const assistSeconds=Number(assist.badge.text?.match(/收線助力 (\d+(?:\.\d+)?) 秒/)?.[1]);
    fs.writeFileSync(path.join(out,`${label}-assist-geometry.json`),JSON.stringify(assist,null,2));
    await snapshot(page,`${label}-assist`);
    check(`${label}: confirmed direction shows the server-authoritative short reel assist`,
      assist.active==='true'&&Number.isFinite(Date.parse(assist.until))&&
      assistSeconds>0&&assistSeconds<=3.5&&assist.text==='甩竿成功！接下來幾秒收線更快');
    check(`${label}: reel-assist badge is actually visible without covering the meter, reel or direction cue`,
      assist.badge.hidden===false&&assist.badge.display!=='none'&&assist.badge.visible==='visible'&&
      assist.badge.width>90&&assist.badge.height>20&&assist.badge.text.includes('收線助力')&&
      !assist.badge.coversMeter&&!assist.badge.coversReel&&!assist.badge.coversCue);
    await page.waitForTimeout(250);
    const nextAssist=await page.evaluate(()=>({
      active:document.querySelector('.room-fishing-v4-sea')?.dataset.flickAssist,
      text:document.querySelector('.room-fishing-v4-signal')?.textContent,
      badge:document.querySelector('.room-fishing-v5-assist')?.textContent
    }));
    const nextSeconds=Number(nextAssist.badge?.match(/收線助力 (\d+(?:\.\d+)?) 秒/)?.[1]);
    check(`${label}: reel-assist countdown advances during the fight`,
      nextAssist.active==='true'&&nextSeconds>0&&nextSeconds<assistSeconds&&
      nextAssist.text===assist.text&&nextAssist.badge.includes(`${nextSeconds} 秒`));
    await page.waitForTimeout(520);
    const line=await lineGeometry(page);
    check(`${label}: animated rod keeps line attached`,line&&line.tipGap<3&&line.splashGap<4);
    await snapshot(page,`${label}-success`);
  }finally{await context.close();}
}
async function runFlickNegativeFeedback(mode){
  const label=`flick-${mode}`;
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const page=await context.newPage();
  try{
    await setup(page,label);
    await page.getByRole('button',{name:'開始釣魚'}).click();
    await page.locator('.room-fishing-v4-sea[data-stage="cast"]').waitFor();
    await holdPointer(page,page.locator('.room-fishing-v4-cast'),180);
    await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor();
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:8000});
    await page.locator('.room-fishing-v4-hook').click();
    await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor();
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v5-flick-cue')?.dataset.direction==='up'&&
      document.querySelector('.room-fishing-v5-flick-cue')?.dataset.active==='true',null,{timeout:1500});
    const at=await page.evaluate(()=>performance.now());
    if(mode==='wrong')await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(mode=>__qa.responses.some(item=>
      item.data?.minigame?.challenge?.flickFeedback?.result===mode),mode,{timeout:6500});
    await page.waitForFunction(mode=>__qa.soundStarts.some(item=>item.type==='triangle'&&
      Math.abs(item.frequency-(mode==='wrong'?300:250))<2&&
      Math.abs(item.destinationFrequency-115)<2),mode,{timeout:1800});
    const audit=await page.evaluate(at=>({
      tones:__qa.soundStarts.filter(item=>item.at>=at),
      noise:__qa.noiseStarts.filter(item=>item.at>=at),
      flickCalls:__qa.calls.filter(item=>item.payload?.counterMoves?.[0]==='flick'),
      result:__qa.responses.find(item=>item.data?.minigame?.challenge?.flickFeedback?.result)?.data.minigame.challenge.flickFeedback.result
    }),at);
    fs.writeFileSync(path.join(out,`${label}-feedback-audio.json`),JSON.stringify(audit,null,2));
    check(`${label}: server determines the negative flick result`,audit.result===mode&&
      (mode==='miss'?audit.flickCalls.length===0:
        audit.flickCalls.length===1&&audit.flickCalls[0].payload.flickDirection==='left'));
    check(`${label}: missed direction does not grant reel assist`,
      await page.locator('.room-fishing-v4-sea').getAttribute('data-flick-assist')==='false');
    check(`${label}: distinct ${mode} cue sounds without a success flourish`,
      audit.tones.some(item=>item.type==='triangle'&&
        Math.abs(item.frequency-(mode==='wrong'?300:250))<2&&
        Math.abs(item.destinationFrequency-115)<2)&&
      audit.noise.some(item=>item.filter==='bandpass')&&
      !audit.tones.some(item=>item.type==='triangle'&&
        (Math.abs(item.frequency-540)<2&&Math.abs(item.destinationFrequency-960)<2||
          Math.abs(item.frequency-660)<2&&Math.abs(item.destinationFrequency-1140)<2)));
  }finally{await context.close();}
}
async function runPreCueBlur(){
  const label='flick-pre-cue-blur';
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1});
  const page=await context.newPage();
  try{
    await setup(page,label);
    await page.getByRole('button',{name:'開始釣魚'}).click();
    await page.locator('.room-fishing-v4-sea[data-stage="cast"]').waitFor();
    await holdPointer(page,page.locator('.room-fishing-v4-cast'),180);
    await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor();
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:8000});
    await page.locator('.room-fishing-v4-hook').click();
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.flickTell==='true'&&
      __qa.sampleStarts.some(sound=>sound.duration>.37&&sound.duration<.39),null,{timeout:1600});
    const before=await page.evaluate(()=>({sampleCount:__qa.sampleStarts.filter(sound=>
      sound.duration>.37&&sound.duration<.39).length,blurAt:performance.now()}));
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(()=>__qa.audioContext?.state==='suspended',null,{timeout:1000});
    const after=await page.evaluate(()=>({stops:__qa.sampleStops.filter(sound=>
      sound.duration>.37&&sound.duration<.39),focused:__minigame.inspect().windowFocused,
      sampleCount:__qa.sampleStarts.filter(sound=>sound.duration>.37&&sound.duration<.39).length}));
    check(`${label}: focus loss stops the active anticipation clip and suspends audio`,
      before.sampleCount===1&&after.sampleCount===1&&after.focused===false&&
      after.stops.some(item=>item.at>=before.blurAt));
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(90);
    check(`${label}: returning focus does not repeat the same anticipation cue`,
      await page.evaluate(()=>__qa.sampleStarts.filter(sound=>sound.duration>.37&&sound.duration<.39).length)===1);
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
    const near=await sample('near',51),mid=await sample('mid',52.285),far=await sample('far',53);
    fs.writeFileSync(path.join(out,`${label}-cast-depth.json`),JSON.stringify({near,mid,far},null,2));
    check(`${label}: far cast approaches the horizon with strong depth separation`,far.floatY<=35&&near.floatY-far.floatY>=35);
    check(`${label}: scaled far float stays centered on its projected water depth`,Math.abs(far.bobberY-far.floatY*far.seaHeight/100)<4);
    check(`${label}: near cast bobber visibly larger than far cast`,
      near.bobberWidth/mid.bobberWidth>1.2&&mid.bobberWidth/far.bobberWidth>1.2&&
      near.bobberHeight/far.bobberHeight>1.7);
    check(`${label}: both cast bobbers stay small against the sea`,
      near.bobberWidth<46&&far.bobberWidth<24);
    check(`${label}: near cast splash visibly larger than far cast`,near.splashWidth/far.splashWidth>2);
    check(`${label}: near cast splash does not dominate the foreground`,near.splashWidth<105);
    check(`${label}: cast distance moves mostly deeper into the rod's forward lane`,
      near.bobberX<mid.bobberX&&mid.bobberX<far.bobberX&&
      far.bobberX-near.bobberX<near.seaWidth*.1&&
      near.floatY-mid.floatY>10&&mid.floatY-far.floatY>10&&
      near.bobberY>mid.bobberY+near.seaHeight*.08&&
      mid.bobberY>far.bobberY+near.seaHeight*.08);
    check(`${label}: cast bobbers remain inside sea`,[near,mid,far].every(sample=>
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
async function runCastInputs(){
  for(const label of ['cast-latency','cast-keyboard-click','cast-keyboard-hold']){
    const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
    try{
      await setup(page,label);await begin(page,label);
      const before=await page.evaluate(()=>performance.now());
      if(label==='cast-keyboard-click')await page.locator('.room-fishing-v4-cast').evaluate(button=>button.click());
      else if(label==='cast-keyboard-hold'){
        await page.keyboard.down(' ');await page.waitForTimeout(180);await page.keyboard.up(' ');
      }else await holdPointer(page,page.locator('.room-fishing-v4-cast'),180);
      await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.classList.contains('cast-flight'));
      check(`${label}: all cast inputs start a flying bait and cast sound`,await page.evaluate(at=>
        __qa.sampleStarts.some(sound=>sound.at>=at&&sound.duration>.33&&sound.duration<.38),before));
      if(label==='cast-latency'){
        await page.waitForTimeout(940);
        const pending=await page.locator('.room-fishing-v4-sea').evaluate(sea=>({
          stage:sea.dataset.stage,flight:sea.classList.contains('cast-flight'),
          line:Number(getComputedStyle(sea.querySelector('.room-fishing-v4-line-thread')).opacity),
          bait:Number(getComputedStyle(sea.querySelector('.room-fishing-v5-cast-bait')).opacity),
          splashes:__qa.sampleStarts.filter(sound=>sound.duration>.67&&sound.duration<.74).length}));
        check('cast-latency: line and bait remain while the cast reply is pending',
          pending.stage==='cast'&&pending.flight&&pending.line>.5&&pending.bait>.5&&pending.splashes===0);
        await snapshot(page,'cast-latency-pending');
      }
      await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor({timeout:5000});
      await page.waitForFunction(()=>!document.querySelector('.room-fishing-v4-sea')?.classList.contains('cast-flight'));
      const landing=await page.evaluate(at=>({landed:document.querySelector('.room-fishing-v4-sea').classList.contains('cast-landed'),
        splashes:__qa.sampleStarts.filter(sound=>sound.at>=at&&sound.duration>.67&&sound.duration<.74)}),before);
      check(`${label}: landing splash and sound occur together once`,landing.landed&&landing.splashes.length===1&&
        landing.splashes[0].at>=before+(label==='cast-latency'?1200:700));
      check(`${label}: one cast input sends one authoritative cast`,(await actionCalls(page,'cast')).length===1);
      await snapshot(page,`${label}-landed`);
      fs.writeFileSync(path.join(out,`${label}-landing.json`),JSON.stringify(landing,null,2));
    }finally{await context.close();}
  }
}
async function runSpotProjection(){
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  try{
    for(const spot of ['shore','reef','deep','freshwater','magma','rainbow']){
      const label=`spot-${spot}`;await setup(page,label);
      await page.locator(`button[data-spot="${spot}"]`).click();
      await page.getByRole('button',{name:'開始釣魚'}).click();
      await page.locator('.room-fishing-v4-cast').evaluate(button=>button.click());
      await page.locator('.room-fishing-v4-sea[data-stage="wait"]').waitFor();
      await page.waitForFunction(()=>!document.querySelector('.room-fishing-v4-sea')?.classList.contains('cast-flight'));
      await page.evaluate(client=>fetch(`/qa-cast-target?client=${client}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({zone:'far'})}),label);
      await page.waitForFunction(()=>Math.abs(parseFloat(document.querySelector('.room-fishing-v4-sea')?.style.getPropertyValue('--float-y'))-34)<.15);
      const water=await waterPerspective(page),layers=await lineLayer(page);
      check(`${label}: forward landing lies on the visible middle water`,water.floatY>=34&&water.floatY<=70&&
        water.floatX>=51&&water.floatX<=53&&layers.splash<layers.rod&&layers.line<layers.rod);
      await snapshot(page,label);await page.evaluate(()=>__minigame.dismiss());
    }
  }finally{await context.close();}
}
async function runPower(){
 for(const [label,width,height] of [['power-desktop',1440,900],['power-minimum',960,640]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  try{
   await setup(page,'power');await page.getByRole('button',{name:'開始釣魚'}).click();
   await page.locator('.room-fishing-v4-cast').evaluate(b=>b.click());
   await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:8000});
   await page.locator('.room-fishing-v4-hook').click();
   await page.locator('.room-fishing-v4-sea[data-stage="fight"]').waitFor();
   await page.evaluate(()=>fetch('/qa-power?client=power',{method:'POST'}));
   await page.waitForFunction(()=>!document.querySelector('.room-fishing-special')?.disabled);
   check(label+': stamina meter and six charge lights visible',await page.locator('.room-fishing-fish-stamina').isVisible()&&await page.locator('.room-fishing-power-charge i[data-full=true]').count()===6);
   check(label+': fish silhouette is over water, separate from stamina bar',await page.locator('.room-fishing-fish-target').isVisible()&&await page.locator('.room-fishing-fish-stamina img').count()===0);
   check(label+': target shows the distance under the silhouette',/m$/.test(await page.locator('.room-fishing-target-distance').textContent()));
   await snapshot(page,label+'-fight');await page.locator('.room-fishing-special').click();
   await page.locator('.room-fishing-rhythm:not([hidden])').waitFor();
   await snapshot(page,label+'-rhythm');
   const wrong=sessions.get('power').challenge.special.sequence[0]==='left'?'ArrowRight':'ArrowLeft';
   await page.keyboard.press(wrong);
   await page.locator('.room-fishing-rhythm:not([hidden])').waitFor({state:'hidden'});
   check(label+': failed trial returns keyboard focus to fishing',await page.evaluate(()=>document.activeElement===document.querySelector('#roomMinigameOverlay')));
   await page.waitForFunction(()=>['left','right','up'].includes(document.querySelector('.room-fishing-v4-sea')?.dataset.flickCue),null,{timeout:8000});
   let cue;for(let i=0;i<80;i++){cue=sessions.get('power')?.challenge?.flickCue;if(cue&&Date.parse(cue.until)-Date.now()>500&&await page.locator('.room-fishing-v4-sea').getAttribute('data-flick-cue')===cue.direction)break;await page.waitForTimeout(100);}assert(cue,'Fresh recovery cue');
   await page.keyboard.press({left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp'}[cue.direction]);
   await page.waitForFunction(()=>document.querySelector('.room-fishing-power-charge i[data-full=true]'));
   check(label+': ordinary flick succeeds after failed trial',sessions.get('power').challenge.flickFeedback?.id===cue.id&&sessions.get('power').challenge.flickFeedback.result==='hit');
   await page.evaluate(()=>fetch('/qa-power?client=power',{method:'POST'}));
   await page.waitForFunction(()=>!document.querySelector('.room-fishing-special')?.disabled);
   await page.locator('.room-fishing-special').click();await page.locator('.room-fishing-rhythm:not([hidden])').waitFor();
   await page.locator('.room-fishing-rhythm:not([hidden])').waitFor({state:'hidden',timeout:11000});
   check(label+': expired trial also restores fishing focus',await page.evaluate(()=>document.activeElement===document.querySelector('#roomMinigameOverlay')));
   await page.waitForFunction(()=>['left','right','up'].includes(document.querySelector('.room-fishing-v4-sea')?.dataset.flickCue),null,{timeout:8000});
   let timeoutCue;for(let i=0;i<80;i++){timeoutCue=sessions.get('power')?.challenge?.flickCue;if(timeoutCue&&Date.parse(timeoutCue.until)-Date.now()>500&&await page.locator('.room-fishing-v4-sea').getAttribute('data-flick-cue')===timeoutCue.direction)break;await page.waitForTimeout(100);}assert(timeoutCue,'Fresh timeout recovery cue');
   await page.keyboard.press({left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp'}[timeoutCue.direction]);
   await page.waitForFunction(()=>document.querySelector('.room-fishing-power-charge i[data-full=true]'));
   check(label+': ordinary flick succeeds after timeout',sessions.get('power').challenge.flickFeedback?.id===timeoutCue.id&&sessions.get('power').challenge.flickFeedback.result==='hit');
   await page.evaluate(()=>fetch('/qa-power?client=power',{method:'POST'}));
   await page.waitForFunction(()=>!document.querySelector('.room-fishing-special')?.disabled);
   await page.locator('.room-fishing-special').click();await page.locator('.room-fishing-rhythm:not([hidden])').waitFor();
   const sequence=sessions.get('power').challenge.special.sequence.slice();
   const firstKey={left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'}[sequence[0]];
   await page.keyboard.down(firstKey);await page.keyboard.down(firstKey);await page.keyboard.up(firstKey);
   check(label+': held-key repeat does not consume the next arrow',await page.locator('.room-fishing-rhythm-arrow[data-step=queued]').count()===1);
   for(const direction of sequence.slice(1)){await page.keyboard.press({left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'}[direction]);await page.waitForTimeout(25);}
   await snapshot(page,label+'-rapid-input');
   check(label+': rapid sequence responds before all server acknowledgments',await page.locator('.room-fishing-rhythm-arrow[data-step=queued]').count()>0);
   await page.locator('.room-fishing-special-character').waitFor();
   await page.waitForFunction(()=>{const i=document.querySelector('.room-fishing-special-character');return i?.complete&&i.naturalWidth>0;});
   check(label+': normal-proportion dedicated character art used',await page.locator('.room-fishing-special-character').evaluate(i=>i.src.includes('fishing_v6/special-luffy.webp')&&i.naturalWidth>=900));
   await page.locator('.room-fishing-damage[data-kind=special]').waitFor();
   check(label+': special jump shows actual 600 damage',await page.locator('.room-fishing-damage[data-kind=special]').last().getAttribute('data-amount')==='600');
   check(label+': skill really reduces fish stamina',sessions.get('power').challenge.fishStamina<=300);
   check(label+': skill consumes charges',sessions.get('power').challenge.powerCharge===0);
   await page.waitForTimeout(550);await snapshot(page,label+'-skill');
   await page.evaluate(()=>fetch('/qa-power?client=power',{method:'POST'}));
   await page.waitForFunction(()=>!document.querySelector('.room-fishing-burst')?.disabled);
   const burstSoundStart=await page.evaluate(()=>performance.now());
   await page.locator('.room-fishing-burst').click();await page.waitForTimeout(400);
   check(label+': burst spends three charges',sessions.get('power').challenge.powerCharge===3);
   check(label+': burst animates the rod with rapid alternating pulls',await page.locator('.room-fishing-v5-rod').evaluate(r=>getComputedStyle(r).animationName==='room-fishing-burst-pulls'));
   await snapshot(page,label+'-burst');
   await page.waitForTimeout(1700);
   const burstSound=await page.evaluate(t=>({pans:__qa.pans.filter(x=>x.at>=t).map(x=>x.pan),tones:__qa.soundStarts.filter(x=>x.at>=t).map(x=>x.frequency)}),burstSoundStart);
   check(label+': burst sounds move left and right and vary their pitches',burstSound.pans.some(x=>x<-.4)&&burstSound.pans.some(x=>x>.4)&&new Set(burstSound.tones).size>=5);
   await page.evaluate(()=>fetch('/qa-power?client=power&stamina=20',{method:'POST'}));
   await page.waitForFunction(()=>!document.querySelector('.room-fishing-special')?.disabled);
   await page.locator('.room-fishing-special').click();await page.locator('.room-fishing-rhythm:not([hidden])').waitFor();
   const finishSequence=sessions.get('power').challenge.special.sequence.slice();
   for(const direction of finishSequence){await page.keyboard.press({left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'}[direction]);await page.waitForTimeout(220);}
   await page.locator('.room-fishing-special-character').waitFor();
   check(label+': killing skill still presents the character before the catch result',await page.evaluate(()=>__minigame.inspect().phase==='landing')&&sessions.get('power').feedback.reason==='landed');
   const hpAtHit=Number(await page.locator('.room-fishing-fish-stamina').getAttribute('aria-valuenow'));
   check(label+': lethal skill keeps the previous stamina visible during wind-up',hpAtHit>0);
   await page.waitForTimeout(1250);
   const hpDuringHit=Number(await page.locator('.room-fishing-fish-stamina').getAttribute('aria-valuenow'));
   check(label+': lethal jump clips damage to remaining 20 HP',await page.locator('.room-fishing-damage[data-kind=special]').last().getAttribute('data-amount')==='20');
   check(label+': lethal skill visibly drains stamina before landing',hpDuringHit>0&&hpDuringHit<hpAtHit);
   await page.waitForTimeout(750);
   check(label+': zero stamina remains visible before the catch screen',await page.locator('.room-fishing-fish-stamina').getAttribute('aria-valuenow')==='0'&&await page.locator('.room-fishing-v3-catch-name').count()===0);
   await snapshot(page,label+'-zero-stamina');
   await page.locator('.room-fishing-v3-catch-name').waitFor({timeout:35000});
   check(label+': exhausted fish actually reaches the catch screen',await page.locator('.room-fishing-v3-catch-name').isVisible());
  }finally{await context.close();}
 }
}

async function runDamage(){
 for(const [label,width,height] of [['damage-desktop',1440,900],['damage-minimum',960,640]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();
  try{
   await setup(page,'power');await page.getByRole('button',{name:'開始釣魚'}).click();await page.locator('.room-fishing-v4-cast').evaluate(b=>b.click());
   await page.waitForFunction(()=>document.querySelector('.room-fishing-v4-sea')?.dataset.biting==='true',null,{timeout:8000});await page.locator('.room-fishing-v4-hook').click();
   await page.locator('.room-fishing-v4-sea[data-stage=fight]').waitFor();await page.locator('#roomMinigameOverlay').focus();await page.keyboard.down('Space');
   await page.locator('.room-fishing-damage[data-kind=reel]').first().waitFor({timeout:4000});
   check(label+': holding reel produces authoritative damage jump',Number(await page.locator('.room-fishing-damage[data-kind=reel]').first().getAttribute('data-amount'))>0&&sessions.get('power').challenge.fishStamina<2000);
   await snapshot(page,label+'-reel');await page.keyboard.up('Space');await page.waitForTimeout(1500);
   check(label+': releasing reel stops new damage jumps',await page.locator('.room-fishing-damage[data-kind=reel]').count()===0);
   await page.evaluate(()=>fetch('/qa-grade?client=power',{method:'POST'}));await page.waitForFunction(()=>document.querySelector('.room-fishing-fish-stamina')?.getAttribute('aria-valuemax')==='36000');
   check(label+': grade IV shows actual HP and recommended rod',await page.locator('.room-fishing-tier').textContent()==='階級 IV · 建議釣竿 +99');
   await snapshot(page,label+'-grade-iv');
  }finally{await context.close();}
 }
}

async function runForge(){
 for(const [label,width,height] of [['forge-desktop',1440,900],['forge-minimum',960,640]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();await setup(page,'forge');
  await page.evaluate(()=>__minigame.receive({rod:{maxLevel:99,characters:{'room-character-luffy':{level:98,nextCost:411}}}}));
  await page.locator('.room-fishing-v4-workshop summary').click();
  check(label+': shows +98 / +99',await page.locator('.room-fishing-v4-workshop-level').textContent()==='+98 / +99');
  await page.locator('.room-fishing-v4-workshop-upgrade').click();
  await page.locator('.room-rod-forge').waitFor();
  await page.waitForFunction(()=>{const i=document.querySelector('.room-rod-forge-franky');return i?.complete&&i.naturalWidth>0;});
  check(label+': Franky art and rod loaded',await page.locator('.room-rod-forge').evaluate(s=>[...s.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0)));
  check(label+': animated hammer is active',await page.locator('.room-rod-forge-hammer').evaluate(s=>getComputedStyle(s).animationName==='rodForgeHammer'));
  check(label+': purchase button remains disabled at cap',!(await page.locator('.room-fishing-v4-workshop-upgrade').isEnabled()));
  await snapshot(page,label+'-hammer');await page.waitForTimeout(2100);
  check(label+': +99 result and max stats displayed',(await page.locator('.room-rod-forge-result').textContent()).includes('+99')&&(await page.locator('.room-fishing-v4-workshop-current').textContent()).includes('18000'));
  await snapshot(page,label+'-success');await context.close();
 }
}
async function main(){
  fs.mkdirSync(out,{recursive:true});await serve();
  browser=await chromium.launch({executablePath:chrome,headless:true});
  try{
    verifyZeroStrengthBreak();
    if(process.env.LAUNCHER_FISH_V5_QA_ONLY==='damage')await runDamage();
    if(process.env.LAUNCHER_FISH_V5_QA_ONLY==='forge')await runForge();
    if(process.env.LAUNCHER_FISH_V5_QA_ONLY==='power')await runPower();
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='cast')await runCastInputs();
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='spots')await runSpotProjection();
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='desktop')await runV5('desktop',1440,900);
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='minimum')await runV5('minimum',960,640);
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='audio')await runAudioFallback();
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='continuity')await runAudioContinuity();
    if(!process.env.LAUNCHER_FISH_V5_QA_ONLY||process.env.LAUNCHER_FISH_V5_QA_ONLY==='flick'){
      await runFlick('flick-up',1440,900);
      await runFlick('flick-left',1440,900);
      await runFlick('flick-right',960,640);
      await runFlickNegativeFeedback('wrong');
      await runFlickNegativeFeedback('miss');
      await runPreCueBlur();
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
