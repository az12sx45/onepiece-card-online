'use strict';
// Project the original menu; dispatch retains its source controller statements.
const decode=value=>String(value).replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function field(html,pattern,label){const match=html.match(pattern);if(!match)throw Error('Original CPU ship '+label+' missing');return decode(match[1]);}
exports.project=function(api,player){
 if(!api.functions.canOpenCpuShipControlFor(player))return null;
 const source=api.presentation.cpuShipMenu(player),html=source.markup;
 const model={playerId:String(player.id),title:field(html,/<div class="ship-action-title">([^<]+)</,'title'),summary:field(html,/<div class="ship-mission-chip">([^<]+)</,'summary'),frame:field(html,/<img class="ship-command-frame" src="([^"]+)"/,'frame'),vessel:field(html,/<div class="ship-command-vessel">\s*<img src="([^"]+)"/,'vessel'),vesselName:field(html,/<strong>([^<]+)<\/strong>/,'vessel name'),selects:[],actions:[]};
 for(const match of html.matchAll(/<label class="ship-action-field">\s*<span>([^<]+)<\/span>\s*<select[^>]*data-cpu-ship-(speed|strategy)[^>]*>([\s\S]*?)<\/select>/g))model.selects.push({key:match[2],label:decode(match[1]),value:source[match[2]],options:[...match[3].matchAll(/<option value="([^"]+)">([^<]+)<\/option>/g)].map(m=>({value:decode(m[1]),label:decode(m[2])}))});
 for(const match of html.matchAll(/<button[^>]*data-ship-action="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g))model.actions.push({key:match[1],icon:field(match[2],/<img src="([^"]+)"/,'action icon'),label:field(match[2],/<span>([^<]+)<\/span>/,'action label')});
 if(model.selects.length!==2||model.actions.length!==3)throw Error('Original CPU ship controls changed');return model;
};
exports.change=function(api,player,key,value){const model=exports.project(api,player),select=model?.selects.find(entry=>entry.key===key);if(!select||!select.options.some(option=>option.value===String(value)))return false;api.presentation.dispatchCpuShipChange({value:String(value),matches:selector=>selector==='[data-cpu-ship-'+key+']'},player);return true;};
exports.activate=function(api,player,key){const model=exports.project(api,player);if(!model?.actions.some(action=>action.key===key))return false;api.presentation.dispatchCpuShipAction(key,player);return true;};
