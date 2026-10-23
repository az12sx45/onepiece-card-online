'use strict';
exports.project=function(html,bridge,{decode,field,asset}){
 if(!html.includes('id="backToBackpackFromJudicialChestBtn"'))return null;
 const close={key:'backToBackpackFromJudicialChestBtn',label:field(html,/<button[^>]*id="backToBackpackFromJudicialChestBtn"[^>]*>([\s\S]*?)<\/button>/,'chest return')};bridge.control(close.key,{},close.label);
 const entries=[...html.matchAll(/<article class="companion-card">([\s\S]*?)<\/article>/g)].map(m=>{const s=m[1],choice=field(s,/data-judicial-chest-choice="([^"]+)"/,'chest choice'),key='judicial-chest:'+choice;bridge.control(key,{judicialChestChoice:choice});return{key,choice,name:field(s,/<div class="companion-name">([\s\S]*?)<\/div>/,'chest name'),tier:field(s,/<div class="companion-tier">([\s\S]*?)<\/div>/,'chest tier'),meta:field(s,/<div class="companion-meta">([\s\S]*?)<\/div>/,'chest summary'),image:asset(field(s,/<img[^>]*?\ssrc="([^"]+)"/,'chest image')),label:field(s,/<button[^>]*>([\s\S]*?)<\/button>/,'chest action'),disabled:false};});
 if(entries.length!==4)throw Error('Original judicial reward catalog changed');
 return{kind:'judicial-chest',title:field(html,/<h3 class="modal-title">([\s\S]*?)<\/h3>/,'chest title'),subtitle:field(html,/<div class="modal-sub">([\s\S]*?)<\/div>/,'chest subtitle'),entries,close};
};
