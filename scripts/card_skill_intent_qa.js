const assert=require('node:assert/strict'),engine=require('../server/engine'),presentation=require('../server/card_skill_intent');
let checks=0;const check=fn=>{fn();checks++;};
function fixture(id,enhanced=false){const s=engine.createInitialState(3);s.turnIndex=0;s.turnStep='choose';s.venues=enhanced?[{name:engine._util.cardById(id).venue}]:[];s.players.forEach((p,i)=>{p.hand=i===0?id:3+i;p.tempDraw=i===0?0:null;p.alive=true;p.client={displayName:'QA'+i};});return s;}
function step(room,action){const before=room.state,raw=engine.applyAction(before,action),expected=JSON.stringify(raw.state);presentation.decorate(room,before,action,raw);check(()=>assert.equal(JSON.stringify(raw.state),expected));for(const e of raw.emits.filter(e=>e.type==='card_skill_intent'))check(()=>assert.deepEqual(Object.keys(e).sort(),['cardId','casterId','enhanced','mode','targetId','to','type']));room.state=raw.state;return raw.emits;}
for(let id=0;id<20;id++)for(const enhanced of [false,true]){
 const room={state:fixture(id,enhanced)},events=step(room,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}});
 if(room.state.pending){check(()=>assert.ok(!events.some(e=>['card_skill_intent','enh_fx','play_fx'].includes(e.type)),'no skill/movie before pending choice '+id));}
}
for(const [id,enhanced,mode] of [[2,false,'view'],[3,false,'duel'],[5,false,'discard'],[6,false,'swap'],[7,true,'paralyze'],[8,false,'duel'],[10,false,'duel'],[13,false,'disarm'],[16,false,'freeze'],[19,true,'predict']]){
 const room={state:fixture(id,enhanced)};step(room,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}});
 const events=step(room,{type:'PICK_TARGET',playerId:0,payload:{target:1}}),intent=events.find(e=>e.type==='card_skill_intent');
 check(()=>assert.ok(intent,'selected operation gets declaration '+id));check(()=>assert.equal(intent.targetId,1));check(()=>assert.equal(intent.mode,mode));
 check(()=>assert.equal(events[0],intent));
}
const room={state:fixture(6,true)};step(room,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}});
const preview=step(room,{type:'PICK_TARGET',playerId:0,payload:{target:1,preview:true}});
check(()=>assert.equal(preview[0].mode,'view'));check(()=>assert.ok(preview.some(e=>e.type==='enh_fx')));
const swap=step(room,{type:'PICK_TARGET',playerId:0,payload:{target:1,swap:true}});check(()=>assert.equal(swap[0].mode,'swap'));check(()=>assert.ok(!swap.some(e=>e.type==='enh_fx'),'enhanced movie only once'));
const blocked={state:fixture(5)};blocked.state.players[1].protected=true;step(blocked,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}});const hit=step(blocked,{type:'PICK_TARGET',playerId:0,payload:{target:1}});
check(()=>assert.equal(hit[0].mode,'discard'));check(()=>assert.ok(hit.some(e=>e.type==='card_defense')));
const guess={state:fixture(1,true)};step(guess,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}});let e=step(guess,{type:'PICK_TARGET',playerId:0,payload:{target:1}});check(()=>assert.ok(!e.some(e=>e.type==='enh_fx')));e=step(guess,{type:'PICK_DIGIT',playerId:0,payload:{digit:4}});check(()=>assert.ok(e.some(e=>e.type==='card_guess'&&e.digit===4&&e.targetId===1)));check(()=>assert.ok(!e.some(e=>e.type==='card_skill_intent')));
console.log(JSON.stringify({passed:true,checks,scope:'Original engine normal/enhanced 20-card decisions; unchanged rule state; selected target/mode, deferred movies, Law phases, blocked target and Usopp digit timing; public declaration contains no hand/outcome fields.'}));
