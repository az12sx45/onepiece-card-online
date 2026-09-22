'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../public/js/board_game.js'),'utf8');
const start=source.indexOf('const judicialSettlementsInFlight = new WeakSet();');
const end=source.indexOf('function reviveOneCrewAtOneHp',start);
assert(start>=0&&end>start);
const body=source.slice(start,end).trim();
const results=[];
async function scenario(phase,resumeSaved=false){
 const phases=['one','two','three','four','five','six'],player={id:'qa',name:'QA'},island={isDefeated:false};
 let raid={phaseIndex:phase,islandId:'qa',phaseClearedKeys:[],clearCount:0,active:true};
 let grants=0,finalGrants=0,next=0,notifications=0,finalized=0,resume;
 const wait=new Promise(resolve=>resume=resolve);
 const battle={result:'win',activeCrewIndex:0,raidEnemyKey:phases[phase],enemyCombatant:{name:'QA enemy'}};
 if(resumeSaved){battle._judicialSettlementDone=true;battle.raidPhaseReward={bonus:{id:'heal',visual:{group:'judicial',key:'heal',variant:1}}};}
 const scope={Math,Date,JUDICIAL_RAID_PHASES:phases,JUDICIAL_PHASE_BONUS_POOL:[],state:{gameState:{round:1},battleState:battle},battlePlayer:()=>player,ensureJudicialRaidState:()=>raid={...raid,phaseClearedKeys:[...raid.phaseClearedKeys]},getIslandState:()=>island,
 recordJudicialRaidContribution(){},recordDefeatedEnemy(){},grantJudicialPhaseReward(){grants++;return {bonus:{id:'heal',visual:{group:'judicial',key:'heal',variant:1}}};},
 getJudicialRaidEnemyProfile:index=>({name:phases[index]}),notifyBattleWindow(){notifications++;scope.ensureJudicialRaidState();},waitBattleWindowVisual(event,duration){assert.equal(duration,11000);assert.equal(event.duration,11000);return wait;},
 promptJudicialRaidNextSwitch(){next++;},finalizeBattleAndAdvanceTurn(_p,callback){finalized++;callback?.();},addJudicialRaidLog(){},grantJudicialRaidRewards(){finalGrants++;}
 };
 const context=vm.createContext(scope);vm.runInContext(body+';globalThis.qaFinish=finishJudicialRaidBattle;',context);
 const finish=context.qaFinish,pending=finish(battle);
 assert.equal(grants,resumeSaved?0:1);assert.equal(notifications,1);assert.equal(finalized,0);assert.equal(next,0);assert.equal(raid.clearCount,0);assert.equal(battle.visualEvent.finalVictory,phase===5);
 assert.equal(battle.visualEvent.bonus.visual.key,'heal');results.push({name:`phase ${phase+1}: visual issued before any settlement`,pass:true});
 await finish(battle);assert.equal(grants,resumeSaved?0:1);assert.equal(notifications,1);results.push({name:`phase ${phase+1}${resumeSaved?' restored':''}: reentry cannot duplicate reward`,pass:true});
 scope.ensureJudicialRaidState();resume();await pending;
 if(phase===5){assert.equal(finalized,1);assert.equal(finalGrants,1);assert.equal(next,0);assert.equal(raid.clearCount,1);assert.equal(raid.cleared,true);assert.equal(island.isDefeated,true);}
 else{assert.equal(finalized,0);assert.equal(finalGrants,0);assert.equal(next,1);assert.equal(raid.clearCount,0);}
 results.push({name:`phase ${phase+1}: correct continuation only after reveal`,pass:true});
}
(async()=>{for(let i=0;i<6;i++)await scenario(i);await scenario(5,true);const output=process.env.BOARD_QA_OUTPUT||'D:/Codex_QA/draw-result-art-20260922/settlement.json';fs.writeFileSync(output,JSON.stringify({ok:true,checks:results.length,results},null,2));console.log(JSON.stringify({ok:true,checks:results.length,output}));})().catch(e=>{console.error(e);process.exitCode=1;});
