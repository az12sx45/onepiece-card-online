'use strict';
exports.project=function(html,bridge,{decode,field,asset}){
 const arsenal=html.includes('class="carry-item-ui bullet-arsenal-ui"');if(!arsenal&&!html.includes('class="carry-item-ui"'))return null;
 const plain=value=>decode(value.replace(/<br\s*\/?>/g,'\n').replace(/\s*\n\s*/g,'\n'));
 const actions=[...html.matchAll(/<button\b([^>]*\bid="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(match=>{
  const key=match[2],label=decode(match[3]),disabled=/\bdisabled\b/.test(match[1]);bridge.control(key,{},label).disabled=disabled;return {key,label,disabled};
 });
 const current=html.match(/<div class="carry-current-icon-stage[^>]*>([\s\S]*?)<div class="carry-current-name">/)?.[1]||'';
 const entries=[...html.matchAll(/<article class="carry-item-row[^>]*>([\s\S]*?)<\/article>/g)].map(match=>{
  const body=match[1],index=field(body,arsenal?/data-arsenal-inventory-index="([^"]+)"/:/data-equip-carry-index="([^"]+)"/,'carry index'),button=body.match(/<button\b([^>]*)>([\s\S]*?)<\/button>/),key=(arsenal?'arsenal-item:':'carry:')+index,disabled=/\bdisabled\b/.test(button[1]);bridge.control(key,arsenal?{arsenalInventoryIndex:index}:{equipCarryIndex:index}).disabled=disabled;
  return {key,disabled,label:decode(button[2]),image:asset(field(body,/<img[^>]+src="([^"]+)"/,'carry image')),name:field(body,/<strong>([\s\S]*?)<\/strong>/,'carry name'),meta:field(body,/<strong>[\s\S]*?<\/strong><span>([\s\S]*?)<\/span>/,'carry rarity'),description:plain(body.match(/<p>([\s\S]*?)<\/p>/)?.[1]||'')};
 });
 const slots=arsenal?[...html.matchAll(/<button([^>]*data-arsenal-slot="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{const index=decode(m[2]),key='arsenal-slot:'+index;bridge.control(key,{arsenalSlot:index});return {key,active:m[1].includes('is-active'),label:decode(m[3].replace('</span>','</span>　'))};}):[];
 if(arsenal&&slots.length!==2)throw Error('Source arsenal slot count changed');
 const description=arsenal?plain(html.match(/<div class="bullet-arsenal-slot-tabs">[\s\S]*?<\/div>([\s\S]*?)<\/div>/)?.[1]||''):plain(html.match(/<div class="carry-current-copy">([\s\S]*?)<\/div>/)?.[1]||'');
 return {kind:'carry',arsenal,slots,title:field(html,/<h3>([\s\S]*?)<\/h3>/,'carry title'),subtitle:field(html,/<header[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/,'carry subtitle'),image:asset(current.match(/<img[^>]+src="([^"]+)"/)?.[1]||''),name:field(html,/<div class="carry-current-name">([\s\S]*?)<\/div>/,'current carry name'),description,empty:decode(html.match(/<div class="carry-item-empty-note">([\s\S]*?)<\/div>/)?.[1]||''),entries,actions};
};
