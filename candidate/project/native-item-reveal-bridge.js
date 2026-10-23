'use strict';
const {Callable}=require('godot');
// Original playNextItemReveal owns the queue, 1800 ms guard and dismissal.
exports.bind=function(refs,registry,view){
 const classes=new Set(),listeners=new Set(),images={},texts={},nodes={};let disposed=false;
 const snapshot=()=>({show:classes.has('show'),awaiting:classes.has('awaiting'),clue:classes.has('postgame-clue'),images:Object.fromEntries(Object.entries(images).map(([k,n])=>[k,{src:n.src.split('?')[0],hidden:n.hidden}])),texts:{...texts}}),update=()=>{if(!disposed)view.call('apply_json',JSON.stringify(snapshot()));};
 const classList={contains:k=>classes.has(k),add(...keys){keys.forEach(k=>classes.add(k));update();},remove(...keys){keys.forEach(k=>classes.delete(k));update();}};
 refs.itemRevealHud={classList,get className(){return [...classes].join(' ');},set className(v){classes.clear();String(v).split(/\s+/).filter(Boolean).forEach(k=>classes.add(k));update();},setAttribute(k,v){if(k!=='aria-hidden')throw Error('Unknown reveal attribute '+k);},addEventListener(t,fn){if(t!=='click')throw Error('Unknown reveal event');listeners.add(fn);},removeEventListener(t,fn){if(t!=='click')throw Error('Unknown reveal event');listeners.delete(fn);}};
 for(const key of ['itemRevealTitle','itemRevealName','itemRevealLine','postgameClueRevealRank','postgameClueRevealRankMirror']){texts[key]='';nodes[key]={get textContent(){return texts[key];},set textContent(v){texts[key]=String(v);},classList:{toggle(k){if(k!=='double')throw Error('Unknown clue rank class');}}};}
 for(const key of ['itemRevealPanelFrame','itemRevealImage','postgameClueRevealFrame','postgameClueRevealIsland']){
  let src='',hidden=false;const dataset=key==='itemRevealPanelFrame'?{src:'images/board/item_reveal_ui/important_item_reveal_panel_frame.webp'}:key==='postgameClueRevealFrame'?{src:'images/board/postgame_clue_ui/york_clue_playing_card_frame_v2.webp'}:{};
  images[key]=nodes[key]={dataset,alt:'',get src(){return src;},set src(v){src=String(v);},get hidden(){return hidden;},set hidden(v){hidden=!!v;},getAttribute(k){if(k!=='src')throw Error('Unknown reveal image attribute');return src||null;},async decode(){const path=src.split('?')[0];view.call('request_decode',path);for(let i=0;i<400&&!disposed;i++){if(view.call('asset_is_ready',path))return;if(view.call('asset_has_failed',path))throw Error('Reveal image failed '+path);await new Promise(r=>setTimeout(r,16));}throw Error('Reveal decode timeout '+path);}};
 }
 nodes.postgameClueReveal={hidden:true};for(const [key,node]of Object.entries(nodes)){if(key.startsWith('itemReveal'))refs[key]=node;else registry.set(key,node);}
 const click=()=>{if(disposed||!classes.has('show'))return;for(const fn of [...listeners])fn({target:{closest:()=>null}});};
 refs.itemRevealContinue={click};
 let callback=Callable.create(view,click);view.connect('clicked',callback);
 return{snapshot,dispose(){if(disposed)return;disposed=true;listeners.clear();for(const key of Object.keys(nodes))registry.delete(key);view.disconnect('clicked',callback);callback=null;view.call('apply_json',JSON.stringify({...snapshot(),show:false}));}};
};
