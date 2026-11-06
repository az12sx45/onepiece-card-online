/* Queue the shared duel stage without the retained native text prelude. */
(() => {
  'use strict';
  function mount(){
    const api=window.CardPhonePresentation;
    if(!api||api.duelRuntimeVersion||api.duelSceneVersion<4||typeof api.attachDuelDetails!=='function'||typeof api.isEffectBusy!=='function'||typeof playDuel!=='function')return;
    api.duelRuntimeVersion=1;
    let originalBusy=api.isEffectBusy||(()=>false),epoch=0,active=null,poll=null;
    const queue=[],timers=new Set(),animations=new Set(),assetWaits=new Set(),assetCache=new Map();
    const layer=document.createElement('div');layer.id='cardDuelLayer';layer.className='card-duel-layer';layer.hidden=true;document.body.append(layer);
    const fast=()=>document.hidden||(typeof isCpuSkipFastMode==='function'&&isCpuSkipFastMode());
    const visible=id=>{const n=document.getElementById(id);return !!n&&!n.hidden&&!n.classList.contains('hidden')&&n.getClientRects().length>0;};
    const combinedBusy=()=>!!active||queue.length>0||!!originalBusy();
    api.isEffectBusy=combinedBusy;
    const make=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text!=null)n.textContent=text;return n;};
    const model=()=>typeof state==='object'?state:null;
    const name=id=>model()?.players?.find(p=>p.id===id)?.client?.displayName||model()?.players?.find(p=>p.id===id)?.displayName||'P'+(id+1);
    const validCard=id=>Number.isInteger(id)&&id>=0&&id<20;
    const card=id=>validCard(id)?`images/cards/${id}.webp`:'images/cards/back.webp';
    function anchor(id){
      const row=api.playerVisualElement?.(id)||document.getElementById('players')?.children[id];
      const rect=api.cardPlayerRect?.(id)||row?.querySelector('img.rounded-full')?.getBoundingClientRect()||row?.getBoundingClientRect();
      return rect?.width?{id,x:rect.left+rect.width/2,y:rect.top+rect.height/2}:null;
    }
    function cancelWork(){
      clearTimeout(poll);poll=null;
      for(const release of assetWaits)release();
      for(const timer of timers)clearTimeout(timer);timers.clear();
      for(const animation of animations)animation.cancel();animations.clear();
    }
    function clear(){
      epoch++;cancelWork();queue.length=0;active=null;layer.replaceChildren();layer.hidden=true;
      delete document.documentElement.dataset.cardDuelActive;
      api.clearDuelPrivate?.();api.restoreHandArt?.();
    }
    function later(fn,ms,generation){
      const timer=setTimeout(()=>{timers.delete(timer);if(generation===epoch)fn();},ms);timers.add(timer);return timer;
    }
    function preload(url){
      if(assetCache.has(url))return assetCache.get(url);
      const pending=new Promise(resolve=>{
        const image=new Image();
        image.onload=()=>image.decode?image.decode().then(()=>resolve(true),()=>resolve(false)):resolve(true);
        image.onerror=()=>resolve(false);image.src=url;
        if(image.complete&&image.naturalWidth)resolve(true);
      });
      assetCache.set(url,pending);return pending;
    }
    function ready(request){
      const id=request.duelId??`${request.leftId}:${request.rightId}:${request.winnerId??'draw'}`;
      const urls=api.duelStageAssetsFor?.(id)||[];
      if(validCard(request.loserCardId))urls.push(new URL(card(request.loserCardId),document.baseURI).href);
      return new Promise(resolve=>{
        let completed=false;
        const release=()=>{if(completed)return;completed=true;clearTimeout(deadline);assetWaits.delete(release);resolve();};
        const deadline=setTimeout(release,5000);assetWaits.add(release);
        Promise.all(urls.map(preload)).then(release,release);
      });
    }
    for(const arena of ['marineford','onigashima','dressrosa'])preload(new URL(`images/card-duel/arena-${arena}-v1.webp`,document.baseURI).href);
    async function pump(){
      clearTimeout(poll);poll=null;
      if(active||!queue.length)return;
      if(fast()){clear();return;}
      if(originalBusy()||api.isCardEntering?.()||api.isCardSkillIntroBusy?.()||api.isEnhancementBusy?.()||api.isCoinBusy?.()||visible('enhOverlay')||visible('drawOverlay')||visible('coinOverlay')){
        poll=setTimeout(pump,50);return;
      }
      const request=queue.shift(),generation=epoch;
      active=request;
      await ready(request);
      if(generation!==epoch)return;
      if(fast()){clear();return;}
      layer.hidden=false;layer.replaceChildren();document.documentElement.dataset.cardDuelActive='1';
      const scene=make('div','card-duel-scene');layer.append(scene);
      const animate=(node,frames,duration=400,delay=0)=>{
        if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
        const animation=node.animate(frames,{duration,delay,easing:'cubic-bezier(.2,.7,.25,1)',fill:'both'});
        animations.add(animation);animation.finished.catch(()=>{});
      };
      try{
        api.playDuelScene({scene,from:request.leftId,to:request.rightId,d:request,
          bounds:{left:0,top:0,right:innerWidth,bottom:innerHeight,width:innerWidth,height:innerHeight},
          anchor,handAnchor:a=>a,animate,later:(fn,ms)=>later(fn,ms,generation),make,name,card,validCard});
      }catch(error){
        clear();throw error;
      }
      later(()=>{
        cancelWork();active=null;layer.replaceChildren();layer.hidden=true;delete document.documentElement.dataset.cardDuelActive;
        if(queue.length)pump();else api.restoreHandArt?.();
      },Number(api.duelStageDuration)||9200,generation);
    }
    playDuel=function(opts){
      if(!opts||api.committingPresentation||fast()||!Number.isInteger(opts.leftId)||!Number.isInteger(opts.rightId)||opts.leftId===opts.rightId)return;
      queue.push(api.attachDuelDetails(opts));pump();
    };
    api.cancelDuelStages=clear;
    if(typeof socket==='object')for(const event of ['disconnect','JOINED'])socket.on(event,()=>{round=null;clear();});
    let round=null;
    if(typeof socket==='object')socket.on('STATE',s=>{
      if(round!=null&&s?.roundNo!=null&&s.roundNo!==round)clear();
      if(s?.roundNo!=null)round=s.roundNo;
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
    window.addEventListener('pagehide',clear);
  }
  let bootTimer=null,attempts=0;
  function boot(){
    clearTimeout(bootTimer);mount();
    if(window.CardPhonePresentation?.duelRuntimeVersion)return;
    if(++attempts<200)bootTimer=setTimeout(boot,50);
  }
  document.addEventListener('DOMContentLoaded',()=>{clearTimeout(bootTimer);bootTimer=setTimeout(boot,0);},{once:true});
  document.addEventListener('card:interface-ready',()=>{clearTimeout(bootTimer);bootTimer=setTimeout(boot,0);});
  bootTimer=setTimeout(boot,0);
})();
