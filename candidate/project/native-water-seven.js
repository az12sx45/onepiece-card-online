'use strict';
// Replacement transport for the original same-origin Water Seven frame. The
// original game and page controllers still own commands, costs and turn exit.
const {URL,URLSearchParams}=require('./native-scene-url');
exports.create=function({core,parentHost,registry,catalog,present,hide,geometry,scrollIntoView}){
 if(!(registry instanceof Map)||typeof present!=='function'||typeof hide!=='function'||typeof geometry!=='function')throw Error('Native Water Seven scene adapters required');
 let page=null,ui=null,host=null,disposed=false,source='',queued=false;const classes=new Set(),loads=[],timers=new Set();
 const later=(fn,delay=0)=>{let id;id=setTimeout(()=>{timers.delete(id);if(!disposed)fn();},delay);timers.add(id);return id;};
 const cancel=id=>{clearTimeout(id);timers.delete(id);};
 const publish=()=>{if(disposed||queued)return;queued=true;later(()=>{queued=false;if(ui&&page&&classes.has('open'))present({...ui.project().model,inputReady:classes.has('ready')&&!classes.has('closing')});});};
 const channel={closed:false,postMessage(message){if(!['board-water-seven-update','board-water-seven-command-result'].includes(message?.type))throw Error('Unknown Water Seven message');later(()=>host?.dispatch('message',{data:message}));},focus(){publish();}};
 function mount(url){
  host?.dispose();const listeners=new Map(),owned=new Set();let alive=true;
  const timer=(fn,ms=0)=>{let id;id=later(()=>{owned.delete(id);if(alive)fn();},ms);owned.add(id);return id;};
  const window={location:{search:url.search,href:url.href,origin:url.origin},setTimeout:timer,clearTimeout:id=>{owned.delete(id);cancel(id);},requestAnimationFrame:fn=>timer(()=>fn(Date.now()),16),matchMedia:()=>({matches:false}),
   addEventListener(type,fn){if(!['resize','message','storage'].includes(type))throw Error('Water Seven window event unsupported '+type);const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list);},
   parent:{postMessage(message){if(!['water-seven-command','water-seven-close'].includes(message?.type))throw Error('Unknown Water Seven page command');timer(()=>{if(message.type==='water-seven-close')core.functions.closeWaterSevenPageOverlay();else core.functions.processWaterSevenPageCommand(message.command||{});});}}
  };
  ui=require('./native-water-controls').create(catalog,{changed:publish,geometry,scrollIntoView});
  host={window,document:ui.document,localStorage:parentHost.localStorage,URLSearchParams,performance:{now:()=>Date.now()},navigator:{},dispatch(type,event){for(const fn of listeners.get(type)||[])fn(event);},dispose(){alive=false;for(const id of owned)cancel(id);owned.clear();listeners.clear();}};
  page=require('./original-water-seven').create(host);page.start();later(()=>{for(const fn of loads.splice(0))fn();publish();});
 }
 const frame={dataset:{},contentWindow:channel,addEventListener(type,fn,options){if(type!=='load'||options?.once!==true)throw Error('Unknown native Water Seven frame listener');loads.push(fn);},focus(){channel.focus();},get src(){return source;},set src(value){const url=new URL(value);if(url.origin!==parentHost.window.location.origin||url.pathname!=='/board_water_seven.html'||url.searchParams.get('board')!=='1'||url.searchParams.get('lockShip')!=='1')throw Error('Unsupported Water Seven route');source=url.href;mount(url);}};
 const overlay={querySelector(selector){if(selector!=='iframe')throw Error('Unknown Water Seven overlay selector');return frame;},classList:{contains:k=>classes.has(k),add(...ks){ks.forEach(k=>classes.add(k));publish();},remove(...ks){ks.forEach(k=>classes.delete(k));if(!classes.has('open'))hide();else publish();}}};
 if(registry.has('waterSevenPageOverlay'))throw Error('Water Seven overlay already registered');registry.set('waterSevenPageOverlay',overlay);
 return {get page(){return page;},get ui(){return ui;},overlay,channel,model:()=>ui?.project().model,activate(key){if(!classes.has('open')||!classes.has('ready')||classes.has('closing')||!ui||disposed)return false;return ui.click(key);},resize(){host?.dispatch('resize',{});publish();},dispose(){if(disposed)return;disposed=true;channel.closed=true;host?.dispose();for(const id of timers)clearTimeout(id);timers.clear();loads.length=0;if(registry.get('waterSevenPageOverlay')===overlay)registry.delete('waterSevenPageOverlay');hide();}};
};
