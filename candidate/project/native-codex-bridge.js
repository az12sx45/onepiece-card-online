'use strict';
class NativeCodexBridge{
 constructor(bridge,html,{decode,field,asset}){
  this.bridge=bridge;this.disposed=false;this.queued=false;this.rows=[];
  const optional=(body,pattern)=>decode(body.match(pattern)?.[1]||''),picture=(body,pattern)=>asset(optional(body,pattern));
  const model=this.model={kind:'codex',title:field(html,/<h3>([\s\S]*?)<\/h3>/,'codex title'),subtitle:field(html,/<header[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/,'codex subtitle'),kpis:[],entries:[],detail:{},actions:[]};
  const kpis=html.match(/<div class="defeated-codex-kpis"[^>]*>([\s\S]*?)<\/div>\s*<div class="defeated-codex-list"/)?.[1];if(!kpis)throw Error('Original codex KPIs missing');
  model.kpis=[...kpis.matchAll(/<div>([\s\S]*?)<\/div>/g)].map(m=>({icon:picture(m[1],/<img src="([^"]+)"/),label:field(m[1],/<span>([\s\S]*?)<\/span>/,'codex KPI label'),value:field(m[1],/<strong>([\s\S]*?)<\/strong>/,'codex KPI value')}));
  for(const m of html.matchAll(/<button([^>]*data-codex-index="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)){
   const body=m[3],index=m[2],art=body.match(/<span class="defeated-codex-row-art">([\s\S]*?)<\/span>/)?.[1]||'',entry={key:'codex:'+index,index,selected:m[1].includes('is-selected'),locked:m[1].includes('is-locked'),image:picture(art,/<img src="([^"]+)"/),fallback:picture(art,/data-fallback-src="([^"]+)"/),name:field(body,/<span class="defeated-codex-row-copy">\s*<strong>([\s\S]*?)<\/strong>/,'codex name'),location:field(body,/<span class="defeated-codex-row-copy">[\s\S]*?<small>([\s\S]*?)<\/small>/,'codex location'),status:field(body,/<span class="defeated-codex-row-status"><strong>([\s\S]*?)<\/strong>/,'codex status'),statusLabel:field(body,/<span class="defeated-codex-row-status">[\s\S]*?<small>([\s\S]*?)<\/small>/,'codex status label')};
   const control=bridge.control(entry.key,{codexIndex:index});control.classList={toggle:(name,on)=>{if(name!=='is-selected')throw Error('Unknown codex row class');entry.selected=!!on;this.queue();}};this.rows.push(control);model.entries.push(entry);
  }
  let detailHtml='';const detail={id:'defeatedCodexDetail'};Object.defineProperty(detail,'innerHTML',{get:()=>detailHtml,set:value=>{
   detailHtml=String(value);const art=detailHtml.match(/<div class="defeated-codex-detail-art([^\"]*)">([\s\S]*?)<\/div>/),tier=detailHtml.match(/<div class="defeated-codex-detail-tier">([\s\S]*?)<\/div>/)?.[1]||'';
   if(!art){model.detail={empty:field(detailHtml,/<strong>([\s\S]*?)<\/strong>/,'codex empty title'),message:field(detailHtml,/<span>([\s\S]*?)<\/span>/,'codex empty text')};this.queue();return;}
   const stats=detailHtml.match(/<div class="defeated-codex-stat-list">([\s\S]*?)<\/div>\s*<div class="defeated-codex-last-place">/)?.[1];if(!stats)throw Error('Original codex detail stats missing');
   model.detail={locked:art[1].includes('is-locked'),image:picture(art[2],/<img src="([^"]+)"/),fallback:picture(art[2],/data-fallback-src="([^"]+)"/),name:field(detailHtml,/<div class="defeated-codex-detail-title">\s*<strong>([\s\S]*?)<\/strong>/,'codex detail name'),summary:field(detailHtml,/<div class="defeated-codex-detail-title">[\s\S]*?<span>([\s\S]*?)<\/span>/,'codex summary'),rank:picture(tier,/<img[^>]+src="([^"]+)"/),rankLabel:optional(tier,/<img[^>]+alt="([^"]+)"/)||decode(tier),stats:[...stats.matchAll(/<div><span>([\s\S]*?)<\/span><strong>([\s\S]*?)<\/strong><\/div>/g)].map(m=>({label:decode(m[1]),value:decode(m[2])})),source:field(detailHtml,/<div class="defeated-codex-last-place">\s*<strong>([\s\S]*?)<\/strong>/,'codex source'),location:field(detailHtml,/<div class="defeated-codex-last-place">[\s\S]*?<span>([\s\S]*?)<\/span>/,'codex region')};if(model.detail.stats.length!==4)throw Error('Original codex stats changed');this.queue();
  }});bridge.controls.set(detail.id,detail);
  for(const m of html.matchAll(/<button[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)){const key=m[1],label=decode(m[2]);bridge.control(key,{},label);model.actions.push({key,label,disabled:false});}
  this.queue();
 }
 query(selector){if(selector==='[data-codex-index]')return this.rows;throw Error('Unknown codex selector '+selector);}
 queue(){if(this.queued||this.disposed)return;this.queued=true;setTimeout(()=>{this.queued=false;if(!this.disposed)this.bridge.application.call('show_codex_modal',JSON.stringify(this.model));},0);}
 dispose(){this.disposed=true;}
}
exports.NativeCodexBridge=NativeCodexBridge;
