"use strict";
// The original shared victory receipt has text cards, no character artwork or choices.
exports.project=function(html,bridge,{decode,field}){
 if(!html.includes('class="companion-grid"')||!html.includes('id="spectatorModalCloseBtn"'))return null;
 const cards=[...html.matchAll(/<article class="companion-card">([\s\S]*?)<\/article>/g)].map(m=>({
  tier:decode(m[1].match(/<div class="companion-tier">([\s\S]*?)<\/div>/)?.[1]||''),
  name:field(m[1],/<div class="companion-name">([\s\S]*?)<\/div>/,'reward player'),
  detail:field(m[1].replace(/<br\s*\/?>/g,'\n'),/<div class="companion-meta">([\s\S]*?)<\/div>/,'reward summary').replace(/[ \t]+/g,' ')}));
 if(!cards.length)return null;
 const key='spectatorModalCloseBtn',label=field(html,/<button[^>]*id="spectatorModalCloseBtn"[^>]*>([\s\S]*?)<\/button>/,'reward close');bridge.control(key,{},label);
 return {kind:'spectator-rewards',title:field(html,/<h3 class="modal-title">([\s\S]*?)<\/h3>/,'reward title'),subtitle:field(html,/<div class="modal-sub">([\s\S]*?)<\/div>/,'reward subtitle'),body:'',cards,actions:[{key,label}]};
};
