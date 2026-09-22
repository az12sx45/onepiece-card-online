(function(root){
  'use strict';
  const art=root.BoardAdventureArt;if(!art)return;
  const FIELD='boardArtCollectionV1';
  let owner='',unlocked={},pending={},cloudState='local',busy=false,timer=0,lastSocket=null,lastSecret='',dialog=null,filter='all',onlyUnlocked=false;
  const listeners=new Set();
  function context(){
    const shared=root.BoardShared?.getState?.()||{};
    const profile=shared.profile||{};
    return {userId:String(profile.userId||''),secret:String(profile.secret||''),socket:shared.socket};
  }
  function storageKey(){return `op_board_art_collection_v1:${owner}`;}
  function persist(){try{localStorage.setItem(storageKey(),JSON.stringify(unlocked));}catch(_){cloudState='storage-error';}}
  function changed(){listeners.forEach(fn=>fn());if(dialog?.open){if(dialog.dataset.view==='detail'&&unlocked[dialog.dataset.artDetail])renderDetail(dialog.dataset.artDetail);else renderGallery();}}
  function selectOwner(){
    const ctx=context();
    if(owner!==ctx.userId){
      owner=ctx.userId;unlocked={};pending={};lastSocket=null;lastSecret='';busy=false;cloudState='local';
      if(owner)try{unlocked=art.normalizeCollection(JSON.parse(localStorage.getItem(storageKey())||'{}'));}catch(_){}
      pending={...unlocked};changed();
    }
    return ctx.userId?ctx:null;
  }
  function schedule(){if(timer)return;timer=root.setTimeout(()=>{timer=0;sync();},750);}
  function merge(value){
    if(!selectOwner())return;
    const added=art.normalizeCollection(value);let dirty=false;
    for(const[id,at]of Object.entries(added))if(!unlocked[id]||at<unlocked[id]){unlocked[id]=at;pending[id]=at;dirty=true;}
    if(dirty){persist();changed();schedule();}
    else if(cloudState==='local')schedule();
  }
  function emit(ctx,event,payload){
    return new Promise(resolve=>ctx.socket.timeout(8000).emit(event,payload,(error,response)=>resolve(error?null:response)));
  }
  async function sync(force=false){
    const ctx=selectOwner();if(!ctx||busy)return;
    if(!ctx.secret||!ctx.socket?.connected){cloudState='local';changed();return;}
    const epoch=owner;const secret=ctx.secret;busy=true;
    try{
      if(force||lastSocket!==ctx.socket.id||lastSecret!==secret){
        const response=await emit(ctx,'PROFILE_GET',{secret});if(owner!==epoch||context().secret!==secret)return;
        if(!response?.ok||!response.profile)throw Error('cloud-unavailable');
        const cloud=art.normalizeCollection(response.profile.stats?.[FIELD]);
        unlocked=art.mergeCollections(unlocked,cloud);pending=art.mergeCollections(pending,unlocked);
        for(const id of Object.keys(pending))if(cloud[id]&&cloud[id]<=pending[id])delete pending[id];
        persist();lastSocket=ctx.socket.id;lastSecret=secret;
      }
      if(Object.keys(pending).length){
        const batch={...pending};const response=await emit(ctx,'PROFILE_UPDATE',{secret,patch:{stats:{[FIELD]:batch}}});
        if(owner!==epoch||context().secret!==secret)return;
        if(!response?.ok)throw Error('cloud-unavailable');
        unlocked=art.mergeCollections(unlocked,response.profile?.stats?.[FIELD]);
        for(const[id,at]of Object.entries(batch))if(pending[id]===at)delete pending[id];persist();
      }
      cloudState='saved';
    }catch(_){if(owner===epoch)cloudState='pending';}
    finally{if(owner===epoch){busy=false;changed();if(cloudState==='saved'&&Object.keys(pending).length)schedule();}}
  }
  function statusText(){return cloudState==='saved'?'收藏已同步至帳號雲端':cloudState==='storage-error'?'本機儲存暫不可用，正在嘗試雲端保存':cloudState==='pending'?'已保存在本機，等待雲端同步':'已保存在本機，登入連線後同步至雲端';}
  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.className='adventure-gallery';dialog.setAttribute('aria-label','冒險插畫圖鑑');
    document.body.appendChild(dialog);
    dialog.addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button)return;
      if(button.hasAttribute('data-art-close'))dialog.close();
      else if(button.dataset.artFilter){filter=button.dataset.artFilter;renderGallery();}
      else if(button.hasAttribute('data-art-only')){onlyUnlocked=!onlyUnlocked;renderGallery();}
      else if(button.dataset.artView&&unlocked[button.dataset.artView])renderDetail(button.dataset.artView);
      else if(button.hasAttribute('data-art-back'))renderGallery();
      else if(button.hasAttribute('data-art-sync'))sync(true);
    });
    return dialog;
  }
  function header(detail=false){
    return `<header class="adventure-gallery-header"><div><small>航海回憶 · 個人收藏</small><h2>冒險插畫圖鑑</h2><p>每次遇見一張，收藏一段航程。</p></div><button type="button" data-art-close aria-label="關閉插畫圖鑑">關閉 ×</button></header>${detail?'':`<div class="adventure-gallery-progress"><strong>${Object.keys(unlocked).length}<span> / ${art.entries.length} 張已解鎖</span></strong><progress max="${art.entries.length}" value="${Object.keys(unlocked).length}"></progress><span class="adventure-gallery-sync" role="status">${art.escapeHtml(statusText())}</span></div>`}`;
  }
  function renderGallery(){
    if(!dialog)return;
    const list=art.definitions.filter(d=>filter==='all'||d.group===filter);
    dialog.dataset.view='collection';
    dialog.innerHTML=header()+`<nav class="adventure-gallery-filters" aria-label="插畫分類">${[['all','全部'],...Object.entries(art.groups)].map(([key,title])=>`<button type="button" data-art-filter="${key}" aria-pressed="${filter===key}">${title}</button>`).join('')}<button type="button" data-art-only aria-pressed="${onlyUnlocked}">只看已解鎖</button><button type="button" data-art-sync>同步收藏</button></nav><p class="adventure-gallery-note">只有自己實際遇到的版本會解鎖。觀戰、預覽和未抽中的圖片不計入；本功能更新前尚無逐張遇見紀錄。</p><div class="adventure-gallery-grid">${list.map(def=>{
      const cards=def.images.map((image,variant)=>{const id=`${def.group}:${def.key}:${variant+1}`;return {id,image,variant,at:unlocked[id]};}).filter(card=>!onlyUnlocked||card.at);
      if(!cards.length)return '';
      return `<section class="adventure-gallery-set"><div class="adventure-gallery-set-title"><h3>${art.escapeHtml(def.title)}</h3><span>${def.images.filter((_,v)=>unlocked[`${def.group}:${def.key}:${v+1}`]).length}/3</span></div><div class="adventure-gallery-variants">${cards.map(card=>card.at?`<button type="button" class="adventure-gallery-card" data-art-view="${card.id}" aria-label="放大${art.escapeHtml(def.title)}第${card.variant+1}張"><img src="${card.image}" loading="lazy" alt="${art.escapeHtml(def.title)} 插畫 ${card.variant+1}"><span>已解鎖 · ${card.variant+1}/3</span></button>`:`<div class="adventure-gallery-card is-locked" aria-label="${art.escapeHtml(def.title)}第${card.variant+1}張未解鎖"><span class="adventure-gallery-lock" aria-hidden="true">◇</span><strong>尚未遇見</strong><span>${card.variant+1}/3</span></div>`).join('')}</div></section>`;
    }).join('')||'<div class="adventure-gallery-empty">這裡還沒有解鎖的插畫。繼續冒險，新的回憶將出現在這裡。</div>'}</div>`;
  }
  function renderDetail(id){
    const item=art.entries.find(entry=>entry.id===id);if(!item||!unlocked[id])return;
    const available=art.entries.filter(entry=>unlocked[entry.id]&&(filter==='all'||entry.group===filter));const index=available.findIndex(entry=>entry.id===id);
    dialog.dataset.view='detail';dialog.dataset.artDetail=id;
    dialog.innerHTML=header(true)+`<div class="adventure-gallery-detail"><button type="button" data-art-back>← 返回圖鑑</button><img src="${item.image}" alt="${art.escapeHtml(item.title)}第${item.variant+1}張"><div><h3>${art.escapeHtml(item.title)} · ${item.variant+1}/3</h3><p>${art.groups[item.group]} · 首次遇見 ${new Date(unlocked[id]).toLocaleDateString('zh-TW')}</p></div><nav aria-label="已解鎖圖片切換"><button type="button" data-art-view="${available[(index+available.length-1)%available.length].id}">上一張</button><span>${index+1} / ${available.length}</span><button type="button" data-art-view="${available[(index+1)%available.length].id}">下一張</button></nav></div>`;
  }
  function open(){selectOwner();ensureDialog();renderGallery();if(!dialog.open)dialog.showModal();sync(true);}
  function snapshot(){selectOwner();return {...unlocked};}
  root.addEventListener('online',sync);
  root.addEventListener('storage',e=>{if(selectOwner()&&e.key===storageKey()){try{merge(JSON.parse(e.newValue||'{}'));}catch(_){}}});
  document.addEventListener('click',e=>{if(e.target.closest('[data-open-adventure-gallery]'))open();});
  root.setInterval(()=>{if(owner&&(cloudState!=='saved'||context().socket?.id!==lastSocket))sync();},30000);
  root.BoardArtCollection=Object.freeze({merge,sync,open,snapshot,field:FIELD,status:()=>cloudState});
})(window);
