'use strict';
// Execute original source timers and HTML controller against bounded native
// controls. Geometry is provided by the native layout, not a browser engine.
exports.prepare=function(event,geometry){
 if(!geometry||geometry.sources?.length!==6||geometry.targets?.length!==6)throw Error('Six native Bullet source/target bounds required');
 let now=0,shakes=0,cutinAt=-1,bannerAt=-1,bulletFusionFxTimers=[],bulletFusionFlightAnimations=[];
 const tasks=[],timeline=[],flights=[];
 const controls=require('./native-lineage-controls').create({changed(){},bounds(node){
  if(node.id==='stage')return geometry.stage;
  if(node.id==='bulletFusionEffectBanner')bannerAt=now;
  if(node.dataset.bulletFusionSource!==undefined)return geometry.sources[Number(node.dataset.bulletFusionSource)];
  if(node.dataset.bulletFusionTarget!==undefined)return geometry.targets[Number(node.dataset.bulletFusionTarget)];
  return {left:0,top:0,width:1,height:1};
 }});
 const refs=Object.fromEntries(['stage','bulletFusionFx','bulletFusionTitle','bulletFusionTargetIcon','bulletFusionTargetSockets','bulletFusionCrewRail','bulletFusionEffectBanner','status','cutInFx'].map(k=>[k,controls.addRoot('div',{id:k})]));
 const document={createElement(tag){
  if(tag!=='img')throw Error('Unexpected Bullet created element '+tag);
  const node=controls.addRoot(tag),remove=node.remove.bind(node);let record;
  node.animate=(keyframes,options)=>{record={at:now,image:node.src,left:parseFloat(node.style.left),top:parseFloat(node.style.top),keyframes,options,removedAt:null};flights.push(record);return {cancel(){record.cancelledAt=now;}};};
  node.remove=()=>{if(record)record.removedAt=now;remove();};return node;
 }};
 const setTimeout=(fn,delay)=>{const task={fn,at:now+delay,cancelled:false};tasks.push(task);return task},clearTimeout=t=>{if(t)t.cancelled=true;};
 const playStageShake=()=>shakes++,restartAnimation=()=>{cutinAt=now;};
function clearBulletFusionFx() {
    bulletFusionFxTimers.forEach((timer) => clearTimeout(timer));
    bulletFusionFxTimers = [];
    bulletFusionFlightAnimations.forEach((animation) => animation?.cancel?.());
    bulletFusionFlightAnimations = [];
    refs.bulletFusionFx?.querySelectorAll(".bullet-fusion-flight-item").forEach((node) => node.remove());
    refs.bulletFusionFx?.classList.remove("show");
    refs.bulletFusionEffectBanner?.classList.remove("show", "kyubi");
    if (refs.bulletFusionCrewRail) refs.bulletFusionCrewRail.innerHTML = "";
    if (refs.bulletFusionTargetSockets) refs.bulletFusionTargetSockets.innerHTML = "";
  }
function scheduleBulletFusionFx(callback, delay) {
    const timer = setTimeout(callback, delay);
    bulletFusionFxTimers.push(timer);
    return timer;
  }
function showBulletFusionEffect(slot) {
    if (!refs.bulletFusionEffectBanner || !slot?.itemId) return;
    const kyubi = slot.itemId === "devon_kyubi_mask" || slot.effectKind === "force_advantage_attribute";
    refs.bulletFusionEffectBanner.innerHTML = `
      ${slot.itemImage ? `<img src="${escapeHtml(slot.itemImage)}" alt="">` : ""}
      <span><strong>${escapeHtml(slot.itemName || "攜帶物")}</strong>　${escapeHtml(slot.itemSummary || "效果已由巴雷特接管。")}</span>
    `;
    refs.bulletFusionEffectBanner.classList.remove("show", "kyubi");
    void refs.bulletFusionEffectBanner.offsetWidth;
    refs.bulletFusionEffectBanner.classList.add("show");
    refs.bulletFusionEffectBanner.classList.toggle("kyubi", kyubi);
    if (kyubi) {
      showStatus(`${slot.itemName || "九尾幻面"}：巴雷特的攻擊屬性轉為克制目前對手。`);
      playStageShake();
    } else {
      showStatus(`${slot.itemName || "攜帶物"}的效果已由巴雷特接管。`);
    }
  }
function playBulletFusionFx(event) {
    if (!event || !refs.bulletFusionFx) return;
    clearBulletFusionFx();
    const slots = Array.from({ length: 6 }, (_, index) => event.slots?.[index] || { number: index + 1, label: "空位" });
    const equipped = slots.filter((slot) => slot.itemId && slot.itemImage);
    if (refs.bulletFusionTitle) refs.bulletFusionTitle.textContent = event.title || "合體武裝・六孔裝甲";
    if (refs.bulletFusionTargetIcon) refs.bulletFusionTargetIcon.src = event.iconUrl || "images/board/battle/postgame_mechanic_icons/postgame_douglas_bullet.webp";
    if (refs.bulletFusionTargetSockets) {
      refs.bulletFusionTargetSockets.innerHTML = slots.map((slot, index) => `
        <span class="bullet-fusion-target-socket" data-bullet-fusion-target="${index}">
          ${slot.itemImage ? `<img src="${escapeHtml(slot.itemImage)}" alt="">` : ""}
        </span>
      `).join("");
    }
    if (refs.bulletFusionCrewRail) {
      refs.bulletFusionCrewRail.innerHTML = slots.map((slot, index) => `
        <div class="bullet-fusion-crew-card ${slot.itemId ? "" : "is-empty"}" style="--slot-index:${index}">
          ${slot.cardPortrait ? `<img class="bullet-fusion-crew-portrait" src="${escapeHtml(slot.cardPortrait)}" alt="${escapeHtml(slot.cardName || "船員")}">` : `<div class="bullet-fusion-crew-portrait"></div>`}
          <div class="bullet-fusion-crew-copy">
            <strong>${escapeHtml(slot.cardName || "空位")}</strong>
            <span>${escapeHtml(slot.itemName || "未裝備")}</span>
            ${slot.itemImage ? `<img class="bullet-fusion-source-item" data-bullet-fusion-source="${index}" src="${escapeHtml(slot.itemImage)}" alt="${escapeHtml(slot.itemName || "攜帶物")}">` : ""}
          </div>
        </div>
      `).join("");
    }
    refs.bulletFusionFx.classList.add("show");
    playCutIn(event.title || "合體武裝・六孔裝甲");
    showStatus(equipped.length ? `巴雷特開始吸收 ${equipped.length} 件攜帶物。` : "隊伍沒有裝備攜帶物，六個孔位皆為空。" );
    scheduleBulletFusionFx(() => {
      const stageRect = refs.stage?.getBoundingClientRect?.();
      if (!stageRect) return;
      equipped.forEach((slot, equippedIndex) => {
        const slotIndex = Math.max(0, Number(slot.number || 1) - 1);
        const source = refs.bulletFusionCrewRail?.querySelector(`[data-bullet-fusion-source="${slotIndex}"]`);
        const target = refs.bulletFusionTargetSockets?.querySelector(`[data-bullet-fusion-target="${slotIndex}"]`);
        const sourceRect = source?.getBoundingClientRect?.();
        const targetRect = target?.getBoundingClientRect?.();
        if (!sourceRect || !targetRect) return;
        const flight = document.createElement("img");
        flight.className = "bullet-fusion-flight-item";
        flight.src = slot.itemImage;
        flight.alt = "";
        flight.style.left = `${sourceRect.left - stageRect.left}px`;
        flight.style.top = `${sourceRect.top - stageRect.top}px`;
        refs.bulletFusionFx.appendChild(flight);
        const dx = targetRect.left + targetRect.width * .5 - sourceRect.left - sourceRect.width * .5;
        const dy = targetRect.top + targetRect.height * .5 - sourceRect.top - sourceRect.height * .5;
        const delay = equippedIndex * 210;
        const animation = flight.animate([
          { transform: "translate(0,0) scale(.78) rotate(-12deg)", opacity: 0 },
          { transform: "translate(0,0) scale(1.05) rotate(0deg)", opacity: 1, offset: .16 },
          { transform: `translate(${dx * .52}px,${dy * .35 - 54}px) scale(1.12) rotate(180deg)`, opacity: 1, offset: .58 },
          { transform: `translate(${dx}px,${dy}px) scale(.18) rotate(390deg)`, opacity: .18 },
        ], { duration: 1120, delay, easing: "cubic-bezier(.18,.82,.2,1)", fill: "forwards" });
        bulletFusionFlightAnimations.push(animation);
        scheduleBulletFusionFx(() => {
          target?.classList.add("filled");
          if (source) source.style.opacity = "0";
          playStageShake();
        }, delay + 1010);
        scheduleBulletFusionFx(() => flight.remove(), delay + 1250);
      });
    }, 980);
    equipped.forEach((slot, index) => {
      scheduleBulletFusionFx(() => showBulletFusionEffect(slot), 2450 + index * 470);
    });
    scheduleBulletFusionFx(() => {
      refs.bulletFusionEffectBanner?.classList.remove("show", "kyubi");
      refs.bulletFusionFx?.classList.remove("show");
    }, Math.max(2600, Number(event.duration || 5600)));
  }
function showStatus(message) {
    refs.status.textContent = message;
    refs.status.classList.add("show");
    clearTimeout(showStatus.timer);
    showStatus.timer = setTimeout(() => refs.status.classList.remove("show"), 2300);
  }
function playCutIn(text) {
    if (!refs.cutInFx || !text) return;
    refs.cutInFx.textContent = text;
    restartAnimation(refs.cutInFx, "show");
  }
function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
 const sourceNodes=()=>refs.bulletFusionCrewRail.querySelectorAll('[data-bullet-fusion-source]');
 const snapshot=()=>({at:now,visible:refs.bulletFusionFx.classList.contains('show'),shakes,
  filled:refs.bulletFusionTargetSockets.querySelectorAll('.bullet-fusion-target-socket').map(n=>n.classList.contains('filled')),
  sourceOpacity:sourceNodes().map(n=>({index:Number(n.dataset.bulletFusionSource),opacity:Number(n.style.opacity??1)})),
  effect:{visible:refs.bulletFusionEffectBanner.classList.contains('show'),kyubi:refs.bulletFusionEffectBanner.classList.contains('kyubi'),html:refs.bulletFusionEffectBanner.innerHTML,text:refs.bulletFusionEffectBanner.textContent.trim(),at:bannerAt,image:refs.bulletFusionEffectBanner.querySelector('img')?.src||''},
  status:refs.status.textContent,statusVisible:refs.status.classList.contains('show'),cutin:refs.cutInFx.textContent,cutinAt});
 try{
  playBulletFusionFx(event);
  const packet={title:refs.bulletFusionTitle.textContent,icon:refs.bulletFusionTargetIcon.src,crewHtml:refs.bulletFusionCrewRail.innerHTML,socketsHtml:refs.bulletFusionTargetSockets.innerHTML,viewport:[geometry.stage.width,geometry.stage.height],flights,timeline,endAt:Math.max(2600,Number(event.duration||5600))};
  packet.cards=refs.bulletFusionCrewRail.querySelectorAll('.bullet-fusion-crew-card').map((n,index)=>({index,empty:n.classList.contains('is-empty'),name:n.querySelector('strong')?.textContent||'',itemName:n.querySelector('span')?.textContent||'',portrait:n.querySelector('.bullet-fusion-crew-portrait')?.src||'',item:n.querySelector('.bullet-fusion-source-item')?.src||''}));
  timeline.push(snapshot());while(tasks.length){tasks.sort((a,b)=>a.at-b.at);const task=tasks.shift();if(task.cancelled)continue;now=task.at;task.fn();timeline.push(snapshot());}
  return packet;
 }finally{controls.dispose();}
};
