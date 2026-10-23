'use strict';
const rules=require('./original-menu-rules');
// Presentation model only. Submission still goes through the unmodified
// processBattlePageCommand and its ownership / inventory validation.
exports.itemTargets=function itemTargets(view,itemId){
    const item=(view.player?.battleItems||[]).find(item=>item.id===itemId);
    if(!item)return {title:'戰鬥道具',entries:[]};
    if(!rules.battleItemRequiresCrewTarget(item,view))return {immediate:{itemId:item.id,targetIndex:null,targetPlayerId:'',targetSide:''}};
    if(item.targetMode==='battle_side')return {title:'使用在我方或敵方',entries:['player','enemy'].map(side=>({
        name:side==='player'?'使用在我方':'使用在敵方',detail:side==='player'?view.activeCard.name:view.enemy.name,
        enabled:true,payload:{itemId:item.id,targetIndex:null,targetPlayerId:'',targetSide:side},
    }))};
    const players=view.battle?.coopItemTargets?.length?view.battle.coopItemTargets:[{id:view.player.id,name:view.player.name,crew:view.player.crew}];
    const entries=players.flatMap(player=>{
        if(item.targetMode==='party'){
            const living=player.crew.filter(card=>Number(card.currentHp)>0);
            const missing=living.reduce((sum,card)=>sum+Math.max(0,Number(card.maxHp)-Number(card.currentHp)),0);
            return [{name:player.name,detail:`存活 ${living.length}/${player.crew.length} ・ 可回復 ${missing} HP`,enabled:missing>0,
                payload:{itemId:item.id,targetIndex:null,targetPlayerId:player.id,targetSide:''}}];
        }
        return player.crew.map((card,index)=>({name:`${player.name}｜${card.name}`,detail:`HP ${card.currentHp}/${card.maxHp} ・ 技能 ${rules.battleCrewPpText(card)}`,
            hint:rules.battleItemTargetHint(item,card),portrait:card.battlePortraits?.normal||card.battlePortraits?.idle||'',
            enabled:rules.canTargetBattleItem(item,card),payload:{itemId:item.id,targetIndex:Number.isInteger(Number(card.index))?Number(card.index):index,targetPlayerId:player.id,targetSide:''}}));
    });
    return {title:'道具目標：'+item.name,entries};
};
