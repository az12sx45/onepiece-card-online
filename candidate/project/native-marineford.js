'use strict';
// Native replacement for the original iframe transport. Original source owns
// raid setup, rewards, timers, commands and all irreversible state changes.
const {URL,URLSearchParams}=require('./native-scene-url');
const {Time}=require('godot');
const RESULT='onepiece-board-marineford-command-result-v1';
exports.create=function({core,parentHost,registry,catalog,present,hide,geometry,preloadImage,warmImages,video,syncMedia=()=>{}}){
 if(!(registry instanceof Map)||typeof present!=='function'||typeof hide!=='function'||typeof geometry!=='function')throw Error('Marineford scene bindings required');
 let page=null,ui=null,host=null,disposed=false,preparing=false,opening=false,source='',queued=false,lastPacket='';const classes=new Set(),loads=[],timers=new Set();
 const later=(fn,delay=0)=>{let id;id=setTimeout(()=>{timers.delete(id);if(!disposed)fn();},delay);timers.add(id);return id;};
 const cancel=id=>{clearTimeout(id);timers.delete(id);};
 const publish=()=>{if(disposed||queued)return;queued=true;later(()=>{queued=false;if(ui&&page&&classes.has('open')){syncMedia(ui.document);const packet=JSON.stringify({...require('./native-marineford-model').project(ui.document),inputReady:classes.has('ready')&&!classes.has('closing')&&!preparing&&!page.state.animating});if(packet!==lastPacket){lastPacket=packet;present(JSON.parse(packet));}}});};
 const channel={closed:false,postMessage(message){if(message?.type!=='board-marineford-update')throw Error('Unknown Marineford message');later(()=>host?.dispatch('message',{data:message}));},focus(){publish();}};
 function mount(url){
  host?.dispose();lastPacket='';const listeners=new Map(),owned=new Set(),intervals=new Map();let alive=true,nextInterval=1,lastRender='';
  const timer=(fn,ms=0)=>{let id;id=later(()=>{owned.delete(id);if(alive)fn();},ms);owned.add(id);return id;};
   const window={location:{search:url.search,href:url.href,origin:url.origin},BoardCards:parentHost.window.BoardCards,setTimeout:timer,clearTimeout:id=>{owned.delete(id);cancel(id);},requestAnimationFrame:fn=>timer(()=>fn(Time.get_ticks_msec()),16),cancelAnimationFrame:id=>{owned.delete(id);cancel(id);},
   setInterval(fn,ms){const id=nextInterval++;const tick=()=>{if(!intervals.has(id))return;fn();if(intervals.has(id))intervals.set(id,timer(tick,ms));};intervals.set(id,timer(tick,ms));return id;},clearInterval(id){cancel(intervals.get(id));intervals.delete(id);},
   addEventListener(type,fn){if(!['resize','message','storage','pagehide'].includes(type))throw Error('Unbound Marineford window event '+type);const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);},removeEventListener(type,fn){listeners.set(type,(listeners.get(type)||[]).filter(x=>x!==fn));},
   TabletopPhoneRenderLifecycle:{begin(_root,key,values){if(key!=='marineford')throw Error('Unknown Marineford render scope');const packet=JSON.stringify(values,(_k,v)=>v instanceof Set?[...v]:v);if(packet===lastRender)return false;lastRender=packet;return true;}},
   parent:{BgmManager:parentHost.window.BgmManager,postMessage(message){if(message?.type!=='board-marineford-command')throw Error('Unknown Marineford page command');timer(()=>{const before=parentHost.localStorage.getItem(RESULT);core.functions.processMarinefordPageCommand(message.command);core.functions.writeMarinefordSnapshot();const after=parentHost.localStorage.getItem(RESULT);if(after!==before)host.dispatch('storage',{key:RESULT,newValue:after,oldValue:before});});}}
  };
  ui=require('./native-marineford-controls').create(catalog,{changed:publish,geometry,video});
  class Image{set src(path){if(typeof preloadImage!=='function')throw Error('Marineford native image preload binding required');Promise.resolve(preloadImage(path)).then(ok=>{if(alive)(ok?this.onload:this.onerror)?.();});}}
  host={window,document:ui.document,localStorage:parentHost.localStorage,URLSearchParams,performance:{now:()=>Time.get_ticks_msec()},Image,getComputedStyle(node){if(node.classList.contains('lottery-track'))return {gap:String(geometry(node).gap)};throw Error('Unbound Marineford computed style '+node.className);},dispatch(type,event){for(const fn of listeners.get(type)||[])fn(event);},dispose(){alive=false;for(const id of owned)cancel(id);owned.clear();intervals.clear();listeners.clear();ui?.dispose();}};
  page=require('./original-marineford').create(host);page.start();later(()=>{for(const fn of loads.splice(0))fn();publish();});
 }
 const frame={dataset:{},contentWindow:channel,addEventListener(type,fn,options){if(type!=='load'||options?.once!==true)throw Error('Unknown Marineford frame listener');loads.push(fn);},focus(){channel.focus();},get src(){return source;},set src(value){const url=new URL(value);if(url.origin!==parentHost.window.location.origin||url.pathname!=='/board_marineford.html'||url.searchParams.get('board')!=='1')throw Error('Unsupported Marineford route');opening=true;source=url.href;mount(url);}};
 const overlay={get opening(){return opening;},querySelector(selector){if(selector!=='iframe')throw Error('Unknown Marineford overlay selector');return frame;},classList:{contains:k=>classes.has(k),add(...ks){ks.forEach(k=>classes.add(k));if(ks.includes('open'))opening=false;publish();},remove(...ks){if(ks.includes('closing')&&ks.includes('transitioning'))opening=true;if(ks.includes('open'))opening=false;ks.forEach(k=>classes.delete(k));if(!classes.has('open')){hide();lastPacket='';}else publish();}}};
 if(registry.has('marinefordPageOverlay'))throw Error('Marineford overlay already registered');registry.set('marinefordPageOverlay',overlay);
 async function activate(uid){
  if(!classes.has('open')||!classes.has('ready')||classes.has('closing')||disposed||preparing)return false;
  const node=ui.nodes.get(uid);if(!node||node.disabled)return false;
  if(node.dataset.startLottery&&typeof warmImages==='function'){
   const ids=node.dataset.startLottery==='crew'?page.state.players.flatMap(p=>p.crew):page.constants.whitebeardIds;
   const assets=new Set(['images/board/marineford_ui/marineford_player_lottery_reel_frame.webp']);
   for(const id of ids){const markup=page.functions.lotteryTokenHtml({source:node.dataset.startLottery},id);const tree=require('./native-research-markup').parse(markup);const visit=n=>{if(n.tag==='img')assets.add((n.attrs||n.attributes).src);for(const child of n.children||[])if(typeof child==='object')visit(child);};visit(tree);}
   preparing=true;publish();try{await warmImages([...assets]);}finally{preparing=false;publish();}
   if(disposed||ui.nodes.get(uid)!==node||!classes.has('open')||classes.has('closing')||node.disabled)return false;
  }
  return ui.dispatch(uid,'click');
 }
 return {get page(){return page;},get ui(){return ui;},get preparing(){return preparing;},overlay,channel,model:()=>ui?require('./native-marineford-model').project(ui.document):null,activate,resize(){host?.dispatch('resize',{});publish();},dispose(){if(disposed)return;disposed=true;channel.closed=true;host?.dispatch('pagehide',{});host?.dispose();for(const id of timers)clearTimeout(id);timers.clear();loads.length=0;if(registry.get('marinefordPageOverlay')===overlay)registry.delete('marinefordPageOverlay');hide();}};
};
