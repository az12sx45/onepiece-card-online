/* Keep engine EMIT packets together until their STATE boundary, including on
 * installed v059 clients. A network pause is not the end of an action. */
(() => {
 function mount(){
  const api=window.CardPhonePresentation;
  if(!api||api.outcomeGuardVersion||typeof socket!=='object'||!socket.listeners||!socket.off)return;
  api.outcomeGuardVersion=1;
  const listeners={EMIT:socket.listeners('EMIT').slice(),STATE:socket.listeners('STATE').slice()};
  for(const type of ['EMIT','STATE'])for(const fn of listeners[type])socket.off(type,fn);
  const dispatch=(type,value)=>{for(const fn of listeners[type])fn.call(socket,value);};
  let packets=[],coinResults=[],timer=null;
  const canSend=api.canSendPresentedAction;
  api.canSendPresentedAction=target=>packets.length===0&&(!canSend||canSend(target));
  const effect=api.presentEffectEvent,busy=api.isEffectBusy;
  function releaseCoinResults(){
   clearTimeout(timer);timer=null;
   if(api.isCoinBusy?.()){timer=setTimeout(releaseCoinResults,60);return;}
   for(const e of coinResults.splice(0))effect?.(e);
  }
  api.presentEffectEvent=e=>{
   // The status icon itself reveals the coin result, even with neutral text.
   if(e?.type==='bigmom_status'&&api.isCoinBusy?.()){coinResults.push(e);releaseCoinResults();return;}
   effect?.(e);
  };
  api.isEffectBusy=()=>coinResults.length>0||!!busy?.();
  socket.on('EMIT',e=>{
   const control=['idle_warning','auto_control_changed','lobby','nav_game','lobby_kicked'].includes(e?.type);
   const standaloneNotice=e?.type==='toast'&&e.to==null&&typeof e.text==='string';
   if(control||standaloneNotice){dispatch('EMIT',e);return;}
   packets.push(e);
  });
  socket.on('STATE',s=>{const batch=packets;packets=[];for(const e of batch)dispatch('EMIT',e);dispatch('STATE',s);});
  function reset(){packets=[];coinResults=[];clearTimeout(timer);timer=null;}
  for(const event of ['JOINED','disconnect'])socket.on(event,reset);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0),{once:true});else setTimeout(mount,0);
})();
