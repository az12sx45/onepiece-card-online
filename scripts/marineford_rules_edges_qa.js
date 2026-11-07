'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),e=require('../server/marineford-engine');
const report={passed:false,checks:[],failures:[]};
let seed=11012026;const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
function check(name,fn){try{fn();report.checks.push(name);}catch(error){report.failures.push({name,error:error.stack});}}
function fresh(n=4,navy=0){return e.create(Array.from({length:n},(_,id)=>({name:'Rule '+id})),navy,{rng});}
function move(s,id,destination){for(const p of s.players)for(const key of ['hand','played'])p[key]=p[key].filter(c=>c!==id);for(const key of ['navy','pirate'])s.decks[key]=s.decks[key].filter(c=>c!==id);destination().push(id);}
function held(s,who,id){move(s,id,()=>s.players[who].hand);}
function act(s,id,action){const r=e.apply(s,id,action,{rng});assert.ok(r.ok,r.error);return r;}
function play(s,id,card){held(s,id,card);s.turn=id;s.step='play';return act(s,id,{type:'PLAY',card});}
function choose(s,action){return act(s,s.pending.owner,{type:'CHOOSE',...action});}
function conserve(s){const ids=[...Object.values(s.decks).flat(),...s.players.flatMap(p=>[...p.hand,...p.played]),...s.jobs.filter(j=>j.type==='recycle').map(j=>j.card)];assert.equal(ids.length,29);assert.equal(new Set(ids).size,29);}
for(const card of ['navy-akainu','justice-5'])for(const left of [0,1,2])check(card+' returns only actual draws with '+left+' cards left',()=>{
 let s=fresh();held(s,0,card);while(s.decks.navy.length>left)s.players[0].played.push(s.decks.navy.pop());const before=s.players[0].hand.length-1,drawn=Math.min(left,card==='justice-5'?2:1);s=play(s,0,card).state;
 assert.equal(s.players[0].hand.length,before+drawn);
 if(drawn){assert.equal(s.pending.type,'return');assert.equal(s.pending.count,drawn);s=choose(s,{cards:s.players[0].hand.slice(0,drawn)}).state;}else assert.equal(s.pending,null);
 assert.equal(s.players[0].hand.length,before);if(s.phase==='playing')assert.equal(s.turn,1);else assert.equal(s.winner,'navy');conserve(s);
});
for(const left of [0,1,2,3])check('Pirate 5 preserves top '+left+' and privately orders three after refill',()=>{
 let s=fresh();held(s,1,'pirate-13');while(s.decks.pirate.length>left)s.players[2].played.push(s.decks.pirate.pop());const top=s.decks.pirate.slice();s=play(s,1,'pirate-13').state;
 if(left<3){assert.equal(s.pending.type,'review');assert.equal(s.pending.owner,0);assert.ok(s.pending.cards.includes('pirate-13'));assert.equal(e.visible(s,1).pending.cards,undefined);s=choose(s,{done:true}).state;}
 assert.equal(s.pending.type,'order');assert.equal(s.pending.owner,1);assert.equal(s.pending.cards.length,3);assert.deepEqual(s.pending.cards.slice(0,left),top);assert.equal(e.visible(s,0).pending.cards,undefined);
 const order=s.pending.cards.slice().reverse();s=choose(s,{cards:order}).state;assert.deepEqual(s.decks.pirate.slice(0,3),order);assert.equal(s.turn,2);conserve(s);
});
check('Justice 1 redraws hit opponents clockwise after a nonzero Navy seat',()=>{
 let s=fresh(4,2);for(const [who,card]of [[3,'pirate-1'],[0,'pirate-2'],[1,'pirate-3']]){for(const id of [...s.players[who].hand])move(s,id,()=>s.decks.pirate);held(s,who,card);}
 const next=s.decks.pirate.slice(0,3);s=play(s,2,'justice-1').state;const r=choose(s,{digit:1});assert.deepEqual(r.events.filter(x=>x.type==='draw').map(x=>x.player),[3,0,1]);for(const [i,id]of [3,0,1].entries())assert.deepEqual(r.state.players[id].hand,[next[i]]);conserve(r.state);
});
check('Peek gives Navy a private rearrangement, then only selected ally sees selected card',()=>{
 let s=play(fresh(),1,'pirate-4').state;s=choose(s,{target:2}).state;assert.equal(s.pending.type,'arrange');assert.equal(s.pending.owner,0);assert.equal(e.visible(s,2).pending.cards,undefined);
 const order=s.players[0].hand.slice().reverse();s=choose(s,{cards:order}).state;assert.equal(s.pending.type,'peek-slot');assert.equal(s.pending.owner,2);s=choose(s,{slot:0}).state;assert.deepEqual(e.visible(s,2).pending.cards,[order[0]]);for(const id of [0,1,3])assert.equal(e.visible(s,id).pending.cards,undefined);s=choose(s,{done:true}).state;assert.equal(s.turn,2);conserve(s);
});
for(const slot of [0,1])check('Hero battle selects locked slot '+slot+' only after Navy rearranges',()=>{
 let s=play(fresh(),1,'pirate-7').state;s=choose(s,{target:0}).state;
 assert.equal(s.pending.type,'arrange');assert.equal(s.pending.owner,0);
 assert.equal(e.apply(s,1,{type:'CHOOSE',slot},{rng}).ok,false);
 const order=s.players[0].hand.slice().reverse();s=choose(s,{cards:order}).state;
 assert.equal(s.pending.type,'battle-slot');assert.equal(s.pending.owner,1);
 for(const viewer of [1,2,3])assert.equal(e.visible(s,viewer).pending.cards,undefined);
 const snapshot=JSON.stringify(s),late=e.apply(s,0,{type:'CHOOSE',cards:order.slice().reverse()},{rng});
 assert.equal(late.ok,false);assert.equal(JSON.stringify(late.state),snapshot);
 const r=choose(s,{slot}),duel=r.events.find(x=>x.type==='battle-private');
 assert.equal(duel.cards.find(x=>x.player===0).card,order[slot]);
 assert.deepEqual(duel.to,[0,1]);conserve(r.state);
});
check('Peek slot cannot be reordered by Navy while reader chooses or reads',()=>{
 let s=play(fresh(),1,'pirate-4').state;s=choose(s,{target:2}).state;
 const order=s.players[0].hand.slice().reverse();s=choose(s,{cards:order}).state;
 for(const stage of ['peek-slot','read']){
  assert.equal(s.pending.type,stage);const snapshot=JSON.stringify(s);
  const denied=e.apply(s,0,{type:'CHOOSE',cards:order.slice().reverse()},{rng});
  assert.equal(denied.ok,false);assert.equal(JSON.stringify(denied.state),snapshot);
  if(stage==='peek-slot')s=choose(s,{slot:1}).state;
 }
 assert.deepEqual(e.visible(s,2).pending.cards,[order[1]]);
 for(const viewer of [0,1,3])assert.equal(e.visible(s,viewer).pending.cards,undefined);
});
for(const mode of ['peek','battle'])check(mode+' keep/swap emits identical public concealment event',()=>{
 let s=play(fresh(),1,mode==='peek'?'pirate-4':'pirate-7').state;s=choose(s,{target:mode==='peek'?2:0}).state;
 const before=s.players[0].hand.slice(),keep=e.apply(s,0,{type:'CHOOSE',cards:before},{rng}),swap=e.apply(s,0,{type:'CHOOSE',cards:before.slice().reverse()},{rng});
 assert(keep.ok&&swap.ok);assert.deepEqual(keep.events,swap.events);
 assert.deepEqual(keep.events,[{type:'hand-shuffle',player:0,to:'all'}]);
 assert.deepEqual(keep.state.players[0].hand,before);assert.deepEqual(swap.state.players[0].hand,before.slice().reverse());
 for(const viewer of [1,2,3])assert.deepEqual(e.visible(keep.state,viewer),e.visible(swap.state,viewer));
});
check('Matching duplicate Navy ranks do not expose duplicate choice to other seats',()=>{
 let s=fresh();for(const id of [...s.players[0].hand])move(s,id,()=>s.decks.navy);held(s,0,'navy-helmeppo');held(s,0,'navy-koby');s=play(s,1,'pirate-1').state;s=choose(s,{digit:1}).state;assert.equal(s.pending.type,'defeat-choice');assert.equal(e.visible(s,0).pending.cards.length,2);assert.notEqual(e.visible(s,1).pending.type,'defeat-choice');const r=choose(s,{card:'navy-koby'});assert.equal(r.events.filter(x=>x.type==='defeat').length,1);assert.equal(r.state.hp.navy,4);conserve(r.state);
});
for(const card of ['navy-garp','justice-2'])for(const rank of [2,3,4])check(card+' threshold '+rank,()=>{
 let s=fresh();for(const id of [...s.players[1].hand])move(s,id,()=>s.decks.pirate);held(s,1,e.cards.find(c=>c.team==='pirate'&&c.rank===rank).id);s=play(s,0,card).state;const r=choose(s,{target:1});assert.equal(r.state.hp.pirate,6-Number(card==='navy-garp'?rank<=3:rank>=3));conserve(r.state);
});
check('Kizaru grants one and Justice 4 grants three; pirate 4 grants one to self or ally',()=>{
 for(const [card,amount] of [['navy-kizaru',1],['justice-4',3]])assert.equal(play(fresh(),0,card).state.players[0].morale,amount);
 for(const target of [1,2]){const s=play(fresh(),1,'pirate-10').state;assert.equal(choose(s,{target}).state.players[target].morale,1);}
});
check('Justice 6 copies a faceup card without moving or duplicating it',()=>{
 let s=fresh();move(s,'navy-kizaru',()=>s.players[0].played);s=play(s,0,'justice-6').state;assert.ok(s.pending.cards.includes('navy-kizaru'));assert.ok(!s.pending.cards.includes('justice-6'));s=choose(s,{card:'navy-kizaru'}).state;assert.equal(s.players[0].morale,1);assert.ok(s.players[0].played.includes('navy-kizaru'));conserve(s);
});
for(const card of ['navy-sengoku',...Array.from({length:6},(_,i)=>'justice-'+(i+1))])check(card+' defeat redraws then recycles exactly that card',()=>{let s=fresh();held(s,0,card);s.pending={type:'defeat-choice',owner:0,cards:[card]};s.jobs=[];const r=choose(s,{card});assert.ok(!r.state.players[0].played.includes(card));assert.ok(r.state.decks.navy.includes(card));const sh=r.events.find(x=>x.type==='shuffle');assert.deepEqual(sh.cards,[card]);assert.equal(sh.reason,'defeated-special');assert.ok(r.events.findIndex(x=>x.type==='draw')<r.events.findIndex(x=>x.type==='shuffle'));conserve(r.state);});
check('Normally played Justice remains public and is not recycled',()=>{let s=play(fresh(),0,'justice-4').state;assert.ok(s.players[0].played.includes('justice-4'));assert.ok(!s.decks.navy.includes('justice-4'));conserve(s);});
report.passed=report.failures.length===0;if(process.env.MF_QA_REPORT)fs.writeFileSync(process.env.MF_QA_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
