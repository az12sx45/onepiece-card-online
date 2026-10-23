'use strict';
exports.project=function(html,bridge,{decode,field,asset}){
 if(!html.includes('class="mission-shell"'))return null;
 const readonly=html.includes('id="spectatorModalCloseBtn"');
 if(readonly){let index=0;html=html.replace(/<button([^>]*class="mission-card[^>]*)(>)/g,(_,attrs,end)=>'<button'+attrs+' data-mission-select="spectator-'+index+++'"'+end).replace(/(<button[^>]*class="refresh-btn")/,'$1 id="refreshMissionBoardBtn"');
 html=html.replace(/<button([^>]*class="accept-btn[^>]*\bdisabled\b[^>]*)(>)/g,(_,attrs,end)=>'<button'+attrs+' id="mission-spectator-disabled-'+index+++'"'+end);}

 const optional=(body,re)=>decode(body.match(re)?.[1]||''),register=(key,dataset,label,disabled)=>{
  if(bridge){const control=bridge.control(key,dataset,label);control.disabled=disabled;const add=control.addEventListener;control.addEventListener=(type,handler)=>add(type,()=>handler({currentTarget:control}));}
  return {key,label,disabled};
 };
 const entries=[...html.matchAll(/<button([^>]*data-mission-select="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{
  const id=decode(m[2]),body=m[3],key='mission-select:'+id;register(key,{missionSelect:id},'',readonly);
  const tags=body.match(/<div class="mission-tags">([\s\S]*?)<\/div>/)?.[1]||'',rewards=body.match(/<div class="reward">([\s\S]*?)<\/div>/)?.[1]||'';
  return {id,key,...(readonly?{disabled:true}:{}),selected:/\bselected\b/.test(m[1]),image:asset(field(body,/<img[^>]+src="([^"]+)"/,'mission card grade')),title:field(body,/<h3>([\s\S]*?)<\/h3>/,'mission card title'),tags:[...tags.matchAll(/<span class="tag[^>]*>([\s\S]*?)<\/span>/g)].map(n=>decode(n[1])),condition:field(body,/<div class="condition">([\s\S]*?)<\/div>/,'mission card condition'),rewards:[...rewards.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/g)].map(n=>decode(n[1])),stamps:[...body.matchAll(/<span class="mission-stamp[^>]*>([\s\S]*?)<\/span>/g)].map(n=>decode(n[1]))};
 });
 const detail=html.match(/<aside class="panel detail-panel">([\s\S]*?)<\/aside>/)?.[1];if(!detail)throw Error('Original mission detail missing');
 const actions=[...detail.matchAll(/<button([^>]*id="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{const dataset={};for(const a of m[1].matchAll(/data-([\w-]+)="([^"]+)"/g))dataset[a[1].split('-').map((s,i)=>i?s[0].toUpperCase()+s.slice(1):s).join('')]=decode(a[2]);return register(m[2],dataset,decode(m[3]),/\bdisabled\b/.test(m[1]));});
 const refresh=html.match(/<button([^>]*id="refreshMissionBoardBtn"[^>]*)>([\s\S]*?)<\/button>/);if(!refresh)throw Error('Original mission refresh missing');
 const wallet=html.match(/<div class="wallet">([\s\S]*?)<\/div>/)?.[1]||'';
 return {kind:'mission-board',title:field(html,/<h1>([\s\S]*?)<\/h1>/,'mission wall title'),wallet:[...wallet.matchAll(/<(?:span|strong)>([\s\S]*?)<\/(?:span|strong)>/g)].map(m=>decode(m[1])),tier:field(html,/<span class="tier-pill">([\s\S]*?)<\/span>/,'mission tier'),refresh:register('refreshMissionBoardBtn',{},decode(refresh[2]),/\bdisabled\b/.test(refresh[1])),broker:{open:asset(field(html,/<img class="morgans-img morgans-open" src="([^"]+)"/,'mission broker')),blink:asset(field(html,/<img class="morgans-img morgans-blink" src="([^"]+)"/,'mission broker blink')),guidance:field(html,/<span class="mission-mainline-guidance">([\s\S]*?)<\/span>/,'mission guidance')},entries,empty:entries.length?'':optional(html,/<div class="mission-wall">\s*<div class="empty-note">([\s\S]*?)<\/div>/),detail:{title:field(detail,/<h2>([\s\S]*?)<\/h2>/,'mission detail title'),image:asset(optional(detail,/<img class="detail-grade-mark[^>]+src="([^"]+)"/)),tags:[...detail.matchAll(/<span class="chip[^>]*>([\s\S]*?)<\/span>/g)].map(m=>decode(m[1])),condition:optional(detail,/<div class="detail-block">([\s\S]*?)<\/div>/),shared:optional(detail,/<div class="compact-note detail-shared-note">([\s\S]*?)<\/div>/),rewards:[...detail.matchAll(/<div class="reward-line"><span>([\s\S]*?)<\/span><strong>([\s\S]*?)<\/strong><\/div>/g)].map(m=>({label:decode(m[1]),value:decode(m[2])})),empty:optional(detail,/<div class="empty-note">([\s\S]*?)<\/div>/)},actions};
};
