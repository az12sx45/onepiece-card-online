'use strict';
class NativeFleetBridge{
 constructor(bridge,html,{decode,field,asset}){
  this.bridge=bridge;this.disposed=false;this.queued=false;this.decode=decode;this.field=field;this.asset=asset;
  this.model={kind:'fleet',title:field(html,/<h3>([\s\S]*?)<\/h3>/,'fleet title'),subtitle:field(html,/<header[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/,'fleet subtitle'),kpis:[],entries:[],detail:{icon:'',title:'',count:'',inherent:'',current:'',stages:[]},actions:[]};
  const kpis=html.match(/<div class="fleet-info-kpis"[^>]*>([\s\S]*?)<\/div>\s*<nav/);if(!kpis)throw Error('Original fleet KPIs missing');
  for(const m of kpis[1].matchAll(/<div>([\s\S]*?)<\/div>/g))this.model.kpis.push({icon:asset(field(m[1],/<img src="([^"]+)"/,'fleet KPI icon')),label:field(m[1],/<span>([\s\S]*?)<\/span>/,'fleet KPI label'),value:field(m[1],/<strong>([\s\S]*?)<\/strong>/,'fleet KPI value')});
  this.roles=[];
  for(const m of html.matchAll(/<button([^>]*data-fleet-role="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)){
   const id=decode(m[2]),entry={key:'fleet-role:'+id,id,icon:asset(field(m[3],/<img src="([^"]+)"/,'fleet role icon')),title:field(m[3],/<strong>([\s\S]*?)<\/strong>/,'fleet role title'),count:field(m[3],/<small>([\s\S]*?)<\/small>/,'fleet role count'),status:field(m[3],/<em>([\s\S]*?)<\/em>/,'fleet role status'),selected:m[1].includes('is-selected')};
   const control=bridge.control(entry.key,{fleetRole:id});control.classList={toggle:(name,enabled)=>{if(name!=='is-selected')throw Error('Unknown fleet role class');entry.selected=!!enabled;this.queue();}};this.roles.push(control);this.model.entries.push(entry);
  }
  if(this.model.kpis.length!==4||this.model.entries.length!==4)throw Error('Original fleet navigation count changed');
  for(const [id,key]of Object.entries({fleetRoleDetailTitle:'title',fleetRoleDetailCount:'count',fleetRoleInherent:'inherent',fleetRoleCurrentSummary:'current'}))this.valueNode(id,'textContent',value=>{this.model.detail[key]=String(value);});
  this.valueNode('fleetRoleDetailIcon','src',value=>{this.model.detail.icon=asset(value);});
  this.valueNode('fleetRoleStages','innerHTML',value=>{this.model.detail.stages=[...String(value).matchAll(/<article class="fleet-role-stage([^\"]*)">([\s\S]*?)<\/article>/g)].map(m=>({title:field(m[2],/<b>([\s\S]*?)<\/b>/,'fleet stage title'),text:field(m[2],/<span>([\s\S]*?)<\/span>/,'fleet stage text'),status:field(m[2],/<em>([\s\S]*?)<\/em>/,'fleet stage state'),active:m[1].includes('is-active')}));if(this.model.detail.stages.length!==3)throw Error('Original fleet stages changed');});
  for(const m of html.matchAll(/<button[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)){const key=m[1],label=decode(m[2]);bridge.control(key,{},label);this.model.actions.push({key,label,disabled:false});}
  this.queue();
 }
 valueNode(id,property,update){let value='';const node={id,alt:''};Object.defineProperty(node,property,{get:()=>value,set:next=>{value=next;update(next);this.queue();}});this.bridge.controls.set(id,node);}
 query(selector){if(selector==='[data-fleet-role]')return this.roles;throw Error('Unknown fleet selector '+selector);}
 queue(){if(this.queued||this.disposed)return;this.queued=true;setTimeout(()=>{this.queued=false;if(!this.disposed)this.bridge.application.call('show_fleet_modal',JSON.stringify(this.model));},0);}
 dispose(){this.disposed=true;}
}
exports.NativeFleetBridge=NativeFleetBridge;
