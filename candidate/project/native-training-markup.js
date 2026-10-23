'use strict';
function radar(html,decode,field){
 const points=value=>value.trim().split(/\s+/).map(pair=>pair.split(',').map(Number));
 const polygons=[...html.matchAll(/<polygon([^>]*)points="([^"]+)"[^>]*>/g)].map(m=>({value:m[1].includes('training-radar-value'),points:points(m[2])}));
 const lines=[...html.matchAll(/<line x1="([^"]+)" y1="([^"]+)" x2="([^"]+)" y2="([^"]+)"/g)].map(m=>m.slice(1).map(Number));
 const circles=[...html.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g)].map(m=>m.slice(1).map(Number));
 const labels=[...html.matchAll(/<text([^>]*)>([\s\S]*?)<\/text>/g)].map(m=>({x:Number(field(m[1],/\bx="([^"]+)"/,'radar x')),y:Number(field(m[1],/\by="([^"]+)"/,'radar y')),anchor:field(m[1],/text-anchor="([^"]+)"/,'radar anchor'),mode:m[1].includes('training-radar-mode-label'),text:decode(m[2]),name:decode(m[2].split('<tspan>')[0]),value:decode(m[2].match(/<tspan>([\s\S]*?)<\/tspan>/)?.[1]||'')}));
 if(polygons.length!==4||lines.length!==6||circles.length!==6||labels.length!==7)throw Error('Original training radar geometry changed');
 return {mode:field(html,/data-radar-mode="([^"]+)"/,'radar mode'),label:field(html,/aria-label="([^"]+)"/,'radar label'),polygons,lines,circles,labels};
}
exports.radar=radar;
exports.project=function(html,bridge,{decode,field,asset}){
 const detail=html.includes('class="training-detail-ui"'),quantity=html.includes('class="training-quantity-ui"');if(!detail&&!quantity)return null;
 const image=body=>asset(body.match(/<img\b[^>]*?\bsrc="([^"]+)"/)?.[1]||'');
 const action=(id)=>{const m=html.match(new RegExp('<button([^>]*id="'+id+'"[^>]*)>([\\s\\S]*?)<\\/button>'));if(!m)throw Error('Training action missing '+id);const label=decode(m[2]),disabled=/\bdisabled\b/.test(m[1]);bridge.control(id,{},label).disabled=disabled;return {key:id,label,disabled};};
 if(quantity){
  const prefix=html.includes('id="backpackTrainingQtyValue"')?'backpackTrainingQty':'backpackPassiveQty',quantityKey=prefix+'Value',totalKey=prefix+'Preview';
  const amount=field(html,new RegExp('<strong[^>]*id="'+quantityKey+'">([^<]+)'),'training quantity'),total=field(html,new RegExp('<strong[^>]*id="'+totalKey+'">([^<]+)'),'training quantity preview');bridge.control(quantityKey,{},amount);bridge.control(totalKey,{},total);
  return {kind:'training-quantity',quantityKey,totalKey,title:field(html,/<h3[^>]*>([\s\S]*?)<\/h3>/,'training quantity title'),image:image(html.match(/<span class="training-quantity-icon">([\s\S]*?)<\/span>/)?.[1]||''),name:field(html,/<div class="training-quantity-item-line"><strong>([\s\S]*?)<\/strong>/,'training item'),price:field(html,/<div class="training-quantity-item-line">[\s\S]*?<span>([\s\S]*?)<\/span>/,'training inventory')+'\n'+field(html,/<div class="training-quantity-target-line">([\s\S]*?)<\/div>/,'training target'),quantity:amount,total,maximum:field(html,/<div class="training-quantity-note"><span>([\s\S]*?)<\/span>/,'training maximum'),minus:action(prefix+'Minus'),plus:action(prefix+'Plus'),actions:[action(prefix+'Confirm'),action(prefix+'Cancel')]};
 }
 const captionHtml=html.match(/<div class="training-character-caption">([\s\S]*?)<\/div>/)?.[1]||'',chart=radar(captionHtml,decode,field);
 const toggle={dataset:{radarMode:chart.mode},closest(selector){if(selector!=='[data-training-radar-toggle]')throw Error('Unknown radar target '+selector);return this;}};
 const caption={contains:node=>node===toggle,addEventListener(type,listener){if(type!=='click')throw Error('Unknown radar event '+type);bridge.listeners.set('training:radar',()=>listener({target:toggle}));}};
 Object.defineProperty(caption,'innerHTML',{set:value=>{const chart=radar(String(value),decode,field);toggle.dataset.radarMode=chart.mode;bridge.model.radar=chart;bridge.application.get('training_modal').call('apply_radar_json',JSON.stringify(chart));}});
 bridge.controls.set('training-caption',caption);
 const rows=[...html.matchAll(/<article class="training-stat-row"[^>]*>([\s\S]*?)<\/article>/g)].map(m=>({icon:image(m[1].match(/<span class="training-stat-badge"[^>]*>([\s\S]*?)<\/span>/)?.[1]||''),name:field(m[1],/<div class="training-stat-head"><strong>([\s\S]*?)<\/strong>/,'training stat'),points:field(m[1],/<div class="training-stat-head">[\s\S]*?<span>([\s\S]*?)<\/span>/,'training points'),copy:field(m[1],/<small>([\s\S]*?)<\/small>/,'training breakdown'),value:Number(field(m[1],/style="width:([\d.]+)%"/,'training percent')),total:field(m[1],/<div class="training-stat-total">[\s\S]*?<strong>([\s\S]*?)<\/strong>/,'training gain')}));
 const entries=[...html.matchAll(/<button([^>]*data-training-material-use="([^"]+)"[^>]*)>([\s\S]*?)<\/button>/g)].map(m=>{const id=decode(m[2]),key='training:'+id,disabled=/\bdisabled\b/.test(m[1]);bridge.control(key,{trainingMaterialUse:id}).disabled=disabled;return {key,disabled,image:image(m[3]),name:field(m[3],/<strong>([\s\S]*?)<\/strong>/,'training material'),description:field(m[3],/<small>([\s\S]*?)<\/small>/,'training material reason')};});
 if(rows.length!==6)throw Error('Original training stat count changed');
 return {kind:'training',title:field(html,/<h3>([\s\S]*?)<\/h3>/,'training title'),image:image(html.match(/<div class="training-character-stage">([\s\S]*?)<span>/)?.[1]||''),radar:chart,rows,entries,rules:field(html,/<p class="training-rule-note">([\s\S]*?)<\/p>/,'training rules'),empty:decode(html.match(/<p class="training-material-empty">([\s\S]*?)<\/p>/)?.[1]||''),actions:[action('backToCharacterDetailBtn'),action('closeTrainingDetailBtn')]};
};
