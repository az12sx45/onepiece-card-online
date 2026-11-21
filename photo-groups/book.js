/* One fixed photograph page; one physical leaf turns around the binding. */
(() => {
  'use strict';
  const API = 'https://renjun-hengru-wishes-live-2026.onrender.com';
  const DEFAULT_AVATAR = './assets/default-avatar.svg';
  const DWELL = 10000, TURN = 1100;
  const $ = id => document.getElementById(id);
  const right = $('rightPage'), sheet = $('turningSheet'), front = $('sheetFront'), shadow = $('pageTurnShadow');
  const wishes = new Map(), known = new Set();
  let pending = [], current = null, paused = false, busy = false, timer, activeAnimation, animations = [];
  let cursor = 0, stream, syncing = null, resync = false, initial = true, duringSync = [], connected = false;
  let adminToken = '', wantExport = false;
  const adminImages=new Set();
  let resumeId = null;
  try { resumeId = localStorage.getItem('renjun_hengru_book_current_v2'); } catch {}

  function element(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function ordered() { return [...wishes.values()].sort((a,b) => a.at - b.at || Number(a.id) - Number(b.id)); }
  function normalize(w) {
    if (!w || w.id == null || typeof (w.message ?? w.blessing_text) !== 'string') return null;
    if (w.moderation_status && w.moderation_status !== 'approved') return null;
    const at = Number(w.at) || Date.parse(w.created_at) || 0;
    return { ...w, id:String(w.id), author:String(w.author ?? w.guest_name ?? '賓客'), message:String(w.message ?? w.blessing_text), group:Number(w.group ?? w.group_number)||1, style:Number(w.style ?? w.style_id)||1, at };
  }
  function safeAvatar(path) {
    if (typeof path !== 'string' || !path) return DEFAULT_AVATAR;
    try { const u = new URL(path, API); return u.origin === new URL(API).origin && /^\/api\/avatars\/[\w-]+$/.test(u.pathname) ? u.href : DEFAULT_AVATAR; } catch { return DEFAULT_AVATAR; }
  }
  function avatar(w) {
    const img = element('img','guest-avatar'); img.alt = w ? w.author + ' 的頭像' : '婚禮花卉愛心預設頭像';
    img.src = w ? safeAvatar(w.avatar_path || w.avatar_id && '/api/avatars/'+w.avatar_id) : DEFAULT_AVATAR;
    img.onerror = () => { img.onerror = null; img.src = DEFAULT_AVATAR; };
    return img;
  }
  function page(w) {
    const p = element('article','guest-page '+(w?'style-'+w.style:'empty-page'));
    if (w) p.dataset.wishId = w.id;
    p.append(element('h2','chapter','幸福祝福冊'),element('div','chapter-caption','A NOTE FOR THE NEWLYWEDS'),element('div','chapter-rule'));
    const mount = element('div','avatar-mount'); mount.append(avatar(w)); p.append(mount);
    p.append(element('h3','guest-name',w?w.author:'等候第一份祝福'),element('div','guest-group',w?'第 '+w.group+' 組 · 謝謝你的祝福':'YOUR WORDS, OUR TREASURE'));
    const quote=element('div','blessing-frame'); quote.append(element('p','guest-message',w?w.message:'掃描左頁 QR Code\n讓你的笑容與祝福，留在這一頁。')); p.append(quote);
    const foot=element('div','page-foot'); foot.append(element('span','','仁鈞 ♡ 姮儒 · 珍藏每一份心意'),element('em','',w?String(ordered().findIndex(v=>v.id===w.id)+1).padStart(2,'0'):'♡')); p.append(foot);
    return p;
  }
  function updateStatus() {
    $('wishCount').textContent=String(wishes.size);
    $('pageStatus').textContent=current?'第 '+(ordered().findIndex(w=>w.id===current.id)+1)+' 頁'+(paused?' · 已暫停':' · 每頁 10 秒'):'等待第一份祝福';
    $('prev').disabled=busy||wishes.size<2; $('next').disabled=busy||wishes.size<2; $('replay').disabled=busy||!wishes.size;
    $('pause').textContent=paused?'繼續播放':'暫停播放';
  }
  function fitPrintedText(root) {
    for (const p of root.querySelectorAll('.guest-page')) {
      const name=p.querySelector('.guest-name'),message=p.querySelector('.guest-message');
      // Measure actual font metrics (including compound Emoji), not string length.
      for(let size=34;size>=24;size--){name.style.fontSize=size+'px';if(name.scrollHeight<=82)break;}
      for(let size=p.classList.contains('empty-page')?26:37;size>=18;size--){message.style.fontSize=size+'px';if(message.scrollHeight<=142&&message.scrollWidth<=message.parentElement.clientWidth-48)break;}
    }
  }
  function render(w) {
    current=w||null; right.replaceChildren(page(current));
    fitPrintedText(right);
    if(current) { pending=pending.filter(id=>id!==current.id); try{localStorage.setItem('renjun_hengru_book_current_v2',current.id);}catch{} }
    updateStatus();
  }
  function schedule() { clearTimeout(timer); if(!paused&&!busy&&wishes.size) timer=setTimeout(()=>navigate(1),DWELL); }
  async function preload(w) {
    if (!w) return;
    const img=avatar(w);
    await Promise.race([img.decode().catch(()=>{}),new Promise(r=>setTimeout(r,1200))]);
  }
  async function turnTo(next, direction=1) {
    if(busy || !next || current?.id===next.id) { schedule(); return; }
    busy=true; clearTimeout(timer); updateStatus();
    await preload(next);
    // A moderated item can disappear while its image is loading.
    if(!wishes.has(next.id)) { busy=false; updateStatus(); schedule(); return; }
    front.replaceChildren(page(direction===1?current:next));
    right.replaceChildren(page(direction===1?next:current));
    sheet.hidden=false;
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
    const shade=shadow.animate([{opacity:0},{opacity:.65,offset:.4},{opacity:.32,offset:.8},{opacity:0}],{duration:TURN,fill:'both'});
    const curve=front.animate([{borderRadius:'0 7px 9px 0'},{borderRadius:'0 70px 80px 0',offset:.4},{borderRadius:'0 7px 9px 0'}],{duration:TURN,fill:'both'});
    animations=[activeAnimation,shade,curve];
    // Pause freezes the physical leaf as well as the dwell timer.
    if(paused && direction===0) animations.forEach(a=>a.pause());
    try { await activeAnimation.finished; } catch {}
    render(wishes.get(next.id)||ordered()[0]||null);
    // Commit the resting page before removing the leaf: no blank frame.
    sheet.hidden=true; animations.forEach(a=>a.cancel()); animations=[]; activeAnimation=null; busy=false;
    updateStatus(); schedule();
  }
  function navigate(direction) {
    if(busy) return;
    const list=ordered(); if(!list.length)return;
    let target;
    if(direction>0) {
      while(pending.length && (!wishes.has(pending[0])||pending[0]===current?.id))pending.shift();
      if(pending.length)target=wishes.get(pending.shift());
    }
    const index=list.findIndex(w=>w.id===current?.id);
    target ||= list[(index+direction+list.length)%list.length];
    void turnTo(target,direction);
  }
  function enqueue(w) {
    const n=normalize(w); if(!n)return;
    const isNew=!known.has(n.id); known.add(n.id); wishes.set(n.id,n);
    if(isNew && n.id!==current?.id && !pending.includes(n.id)) pending.push(n.id);
    pending.sort((a,b)=>(wishes.get(a)?.at||0)-(wishes.get(b)?.at||0)||Number(a)-Number(b));
    if(!initial && !current && !busy){render(n);schedule();}
    updateStatus();
  }
  async function snapshot(path='/api/wishes',auth=false) {
    let all=[],after=0,latestCursor=0;
    for(let i=0;i<100;i++) {
      const response=await fetch(API+path+'?after='+after+'&limit=200',{cache:'no-store',headers:auth?{Authorization:'Bearer '+adminToken}:{}});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||'無法讀取祝福');
      all.push(...(data.wishes||[]));if(i===0)latestCursor=Number(data.cursor)||0;
      if(!data.hasMore||!(data.wishes||[]).length)return {all,cursor:latestCursor,persistent:data.persistent};
      const end=Number(data.wishes.at(-1).id);if(end<=after)throw new Error('祝福分頁順序不正確');after=end;
    }
    throw new Error('祝福數量過多，請使用管理備份');
  }
  async function sync() {
    if(syncing){resync=true;return syncing;}
    syncing=(async()=>{
      duringSync=[];
      try {
        const data=await snapshot();
        const ids=new Set();
        for(const w of data.all){const n=normalize(w);if(n){ids.add(n.id);enqueue(n);}}
        for(const event of duringSync){if(event.type==='wish'){const n=normalize(event.w);if(n){ids.add(n.id);enqueue(n);}}else ids.delete(String(event.id));}
        for(const id of wishes.keys())if(!ids.has(id))wishes.delete(id);
        pending=pending.filter(id=>wishes.has(id));
        cursor=Math.max(cursor,data.cursor);
        if(initial){initial=false;render(wishes.get(resumeId)||ordered()[0]||null);schedule();}
        else if(current&&!wishes.has(current.id)&&!busy){render(ordered()[0]||null);schedule();}
        else if(current&&!busy){current=wishes.get(current.id)||null;render(current);}
        updateStatus();
        if(!connected){$('linkStatus').textContent=data.persistent?'已同步 · 重新連接即時訊息中':'舊版服務 · 永久儲存待啟用';}
      } catch(e) { if(!connected)$('linkStatus').textContent='連線中斷 · 自動重試'; }
      finally { syncing=null; if(resync){resync=false;setTimeout(sync,200);} }
    })();
    return syncing;
  }
  function connect() {
    stream?.close();
    stream=new EventSource(API+'/api/stream?cursor='+cursor);
    stream.addEventListener('open',()=>{connected=true;$('indicator').classList.add('live');$('linkStatus').textContent='LIVE · 即時收錄祝福';});
    stream.addEventListener('wish',e=>{try { const w=JSON.parse(e.data);if(syncing)duringSync.push({type:'wish',w});enqueue(w);cursor=Math.max(cursor,Number(e.lastEventId)||0); }catch{} });
    stream.addEventListener('reset',e=>{try{const d=JSON.parse(e.data);if(d.id){wishes.delete(String(d.id));pending=pending.filter(id=>id!==String(d.id));if(syncing)duringSync.push({type:'remove',id:d.id});if(current?.id===String(d.id)&&!busy)render(ordered()[0]||null);}cursor=Math.max(cursor,Number(e.lastEventId)||0);}catch{} void sync();});
    stream.addEventListener('error',()=>{connected=false;$('indicator').classList.remove('live');$('linkStatus').textContent='重新連線中 · 祝福繼續播放';});
  }
  function resize(){const v=document.querySelector('.book-viewport');$('bookScale').style.setProperty('--book-scale',Math.min((v.clientWidth-95)/1642,(v.clientHeight-40)/870));fitPrintedText(right);if(!sheet.hidden)fitPrintedText(front);}
  function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500);}
  $('pause').onclick=()=>{paused=!paused;clearTimeout(timer);if(busy)animations.forEach(a=>paused?a.pause():a.play());updateStatus();schedule();};
  $('next').onclick=()=>navigate(1);$('prev').onclick=()=>navigate(-1);
  $('replay').onclick=()=>{if(busy)return;pending=ordered().map(w=>w.id);const first=wishes.get(pending.shift());if(first?.id===current?.id){schedule();toast('從第一頁重新播放');}else void turnTo(first);};
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('請使用瀏覽器的全螢幕功能（F11）');}};

  function openAdmin(exportRequested=false){wantExport=exportRequested;$('adminDialog').showModal();if(adminToken)void loadAdmin();else $('adminToken').focus();}
  $('manage').onclick=()=>openAdmin();$('export').onclick=()=>openAdmin(true);
  $('adminLogin').onsubmit=async e=>{e.preventDefault();adminToken=$('adminToken').value.trim();$('adminToken').value='';await loadAdmin();};
  $('adminLogout').onclick=()=>{adminToken='';$('adminPanel').hidden=true;$('adminLogin').hidden=false;$('adminList').replaceChildren();$('adminStatus').textContent='已鎖定';};
  async function adminFetch(path,options={}){const r=await fetch(API+path,{...options,cache:'no-store',headers:{'Authorization':'Bearer '+adminToken,...options.headers}});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||'管理操作失敗');}return r;}
  async function download(path,name){try{const r=await adminFetch(path);const url=URL.createObjectURL(await r.blob());const a=element('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}catch(e){$('adminStatus').textContent=e.message;}}
  $('adminCSV').onclick=()=>download('/api/admin/export.csv','仁鈞姮儒_祝福紀錄.csv');
  $('adminBackup').onclick=()=>download('/api/admin/export.json','仁鈞姮儒_祝福完整備份.json');
  $('adminRefresh').onclick=()=>loadAdmin();
  async function loadAdmin(){
    $('adminStatus').textContent='正在載入…';
    try {
      const {all}=await snapshot('/api/admin/wishes',true);$('adminPanel').hidden=false;$('adminLogin').hidden=true;$('adminList').replaceChildren();
      for(const url of adminImages)URL.revokeObjectURL(url);adminImages.clear();
      for(const w of all.slice().reverse()){
        const row=element('article','admin-entry'),pic=avatar(w),body=element('div');
        if(w.avatar_path){adminFetch('/api/admin/avatars/'+w.id).then(r=>r.blob()).then(blob=>{if(!row.isConnected)return;const url=URL.createObjectURL(blob);adminImages.add(url);pic.src=url;}).catch(()=>{});}
        body.append(element('strong','',w.author??w.guest_name),element('p','',w.message??w.blessing_text),element('small','','第 '+(w.group??w.group_number)+' 組 · '+new Date(w.at||w.created_at).toLocaleString('zh-TW')+' · '+w.moderation_status));
        const buttons=element('div','entry-buttons');
        for(const [label,status] of [['公開','approved'],['隱藏','hidden'],['刪除','deleted']]){
          const b=element('button','',label);b.type='button';b.disabled=w.moderation_status===status;
          b.onclick=async()=>{try{await adminFetch('/api/admin/wishes/'+w.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({moderation_status:status})});await loadAdmin();await sync();}catch(e){$('adminStatus').textContent=e.message;}};
          buttons.append(b);
        }
        body.append(buttons);row.append(pic,body);$('adminList').append(row);
      }
      $('adminStatus').textContent='共 '+all.length+' 則紀錄（包含隱藏與刪除）';
      if(wantExport){wantExport=false;await download('/api/admin/export.csv','仁鈞姮儒_祝福紀錄.csv');}
    }catch(e){adminToken='';$('adminPanel').hidden=true;$('adminLogin').hidden=false;$('adminStatus').textContent=e.message;}
  }
  window.addEventListener('resize',resize);document.addEventListener('fullscreenchange',resize);
  document.addEventListener('keydown',e=>{if($('adminDialog').open||/INPUT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowRight')navigate(1);if(e.key==='ArrowLeft')navigate(-1);if(e.code==='Space'){e.preventDefault();$('pause').click();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void sync();});
  window.addEventListener('beforeunload',()=>stream?.close());
  // Read-only diagnostics permit frame-by-frame verification without a fake production input.
  window.bookPlayback=Object.freeze({get state(){return {currentId:current?.id,pending:[...pending],ids:ordered().map(w=>w.id),busy,paused,cursor};},get animation(){return activeAnimation;},get animations(){return [...animations];},sync});
  resize();render(null);sync().then(connect);setInterval(()=>{if(!connected)void sync();},10000);setInterval(()=>{if(connected)void sync();},60000);
})();
