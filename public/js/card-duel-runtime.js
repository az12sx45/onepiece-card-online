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

/* Old native swap callbacks can run after the flow's global hand restore.
 * Own only the active swap scene's visual borrow; all other mask owners stay intact. */
(() => {
  'use strict';
  function mount(){
    const api=window.CardPhonePresentation,layer=document.getElementById('phoneInteractionFx');
    if(api?.swapHandVisibilityVersion)return true;
    if(!api||typeof api.maskHandArt!=='function'||typeof api.borrowCardVisual!=='function'||typeof api.ownHandElement!=='function'||!layer?.isConnected)return false;
    const originalMask=api.maskHandArt,owners=new Map(),cancelledScenes=new WeakSet();
    let poll=null,round=typeof state==='object'?state?.roundNo:null;
    const identity=()=>JSON.stringify([typeof me==='object'?me?.roomId:null,typeof me==='object'?me?.playerId:null,round]);
    let lastIdentity=identity();
    const fast=()=>typeof isCpuSkipFastMode==='function'&&isCpuSkipFastMode();
    const current=()=>layer.isConnected&&layer.dataset.kind==='swap'?[...layer.children].find(n=>n.classList.contains('phone-hud-scene')&&n.isConnected&&n.parentElement===layer):null;
    function release(scene,invalid=false){
      if(invalid)cancelledScenes.add(scene);
      const owner=owners.get(scene);if(!owner)return;
      owners.delete(scene);for(const done of owner.leases.values())done();owner.leases.clear();
    }
    function cancel(){
      clearTimeout(poll);poll=null;
      for(const scene of [...owners.keys()])release(scene,true);
      const scene=current();if(scene)cancelledScenes.add(scene);
    }
    function sweep(){
      clearTimeout(poll);poll=null;
      if(document.hidden||fast()){cancel();return;}
      const scene=current(),key=identity();
      if(key!==lastIdentity){cancel();lastIdentity=key;return;}
      for(const [owned,owner]of [...owners])if(owned!==scene||owner.identity!==key)release(owned,true);
      if(owners.size)poll=setTimeout(sweep,50);
    }
    api.maskHandArt=function(node){
      sweep();
      const scene=current();
      const viewer=typeof me==='object'?me?.playerId:null;
      if(arguments.length!==0||!scene||!Number.isInteger(viewer)||![scene.dataset.source,scene.dataset.target].includes(String(viewer)))return originalMask.apply(this,arguments);
      if(cancelledScenes.has(scene)||document.hidden||fast()){release(scene,true);return;}
      // Native maskHandArt returns void. Do not create a phantom lease when no
      // hand surface exists at this instant; resolve the live API on each call.
      const source=node||api.ownHandElement();
      const target=source?.closest?.('#playHand,#playDrawn')||source;
      if(!target||target.isConnected===false)return;
      let owner=owners.get(scene);
      if(!owner){owner={identity:identity(),leases:new Map()};owners.set(scene,owner);}
      if(!owner.leases.has(target)){
        const done=api.borrowCardVisual(target);
        if(typeof done==='function')owner.leases.set(target,done);
      }
      sweep();
    };
    new MutationObserver(sweep).observe(layer,{childList:true,attributes:true,attributeFilter:['data-kind']});
    new MutationObserver(sweep).observe(document.body,{childList:true});
    if(typeof socket==='object'&&socket?.on){
      for(const event of ['JOINED','disconnect'])socket.on(event,()=>{cancel();round=null;lastIdentity=identity();});
      socket.on('STATE',s=>{
        if(s?.roundNo!=null)round=s.roundNo;
        const next=identity();if(next!==lastIdentity)cancel();lastIdentity=next;sweep();
      });
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
    window.addEventListener('pagehide',cancel);
    api.clearSwapHandVisibility=cancel;api.swapHandVisibilityVersion=1;
    return true;
  }
  let timer=null,attempts=0;
  function boot(){clearTimeout(timer);if(mount())return;if(++attempts<200)timer=setTimeout(boot,50);}
  document.addEventListener('DOMContentLoaded',()=>{clearTimeout(timer);timer=setTimeout(boot,0);},{once:true});
  document.addEventListener('card:interface-ready',()=>{clearTimeout(timer);timer=setTimeout(boot,0);});
  timer=setTimeout(boot,0);
})();
