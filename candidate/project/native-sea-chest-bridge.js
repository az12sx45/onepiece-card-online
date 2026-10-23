'use strict';
// The original startSeaTreasureChestShuffle owns all orders, animation frames,
// deadlines and disabled states. This adapter maps its bounded element API.
exports.project=function(html,{decode,field,asset}){
 if(!html.includes('class="sea-chest-stage-shell')||html.includes('is-result'))return null;
 const entries=[...html.matchAll(/<button\s+type="button"\s+class="sea-treasure-chest-card([^\"]*)"([\s\S]*?)<\/button>/g)].map(m=>{
  const body=m[2],slot=field(body,/data-sea-treasure-chest="([^"]+)"/,'chest slot'),images=[...body.matchAll(/<img\s+src="([^"]+)"/g)].map(m=>asset(m[1])),style=body.match(/style="([^"]*)"/)?.[1]||'';
  return{key:'chest:'+slot,slot,finalOrder:Number(field(body,/data-final-order="(\d+)"/,'chest order')),order:Number(style.match(/(?:^|;)\s*order:\s*(\d+)/)?.[1]||0),classes:('sea-treasure-chest-card'+m[1]).trim().split(/\s+/),disabled:/\sdisabled(?:\s|=|>)/.test(body),label:field(body,/<span class="sea-chest-card-label"[^>]*>([\s\S]*?)<\/span>/,'chest label'),front:images[0],back:images[1]};
 });if(entries.length!==4)throw Error('Original chest must have four candidates');
 const button=html.match(/<button[^>]*(?:id="(?:startSeaChestShuffleBtn|spectatorModalCloseBtn)"|data-spectator-chest-shuffle)[^>]*>([\s\S]*?)<\/button>/);
 const key=button?.[0].includes('spectatorModalCloseBtn')?'spectatorModalCloseBtn':button?.[0].includes('data-spectator-chest-shuffle')?'spectator-chest-shuffle':'startSeaChestShuffleBtn';
 return{kind:'sea-chest',title:field(html,/<h3[^>]*>([\s\S]*?)<\/h3>/,'chest title'),subtitle:field(html,/<div class="sea-chest-stage-meta">([\s\S]*?)<\/div>/,'chest odds'),note:field(html,/<div class="sea-chest-stage-note"[^>]*>([\s\S]*?)<\/div>/,'chest note'),frame:asset(field(html,/<img class="sea-chest-stage-frame" src="([^"]+)"/,'chest frame')),entries,gridClasses:field(html,/<div class="(sea-chest-draft-grid[^"]*)"/,'chest grid classes').split(/\s+/),start:{key,label:button?decode(button[1]):'',disabled:button?/\sdisabled(?:\s|=|>)/.test(button[0]):true,removed:!button}};
};
class NativeSeaChestBridge{
 constructor(bridge,html,helpers){
  this.bridge=bridge;this.view=bridge.application.get('sea_chest_modal');this.model=exports.project(html,helpers);this.disposed=false;this.queued=false;this.animations=[];
  const self=this,connected=()=>!self.disposed,publish=()=>{if(self.queued||self.disposed)return;self.queued=true;Promise.resolve().then(()=>{self.queued=false;if(!self.disposed)self.view.call('update_json',JSON.stringify(self.model));});};
  const classes=list=>({contains:k=>list.includes(k),add(...ks){for(const k of ks)if(!list.includes(k))list.push(k);publish();},remove(...ks){for(const k of ks){const i=list.indexOf(k);if(i>=0)list.splice(i,1);}publish();},toggle(k,on){const active=on??!list.includes(k);this[active?'add':'remove'](k);return active;}});
  const note={get isConnected(){return connected();},get textContent(){return self.model.note;},set textContent(v){self.model.note=String(v);publish();}};
  this.cards=this.model.entries.map(entry=>{
   const node={id:entry.key,dataset:{seaTreasureChest:entry.slot,finalOrder:String(entry.finalOrder)},classList:classes(entry.classes),get isConnected(){return connected();},get disabled(){return entry.disabled;},set disabled(v){entry.disabled=!!v;publish();},style:{get order(){return String(entry.order);},set order(v){entry.order=Number(v);self.view.call('set_order',entry.key,entry.order);publish();}},
    addEventListener(type,fn){if(type!=='click')throw Error('Unknown chest event');bridge.listeners.set(entry.key,()=>{if(connected()&&!entry.disabled)fn({currentTarget:node,target:node});});},
    getBoundingClientRect(){return JSON.parse(self.view.call('bounds_json',entry.key));},
    querySelector(s){if(s!=='[data-chest-label]')throw Error('Unknown chest child '+s);return{get textContent(){return entry.label;},set textContent(v){entry.label=String(v);publish();}};},
    getAnimations(){return[{cancel(){self.view.call('cancel_animation',entry.key);}}];},
    animate(frames,options){self.animations.push({key:entry.slot,frames,options});self.view.call('animate_json',entry.key,JSON.stringify({frames,options}));return{cancel(){self.view.call('cancel_animation',entry.key);}};}
   };bridge.bindNativeButton(node,entry.key);bridge.controls.set(entry.key,node);return node;
  });
  this.grid={dataset:{},classList:classes(this.model.gridClasses),get isConnected(){return connected();},querySelectorAll(s){if(s!=='[data-sea-treasure-chest]')throw Error('Unknown chest grid query '+s);return self.cards;},getBoundingClientRect(){const bounds=JSON.parse(self.view.call('bounds_json','grid'));Promise.resolve().then(()=>{if(!self.disposed)self.view.call('end_bounds_batch');});return bounds;}};
  this.note=note;const start={id:this.model.start.key,get isConnected(){return connected()&&!self.model.start.removed;},get disabled(){return self.model.start.disabled;},set disabled(v){self.model.start.disabled=!!v;publish();},get textContent(){return self.model.start.label;},set textContent(v){self.model.start.label=String(v);publish();},remove(){self.model.start.removed=true;publish();},addEventListener(type,fn){if(type!=='click')throw Error('Unknown shuffle event');bridge.listeners.set(start.id,()=>{if(!start.disabled&&start.isConnected)fn({currentTarget:start,target:start});});}};
  this.start=start;bridge.bindNativeButton(start,start.id);bridge.controls.set(start.id,start);this.view.call('apply_json',JSON.stringify(this.model));
 }
 query(s){if(s==='[data-sea-treasure-chest]')return this.cards;if(s==='[data-sea-chest-grid]')return[this.grid];if(s==='[data-sea-chest-stage-note]')return[this.note];if(s==='[data-spectator-chest-shuffle]')return this.start.id==='spectator-chest-shuffle'?[this.start]:[];throw Error('Unknown native chest query '+s);}
 dispose(){this.disposed=true;}
}
exports.NativeSeaChestBridge=NativeSeaChestBridge;
