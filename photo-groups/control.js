(() => {
  'use strict';
  const API='https://renjun-hengru-wishes-live-2026.onrender.com',DEFAULT='./assets/default-avatar.svg';
  const $=id=>document.getElementById(id),labels={approved:'公開中',pending:'待審核',hidden:'已隱藏',deleted:'已刪除'},actionLabels={pause:'暫停',resume:'繼續播放',next:'下一頁',prev:'上一頁',replay:'重新播放'};
  let token='',records=[],posting=false,pendingCommand=null,statePoll=null,polling=false,loadGeneration=0;
  const images=new Set();let observer;
  function text(tag,cls,value){const node=document.createElement(tag);if(cls)node.className=cls;if(value!=null)node.textContent=value;return node;}
  function status(message){$('controlStatus').textContent=message;}
  function revokeImages(){observer?.disconnect();for(const url of images)URL.revokeObjectURL(url);images.clear();}
  function lock(message='已鎖定控制台'){
    token='';pendingCommand=null;records=[];loadGeneration++;clearInterval(statePoll);statePoll=null;revokeImages();$('adminList').replaceChildren();$('controlPanel').hidden=true;$('loginPanel').hidden=false;$('connectionDot').classList.remove('connected');status(message);
  }
  async function request(path,options={}){
    const response=await fetch(API+path,{...options,cache:'no-store',headers:{Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(25000)});
    if(!response.ok){const data=await response.json().catch(()=>({}));const error=new Error(data.error||'暫時無法連接控制服務');error.status=response.status;throw error;}
    return response;
  }
  function playbackState(state){$('playbackState').textContent=state.paused?'播放設定：已暫停':'播放設定：自動播放中';$('connectionDot').classList.add('connected');}
  async function refreshState(){
    if(!token||polling)return;polling=true;
    try{const response=await request('/api/admin/playback');playbackState(await response.json());}
    catch(error){$('connectionDot').classList.remove('connected');if(error.status===401)lock('金鑰已失效，請重新登入');else $('playbackState').textContent='控制服務重新連線中…';}
    finally{polling=false;}
  }
  function randomId(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(18)),x=>x.toString(16).padStart(2,'0')).join('');}
  async function sendAction(action){
    if(!token||posting)return;posting=true;
    const pending=pendingCommand?.action===action?pendingCommand:{action,requestId:randomId()};pendingCommand=pending;
    for(const button of document.querySelectorAll('[data-action]'))button.disabled=true;
    status('正在送出「'+actionLabels[action]+'」…');
    try{const response=await request('/api/admin/playback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(pending)});const data=await response.json();pendingCommand=null;playbackState(data.state);status('「'+actionLabels[action]+'」已送出；電視會在約 2 秒內接收。');}
    catch(error){if(error.status===401)lock('需要有效的管理金鑰');else status(error.message+'。按相同按鈕重試會沿用這筆指令。');}
    finally{posting=false;for(const button of document.querySelectorAll('[data-action]'))button.disabled=false;}
  }
  function queueAvatar(img,id,generation){
    if(observer){img.dataset.avatarId=String(id);img.dataset.generation=String(generation);observer.observe(img);return;}
    void loadAvatar(img,id,generation);
  }
  async function loadAvatar(img,id,generation){
    try{const response=await request('/api/admin/avatars/'+id),blob=await response.blob();if(generation!==loadGeneration||!img.isConnected||!token)return;const url=URL.createObjectURL(blob);images.add(url);img.src=url;}
    catch{}
  }
  function renderRecords(){
    revokeImages();loadGeneration++;const generation=loadGeneration;
    if(typeof IntersectionObserver==='function')observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);void loadAvatar(entry.target,entry.target.dataset.avatarId,Number(entry.target.dataset.generation));}},{rootMargin:'180px'});
    const query=$('wishSearch').value.trim().toLocaleLowerCase('zh-TW'),filter=$('statusFilter').value;
    const shown=records.filter(w=>(filter==='all'||w.moderation_status===filter)&&(!query||(String(w.author)+' '+w.message).toLocaleLowerCase('zh-TW').includes(query)));
    $('adminList').replaceChildren();$('recordSummary').textContent='顯示 '+shown.length+' / '+records.length+' 則紀錄（包含隱藏與軟刪除）';$('approvedCount').textContent=records.filter(w=>w.moderation_status==='approved').length+' 則公開祝福';
    if(!shown.length){$('adminList').append(text('p','empty-records','這個篩選條件目前沒有祝福紀錄。'));return;}
    for(const w of shown.slice().reverse()){
      const row=text('article','admin-entry');row.dataset.wishId=String(w.id);const img=document.createElement('img');img.src=DEFAULT;img.alt=String(w.author)+' 的頭像';img.width=62;img.height=62;
      const body=text('div'),name=text('div','entry-name',w.author);name.append(text('span','status-badge '+w.moderation_status,labels[w.moderation_status]||w.moderation_status));
      body.append(name,text('p','entry-meta','第 '+w.group+' 組 · '+new Date(w.at||w.created_at).toLocaleString('zh-TW')),text('p','entry-message',w.message));
      const buttons=text('div','entry-buttons');
      for(const [label,value] of [['公開','approved'],['隱藏','hidden'],['刪除','deleted']]){
        const button=text('button',value==='deleted'?'danger':'',label);button.type='button';button.disabled=w.moderation_status===value;
        button.onclick=()=>moderate(w.id,value,button);buttons.append(button);
      }
      body.append(buttons);row.append(img,body);$('adminList').append(row);if(w.avatar_path)queueAvatar(img,w.id,generation);
    }
  }
  async function loadRecords(){
    const all=[];let after=0;
    for(let i=0;i<100;i++){const response=await request('/api/admin/wishes?after='+after+'&limit=200'),data=await response.json();all.push(...data.wishes);if(!data.hasMore){records=all;renderRecords();return;}if(!data.wishes.length)throw new Error('祝福分頁資料不完整');after=Number(data.wishes.at(-1).id);}
    throw new Error('祝福紀錄過多，請先下載完整備份');
  }
  async function moderate(id,value,button){
    button.disabled=true;
    try{await request('/api/admin/wishes/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({moderation_status:value})});const item=records.find(w=>w.id===id);if(item)item.moderation_status=value;renderRecords();status('已將這則祝福設為「'+labels[value]+'」。');}
    catch(error){button.disabled=false;if(error.status===401)lock('需要有效的管理金鑰');else status(error.message);}
  }
  async function download(path,name){
    try{status('正在準備備份…');const response=await request(path),url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);status('備份已準備好，請確認瀏覽器下載。');}
    catch(error){if(error.status===401)lock('需要有效的管理金鑰');else status(error.message);}
  }
  $('controlLogin').onsubmit=async event=>{
    event.preventDefault();token=$('controlToken').value.trim();$('controlToken').value='';$('unlock').disabled=true;status('正在驗證管理金鑰…');
    try{const response=await request('/api/admin/playback');playbackState(await response.json());await loadRecords();$('loginPanel').hidden=true;$('controlPanel').hidden=false;status('控制台已解鎖。電視頁保持開啟即可接收播放指令。');clearInterval(statePoll);statePoll=setInterval(refreshState,2500);}
    catch(error){lock(error.status===401?'管理金鑰不正確，請重新輸入':error.message);}
    finally{$('unlock').disabled=false;}
  };
  for(const button of document.querySelectorAll('[data-action]'))button.onclick=()=>sendAction(button.dataset.action);
  $('controlLogout').onclick=()=>lock();$('adminRefresh').onclick=()=>loadRecords().then(()=>status('祝福清單已更新')).catch(error=>status(error.message));
  $('adminCSV').onclick=()=>download('/api/admin/export.csv','仁鈞姮儒_祝福紀錄.csv');$('adminBackup').onclick=()=>download('/api/admin/export.json','仁鈞姮儒_祝福完整備份.json');
  $('statusFilter').onchange=renderRecords;$('wishSearch').oninput=renderRecords;
  window.addEventListener('beforeunload',()=>{token='';revokeImages();clearInterval(statePoll);});
})();
