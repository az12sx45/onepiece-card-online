'use strict';
// A bounded scene bridge for the unchanged source tavern controller. This is
// not a browser/HTML renderer. Only nodes and selectors used by that controller
// are accepted. Native visual completeness is tracked separately from rules.
const {Callable,FileAccess,Time,OS}=require('godot');
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class NativeTavernReveal {
 constructor(bridge,window){
  this.bridge=bridge;this.window=window;this.view=bridge.application.get('tavern_reveal');this.overlay=null;this.pending=false;this.failures=[];this.events=[];
  const owner=this;
  class SceneNode {
   constructor(tag){this.tag=tag;this.children=[];this.parent=null;this.listeners=new Map();this.className='';this.textContent='';this.hidden=false;this.disabled=false;this.src='';
    this.dataset=new Proxy({}, {set:(obj,key,value)=>{obj[key]=value;owner.queue();return true;}});
    this.style={setProperty:(key,value)=>{this.style[key]=value;owner.queue();}};
    this.classList={contains:key=>this.className.split(' ').includes(key),add:(...keys)=>{this.className=[...new Set([...this.className.split(' '),...keys])].join(' ');owner.queue();},remove:(...keys)=>{this.className=this.className.split(' ').filter(k=>!keys.includes(k)).join(' ');owner.queue();}};
   }
   append(...nodes){for(const node of nodes){if(node.parent)node.parent.children=node.parent.children.filter(n=>n!==node);node.parent=this;this.children.push(node);}owner.queue();}
   setAttribute(key,value){if(!['role','aria-modal','aria-label','aria-live'].includes(key))throw Error('Unknown tavern attribute '+key);this[key]=value;}
   addEventListener(type,fn){if(!['click','error'].includes(type))throw Error('Unknown tavern event '+type);this.listeners.set(type,fn);}
   querySelectorAll(selector){if(selector==='button:not(:disabled)')return this.descendants().filter(n=>n.tag==='button'&&!n.disabled);if(selector==='button')return this.descendants().filter(n=>n.tag==='button');throw Error('Unknown tavern node selector '+selector);}
   descendants(){return this.children.flatMap(node=>[node,...node.descendants()]);}
   contains(node){return node===this||this.descendants().includes(node);}
   get isConnected(){return owner.overlay===this||!!owner.overlay?.contains(this);}
   getClientRects(){for(let node=this;node;node=node.parent)if(node.hidden)return [];return this.isConnected?[{}]:[];}
   focus(){owner.document.activeElement=this;}
   click(){if(!this.disabled)this.listeners.get('click')?.();}
   remove(){if(owner.overlay===this){owner.overlay=null;owner.last=null;owner.view.call('close_surface');}if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;owner.queue();}
   async decode(){
    const path=owner.assetPath(this.src),overlay=owner.overlay;for(let i=0;i<2000;i++){
     if(owner.overlay!==overlay)throw Error('Tavern decode cancelled with its scene');
     const data=JSON.parse(owner.view.call('image_info_json',path));
     if(data.error){this.listeners.get('error')?.();throw Error(data.error);}
     if(data.ready){this.naturalWidth=data.width;this.naturalHeight=data.height;return;}
     await wait(16);
    }throw Error('Tavern asset decode timed out '+path);
   }
  }
  this.Node=SceneNode;
  const body=new SceneNode('body');body.style.overflow='';body.append=node=>{if(owner.overlay)throw Error('Overlapping native tavern overlays');owner.overlay=node;node.parent=body;owner.flush();};
  const events=new Map();
  this.document={body,baseURI:'https://native.invalid/',documentElement:{},activeElement:null,readyState:'complete',
   createElement(tag){if(!['section','div','img','span','p','h2','button','canvas'].includes(tag))throw Error('Unknown tavern node '+tag);const node=new SceneNode(tag);if(tag==='canvas')node.getContext=()=>({drawImage(portrait){node.source=portrait.src;},getImageData(){const data=JSON.parse(owner.view.call('alpha_sample_json',owner.assetPath(node.source)));return {data:data};}});return node;},
   getElementById(id){if(id==='boardModalBack')return bridge.nativeRefs.modalBack;if(id==='boardModal')return bridge.nativeRefs.modal;throw Error('Unknown reveal root '+id);},
   querySelector(selector){if(selector==='.tavern-nautical-modal')return bridge.model?.kind==='tavern'?bridge.nativeRefs.modal:null;throw Error('Unknown reveal query '+selector);},
   querySelectorAll(selector){if(selector!=='.tavern-result-ui[data-tavern-reveal="v4"]')throw Error('Unknown reveal query '+selector);return bridge.model?.dataset?.tavernReveal==='v4'?bridge.query('.tavern-result-ui'):[];},
   addEventListener(type,fn){events.set(type,fn);},removeEventListener(type,fn){if(events.get(type)===fn)events.delete(type);},
  };
  class LocalURL {constructor(value){this.pathname='/'+owner.assetPath(String(value));this.href='https://native.invalid'+this.pathname;}}
  // This source presenter queries only reduced motion. The native sequence is
  // enabled; keep the adapter local instead of adding a fake global browser.
  const revealWindow=Object.create(window);
  revealWindow.matchMedia=query=>{if(query!=='(prefers-reduced-motion: reduce)')throw Error('Unsupported tavern media query '+query);return {matches:false};};
  const api=require('./original-tavern-reveal').install({window:revealWindow,document:this.document,
   URL:LocalURL,Image:class extends SceneNode{constructor(){super('img');}},MutationObserver:class {observe(){}},
   getComputedStyle:()=>({getPropertyValue:key=>{if(key!=='--tavern-reveal-ready')throw Error('Unknown reveal CSS readiness');return '4';}}),
   fetch:async value=>{if(owner.assetPath(value.href||String(value))!=='images/board-depth/v1/manifest.json')throw Error('Unknown reveal resource');let path='res://tavern-depth-manifest.json';if(!FileAccess.file_exists(path)&&OS.get_name()!=='Android')path='res://../../public/images/board-depth/v1/manifest.json';return {ok:true,json:async()=>JSON.parse(FileAccess.get_file_as_string(path))};},
  });
  this.api=api;
  window.BoardTavernReveal=api;
  window.BoardTavernVfx={create:options=>require('./native-tavern-vfx').create(this,options)};
  this.callback=Callable.create(bridge.application,key=>{const node=this.find(String(key));if(!node||!node.getClientRects().length)throw Error('Unavailable native reveal button '+key);node.click();this.flush();});this.view.connect('command_requested',this.callback);
 }
 assetPath(value){const path=String(value).replace(/^https:\/\/native\.invalid\//,'').replace(/^\/+/, '').split('?')[0];if(!/^images\/[\w./%-]+$/.test(path)||path.includes('..'))throw Error('Unsafe native reveal asset '+value);return decodeURIComponent(path);}
 find(className){return [this.overlay,...(this.overlay?.descendants()||[])].find(n=>n?.classList.contains(className));}
 queue(){if(this.pending)return;this.pending=true;setTimeout(()=>{this.pending=false;try{this.flush();}catch(error){this.failures.push(String(error));console.error(String(error));}},0);}
 flush(){
  if(!this.overlay)return;
  const get=key=>this.find(key),text=key=>get(key)?.textContent||'',path=key=>get(key)?.src?this.assetPath(get(key).src):'';
  const buttons=['tavern-reveal-skip','primary','secondary'].map(key=>{const node=get(key);return {key,label:node?.textContent||'',visible:!!node?.getClientRects().length,disabled:!!node?.disabled};});
  const model={...this.overlay.dataset,colors:this.overlay.style,background:path('tavern-reveal-backdrop'),portrait:path('tavern-reveal-character'),mask:get('tavern-reveal-character')?.dataset.portraitMask||'',hostImage:path('tavern-reveal-host'),speaker:text('tavern-reveal-speaker'),role:text('tavern-reveal-role'),line:text('tavern-reveal-line'),decision:text('tavern-reveal-decision'),rank:text('tavern-reveal-rank'),name:text('tavern-reveal-name'),caption:!get('tavern-reveal-caption')?.hidden,buttons};
  const serialized=JSON.stringify(model);if(serialized===this.last)return;this.last=serialized;this.events.push({stage:model.stage,ready:model.ready||'0',ms:Time.get_ticks_msec()});this.view.call('apply_json',serialized);
 }
 bindResult(node){
  const bridge=this.bridge,owner=this;
  node.querySelectorAll=selector=>{if(selector!=='button')throw Error('Unknown result selectors '+selector);return [...bridge.controls.values()].filter(c=>c!==node&&c.dataset);};
  node.querySelector=selector=>{
   if(selector==='.tavern-result-art img')return {src:bridge.model.image};
   if(selector==='.tavern-result-name')return {textContent:bridge.model.name};
   if(selector==='button:not(:disabled)')return node.querySelectorAll('button').find(c=>!c.disabled)||null;
   if(selector==='#acceptRecruitBtn')return bridge.controls.get('acceptRecruitBtn')||null;
   if(selector==='#rejectRecruitBtn, #rejectFullRecruitBtn')return bridge.controls.get('rejectRecruitBtn')||bridge.controls.get('rejectFullRecruitBtn')||null;
   throw Error('Unknown result query '+selector);
  };
  let inert=false;Object.defineProperty(node,'inert',{get:()=>inert,set:value=>{inert=!!value;bridge.application.get('tavern_modal').call('set_inert',inert);}});
  // Browser MutationObserver runs after source attaches validators and handlers.
  setTimeout(()=>{owner.api.scan();owner.flush();},0);
 }
 cancel(){if(!this.overlay)return;this.api.scan();this.flush();}
 dispose(){if(!this.callback)return;this.cancel();this.view.disconnect('command_requested',this.callback);this.callback=null;}
}
exports.NativeTavernReveal=NativeTavernReveal;
