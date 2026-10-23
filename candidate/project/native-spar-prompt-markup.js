'use strict';
const {parse}=require('./native-research-markup');
exports.project=function(html,bridge){
 if(!/id="(?:cancelSparPartnerBtn|rejectSparInviteBtn)"/.test(html))return null;
 const root=parse(html),raw=n=>typeof n==='string'?n:(n?.children||[]).map(raw).join(''),text=n=>raw(n).replace(/\s+/g,' ').trim(),nodes=[];function walk(n){for(const c of n.children||[])if(typeof c!=='string'){nodes.push(c);walk(c);}}walk(root);
 const actions=nodes.filter(n=>n.tag==='button').map(n=>{const key=n.attrs.id||'spar-partner:'+n.attrs['data-spar-partner'],label=text(n),disabled=Object.hasOwn(n.attrs,'disabled');const node=bridge.control(key,n.attrs['data-spar-partner']?{sparPartner:n.attrs['data-spar-partner']}:{},label);node.disabled=disabled;return {key,label,disabled};});
 return {kind:'spar-prompt',title:text(nodes.find(n=>n.tag==='h3')),subtitle:'',body:text(nodes.find(n=>(n.attrs.class||'').split(/\s+/).includes('modal-sub'))),sourceText:text(root),actions};
};

