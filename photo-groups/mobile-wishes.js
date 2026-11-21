'use strict';
// The browser and API count NFC grapheme clusters (including combined emoji).
window.createWeddingComposer=function createWeddingComposer(){
 const API='https://renjun-hengru-wishes-live-2026.onrender.com';
 const DRAFT_KEY='renjun-hengru-pending-wish-v2';
 const RECEIPT_KEY='renjun-hengru-wish-receipt-v2';
 const styleData=[['玫瑰金浪漫','♡'],['星夜金紋','✦'],['香檳金典','❧'],['水彩水波','◌'],['薰衣草蕾絲','✿'],['草莓奶油','♥'],['清新花園','❦'],['彩虹夢幻','✧'],['復古膠片','▣'],['紫金煙火','✺']];
 const $=id=>document.getElementById(id);
 const author=$('wishAuthor'),message=$('wishMessage'),choices=$('wishChoices'),preview=$('wishPreview');
 const status=$('wishStatus'),send=$('wishSend'),consent=$('wishConsent');
 const camera=$('cameraInput'),gallery=$('galleryInput'),photo=$('avatarPreview'),photoStatus=$('selfieStatus');
 const take=$('takeSelfie'),choose=$('choosePhoto'),remove=$('removePhoto');
 const storageStatus=document.createElement('p');storageStatus.id='storageStatus';storageStatus.className='wishStorageStatus';storageStatus.setAttribute('role','status');storageStatus.textContent='正在連接幸福祝福冊…';
 document.querySelector('.wishIntro').after(storageStatus);
 const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh-Hant',{granularity:'grapheme'}):null;
 const normalize=value=>String(value||'').normalize('NFC').trim();
 const count=value=>segmenter?Array.from(segmenter.segment(String(value).normalize('NFC'))).length:Infinity;
 const slice=(value,max)=>segmenter?Array.from(segmenter.segment(value),part=>part.segment).slice(0,max).join(''):value;
 let group=0,style=1,avatar='',sending=false,processing=false,photoVersion=0,restored=false,healthFlight=null;
 const defaultAvatar='./assets/default-avatar.svg';
 function readStore(storage,key){try{return JSON.parse(storage.getItem(key)||'null')}catch{return null}}
 function saveStore(storage,key,value){try{value===null?storage.removeItem(key):storage.setItem(key,JSON.stringify(value));return true}catch{return false}}
 function verifyStorage(){
   if(healthFlight)return healthFlight;
   healthFlight=(async()=>{
     const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
     try{
       const response=await fetch(API+'/health',{cache:'no-store',signal:controller.signal});
       const data=await response.json().catch(()=>({}));
       if(!response.ok||!(Number(data.version)>=2)||data.persistent!==true||data.writable===false)throw new Error('永久祝福冊尚在啟用中，請稍後再試。');
       storageStatus.textContent='幸福祝福冊已連線，可以送出你的祝福。';storageStatus.classList.remove('unavailable');return true;
     }catch(error){
       storageStatus.textContent='永久祝福冊尚在啟用中，請稍後再試。';storageStatus.classList.add('unavailable');
       throw new Error(error.name==='AbortError'?'祝福冊連線逾時，請稍後重試。':error.message==='Failed to fetch'?'暫時無法連接祝福冊，請稍後重試。':error.message);
     }finally{clearTimeout(timer)}
   })().finally(()=>{healthFlight=null});
   return healthFlight;
 }
 function setAvatar(value){
   avatar=value||'';photo.src=avatar||defaultAvatar;
   photo.alt=avatar?'即將公開展示的自拍預覽':'婚禮預設頭像';
   remove.hidden=!avatar;take.textContent=avatar?'重拍自拍':'拍一張自拍';choose.textContent=avatar?'更換照片':'從相簿選擇';
   updatePreview();
 }
 function updatePreview(){
   const frame=document.createElement('div');frame.className='wishFrame style-'+style;
   const head=document.createElement('img');head.className='previewAvatar';head.src=avatar||defaultAvatar;head.alt='祝福頭像預覽';
   const body=document.createElement('div');body.className='wishBody';body.textContent=normalize(message.value)||'幸福每一天，甜蜜直到永遠 ♡';
   const signature=document.createElement('div');signature.className='wishSignature';signature.textContent='第 '+(group||'?')+' 組 · '+(normalize(author.value)||'來賓');
   frame.append(head,body,signature);preview.replaceChildren(frame);
   const length=count(normalize(message.value));$('wishLength').textContent=(Number.isFinite(length)?length:'—')+' / 30 字';
   $('wishLength').classList.toggle('overLimit',length>30);
 }
 function chooseStyle(value){
   style=value;
   for(const button of choices.children){const active=Number(button.dataset.style)===style;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active))}
   updatePreview();
 }
 for(const [index,[label,symbol]] of styleData.entries()){
   const n=index+1,button=document.createElement('button');button.type='button';button.className='wishChoice';button.dataset.style=String(n);button.setAttribute('aria-label',label);
   const frame=document.createElement('span');frame.className='wishFrame style-'+n;
   const icon=document.createElement('span');icon.className='wishIcon';icon.textContent=symbol;
   const title=document.createElement('span');title.className='wishStyleName';title.textContent=label;
   frame.append(icon,title);button.append(frame);button.onclick=()=>chooseStyle(n);choices.append(button);
 }
 function disableFields(disabled){
   for(const field of document.querySelectorAll('.wishSection input,.wishSection textarea,.wishSection button'))field.disabled=disabled;
 }
 async function decodeImage(file){
   if(typeof createImageBitmap==='function'){
     try{return await createImageBitmap(file,{imageOrientation:'from-image'})}catch{}
   }
   // Modern Safari's image decoder applies EXIF orientation before canvas drawing.
   const url=URL.createObjectURL(file);
   try{return await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('這張照片無法讀取，請選擇 JPG、PNG 或可在手機開啟的照片。'));image.src=url})}
   finally{URL.revokeObjectURL(url)}
 }
 async function compressPhoto(file){
   if(file.size>30*1024*1024)throw new Error('照片超過 30 MB，請改選較小的照片。');
   if(!/^image\//i.test(file.type)&&! /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))throw new Error('請選擇一張照片。');
   const image=await decodeImage(file);
   try{
     const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
     if(!(width>0&&height>0))throw new Error('照片尺寸無法讀取，請更換照片。');
     const side=Math.min(width,height),canvas=document.createElement('canvas');canvas.width=480;canvas.height=480;
     const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#fffaf5';context.fillRect(0,0,480,480);
     context.drawImage(image,(width-side)/2,(height-side)/2,side,side,0,0,480,480);
     for(const quality of [.86,.76,.66,.56,.46,.36]){
       const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
       if(blob&&blob.size<=150*1024)return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('照片處理失敗，請重試。'));reader.readAsDataURL(blob)});
     }
     throw new Error('壓縮後的照片仍然太大，請更換照片。');
   }finally{image.close?.()}
 }
 async function processSelection(input){
   const file=input.files?.[0];input.value='';if(!file)return;
   const version=++photoVersion;processing=true;disableFields(true);photoStatus.textContent='正在調整方向並壓縮照片…';
   try{
     const result=await compressPhoto(file);if(version!==photoVersion)return;
     setAvatar(result);consent.checked=false;photoStatus.textContent='請確認頭像方向與裁切範圍；送出後會公開顯示。';
   }catch(error){if(version===photoVersion)photoStatus.textContent=error.message||'照片處理失敗，請重試或從相簿選擇。'}
   finally{if(version===photoVersion){processing=false;disableFields(false)}}
 }
 take.onclick=()=>camera.click();choose.onclick=()=>gallery.click();
 camera.onchange=()=>processSelection(camera);gallery.onchange=()=>processSelection(gallery);
 remove.onclick=()=>{photoVersion++;setAvatar('');consent.checked=false;photoStatus.textContent='將使用婚禮預設頭像。'};
 author.addEventListener('input',updatePreview);message.addEventListener('input',updatePreview);
 async function fingerprint(payload){
   const encoded=new TextEncoder().encode(JSON.stringify(payload));
   return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded)),byte=>byte.toString(16).padStart(2,'0')).join('');
 }
 function uuid(){
   if(crypto.randomUUID)return crypto.randomUUID();
   const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=bytes[6]&15|64;bytes[8]=bytes[8]&63|128;
   const hex=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
 }
 function sayReceived(wish){status.textContent=wish?.moderation_status==='pending'?'♡ 已收到你的祝福，通過審核後會翻進幸福祝福冊。':'♡ 送出成功！你的祝福已排入幸福祝福冊，將依序翻頁展示。'}
 send.onclick=async()=>{
   if(sending||processing)return;
   if(!group){status.textContent='請先查詢你的組別。';return}
   if(!segmenter){status.textContent='請更新 Safari 或 Chrome，再開啟網站送出祝福。';return}
   const guest=normalize(author.value)||'賓客',blessing=normalize(message.value);
   if(count(guest)>20){status.textContent='署名最多 20 字。';author.focus();return}
   if(count(blessing)<1||count(blessing)>30){status.textContent='請填寫 1～30 字的祝福；中文字與完整 Emoji 都各算一字。';message.focus();return}
   if(!consent.checked){status.textContent='請先確認照片與文字，並勾選公開展示同意。';consent.focus();return}
   const payload={author:guest,message:blessing,style,group,avatar,consent:true};
   sending=true;disableFields(true);send.textContent='正在送出祝福…';status.textContent='首次連線可能需要稍等，請不要關閉頁面。';
   let timer;
   try{
     await verifyStorage();
     const signature=await fingerprint(payload),receipt=readStore(localStorage,RECEIPT_KEY);
     if(receipt?.signature===signature){sayReceived(receipt.wish);return}
     let pending=readStore(sessionStorage,DRAFT_KEY);
     if(pending?.signature!==signature)pending={signature,payload,idempotencyKey:uuid(),createdAt:Date.now()};
     saveStore(sessionStorage,DRAFT_KEY,pending);
     const controller=new AbortController();timer=setTimeout(()=>controller.abort(),70000);
     const response=await fetch(API+'/api/wishes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,idempotencyKey:pending.idempotencyKey}),signal:controller.signal});
     const data=await response.json().catch(()=>({}));
     if(!response.ok)throw new Error(data.error||'連線失敗，請稍後再試。');
     if(!data.ok||!data.id||data.persistent!==true)throw new Error('尚未確認永久儲存，請稍後按同一按鈕重試。');
     const received={signature,idempotencyKey:pending.idempotencyKey,wish:{id:data.id,moderation_status:data.wish?.moderation_status},createdAt:Date.now()};
     saveStore(localStorage,RECEIPT_KEY,received);saveStore(sessionStorage,DRAFT_KEY,null);sayReceived(data.wish);
   }catch(error){status.textContent=error.name==='AbortError'?'連線逾時。請按送出重試，系統會沿用同一筆編號，避免重複送出。':'送出失敗：'+(error.message||'請稍後再試。')}
   finally{clearTimeout(timer);sending=false;disableFields(false);send.textContent='送出祝福 ♡'}
 };
 function restoreDraft(){
   if(restored)return;
   const draft=readStore(sessionStorage,DRAFT_KEY);if(draft?.payload?.group!==group)return;
   const saved=draft.payload;
   if(typeof saved.author!=='string'||typeof saved.message!=='string'||!(saved.style>=1&&saved.style<=10))return;
   restored=true;author.value=saved.author;message.value=saved.message;chooseStyle(saved.style);
   if(typeof saved.avatar==='string'&&/^data:image\/jpeg;base64,/.test(saved.avatar))setAvatar(saved.avatar);
   status.textContent='已還原上次尚未確認的祝福。確認後再按送出，將沿用原編號。';
 }
 chooseStyle(1);setAvatar('');verifyStorage().catch(()=>{});
 return {
   setGroup(name,value){group=value;author.value=slice(normalize(name),20);status.textContent='';restoreDraft();updatePreview();verifyStorage().catch(()=>{})},
   reset(){group=0;photoVersion++;processing=false;disableFields(sending);setAvatar('');author.value='';message.value='';consent.checked=false;photoStatus.textContent='';status.textContent='';restored=false;updatePreview()},
   countText:count
 };
};
