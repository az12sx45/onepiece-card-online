'use strict';
const {parse}=require('./native-research-markup');
// Only the original plain-text notices listed here use this surface. Artwork,
// selection cards, inputs and unknown controls still require their own renderer.
exports.project=function(html,bridge){
 if(!/<h3 class="modal-title">/.test(html)||!/(?:confirmEventIslandBtn|closeModalBtn|postgameBossMissingCloseBtn|seaEncounterNoCrewBtn|finalGateCloseBtn|challengeBtn)/.test(html))return null;
 const allowed=new Set(['confirmEventIslandBtn','closeModalBtn','postgameBossMissingCloseBtn','seaEncounterNoCrewBtn','finalGateCloseBtn','challengeBtn']),root=parse(html),raw=n=>typeof n==='string'?n:(n?.children||[]).map(raw).join(''),text=n=>raw(n).replace(/\s+/g,' ').trim(),nodes=[];function walk(n){for(const c of n.children||[])if(typeof c!=='string'){nodes.push(c);walk(c);}}walk(root);
 if(nodes.some(n=>!['h3','div','p','span','strong','b','small','button','br'].includes(n.tag)))return null;
 const buttons=nodes.filter(n=>n.tag==='button');if(!buttons.length||buttons.some(n=>!allowed.has(n.attrs.id)))return null;
 const actions=buttons.map(n=>{const key=n.attrs.id,label=text(n),disabled=Object.hasOwn(n.attrs,'disabled'),control=bridge.control(key,{},label);control.disabled=disabled;return {key,label,disabled};});
 const body=root.children.filter(n=>typeof n!=='string'&&n.tag!=='h3'&&!(n.attrs.class||'').split(/\s+/).includes('modal-row')).map(text).join('\n\n');
 return {kind:'event-notice',title:text(nodes.find(n=>n.tag==='h3')),subtitle:'',body,sourceText:text(root),actions};
};
