'use strict';
exports.project=function(html,bridge,{decode,field,asset}){
 if(!html.includes('class="mission-journal-ui"'))return null;
 const optional=(body,pattern)=>decode(body.match(pattern)?.[1]||''),section=name=>field(html,new RegExp('<div class="'+name+'"[^>]*>([\\s\\S]*?)</div>'),name);
 const rawSection=name=>{const match=html.match(new RegExp('<div class="'+name+'"[^>]*>([\\s\\S]*?)</div>'));if(!match)throw Error('Original journal section missing '+name);return match[1];};
 const register=(key,dataset,label,disabled)=>{if(bridge)bridge.control(key,dataset,label).disabled=disabled;return {key,label,disabled};};
 const entries=[...html.matchAll(/<button([^>]*data-journal-select="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{
  const id=decode(m[2]),body=m[3],key='journal-select:'+id;
  register(key,{journalSelect:id},'',false);
  return {key,id,selected:m[1].includes('is-selected'),main:m[1].includes('is-main'),image:asset(field(body,/<img class="mission-journal-grade-image[^>]+src="([^"]+)"/,'journal row rank')),title:field(body,/<strong>([\s\S]*?)<\/strong>/,'journal row title'),subtitle:field(body,/<small>([\s\S]*?)<\/small>/,'journal row subtitle'),status:field(body,/<span class="mission-journal-row-status">([\s\S]*?)<\/span>/,'journal row status')};
 });
 const rank=rawSection('mission-journal-rank'),title=rawSection('mission-journal-detail-title'),condition=rawSection('mission-journal-detail-copy'),reward=rawSection('mission-journal-reward'),progress=html.match(/<div class="mission-journal-progress">([\s\S]*?)<div class="mission-journal-reward">/)?.[1];if(!progress)throw Error('Original journal progress missing');
 const detail={image:asset(optional(rank,/<img[^>]+src="([^"]+)"/)),title:field(title,/<strong>([\s\S]*?)<\/strong>/,'journal detail title'),subtitle:field(title,/<span>([\s\S]*?)<\/span>/,'journal detail subtitle'),conditionTitle:optional(condition,/<strong>([\s\S]*?)<\/strong>/),condition:field(condition,/<span[^>]*>([\s\S]*?)<\/span>/,'journal condition'),progressLabel:field(progress,/<span>([\s\S]*?)<\/span>/,'journal progress label'),progress:field(progress,/<strong>([\s\S]*?)<\/strong>/,'journal progress'),progressPercent:Number(field(progress,/--mission-progress:([\d.]+)%/,'journal progress percent')),rewardTitle:field(reward,/<strong>([\s\S]*?)<\/strong>/,'journal reward title'),reward:field(reward,/<span>([\s\S]*?)<\/span>/,'journal reward'),note:optional(reward,/<small>([\s\S]*?)<\/small>/)};
 const actions=['primary','secondary'].map(kind=>{
  const body=rawSection('mission-journal-'+kind+'-action'),button=body.match(/<button([^>]*)>([\s\S]*?)<\/button>/);if(!button)throw Error('Original journal action missing');
  const attr=button[1].match(/data-journal-(main-claim|claim|abandon)="([^"]+)"/),disabled=/\bdisabled\b/.test(button[1]),label=decode(button[2]);
  if(!attr){if(!disabled)throw Error('Unknown enabled journal action');return{key:'journal-'+kind+'-disabled',label,disabled:true};}
  const name='journal'+attr[1].split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(''),id=decode(attr[2]);return register('journal-'+attr[1]+':'+id,{[name]:id},label,disabled);
 });
 actions.push(register('journalCloseMissionBtn',{},field(html,/<button[^>]*id="journalCloseMissionBtn"[^>]*>([\s\S]*?)<\/button>/,'journal close'),false));
 return {kind:'mission-journal',title:field(html,/<h3>([\s\S]*?)<\/h3>/,'journal title'),subtitle:field(html,/<header[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/,'journal subtitle'),entries,empty:entries.length?'':section('mission-journal-empty-list'),detail,actions};
};
