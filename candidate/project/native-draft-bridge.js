'use strict';
// The source controller owns draft order, random rolls, tier fallback and
// invitation. This maps only its finite markup/control contracts to Godot.
class NativeDraftBridge{
 constructor(application,controls,html,helpers){
  this.application=application;this.surface=application.get('draft_modal');this.controls=controls;this.helpers=helpers;this.nodes=new Map();this.disposed=false;this.pending=false;this.detail=null;
  const {decode,field,asset}=helpers;
  const mode=field(html,/draft-recruitment-shell (draft-mode-\w+)/,'draft mode');
  this.model={kind:'draft',mode,title:field(html,/<h2>([\s\S]*?)<\/h2>/,'draft title'),subtitle:field(html,/<h2>[\s\S]*?<\/h2>\s*<span>([\s\S]*?)<\/span>/,'draft subtitle'),players:[],cells:[],crew:[],cards:[],actions:[],crewHeading:field(html,/<div class="draft-crew-heading">([\s\S]*?)<\/div>/,'crew heading'),heading:decode(html.match(/<div class="draft-recruit-heading">([\s\S]*?)<\/div>/)?.[1]||''),detail:null};
  for(const match of html.matchAll(/<div class="draft-order-player-head"[^>]*>([\s\S]*?)<\/div>/g))this.model.players.push({name:field(match[1],/<strong>([\s\S]*?)<\/strong>/,'player name'),image:asset(field(match[1],/<img src="([^"]+)"/,'player avatar'))});
  for(const match of html.matchAll(/<div class="(draft-order-cell[^" ]*[^\"]*)"[^>]*>\s*<b>([\s\S]*?)<\/b>\s*<span>([\s\S]*?)<\/span>\s*<\/div>/g))this.model.cells.push({number:decode(match[2]),text:decode(match[3]),current:match[1].includes('is-current'),picked:match[1].includes('is-picked')});
  for(const match of html.matchAll(/<div class="draft-crew-slot"[^>]*>([\s\S]*?)<\/div>/g))this.model.crew.push({name:decode(match[1].match(/<strong>([\s\S]*?)<\/strong>/)?.[1]||''),image:asset(match[1].match(/<img class="portrait" src="([^"]+)"/)?.[1]||'')});
  for(const match of html.matchAll(/<button[^>]*data-draft-card-id="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)){
   const id=decode(match[1]),body=match[2],key='draft:'+id;this.node(key).dataset.draftCardId=id;
   this.model.cards.push({key,id,name:field(body,/<strong class="draft-card-name">([\s\S]*?)<\/strong>/,'card name'),image:asset(field(body,/<img class="draft-card-portrait" src="([^"]+)"/,'card image')),grade:field(body,/<span class="draft-card-grade">([\s\S]*?)<\/span>/,'card grade'),meta:field(body,/<span class="draft-card-meta">\s*<span>([\s\S]*?)<\/span>/,'card traits'),passive:field(body,/<span class="draft-card-passive">([\s\S]*?)<\/span>/,'card passive')});
  }
  for(const card of this.model.cards){const escaped=card.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const body=html.match(new RegExp('<button[^>]*data-draft-card-id="'+escaped+'"[^>]*>([\\s\\S]*?)<\\/button>'))?.[1];card.roleImage=asset(field(body,/<img class="draft-card-role" src="([^"]+)"/,'card role icon'));}
  for(const id of ['confirmDraftOrderBtn','recruitRollBtn','setupLoadGameBtn']){const match=html.match(new RegExp('<button([^>]*id="'+id+'"[^>]*)>([\\s\\S]*?)<\\/button>'));if(match){const node=this.node(id);node.textContent=decode(match[2]);node.disabled=/\bdisabled\b/.test(match[1]);this.model.actions.push(id);}}
  if(mode==='draft-mode-wheel'){
   this.surface.call('wheel_motion_json',JSON.stringify({angle:0,duration:0,curve:[0,0,1,1]}));
   this.node('draftDestinyDisc');this.node('draftWheelResult').innerHTML=field(html,/<div class="draft-wheel-result"[^>]*>([\s\S]*?)<\/div>/,'wheel result');
   this.model.tiers=[...html.matchAll(/<span class="draft-wheel-tier"[^>]*>([\s\S]*?)<\/span>/g)].map(m=>decode(m[1]));
   if(this.model.tiers.length!==6)throw Error('Original draft wheel has invalid tiers');
  }
  if(mode==='draft-mode-pick')this.node('draftDetailOverlay');
  if(this.model.players.length<1||this.model.cells.length!==this.model.players.length*3||this.model.crew.length!==3)throw Error('Original draft board structure changed');
  this.model.orderHint=decode(html.match(/<div class="draft-order-copy">([\s\S]*?)<\/div>/)?.[1]||'');this.flush();
 }
 node(id){
  if(this.nodes.has(id))return this.nodes.get(id);const bridge=this;let text='',disabled=false,hidden=id==='draftDetailOverlay',markup='',transition='none';const classes=new Set(),listeners=new Map();
  const node={id,dataset:{},offsetWidth:1,listeners,get isConnected(){return !bridge.disposed;},addEventListener(type,fn){if(type!=='click')throw Error('Unbound draft event '+type);listeners.set(type,fn);},setAttribute(name){if(name!=='disabled')throw Error('Unbound draft attribute '+name);this.disabled=true;},
   get textContent(){return text;},set textContent(value){text=String(value);bridge.flush();},get disabled(){return disabled;},set disabled(value){disabled=!!value;bridge.flush();},
   get hidden(){return hidden;},set hidden(value){hidden=!!value;bridge.flush();},
   get innerHTML(){return markup;},set innerHTML(value){markup=String(value);if(id==='draftDetailOverlay'){bridge.detail=markup?bridge.parseDetail(markup):null;bridge.flush();}else if(id==='draftWheelResult'){text=bridge.helpers.decode(markup);bridge.flush();}else throw Error('Unbound draft innerHTML '+id);},
   classList:{add(...values){values.forEach(v=>classes.add(v));bridge.flush();},remove(...values){values.forEach(v=>classes.delete(v));bridge.flush();},contains:value=>classes.has(value)},
  };
  node.style=new Proxy({}, {set(target,key,value){if(id!=='draftDestinyDisc')throw Error('Unbound draft style '+id);if(key==='transition')transition=String(value);else if(key==='transform'){
   const angle=/^rotate\((-?[\d.]+)deg\)$/.exec(String(value)),timing=/transform ([\d.]+)ms cubic-bezier\(([^)]+)\)/.exec(transition);if(!angle||transition!=='none'&&!timing)throw Error('Original draft wheel motion changed');
   bridge.surface.call('wheel_motion_json',JSON.stringify({angle:Number(angle[1]),duration:timing?Number(timing[1]):0,curve:timing?timing[2].split(',').map(Number):[0,0,1,1]}));
  }else throw Error('Unbound draft style property '+key);target[key]=value;return true;}});
  this.nodes.set(id,node);this.controls.set(id,node);return node;
 }
 parseDetail(html){
  const {decode,field,asset}=this.helpers;
  for(const id of ['draftDetailCloseBtn','draftConfirmPickBtn','draftBoardingStamp','draftStampText']){this.nodes.delete(id);this.controls.delete(id);this.node(id);}
  for(const id of ['draftDetailCloseBtn','draftConfirmPickBtn']){const match=html.match(new RegExp('<button([^>]*id="'+id+'"[^>]*)>([\\s\\S]*?)<\\/button>'));if(!match)throw Error('Original draft detail action missing');this.node(id).textContent=decode(match[2]);this.node(id).disabled=/\bdisabled\b/.test(match[1]);}
  return {name:field(html,/<strong class="draft-detail-name">([\s\S]*?)<\/strong>/,'detail name'),image:asset(field(html,/<img class="draft-detail-portrait" src="([^"]+)"/,'detail portrait')),grade:field(html,/<span class="draft-detail-grade">([\s\S]*?)<\/span>/,'detail tier'),traits:field(html,/<div class="draft-detail-title">([\s\S]*?)<\/div>/,'detail traits'),stats:[...html.matchAll(/<div class="draft-detail-stat">[\s\S]*?<span>([\s\S]*?)<\/span><strong>([\s\S]*?)<\/strong><\/div>/g)].map(m=>({label:decode(m[1]),value:decode(m[2])})),passive:field(html,/<div class="draft-detail-passive"[^>]*>\s*<strong>([\s\S]*?)<\/strong>/,'detail passive'),effect:field(html,/<div class="draft-detail-passive-effect">([\s\S]*?)<\/div>/,'passive effect'),moves:field(html,/<details class="draft-detail-moves"><summary>[^<]*<\/summary>([\s\S]*?)<\/details>/,'detail moves')};
 }
 flush(){if(this.pending||this.disposed)return;this.pending=true;setTimeout(()=>{this.pending=false;if(this.disposed)return;const state={...this.model,controls:[...this.nodes.values()].map(n=>({key:n.id,label:n.textContent,disabled:n.disabled,hidden:n.hidden})),wheelResult:this.nodes.get('draftWheelResult')?.textContent||'',detail:this.nodes.get('draftDetailOverlay')?.hidden?null:this.detail,stamp:this.nodes.get('draftBoardingStamp')?.classList.contains('show')||false};this.application.call('show_draft_modal',JSON.stringify(state));},0);}
 query(selector){if(selector==='[data-draft-card-id]')return [...this.nodes.values()].filter(n=>n.dataset.draftCardId);throw Error('Unbound draft selector '+selector);}
 handle(key){const node=this.nodes.get(key);if(!node)return false;if(!node.disabled&&!node.hidden)node.listeners.get('click')?.({target:node});return true;}
 dispose(){this.disposed=true;}
}
exports.NativeDraftBridge=NativeDraftBridge;
