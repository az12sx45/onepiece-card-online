import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),engine=require('../server/engine'),adapter=require('../server/card_skill_intent');
const engineFile=path.resolve(import.meta.dirname,'../server/engine.js'),hash=b=>createHash('sha256').update(b).digest('hex');
const out=process.env.CARD_LUFFY_RULE_QA_OUT||'D:/Codex_QA/card-cutin-phase-20261104/luffy-boost-'+Date.now();fs.mkdirSync(out,{recursive:true});
const report={passed:false,scope:'Real engine PLAY_CARD then actual active LUFFY_BOOST_COMMIT; synthetic hands and room. Tests public result visibility and existing authority only, no browser/deployment claim.',source:{file:engineFile,sha256:hash(fs.readFileSync(engineFile))},checks:[],cases:[]};
const check=(name,pass,detail)=>report.checks.push({name,pass:!!pass,detail});
function prepare(opponents,deck=[0,2,3,4]){
 const state=engine.createInitialState(opponents.length+1);Object.assign(state,{phase:'playing',turnIndex:0,turnStep:'choose',roundNo:808,venues:[{name:'魚人島'}],deck:[...deck],discard:[]});
 state.players.forEach((p,id)=>Object.assign(p,{alive:true,hand:id?opponents[id-1].card:8,tempDraw:id?null:9,protected:!!opponents[id-1]?.protected,dodging:!!opponents[id-1]?.dodging,gold:3}));
 const room={state},action={type:'PLAY_CARD',playerId:0,payload:{which:'hand'}};
 const played=adapter.decorate(room,state,action,engine.applyAction(state,action));room.state=played.state;
 if(room.state.pending?.action!=='luffy-boost'||room.state.pending.extra.keep!==9||room.state.discard.at(-1)!==8)throw Error('Fixture did not execute real enhanced play');
 return room;
}
function commit(room,playerId=0,payload={go:true}){
 const before=room.state,action={type:'LUFFY_BOOST_COMMIT',playerId,payload},raw=engine.applyAction(before,action),snapshot=JSON.stringify(raw.state),r=adapter.decorate(room,before,action,raw);
 if(snapshot!==JSON.stringify(r.state))throw Error('Presentation decorator changed rule state');
 return r;
}
function describe(label,room,result){const s=result.state;report.cases.push({label,alive:s.players.map(p=>p.alive),ownHand:s.players[0].hand,deckBefore:room.state.deck,deckAfter:s.deck,discard:s.discard,turnStep:s.turnStep,atk:s.stats?.[0]?.atkScore||0,def:s.stats?.[1]?.defScore||0,logs:result.emits.filter(e=>e.to==='all'&&e.type==='log').map(e=>e.text)});}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hasRedraw=result=>result.emits.some(e=>e.to==='all'&&e.type==='log'&&e.text.includes('比完尾數後補 1 張牌'));
const publicOwnDiscards=result=>result.state.players.every(({id})=>{const cards=engine.getVisibleState(result.state,id).discard;return cards.filter(card=>card===8).length===1&&cards.filter(card=>card===9).length===1;});

try{
 const split=prepare([{card:5},{card:15},{card:6},{card:16},{card:7}]),splitResult=commit(split);describe('threshold 9−3=6 eliminates tails below 6 and keeps 6 or higher',split,splitResult);
 check('strict threshold eliminates 5 and 15 while 6, 16 and 7 survive',same(splitResult.state.players.map(p=>p.alive),[true,false,false,true,true,true]));
 check('remaining opponent permits exactly one genuine replacement draw',same(splitResult.state.deck,split.state.deck.slice(0,-1))&&splitResult.state.players[0].hand===split.state.deck.at(-1)&&hasRedraw(splitResult));
 check('original attack score remains threshold times actual victims',splitResult.state.stats?.[0]?.atkScore===12);
 check('played 8 and retained 9 both become exactly one public discard',publicOwnDiscards(splitResult));
 check('retained 9 uses the existing silent discard and does not trigger Empress elimination',splitResult.state.players[0].alive&&splitResult.emits.some(e=>e.type==='silent_discard'&&e.by===0&&same(e.cards,[9])));
 check('enhanced Luffy is one global result and emits no fake individual duel',splitResult.emits.filter(e=>e.type==='card_skill_intent'&&e.cardId===8&&e.mode==='all-duel').length===1&&!splitResult.emits.some(e=>e.type==='duel'));

 const all=prepare([{card:5},{card:15}]),allResult=commit(all);describe('all other players eliminated, no replacement',all,allResult);
 check('all eliminated directly finishes original round',same(allResult.state.players.map(p=>p.alive),[true,false,false])&&allResult.state.turnStep==='ended'&&allResult.state.pending===null);
 check('all eliminated does not draw or consume the deck even when cards remain',same(allResult.state.deck,all.state.deck)&&allResult.state.players[0].hand===null&&!hasRedraw(allResult));
 check('both public 8 and 9 remain discarded on all-out finish',publicOwnDiscards(allResult));

 for(const status of ['protected','dodging']){
  const defended=prepare([{card:5,[status]:true},{card:15}]),result=commit(defended);describe(status+' leaves one opponent',defended,result);
  check(status+' still blocks a below-threshold target while the other tail-5 target dies',same(result.state.players.map(p=>p.alive),[true,true,false])&&result.emits.some(e=>e.type==='card_defense'&&e.targetId===1&&e.status===(status==='protected'?'protect':'dodge')));
  check(status+' original defensive effect and score remain',result.state.players[1][status]===(status==='protected')&&result.state.stats?.[1]?.defScore===9&&result.state.stats?.[0]?.atkScore===6);
  check(status+' surviving opponent still gives exactly one replacement',result.state.players[0].hand===defended.state.deck.at(-1)&&same(result.state.deck,defended.state.deck.slice(0,-1))&&hasRedraw(result));
 }

 const empty=prepare([{card:5},{card:15},{card:6}],[]),emptyResult=commit(empty);describe('empty deck with surviving opponent reaches existing showdown',empty,emptyResult);
 check('empty deck keeps original no-draw log and completes normal round settlement',emptyResult.state.deck.length===0&&!hasRedraw(emptyResult)&&emptyResult.emits.some(e=>e.type==='log'&&e.text.includes('牌堆已空，無法補牌'))&&emptyResult.state.turnStep==='ended'&&emptyResult.state.pending===null);
 check('empty-deck resolution still records the two actual public own discards',publicOwnDiscards(emptyResult));

 const invalid=prepare([{card:5},{card:15}]);
 const unauthorized=commit(invalid,1,{go:true});check('another player cannot commit the active Luffy effect',same(unauthorized.state,invalid.state)&&unauthorized.emits.some(e=>e.type==='toast'&&e.to===1)&&!unauthorized.emits.some(e=>e.to==='all'));
 for(const payload of [null,{}, {go:false},{go:'true'},{go:1},{go:[]}]){
  const result=commit(invalid,0,payload);check('invalid confirmation is a no-op: '+JSON.stringify(payload),same(result.state,invalid.state)&&result.emits.length===0);
 }
 check('engine source stays unchanged during rule QA',hash(fs.readFileSync(engineFile))===report.source.sha256);
 report.passed=report.checks.every(c=>c.pass);
}catch(error){report.failure=error.stack;}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(x=>!x.pass).map(x=>x.name),failure:report.failure,report:path.join(out,'report.json')}));
if(!report.passed)process.exitCode=1;
