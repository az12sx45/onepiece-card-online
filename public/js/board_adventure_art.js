(function (root) {
  'use strict';
  // Cosmetic catalog and randomness only; never use the gameplay RNG.
  const sea = root.BoardSeaEventVisuals || (typeof require === 'function' ? require('./board_sea_event_visuals') : null);
  const groups = Object.freeze({ sea: '海格事件', chest: '寶箱揭曉', impel: '推進城事件', judicial: '司法島補給' });
  const extra = [
    ['chest','wood','木寶箱','loss'],['chest','copper','銅寶箱','treasure'],['chest','silver','銀寶箱','treasure'],['chest','gold','金寶箱','treasure'],['chest','gem','寶石寶箱','treasure'],
    ['impel','patrol','獄卒巡邏','loss'],['impel','key','找到鑰匙','gain'],['impel','magellan','麥哲倫警戒','loss'],['impel','ivankov','伊娃科夫通道','heal'],['impel','hidden','隱藏囚犯','mystery'],
    ['judicial','heal','豪華急救補給','heal'],['judicial','pp','滿載彈藥箱','heal'],['judicial','attack','全員總攻擊','gain'],['judicial','defense','鐵壁防線','gain'],['judicial','speed','突擊航路','gain'],['judicial','shield','絕對屏障','gain'],['judicial','revive','戰地救援','heal'],['judicial','burst','鬥志爆發','gain'],
  ].map(([group,key,title,tone]) => ({group,key,title,tone,images:[1,2,3].map(n=>`images/board/adventure_reveal/v1/${group}-${key}-${n}.webp`)}));
  const definitions = Object.freeze([...(sea?.definitions || []).map(d=>({...d,group:'sea'})),...extra].map(d=>Object.freeze({...d,images:Object.freeze([...d.images])})));
  const byKey = new Map(definitions.map(d=>[`${d.group}:${d.key}`,d]));
  const previous = new Map(); let serial = 0;
  const entries = Object.freeze(definitions.flatMap(d=>d.images.map((image,variant)=>Object.freeze({...d,variant,image,id:`${d.group}:${d.key}:${variant+1}`}))));
  const byId = new Map(entries.map(d=>[d.id,d]));
  function resolve(visual) {
    if (!visual || !Number.isInteger(visual.variant) || visual.variant<0 || visual.variant>2) return null;
    return byId.get(`${visual.group || 'sea'}:${visual.key}:${visual.variant+1}`) || null;
  }
  function pick(group,key) {
    const def=byKey.get(`${group}:${key}`); if(!def)return null;
    const values=new Uint32Array(1);
    if(root.crypto?.getRandomValues)root.crypto.getRandomValues(values);
    else values[0]=(Date.now()+ ++serial*2654435761)>>>0;
    const options=[0,1,2].filter(v=>v!==previous.get(`${group}:${key}`));
    const variant=options[values[0]%options.length];previous.set(`${group}:${key}`,variant);
    return {group,key,variant};
  }
  function normalizeCollection(value) {
    const clean={};if(!value||typeof value!=='object'||Array.isArray(value))return clean;
    for(const [id,at] of Object.entries(value))if(byId.has(id)&&Number.isSafeInteger(at)&&at>0)clean[id]=at;
    return clean;
  }
  function mergeCollections(...values) {
    const merged={};for(const value of values)for(const [id,at] of Object.entries(normalizeCollection(value)))merged[id]=merged[id]?Math.min(merged[id],at):at;
    return merged;
  }
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function artMarkup(visual,options={}) {
    const art=resolve(visual);if(!art)return '';
    return `<figure class="adventure-result-art" data-art-id="${esc(art.id)}"><img src="${art.image}" alt="${esc(art.title)}・插畫 ${art.variant+1}" decoding="async" onerror="this.hidden=true;this.parentElement.classList.add('art-unavailable')"><figcaption>${esc(options.caption||`${art.title} · ${art.variant+1}/3`)}</figcaption><span class="adventure-art-fallback">${esc(art.title)} · 插畫載入中，結果仍可繼續</span></figure>`;
  }
  const api=Object.freeze({groups,definitions,entries,resolve,pick,normalizeCollection,mergeCollections,artMarkup,escapeHtml:esc});
  root.BoardAdventureArt=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:globalThis);
