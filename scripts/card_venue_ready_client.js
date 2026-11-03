/* Keep local venue reading explicit, including retained clients and boot covers.
 * Server acknowledgement identities and CPU/connection rules remain unchanged. */
(() => {
  const origin=window.__TABLETOP_ANDROID_TEST_ORIGIN||'https://onepiece-card-online.onrender.com';
  if(location.origin!==origin||location.pathname!=='/game.html')return;
  function mount(){
    const api=window.CardPhonePresentation,root=document.documentElement,$=id=>document.getElementById(id);
    if(!api||typeof socket!=='object'||api.venueReadVersion>=2)return;
    api.venueReadVersion=2;
    let gate=null,sent=null,localRead=null,closedId=null,shownId=null,imagesId=null,imagesReady=false;
    let timer=null,generation=0,paintEpoch=0,painting=false,visibleSince=null,connected=socket.connected!==false,receivedMetadata=false;
    let legacyClose=null,controlledButton=null,allowLegacyClose=false,identity='';
    const unconfirmedSeen=new Set();
    const oldPending=api.isVenueIntroPending;
    const model=()=>typeof state==='object'?state:null;
    const bootReady=()=>!root.dataset.cardBoot||root.dataset.cardBoot==='ready';
    const relevant=()=>!!gate&&model()?.phase!=='lobby'&&model()?.roundNo===gate.roundNo&&!!model()?.venues?.length&&Number.isInteger(me?.playerId);
    const needsRetry=()=>localRead===gate?.id&&gate.waiting&&gate.required.includes(me.playerId)&&!gate.ready.includes(me.playerId)&&sent!==gate.id;
    const schedule=()=>{clearTimeout(timer);timer=setTimeout(sync,60);};
    function useGate(next){
      if(next?.id!==gate?.id){generation++;localRead=null;closedId=null;sent=null;imagesId=null;shownId=null;resetClock();}
      gate=next;
    }
    function seenKey(){
      const s=model();return s?JSON.stringify([me.roomId,s.roundNo,s.venues.map(v=>v.name)]):null;
    }
    function removePrematureSeen(){
      if(relevant()&&localRead!==gate.id)unconfirmedSeen.add(seenKey());
      if(!unconfirmedSeen.size)return;
      // v058 stored this key when it merely showed the panel, including under
      // a loading cover. Its closure can reintroduce an earlier unread key when
      // it next writes the list. Remove only views observed unread in this page.
      try{const previous=JSON.parse(sessionStorage.getItem('po-card-venue-intro-v1')||'[]');if(Array.isArray(previous)&&previous.some(key=>unconfirmedSeen.has(key)))sessionStorage.setItem('po-card-venue-intro-v1',JSON.stringify(previous.filter(key=>!unconfirmedSeen.has(key))));}catch{}
    }
    function resetClock(){paintEpoch++;painting=false;visibleSince=null;}
    function disable(button,value){if(button&&button.disabled!==value)button.disabled=value;}
    function hideForPreparation(){
      removePrematureSeen();
      const intro=$('phoneVenueIntro');
      if(intro&&!intro.hidden)intro.hidden=true;
      disable($('phoneVenueContinue'),true);resetClock();
    }
    // Raw STATE metadata arrives before the animation queue applies its model.
    // Do not let an unseen legacy intro block the first model/rows needed by boot.
    api.isVenueIntroPending=()=>{
      if(!bootReady()||document.hidden||gate&&!relevant())return false;
      return !!(relevant()&&localRead!==gate.id)||!!oldPending?.();
    };
    function visible(intro){
      if(!bootReady()||document.hidden||!connected||intro.hidden||!intro.getClientRects().length)return false;
      const style=getComputedStyle(intro);
      return style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity)!==0;
    }
    function rememberSeen(){
      const s=model();if(!s||localRead!==gate?.id)return;
      const key=seenKey();
      unconfirmedSeen.delete(key);
      try{const previous=JSON.parse(sessionStorage.getItem('po-card-venue-intro-v1')||'[]');const seen=new Set(Array.isArray(previous)?previous:[]);seen.add(key);sessionStorage.setItem('po-card-venue-intro-v1',JSON.stringify([...seen].slice(-40)));}catch{}
    }
    function control(button){
      if(controlledButton===button)return;
      controlledButton=button;legacyClose=button.onclick;
      // A script invoking onclick is not evidence that this reader saw the UI.
      button.onclick=function(event){if(allowLegacyClose)return legacyClose?.call(button,event);return false;};
      new MutationObserver(()=>{
        // Retained bundles have their own decode+900 ms enabling timer. Clamp
        // it in this microtask so an enabled button never precedes our painted
        // reading interval (and a quick real tap cannot be silently discarded).
        const intro=$('phoneVenueIntro');
        if(gate&&intro&&(!canRead(intro)||(localRead===gate.id&&!needsRetry())))disable(button,true);
        schedule();
      }).observe(button,{attributes:true,attributeFilter:['disabled']});
    }
    function closeReadIntro(intro,button){
      if(localRead!==gate?.id||!bootReady()||document.hidden)return;
      if(closedId===gate.id&&intro.hidden)return;
      closedId=gate.id;
      rememberSeen();disable(button,false);allowLegacyClose=true;
      try{button.onclick?.();}finally{allowLegacyClose=false;}
      if(!intro.hidden)intro.hidden=true;
      shownId=null;resetClock();
    }
    function ensureCards(intro,button){
      const cards=intro.querySelector('.phone-venue-intro-cards');
      if(!cards)return false;
      if(imagesId!==gate.id){
        imagesId=gate.id;imagesReady=false;resetClock();
        const id=gate.id,epoch=generation;
        cards.replaceChildren(...model().venues.map(v=>{
          const card=document.createElement('article'),img=document.createElement('img'),copy=document.createElement('div');
          card.className='venue-card';img.src=VEN(v.name);img.alt=v.name;img.dataset.name=v.name;
          for(const text of [v.name,venueDesc(v.name)]){const line=document.createElement('div');line.textContent=text;copy.append(line);}
          card.append(img,copy);return card;
        }));
        const decoded=Promise.all([...cards.querySelectorAll('img')].map(img=>img.decode().catch(()=>{})));
        // A broken image must not trap the reader; the venue text remains usable.
        Promise.race([decoded,new Promise(resolve=>setTimeout(resolve,8000))]).then(()=>{
          if(generation!==epoch||gate?.id!==id)return;imagesReady=true;schedule();
        });
      }
      intro.dataset.round=String(gate.roundNo);intro.dataset.venueReadyId=gate.id;control(button);
      return true;
    }
    function startVisibleClock(intro){
      if(!imagesReady||visibleSince!==null||painting)return;
      const epoch=paintEpoch,id=gate.id;painting=true;
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        if(epoch!==paintEpoch)return;painting=false;
        if(gate?.id===id&&visible(intro)){visibleSince=performance.now();schedule();}
      }));
    }
    function canRead(intro){return relevant()&&shownId===gate.id&&imagesReady&&visibleSince!==null&&performance.now()-visibleSince>=900&&visible(intro);}
    function statusNode(intro,button){
      let status=$('phoneVenueReadyStatus');
      if(!status){intro.style.gridTemplateRows='minmax(24px, auto) minmax(0,1fr) auto 44px';status=document.createElement('p');status.id='phoneVenueReadyStatus';status.setAttribute('role','status');status.style.cssText='margin:0;max-width:90vw;text-align:center;color:#ffe7a3;font-size:clamp(12px,2vh,17px);overflow-wrap:anywhere';button.before(status);}
      return status;
    }
    function sync(){
      // A fast initial STATE can precede this deferred mount. Its applied model
      // retains the real server gate; never invent an acknowledgement for it.
      if(!receivedMetadata&&model()?.venueReady)useGate(model().venueReady);
      removePrematureSeen();
      const intro=$('phoneVenueIntro'),button=$('phoneVenueContinue');
      if(!intro||!button){if(gate)schedule();return;}
      if(!bootReady()||document.hidden){hideForPreparation();if(gate)schedule();return;}
      if(!gate)return;
      if(!relevant()){if(!intro.hidden)intro.hidden=true;resetClock();schedule();return;}
      const nextIdentity=String(me.roomId)+'|'+me.playerId;
      if(identity!==nextIdentity){identity=nextIdentity;localRead=null;closedId=null;sent=null;generation++;imagesId=null;shownId=null;resetClock();}
      if(localRead===gate.id&&!gate.waiting){closeReadIntro(intro,button);return;}
      if(intro.hidden&&(api.presentationEffectsBusy?.()||api.isVenueEntering?.())){disable(button,true);schedule();return;}
      if(!ensureCards(intro,button)){schedule();return;}
      const wasHidden=intro.hidden;
      if(wasHidden)intro.hidden=false;
      shownId=gate.id;
      if(wasHidden){intro.tabIndex=-1;intro.focus({preventScroll:true});}
      if(!visible(intro))resetClock();else startVisibleClock(intro);
      const status=statusNode(intro,button),done=localRead===gate.id&&!needsRetry();
      let text;
      if(!connected)text='重新連線後即可確認場地';
      else if(!gate.waiting&&!done)text='閱讀場地介紹後，再進入對局';
      else {
        const names=gate.required.filter(id=>!gate.ready.includes(id)).map(id=>{
          const p=model().players.find(p=>p.id===id);return p?.client?.displayName||p?.displayName||'P'+(id+1);
        });
        text='已確認 '+gate.ready.length+'/'+gate.required.length+'　等待：'+names.join('、');
      }
      status.hidden=false;if(status.textContent!==text)status.textContent=text;
      const label=done?'已看完，等待其他玩家':'我看完了';
      if(button.textContent!==label)button.textContent=label;
      disable(button,done||!canRead(intro));intro.setAttribute('aria-busy',String(!imagesReady));
      if(gate.waiting||!done)schedule();
    }
    socket.onAny?.((event,s)=>{
      if(event!=='STATE')return;
      const next=s?.venueReady||null;
      receivedMetadata=true;useGate(next);
      if(!bootReady())hideForPreparation();
      schedule();
    });
    socket.on('disconnect',()=>{connected=false;sent=null;resetClock();disable($('phoneVenueContinue'),true);clearTimeout(timer);});
    for(const event of ['connect','JOINED'])socket.on(event,()=>{connected=true;resetClock();schedule();});
    window.addEventListener('click',event=>{
      if(!event.target.closest?.('#phoneVenueContinue')||!gate)return;
      event.preventDefault();event.stopImmediatePropagation();
      const intro=$('phoneVenueIntro'),button=$('phoneVenueContinue');
      if(!intro||!button||button.disabled||!canRead(intro)||(localRead===gate.id&&!needsRetry()))return;
      localRead=gate.id;unconfirmedSeen.delete(seenKey());disable(button,true);
      if(gate.waiting&&gate.required.includes(me.playerId)&&!gate.ready.includes(me.playerId)&&sent!==gate.id){
        sent=gate.id;
        socket.emit('ACTION',{type:'VENUE_READY',payload:{id:gate.id,roundNo:gate.roundNo},roomId:me.roomId,playerId:me.playerId,secret:me.secret});
      }
      sync();
    },true);
    window.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&gate&&!$('phoneVenueIntro')?.hidden){event.preventDefault();event.stopImmediatePropagation();}
    },true);
    document.addEventListener('visibilitychange',()=>{resetClock();if(document.hidden)hideForPreparation();schedule();});
    document.addEventListener('card:interface-ready',()=>{resetClock();schedule();});
    new MutationObserver(()=>{
      if(!bootReady()||document.hidden)hideForPreparation();else schedule();
    }).observe(root,{attributes:true,attributeFilter:['data-card-boot']});
    const intro=$('phoneVenueIntro');
    if(intro)new MutationObserver(()=>{
      removePrematureSeen();if(!bootReady()||document.hidden)hideForPreparation();else schedule();
    }).observe(intro,{attributes:true,attributeFilter:['hidden','class']});
    sync();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0),{once:true});else setTimeout(mount,0);
})();
