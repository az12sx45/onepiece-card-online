'use strict';
const {Callable}=require('godot');
// A bounded mapping of the original cinematic DOM/media contract onto native
// controls. Rule functions, watchdogs, timing and event closures stay original.
exports.bind=function(view,baseDocument,postView=null){
 let root=null,postRoot=null,video=null,disposed=false;const nodes=new Set();
 const state=()=>JSON.parse(view.call('media_state_json'));
 const emit=type=>{if(video)video.emit(type);};
 const callback=Callable.create(view,emit);view.connect('media_event',callback);
 const descendants=node=>[node,...node.children.flatMap(descendants)];
 const decode=value=>String(value||'').replace(/<br\s*\/?\s*>/g,'\n').replace(/<[^>]+>/g,'').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').trim();
 function postModel(html){
  const images=[...html.matchAll(/<img\s+([^>]+)>/g)].map(m=>({src:decode(m[1].match(/src="([^"]*)"/)?.[1]).split('?')[0],after:m[1].includes('data-nika-fallback')}));
  const lines=[...html.matchAll(/<div style="font-size:[^"]*">([^<]+)<\/div>/g)].map(m=>decode(m[1]));
  if(lines.length!==3)throw Error('Original Nika dialogue structure changed');
  return {before:{src:images.find(i=>!i.after)?.src||''},after:{src:images.find(i=>i.after)?.src||''},lines,fallback:decode(html.match(/<div data-nika-fallback[^>]*>([\s\S]*?)<\/div>/)?.[1])};
 }
 function remove(node){
  if(node===root){view.call('remove_video');root=null;video=null;}else if(node===postRoot){postView.call('remove_post');postRoot=null;}else if(node.parentElement)node.parentElement.children=node.parentElement.children.filter(n=>n!==node);
  for(const child of descendants(node))nodes.delete(child);
 }
 function opacityTrack(){
  const style=descendants(root).find(n=>n.tag==='style');
  const match=/@keyframes\s+luffyGearFifthBattleVideoCuts\s*\{([\s\S]*?)\n\s*\}/.exec(style?.textContent||'');
  if(!match)throw Error('Original Nika video cuts missing');
  const frames=new Map();for(const frame of match[1].matchAll(/([\d.% ,]+)\{\s*opacity:\s*([\d.]+);?\s*\}/g))for(const key of frame[1].split(','))frames.set(parseFloat(key)/100,Number(frame[2]));
  const track=[...frames].sort((a,b)=>a[0]-b[0]).map(([time,value])=>({time,value}));
  if(track.length!==18||track[0].time!==0||track.at(-1).time!==1)throw Error('Unrecognized original Nika video opacity track');return track;
 }
 function element(tag){
  if(disposed)throw Error('Nika presentation disposed');
  if(!['div','style','video'].includes(tag))throw Error('Unbound Nika element '+tag);
  const listeners=new Map(),node={tag,children:[],parentElement:null,className:'',textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=String(v);},appendChild(child){child.parentElement=this;this.children.push(child);return child;},append(...children){children.forEach(n=>this.appendChild(n));},remove(){remove(this);},addEventListener(type,fn,options){if(!['loadedmetadata','ended','error','abort','stalled'].includes(type))throw Error('Unbound media event '+type);if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push({fn,once:!!options?.once});},emit(type){for(const entry of [...(listeners.get(type)||[])]){if(entry.once)listeners.set(type,listeners.get(type).filter(n=>n!==entry));entry.fn();}}};
  let html='';Object.defineProperty(node,'innerHTML',{get:()=>html||node.children.filter(c=>c.tag==='style').map(c=>'<style>'+c.textContent+'</style>').join(''),set:value=>{html=String(value);if(node!==postRoot||!postView)throw Error('Unbound Nika markup');postView.call('show_post_json',JSON.stringify(postModel(html)));}});
  node.style=new Proxy({}, {set(target,key,value){target[key]=value;if(!disposed&&key==='opacity'){if(node===root&&value==='0')view.call('fade_out');else if(node===postRoot&&value==='0')postView.call('fade_out');else if(node!==root&&node!==postRoot&&value==='1'&&node.textContent)view.call('show_fallback',node.textContent);}return true;}});
  if(tag==='video'){
   video=node;for(const key of ['duration','currentTime','paused','ended','readyState'])Object.defineProperty(node,key,{get:()=>state()[key]});
   node.play=()=>{if(!root||root.className!=='luffy-gear-fifth-layer video')throw Error('Native video root mismatch');view.call('start_video',JSON.stringify({src:node.src,muted:!!node.muted,opacityTrack:opacityTrack()}));return Promise.resolve();};node.pause=()=>view.call('pause_video');
  }
  nodes.add(node);return node;
 }
 const body={appendChild(node){if(node.className==='luffy-gear-fifth-layer video'){if(root)throw Error('Overlapping native video');root=node;}else if(node.className==='luffy-gear-fifth-layer post-evolution'&&postView){if(postRoot)throw Error('Overlapping native post evolution');postRoot=node;}else throw Error('Unbound Nika layer '+node.className);return node;}};
 const document=new Proxy({}, {get(_target,key){if(key==='body')return body;if(key==='createElement')return element;return baseDocument[key];}});
 return {document,stats:()=>({nodes:nodes.size,rootPresent:!!root||!!postRoot,listeners:video?true:false}),dispose(){disposed=true;view.disconnect('media_event',callback);view.call('remove_video');if(postView)postView.call('remove_post');root=null;postRoot=null;video=null;nodes.clear();}};
};
