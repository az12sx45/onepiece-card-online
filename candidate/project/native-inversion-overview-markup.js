'use strict';
const {parse}=require('./native-research-markup');
exports.project=function(html,bridge){
 if(!html.includes('class="inversion-overview-ui"'))return null;
 const root=parse(html),all=(n,s)=>{const out=[];function walk(n){for(const c of n?.children||[])if(typeof c!=='string'){if(s[0]==='.'?(c.attrs.class||'').split(/\s+/).includes(s.slice(1)):c.tag===s)out.push(c);walk(c);}}walk(n);return out;},one=(n,s)=>all(n,s)[0],raw=n=>!n?'':typeof n==='string'?n:(n.children||[]).map(raw).join(''),text=n=>raw(n).replace(/\s+/g,' ').trim(),value=(n,s)=>text(one(n,s));
 const button=one(root,'button');if(button.attrs.id!=='closeInversionOverviewBtn')throw Error('Unknown original overview control');bridge.control(button.attrs.id,{},text(button));
 return {kind:'inversion-overview',sourceText:text(root),frame:one(root,'.inversion-overview-frame').attrs.src,title:value(root,'h3'),rule:value(one(root,'.inversion-overview-rule'),'strong'),hint:value(one(root,'.inversion-overview-rule'),'span'),rows:all(root,'.inversion-route-row').map(n=>({claimed:(n.attrs.class||'').includes('claimed'),badge:value(n,'.inversion-route-badge'),title:value(one(n,'.inversion-route-copy'),'strong'),destination:value(one(n,'.inversion-route-copy'),'span'),status:value(one(n,'.inversion-route-status'),'strong'),owner:value(one(n,'.inversion-route-status'),'span')})),action:{key:button.attrs.id,label:text(button)}};
};
