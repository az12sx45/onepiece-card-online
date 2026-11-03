'use strict';
// Independent game: no Card/Board state, storage IDs or rules are reused.
const cards=require('../public/marineford/cards.json');
const byId=Object.fromEntries(cards.map(c=>[c.id,c]));
const clone=value=>JSON.parse(JSON.stringify(value));
const requireRule=(ok,message)=>{if(!ok)throw Error(message);};
function shuffle(a,rng=Math.random){for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function create(players,navyId=0,{rng=Math.random}={}){
 requireRule(players.length>=2&&players.length<=6,'需要 2–6 位玩家');requireRule(Number.isInteger(navyId)&&navyId>=0&&navyId<players.length,'海軍席位無效');
 const s={schema:1,revision:0,phase:'playing',turn:navyId,step:'draw',navyId,hp:{navy:players.length<=3?4:players.length+1,pirate:6},moraleRule:'mandatory',
  players:players.map((p,id)=>({id,name:String(p.name||`玩家${id+1}`).slice(0,24),avatar:Number(p.avatar)||1,team:id===navyId?'navy':'pirate',hand:[],played:[],morale:0})),
  decks:{navy:shuffle(cards.filter(c=>c.team==='navy').map(c=>c.id),rng),pirate:shuffle(cards.filter(c=>c.team==='pirate').map(c=>c.id),rng)},pending:null,jobs:[],winner:null};
 for(const p of s.players)for(let n=0;n<(p.team==='navy'?2:1);n++)p.hand.push(s.decks[p.team].shift());return s;
}
function emit(events,type,data={},to='all'){events.push({type,...data,to});}
function opponents(s,id){return s.players.filter(p=>p.team!==s.players[id].team).map(p=>p.id);}
function team(s,id){return s.players.filter(p=>p.team===s.players[id].team).map(p=>p.id);}
function endCheck(s,events,collection=false){
 const navy=s.players[s.navyId];const justice=[...navy.played,...navy.hand].filter(id=>byId[id].justice);
 const winner=s.hp.navy<=0?'pirate':s.hp.pirate<=0||collection&&s.turn===s.navyId&&new Set(justice).size===6?'navy':null;
 if(winner){s.phase='ended';s.winner=winner;s.pending=null;s.jobs=[];emit(events,'victory',{team:winner,...(winner==='navy'&&new Set(justice).size===6?{justice}: {})});return true;}return false;
}
function pending(s,type,owner,options={}){s.step='effect';s.pending={type,owner,...options};}
function prepend(s,...jobs){s.jobs.unshift(...jobs);}
function draw(s,id,events,rng){
 const p=s.players[id],deck=s.decks[p.team];
 if(!deck.length&&p.team==='pirate'){
  const available=s.players.filter(p=>p.team==='pirate').flatMap(p=>p.played);
  if(available.length){prepend(s,{type:'draw',id});pending(s,'review',s.navyId,{cards:available});emit(events,'review',{count:available.length});return;}
 }
 if(deck.length){p.hand.push(deck.shift());emit(events,'draw',{player:id});
  if(!deck.length&&p.team==='pirate'){const available=s.players.filter(p=>p.team==='pirate').flatMap(p=>p.played);if(available.length){pending(s,'review',s.navyId,{cards:available});emit(events,'review',{count:available.length});}}
 }else emit(events,'empty-deck',{team:p.team});
}
function defeat(s,id,card,events){
 const p=s.players[id],index=p.hand.indexOf(card);requireRule(index>=0,'被擊敗的牌已不在手中');p.hand.splice(index,1);s.hp[p.team]=Math.max(0,s.hp[p.team]-1);
 const recycle=byId[card].justice||card==='navy-sengoku';if(!recycle)p.played.push(card);
 emit(events,'defeat',{player:id,card,team:p.team,hp:s.hp[p.team]});
 if(endCheck(s,events))return;
 prepend(s,{type:'draw',id},...(recycle?[{type:'recycle',card}]:[]));
}
function effect(s,actor,card,events){
 const c=byId[card],navy=c.team==='navy';
 emit(events,'effect',{player:actor,card});
 if(c.rank===1){
  if(navy&&!c.justice)pending(s,'target-guess',actor,{targets:opponents(s,actor)});
  else pending(s,'guess',actor,{targets:opponents(s,actor).sort((a,b)=>(a-actor+s.players.length)%s.players.length-(b-actor+s.players.length)%s.players.length),digits:navy?[1,2,3,4,5,6]:[1,2,3,4,5,6,7]});
 }else if(c.rank===2){
  if(navy)pending(s,'threshold',actor,{targets:opponents(s,actor),high:c.justice});
  else{const allies=team(s,actor).filter(id=>id!==actor);pending(s,'peek-reader',actor,{targets:allies.length?allies:[actor]});}
 }else if(c.rank===3){pending(s,'fight-target',actor,{attacker:actor,targets:opponents(s,actor),remaining:c.justice?2:1,used:[]});
 }else if(c.rank===4){if(navy){s.players[actor].morale+=c.amount;emit(events,'morale',{player:actor,amount:c.amount});}else pending(s,'morale-target',actor,{targets:team(s,actor)});
 }else if(c.rank===5){
  if(navy){const n=Math.min(c.justice?2:1,s.decks.navy.length);if(n)prepend(s,...Array.from({length:n},()=>({type:'draw',id:actor})),{type:'return-choice',id:actor,count:n});}
  else{
   const available=s.players.filter(p=>p.team==='pirate').flatMap(p=>p.played);
   if(s.decks.pirate.length<3&&available.length){prepend(s,{type:'order-ready',id:actor});pending(s,'review',s.navyId,{cards:available});emit(events,'review',{count:available.length});}
   else pending(s,'order',actor,{cards:s.decks.pirate.slice(0,3)});
  }
 }else if(c.rank===6){
  if(navy){const options=s.players[actor].played.filter(id=>id!==card&&byId[id].rank!==7&&id!=='justice-6');if(options.length)pending(s,'copy',actor,{cards:options});}
  else pending(s,'fight-ally',actor,{targets:team(s,actor)});
 }
}
function beginBattle(s,p,target,events){
 const attacker=p.attacker,navy=s.players[s.navyId];
 emit(events,'challenge',{player:attacker,target});
 const battle={attacker,defender:target,remaining:p.remaining,used:[...p.used,target],source:p.owner};
 // Naval owner may rearrange before the pirate picks an unknown slot.
 if(attacker===s.navyId)pending(s,'battle-card',s.navyId,{battle,cards:navy.hand.slice()});
 else pending(s,'arrange',s.navyId,{battle,cards:navy.hand.slice()});
}
function prepareMorale(s,battle,navyCard,events){
 const pirate=battle.attacker===s.navyId?battle.defender:battle.attacker;
 const data={...battle,navyCard,pirate,boost:{navy:0,pirate:0},waiting:[s.navyId,pirate]};
 chooseMorale(s,data,events);
}
function chooseMorale(s,battle,events){
 while(battle.waiting.length){const id=battle.waiting.shift(),p=s.players[id];if(!p.morale)continue;
  p.morale--;battle.boost[p.team]=2;emit(events,'morale-use',{player:id});
 }
 const navy=s.players[s.navyId],pirate=s.players[battle.pirate],pirateCard=pirate.hand[0];
 requireRule(byId[battle.navyCard]&&byId[pirateCard],'沒有可出戰的牌');
 const nv=byId[battle.navyCard].rank+battle.boost.navy,pv=byId[pirateCard].rank+battle.boost.pirate;
 emit(events,'battle',{attacker:battle.attacker,defender:battle.defender,boost:battle.boost});
 emit(events,'battle-private',{cards:[{player:navy.id,card:battle.navyCard},{player:pirate.id,card:pirateCard}],values:[nv,pv]},[navy.id,pirate.id]);
 const next=battle.remaining>1?{type:'next-fight',owner:battle.source,attacker:battle.attacker,remaining:battle.remaining-1,used:battle.used}:null;
 if(next)prepend(s,next);
 if(nv<pv)defeat(s,navy.id,battle.navyCard,events);else if(pv<nv)defeat(s,pirate.id,pirateCard,events);else emit(events,'tie',{});
}
function drain(s,events,rng){
 for(let guard=0;s.phase==='playing'&&!s.pending&&s.jobs.length;guard++){
  requireRule(guard<100,'效果流程過長');const job=s.jobs.shift();
  if(job.type==='draw')draw(s,job.id,events,rng);
  else if(job.type==='recycle'){s.decks.navy.push(job.card);shuffle(s.decks.navy,rng);emit(events,'shuffle',{team:'navy',cards:[job.card],reason:'defeated-special'});}
  else if(job.type==='play-ready'){s.step='play';endCheck(s,events,true);}
  else if(job.type==='order-ready')pending(s,'order',job.id,{cards:s.decks.pirate.slice(0,3)});
  else if(job.type==='effect')effect(s,job.id,job.card,events);
  else if(job.type==='turn-end'){if(endCheck(s,events,true))return;s.turn=(s.turn+1)%s.players.length;s.step='draw';emit(events,'turn',{player:s.turn});endCheck(s,events,true);}
  else if(job.type==='guess-player'){
   const p=s.players[job.id],hits=p.hand.filter(id=>byId[id].rank===job.digit);
   emit(events,'guess-result',{player:p.id,attacker:s.turn,digit:job.digit,hit:hits.length>0});
   // The same private confirmation for one or two Navy hits avoids disclosing duplicates.
   if(hits.length&&p.team==='navy')pending(s,'defeat-choice',p.id,{cards:hits});else if(hits.length)defeat(s,p.id,hits[0],events);else emit(events,'miss',{player:p.id,digit:job.digit});
  }else if(job.type==='return-choice')pending(s,'return',job.id,{count:Math.min(job.count,s.players[job.id].hand.length),cards:s.players[job.id].hand.slice()});
  else if(job.type==='next-fight'){const targets=opponents(s,job.attacker).filter(id=>!job.used.includes(id));if(targets.length)pending(s,'fight-target',job.owner,{...job,targets,type:'fight-target'});}
 }
}
function apply(input,actor,action,{rng=Math.random}={}){
 const s=clone(input),events=[];try{
  requireRule(s.phase==='playing','本場已結束');requireRule(Number.isInteger(actor)&&!!s.players[actor],'玩家無效');requireRule(action&&typeof action.type==='string','操作無效');
  const p=s.pending;
  if(!p){requireRule(actor===s.turn,'尚未輪到你');
   if(action.type==='DRAW'){requireRule(s.step==='draw','現在不能抽牌');prepend(s,{type:'draw',id:actor},{type:'play-ready'});}
   else if(action.type==='PLAY'){requireRule(s.step==='play','請先抽牌');const player=s.players[actor],index=player.hand.indexOf(action.card);requireRule(index>=0&&byId[action.card].rank!==7,'不能打出這張牌');player.hand.splice(index,1);player.played.push(action.card);emit(events,'play',{player:actor,card:action.card});if(!endCheck(s,events))prepend(s,{type:'effect',id:actor,card:action.card},{type:'turn-end'});}
   else throw Error('操作無效');
  }else{
   requireRule(actor===p.owner,'正在等待其他玩家');requireRule(action.type==='CHOOSE','請完成目前選擇');
   const target=action.target,card=action.card;const targetOK=()=>requireRule(Number.isInteger(target)&&p.targets.includes(target),'對象無效');
   s.pending=null;
   switch(p.type){
    case 'target-guess':targetOK();pending(s,'guess',actor,{targets:[target],digits:[1,2,3,4,5,6]});break;
    case 'guess':requireRule(p.digits.includes(action.digit),'數字無效');emit(events,'guess',{player:actor,targets:p.targets,digit:action.digit});prepend(s,...p.targets.map(id=>({type:'guess-player',id,digit:action.digit})));break;
    case 'defeat-choice':requireRule(p.cards.includes(card),'選牌無效');defeat(s,actor,card,events);break;
    case 'threshold':{targetOK();const hand=s.players[target].hand[0];emit(events,'target',{player:actor,target});if(hand&&(p.high?byId[hand].rank>=3:byId[hand].rank<=3))defeat(s,target,hand,events);else emit(events,'resisted',{player:target});break;}
    case 'peek-reader':targetOK();pending(s,'arrange',s.navyId,{cards:s.players[s.navyId].hand.slice(),reader:target,source:actor});break;
    case 'peek-slot':requireRule(Number.isInteger(action.slot)&&action.slot>=0&&action.slot<p.slots,'牌位無效');pending(s,'read',actor,{cards:[s.players[s.navyId].hand[action.slot]],target:s.navyId,slot:action.slot});emit(events,'peek',{player:actor,target:s.navyId});emit(events,'peek-slot',{player:actor,target:s.navyId,slot:action.slot},[actor,s.navyId]);break;
    case 'read':requireRule(action.done===true,'請確認看完');if(Number.isInteger(p.slot)&&p.target!=null)emit(events,'peek-return',{player:actor,target:p.target,slot:p.slot},[actor,p.target]);break;
    case 'morale-target':targetOK();s.players[target].morale++;emit(events,'morale',{player:target,amount:1});break;
    case 'order':{const order=action.cards;requireRule(Array.isArray(order)&&order.length===p.cards.length&&new Set(order).size===order.length&&order.every(id=>p.cards.includes(id)),'排序無效');s.decks.pirate.splice(0,order.length,...order);emit(events,'order',{player:actor,count:order.length});break;}
    case 'return':{const ids=action.cards;requireRule(Array.isArray(ids)&&ids.length===p.count&&new Set(ids).size===ids.length&&ids.every(id=>p.cards.includes(id)),'回牌無效');for(const id of ids){s.players[actor].hand.splice(s.players[actor].hand.indexOf(id),1);s.decks.navy.push(id);}emit(events,'return',{player:actor,count:ids.length});break;}
    case 'copy':requireRule(p.cards.includes(card),'複製對象無效');prepend(s,{type:'effect',id:actor,card});break;
    case 'fight-ally':targetOK();pending(s,'fight-target',target,{attacker:target,targets:[s.navyId],remaining:1,used:[]});break;
    case 'fight-target':if(action.skip===true){emit(events,'decline',{player:actor});break;}targetOK();beginBattle(s,p,target,events);break;
    case 'battle-card':requireRule(p.cards.includes(card),'出戰牌無效');prepareMorale(s,p.battle,card,events);break;
    case 'arrange':{const ids=action.cards;requireRule(Array.isArray(ids)&&ids.length===p.cards.length&&new Set(ids).size===ids.length&&ids.every(id=>p.cards.includes(id)),'牌位排序無效');s.players[s.navyId].hand=ids.slice();emit(events,'hand-shuffle',{player:s.navyId});if(p.reader!=null)pending(s,'peek-slot',p.reader,{slots:ids.length,source:p.source});else pending(s,'battle-slot',p.battle.attacker,{battle:p.battle,slots:ids.length});break;}
    case 'battle-slot':requireRule(Number.isInteger(action.slot)&&action.slot>=0&&action.slot<p.slots,'牌位無效');prepareMorale(s,p.battle,s.players[s.navyId].hand[action.slot],events);break;
    case 'review':requireRule(action.done===true,'請確認看完');s.decks.pirate.push(...shuffle(s.players.filter(x=>x.team==='pirate').flatMap(x=>x.played.splice(0)),rng));emit(events,'shuffle',{team:'pirate'});break;
    default:throw Error('未知選擇');
   }
  }
  drain(s,events,rng);s.revision++;return {ok:true,state:s,events};
 }catch(error){return {ok:false,state:input,events:[],error:error.message};}
}
function visible(s,viewer){
 const v={schema:s.schema,revision:s.revision,phase:s.phase,turn:s.turn,step:s.step,navyId:s.navyId,hp:clone(s.hp),winner:s.winner,moraleRule:s.moraleRule,deckCounts:{navy:s.decks.navy.length,pirate:s.decks.pirate.length},players:s.players.map(p=>({...p,hand:p.id===viewer?p.hand.slice():p.hand.map(()=>null),played:p.played.slice()})),pending:null};
 if(s.pending){const p=s.pending;v.pending={type:p.type==='defeat-choice'&&p.owner!==viewer?'effect':p.type,owner:p.owner};if(p.owner===viewer){for(const key of ['targets','digits','slots','remaining','used','count','high'])if(p[key]!=null)v.pending[key]=clone(p[key]);if(p.cards)v.pending.cards=p.cards.slice();}if(p.type==='read'&&(p.owner===viewer||p.target===viewer)){v.pending.target=p.target;v.pending.slot=p.slot;}}
 return v;
}
function cpuAction(v,id,rng=Math.random){
 const choose=a=>a[Math.floor(rng()*a.length)];const p=v.pending;
 if(!p){if(id!==v.turn)return null;if(v.step==='draw')return {type:'DRAW'};const ids=v.players[id].hand.filter(c=>c&&byId[c].rank!==7);return ids.length?{type:'PLAY',card:choose(ids)}:null;}
 if(p.owner!==id)return null;const action={type:'CHOOSE'};
 if(['read','review'].includes(p.type))return {...action,done:true};
 if(p.type==='guess')return {...action,digit:choose(p.digits)};
 if(['peek-slot','battle-slot'].includes(p.type))return {...action,slot:Math.floor(rng()*p.slots)};
 if(['arrange','order'].includes(p.type))return {...action,cards:shuffle(p.cards.slice(),rng)};
 if(p.type==='return')return {...action,cards:p.cards.slice().sort((a,b)=>byId[a].rank-byId[b].rank).slice(0,p.count)};
 if(p.cards)return {...action,card:choose(p.cards)};
 if(p.targets)return {...action,target:choose(p.targets)};
 return null;
}
module.exports={cards,byId,create,apply,visible,cpuAction};
