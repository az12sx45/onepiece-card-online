/* Keep the first match frame covered until its current interface is ready. */
(() => {
  const root=document.documentElement;
  if(root.dataset.cardBoot!=='loading'||window.__cardMatchEntryMounted)return;
  window.__cardMatchEntryMounted=true;
  const $=id=>document.getElementById(id),frames=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  let timer=null,deadline=null,observer=null,working=false,done=false;
  const images=new Map();
  function imageReady(src){
    if(!src)return Promise.resolve(false);
    if(images.has(src))return images.get(src);
    const promise=new Promise(resolve=>{
      const image=new Image();let settled=false;
      const finish=ok=>{if(settled)return;settled=true;clearTimeout(timeout);image.onload=image.onerror=null;resolve(ok);};
      const timeout=setTimeout(()=>finish(false),12000);
      const loaded=()=>{if(!image.naturalWidth){finish(false);return;}if(image.decode)image.decode().then(()=>finish(true),()=>finish(image.naturalWidth>0));else finish(true);};
      image.onload=loaded;
      image.onerror=()=>finish(false);image.src=src;
      if(image.complete)loaded();
    });
    images.set(src,promise);return promise;
  }
  const url=value=>value.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
  function view(){
    const api=window.CardPhonePresentation;
    if(root.dataset.cardPhone!=='table'||root.dataset.cardSeatHud!=='1'||root.dataset.cardMenuLayout!=='v3'||root.dataset.cardFlow!=='1')return null;
    if(api?.presentationFlowVersion!==2||api.ownCollectionVersion!=='2'||api.enhancementVideoOrderVersion!==2||!(api.resultCutinVersion>=2)||!(api.avatarStatusRevealVersion>=1)||api.venueReadVersion!==2)return null;
    if(typeof state!=='object'||!state?.players?.length||typeof me!=='object'||!Number.isInteger(me.playerId)||!state.players[me.playerId])return null;
    const rows=[...document.querySelectorAll('#players > [data-seat-id]')];
    const self=document.querySelector('#phoneSelfPlayer[data-self-design="captain-v1"] .phone-self-captain');
    if(rows.length!==state.players.length||!self)return null;
    const style=$('cardMatchPresentationStyle')||document.querySelector('link[href*="css/card-desktop-table.css"]');
    if(!style?.sheet)return null;
    const css=getComputedStyle(root),captain=getComputedStyle(self);
    if(root.dataset.cardBundledStyles==='1'&&css.getPropertyValue('--card-native-style-ready').trim()!=='1')return null;
    const art=[url(css.getPropertyValue('--card-table-art')),url(css.getPropertyValue('--seat-hud-art')),url(captain.getPropertyValue('--self-captain-art'))];
    if(art.some(src=>!src))return null;
    const avatars=[self,...rows].map(node=>node.matches('img')?node:node.querySelector('img.phone-seat-avatar,.phone-seat-avatar img,img')).filter(Boolean);
    if(!avatars.length)return null;
    return {signature:JSON.stringify([me.roomId,me.playerId,state.roundNo,state.players.map(p=>p.id)]),art:[...new Set([...art,...avatars.map(img=>img.currentSrc||img.src)])]};
  }
  function failed(){
    if(done||$('cardRoomUnavailable'))return;
    root.dataset.cardBoot='failed';
    $('cardMatchBootMessage').textContent='牌桌還沒準備完成，請稍候或重新載入。';
    $('cardMatchBootActions').hidden=false;
  }
  function stop(){clearInterval(timer);clearTimeout(deadline);observer?.disconnect();}
  async function check(){
    if(done||working)return;
    if($('cardRoomUnavailable')){done=true;stop();root.dataset.cardBoot='failed';$('cardMatchBoot').hidden=true;return;}
    const current=view();if(!current)return;
    working=true;
    try{
      const ready=await Promise.all(current.art.map(imageReady));
      if(ready.some(ok=>!ok)){failed();return;}
      await frames();
      if(done||document.hidden||view()?.signature!==current.signature)return;
      done=true;stop();root.dataset.cardBoot='ready';$('cardMatchBoot')?.remove();
      document.dispatchEvent(new Event('card:interface-ready'));
    }finally{working=false;}
  }
  function mount(){
    $('cardMatchBootRetry').onclick=()=>location.reload();
    $('cardMatchBootBack').onclick=()=>location.assign('start.html');
    timer=setInterval(check,125);deadline=setTimeout(failed,20000);
    observer=new MutationObserver(()=>{if($('cardRoomUnavailable'))check();});observer.observe(document.body,{childList:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
    check();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0),{once:true});else setTimeout(mount,0);
})();
