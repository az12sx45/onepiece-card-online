/* Complete authored figure loops. No head/limb rigging or direction mirroring. */
(function(root, factory) {
  const reserved = typeof module === 'object' && module.exports ? require('./launcher-reserved-crew.js') : root.OnePieceReservedCrew;
  const motion = typeof module === 'object' && module.exports ? require('./launcher-room-motion.js') : root.OnePieceRoomMotion;
  const api = factory(reserved, motion);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OnePieceLifeActions = api;
})(typeof globalThis === 'object' ? globalThis : this, function(reserved, motion) {
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
  const loadQueue = [];
  let activeLoads = 0;
  function drainLoads() {
    while(activeLoads<2&&loadQueue.length) {
      const {record,resolve}=loadQueue.shift();
      activeLoads++;
      let finished=false;
      const done=()=>{if(finished)return;finished=true;activeLoads--;resolve(record);drainLoads();};
      const fail=()=>{
        if(record.fallbackSource){
          record.source=record.fallbackSource;
          record.fallbackSource='';
          load(record.source);
        } else {record.failed=true;done();}
      };
      const load=source=>{
        try {
          const img=new Image();record.image=img;
          img.onload=async()=>{
            try {
              await img.decode();
              if(img.naturalWidth===record.cell*4&&img.naturalHeight===record.cell){record.ready=true;done();}
              else fail();
            } catch {fail();}
          };
          img.onerror=fail;
          img.src=source;
        } catch {fail();}
      };
      load(record.source);
    }
  }
  const SPECIALISTS={read:['nami','usopp','chopper','robin','franky','jinbe'],cook:['sanji'],music:['brook'],craft:['usopp','franky'],medicine:['chopper'],helm:['jinbe']};
  function supported(key,action){return KEYS.has(key)&&!!CLIPS[action]&&(!SPECIALISTS[action]||SPECIALISTS[action].includes(key));}
  // Keep the approved 128px atlas list for its historical release validator.
  // Current room content is repacked from the same original drawings at 256px.
  function assets(){return [...KEYS].filter(key=>!reserved?.RESERVED_KEYS.includes(key)).flatMap(key=>Object.keys(CLIPS).filter(action=>supported(key,action)).flatMap(action=>(CLIPS[action].direction?[CLIPS[action].direction]:[...DIRECTIONS]).map(direction=>`${key}/${action}-${direction}.webp`)));}
  function hdAssets(){return assets().filter(asset=>!asset.startsWith('robin/'));}
  function describe(action, direction='south') {
    const clip = CLIPS[action];
    return clip ? {...clip,action,direction:clip.direction || (DIRECTIONS.has(direction)?direction:'south')} : null;
  }
  function url(key,action,direction) {
    const clip=describe(action,direction);
    if(key==='robin'&&supported(key,action)&&clip)return `opui://launcher/images/launcher_room/robin_v2/life/${action}-${clip.direction}.webp`;
    if(supported(key,action)&&clip&&reserved?.RESERVED_KEYS.includes(key))return reserved.assetUrl(key,`life/${action}-${clip.direction}.webp`);
    const version=motion?.LUFFY_ART_ENABLED===true&&key==='luffy'?'life_hd_v3':'life_hd_v2';
    return supported(key,action)&&clip ? `opui://launcher/images/launcher_room/${version}/${key}/${action}-${clip.direction}.webp` : '';
  }
  function preload(key,action,direction) {
    const source=url(key,action,direction);
    if(!source || typeof Image==='undefined')return null;
    if(cache.has(source))return cache.get(source);
    const cell=256;
    const fallbackSource=motion?.LUFFY_ART_ENABLED===true&&key==='luffy' ? source.replace('/life_hd_v3/', '/life_hd_v2/') : '';
    const record={source,fallbackSource,cell,ready:false,failed:false,image:null}; cache.set(source,record);
    record.promise=new Promise(resolve=>loadQueue.push({record,resolve}));
    drainLoads();
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
    context.clearRect(0,0,cell,cell);context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
    const index=reducedMotion?0:frame(action,elapsedMs);
    context.drawImage(record.image,index*cell,0,cell,cell,0,0,cell,cell);
    return {frame:index,source:record.source,direction:describe(action,direction).direction};
  }
  return Object.freeze({SHAPE,CLIPS,supported,assets,hdAssets,describe,url,preload,frame,draw});
});
