'use strict';
const {parse}=require('./native-research-markup');
// Preserve the original entry handlers and choice. Arriving or finishing the
// introduction must never auto-enter, auto-leave, or manufacture raid state.
exports.project=function(html,bridge){
 if(!html.includes('id="enterMarinefordIslandBtn"'))return null;
 const root=parse(html),nodes=[];function walk(n){for(const c of n.children||[])if(typeof c==='object'){nodes.push(c);walk(c);}}walk(root);
 const text=n=>!n?'':typeof n==='string'?n:(n.children||[]).map(text).join('');
 const has=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c);
 const buttons=nodes.filter(n=>n.tag==='button'),ids=['enterMarinefordIslandBtn','leaveMarinefordIslandBtn'];
 if(buttons.length!==2||buttons.some((n,i)=>n.attrs.id!==ids[i]))throw Error('Original Marineford entry controls changed');
 const actions=buttons.map(n=>{const key=n.attrs.id,label=text(n).trim(),disabled=Object.hasOwn(n.attrs,'disabled');bridge.control(key,{},label).disabled=disabled;return {key,label,disabled};});
 return {kind:'marineford-entry',title:text(nodes.find(n=>n.tag==='h3')).trim(),subtitle:'',body:[text(nodes.find(n=>has(n,'modal-sub'))).trim(),text(nodes.find(n=>has(n,'empty-note'))).trim()].filter(Boolean).join('\n\n'),background:'images/board/marineford/backgrounds/marineford_stage_bg.webp',actions};
};
