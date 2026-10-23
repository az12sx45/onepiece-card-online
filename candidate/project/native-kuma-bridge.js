'use strict';
// Original controller owns path evaluation, camera tracking, cancellation and
// arrival timing. Only its authored map nodes are translated to native layers.
exports.bind=function(host,application,getCore){
 const previous=host.document,board=host.refs.boardGameMap,view=application.get('kuma_effect'),map=application.get('map_view');let active=null,disposed=false;
 const ships=new Map(),decode=s=>String(s).replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
 function node(){
  const layer=previous.createElement('div'),remove=layer.remove,baseClasses=layer.classList;layer.dataset={};let markup='',model=null,queued=false;
  const values={},publish=()=>{if(disposed||queued||active!==layer)return;queued=true;Promise.resolve().then(()=>{queued=false;if(!disposed&&active===layer)view.call('pose_json',JSON.stringify(values));});};
  const token={style:new Proxy({setProperty(key,value){if(key!=='--kuma-paw-map-ship-upright')throw Error('Unknown Kuma property '+key);values.upright=String(value);publish();}},{set(target,key,value){if(!['left','top','transform'].includes(key))throw Error('Unknown Kuma pose '+key);values[key]=String(value);publish();return true;},get(target,key){return key in target?target[key]:values[key];}})};
  Object.defineProperty(layer,'innerHTML',{get:()=>markup,set(value){markup=String(value);if(!layer.className.startsWith('kuma-paw-map-layer '))throw Error('Unknown dynamic map markup');const path=/class="kuma-paw-map-contrail aura"[^>]*\sd="([^"]+)"/.exec(markup)?.[1],coords=path?.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi)?.map(Number),image=cls=>decode(markup.match(new RegExp('class="'+cls+'"[^>]*src="([^"]+)"'))?.[1]||'');if(coords?.length!==6)throw Error('Original Kuma quadratic path changed');model={eventId:layer.dataset.eventId,classes:layer.className,points:coords,ship:image('kuma-paw-map-ship'),bubble:image('kuma-paw-map-bubble'),burst:image('kuma-paw-map-burst landing'),extent:getCore().functions.boardPixelSize()};}});
  layer.querySelector=selector=>{if(selector!=='.kuma-paw-map-token')throw Error('Unknown Kuma layer selector '+selector);return token;};
  layer.classList=new Proxy(baseClasses,{get(target,key){if(key==='add'||key==='remove')return(...names)=>{target[key](...names);if(active===layer)view.call('phase_changed',layer.className);};return Reflect.get(target,key);}});
  layer.remove=()=>{if(active===layer){active=null;view.call('close_surface');application.call_deferred('emit_signal','map_controls_visibility_changed');}else remove();};
  layer.nativeKumaModel=()=>model;return layer;
 }
 host.refs.boardGameMap=new Proxy(board,{get(target,key){
  if(key==='appendChild')return layer=>{if(!layer.className.startsWith('kuma-paw-map-layer '))return target.appendChild(layer);if(!layer.nativeKumaModel?.())throw Error('Kuma original structure missing');active=layer;view.call('open_json',JSON.stringify(layer.nativeKumaModel()));return layer;};
  if(key==='querySelector')return selector=>{const match=/^\.ship-token\[data-player-id="([^"]+)"\]$/.exec(selector);if(!match)throw Error('Unknown Kuma ship selector '+selector);const id=match[1];if(!ships.has(id)){const classes=new Set();ships.set(id,{classList:{contains:k=>classes.has(k),add(k){if(k!=='kuma-paw-hidden-source')throw Error('Unknown Kuma source class '+k);classes.add(k);map.call('set_ship_effect_hidden',id,true);},remove(k){classes.delete(k);map.call('set_ship_effect_hidden',id,false);}}});}return ships.get(id);};
  return Reflect.get(target,key);
 }});
 host.document=new Proxy(previous,{get(target,key){if(key==='createElement')return tag=>{if(tag!=='div')return target.createElement(tag);return node();};if(key==='getElementById')return id=>id==='finalBossVoyageCinematic'?null:target.getElementById(id);return Reflect.get(target,key);}});
 return {document:host.document,active:()=>active,dispose(){if(disposed)return;getCore().functions.clearFinalBossVoyageCinematic();getCore().functions.clearFinalBossVoyageMapAnimation();disposed=true;view.call('close_surface');for(const id of ships.keys())map.call('set_ship_effect_hidden',id,false);ships.clear();}};
};
