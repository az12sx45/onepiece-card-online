'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{execFileSync}=require('child_process'),path=require('path');
const root=path.resolve(__dirname,'..');
function load(source){let seed=1;const math=Object.create(Math);math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);const context={module:{exports:{}},console,Math:math,Date};vm.runInNewContext(source,context);return {api:context.module.exports,reset:()=>seed=7261};}
const before=load(execFileSync('git',['show','4e985dd20:server/engine.js'],{cwd:root}).toString()),after=load(fs.readFileSync(path.join(root,'server/engine.js'),'utf8'));
const plain=x=>JSON.parse(JSON.stringify(x));let actions=0,publicOutcomes=0;
function compare(s,a){before.reset();after.reset();const old=plain(before.api.applyAction(plain(s),a)),next=plain(after.api.applyAction(plain(s),a));assert.deepEqual(next.state,old.state,'Original rules/state changed: '+JSON.stringify(a));assert.deepEqual(next.emits.filter(e=>!['card_guess','card_defense'].includes(e.type)),old.emits,'Original event routing or order changed');
 for(const e of next.emits.filter(e=>['card_guess','card_defense'].includes(e.type))){assert.equal(e.to,'all');assert.ok(Number.isInteger(e.casterId));assert.ok(Number.isInteger(e.targetId));assert.deepEqual(Object.keys(e).sort(),['to','type','casterId','targetId',e.type==='card_guess'?'digit':'status'].sort());publicOutcomes++;}actions++;return next.state;}
for(let card=0;card<20;card++)for(const boosted of [false,true])for(const defense of ['none','protected','dodging','both']){
 before.reset();let s=plain(before.api.createInitialState(4));s.phase='playing';s.turnIndex=0;s.turnStep='choose';s.venues=boosted?[{name:before.api.CARDS[card].venue}]:[];
 s.players.forEach((p,i)=>{p.alive=true;p.hand=i?4+i:card;p.tempDraw=i?null:7;p.gold=10;p.protected=i>0&&['protected','both'].includes(defense);p.dodging=i>0&&['dodging','both'].includes(defense);});
 s=compare(s,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}});
 for(let step=0;step<4&&s.pending;step++){const p=s.pending;let a;
  if(p.action==='usopp')a=p.extra?.target==null?{type:'PICK_TARGET',payload:{target:1}}:{type:'PICK_DIGIT',payload:{digit:4}};
  else if(['robin','sanji','zoro','law','nami','luffy','kaido','killer','aokiji','roger','bigmom'].includes(p.action))a={type:'PICK_TARGET',payload:{target:1,swap:step>0}};
  else if(p.action==='bigmom-coin')a={type:'BIGMOM_COIN',payload:{}};
  else if(p.action==='queen')a={type:'QUEEN_COIN',payload:{}};
  else break;
  s=compare(s,{playerId:0,...a});
 }
}
assert.ok(publicOutcomes>30);const report={passed:true,comparedActions:actions,publicOutcomes,originalStateAndEventsIdentical:true,hiddenCardFieldsAdded:false};console.log(JSON.stringify(report));
if(process.env.PO_QA_OUT){fs.mkdirSync(process.env.PO_QA_OUT,{recursive:true});fs.writeFileSync(path.join(process.env.PO_QA_OUT,'engine-parity.json'),JSON.stringify(report,null,2));}
