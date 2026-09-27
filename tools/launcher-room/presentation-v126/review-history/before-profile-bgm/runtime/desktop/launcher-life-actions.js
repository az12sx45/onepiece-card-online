/* Complete authored figure loops. No head/limb rigging or direction mirroring. */
(function(root, factory) {
  const reserved = typeof module === 'object' && module.exports ? require('./launcher-reserved-crew.js') : root.OnePieceReservedCrew;
  const api = factory(reserved);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OnePieceLifeActions = api;
})(typeof globalThis === 'object' ? globalThis : this, function(reserved) {
  'use strict';
  const KEYS = new Set(reserved?.SUPPORTED_KEYS || ['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe']);
  const DIRECTIONS = new Set(['east','west','north','south']);
  const SHAPE = Object.freeze({cell:128,columns:4,rows:1,frames:4,root:[64,112]});
  const CLIPS = Object.freeze({
    work:{frameMs:300,directional:true}, read:{frameMs:650,directional:true},
    cook:{frameMs:280,directional:true}, music:{frameMs:260,directional:true},
    craft:{frameMs:360,directional:true}, medicine:{frameMs:500,directional:true}, helm:{frameMs:480,directional:true},
    eat:{frameMs:480,direction:'south'}, rest:{frameMs:850,direction:'south'},
    sleep:{frameMs:1000,direction:'south'}, train:{frameMs:420,direction:'south'}
  });
  const cache = new Map();
  const SPECIALISTS={read:['nami','usopp','chopper','robin','franky','jinbe'],cook:['sanji'],music:['brook'],craft:['usopp','franky'],medicine:['chopper'],helm:['jinbe']};
  function supported(key,action){return KEYS.has(key)&&!!CLIPS[action]&&(!SPECIALISTS[action]||SPECIALISTS[action].includes(key));}
  // Existing consumers resolve these paths beneath life_v1; reserved content has its own manifest/root.
  function assets(){return [...KEYS].filter(key=>!reserved?.RESERVED_KEYS.includes(key)).flatMap(key=>Object.keys(CLIPS).filter(action=>supported(key,action)).flatMap(action=>(CLIPS[action].direction?[CLIPS[action].direction]:[...DIRECTIONS]).map(direction=>`${key}/${action}-${direction}.webp`)));}
  function describe(action, direction='south') {
    const clip = CLIPS[action];
    return clip ? {...clip,action,direction:clip.direction || (DIRECTIONS.has(direction)?direction:'south')} : null;
  }
  function url(key,action,direction) {
    const clip=describe(action,direction);
    if(supported(key,action)&&clip&&reserved?.RESERVED_KEYS.includes(key))return reserved.assetUrl(key,`life/${action}-${clip.direction}.webp`);
    return supported(key,action)&&clip ? `opui://launcher/images/launcher_room/life_v1/${key}/${action}-${clip.direction}.webp` : '';
  }
  function preload(key,action,direction) {
    const source=url(key,action,direction);
    if(!source || typeof Image==='undefined')return null;
    if(cache.has(source))return cache.get(source);
    const cell=reserved?.RESERVED_KEYS.includes(key)?256:128;
    const record={source,cell,ready:false,failed:false,image:null}; cache.set(source,record);
    const img=new Image();record.image=img;
    record.promise=new Promise(resolve=>{
      img.onload=async()=>{
        try {await img.decode();record.ready=img.naturalWidth===cell*4&&img.naturalHeight===cell;record.failed=!record.ready;} catch {record.failed=true;}
        resolve(record);
      };
      img.onerror=()=>{record.failed=true;resolve(record);};
      img.src=source;
    });
    return record;
  }
  function frame(action,elapsedMs) {
    const clip=CLIPS[action];
    return clip ? Math.floor(Math.max(0,Number(elapsedMs)||0)/clip.frameMs)%4 : -1;
  }
  function draw(canvas,key,action,direction,elapsedMs,reducedMotion=false) {
    const record=preload(key,action,direction);
    if(!record?.ready || !canvas)return false;
    const context=canvas.getContext('2d');if(!context)return false;
    const cell=record.cell;
    if(canvas.width!==cell||canvas.height!==cell){canvas.width=cell;canvas.height=cell;}
    context.clearRect(0,0,cell,cell);context.imageSmoothingEnabled=true;
    const index=reducedMotion?0:frame(action,elapsedMs);
    context.drawImage(record.image,index*cell,0,cell,cell,0,0,cell,cell);
    return {frame:index,source:record.source,direction:describe(action,direction).direction};
  }
  return Object.freeze({SHAPE,CLIPS,supported,assets,describe,url,preload,frame,draw});
});
