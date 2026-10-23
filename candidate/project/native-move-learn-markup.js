'use strict';
// Project source text and retain the original selection/confirm closures.
exports.project=function(html,bridge,{decode,field,asset}){
 if(!html.includes('class="move-learn-ui"'))return null;
 const text=(pattern,label)=>field(html,pattern,label);
 const actions=['confirmMoveLearnBtn','skipMoveLearnBtn'].map(key=>{const m=html.match(new RegExp('<button([^>]*id="'+key+'"[^>]*)>([\\s\\S]*?)<\\/button>'));if(!m)throw Error('Move learning action absent '+key);const label=decode(m[2]),disabled=/\bdisabled\b/.test(m[1]);bridge.control(key,{},label).disabled=disabled;return {key,label,disabled};});
 const hintTitle=text(/id="moveLearnSelectionTitle">([\s\S]*?)<\/strong>/,'move selection title'),hint=text(/id="moveLearnSelectionText">([\s\S]*?)<\/span>/,'move selection text');bridge.control('moveLearnSelectionTitle',{},hintTitle);bridge.control('moveLearnSelectionText',{},hint);
 const entries=[...html.matchAll(/<button([^>]*data-forget-move-id="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{
  const id=decode(m[2]),key='forget:'+id,c=bridge.control(key,{forgetMoveId:id});let selected=/aria-checked="true"/.test(m[1]);
  c.classList={toggle(name,value){if(name!=='is-selected')throw Error('Unknown move learn class '+name);selected=!!value;bridge.application.get('move_learn_modal').call('set_selected',key,selected);}};
  c.setAttribute=(name,value)=>{if(name!=='aria-checked'||String(selected)!==String(value))throw Error('Move selection accessibility state differs');};
  return {key,selected,image:asset(field(m[3],/<img\b[^>]*?\bsrc="([^"]+)"/,'move type icon')),name:field(m[3],/<strong>([\s\S]*?)<\/strong>/,'current move name'),description:field(m[3],/<small>([\s\S]*?)<\/small>/,'current move effect'),pp:field(m[3],/meta-pp">[\s\S]*?<b>([\s\S]*?)<\/b>/,'move pp'),power:field(m[3],/meta-power">[\s\S]*?<b>([\s\S]*?)<\/b>/,'move power')};
 });
 if(entries.length!==4)throw Error('Original move replacement list changed');
 return {kind:'move-learn',title:text(/<h3>([\s\S]*?)<\/h3>/,'move title'),subtitle:text(/<header[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/,'move subtitle'),image:asset(text(/<div class="move-learn-portrait-stage">\s*<img src="([^"]+)"/,'move portrait')),name:text(/<div class="move-learn-character-caption">\s*<strong>([\s\S]*?)<\/strong>/,'move character'),meta:text(/<div class="move-learn-character-caption">[\s\S]*?<span>([\s\S]*?)<\/span>/,'move character meta'),newName:text(/class="move-learn-new-name">([\s\S]*?)<\/strong>/,'new move name'),type:text(/class="move-learn-new-type-value"><b>([\s\S]*?)<\/b>/,'new move type'),level:text(/stat-level">[\s\S]*?<b>([\s\S]*?)<\/b>/,'new move level'),pp:text(/stat-pp">[\s\S]*?<b>([\s\S]*?)<\/b>/,'new move pp'),power:text(/stat-power">[\s\S]*?<b>([\s\S]*?)<\/b>/,'new move power'),effect:text(/class="move-learn-new-effect">[\s\S]*?<p>([\s\S]*?)<\/p>/,'new move effect'),hintTitle,hint,entries,actions};
};
