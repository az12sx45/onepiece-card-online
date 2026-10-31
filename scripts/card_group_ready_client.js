/* Global presentation acknowledgement, outside the local animation queue.
 * Reading gates stay explicit; completed animations acknowledge automatically. */
(() => {
 function mount(){
  const api=window.CardPhonePresentation;if(!api||api.groupReadyVersion)return;api.groupReadyVersion=1;
  let gate=null,timer=null,sent=null,sentAt=0;
  const visible=id=>{const n=document.getElementById(id);return !!n&&!n.hidden&&!n.classList.contains('hidden')&&n.getClientRects().length>0;};
  const localBusy=()=>document.hidden||api.presentationQueueSize?.()>0||api.presentationEffectsBusy?.()||api.isVenueIntroPending?.()||api.isVenueEntering?.()||(!state?.pending&&api.isCardResolving?.())||['phoneCardSheet','phonePrivateReveal','phoneLibrary','cardDexOverlay','phoneVenueIntro','rewardModal','rewardOverlay'].some(visible);
  const current=()=>gate?.waiting&&typeof state==='object'&&state?.presentationReady?.id===gate.id;
  const canSend=api.canSendPresentedAction;api.canSendPresentedAction=target=>!gate?.waiting&&(!canSend||canSend(target));
  const originalSend=typeof sendAction==='function'?sendAction:null;
  if(originalSend)sendAction=function(type,payload){if(gate?.waiting&&!['TAKE_BACK_CONTROL','LOBBY_KICK'].includes(type))return;return originalSend(type,payload);};
  function label(){
   let n=document.getElementById('phoneGroupReadyStatus');
   const waiting=current()&&(sent===gate.id||gate.ready.includes(me.playerId));
   if(!waiting){n?.remove();return;}
   const host=document.getElementById('cardActiveTurn');if(!host)return;
   if(!n){n=document.createElement('small');n.id='phoneGroupReadyStatus';n.style.cssText='display:block;font-size:.75em;line-height:1.4;pointer-events:none';host.append(n);}
   const text=`等待大家看完 · ${gate.ready.length}/${gate.required.length}`;if(n.textContent!==text)n.textContent=text;
  }
  function sync(){
   clearTimeout(timer);timer=null;label();
   if(!gate?.waiting)return;
   timer=setTimeout(sync,100);
   if(!current()||gate.ready.includes(me.playerId)||localBusy())return;
   if(sent===gate.id&&Date.now()-sentAt<2000)return;
   sent=gate.id;sentAt=Date.now();
   socket.emit('ACTION',{type:'PRESENTATION_READY',payload:{id:gate.id,roundNo:gate.roundNo},roomId:me.roomId,playerId:me.playerId,secret:me.secret});label();
  }
  socket.onAny?.((event,s)=>{if(event!=='STATE')return;gate=s?.presentationReady||null;if(sent!==gate?.id)sent=null;clearTimeout(timer);timer=setTimeout(sync,100);});
  for(const event of ['JOINED','disconnect'])socket.on(event,()=>{gate=null;sent=null;clearTimeout(timer);timer=null;label();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0),{once:true});else setTimeout(mount,0);
})();
