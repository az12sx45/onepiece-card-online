'use strict';
// The browser and API count NFC grapheme clusters (including combined emoji).
window.createWeddingComposer=function createWeddingComposer(){
 const API='https://renjun-hengru-wishes-live-2026.onrender.com';
 const DRAFT_KEY='renjun-hengru-pending-wish-v2';
 const RECEIPT_KEY='renjun-hengru-wish-receipt-v2';
 const $=id=>document.getElementById(id);
 const author=$('wishAuthor'),message=$('wishMessage');
 const status=$('wishStatus'),send=$('wishSend'),consent=$('wishConsent'),gender=$('avatarGender')||{value:'',focus(){}};
 const camera=$('cameraInput'),gallery=$('galleryInput'),photo=$('avatarPreview'),photoStatus=$('selfieStatus');
 const take=$('takeSelfie'),choose=$('choosePhoto'),remove=$('removePhoto'),adjust=$('adjustCrop')||document.createElement('button');
 const storageStatus=document.createElement('p');storageStatus.id='storageStatus';storageStatus.className='wishStorageStatus';storageStatus.setAttribute('role','status');storageStatus.textContent='正在連接幸福祝福冊…';
 document.querySelector('.wishIntro').after(storageStatus);
 const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh-Hant',{granularity:'grapheme'}):null;
 const normalize=value=>String(value||'').normalize('NFC').trim();
 const count=value=>segmenter?Array.from(segmenter.segment(String(value).normalize('NFC'))).length:Infinity;
 const slice=(value,max)=>segmenter?Array.from(segmenter.segment(value),part=>part.segment).slice(0,max).join(''):value;
 let group=0,avatar='',sending=false,processing=false,photoVersion=0,restored=false,healthFlight=null;
 let cropSource=null,cropState=null,editorSource=null,editorState=null,drag=null;
 const validGenders=new Set(['male','female']);
 const selectedGender=()=>validGenders.has(gender.value)?gender.value:'';
 const defaultAvatar=()=>selectedGender()?'./assets/default-avatar-'+selectedGender()+'.svg':'./assets/default-avatar.svg';
 const defaultAvatarAlt=()=>selectedGender()==='male'?'尚未上傳照片的男士輪廓預設頭像':selectedGender()==='female'?'尚未上傳照片的女士輪廓預設頭像':'婚禮愛心預設頭像（尚未上傳照片）';
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
       if(data.avatar_gender_required!==true)throw new Error('祝福冊正在更新填寫功能，請稍後再試。');
       storageStatus.textContent='幸福祝福冊已連線，可以送出你的祝福。';storageStatus.classList.remove('unavailable');return true;
     }catch(error){
       storageStatus.textContent=error.message==='祝福冊正在更新填寫功能，請稍後再試。'?error.message:'永久祝福冊尚在啟用中，請稍後再試。';storageStatus.classList.add('unavailable');
       throw new Error(error.name==='AbortError'?'祝福冊連線逾時，請稍後重試。':error.message==='Failed to fetch'?'暫時無法連接祝福冊，請稍後重試。':error.message);
     }finally{clearTimeout(timer)}
   })().finally(()=>{healthFlight=null});
   return healthFlight;
 }
 function setAvatar(value){
   avatar=value||'';photo.src=avatar||defaultAvatar();
   photo.alt=avatar?'即將公開展示的自拍預覽':defaultAvatarAlt();
   remove.hidden=!avatar;adjust.hidden=!avatar;take.textContent=avatar?'重拍自拍':'拍一張自拍';choose.textContent=avatar?'更換照片':'從相簿選擇';
   updateCharacterCount();
 }
 function updateCharacterCount(){
   const length=count(normalize(message.value));$('wishLength').textContent=(Number.isFinite(length)?length:'—')+' / 30 字';
   $('wishLength').classList.toggle('overLimit',length>30);
 }
 function disableFields(disabled){
   for(const field of document.querySelectorAll('.wishSection input,.wishSection textarea,.wishSection button,.wishSection select'))field.disabled=disabled;
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
 async function normalizePhoto(file){
   if(file.size>30*1024*1024)throw new Error('照片超過 30 MB，請改選較小的照片。');
   if(!/^image\//i.test(file.type)&&! /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name))throw new Error('請選擇一張照片。');
   const image=await decodeImage(file);
   try{
     const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
     if(!(width>0&&height>0))throw new Error('照片尺寸無法讀取，請更換照片。');
     const scale=Math.min(1,1600/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
     const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#fffaf5';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
     return canvas;
   }finally{image.close?.()}
 }
 async function compressCanvas(canvas){
     for(const quality of [.86,.76,.66,.56,.46,.36]){
       const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
       if(blob&&blob.size<=150*1024)return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('照片處理失敗，請重試。'));reader.readAsDataURL(blob)});
     }
     throw new Error('壓縮後的照片仍然太大，請更換照片。');
 }
 const cropDialog=document.createElement('dialog');cropDialog.id='cropDialog';cropDialog.className='cropDialog';cropDialog.setAttribute('aria-labelledby','cropTitle');
 cropDialog.innerHTML='<div class="cropHeading"><h2 id="cropTitle">把喜歡的畫面放進圓裡</h2><button id="cropClose" type="button" aria-label="取消調整頭像">×</button></div><p class="cropHint">拖曳照片選位置，再調整大小。圓裡就是大家會看到的頭像。</p><div class="cropStage" id="cropStage"><canvas id="cropCanvas" width="720" height="720" tabindex="0" aria-label="拖曳照片調整圓形頭像的位置，也可用方向鍵移動"></canvas><div class="cropMask" aria-hidden="true"></div></div><label class="cropZoomLabel" for="cropZoom"><span>縮小</span><span id="cropZoomValue">100%</span><span>放大</span></label><input id="cropZoom" class="cropZoom" type="range" min="1" max="3" step="0.01" value="1" aria-label="調整頭像照片大小"><p id="cropStatus" class="cropStatus" role="status"></p><div class="cropActions"><button id="cropReset" type="button">重設</button><button id="cropCancel" type="button">取消</button><button id="cropConfirm" class="cropConfirm" type="button">確認裁切</button></div>';
 document.body.append(cropDialog);
 const cropCanvas=$('cropCanvas'),cropZoom=$('cropZoom'),cropStatus=$('cropStatus'),cropConfirm=$('cropConfirm');
 function clampCrop(){
   if(!editorSource||!editorState)return;
   const visible=Math.min(editorSource.width,editorSource.height)/editorState.zoom;
   editorState.x=Math.max(visible/2,Math.min(editorSource.width-visible/2,editorState.x));
   editorState.y=Math.max(visible/2,Math.min(editorSource.height-visible/2,editorState.y));
 }
 function drawCrop(){
   if(!editorSource||!editorState)return;clampCrop();
   const visible=Math.min(editorSource.width,editorSource.height)/editorState.zoom;
   const context=cropCanvas.getContext('2d',{alpha:false});context.fillStyle='#fffaf5';context.fillRect(0,0,720,720);
   context.drawImage(editorSource,editorState.x-visible/2,editorState.y-visible/2,visible,visible,0,0,720,720);
   cropZoom.value=String(editorState.zoom);$('cropZoomValue').textContent=Math.round(editorState.zoom*100)+'%';
 }
 function openCrop(source,state){
   editorSource=source;editorState=state?{...state}:{x:source.width/2,y:source.height/2,zoom:1};
   processing=true;disableFields(true);cropConfirm.disabled=false;cropZoom.disabled=false;$('cropReset').disabled=false;cropStatus.textContent='';drawCrop();cropDialog.showModal();
 }
 function closeCrop(){
   if(editorSource&&editorSource!==cropSource){editorSource.width=1;editorSource.height=1;}
   editorSource=null;editorState=null;drag=null;processing=false;disableFields(sending);if(cropDialog.open)cropDialog.close();
 }
 $('cropClose').onclick=closeCrop;$('cropCancel').onclick=closeCrop;
 cropDialog.addEventListener('cancel',event=>{event.preventDefault();closeCrop()});
 $('cropReset').onclick=()=>{if(cropConfirm.disabled)return;if(editorSource){editorState={x:editorSource.width/2,y:editorSource.height/2,zoom:1};drawCrop()}};
 cropZoom.oninput=()=>{if(cropConfirm.disabled)return;if(editorState){editorState.zoom=Number(cropZoom.value);drawCrop()}};
 cropCanvas.addEventListener('pointerdown',event=>{if(!editorSource||cropConfirm.disabled)return;event.preventDefault();drag={id:event.pointerId,x:event.clientX,y:event.clientY};cropCanvas.setPointerCapture(event.pointerId)});
 cropCanvas.addEventListener('pointermove',event=>{
   if(cropConfirm.disabled||!drag||drag.id!==event.pointerId||!editorState)return;event.preventDefault();
   const visible=Math.min(editorSource.width,editorSource.height)/editorState.zoom,ratio=visible/cropCanvas.getBoundingClientRect().width;
   editorState.x-=(event.clientX-drag.x)*ratio;editorState.y-=(event.clientY-drag.y)*ratio;drag.x=event.clientX;drag.y=event.clientY;drawCrop();
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])cropCanvas.addEventListener(type,()=>{drag=null});
 cropCanvas.addEventListener('keydown',event=>{if(cropConfirm.disabled||!editorState||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();const step=Math.min(editorSource.width,editorSource.height)/editorState.zoom*.03;if(event.key==='ArrowLeft')editorState.x+=step;if(event.key==='ArrowRight')editorState.x-=step;if(event.key==='ArrowUp')editorState.y+=step;if(event.key==='ArrowDown')editorState.y-=step;drawCrop()});
 cropConfirm.onclick=async()=>{
   if(!editorSource||cropConfirm.disabled)return;
   cropConfirm.disabled=true;cropZoom.disabled=true;$('cropReset').disabled=true;drag=null;cropStatus.textContent='正在儲存你選好的畫面…';
   const version=photoVersion,source=editorSource,state={...editorState};
   try{
     const output=document.createElement('canvas');output.width=480;output.height=480;
     const visible=Math.min(source.width,source.height)/state.zoom;output.getContext('2d',{alpha:false}).drawImage(source,state.x-visible/2,state.y-visible/2,visible,visible,0,0,480,480);
     const result=await compressCanvas(output);if(version!==photoVersion||editorSource!==source)return;
     if(cropSource&&cropSource!==source){cropSource.width=1;cropSource.height=1;}
     cropSource=source;cropState=state;setAvatar(result);consent.checked=false;photoStatus.textContent='已套用圓形頭像範圍。確認照片與文字後，請勾選公開展示同意。';closeCrop();
   }catch(error){if(editorSource===source){cropStatus.textContent=error.message||'照片處理失敗，請重試。';cropConfirm.disabled=false;cropZoom.disabled=false;$('cropReset').disabled=false}}
 };
 async function processSelection(input){
   const file=input.files?.[0];input.value='';if(!file)return;
   const version=++photoVersion;processing=true;disableFields(true);photoStatus.textContent='正在調整方向並壓縮照片…';
   try{
     const source=await normalizePhoto(file);if(version!==photoVersion){source.width=1;source.height=1;return;}
     openCrop(source);photoStatus.textContent='請在圓形取景框中選擇要展示的範圍。';
   }catch(error){if(version===photoVersion)photoStatus.textContent=error.message||'照片處理失敗，請重試或從相簿選擇。'}
   finally{if(version===photoVersion&&!cropDialog.open){processing=false;disableFields(false)}}
 }
 take.onclick=()=>camera.click();choose.onclick=()=>gallery.click();
 camera.onchange=()=>processSelection(camera);gallery.onchange=()=>processSelection(gallery);
 remove.onclick=()=>{photoVersion++;if(cropSource){cropSource.width=1;cropSource.height=1;}cropSource=null;cropState=null;setAvatar('');consent.checked=false;photoStatus.textContent='將使用所選的婚禮預設頭像。'};
 adjust.onclick=async()=>{
   if(!avatar||processing||sending)return;
   const version=++photoVersion;processing=true;disableFields(true);
   try{
     if(!cropSource){const blob=await(await fetch(avatar)).blob();const source=await normalizePhoto(new File([blob],'avatar.jpg',{type:'image/jpeg'}));if(version!==photoVersion)return;cropSource=source;cropState=null;}
     if(version===photoVersion)openCrop(cropSource,cropState);
   }catch(error){photoStatus.textContent=error.message||'無法調整照片，請重新選擇。';}
   finally{if(version===photoVersion&&!cropDialog.open){processing=false;disableFields(false)}}
 };
 gender.onchange=()=>{gender.removeAttribute?.('aria-invalid');setAvatar(avatar);consent.checked=false;photoStatus.textContent=avatar?'自拍會優先展示；移除照片後將使用對應輪廓頭像。':'已更新預設頭像；你也可以隨時上傳今天的照片。'};
 message.addEventListener('input',updateCharacterCount);
 async function fingerprint(payload){
   // Kept compatible with older pending submissions while new forms require male/female.
   const signed={...payload};if(signed.avatar_gender==='unspecified')delete signed.avatar_gender;
   const encoded=new TextEncoder().encode(JSON.stringify(signed));
   return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded)),byte=>byte.toString(16).padStart(2,'0')).join('');
 }
 async function matchesLegacyReceipt(receipt,payload){
   if(!receipt||receipt.version===5||!/^[a-f0-9]{64}$/i.test(String(receipt.signature||'')))return false;
   // Older confirmed receipts retained only a digest. Match the unchanged
   // photo/name/message/group against their former style and gender choices.
   for(let style=1;style<=10;style++){
     for(const oldGender of ['unspecified','male','female']){
       if(await fingerprint({...payload,style,avatar_gender:oldGender})===receipt.signature)return true;
     }
   }
   return false;
 }
 function uuid(){
   if(crypto.randomUUID)return crypto.randomUUID();
   const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=bytes[6]&15|64;bytes[8]=bytes[8]&63|128;
   const hex=Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
 }
 function sameSubmissionCore(a,b){return JSON.stringify([a?.author,a?.message,Number(a?.group),a?.avatar||'',a?.consent===true])===JSON.stringify([b.author,b.message,Number(b.group),b.avatar||'',b.consent===true]);}
 function sayReceived(wish){status.textContent=wish?.prior_submission_confirmed?'♡ 已確認上次的祝福已收到，不會重複送出。':wish?.moderation_status==='pending'?'♡ 已收到你的祝福，通過審核後會翻進幸福祝福冊。':'♡ 送出成功！你的祝福已排入幸福祝福冊，將依序翻頁展示。'}
 send.onclick=async()=>{
   if(sending||processing)return;
   if(!group){status.textContent='請先查詢你的組別。';return}
   if(!segmenter){status.textContent='請更新 Safari 或 Chrome，再開啟網站送出祝福。';return}
   if(!selectedGender()){status.textContent='請先選擇性別（男或女），再送出祝福。';gender.setAttribute?.('aria-invalid','true');gender.focus();return}
   const guest=normalize(author.value)||'賓客',blessing=normalize(message.value);
   if(count(guest)>20){status.textContent='署名最多 20 字。';author.focus();return}
   if(count(blessing)<1||count(blessing)>30){status.textContent='請填寫 1～30 字的祝福；中文字與完整 Emoji 都各算一字。';message.focus();return}
   if(!consent.checked){status.textContent='請先確認照片與文字，並勾選公開展示同意。';consent.focus();return}
   const payload={author:guest,message:blessing,style:1,group,avatar,avatar_gender:selectedGender(),consent:true};
   sending=true;disableFields(true);send.textContent='正在送出祝福…';status.textContent='首次連線可能需要稍等，請不要關閉頁面。';
   let timer;
   try{
     await verifyStorage();
     const signature=await fingerprint(payload),receipt=readStore(localStorage,RECEIPT_KEY);
     if(receipt?.version===5&&receipt.signature===signature){sayReceived(receipt.wish);return}
     if(await matchesLegacyReceipt(receipt,payload)){
       const upgraded={...receipt,version:5,style:1,signature,wish:{...receipt.wish,prior_submission_confirmed:true}};
       saveStore(localStorage,RECEIPT_KEY,upgraded);sayReceived(upgraded.wish);return;
     }
     let pending=readStore(sessionStorage,DRAFT_KEY);
     if(pending?.signature!==signature){
       // A v4 request may already have been stored while its reply was lost.
       // Keep its UUID when only the removed style / newly required gender changed.
       const legacy=pending&&pending.version!==5&&sameSubmissionCore(pending.payload,payload)&&/^[A-Za-z0-9_-]{12,100}$/.test(String(pending.idempotencyKey||''));
       pending={version:5,style:1,signature,payload,idempotencyKey:legacy?pending.idempotencyKey:uuid(),createdAt:Date.now(),...(legacy?{priorPayload:pending.priorPayload||pending.payload}:{})};
     }else pending={...pending,version:5,style:1,payload};
     saveStore(sessionStorage,DRAFT_KEY,pending);
     const post=async body=>{
       clearTimeout(timer);const controller=new AbortController();timer=setTimeout(()=>controller.abort(),70000);
       const response=await fetch(API+'/api/wishes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,idempotencyKey:pending.idempotencyKey}),signal:controller.signal});
       return {response,data:await response.json().catch(()=>({}))};
     };
     let {response,data}=await post(payload),priorConfirmed=false;
     if(response.status===409&&pending.priorPayload){
       // 409 proves that UUID already exists; this original-payload retry can
       // confirm its receipt without creating a second record or editing it.
       const prior=await post(pending.priorPayload);
       if(!prior.response.ok||prior.data.duplicate!==true||prior.data.persistent!==true)throw new Error('上次送出狀態尚無法確認，請稍後重試。系統不會另建重複祝福。');
       response=prior.response;data=prior.data;priorConfirmed=true;
     }
     if(!response.ok)throw new Error(data.error||'連線失敗，請稍後再試。');
     if(!data.ok||!data.id||data.persistent!==true)throw new Error('尚未確認永久儲存，請稍後按同一按鈕重試。');
     const received={version:5,style:1,signature,idempotencyKey:pending.idempotencyKey,wish:{id:data.id,moderation_status:data.wish?.moderation_status,prior_submission_confirmed:priorConfirmed},createdAt:Date.now()};
     saveStore(localStorage,RECEIPT_KEY,received);saveStore(sessionStorage,DRAFT_KEY,null);sayReceived(received.wish);
   }catch(error){status.textContent=error.name==='AbortError'?'連線逾時。請按送出重試，系統會沿用同一筆編號，避免重複送出。':'送出失敗：'+(error.message||'請稍後再試。')}
   finally{clearTimeout(timer);sending=false;disableFields(false);send.textContent='送出祝福 ♡'}
 };
 function restoreDraft(){
   if(restored)return;
   const draft=readStore(sessionStorage,DRAFT_KEY);if(draft?.payload?.group!==group)return;
   const saved=draft.payload;
   if(typeof saved.author!=='string'||typeof saved.message!=='string'||!(saved.style>=1&&saved.style<=10))return;
   restored=true;author.value=saved.author;message.value=saved.message;gender.value=validGenders.has(saved.avatar_gender)?saved.avatar_gender:'';setAvatar('');
   if(typeof saved.avatar==='string'&&/^data:image\/jpeg;base64,/.test(saved.avatar))setAvatar(saved.avatar);
   status.textContent=selectedGender()?'已還原上次尚未確認的祝福。確認後再按送出，將沿用原編號。':'已還原上次尚未確認的祝福。請先選擇性別，再確認送出；系統會核對原編號，避免重複。';
 }
 gender.value='';setAvatar('');verifyStorage().catch(()=>{});
 return {
   setGroup(name,value){group=value;author.value=slice(normalize(name),20);status.textContent='';restoreDraft();updateCharacterCount();verifyStorage().catch(()=>{})},
   reset(){group=0;photoVersion++;if(cropDialog.open)closeCrop();if(cropSource){cropSource.width=1;cropSource.height=1;}cropSource=null;cropState=null;processing=false;disableFields(sending);gender.value='';gender.removeAttribute?.('aria-invalid');setAvatar('');author.value='';message.value='';consent.checked=false;photoStatus.textContent='';status.textContent='';restored=false;updateCharacterCount()},
   countText:count
 };
};
