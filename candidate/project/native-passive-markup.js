'use strict';
exports.project=function(html,bridge,{decode,field}){
 if(!html.includes('id="closePassiveSummaryBtn"'))return null;
 const body=[...html.matchAll(/<div class="companion-meta">([\s\S]*?)<\/div>/g)].map(m=>decode(m[1]).replace(/\s+/g,' ').trim()).join('\n\n');
 const key='closePassiveSummaryBtn',label=field(html,/<button[^>]*id="closePassiveSummaryBtn"[^>]*>([\s\S]*?)<\/button>/,'passive close');bridge.control(key,{},label);
 return {kind:'passive-summary',title:field(html,/<h3[^>]*>([\s\S]*?)<\/h3>/,'passive title'),subtitle:field(html,/<div class="modal-sub">([\s\S]*?)<\/div>/,'passive subtitle'),body,actions:[{key,label,disabled:false}]};
};
