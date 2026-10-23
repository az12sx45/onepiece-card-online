'use strict';
// Presentation parsing of the original ship menu. Command names/labels/icons,
// conditions and order are supplied by its unchanged original template.
function decode(value){return String(value||'').replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
function attributes(markup){const result={};for(const m of markup.matchAll(/([\w-]+)="([^"]*)"/g))result[m[1]]=decode(m[2]);return result;}
exports.project=function(api,player){
    if(api.functions.canOpenCpuShipControlFor(player))return null; // Owned by native-cpu-ship-menu.
    if(!api.functions.canOpenShipActionsFor(player))return null;
    const original=api.presentation.shipMenu(player),entries=[];
    for(const match of original.markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){
        const attr=attributes(match[1]);if(!attr['data-ship-action'])continue;
        const icons=[...match[2].matchAll(/<img\b([^>]*)>/g)].map(m=>attributes(m[1])).filter(i=>!(i.class||'').includes('ship-command-button-frame'));
        entries.push({action:attr['data-ship-action'],label:attr['aria-label']||decode(match[2].replace(/<[^>]*>/g,'').trim()),icon:icons[0]?.src||'',enabled:!/(?:^|\s)disabled(?:\s|=|$)/.test(match[1]),hint:attr.title||''});
    }
    if(!entries.length||entries.some(e=>!e.label||!e.icon))throw Error('Original captain command template was not understood');
    return {playerId:String(player.id),name:player.name,entries,mission:original.missionChip};
};
