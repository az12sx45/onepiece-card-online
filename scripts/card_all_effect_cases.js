const assert=require('node:assert/strict'),engine=require('../server/engine'),adapter=require('../server/card_skill_intent');
function buildCasesRaw(){
 const cases=[];
 function fixture(id,enhanced){const s=engine.createInitialState(6);s.turnIndex=0;s.turnStep='choose';s.roundNo=50+id;s.venues=enhanced?[{name:engine._util.cardById(id).venue}]:[];s.discard=[2,3,4];s.players.forEach((p,i)=>Object.assign(p,{hand:i===0?id:[0,4,5,7,3,6][i],tempDraw:i===0?(id===10?14:8):null,alive:true,gold:3,client:{displayName:'Audit'+i}}));return s;}
 function run(label,initial,actions,existing){const room=existing||{state:initial};for(const action of actions){const before=room.state,raw=engine.applyAction(before,action),rules=JSON.stringify(raw.state);adapter.decorate(room,before,action,raw);assert.equal(JSON.stringify(raw.state),rules,label);cases.push({label:label+'/'+action.type,before,action,state:raw.state,events:raw.emits});room.state=raw.state;}return room;}
 for(let id=0;id<20;id++)for(const enhanced of [false,true]){
  const label=`card-${id}-${enhanced?'enhanced':'normal'}`,room=run(label,fixture(id,enhanced),[{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}}]);
  for(let guard=0;room.state.pending&&guard<10;guard++){
   const s=room.state,p=s.pending,target=s.players.find(x=>x.alive&&x.id!==(p.caster??s.turnIndex))?.id;let action;
   if(p.action==='usopp')action=p.extra?.target!=null?{type:'PICK_DIGIT',payload:{digit:4}}:{type:'PICK_TARGET',payload:{target}};
   else if(p.action==='queen')action={type:'QUEEN_COIN',playerId:p.target};
   else if(p.action==='bigmom-coin')action={type:'BIGMOM_COIN'};
   else if(p.action==='bigmom-pay')action={type:'BIGMOM_CHOICE',playerId:p.target,payload:{choice:'die'}};
   else if(p.action==='kata-order')action={type:'ORDER_COMMIT',payload:{order:p.cards.slice().reverse()}};
   else if(p.action==='teach-multipick')action={type:'MULTIPICK_COMMIT',payload:{pickedIndices:[0]}};
   else if(p.action==='luffy-boost')action={type:'LUFFY_BOOST_COMMIT',payload:{go:true}};
   else if(p.action==='law'&&p.extra?.boost)action={type:'PICK_TARGET',payload:Number.isInteger(p.extra.previewTarget)?{target:p.extra.previewTarget,swap:true}:{target,preview:true}};
   else action={type:'PICK_TARGET',payload:{target,...(p.action==='killer'?{duel:true}:{})}};
   action.playerId??=p.caster??s.turnIndex;const next=run(label,s,[action],room);room.state=next.state;
   if(JSON.stringify(s.pending)===JSON.stringify(room.state.pending)&&JSON.stringify(s)===JSON.stringify(room.state))throw Error('Unhandled pending '+label+' '+p.action);
  }
  assert.equal(room.state.pending,null,'all choices covered '+label);
 }
 const silent=fixture(5,false);silent.saboSilenceOn=true;silent.players[1].hand=19;run('zoro-secondary-silence',silent,[{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},{type:'PICK_TARGET',playerId:0,payload:{target:1}}]);
 const muted=fixture(19,true);muted.saboSilenceOn=true;run('silenced-roger',muted,[{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}}]);
 const chain=fixture(5,false);chain.venues=[{name:'奧羅傑克森號'}];chain.players[1].hand=19;run('zoro-roger-chain',chain,[{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},{type:'PICK_TARGET',playerId:0,payload:{target:1}},{type:'PICK_TARGET',playerId:1,payload:{target:2}}]);
 for(const [card,enhanced] of [[1,false],[3,false],[5,true],[6,false],[8,false],[10,false],[14,true],[16,true]])for(const protection of ['protected','dodging']){const s=fixture(card,enhanced);s.players[1][protection]=true;const room=run(`${card}-${protection}`,s,[{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}}]);if(room.state.pending?.action==='usopp')run(`${card}-${protection}`,room.state,[{type:'PICK_TARGET',playerId:0,payload:{target:1}},{type:'PICK_DIGIT',playerId:0,payload:{digit:4}}],room);else if(room.state.pending)run(`${card}-${protection}`,room.state,[{type:'PICK_TARGET',playerId:0,payload:{target:1}}]);}

 for(const card of [12,14])for(const face of ['heads','tails']){
  const s=fixture(card,false),room=run(`${card}-${face}`,s,[{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}}]),random=Math.random;
  try{Math.random=()=>face==='heads'?0.1:0.9;run(`${card}-${face}`,room.state,[{type:card===12?'QUEEN_COIN':'BIGMOM_COIN',playerId:card===12?room.state.pending.target:0}],room);}finally{Math.random=random;}
 }
 for(const choice of ['pay','die']){const room=run('bigmom-'+choice,fixture(14,true),[{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},{type:'PICK_TARGET',playerId:0,payload:{target:1}}]);run('bigmom-'+choice,room.state,[{type:'BIGMOM_CHOICE',playerId:1,payload:{choice}}],room);}
 for(const id of [3,8,10,13])for(const keep of [0,4]){const s=fixture(id,id===13);s.players[0].tempDraw=keep;run(`duel-${id}-keep-${keep}`,s,[{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},{type:'PICK_TARGET',playerId:0,payload:{target:1,duel:true}}]);}

 for(const enhanced of [false,true]){const s=fixture(18,enhanced);s.deck=[2,3];run('shanks-showdown-'+enhanced,s,[{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}}]);}
 for(const id of [3,19]){const s=fixture(id,false);s.players.slice(2).forEach(p=>{p.alive=false;p.hand=null;});run('last-opponent-'+id,s,[{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},...(id===3?[{type:'PICK_TARGET',playerId:0,payload:{target:1}}]:[])]);}
 return cases;
}
function buildCases(){const old=Math.random;let seed=0x31ca4d;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};try{return buildCasesRaw();}finally{Math.random=old;}}
module.exports={buildCases};
if(require.main===module){const cases=buildCases();console.log(JSON.stringify({cases:cases.length,byCard:[...new Set(cases.map(c=>c.label.split('/')[0]))],pending:cases.filter(c=>c.state.pending).length}));}
