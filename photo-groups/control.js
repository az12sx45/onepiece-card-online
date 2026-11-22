(() => {
  'use strict';
  const API='https://renjun-hengru-wishes-live-2026.onrender.com',DEFAULT='./assets/default-avatar.svg';
  const defaultAvatar=gender=>gender==='male'?'./assets/default-avatar-male.svg':gender==='female'?'./assets/default-avatar-female.svg':DEFAULT;
  const $=id=>document.getElementById(id),labels={approved:'公開中',pending:'待審核',hidden:'已隱藏',deleted:'舊刪除紀錄'},actionLabels={pause:'暫停',resume:'繼續播放',next:'下一頁',prev:'上一頁',replay:'重新播放'};
  let token='',records=[],posting=false,pendingCommand=null,statePoll=null,polling=false,loadGeneration=0;
  let albumTask=null,albumURL=null,albumGeneration=0,authGeneration=0;
  const images=new Set();let observer;
  function text(tag,cls,value){const node=document.createElement(tag);if(cls)node.className=cls;if(value!=null)node.textContent=value;return node;}
  function status(message){$('controlStatus').textContent=message;}
  function revokeImages(){observer?.disconnect();for(const url of images)URL.revokeObjectURL(url);images.clear();}
  function clearAlbumDownload(){if(albumURL)URL.revokeObjectURL(albumURL);albumURL=null;$('albumDownload').hidden=true;$('albumDownload').removeAttribute('href');$('albumDownloadHelp').hidden=true;}
  function albumBusy(busy){$('albumPDF').disabled=busy;$('albumHTML').disabled=busy;$('albumCancel').hidden=!busy;}
  function lock(message='已鎖定控制台'){
    authGeneration++;albumGeneration++;albumTask?.controller.abort();albumTask=null;albumBusy(false);clearAlbumDownload();$('albumProgress').textContent='登入後即可製作。';
    token='';pendingCommand=null;records=[];loadGeneration++;clearInterval(statePoll);statePoll=null;revokeImages();$('adminList').replaceChildren();$('controlPanel').hidden=true;$('loginPanel').hidden=false;$('connectionDot').classList.remove('connected');status(message);
  }
  async function request(path,options={}){
    const response=await fetch(API+path,{...options,cache:'no-store',headers:{Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout((options.method||'GET')==='GET'?75000:25000)});
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
    const shown=records.filter(w=>(filter==='all'?w.moderation_status!=='deleted':w.moderation_status===filter)&&(!query||(String(w.author)+' '+w.message).toLocaleLowerCase('zh-TW').includes(query)));
    const legacyCount=records.filter(w=>w.moderation_status==='deleted').length;
    $('adminList').replaceChildren();$('recordSummary').textContent=filter==='deleted'?'顯示 '+shown.length+' / '+legacyCount+' 則舊刪除紀錄（尚未永久移除）':'顯示 '+shown.length+' / '+(records.length-legacyCount)+' 則紀錄'+(legacyCount?'；另有 '+legacyCount+' 則舊刪除紀錄可由篩選查看':'');$('approvedCount').textContent=records.filter(w=>w.moderation_status==='approved').length+' 則公開祝福';
    if(!shown.length){$('adminList').append(text('p','empty-records','這個篩選條件目前沒有祝福紀錄。'));return;}
    for(const w of shown.slice().reverse()){
      const row=text('article','admin-entry');row.dataset.wishId=String(w.id);const img=document.createElement('img');img.src=defaultAvatar(w.avatar_gender);img.alt=String(w.author)+' 的頭像';img.width=62;img.height=62;
      const body=text('div'),name=text('div','entry-name',w.author);name.append(text('span','status-badge '+w.moderation_status,labels[w.moderation_status]||w.moderation_status));
      body.append(name,text('p','entry-meta','第 '+w.group+' 組 · '+new Date(w.at||w.created_at).toLocaleString('zh-TW')),text('p','entry-message',w.message));
      const buttons=text('div','entry-buttons');
      for(const [label,value] of [['公開','approved'],['隱藏','hidden']]){
        const button=text('button','',label);button.type='button';button.disabled=w.moderation_status===value;
        button.onclick=()=>moderate(w.id,value,button);buttons.append(button);
      }
      const remove=text('button','danger','永久刪除');remove.type='button';remove.dataset.deleteId=String(w.id);remove.onclick=()=>hardDelete(w.id,remove);buttons.append(remove);
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
  async function hardDelete(id,button){
    if(!token||button.disabled)return;const generation=authGeneration;button.disabled=true;
    try{
      status('正在確認永久刪除功能…');const health=await request('/health'),capability=await health.json().catch(()=>({}));
      if(!token||generation!==authGeneration)return;
      if(capability.hard_delete!==true)throw new Error('永久刪除功能尚未就緒，資料已保留；請稍後重整控制台再試。');
      if(!window.confirm('確定永久刪除這則祝福及所附照片？\n刪除後無法復原。')){status('已取消永久刪除，資料未變更。');return;}
      albumTask?.controller.abort();status('正在永久刪除這則祝福…');
      const response=await request('/api/admin/wishes/'+encodeURIComponent(id),{method:'DELETE'}),result=await response.json().catch(()=>({}));
      if(!token||generation!==authGeneration)return;
      if(result.ok!==true||result.deleted!==true||result.persistent!==true||String(result.id)!==String(id))throw new Error('尚未確認永久刪除成功，清單已保留；請重新載入後確認。');
      records=records.filter(w=>String(w.id)!==String(id));clearAlbumDownload();renderRecords();status('已永久刪除這則祝福，清單已更新。');
    }catch(error){if(token&&generation===authGeneration){if(error.status===401)lock('需要有效的管理金鑰');else status(error.message||'永久刪除尚未完成，請稍後重試。');}}
    finally{if(button.isConnected&&generation===authGeneration)button.disabled=false;}
  }
  async function download(path,name){
    const generation=authGeneration;
    try{status('正在準備備份…');const response=await request(path),blob=await response.blob();if(!token||generation!==authGeneration)return;const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);status('備份已準備好，請確認瀏覽器下載。');}
    catch(error){if(error.status===401)lock('需要有效的管理金鑰');else status(error.message);}
  }
  function cancelled(){const error=new Error('已停止製作');error.name='AbortError';return error;}
  function activeAlbum(task){if(albumTask!==task||!token||task.controller.signal.aborted)throw cancelled();}
  function albumProgress(task,message){if(albumTask===task&&token&&!task.controller.signal.aborted)$('albumProgress').textContent=message;}
  function abortable(promise,signal){return new Promise((resolve,reject)=>{const source=Promise.resolve(promise);if(signal.aborted){source.catch(()=>{});reject(cancelled());return;}const stop=()=>{signal.removeEventListener('abort',stop);reject(cancelled());};signal.addEventListener('abort',stop,{once:true});source.then(value=>{signal.removeEventListener('abort',stop);resolve(value)},error=>{signal.removeEventListener('abort',stop);reject(error)});});}
  async function albumRead(task,url,kind='json',authorized=true,mime){
    activeAlbum(task);const controller=new AbortController(),parent=task.controller.signal,stop=()=>controller.abort();parent.addEventListener('abort',stop,{once:true});const timer=setTimeout(()=>controller.abort(),75000);
    try{
      const response=await abortable(fetch(url,{cache:'no-store',headers:authorized?{Authorization:'Bearer '+token}:{},signal:controller.signal}),controller.signal);
      if(!response.ok){const error=new Error(response.status===401?'管理金鑰已失效，請重新登入':response.status>=500?'祝福服務正在準備，請稍後重試製作':'無法下載祝福書所需資料（HTTP '+response.status+'）');error.status=response.status;throw error;}
      const value=await abortable(kind==='json'?response.json():response.arrayBuffer(),controller.signal);activeAlbum(task);
      if(kind==='json')return value;
      const type=String(response.headers.get('Content-Type')||'').toLowerCase();if(mime&&!type.startsWith(mime))throw new Error('祝福書圖片格式不完整，請重新製作');
      if(!value.byteLength)throw new Error('祝福書圖片是空白檔案，請重新製作');
      return new Blob([value],{type:mime||type});
    }catch(error){if(parent.aborted)throw cancelled();if(error.name==='AbortError')throw new Error('等待祝福服務較久，資料尚未下載完成；請稍後重試製作。');if(error instanceof SyntaxError)throw new Error('祝福服務回覆不完整，請稍後重試製作。');throw error;}
    finally{clearTimeout(timer);parent.removeEventListener('abort',stop);}
  }
  function asDataURI(blob,signal){return new Promise((resolve,reject)=>{const reader=new FileReader(),stop=()=>reader.abort(),done=()=>signal.removeEventListener('abort',stop);if(signal.aborted){reject(cancelled());return;}signal.addEventListener('abort',stop,{once:true});reader.onload=()=>{done();resolve(String(reader.result))};reader.onerror=()=>{done();reject(new Error('無法處理祝福書圖片，請重新製作'))};reader.onabort=()=>{done();reject(cancelled())};reader.readAsDataURL(blob);});}
  function albumDate(value){const date=new Date(value);if(!Number.isFinite(date.getTime()))throw new Error('祝福紀錄日期不完整，請重新載入後再製作');return date.toISOString();}
  async function collectAlbum(task){
    const all=[];let after=0;
    for(let page=0;page<100;page++){
      albumProgress(task,'正在讀取最新祝福紀錄…首次喚醒服務可能需要稍等。');
      const data=await albumRead(task,API+'/api/admin/wishes?after='+after+'&limit=200');
      if(!Array.isArray(data.wishes))throw new Error('祝福紀錄回覆不完整，請重新製作');
      all.push(...data.wishes);if(!data.hasMore)break;if(!data.wishes.length||page===99)throw new Error('祝福分頁資料不完整，請重新製作');
      const next=Number(data.wishes.at(-1).id);if(!Number.isSafeInteger(next)||next<=after)throw new Error('祝福分頁順序不完整，請重新製作');after=next;
    }
    const seen=new Set(),approved=all.filter(w=>{if(w.moderation_status!=='approved'||seen.has(String(w.id)))return false;seen.add(String(w.id));return true;}).map(w=>({...w,albumTime:albumDate(w.created_at??w.at)})).sort((a,b)=>Date.parse(a.albumTime)-Date.parse(b.albumTime)||Number(a.id)-Number(b.id));
    const wishes=approved.map(w=>({id:String(w.id),guestName:String(w.guest_name??w.author??''),blessingText:String(w.blessing_text??w.message??''),createdAt:w.albumTime,avatarGender:['male','female'].includes(w.avatar_gender)?w.avatar_gender:'unspecified',avatar:''}));
    const assetFiles={couple:['couple-5.jpg','image/jpeg'],botanical:['botanical.svg','image/svg+xml'],paperGrain:['paper-grain.svg','image/svg+xml'],defaultMale:['default-avatar-male.svg','image/svg+xml'],defaultFemale:['default-avatar-female.svg','image/svg+xml'],defaultNeutral:['default-avatar.svg','image/svg+xml'],frontCover:['album-cover-front.png','image/png'],backCover:['album-cover-back.png','image/png']},assets={},assetTotal=Object.keys(assetFiles).length;let assetCount=0;
    await Promise.all(Object.entries(assetFiles).map(async([key,[file,mime]])=>{const blob=await albumRead(task,new URL('./assets/'+file,location.href).href,'blob',false,mime);assets[key]=await asDataURI(blob,task.controller.signal);albumProgress(task,'正在準備書頁與花卉素材 '+(++assetCount)+' / '+assetTotal+'…');}));
    let next=0,complete=0;
    await Promise.all(Array.from({length:Math.min(4,approved.length)},async()=>{while(next<approved.length){const index=next++,wish=approved[index];activeAlbum(task);if(wish.avatar_path){if(!/^\d+$/.test(String(wish.id)))throw new Error('頭像識別碼不完整');try{const blob=await albumRead(task,API+'/api/admin/avatars/'+wish.id,'blob',true,'image/jpeg');if(blob.size>153600)throw new Error('頭像檔案過大');wishes[index].avatar=await asDataURI(blob,task.controller.signal);}catch(error){if(error.name==='AbortError'||error.status===401)throw error;throw new Error('第 '+wish.id+' 則祝福的照片下載失敗，尚未製作檔案；請重試。');}}albumProgress(task,'正在整理公開祝福與頭像 '+(++complete)+' / '+approved.length+'…');}}));
    activeAlbum(task);return {schemaVersion:1,title:'仁鈞＆姮儒｜幸福祝福書',coupleName:'仁鈞 ♡ 姮儒',exportedAt:new Date().toISOString(),wishes,assets};
  }
  async function exportAlbum(kind){
    if(!token||albumTask)return;clearAlbumDownload();const task={id:++albumGeneration,controller:new AbortController(),kind};albumTask=task;albumBusy(true);
    try{
      const data=await collectAlbum(task);activeAlbum(task);let blob;
      if(kind==='pdf'){if(!window.WeddingAlbumPDF?.create)throw new Error('PDF 製作工具尚未載入，請重整控制台後再試');albumProgress(task,'正在製作 PDF，請保持此頁開啟…');blob=await abortable(window.WeddingAlbumPDF.create(data,{signal:task.controller.signal,onProgress:progress=>albumProgress(task,'正在製作 PDF '+progress.current+' / '+progress.total+' 頁（'+data.wishes.length+' 則公開祝福）…')}),task.controller.signal);}
      else{if(!window.WeddingAlbumHTML?.create)throw new Error('翻頁書工具尚未載入，請重整控制台後再試');albumProgress(task,'正在製作 '+data.wishes.length+' 則祝福的離線翻頁書…');blob=new Blob([window.WeddingAlbumHTML.create(data)],{type:'text/html;charset=utf-8'});}
      activeAlbum(task);const stamp=new Date().toISOString().slice(0,16).replace(/[-:T]/g,''),name='仁鈞姮儒_幸福祝福書_'+stamp+'.'+(kind==='pdf'?'pdf':'html');albumURL=URL.createObjectURL(blob);const link=$('albumDownload');link.href=albumURL;link.download=name;link.textContent='下載 '+name;link.hidden=false;$('albumDownloadHelp').hidden=false;albumProgress(task,'製作完成：'+data.wishes.length+' 則公開祝福，檔名 '+name+'。');link.click();
    }catch(error){if(albumTask===task&&token){task.controller.abort();if(error.status===401)lock('管理金鑰已失效，請重新登入');else $('albumProgress').textContent=error.name==='AbortError'?'已取消製作，沒有建立下載檔案。可重新選擇格式製作。':'製作失敗：'+(error.message||'請稍後重試');}}
    finally{if(albumTask===task){albumTask=null;albumBusy(false);}}
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
  $('albumPDF').onclick=()=>exportAlbum('pdf');$('albumHTML').onclick=()=>exportAlbum('html');$('albumCancel').onclick=()=>albumTask?.controller.abort();
  $('statusFilter').onchange=renderRecords;$('wishSearch').oninput=renderRecords;
  window.addEventListener('beforeunload',()=>{token='';albumTask?.controller.abort();clearAlbumDownload();revokeImages();clearInterval(statePoll);});
})();
