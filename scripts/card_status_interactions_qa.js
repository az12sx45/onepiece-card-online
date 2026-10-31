'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),engine=require('../server/engine');
let checks=0;const check=fn=>{fn();checks++;};
function state(){const s=engine.createInitialState(6);s.turnIndex=0;s.turnStep='choose';s.venues=[];s.players.forEach((p,i)=>Object.assign(p,{alive:true,hand:i?4:1,tempDraw:i?null:8,isCPU:false}));return s;}
for(const enhanced of [false,true])for(const guard of ['protected','dodging','both','none']){
 let s=state();if(enhanced)s.venues=[{name:engine._util.cardById(1).venue}];if(guard!=='none'){s.players[1][guard==='both'?'protected':guard]=true;if(guard==='both')s.players[1].dodging=true;}
 s=engine.applyAction(s,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}}).state;
 for(const target of [-1,0,1.5,9]){const bad=engine.applyAction(s,{type:'PICK_TARGET',playerId:0,payload:{target}});check(()=>assert.deepEqual(bad.state,s));}
 const r=engine.applyAction(s,{type:'PICK_TARGET',playerId:0,payload:{target:1}});
 check(()=>assert.equal(r.state.players[1].hand,4));
 if(guard==='none'){check(()=>assert.equal(r.state.pending.extra.target,1));continue;}
 check(()=>assert.equal(r.state.pending,null));check(()=>assert.equal(r.state.turnIndex,1));
 check(()=>assert.equal(r.emits.filter(e=>e.type==='card_defense').length,1));
 check(()=>assert.ok(!r.emits.some(e=>['card_guess','usopp_hit','usopp_miss','silent_discard'].includes(e.type))));
 check(()=>assert.equal(r.state.players[1].dodging,guard==='both'));
 check(()=>assert.equal(r.state.players[1].protected,guard!=='dodging'));
 const again=engine.applyAction(r.state,{type:'PICK_DIGIT',playerId:0,payload:{digit:4}});check(()=>assert.deepEqual(again.state,r.state));
}
// Exercise the actual server loop with real engine/barriers, controlled timers.
const src=fs.readFileSync(require.resolve('../server/index'),'utf8'),loop=src.slice(src.indexOf('function runCpuLoop('),src.indexOf('// ——— Socket.IO',src.indexOf('function runCpuLoop(')));
for(const barrier of ['none','venue','presentation'])for(const cpu of [false,true]){
 const s=state();s.turnStep='draw';s.players.forEach(p=>{p.tempDraw=null;p.skipNext=true;p.isCPU=cpu;});
 let venue=barrier==='venue',present=barrier==='presentation',calls=0;const timers=[],room={state:s},before=s.deck.slice();
 const ctx={rooms:new Map([['QA',room]]),io:{},cardVenueReady:{waiting:()=>venue},cardPresentationReady:{waiting:()=>present},setTimeout(fn){timers.push(fn)},
 applyAndBroadcast(r,a){const result=engine.applyAction(r.state,a);r.state=result.state;calls++;present=true;},console};
 vm.runInNewContext(loop,ctx);ctx.runCpuLoop('QA');check(()=>assert.equal(calls,barrier==='none'?1:0));
 if(barrier!=='none'){venue=false;present=false;ctx.runCpuLoop('QA');}
 check(()=>assert.equal(calls,1));check(()=>assert.equal(room.state.turnIndex,1));check(()=>assert.deepEqual(room.state.deck,before));
 ctx.runCpuLoop('QA');for(const timer of timers.splice(0))timer();check(()=>assert.equal(calls,1));
 for(let i=1;i<6;i++){present=false;ctx.runCpuLoop('QA');check(()=>assert.equal(calls,i+1));}
 check(()=>assert.equal(room.state.players.some(p=>p.skipNext),false));check(()=>assert.equal(room.state.turnIndex,0));check(()=>assert.deepEqual(room.state.deck,before));
 // All flags cleared: an ordinary human still chooses when to draw.
 room.state.players[0].isCPU=false;present=false;ctx.runCpuLoop('QA');check(()=>assert.equal(calls,6));
}
console.log(JSON.stringify({passed:true,checks,scope:'Real Usopp engine guards; actual server loop with all six human/CPU paralysis turns, both presentation barriers and stale timers. No hidden hand exposed or ordinary auto-draw.'}));
