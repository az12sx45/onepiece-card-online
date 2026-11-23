/* Clean television spread. Playback and moderation live on control.html. */
(() => {
  'use strict';
  const API = 'https://renjun-hengru-wishes-live-2026.onrender.com';
  const DEFAULT_AVATAR = './assets/default-avatar.svg';
  const DEFAULT_AVATARS={male:'./assets/default-avatar-male.svg',female:'./assets/default-avatar-female.svg',unspecified:DEFAULT_AVATAR};
  const defaultAvatar=w=>DEFAULT_AVATARS[w?.avatar_gender]||DEFAULT_AVATAR;
  const TURN = 1100;
  const AVATAR_WAIT=2000, TURN_WAIT=TURN+2000, SNAPSHOT_WAIT=75000, SYNC_RETRY=10000;
  // Inline copies of the existing wedding silhouettes remain available when
  // even a static default-avatar request stalls. Normal loaded assets win.
  const inlineAvatar=gender=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480"><defs><radialGradient id="paper"><stop stop-color="#fffdf5"/><stop offset="1" stop-color="#f1e0d7"/></radialGradient></defs><circle cx="240" cy="240" r="240" fill="url(#paper)"/><circle cx="240" cy="240" r="211" fill="none" stroke="#cbb88e" stroke-width="2"/><circle cx="240" cy="240" r="198" fill="none" stroke="#e0cdbb"/><g fill="none" stroke="#97a68a" stroke-width="2.6" stroke-linecap="round"><path d="M104 306q-28-77 22-144M376 306q28-77-22-144"/><path d="M101 275q-27-12-16-34q24 10 16 34m0-55q-17-21 4-38q17 18-4 38M379 275q27-12 16-34q-24 10-16 34m0-55q17-21-4-38q-17 18 4 38" fill="#a6b199" fill-opacity=".25"/></g>'+(gender==='female'?'<g fill="none" stroke="#b77e8b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M176 272q-12-41-6-94q5-71 70-71t70 71q6 53-6 94M196 174q29-3 45-28q14 24 43 28v25q0 43-44 57q-44-14-44-57Z"/><path d="M216 252v27l-47 20q-28 11-31 43M264 252v27l47 20q28 11 31 43M216 279q24 30 48 0"/></g>':gender==='male'?'<g fill="none" stroke="#b77e8b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M190 197v-25q0-58 50-58t50 58v25q0 50-50 63q-50-13-50-63Z"/><path d="M191 173q20-4 31-22q26 21 66 16M216 254v26l-47 19q-28 11-31 43M264 254v26l47 19q28 11 31 43M216 280l24 21l24-21"/></g>':'<path d="M240 271c-64-36-68-76-34-87c16-5 29 3 34 14c5-11 18-19 34-14c34 11 30 51-34 87Z" fill="#c9989d"/>')+'<path d="M159 354h162" stroke="#d3bc95" stroke-width="1.5"/></svg>');
  const segmenter=new Intl.Segmenter('zh-TW',{granularity:'grapheme'});
  const dwellFor=message=>Math.round(Math.min(15000,Math.max(6000,6000+[...segmenter.segment(String(message||'').normalize('NFC'))].length*300)));
  const PHOTO_FILES=Array.from({length:5},(_,i)=>'./assets/couple-'+(i+1)+'.jpg');
  const photoImages=new Map();
  const AVATAR_MAX_ENTRIES=256,AVATAR_MAX_BYTES=32*1024*1024,AVATAR_MAX_IMAGE=153600;
  const avatarCache=new Map(),avatarLoads=new Map();let avatarBytes=0;
  const $ = id => document.getElementById(id);
  const right = $('rightPage'), sheet = $('turningSheet'), front = $('sheetFront'), back = $('sheetBack'), shadow = $('pageTurnShadow');
  const wishes = new Map(), known = new Set();
  let pending = [], historyResume = null, urgentInFlight = null, current = null, paused = false, busy = false, timer, activeAnimation, animations = [];
  let cursor = 0, stream, syncing = null, resync = false, initial = true, duringSync = [], connected = false, syncRetry;
  let turnPhase='idle',lastRecovery=null;
  let photoIndex=4,controlCursor=0,controlVersion=-1,controlReady=false,controlFlight=false;
  const controlQueue=[];
  let resumeId = null;
  try { resumeId = localStorage.getItem('renjun_hengru_book_current_v2'); } catch {}
  try {const value=localStorage.getItem('renjun_hengru_book_photo_v3');if(value!==null&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<5)photoIndex=Number(value);}catch{}

  function element(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function ordered() { return [...wishes.values()].sort((a,b) => a.at - b.at || Number(a.id) - Number(b.id)); }
  function pruneUrgent(){pending=pending.filter(id=>wishes.has(id));}
  function rememberHistory(){
    const old=ordered().filter(w=>!pending.includes(w.id)),index=old.findIndex(w=>w.id===current?.id);
    historyResume={ids:old.map(w=>w.id),nextIndex:index<0?0:(index+1)%old.length};
  }
  function resumeTarget(){
    if(!historyResume)return null;const {ids,nextIndex}=historyResume;
    for(let i=0;i<ids.length;i++){const wish=wishes.get(ids[(nextIndex+i)%ids.length]);if(wish)return wish;}
    return ordered().find(w=>!pending.includes(w.id))||null;
  }
  function restingFallback(){return wishes.get(current?.id)||ordered().find(w=>!pending.includes(w.id))||null;}
  function normalize(w) {
    if (!w || w.id == null || typeof (w.message ?? w.blessing_text) !== 'string') return null;
    if (w.moderation_status && w.moderation_status !== 'approved') return null;
    const at = Number(w.at) || Date.parse(w.created_at) || 0;
    return { ...w, id:String(w.id), author:String(w.author ?? w.guest_name ?? '賓客'), message:String(w.message ?? w.blessing_text), group:Number(w.group ?? w.group_number)||1, style:Number(w.style ?? w.style_id)||1, at };
  }
  function safeAvatar(path,fallback) {
    if (typeof path !== 'string' || !path) return fallback;
    try { const u = new URL(path, API); return u.origin === new URL(API).origin && /^\/api\/avatars\/[\w-]+$/.test(u.pathname) ? u.href : fallback; } catch { return fallback; }
  }
  const avatarSource=w=>w?safeAvatar(w.avatar_path||w.avatar_id&&'/api/avatars/'+w.avatar_id,null):null;
  const avatarCurrent=(id,source)=>wishes.has(id)&&avatarSource(wishes.get(id))===source;
  function forgetAvatar(id){
    const entry=avatarCache.get(id);
    if(entry){avatarCache.delete(id);avatarBytes-=entry.bytes;URL.revokeObjectURL(entry.url);}
    const flight=avatarLoads.get(id);
    if(flight){avatarLoads.delete(id);flight.active=false;flight.controller.abort();}
  }
  function pruneAvatars(){
    for(const [id,entry] of avatarCache)if(!avatarCurrent(id,entry.source))forgetAvatar(id);
    for(const [id,flight] of avatarLoads)if(!avatarCurrent(id,flight.source))forgetAvatar(id);
  }
  function trimAvatars(){
    const printed=new Set([...document.querySelectorAll('.guest-avatar')].map(img=>img.src));
    while(avatarCache.size>AVATAR_MAX_ENTRIES||avatarBytes>AVATAR_MAX_BYTES){
      const victim=[...avatarCache].find(([,entry])=>!printed.has(entry.url))||avatarCache.entries().next().value;
      forgetAvatar(victim[0]);
    }
  }
  function cachedAvatar(w){
    const id=String(w.id),source=avatarSource(w);if(!source||!avatarCurrent(id,source))return Promise.resolve(null);
    const cached=avatarCache.get(id);
    if(cached?.source===source){avatarCache.delete(id);avatarCache.set(id,cached);return Promise.resolve(cached);}
    if(cached)forgetAvatar(id);
    const previous=avatarLoads.get(id);
    if(previous?.source===source)return previous.promise;
    if(previous)forgetAvatar(id);
    const flight={source,controller:new AbortController(),active:true,promise:null};avatarLoads.set(id,flight);
    flight.promise=(async()=>{
      let timeout,candidateURL;
      const valid=()=>flight.active&&avatarLoads.get(id)===flight&&avatarCurrent(id,source);
      const ensure=()=>{if(!valid())throw new Error('Avatar no longer public');};
      try{
        const result=await Promise.race([(async()=>{
          const response=await fetch(source,{cache:'no-store',signal:flight.controller.signal});ensure();
          if(!response.ok||response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='image/jpeg')throw new Error('Invalid avatar response');
          const length=Number(response.headers.get('Content-Length'));
          if(length>AVATAR_MAX_IMAGE)throw new Error('Avatar too large');
          const blob=await response.blob();ensure();
          if(!blob.size||blob.size>AVATAR_MAX_IMAGE)throw new Error('Invalid avatar size');
          candidateURL=URL.createObjectURL(blob);
          const probe=new Image();probe.src=candidateURL;await probe.decode();ensure();
          if(!probe.naturalWidth||!probe.naturalHeight)throw new Error('Invalid avatar image');
          return {source,url:candidateURL,bytes:blob.size};
        })(),new Promise((_,reject)=>{timeout=setTimeout(()=>{flight.controller.abort();reject(new Error('Avatar timeout'));},AVATAR_WAIT);})]);
        ensure();avatarCache.set(id,result);avatarBytes+=result.bytes;candidateURL=null;trimAvatars();
        return avatarCache.get(id)===result?result:null;
      }catch{return null;}
      finally{
        flight.active=false;clearTimeout(timeout);flight.controller.abort();
        if(candidateURL)URL.revokeObjectURL(candidateURL);
        if(avatarLoads.get(id)===flight)avatarLoads.delete(id);
      }
    })();
    return flight.promise;
  }
  function avatar(w) {
    const img = element('img','guest-avatar'); img.alt = w ? w.author + ' 的頭像' : '婚禮花卉愛心預設頭像';
    const fallback=defaultAvatar(w);img.dataset.defaultAvatar=fallback;img.dataset.avatarGender=w?.avatar_gender||'unspecified';
    img.src=fallback;img.avatarHydrationAllowed=true;
    img.onerror = () => { if(img.src.startsWith('blob:')&&w)forgetAvatar(String(w.id));img.onerror=null;img.src=fallback; };
    // The first printed page can appear immediately and hydrate in place.
    // Preparing leaves await this same request; no duplicate no-store img GET.
    img.avatarReady=w&&avatarSource(w)?cachedAvatar(w).then(entry=>{
      if(entry&&img.avatarHydrationAllowed&&avatarCurrent(String(w.id),entry.source)&&avatarCache.get(String(w.id))===entry)img.src=entry.url;
    }):Promise.resolve();
    return img;
  }
  function page(w) {
    const p = element('article','guest-page '+(w?'style-'+w.style:'empty-page'));
    if (w) p.dataset.wishId = w.id;
    p.append(element('h2','chapter','幸福祝福冊'),element('div','chapter-caption','A NOTE FOR THE NEWLYWEDS'),element('div','chapter-rule'));
    const mount = element('div','avatar-mount'); mount.append(avatar(w)); p.append(mount);
    p.append(element('h3','guest-name',w?w.author:'等候第一份祝福'));
    const quote=element('div','blessing-frame'); quote.append(element('p','guest-message',w?w.message:'掃描左頁 QR Code\n讓你的笑容與祝福，留在這一頁。')); p.append(quote);
    const foot=element('div','page-foot'); foot.append(element('span','','仁鈞 ♡ 姮儒 · 珍藏每一份心意'),element('em','',w?String(ordered().findIndex(v=>v.id===w.id)+1).padStart(2,'0'):'♡')); p.append(foot);
    return p;
  }
  function updateStatus() {
    $('wishCount').textContent=String(wishes.size);
    $('pageStatus').textContent=current?'第 '+(ordered().findIndex(w=>w.id===current.id)+1)+' 頁'+(paused?' · 已暫停':' · 停留 '+(dwellFor(current.message)/1000).toFixed(1)+' 秒'):'等待第一份祝福';
  }
  function fitPrintedText(root) {
    for (const p of root.querySelectorAll('.guest-page')) {
      const name=p.querySelector('.guest-name'),message=p.querySelector('.guest-message');
      // Measure actual font metrics (including compound Emoji), not string length.
      for(let size=34;size>=24;size--){name.style.fontSize=size+'px';if(name.scrollHeight<=82)break;}
      for(let size=p.classList.contains('empty-page')?26:37;size>=18;size--){message.style.fontSize=size+'px';if(message.scrollHeight<=142&&message.scrollWidth<=message.parentElement.clientWidth-48)break;}
    }
  }
  function render(w, preparedPage) {
    current=w||null; right.replaceChildren(preparedPage||page(current));
    fitPrintedText(right);
    if(current) { try{localStorage.setItem('renjun_hengru_book_current_v2',current.id);}catch{} }
    updateStatus();
  }
  function schedule() { clearTimeout(timer); if(!paused&&!busy&&wishes.size) timer=setTimeout(()=>navigate(1),dwellFor(current?.message)); }
  async function settlesWithin(promise,ms){
    let timeout;
    try{return await Promise.race([Promise.resolve(promise).then(()=>true,()=>false),new Promise(resolve=>{timeout=setTimeout(()=>resolve(false),ms)})]);}
    finally{clearTimeout(timeout);}
  }
  async function decodeImage(img,ms){
    await settlesWithin(Promise.resolve().then(()=>img.decode()),ms);
    return img.naturalWidth&&img.complete?img:null;
  }
  const decodePhoto=img=>decodeImage(img,8000);
  async function preparePhoto(index){
    let img=photoImages.get(index);
    if(!img||(img.complete&&!img.naturalWidth)){img=new Image();img.src=PHOTO_FILES[index];img.id='couplePhoto';img.alt='仁鈞與姮儒的真實合照，第 '+(index+1)+' 張';img.dataset.photoIndex=String(index);photoImages.set(index,img);}
    return decodePhoto(img);
  }
  function layoutPhoto(printed,img,index){
    const ratio=img.naturalWidth/img.naturalHeight;
    const portrait=ratio<.95;
    printed.dataset.photoIndex=String(index);printed.dataset.photoOrientation=portrait?'portrait':'landscape';
    printed.style.setProperty('--photo-ratio',String(ratio));
    printed.style.setProperty('--photo-width',(portrait?340:Math.min(620,360*ratio))+'px');
  }
  function mountPhoto(index,img){
    if(img){layoutPhoto($('leftPage'),img,index);$('couplePhotoMount').replaceChildren(img);}
  }
  function applyPhoto(index,img){
    if(!img)return;
    photoIndex=index;mountPhoto(index,img);
    try{localStorage.setItem('renjun_hengru_book_photo_v3',String(index));}catch{}
  }
  async function prepareReverse(index){
    // The reverse of a right-hand leaf lands on the left: print the actual
    // couple page there, so it already matches the spread when the leaf settles.
    const printed=$('leftPage').cloneNode(true);
    printed.removeAttribute('id');
    printed.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
    printed.classList.add('turning-couple-page');
    printed.dataset.photoIndex=String(index);
    const img=printed.querySelector('.couple-photo img');
    img.src=PHOTO_FILES[index];img.dataset.photoIndex=String(index);
    img.alt='仁鈞與姮儒的真實合照，第 '+(index+1)+' 張';
    if(!await decodePhoto(img))return null;
    layoutPhoto(printed,img,index);
    return printed;
  }
  async function preload(preparedPage) {
    const img=preparedPage.querySelector('.guest-avatar');
    if(await settlesWithin(Promise.resolve(img.avatarReady).then(()=>img.decode()),AVATAR_WAIT)&&img.naturalWidth&&img.complete)return;
    img.avatarHydrationAllowed=false;
    img.onerror=null;img.src=img.dataset.defaultAvatar||DEFAULT_AVATAR;
    if(await decodeImage(img,AVATAR_WAIT))return;
    img.src=inlineAvatar(img.dataset.avatarGender);
    await decodeImage(img,500);
    lastRecovery='avatar-inline-fallback';
  }
  async function turnTo(next, direction=1, forcedPhoto, intent='history') {
    if(busy || !next) { schedule(); return; }
    busy=true;turnPhase='preparing';urgentInFlight=intent==='urgent'?next.id:null;clearTimeout(timer);
    const originalPage=right.firstElementChild,originalWish=current,originalPhoto=$('couplePhoto'),originalPhotoIndex=photoIndex;
    let nextPage,preparedPhoto,reversePage,printed=false,landed=false,redirect=false;
    let targetPhoto=forcedPhoto??((photoIndex+(direction<0?-1:1)+5)%5);
    try{
    updateStatus();nextPage=page(next);
    [,preparedPhoto,reversePage]=await Promise.all([preload(nextPage),preparePhoto(targetPhoto),prepareReverse(direction===1?targetPhoto:photoIndex)]);
    // A moderated item can disappear while its image is loading.
    if(!wishes.has(next.id))return;
    // A slow or unavailable picture must never leave a newly printed reverse
    // landing on an older photograph. Keep both sides on the loaded picture.
    if(!preparedPhoto||!reversePage){
      preparedPhoto=$('couplePhoto');targetPhoto=Number(preparedPhoto?.dataset.photoIndex??photoIndex);
      reversePage=preparedPhoto?.naturalWidth&&preparedPhoto.complete?await prepareReverse(targetPhoto):null;
      if(!reversePage)return;
    }
    // Preparation is not a physical turn yet. A new blessing that arrived
    // while an old page's images loaded must own this next leaf instead.
    pruneUrgent();
    if(direction>0&&(intent==='history'||intent==='resume')&&pending.length){
      redirect=true;return;
    }
    // Move the decoded DOM image with its paper instead of creating a second
    // no-store avatar request during the turn or at the resting-page commit.
    const currentPage=right.firstElementChild;
    printed=true;
    front.replaceChildren(direction===1?currentPage:nextPage);
    back.replaceChildren(reversePage);
    if(direction===1)right.replaceChildren(nextPage);
    sheet.hidden=false;
    // On a backwards turn the current left page is on the raised reverse;
    // reveal the already decoded previous photograph underneath it.
    if(direction<0)mountPhoto(targetPhoto,preparedPhoto);
    fitPrintedText(front);fitPrintedText(right);
    const forward = [
      {transform:'rotateY(0deg) rotateZ(0deg)',boxShadow:'0px 1px 1px #57402d00',offset:0},
      {transform:'rotateY(-36deg) rotateZ(-.35deg)',boxShadow:'22px 15px 19px #57402d38',offset:.25},
      {transform:'rotateY(-90deg) rotateZ(-.7deg)',boxShadow:'35px 17px 25px #57402d45',offset:.5},
      {transform:'rotateY(-145deg) rotateZ(-.35deg)',boxShadow:'12px 10px 12px #57402d30',offset:.75},
      {transform:'rotateY(-180deg) rotateZ(0deg)',boxShadow:'0px 0px 1px #57402d00',offset:1}
    ];
    const frames=direction===1?forward:forward.map(f=>({...f,offset:1-f.offset})).reverse();
    activeAnimation=sheet.animate(frames,{duration:TURN,easing:'cubic-bezier(.37,.06,.43,1)',fill:'both'});
    animations.push(activeAnimation);turnPhase='turning';
    const shade=shadow.animate([{opacity:0},{opacity:.65,offset:.4},{opacity:.32,offset:.8},{opacity:0}],{duration:TURN,fill:'both'});
    animations.push(shade);
    const curve=front.animate([{borderRadius:'0 7px 9px 0'},{borderRadius:'0 70px 80px 0',offset:.4},{borderRadius:'0 7px 9px 0'}],{duration:TURN,fill:'both'});
    animations.push(curve);
    // A pause received mid-turn stops the next dwell, not this physical leaf.
    if(!await settlesWithin(activeAnimation.finished,TURN_WAIT))lastRecovery='animation-deadline';
    const kept=wishes.get(next.id);
    render(kept||restingFallback(),kept?nextPage:undefined);
    applyPhoto(targetPhoto,preparedPhoto);
    landed=true;
    if(kept&&intent==='urgent')pending=pending.filter(id=>id!==kept.id);
    if(kept&&intent==='resume')historyResume=null;
    }catch{
      lastRecovery='turn-retry';
      // Keep an unseen urgent entry until its complete page actually lands.
      if(printed&&!landed){
        const keptOriginal=wishes.get(originalWish?.id);
        render(keptOriginal||restingFallback(),keptOriginal?originalPage:undefined);
        mountPhoto(originalPhotoIndex,originalPhoto);
      }
    }finally{
    // Commit the resting page before removing the leaf: no blank frame.
      try{
        sheet.hidden=true;for(const animation of animations){try{animation.cancel();}catch{}}
        front.replaceChildren();back.replaceChildren();
      }finally{
        animations=[];activeAnimation=null;urgentInFlight=null;busy=false;turnPhase='idle';
        updateStatus();if(redirect)navigate(1);else{schedule();flushControls();}
      }
    }
  }
  function navigate(direction) {
    if(busy) return;
    const list=ordered(); if(!list.length)return;
    pruneUrgent();let target,intent='history';
    if(direction>0) {
      if(pending.length){if(!historyResume)rememberHistory();target=wishes.get(pending[0]);intent='urgent';}
      else if(historyResume){target=resumeTarget();intent='resume';if(!target)historyResume=null;}
    }
    // Looking backwards never consumes an unseen new blessing.
    const history=direction<0?list.filter(w=>!pending.includes(w.id)):list;
    if(!target&&history.length){let index=history.findIndex(w=>w.id===current?.id);if(index<0&&direction<0){const before=history.filter(w=>w.at<(current?.at??Infinity)||(w.at===current?.at&&Number(w.id)<Number(current?.id)));target=before.at(-1)||history.at(-1);}else target=history[(index+direction+history.length)%history.length];}
    if(target)void turnTo(target,direction,undefined,intent);
  }
  function enqueue(w) {
    const n=normalize(w); if(!n)return;
    const isNew=!known.has(n.id); known.add(n.id); wishes.set(n.id,n);pruneAvatars();
    // Initial snapshot and initial SSE replay are history, not urgent work.
    if(isNew && !initial && !pending.includes(n.id)) pending.push(n.id);
    pending.sort((a,b)=>(wishes.get(a)?.at||0)-(wishes.get(b)?.at||0)||Number(a)-Number(b));
    if(!initial && !current && !busy && !paused)navigate(1);
    updateStatus();
  }
  async function snapshot() {
    const controller=new AbortController();let timeout;
    try{
      return await Promise.race([(async()=>{
        let all=[],after=0,latestCursor=0;
        for(let i=0;i<100;i++){
          const response=await fetch(API+'/api/wishes?after='+after+'&limit=200',{cache:'no-store',signal:controller.signal});
          if(!response.ok)throw new Error('無法讀取祝福');
          const data=await response.json();
          if(!data||!Array.isArray(data.wishes)||typeof data.hasMore!=='boolean'||!Number.isSafeInteger(data.cursor)||data.cursor<0||data.wishes.some(w=>!normalize(w)))throw new Error('祝福資料格式不正確');
          all.push(...data.wishes);if(i===0)latestCursor=data.cursor;
          if(!data.hasMore)return {all,cursor:latestCursor,persistent:data.persistent};
          const end=Number(data.wishes.at(-1)?.id);if(!Number.isSafeInteger(end)||end<=after)throw new Error('祝福分頁順序不正確');after=end;
        }
        throw new Error('祝福數量過多，請使用管理備份');
      })(),new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();reject(new Error('祝福同步逾時'));},SNAPSHOT_WAIT);})]);
    }finally{clearTimeout(timeout);controller.abort();}
  }
  async function sync() {
    if(syncing){resync=true;return syncing;}
    syncing=(async()=>{
      duringSync=[];
      try {
        const data=await snapshot();
        clearTimeout(syncRetry);
        const ids=new Set();
        for(const w of data.all){const n=normalize(w);if(n){ids.add(n.id);enqueue(n);}}
        for(const event of duringSync){if(event.type==='wish'){const n=normalize(event.w);if(n){ids.add(n.id);enqueue(n);}}else ids.delete(String(event.id));}
        for(const id of wishes.keys())if(!ids.has(id))wishes.delete(id);
        pruneUrgent();pruneAvatars();
        cursor=Math.max(cursor,data.cursor);
        if(initial){initial=false;render(wishes.get(resumeId)||ordered()[0]||null);schedule();}
        else if(current&&!wishes.has(current.id)&&!busy){render(restingFallback());schedule();}
        else if(current&&!busy){current=wishes.get(current.id)||null;}
        updateStatus();flushControls();
        if(!connected){$('linkStatus').textContent=data.persistent?'已同步 · 重新連接即時訊息中':'舊版服務 · 永久儲存待啟用';}
      } catch(e) {
        if(!connected)$('linkStatus').textContent='連線中斷 · 自動重試';
        if(initial){clearTimeout(syncRetry);syncRetry=setTimeout(sync,SYNC_RETRY);}
      }finally{
        syncing=null;
        // A failed initial snapshot must not prevent the live connection or a
        // later retry. Initial SSE replay still stays historical, not urgent.
        if(!stream){try{connect();}catch{}}
        if(resync){resync=false;setTimeout(sync,200);}
      }
    })();
    return syncing;
  }
  function connect() {
    stream?.close();
    stream=new EventSource(API+'/api/stream?cursor='+cursor);
    stream.addEventListener('open',()=>{connected=true;$('indicator').classList.add('live');$('linkStatus').textContent='LIVE · 即時收錄祝福';});
    stream.addEventListener('wish',e=>{try { const w=JSON.parse(e.data);if(syncing)duringSync.push({type:'wish',w});enqueue(w);cursor=Math.max(cursor,Number(e.lastEventId)||0); }catch{} });
    stream.addEventListener('reset',e=>{try{const d=JSON.parse(e.data);if(d.id){wishes.delete(String(d.id));pruneUrgent();pruneAvatars();if(syncing)duringSync.push({type:'remove',id:d.id});if(current?.id===String(d.id)&&!busy){render(restingFallback());schedule();}}cursor=Math.max(cursor,Number(e.lastEventId)||0);}catch{} void sync();});
    stream.addEventListener('error',()=>{connected=false;$('indicator').classList.remove('live');$('linkStatus').textContent='重新連線中 · 祝福繼續播放';});
  }
  function resize(){const v=document.querySelector('.book-viewport');$('bookScale').style.setProperty('--book-scale',Math.max(.05,Math.min((v.clientWidth-24)/1660,(v.clientHeight-24)/950)));fitPrintedText(right);if(!sheet.hidden)fitPrintedText(front);}
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
  function setPaused(value){
    value=Boolean(value);if(paused===value)return;
    // Stop automatic advances at a complete printed page, never freeze the
    // physical leaf halfway across the couple photograph and QR code.
    paused=value;clearTimeout(timer);updateStatus();schedule();
  }
  function replay(){
    if(busy)return;
    pruneUrgent();historyResume=null;const first=ordered().find(w=>!pending.includes(w.id));
    if(first)void turnTo(first,1,4,'replay');else navigate(1);
  }
  function flushControls(){
    if(initial||busy||!controlQueue.length)return;
    const action=controlQueue.shift();
    if(action==='next')navigate(1);else if(action==='prev')navigate(-1);else if(action==='replay')replay();
    if(!busy&&controlQueue.length)setTimeout(flushControls,0);
  }
  async function pollPlayback(){
    if(controlFlight)return;controlFlight=true;
    try{
      for(let page=0;page<10;page++){
        const r=await fetch(API+'/api/playback'+(controlReady?'?after='+controlCursor+'&limit=100':''),{cache:'no-store',signal:AbortSignal.timeout(8000)});
        if(!r.ok)throw new Error('Control unavailable');const d=await r.json();
        if(typeof d.paused!=='boolean'||!Number.isSafeInteger(d.latest))throw new Error('Invalid playback state');
        if(!controlReady){controlCursor=d.nextCursor??d.latest;controlVersion=d.latest;controlReady=true;setPaused(d.paused);break;}
        if(d.latest!==controlVersion){controlVersion=d.latest;setPaused(d.paused);}
        for(const c of d.commands||[]){if(Number(c.id)>controlCursor&&['next','prev','replay'].includes(c.action))controlQueue.push(c.action);}
        controlCursor=Number(d.nextCursor??d.latest);if(!d.hasMore)break;
      }
      flushControls();
    }catch{}finally{controlFlight=false;}
  }
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('請使用電視瀏覽器的全螢幕功能（F11）');}}
  window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
  document.addEventListener('dblclick',e=>{if(!e.target.closest('a'))void fullscreen();});
  document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowRight')navigate(1);if(e.key==='ArrowLeft')navigate(-1);if(e.code==='Space'){e.preventDefault();setPaused(!paused);}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync();});
  window.addEventListener('beforeunload',()=>{stream?.close();for(const id of new Set([...avatarCache.keys(),...avatarLoads.keys()]))forgetAvatar(id);});
  // Read-only diagnostics permit frame-by-frame verification without a fake production input.
  window.bookPlayback=Object.freeze({get state(){return {currentId:current?.id,pending:[...pending],urgent:[...pending],urgentInFlight,historyResume:historyResume?{ids:[...historyResume.ids],nextIndex:historyResume.nextIndex,nextId:resumeTarget()?.id}:null,ids:ordered().map(w=>w.id),busy,phase:turnPhase,lastRecovery,paused,cursor,photoIndex,dwellMs:dwellFor(current?.message),controlCursor,controlReady,queuedControls:controlQueue.length,avatarCache:{entries:avatarCache.size,bytes:avatarBytes,inFlight:avatarLoads.size,maxEntries:AVATAR_MAX_ENTRIES,maxBytes:AVATAR_MAX_BYTES}};},get animation(){return activeAnimation;},get animations(){return [...animations];},sync});
  resize();render(null);const firstPhotoIndex=photoIndex;preparePhoto(firstPhotoIndex).then(img=>{if(photoIndex===firstPhotoIndex&&!busy)applyPhoto(firstPhotoIndex,img);});for(let i=0;i<5;i++)void preparePhoto(i);void pollPlayback().then(()=>sync());setInterval(pollPlayback,2000);setInterval(()=>{if(!connected)void sync();},10000);setInterval(()=>{if(connected)void sync();},60000);
})();
