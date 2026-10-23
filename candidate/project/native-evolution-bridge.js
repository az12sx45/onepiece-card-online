'use strict';
const {Callable,Time}=require('godot');
// Only the original evolution HUD contract. Original timers and listener
// closures own progress and dismissal; no parallel evolution rules exist here.
exports.bind=function bindEvolution(refs,view){
 const classes=new Set(['evolution-hud']),listeners=new Set(),images={},attributes={'aria-hidden':'true'};let text='',disposed=false,started=0;
 const snapshot=()=>({show:classes.has('show'),awaiting:classes.has('awaiting'),type:['flag','paper','prime','enma'].find(t=>classes.has(t))||'flag',text,images:Object.fromEntries(Object.entries(images).map(([k,v])=>[k,{src:v.src,alt:v.alt,hidden:v.hidden}]))});
 const update=()=>{if(!disposed)view.call('apply_json',JSON.stringify(snapshot()));};
 const root={get className(){return [...classes].join(' ');},set className(value){classes.clear();String(value).split(/\s+/).filter(Boolean).forEach(v=>classes.add(v));update();},classList:{contains:v=>classes.has(v),add(...keys){keys.forEach(v=>classes.add(v));update();},remove(...keys){keys.forEach(v=>classes.delete(v));update();}},get offsetWidth(){return view.get('size').x;},setAttribute(key,value){if(key!=='aria-hidden')throw Error('Unbound evolution attribute '+key);attributes[key]=String(value);if(value==='false')started=Time.get_ticks_msec();},getAttribute:key=>attributes[key]??null,addEventListener(type,fn){if(type!=='click')throw Error('Unbound evolution event '+type);listeners.add(fn);},removeEventListener(type,fn){if(type!=='click')throw Error('Unbound evolution event '+type);listeners.delete(fn);}};
 refs.evolutionHud=root;refs.evolutionHudSub={get textContent(){return text;},set textContent(value){text=String(value);update();}};
 for(const key of ['CharacterBefore','CharacterAfter','CharacterFrame','Material']){
  let src='',alt='',hidden=false;const dataset=key==='CharacterFrame'?{src:'images/board/evolution_ui/evolution_portrait_frame_v1.webp?v=20260831-portable-prefetch-v397'}:{};
  const node={dataset,get src(){return src;},set src(value){src=String(value);},get alt(){return alt;},set alt(value){alt=String(value);},get hidden(){return hidden;},set hidden(value){hidden=!!value;},getAttribute(name){if(name!=='src')throw Error('Unbound evolution image attribute '+name);return src||null;},async decode(){const path=src.split('?')[0];if(!path)return;view.call('request_decode',path);for(let i=0;i<200&&!disposed;i++){if(view.call('asset_is_ready',path))return;if(view.call('asset_has_failed',path))throw Error('Evolution image load failed '+path);await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Evolution decode timed out '+path);}};
  images[key]=node;refs['evolutionHud'+key]=node;
 }
 const click=()=>{if(disposed||!classes.has('show'))return;for(const fn of [...listeners])fn({target:{closest:()=>null}});};
 refs.evolutionHudContinue={click};
 let callback=Callable.create(view,click);view.connect('clicked',callback);
 return {snapshot,get started(){return started;},dispose(){disposed=true;listeners.clear();view.disconnect('clicked',callback);callback=null;view.call('apply_json',JSON.stringify({...snapshot(),show:false}));}};
};
