'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),Module=require('module'),{execFileSync}=require('child_process');
const engine=require('../server/engine'),root=path.resolve(__dirname,'..'),output=process.argv[2];
if(!output)throw Error('QA output required');
const original=execFileSync('git',['show','16088aeebe05a99aea9cdc16337430b9a9abcd51:server/engine.js'],{cwd:root,encoding:'utf8'}),baseline=new Module(path.join(root,'server/engine-qa-baseline.js'));
baseline.filename=path.join(root,'server/engine-qa-baseline.js');baseline.paths=module.paths;baseline._compile(original,baseline.filename);
let count=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);count++;};
const oldRandom=Math.random;let seed=1;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function run(api,s,a){seed=12345;Math.random=random;try{return api.applyAction(s,a);}finally{Math.random=oldRandom;}}
function setup(id,enhanced){const s=engine.createInitialState(4);s.turnIndex=0;s.turnStep='choose';s.venues=enhanced?[{name:engine.CARDS[id].venue}]:[];s.players.forEach((p,i)=>{p.hand=i===0?id:i+3;p.tempDraw=i===0?2:null;p.gold=2;p.protected=false;p.dodging=false;});s.deck=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19];return s;}
for(let id=0;id<20;id++)for(const enhanced of [false,true]){const s=setup(id,enhanced),action={playerId:0,type:'PLAY_CARD',payload:{which:'hand'}};eq(run(engine,s,action),run(baseline.exports,s,action),'Legacy play parity '+id+'/'+enhanced);}
let s=run(engine,setup(6,true),{playerId:0,type:'PLAY_CARD',payload:{which:'hand'}}).state;
const legacy=run(baseline.exports,s,{playerId:0,type:'PICK_TARGET',payload:{target:1,swap:true}});
const preview=run(engine,s,{playerId:0,type:'PICK_TARGET',payload:{target:1,preview:true}});
eq(preview.state.pending.extra.previewTarget,1,'Preview retains one selected target');
eq(preview.state.turnIndex,0,'Preview does not advance turn');
eq(preview.emits.filter(e=>e.type==='law_view').map(e=>e.to),[0],'Preview is only sent to caster');
const twice=run(engine,preview.state,{playerId:0,type:'PICK_TARGET',payload:{target:1,preview:true}});
eq(twice.state,preview.state,'Repeated preview does not add score or mutate rules');
eq(run(engine,preview.state,{playerId:0,type:'PICK_TARGET',payload:{target:2,preview:true}}).state,preview.state,'Preview cannot inspect additional targets');
eq(run(engine,preview.state,{playerId:2,type:'PICK_TARGET',payload:{target:1,swap:true}}).state,preview.state,'Another seat cannot confirm swap');
eq(run(engine,preview.state,{playerId:2,type:'PICK_CANCEL'}).state,preview.state,'Another seat cannot cancel preview');
const swapped=run(engine,preview.state,{playerId:0,type:'PICK_TARGET',payload:{target:1,swap:true}});
eq(swapped.state,legacy.state,'Two-step final state equals original one-shot swap including score');
eq(swapped.emits.filter(e=>e.type==='law_view').length,0,'Confirmation does not show duplicate peek');
const cancelled=run(engine,preview.state,{playerId:0,type:'PICK_CANCEL'});
eq(cancelled.state.pending,null,'Decline resumes original turn flow');
const resumed=JSON.parse(JSON.stringify(preview.state));eq(run(engine,resumed,{playerId:0,type:'PICK_TARGET',payload:{target:1,swap:true}}).state,legacy.state,'Serialized pending state restores same result');
for(const flag of ['protected','dodging']){const guarded=JSON.parse(JSON.stringify(s));guarded.players[1][flag]=true;eq(run(engine,guarded,{playerId:0,type:'PICK_TARGET',payload:{target:1,preview:true}}).state.pending,null,'Blocked preview finishes without leaking '+flag);}
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'law-preview.json'),JSON.stringify({passed:true,checks:count,legacyCases:40,scope:'Optional native two-step Law preview; original rules and legacy one-shot outcomes preserved',published:false},null,2));console.log(JSON.stringify({passed:true,checks:count}));
