'use strict';
// Read the source-rendered copy and actions. Gameplay stays in its original
// listener closures; this projection owns neither captain nor equipment rules.
exports.project=function(html,bridge,{decode,field,asset}){
 const roster=html.includes('class="crew-roster-ui"'),detail=html.includes('class="crew-detail-ui"');
 if(!roster&&!detail)return null;
 const plain=value=>decode(value.replace(/<br\s*\/?>/g,'\n').replace(/\s*\n\s*/g,'\n'));
 const actions=[...html.matchAll(/<button\b([^>]*\bid="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(match=>{
  const key=match[2],label=decode(match[3]),disabled=/\bdisabled\b/.test(match[1]);bridge.control(key,{},label).disabled=disabled;return {key,label,disabled};
 });
 const model={kind:roster?'crew-roster':'crew-detail',title:field(html,/<h3>([\s\S]*?)<\/h3>/,'crew title'),subtitle:field(html,/<header[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/,'crew subtitle'),actions};
 if(roster){
  model.entries=[...html.matchAll(/<article class="crew-manage-card([^\"]*)">([\s\S]*?)<\/article>/g)].map(match=>{
   const body=match[2],index=field(body,/data-crew-toggle="([^"]+)"/,'crew index'),key='crew:'+index;bridge.control(key,{crewToggle:index});
   return {key,active:match[1].includes('is-active'),down:match[1].includes('is-down'),image:asset(field(body,/<span class="crew-manage-avatar">\s*<img src="([^"]+)"/,'crew portrait')),name:field(body,/<span class="crew-manage-name">([\s\S]*?)<\/span>/,'crew name'),level:field(body,/<span class="crew-manage-levelline"><span>([^<]+)/,'crew level'),attribute:field(body,/<span class="attribute-pill[^>]*>([\s\S]*?)<\/span>/,'crew attribute'),hp:{text:field(body,/class="crew-manage-hp-text">([^<]+)/,'crew HP'),value:Number(field(body,/--hp-pct:([\d.]+)%/,'crew HP percent'))},exp:{text:field(body,/class="crew-manage-exp-text">([^<]+)/,'crew EXP'),value:Number(field(body,/--exp-pct:([\d.]+)%/,'crew EXP percent'))}};
  });
 }else{
  model.image=asset(field(html,/<div class="crew-detail-character-stage">\s*<img src="([^"]+)"/,'crew detail portrait'));
  model.form=plain(html.match(/<div class="crew-detail-form-line">([\s\S]*?)<\/div>/)?.[1]||'');
  model.sections=[...html.matchAll(/<article class="crew-detail-section">([\s\S]*?)<\/article>/g)].map(match=>({title:field(match[1],/<h4>([\s\S]*?)<\/h4>/,'crew section title'),text:plain(match[1].match(/<p>([\s\S]*?)<\/p>/)?.[1]||'')}));
  if(model.sections.length!==2)throw Error('Original crew detail section count changed');
 }
 return model;
};
