'use strict';
const {parse}=require('./native-research-markup');
exports.project=function(html,bridge){
 if(!html.includes('class="final-imu-descent"'))return null;
 const root=parse(html),all=(n,s)=>{const out=[];function walk(n){for(const c of n?.children||[])if(typeof c!=='string'){if(s[0]==='.'?(c.attrs.class||'').split(/\s+/).includes(s.slice(1)):c.tag===s)out.push(c);walk(c);}}walk(n);return out;},one=(n,s)=>all(n,s)[0],raw=n=>!n?'':typeof n==='string'?n:(n.children||[]).map(raw).join(''),text=n=>raw(n).replace(/\s+/g,' ').trim(),value=(n,s)=>text(one(n,s)),image=s=>one(root,s)?.attrs.src||'';
 const dialogue=one(root,'.final-imu-dialogue'),buttons=all(dialogue,'button').map(n=>{if(!n.attrs.id)throw Error('Original final-imu control without ID');bridge.control(n.attrs.id,{},text(n));return {key:n.attrs.id,label:text(n),primary:(n.attrs.class||'').split(/\s+/).includes('primary'),disabled:Object.hasOwn(n.attrs,'disabled')};});
 return {kind:'final-imu',speaker:value(dialogue,'.final-imu-name'),lines:all(dialogue,'p').map(text),hint:value(dialogue,'.final-imu-hint'),buttons,images:{day:'images/board/final_island/final_imu_sky_day.png',dark:'images/board/final_island/final_imu_sky_dark.png',portal:image('.final-imu-portal-img'),shadow:image('.final-imu-shadow-img'),figure:one(one(root,'.final-imu-figure'),'img')?.attrs.src||''},sourceText:text(root)};
};
