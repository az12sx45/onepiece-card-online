/* Embedded into game.html, also used by already-installed mobile bundles.
 * onAny reads barrier metadata outside the animation STATE queue; otherwise
 * a visible venue panel would deadlock its own acknowledgement/release. */
(() => {
  let gate=null, sent=null, timer=null;
  const $=id=>document.getElementById(id);
  function schedule(){clearTimeout(timer);timer=setTimeout(sync,60);}
  function sync(){
    if(!gate || typeof state!=='object' || state?.roundNo!==gate.roundNo){if(gate?.waiting)schedule();return;}
    const intro=$('phoneVenueIntro'),button=$('phoneVenueContinue');
    if(!intro||!button){if(gate.waiting)schedule();return;}
    // A reused room/round can match an old local 'seen' key. The server's new
    // gate identity still requires a fresh explicit confirmation.
    if(gate.waiting && intro.hidden && !window.CardPhonePresentation?.presentationEffectsBusy?.()){
      const cards=intro.querySelector('.phone-venue-intro-cards');
      if(!cards || !state.venues?.length){schedule();return;}
      cards.replaceChildren(...state.venues.map(v=>{
        const card=document.createElement('article'),img=document.createElement('img'),copy=document.createElement('div');
        card.className='venue-card';img.src=VEN(v.name);img.alt=v.name;img.dataset.name=v.name;
        for(const text of [v.name,venueDesc(v.name)]){const line=document.createElement('div');line.textContent=text;copy.append(line);}
        card.append(img,copy);return card;
      }));
      intro.dataset.round=String(gate.roundNo);intro.hidden=false;button.disabled=true;
      const id=gate.id;
      Promise.all([...cards.querySelectorAll('img')].map(img=>img.decode().catch(()=>{}))).then(()=>setTimeout(()=>{
        if(gate?.id===id && !gate.ready.includes(me.playerId) && sent!==id)button.disabled=false;
      },900));
    }
    let status=$('phoneVenueReadyStatus');
    if(!status){intro.style.gridTemplateRows='minmax(24px, auto) minmax(0,1fr) auto 44px';status=document.createElement('p');status.id='phoneVenueReadyStatus';status.setAttribute('role','status');status.style.cssText='margin:0;max-width:90vw;text-align:center;color:#ffe7a3;font-size:clamp(12px,2vh,17px);overflow-wrap:anywhere';button.before(status);}
    if(!gate.waiting){
      status.hidden=true;sent=null;
      // Let the existing handler persist its seen key and enter the venue.
      if(!intro.hidden){button.disabled=false;button.onclick?.();}
      return;
    }
    status.hidden=false;
    const names=gate.required.filter(id=>!gate.ready.includes(id)).map(id=>{
      const p=state.players.find(p=>p.id===id);return p?.client?.displayName||p?.displayName||`P${id+1}`;
    });
    const text=`已確認 ${gate.ready.length}/${gate.required.length}　等待：${names.join('、')}`;
    if(status.textContent!==text)status.textContent=text;
    const done=gate.ready.includes(me.playerId)||sent===gate.id;
    const label=done?'已看完，等待其他玩家':'我看完了';
    if(button.textContent!==label)button.textContent=label;
    if(done)button.disabled=true;
    schedule();
  }
  socket.onAny?.((event,s)=>{
    if(event!=='STATE')return;
    gate=s?.venueReady||null;
    if(sent!==gate?.id)sent=null;
    schedule();
  });
  socket.on('disconnect',()=>{sent=null;clearTimeout(timer);});
  window.addEventListener('click',event=>{
    if(!gate?.waiting||!event.target.closest?.('#phoneVenueContinue'))return;
    event.preventDefault();event.stopImmediatePropagation();
    const button=$('phoneVenueContinue');
    if(button.disabled||gate.ready.includes(me.playerId)||sent===gate.id||state?.roundNo!==gate.roundNo)return;
    sent=gate.id;button.disabled=true;
    socket.emit('ACTION',{type:'VENUE_READY',payload:{id:gate.id,roundNo:gate.roundNo},roomId:me.roomId,playerId:me.playerId,secret:me.secret});
    sync();
  },true);
  window.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&gate?.waiting&&!$('phoneVenueIntro')?.hidden){event.preventDefault();event.stopImmediatePropagation();}
  },true);
})();
