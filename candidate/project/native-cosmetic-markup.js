'use strict';
exports.project=function(html,bridge,{decode,field,asset}){
 if(!html.includes('class="cosmetic-frame-ui"'))return null;
 const actions=['confirmCrewCosmeticFrameBtn','backCrewCosmeticFrameBtn'].map(key=>{const m=html.match(new RegExp('<button([^>]*id="'+key+'"[^>]*)>([\\s\\S]*?)<\\/button>'));if(!m)throw Error('Cosmetic action absent '+key);const label=decode(m[2]),disabled=/\bdisabled\b/.test(m[1]);bridge.control(key,{},label).disabled=disabled;return {key,label,disabled};});
 const entries=[...html.matchAll(/<button([^>]*data-preview-cosmetic-frame="([^"]*)"[^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{const id=decode(m[2]),key='cosmetic:'+id;bridge.control(key,{previewCosmeticFrame:id});return {key,id,selected:/aria-selected="true"/.test(m[1]),current:m[1].includes('is-current'),name:field(m[3],/<strong>([\s\S]*?)<\/strong>/,'frame name'),description:field(m[3],/<small>([\s\S]*?)<\/small>/,'frame unlock'),label:decode(m[3].match(/<em>([\s\S]*?)<\/em>/)?.[1]||'')};});
 const layers=[...html.matchAll(/<img\s+class="cosmetic-frame-preview-layer([^\"]*)"([\s\S]*?)>/g)].map((m,index)=>{
  const style=field(m[2],/style="([^"]+)"/,'frame layer style'),values=Object.fromEntries(style.split(';').filter(Boolean).map(pair=>{const at=pair.indexOf(':');return [pair.slice(0,at),pair.slice(at+1)];}));
  const n=(key,fallback)=>values[key]===undefined?fallback:Number.parseFloat(values[key]);const blend=values['mix-blend-mode']||'normal';if(!['normal','screen','multiply'].includes(blend))throw Error('Unsupported original frame blend '+blend);
  return {image:asset(field(m[2],/src="([^"]+)"/,'frame layer asset')),index,x:n('left',50),y:n('top',50),w:n('width',100),h:n('height',100),opacity:n('opacity',1),z:n('z-index',5),blend,rotate:n('--cosmetic-preview-rotate',0),flipX:n('--cosmetic-preview-flip-x',1),flipY:n('--cosmetic-preview-flip-y',1),strength:n('--cosmetic-preview-strength',1),pulse:m[1].includes('is-nika-sunGlow')};
 }).sort((a,b)=>a.z-b.z||a.index-b.index);
 const selected=entries.find(e=>e.selected);if(!selected)throw Error('Source frame selected option missing');
 // Source code scrolls to the selected option's offsetTop. This bounded list
 // adapter names the actual native row rather than guessing a CSS pixel offset.
 const list={querySelector(selector){if(selector!=='.cosmetic-frame-choice.is-selected')throw Error('Unknown frame child selector '+selector);return {offsetTop:entries.indexOf(selected)};},set scrollTop(index){bridge.application.get('cosmetic_modal').call('scroll_to_index',Number(index));}};
 bridge.controls.set('cosmetic-choice-list',list);
 return {kind:'cosmetic',title:field(html,/<h3>([\s\S]*?)<\/h3>/,'frame title'),image:asset(field(html,/<div class="cosmetic-frame-preview-portrait">\s*<img src="([^"]+)"/,'frame portrait')),name:field(html,/<div class="cosmetic-frame-preview-name">\s*<strong>([\s\S]*?)<\/strong>/,'frame character'),previewLabel:field(html,/<div class="cosmetic-frame-preview-name">[\s\S]*?<span>([\s\S]*?)<\/span>/,'frame preview label'),current:field(html,/<div class="cosmetic-frame-preview-status">\s*<span>([\s\S]*?)<\/span>/,'equipped frame'),unlock:field(html,/<div class="cosmetic-frame-preview-status">[\s\S]*?<small>([\s\S]*?)<\/small>/,'frame description'),selected:selected.id,layers,entries,actions};
};
