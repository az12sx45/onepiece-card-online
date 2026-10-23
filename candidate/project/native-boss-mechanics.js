'use strict';
const original=require('./original-boss-mechanics'),{parse}=require('./native-research-markup');
function prepare(view){
 const m=view?.battle?.postgameBossMechanic;if(!m?.active)return null;
 return {key:m.key,badge:original.badge(m),title:m.title||'Boss 特殊機制',rule:m.rule||m.subtitle||'進入戰鬥後依目前狀態調整行動。',counter:m.counter||'留意目前狀態與危險提示，選擇可中斷機制的行動。',frame:m.panelImage||'images/board/battle/postgame_mechanics/postgame_boss_mechanic_panel_v1.png',icon:m.iconUrl||m.islandImage||'',targets:Array.isArray(m.targets)?m.targets:[],state:parse(original.html(m))};
}
exports.prepare=prepare;
