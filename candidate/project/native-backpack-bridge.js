'use strict';
// Original bindBackpackModal owns category changes, selection and item actions.
// This bounded bridge only retains its controls and renders their current text.
exports.icon=function(html,decode=s=>s){
 const rawDecode=decode;decode=s=>rawDecode(s).split("?")[0];
 const image=cls=>decode(html.match(new RegExp('<img[^>]*class="'+cls+'"[^>]*?\\ssrc="([^"]+)"'))?.[1]||''),fallback=decode(html.match(/<span class="item-thumb-fallback"><img src="([^"]+)"/)?.[1]||'');
 if(html.includes('postgame-clue-icon'))return{kind:'clue',image:image('postgame-clue-icon-frame'),portrait:image('postgame-clue-island'),fallback,rank:decode(html.match(/class="postgame-clue-card-rank corner-top[^>]*>([^<]*)/)?.[1]||'')};
 if(html.includes('lineage-factor-icon'))return{kind:'factor',image:image('lineage-factor-icon-frame'),portrait:image('lineage-factor-portrait'),fallback,rank:''};
 return{kind:'item',image:decode(html.match(/<img[^>]*?\ssrc="([^"]+)"/)?.[1]||''),portrait:'',fallback,rank:''};
};
class NativeBackpackBridge{
 constructor(bridge,html,{decode,field,asset}){
  this.bridge=bridge;this.disposed=false;this.queued=false;this.rows=[];this.buttons=[];this.helpers={decode,field,asset};
  if(html.includes('class="backpack-bag-art"'))throw Error('Original bag animation markup changed; integrate its actual artwork');
  const m=this.model={kind:'backpack',title:field(html,/<h3 class="modal-title">([\s\S]*?)<\/h3>/,'backpack title'),owner:field(html,/<div class="backpack-owner-line">([\s\S]*?)<\/div>/,'backpack owner'),categories:[],active:'',entries:[],empty:'',preview:{name:'沒有道具',tier:'背包',meta:'這個分類目前沒有道具。',icon:{}},action:{key:'backpackPreviewAction',label:'',hidden:true,disabled:false},close:{key:'closeItemModalBtn',label:field(html,/<button[^>]*id="closeItemModalBtn"[^>]*>([\s\S]*?)<\/button>/,'backpack close')},contentVisible:false};
  const classes=(allowed,change)=>{const set=new Set();const changeOne=(k,on)=>{if(!allowed.includes(k))throw Error('Unsupported backpack class '+k);if(on)set.add(k);else set.delete(k);change(k,on);};return{contains:k=>set.has(k),add:(...ks)=>ks.forEach(k=>changeOne(k,true)),remove:(...ks)=>ks.forEach(k=>changeOne(k,false)),toggle:(k,on)=>{on=on===undefined?!set.has(k):!!on;changeOne(k,on);return on;}};};
  const node=(id,dataset={})=>{const n={id,dataset,addEventListener:(type,fn)=>{if(type!=='click')throw Error('Unsupported backpack event');bridge.listeners.set(id,fn);}};bridge.controls.set(id,n);return n;};
  for(const match of html.matchAll(/<button[^>]*data-backpack-pocket="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)){
   const id=decode(match[1]),category={id,key:'backpack-pocket:'+id,label:field(match[2],/<span>([\s\S]*?)<\/span>/,'pocket title'),count:field(match[2],/<small>([\s\S]*?)<\/small>/,'pocket count'),selected:false},button=node(category.key,{backpackPocket:id});button.classList=classes(['is-active'],(_,on)=>{category.selected=on;this.queue();});m.categories.push(category);this.buttons.push(button);
  }
  const current=node('backpackPocketCurrent');Object.defineProperty(current.dataset,'backpackTab',{get:()=>m.active,set:v=>{m.active=String(v);this.queue();}});
  for(const [id,key]of [['backpackPreviewName','name'],['backpackPreviewTier','tier'],['backpackPreviewMeta','meta']]){const n=node(id);Object.defineProperty(n,'textContent',{get:()=>m.preview[key],set:v=>{m.preview[key]=String(v);this.queue();}});n.classList=classes(['lineage-factor-preview'],()=>{});}
  const badge=node('backpackPreviewBadge');badge.classList=classes(['is-revealing','is-waiting-reveal'],(k,on)=>{if(k==='is-waiting-reveal'){m.contentVisible=!on;this.queue();}});Object.defineProperty(badge,'innerHTML',{set:v=>{m.preview.icon=exports.icon(String(v),decode);this.queue();}});
  this.listPanel={classList:classes(['is-revealing','is-waiting-reveal'],()=>{})};
  const action=node('backpackPreviewAction');for(const [prop,key]of [['textContent','label'],['hidden','hidden'],['disabled','disabled']])Object.defineProperty(action,prop,{get:()=>m.action[key],set:v=>{m.action[key]=prop==='textContent'?String(v):!!v;this.queue();}});
  const list=node('backpackList');list.querySelectorAll=s=>{if(s!=='.backpack-item-row')throw Error('Unknown backpack list selector '+s);return this.rows;};let listHtml='';Object.defineProperty(list,'innerHTML',{get:()=>listHtml,set:v=>{
   listHtml=String(v);for(const row of this.rows){bridge.controls.delete(row.id);bridge.listeners.delete(row.id);}this.rows=[];m.entries=[];
   m.empty=decode(listHtml.match(/<div class="backpack-empty-row">([\s\S]*?)<\/div>/)?.[1]||'');
   for(const match of listHtml.matchAll(/<button([^>]*class="backpack-item-row[^>]*?)>([\s\S]*?)<\/button>/g)){
    const dataset={};for(const a of match[1].matchAll(/data-([\w-]+)="([^"]*)"/g))dataset[a[1].split('-').map((s,i)=>i?s[0].toUpperCase()+s.slice(1):s).join('')]=decode(a[2]);
    const key='backpack-row:'+m.entries.length,entry={key,name:dataset.backpackName,tier:dataset.backpackTier,count:dataset.backpackCount,icon:exports.icon(match[2].slice(match[2].indexOf('<span class="backpack-row-thumb')),decode),selected:false},row=node(key,dataset);
    row.classList=classes(['is-selected'],(_,on)=>{entry.selected=on;this.queue();});row.scrollIntoView=()=>{this.scrollTarget=key;this.queue();};m.entries.push(entry);this.rows.push(row);
   }this.queue();
  }});node('closeItemModalBtn');this.queue();
 }
 query(selector){if(selector==='[data-backpack-pocket]')return this.buttons;if(selector==='.backpack-list-panel')return[this.listPanel];if(selector==='.backpack-bag-art')return[];throw Error('Unknown backpack selector '+selector);}
 queue(){if(this.disposed||this.queued)return;this.queued=true;setTimeout(()=>{this.queued=false;if(this.disposed)return;this.bridge.application.call('show_backpack_modal',JSON.stringify(this.model));if(this.scrollTarget){this.bridge.application.get('backpack_modal').call('scroll_to_key',this.scrollTarget);this.scrollTarget='';}},0);}
 dispose(){this.disposed=true;}
}
exports.NativeBackpackBridge=NativeBackpackBridge;
