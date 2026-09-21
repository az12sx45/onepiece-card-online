(function(root){
  'use strict';
  // Presentation only: do not consume the gameplay RNG or write to gameState.
  const BASE='images/board/sea_event_reveal/v2/';
  const definitions=[
    ['supply-rescue','漂流補給船','money','gain'],['merchant-dividend','商船分紅','money','gain'],['black-market','黑市交易','money','mystery'],['hull-damage','船底破損','money','loss'],['naval-inspection','海軍臨檢','money','loss'],
    ['tailwind','順風航線','weather','gain'],['helpful-current','海流助航','weather','gain'],['reverse-waves','逆浪拖行','weather','loss'],['storm-shelter','暴風亂流','weather','loss'],['crosswind','亂風偏航','weather','mystery'],['cold-fog','濕冷霧潮','weather','loss'],
    ['drifting-chests','漂流寶箱群','treasure','treasure'],['route-ticket-chest','航路券寶箱','treasure','treasure'],['charm-chest','護符寶箱','treasure','treasure'],['picked-chest','被撬過的寶箱','treasure','mystery'],['fake-chest','假寶藏箱','treasure','mystery'],['wreck-vault','沉船寶庫','treasure','treasure'],['ancient-relic-chest','古代遺物寶箱','treasure','treasure'],
    ['medical-ship','漂流補給船醫','medicine','heal'],['spirit-tonic','精神藥劑','medicine','heal'],['medical-kit','醫療箱','medicine','heal'],['medicine-side-effect','副作用發作','medicine','loss'],['spirit-drain','精神耗損','medicine','loss'],['toxic-reaction','毒性反應','medicine','loss']
  ].map(([key,title,type,tone])=>Object.freeze({key,title,type,tone,images:[1,2,3].map(n=>BASE+key+'-'+n+'.webp')}));
  const titles=new Map(definitions.map(d=>[d.title,d]));
  const keys=new Map(definitions.map(d=>[d.key,d]));
  const previous=new Map();let serial=0;
  const ICONS={coins:'images/board/items/treasure_coin.webp',hp:'images/board/judicial_raid_ui/reward_icons/heal.webp',pp:'images/board/judicial_raid_ui/reward_icons/pp.webp',dice:'images/board/items/fixed_step.webp',move:'images/board/items/pointer.webp',guard:'images/board/judicial_raid_ui/reward_icons/shield.webp'};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeImage=value=>/^(?:images\/board\/)[a-zA-Z0-9_./%\-]+\.(?:webp|png|jpe?g)$/i.test(String(value||''))?value:'';
  function definition(title){return titles.get(String(title||''))||(title==='寶箱海域'?titles.get('漂流寶箱群'):null);}
  function pick(title){
    const def=definition(title);if(!def)return null;
    const values=new Uint32Array(1);
    if(root.crypto?.getRandomValues)root.crypto.getRandomValues(values);else values[0]=(Date.now()+ ++serial*2654435761)>>>0;
    const options=[0,1,2].filter(n=>n!==previous.get(def.key));
    const variant=options[values[0]%options.length];previous.set(def.key,variant);
    return {key:def.key,variant};
  }
  function resolve(options={}){
    const visual=options.visual||{};
    const def=definition(options.artTitle||options.title)||keys.get(String(visual.key||''));
    if(!def)return null;
    const variant=Number.isInteger(visual.variant)&&visual.variant>=0&&visual.variant<3?visual.variant:0;
    return {...def,variant,image:def.images[variant]};
  }
  function capture(player={}){
    const crew=(player.crew||[]).filter(Boolean);
    return {coins:Number(player.coins||0),hp:crew.length?crew.reduce((n,c)=>n+Number(c.currentHp||0),0):Number(player.hp||0),pp:crew.reduce((n,c)=>n+(c.moveSet||[]).reduce((sum,m)=>sum+Number(m.currentPP??m.pp??0),0),0),dice:Number(player.nextDiceModifier||0),items:{...(player.inventory?.items||{})},hasInventory:!!player.inventory?.items};
  }
  function outcomes(before,after,result={},lookup=()=>null){
    const rows=[];
    const add=(kind,label,amount)=>{if(amount)rows.push({kind,label,value:(amount>0?'+':'')+amount.toLocaleString(),tone:amount<0?'loss':'gain',image:ICONS[kind]});};
    add('coins','貝里',after.coins-before.coins);add('hp','船員 HP',after.hp-before.hp);add('pp','招式 PP',after.pp-before.pp);add('dice','下回合擲骰',after.dice-before.dice);
    Object.keys(after.items).forEach(id=>{const count=Number(after.items[id]||0)-Number(before.items[id]||0);if(count<=0)return;const item=lookup(id);if(item)rows.push({kind:'item',itemId:id,label:item.name||id,value:'×'+count,tone:'gain',image:safeImage(item.image),quantity:count});});
    if(result.continueMove)rows.push({kind:'move',label:'前進',value:result.continueMove+' 格',tone:'gain',image:ICONS.move});
    if(result.reverseMove)rows.push({kind:'move',label:'後退',value:result.reverseMove+' 格',tone:'loss',image:ICONS.move});
    if(result.teleportToNearestShop||result.randomTeleportOnRoute)rows.push({kind:'move',label:'航線改變',value:result.teleportToNearestShop?'前往商店島':'海域偏航',tone:'neutral',image:ICONS.move});
    if(result.captured)rows.push({kind:'guard',label:'航海狀態',value:'遭到拘捕',tone:'loss',image:ICONS.guard});
    if(!rows.length)rows.push({kind:'guard',label:'航海狀態',value:/擋下|穩住|沒有偏航|沒有後退/.test(result.summary||'')?'防護生效':'狀態未變動',tone:'neutral',image:ICONS.guard});
    return rows;
  }
  function artMarkup(options={},className='sea-reveal-art'){
    const def=resolve(options);if(!def)return '';
    return `<div class="${className}" data-sea-art-key="${def.key}" data-sea-art-variant="${def.variant}" data-tone="${def.tone}"><img class="sea-reveal-illustration" src="${def.image}" alt="${esc(def.title)}事件插畫" decoding="async" onerror="this.hidden=true;this.parentElement.classList.add('art-unavailable')"><span class="sea-reveal-art-fallback">插畫載入失敗，結果與操作仍可繼續</span><span class="sea-reveal-sheen" aria-hidden="true"></span></div>`;
  }
  function outcomeMarkup(rows=[]){return `<div class="sea-reveal-outcomes" aria-label="本次實際結果">${rows.slice(0,12).map(row=>`<div class="sea-reveal-outcome" data-tone="${esc(row.tone||'neutral')}"${row.itemId?` data-item-id="${esc(row.itemId)}"`:''}>${safeImage(row.image)?`<img src="${esc(row.image)}" alt="" onerror="this.hidden=true">`:''}<span>${esc(row.label)}<strong>${esc(row.value)}</strong></span></div>`).join('')}</div>`;}
  function resultMarkup(options={}){
    const def=resolve(options);if(!def)return '';
    const chips=[options.typeLabel,...(options.chips||[])].filter(Boolean);
    const chest=options.chestImage&&safeImage(options.chestImage)?`<img class="sea-reveal-chest" src="${esc(options.chestImage)}" alt="${esc(options.chestLabel||'抽中的寶箱')}">`:'';
    return `<section class="sea-reveal" data-tone="${options.isTrap?'loss':def.tone}" aria-label="${esc(options.title||def.title)}"><header class="sea-reveal-header"><div class="sea-reveal-kicker">海域卡已揭曉</div><h3>${esc(options.title||def.title)}</h3><p>${esc(options.subtitle||'')}</p></header><div class="sea-reveal-body"><div class="sea-reveal-scene">${artMarkup(options)}${chest}<span class="sea-reveal-scene-caption">${esc(options.chestLabel||def.title)}</span></div><div class="sea-reveal-details"><div class="sea-reveal-chips">${chips.map(v=>`<span>${esc(v)}</span>`).join('')}</div><p class="sea-reveal-description">${esc(options.desc||'')}</p>${outcomeMarkup(options.outcomes)}<div class="sea-reveal-summary" role="status"><small>航海結果</small><strong>${esc(options.summary||'效果已套用')}</strong></div></div></div><footer class="sea-reveal-actions">${options.actionMarkup||''}</footer></section>`;
  }
  const api=Object.freeze({definitions:Object.freeze(definitions),pick,resolve,capture,outcomes,artMarkup,outcomeMarkup,resultMarkup,icons:Object.freeze(ICONS)});
  root.BoardSeaEventVisuals=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
