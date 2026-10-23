'use strict';
const css=require('./native-css-escape');
class NativeCpuStrategyBridge{
 constructor(bridge,html,{decode,field,asset}){
  this.bridge=bridge;this.disposed=false;this.queued=false;this.selects=new Map();this.descriptions=new Map();this.model={kind:'cpu-strategy',title:field(html,/<h3 class="cpu-strategy-ui-title">([\s\S]*?)<\/h3>/,'CPU title'),subtitle:field(html,/<div class="cpu-strategy-ui-subtitle">([\s\S]*?)<\/div>/,'CPU subtitle'),note:field(html,/<div class="cpu-strategy-sync-note">([\s\S]*?)<\/div>/,'CPU note'),frame:asset(field(html,/<img class="cpu-strategy-panel-frame" src="([^"]+)"/,'CPU frame')),close:field(html,/<button[^>]*id="closeCpuStrategyBtn"[^>]*>([\s\S]*?)<\/button>/,'CPU close'),rows:[]};
  for(const match of html.matchAll(/<article class="cpu-strategy-row">([\s\S]*?)<\/article>/g)){
   const body=match[1],select=body.match(/<select([^>]+)>([\s\S]*?)<\/select>/);if(!select)throw Error('Original CPU select missing');
   const id=field(select[1],/data-cpu-strategy-player="([^"]+)"/,'CPU player');
   if(this.selects.has(id))throw Error('Duplicate original CPU id');
   const options=[...select[2].matchAll(/<option value="([^"]+)">([\s\S]*?)<\/option>/g)].map(m=>({value:decode(m[1]),label:decode(m[2])}));if(!options.length)throw Error('Original CPU strategies missing');
   const row={id,name:field(body,/<strong class="cpu-strategy-name">([\s\S]*?)<\/strong>/,'CPU name'),description:field(body,/<p class="cpu-strategy-desc"[^>]*>([\s\S]*?)<\/p>/,'CPU description'),portrait:asset(field(body,/<span class="cpu-strategy-avatar">\s*<img src="([^"]+)"/,'CPU portrait')),frame:asset(field(body,/<img class="cpu-strategy-row-frame" src="([^"]+)"/,'CPU row')),status:field(body,/<span class="cpu-strategy-row-status">([\s\S]*?)<\/span>/,'CPU role'),caption:field(body,/<label class="cpu-strategy-choice">\s*<span>([\s\S]*?)<\/span>/,'CPU caption'),disabled:/\bdisabled\b/.test(select[1]),options,value:options[0].value};
   let listener=null;const owner=this,node={dataset:{cpuStrategyPlayer:id},get value(){return row.value;},set value(value){value=String(value);if(!options.some(o=>o.value===value))throw Error('Unknown original CPU strategy '+value);row.value=value;owner.queue();},disabled:row.disabled,addEventListener(type,fn){if(type!=='change')throw Error('CPU control event unsupported');listener=fn;},dispatch(){if(row.disabled||owner.disposed)return false;if(!listener)throw Error('CPU source change not bound');listener({target:node});return true;}};
   this.selects.set(id,node);this.descriptions.set(id,{get textContent(){return row.description;},set textContent(value){row.description=String(value);owner.queue();}});this.model.rows.push(row);
  }
  if(!this.model.rows.length)throw Error('CPU page without original rows');bridge.control('closeCpuStrategyBtn');this.queue();
 }
 queue(){if(this.queued||this.disposed)return;this.queued=true;setTimeout(()=>{this.queued=false;if(!this.disposed)this.bridge.application.call('show_cpu_strategy_modal',JSON.stringify(this.model));},0);}
 query(selector){if(selector==='[data-cpu-strategy-player]')return [...this.selects.values()];for(const [id,node]of this.descriptions)if(selector==='[data-cpu-strategy-desc="'+css.escape(id)+'"]')return [node];throw Error('Unknown CPU selector '+selector);}
 handle(key){if(!key.startsWith('cpu-change:'))return false;const command=JSON.parse(key.slice(11)),node=this.selects.get(String(command.playerId));if(!node)throw Error('Unknown CPU control player');if(node.disabled)return true;node.value=command.value;node.dispatch();return true;}
 dispose(){this.disposed=true;}
}
exports.NativeCpuStrategyBridge=NativeCpuStrategyBridge;
