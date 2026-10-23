'use strict';
const {parse}=require('./native-research-markup');
exports.project=function(html,bridge){
 if(!html.includes('class="yonko-raid-screen"'))return null;
 const root=parse(html),all=(n,s)=>{const out=[];function walk(n){for(const c of n?.children||[])if(typeof c!=='string'){if(s[0]==='.'?(c.attrs.class||'').split(/\s+/).includes(s.slice(1)):c.tag===s)out.push(c);walk(c);}}walk(n);return out;},one=(n,s)=>all(n,s)[0],raw=n=>!n?'':typeof n==='string'?n:(n.children||[]).map(raw).join(''),text=n=>raw(n).replace(/\s+/g,' ').trim(),value=(n,s)=>text(one(n,s));
 const screen=one(root,'.yonko-raid-screen'),command=one(root,'.yonko-raid-command-copy');
 const buttons=all(root,'button').map(n=>{const disabled=Object.hasOwn(n.attrs,'disabled');const control=bridge.control(n.attrs.id,{},text(n));control.disabled=disabled;return {key:n.attrs.id,label:text(n),disabled};});
 return {kind:'yonko',title:value(root,'h3'),kicker:value(root,'.yonko-raid-kicker'),lead:value(root,'.yonko-raid-lead'),rules:all(root,'.yonko-raid-rule').map(n=>({number:value(n,'span'),text:value(n,'p')})),command:value(command,'strong'),hint:value(command,'span'),background:(screen.attrs.style||'').match(/--yonko-raid-bg:url\(([^)]+)\)/)?.[1]||'',portrait:one(one(root,'.yonko-raid-portrait'),'img')?.attrs.src||'',buttons,sourceText:text(root)};
};
