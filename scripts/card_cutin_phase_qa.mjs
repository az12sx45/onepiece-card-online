import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url),engine=require('../server/engine'),adapter=require('../server/card_skill_intent'),barrier=require('../server/card_presentation_ready');
const mobile='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/web';
const modules=['card-phone-flow.js','card-result-cutins.js','card-status-reveal.js'];
const hash=b=>createHash('sha256').update(b).digest('hex'),sources=Object.fromEntries(modules.map(name=>[name,fs.readFileSync(mobile+'/'+name,'utf8')]));
const out=process.env.CARD_CUTIN_PHASE_QA_OUT||'D:/Codex_QA/card-cutin-phase-20261104/'+Date.now();fs.mkdirSync(out,{recursive:true});
const report={passed:false,scope:'Real engine/decorator/room presentation IDs and actual canonical EMIT/STATE queue, cut-in and avatar-status wrappers. DOM, clock and existing movie/skill painters are instrumented to inspect order; not physical-device or publication acceptance.',source:modules.map(name=>({file:mobile+'/'+name,bytes:Buffer.byteLength(sources[name]),sha256:hash(sources[name])})),checks:[],cases:[],errors:[]};
for(const name of ['engine.js','card_skill_intent.js']){const file=path.resolve(import.meta.dirname,'../server',name),bytes=fs.readFileSync(file);report.source.push({file,bytes:bytes.length,sha256:hash(bytes)});}
const all=require('./card_all_effect_cases').buildCases(),sample=label=>{const c=all.find(x=>x.label===label);if(!c)throw Error('Missing fixture '+label);return structuredClone(c);};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<900;i++){if(fn())return;await wait(2);}throw Error('Timed out: '+label);}
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});if(!pass)throw Error(name+' '+JSON.stringify(detail));};
function accepted(room,action,label){const before=room.state,raw=engine.applyAction(before,action),rules=JSON.stringify(raw.state),result=adapter.decorate(room,before,action,raw);if(rules!==JSON.stringify(result.state))throw Error('Rules changed during decoration');room.state=result.state;return{label,before,state:result.state,events:result.emits,gate:barrier.begin(room)};}
function pubState(s,gate){const p=s.pending;return {roundNo:s.roundNo,turnIndex:s.turnIndex,turnStep:s.turnStep,phase:s.phase,iceWindowOn:s.iceWindowOn,nextRoundStart:s.nextRoundStart,rogerPred:structuredClone(s.rogerPred),venues:structuredClone(s.venues),log:[...s.log],players:s.players.map(({id,alive,protected:protect,dodging,skipNext,frozen,iceInfected,gold,isCPU})=>({id,alive,protected:protect,dodging,skipNext,frozen,iceInfected,gold,isCPU})),pending:p?{action:p.action,extra:p.extra?{firstDone:p.extra.firstDone,previewTarget:p.extra.previewTarget,disarmedTarget:p.extra.disarmedTarget}:undefined}:null,presentationReady:gate||null};}
function withGate(c){if(!c.gate)c.gate=barrier.begin({state:c.state});return c;}
function noteError(error){report.errors.push(String(error?.stack||error));}
process.on('unhandledRejection',noteError);

async function harness(initial,{viewer=0,movieWait,artWait,guardPrivate=false,keepPrivateOpen=false}={}){
 const trace=[],sent=[],handlers=new Map(),domListeners=new Map(),nodes=new Map();let document,context;
 const note=(event,detail={})=>trace.push({event,...detail});
 class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={setProperty(){}};this.attributes={};this.parent=null;this.hidden=false;this._text='';this.className='';this.classList={contains:key=>this.className.split(' ').includes(key)};}
  set textContent(value){this._text=String(value);}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  setAttribute(key,value){this.attributes[key]=String(value);}
  getClientRects(){return this.hidden?[]:[{}];}
  append(...children){for(const node of children){node.parent=this;this.children.push(node);if(this===document.body&&node.className==='card-anime-skill')note('cutin-open',{card:Number(node.dataset.card),phase:node.dataset.cutinPhase,text:node.textContent});}}
  remove(){if(this.parent===document.body&&this.className==='card-anime-skill')note('cutin-close',{card:Number(this.dataset.card),phase:this.dataset.cutinPhase});if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
  animate(){return{cancel(){}};}
 }
 document={readyState:'complete',hidden:false,documentElement:{dataset:{cardFlow:'online-pending'}},body:new Element('body'),createElement:tag=>new Element(tag),getElementById:id=>nodes.get(id)||null,addEventListener(type,fn){if(!domListeners.has(type))domListeners.set(type,[]);domListeners.get(type).push(fn);}};
 const reader=new Element('section');reader.hidden=true;nodes.set('phonePrivateReveal',reader);
 const socket={on(type,fn){if(!handlers.has(type))handlers.set(type,[]);handlers.get(type).push(fn);},listeners(type){return [...(handlers.get(type)||[])];},off(type,fn){handlers.set(type,(handlers.get(type)||[]).filter(x=>x!==fn));}};
 const deliver=(type,data)=>{for(const fn of socket.listeners(type))fn(data);};
 socket.on('STATE',s=>{context.state=s;note('commit',{round:s.roundNo,pending:s.pending?.action||null});});
 const api={
  presentPlayEvent(e){if(e.to==='all'&&e.type==='log'&&/ 打出 \d+｜/.test(e.text||''))note('center-card');},
  async presentCardSkillBatch(events,next){
   note('old-skill',{hasIntent:events.some(e=>e.type==='card_skill_intent'),nextGate:next?.presentationReady?.id||null});
   for(const e of events.filter(e=>e.to==='all'&&e.type==='enh_fx')){note('movie-start',{card:e.cardId});if(movieWait)await movieWait();note('movie-end',{card:e.cardId});}
   return null;
  },
  presentEffectEvent(e){
   note('effect:'+e.type,{target:e.targetId});
   if(e.type==='robin_view'&&e.to===viewer){if(guardPrivate)void e.cardId;note('private-robin',{target:e.targetId});if(keepPrivateOpen)reader.hidden=false;}
   if(e.type==='kata_peek'&&e.to===viewer){if(guardPrivate)void e.cards;note('private-kata');}
   if(e.type==='teach_cover'&&e.to===viewer){if(guardPrivate)void e.cards;note('private-teach');}
  },
  async presentPileBatch(){note('pile');return 'original-pile';},
  isCardEntering:()=>false,isCardSkillIntroBusy:()=>false,isEffectBusy:()=>false,isCoinBusy:()=>false,isEnhancementBusy:()=>false,cancelCardSkillIntro(){},
  async loadCardArt(kind,id){note('art',{kind,card:id});if(artWait)await artWait(kind,id);return {src:'http://fixture/'+kind+'-'+id+'.webp'};}
 };
 context=vm.createContext({window:{CardPhonePresentation:api,__TABLETOP_ANDROID_TEST_ORIGIN:'http://fixture',addEventListener(){}},location:{origin:'http://fixture',pathname:'/game.html'},document,socket,me:{roomId:'CUTIN-PHASE-QA',playerId:viewer},state:pubState(initial),CARD_TEXT:Object.fromEntries(Array.from({length:20},(_,id)=>[id,{name:engine._util.cardById(id).name,baseTitle:'招式',enhTitle:'強化招式'}])),pname:id=>'Audit'+id,isEnhancedNow:id=>context.state?.venues?.some(v=>v.name===engine._util.cardById(id).venue),sendAction:(...args)=>sent.push(args),playDuel:opts=>note('duel',{left:opts.leftId,right:opts.rightId}),openLawSwap:target=>note('private-law',{target}),playCoinFx:()=>note('coin'),playEnhFxFor:id=>note('legacy-movie-dispatch',{card:id}),matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>setTimeout(fn,0),MutationObserver:class{observe(){}},setTimeout:(fn,ms)=>setTimeout(fn,Math.min(3,ms||0)),clearTimeout});
 for(const name of modules)vm.runInContext(sources[name],context,{filename:name});
 await until(()=>api.resultCutinVersion>=3&&api.presentationFlowVersion>=2&&api.avatarStatusRevealVersion>=2,'current wrappers mounted');
 function enqueue(c){
  withGate(c);
  for(const e of c.events.filter(e=>e.to==='all'||e.to===viewer)){
   let received=e;
   if(guardPrivate&&e.to===viewer&&['robin_view','peek','law_view','kata_peek','teach_cover'].includes(e.type)){
    received={...e};for(const field of ['cardId','lines','cards'])if(Object.hasOwn(received,field)){
     const value=received[field];Object.defineProperty(received,field,{get(){const opened=trace.some(x=>x.event==='cutin-open'),closed=trace.some(x=>x.event==='cutin-close');if(!opened||!closed)throw Error('Read private '+field+' before the public cut-in completed');return value;}});
    }
   }
   deliver('EMIT',received);
  }
  deliver('STATE',pubState(c.state,c.gate));
 }
 const idle=()=>until(()=>api.presentationQueueSize()===0,'presentation queue drain');
 const cutins=()=>trace.filter(x=>x.event==='cutin-open');
 return{trace,sent,api,context,enqueue,deliver,idle,cutins,closeReader(){reader.hidden=true;}};
}
const index=(trace,event)=>trace.findIndex(x=>x.event===event);
async function phaseCase(input,{effect,text,movie=false,guardPrivate=false,none=false,viewer=0}={}){
 const c=typeof input==='string'?sample(input):input,label=c.label,h=await harness(c.before,{viewer,guardPrivate});h.enqueue(c);await h.idle();
 const rows=h.cutins(),close=index(h.trace,'cutin-close'),real=index(h.trace,effect||'pile'),commit=h.trace.findLastIndex(x=>x.event==='commit');
 check(label+' authoritative transaction forwards next identity and retains original effects',h.trace.some(x=>x.event==='old-skill'&&!x.hasIntent&&x.nextGate===c.gate.id)&&real>=0&&commit>real&&!h.sent.length,h.trace);
 check(label+' phase and authoritative outcome text',none?rows.length===0:rows.length===1&&rows[0].phase==='before'&&rows[0].text.includes(text)&&close>=0&&close<real,{rows,trace:h.trace});
 if(movie)check(label+' accepted enhancement movie completes before the diagonal',index(h.trace,'movie-end')>=0&&index(h.trace,'movie-end')<index(h.trace,'cutin-open'),h.trace);
 report.cases.push({label,trace:h.trace});return h;
}
try{
 await phaseCase('card-0-normal/PLAY_CARD',{text:'洗牌',effect:'pile'});
 await phaseCase('card-0-enhanced/PLAY_CARD',{text:'洗牌',effect:'pile',movie:true});
 const saboBase=sample('card-0-normal/PLAY_CARD').before;saboBase.players[1].protected=true;
 await phaseCase(accepted({state:saboBase},{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},'Sabo partly defended still shuffles'),{text:'洗牌',effect:'effect:card_defense'});
 const shuffleOnly=sample('card-0-normal/PLAY_CARD').before;shuffleOnly.players.forEach(p=>p.protected=true);
 await phaseCase(accepted({state:shuffleOnly},{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},'Sabo all hands guarded still shuffles the deck'),{text:'重新洗牌',effect:'pile'});
 await phaseCase('card-2-normal/PLAY_CARD',{none:true});
 await phaseCase('card-2-normal/PICK_TARGET',{text:'查看 Audit1 的手牌',effect:'private-robin',guardPrivate:true});
 await phaseCase('card-2-enhanced/PLAY_CARD',{text:'查看全體玩家',effect:'private-robin',movie:true,guardPrivate:true});
 const robinBase=sample('card-2-enhanced/PLAY_CARD').before;robinBase.players.slice(1).forEach(p=>p.protected=true);
 await phaseCase(accepted({state:robinBase},{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},'Robin full-table scan with every other player guarded'),{none:true,effect:'effect:card_defense'});
 await phaseCase('card-2-normal/PICK_TARGET',{text:'查看 Audit1 的手牌',effect:'effect:robin_peek',viewer:1});
 await phaseCase('card-3-normal/PLAY_CARD',{none:true});
 await phaseCase('card-3-normal/PICK_TARGET',{text:'向 Audit1 發起決鬥',effect:'duel'});
 await phaseCase('card-4-normal/PLAY_CARD',{text:'展開防禦',effect:'effect:chopper_status'});
 await phaseCase('card-4-enhanced/PLAY_CARD',{text:'展開防禦',effect:'effect:chopper_status',movie:true});
 await phaseCase('card-5-normal/PICK_TARGET',{text:'Audit1 的 4 號卡',effect:'effect:zoro_discard'});
 await phaseCase('card-6-normal/PICK_TARGET',{text:'與 Audit1 交換手牌',effect:'effect:law_swap'});
 await phaseCase('card-7-normal/PLAY_CARD',{text:'娜美登場',effect:'pile'});
 await phaseCase('card-7-enhanced/PLAY_CARD',{none:true});
 await phaseCase('card-7-enhanced/PICK_TARGET',{text:'麻痺 Audit1',effect:'effect:nami_paralyze'});
 const luffyBoostBase=sample('card-8-enhanced/LUFFY_BOOST_COMMIT').before;luffyBoostBase.pending.extra.keep=9;luffyBoostBase.players[0].hand=9;luffyBoostBase.players[1].hand=6;luffyBoostBase.players[2].hand=16;luffyBoostBase.players[3].hand=7;
 const luffyBoost=accepted({state:luffyBoostBase},{type:'LUFFY_BOOST_COMMIT',playerId:0,payload:{go:true}},'Luffy enhanced inclusive real threshold'),luffyBoostView=await phaseCase(luffyBoost,{text:'對全體玩家發起比拚',effect:'pile'});
 check('one enhanced Luffy global cue preserves the exact new real results without fake duels',index(luffyBoostView.trace,'duel')<0&&!luffyBoostView.context.state.players[1].alive&&!luffyBoostView.context.state.players[2].alive&&luffyBoostView.context.state.players[3].alive&&luffyBoost.state.discard.includes(8)&&luffyBoost.state.discard.includes(9),luffyBoostView.trace);
 await phaseCase('card-9-normal/PLAY_CARD',{text:'女帝招式發動',effect:'pile'});
 await phaseCase('card-9-enhanced/PLAY_CARD',{text:'女帝招式發動',effect:'pile',movie:true});
 await phaseCase('card-10-normal/PLAY_CARD',{none:true});
 await phaseCase('card-10-normal/PICK_TARGET',{text:'向 Audit1 發起比大小',effect:'duel'});
 const kaido=sample('card-10-enhanced/PLAY_CARD'),kaidoView=await phaseCase(kaido,{text:'向全體玩家發動霸海',effect:'pile',movie:true});
 check('enhanced Kaido uses public success and the original authoritative eliminations',kaido.state.players.slice(1).every(p=>!p.alive)&&kaidoView.context.state.players.slice(1).every(p=>!p.alive),kaidoView.trace);
 const noCombo=sample('card-10-enhanced/PLAY_CARD').before;noCombo.players[0].tempDraw=8;
 const failedKaido=accepted({state:noCombo},{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},'Kaido enhanced public failed cast'),failedView=await phaseCase(failedKaido,{text:'施放失敗',effect:'pile'});
 check('enhanced Kaido failed cast never plays a movie or invents an elimination',index(failedView.trace,'movie-start')<0&&failedKaido.state.players.every(p=>p.alive)&&!failedView.cutins()[0].text.includes('向全體玩家發動霸海'),failedView.trace);
 await phaseCase('card-11-normal/PLAY_CARD',{text:'洗棄牌後從背面抽取一張',effect:'pile',viewer:1});
 await phaseCase('card-11-enhanced/PLAY_CARD',{text:'逆時針傳遞手牌',effect:'pile',movie:true});
 const boostedKid=sample('card-11-enhanced/PLAY_CARD').before;boostedKid.players[1].protected=true;
 await phaseCase(accepted({state:boostedKid},{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},'Kid partial guard keeps actual card rotation'),{text:'逆時針傳遞手牌',effect:'pile',movie:true});
 const queenBoost=sample('card-12-enhanced/PLAY_CARD'),iceView=await phaseCase(queenBoost,{text:'開啟冰鬼判定',effect:'pile',movie:true});
 check('enhanced Queen opens the real ice window without inventing immediate infected players',iceView.context.state.iceWindowOn===true&&iceView.context.state.players.every(p=>!p.iceInfected),iceView.trace);
 await phaseCase('card-13-normal/PICK_TARGET',{text:'解除 Audit1 的保護／閃避',effect:'effect:killer_disarm'});
 await phaseCase('card-13-enhanced/PICK_TARGET',{text:'解除 Audit1 的保護／閃避後決鬥',effect:'duel'});
 for(const label of ['3-protected/PICK_TARGET','5-dodging/PICK_TARGET','6-protected/PICK_TARGET','8-dodging/PICK_TARGET','1-protected/PICK_TARGET'])await phaseCase(label,{none:true,effect:'effect:card_defense'});
 for(const label of ['bigmom-pay/BIGMOM_CHOICE','bigmom-die/BIGMOM_CHOICE'])await phaseCase(label,{none:true});
 await phaseCase('14-protected/PICK_TARGET',{none:true,effect:'effect:card_defense'});
 await phaseCase('card-14-enhanced/PLAY_CARD',{none:true});
 await phaseCase('card-15-normal/PLAY_CARD',{text:'查看未來',effect:'private-kata',guardPrivate:true});
 const otherKata=await phaseCase('card-15-normal/PLAY_CARD',{text:'查看未來',effect:'pile',viewer:1});
 check('an observer sees the public future cue but receives no private top-deck cards',index(otherKata.trace,'private-kata')<0&&index(otherKata.trace,'effect:kata_peek')<0,otherKata.trace);
 await phaseCase('card-16-normal/PLAY_CARD',{none:true});
 await phaseCase('card-16-normal/PICK_TARGET',{text:'凍結 Audit1',effect:'effect:aokiji_freeze'});
 await phaseCase('card-16-enhanced/PLAY_CARD',{text:'施放全場凍結',effect:'effect:aokiji_freeze',movie:true});
 const partialFreeze=await phaseCase('16-protected/PLAY_CARD',{text:'實際凍結 Audit2',effect:'effect:aokiji_freeze',movie:true});
 check('enhanced Aokiji does not name or freeze the guarded target',!partialFreeze.cutins()[0].text.includes('Audit1')&&!partialFreeze.context.state.players[1].frozen&&partialFreeze.context.state.players[2].frozen,partialFreeze.trace);
 const freezeBlocked=sample('card-16-enhanced/PLAY_CARD').before;freezeBlocked.players.slice(1).forEach(p=>p.protected=true);
 await phaseCase(accepted({state:freezeBlocked},{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},'Aokiji all opponents guarded'),{none:true,effect:'effect:card_defense'});
 const dodgeFreeze=sample('card-16-normal/PICK_TARGET').before;dodgeFreeze.players[1].dodging=true;
 await phaseCase(accepted({state:dodgeFreeze},{type:'PICK_TARGET',playerId:0,payload:{target:1}},'Aokiji selected target dodges'),{none:true,effect:'effect:card_defense'});
 const teach=sample('card-17-normal/PLAY_CARD');await phaseCase(teach,{text:'準備覆蓋牌堆頂牌',effect:'private-teach',guardPrivate:true});
 const otherTeach=await phaseCase(teach,{text:'準備覆蓋牌堆頂牌',effect:'pile',viewer:1});
 check('ordinary Teach shares no covered face and the observer receives only a back',!otherTeach.cutins()[0].text.match(/\d+\s*號卡/)&&index(otherTeach.trace,'private-teach')<0&&engine.getVisibleState(teach.state,1).discard.some(card=>card?.back===true),otherTeach.trace);
 for(const boosted of [false,true]){
  const shanks=await phaseCase('shanks-showdown-'+boosted+'/PLAY_CARD',{text:'全場比牌',effect:'pile',movie:boosted});
  check('actual qualifying Shanks showdown is committed after the cue ('+boosted+')',shanks.context.state.turnStep==='ended'&&!shanks.cutins()[0].text.includes('最高'),shanks.trace);
  const noShowdown=await phaseCase('card-18-'+(boosted?'enhanced':'normal')+'/PLAY_CARD',{text:'施放失敗',effect:'pile'});
  check('actual non-qualifying Shanks neither starts a movie nor fabricates a showdown ('+boosted+')',index(noShowdown.trace,'movie-start')<0&&noShowdown.context.state.turnStep!=='ended'&&!noShowdown.cutins()[0].text.includes('全場比牌'),noShowdown.trace);
 }
 const ordinaryRoger=await phaseCase('card-19-normal/PLAY_CARD',{text:'退出本局，成為下局先手',effect:'effect:silent_discard'});
 check('ordinary Roger applies the actual own elimination and next-starter flag only on STATE',ordinaryRoger.context.state.players[0].alive===false&&ordinaryRoger.context.state.nextRoundStart===0,ordinaryRoger.trace);

 const room={state:sample('card-6-enhanced/PICK_TARGET').before},law=await harness(room.state,{guardPrivate:true});
 const peek=accepted(room,{type:'PICK_TARGET',playerId:0,payload:{target:1,preview:true}},'law-preview');law.enqueue(peek);await law.idle();
 const swap=accepted(room,{type:'PICK_TARGET',playerId:0,payload:{target:1,swap:true}},'law-swap');const previous=law.trace.length;law.enqueue(swap);await law.idle();
 check('enhanced Law only shows the target preview cue; actual confirmed swap follows directly',law.cutins().length===1&&law.cutins()[0].text.includes('查看 Audit1')&&index(law.trace,'cutin-close')<index(law.trace,'private-law')&&index(law.trace,'effect:law_swap')>=previous&&swap.state.players[0].hand===swap.before.players[1].hand,law.trace);
 report.cases.push({label:'enhanced Law single preview cue then direct exchange',trace:law.trace});

 const killerRoom={state:sample('card-13-enhanced/PICK_TARGET').before};killerRoom.state.players[1].protected=true;
 const killer=await harness(killerRoom.state),disarm=accepted(killerRoom,{type:'PICK_TARGET',playerId:0,payload:{target:1}},'killer-disarm-first');killer.enqueue(disarm);await killer.idle();
 check('enhanced Killer first target diagonal finishes before true disarm and its confirm STATE',killer.cutins().length===1&&killer.cutins()[0].text.includes('解除 Audit1')&&index(killer.trace,'cutin-close')<index(killer.trace,'effect:killer_disarm')&&index(killer.trace,'effect:killer_disarm')<index(killer.trace,'commit')&&killer.context.state.pending?.extra?.disarmedTarget===1&&!killer.context.state.players[1].protected,killer.trace);
 const afterDisarm=structuredClone(killerRoom.state),duel=accepted(killerRoom,{type:'PICK_TARGET',playerId:0,payload:{target:1,duel:true}},'killer-duel-confirmed'),killerBoundary=killer.trace.length;killer.enqueue(duel);await killer.idle();
 const duelTrace=killer.trace.slice(killerBoundary);check('only the real enhanced Killer duel confirmation receives a second diagonal',killer.cutins().length===2&&killer.cutins()[1].text.includes('向 Audit1 發起決鬥')&&index(duelTrace,'cutin-close')<index(duelTrace,'duel')&&index(duelTrace,'effect:killer_disarm')<0,killer.trace);
 const declineKiller=await harness(disarm.before);declineKiller.enqueue(disarm);await declineKiller.idle();const decline=accepted({state:afterDisarm},{type:'PICK_CANCEL',playerId:0},'killer-no-duel');declineKiller.enqueue(decline);await declineKiller.idle();
 check('declining the real Killer follow-up never adds another diagonal or duel',declineKiller.cutins().length===1&&index(declineKiller.trace,'duel')<0&&declineKiller.context.state.pending===null,declineKiller.trace);
 report.cases.push({label:'enhanced Killer disarm and true duel confirmation',trace:killer.trace});

 const kataRoom={state:sample('card-15-enhanced/PLAY_CARD').before},kata=await harness(kataRoom.state);
 const sort=accepted(kataRoom,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},'Kata initial order preview');kata.enqueue(sort);await kata.idle();
 check('enhanced Kata movie and future cue both finish before the original private sorting STATE',kata.cutins().length===1&&kata.cutins()[0].text.includes('查看未來')&&index(kata.trace,'movie-end')<index(kata.trace,'cutin-open')&&index(kata.trace,'cutin-close')<index(kata.trace,'commit')&&kata.context.state.pending?.action==='kata-order',kata.trace);
 const ordered=accepted(kataRoom,{type:'ORDER_COMMIT',playerId:0,payload:{order:sort.state.pending.cards.slice().reverse()}},'Kata actual order commit');kata.enqueue(ordered);await kata.idle();
 check('putting the privately ordered cards back never adds another future cut-in',kata.cutins().length===1&&kata.context.state.pending===null&&ordered.events.some(e=>e.to===0&&e.type==='kata_order_done'),kata.trace);
 report.cases.push({label:'enhanced Kata start and private order commit',trace:kata.trace});

 const teachRoom={state:sample('card-17-enhanced/PLAY_CARD').before},teachView=await harness(teachRoom.state,{guardPrivate:true});
 const chooseCover=accepted(teachRoom,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},'Teach initial choice');teachView.enqueue(chooseCover);await teachView.idle();
 check('enhanced Teach movie and cover cue finish before private choice STATE',teachView.cutins().length===1&&index(teachView.trace,'movie-end')<index(teachView.trace,'cutin-open')&&index(teachView.trace,'cutin-close')<index(teachView.trace,'commit')&&teachView.context.state.pending?.action==='teach-multipick',teachView.trace);
 const covered=accepted(teachRoom,{type:'MULTIPICK_COMMIT',playerId:0,payload:{pickedIndices:[0]}},'Teach actual cover choice');teachView.enqueue(covered);await teachView.idle();
 check('confirmed Teach cover reaches original private read and masked discard without another cut-in',teachView.cutins().length===1&&index(teachView.trace,'private-teach')>index(teachView.trace,'cutin-close')&&teachView.context.state.pending===null&&engine.getVisibleState(covered.state,1).discard.some(card=>card?.back===true),teachView.trace);
 report.cases.push({label:'enhanced Teach start and private cover commit',trace:teachView.trace});

 const rogerRoom={state:sample('card-19-enhanced/PLAY_CARD').before},roger=await harness(rogerRoom.state);
 const startRoger=accepted(rogerRoom,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},'Roger initial enhanced cast');roger.enqueue(startRoger);await roger.idle();
 check('enhanced Roger plays its existing movie but waits for an actual chosen prediction',roger.cutins().length===0&&index(roger.trace,'movie-end')>=0&&roger.context.state.pending?.action==='roger',roger.trace);
 const chosenRoger=accepted(rogerRoom,{type:'PICK_TARGET',playerId:0,payload:{target:1}},'Roger actual prediction'),rogerBoundary=roger.trace.length;roger.enqueue(chosenRoger);await roger.idle();
 const rogerTrace=roger.trace.slice(rogerBoundary);check('Roger prediction diagonal names the target before its authoritative portrait marker STATE',roger.cutins().length===1&&roger.cutins()[0].text.includes('預測 Audit1 贏得本局')&&index(rogerTrace,'cutin-close')<index(rogerTrace,'commit')&&roger.context.state.rogerPred?.by===0&&roger.context.state.rogerPred?.pick===1,roger.trace);
 const showdown=structuredClone(rogerRoom.state);showdown.turnIndex=1;showdown.turnStep='choose';showdown.deck=[2,3];showdown.players.forEach((p,i)=>{p.alive=i<2;});showdown.players[0].hand=2;showdown.players[1].hand=18;showdown.players[1].tempDraw=9;
 roger.deliver('STATE',pubState(showdown));await roger.idle();const settledRoger=accepted({state:showdown},{type:'PLAY_CARD',playerId:1,payload:{which:'hand'}},'Roger successful later round settlement');roger.enqueue(settledRoger);await roger.idle();
 check('real later Roger reward log does not replay the prediction diagonal',settledRoger.state.log.some(text=>/^☆ 羅傑預測成功/.test(text))&&roger.cutins().filter(x=>x.card===19).length===1&&roger.context.state.turnStep==='ended',roger.trace);
 report.cases.push({label:'enhanced Roger choice and actual later reward',trace:roger.trace});
 const forced=structuredClone(all.find(c=>c.label==='zoro-roger-chain/PICK_TARGET'&&c.events.some(e=>e.type==='card_skill_intent'&&e.cardId===19)));
 const forcedRoger=await phaseCase(forced,{text:'預測 Audit2 贏得本局',effect:'pile'});
 check('forced-discard Roger uses the actual owner and chosen public target',forcedRoger.cutins()[0].text.includes('Audit1 · 哥爾羅傑')&&forcedRoger.context.state.rogerPred?.by===1&&forcedRoger.context.state.rogerPred?.pick===2,forcedRoger.trace);

 const luffyRoom={state:sample('card-8-normal/PICK_TARGET').before};luffyRoom.state.pending.extra.keep=6;luffyRoom.state.players[0].hand=6;luffyRoom.state.players[1].hand=16;
 const luffy=await harness(luffyRoom.state),first=accepted(luffyRoom,{type:'PICK_TARGET',playerId:0,payload:{target:1}},'luffy-first-draw');luffy.enqueue(first);await luffy.idle();
 luffy.enqueue(first);await luffy.idle();check('same Luffy transaction retransmission does not reopen the diagonal',luffy.cutins().length===1,luffy.trace);
 const second=accepted(luffyRoom,{type:'LUFFY_SECOND',playerId:0,payload:{target:1}},'luffy-second-same-target');const boundary=luffy.trace.length;luffy.enqueue(second);await luffy.idle();
 const secondTrace=luffy.trace.slice(boundary);check('a genuinely accepted Luffy second duel may pick the same target once',first.gate.id!==second.gate.id&&luffy.cutins().length===2&&index(secondTrace,'cutin-close')>=0&&index(secondTrace,'cutin-close')<index(secondTrace,'duel'),luffy.trace);
 report.cases.push({label:'Luffy two accepted same-target duels',trace:luffy.trace});

 const namiBase=sample('card-7-enhanced/PICK_TARGET').before;namiBase.players[1].skipNext=true;
 const nami=accepted({state:namiBase},{type:'PICK_TARGET',playerId:0,payload:{target:1}},'already-paralyzed-Nami'),held=await harness(nami.before);held.enqueue(nami);await held.idle();
 check('Nami already-paralyzed status stays real but gains no second diagonal',nami.state.players[1].skipNext&&held.cutins().length===0&&index(held.trace,'effect:nami_paralyze')>=0,held.trace);
 const blockedNami=sample('card-7-enhanced/PICK_TARGET').before;blockedNami.players[1].protected=true;
 await phaseCase(accepted({state:blockedNami},{type:'PICK_TARGET',playerId:0,payload:{target:1}},'Nami target protected'),{none:true,effect:'effect:card_defense'});
 const legacy=sample('card-7-normal/PLAY_CARD');legacy.events=legacy.events.filter(e=>e.type!=='card_skill_intent');const legacyView=await harness(legacy.before);legacyView.enqueue(legacy);await legacyView.idle();
 check('ordinary Nami legacy public play log is sufficient without any private-card lookup',legacyView.cutins().length===1&&legacyView.cutins()[0].text.includes('娜美登場'),legacyView.trace);
 const silent=structuredClone(legacy);silent.events.push({to:'all',type:'log',text:'【靜默】技能不結算'});const silentView=await harness(silent.before);silentView.enqueue(silent);await silentView.idle();
 check('a silenced ordinary Nami does not fabricate an accepted fallback cut-in',silentView.cutins().length===0,silentView.trace);

 for(const [face,text,key] of [['heads','獲得護盾保護','protected'],['tails','獲得閃避','dodging']]){
  const mom=sample('14-'+face+'/BIGMOM_COIN'),momView=await harness(mom.before);momView.enqueue(mom);await momView.idle();
  check('normal Big Mom '+face+' keeps coin → actual result diagonal → acquired portrait status',momView.cutins().length===1&&momView.cutins()[0].phase==='after'&&momView.cutins()[0].text.includes(text)&&index(momView.trace,'coin')<index(momView.trace,'cutin-open')&&index(momView.trace,'cutin-close')<index(momView.trace,'effect:bigmom_status')&&index(momView.trace,'effect:bigmom_status')<index(momView.trace,'commit')&&momView.context.state.players[0][key]===true,momView.trace);
 }
 for(const choice of ['pay','die']){
  const momRoom={state:sample('bigmom-'+choice+'/PICK_TARGET').before},momView=await harness(momRoom.state);
  const demand=accepted(momRoom,{type:'PICK_TARGET',playerId:0,payload:{target:1}},'enhanced Big Mom threat');momView.enqueue(demand);await momView.idle();
  check('enhanced Big Mom '+choice+' target sees one threat before the original decision STATE',momView.cutins().length===1&&momView.cutins()[0].phase==='before'&&momView.cutins()[0].text.includes('威嚇 Audit1')&&index(momView.trace,'cutin-close')<index(momView.trace,'commit')&&momView.context.state.pending?.action==='bigmom-pay',momView.trace);
  const outcome=accepted(momRoom,{type:'BIGMOM_CHOICE',playerId:1,payload:{choice}},'enhanced Big Mom actual choice '+choice);momView.enqueue(outcome);await momView.idle();
  check('enhanced Big Mom '+choice+' preserves the actual result without a second diagonal',momView.cutins().length===1&&momView.context.state.pending===null&&(choice==='pay'?outcome.state.players[1].gold===outcome.before.players[1].gold-1:outcome.state.players[1].alive===false),momView.trace);
 }
 const queenRoom={state:sample('card-12-normal/PLAY_CARD').before},queenView=await harness(queenRoom.state,{viewer:1});
 const queen=accepted(queenRoom,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},'queen-initial-cast');queenView.enqueue(queen);await queenView.idle();
 check('normal Queen accepted public initial cast precedes the first coin prompt',queen.events.every(e=>e.type!=='card_skill_intent')&&queenView.cutins().length===1&&queenView.cutins()[0].phase==='before'&&queenView.cutins()[0].text.includes('開始硬幣判定')&&index(queenView.trace,'cutin-close')<index(queenView.trace,'commit')&&queenView.context.state.pending?.action==='queen',queenView.trace);
 const random=Math.random;try{for(const face of [.9,.9,.1]){Math.random=()=>face;const step=accepted(queenRoom,{type:'QUEEN_COIN',playerId:queenRoom.state.pending.target},'queen-continuation');queenView.enqueue(step);await queenView.idle();}}finally{Math.random=random;}
 const autoSkip=accepted(queenRoom,{type:'DRAW',playerId:queenRoom.state.turnIndex},'automatic-paralysis-skip');queenView.enqueue(autoSkip);await queenView.idle();
 check('real Queen coins and subsequent automatic paralysis never replay the first diagonal',queenView.cutins().length===1&&index(queenView.trace,'coin')>index(queenView.trace,'cutin-close')&&autoSkip.events.some(e=>e.type==='log'&&/麻痺解除/.test(e.text||'')),queenView.trace);
 report.cases.push({label:'Queen initial cast and continued real coins',trace:queenView.trace});

 const kid=sample('card-11-normal/PLAY_CARD'),ownKid=await harness(kid.before);
 check('own ordinary Kid local hook really completes before the existing submit',await ownKid.api.presentLocalKidCutin()&&ownKid.cutins().length===1&&index(ownKid.trace,'commit')<0&&ownKid.sent.length===0,ownKid.trace);
 ownKid.api.markLocalKidCutinSubmitted();ownKid.enqueue(kid);await ownKid.idle();ownKid.enqueue(kid);await ownKid.idle();
 check('submitted local Kid covers only its accepted matching public cast and retransmission',ownKid.cutins().length===1&&index(ownKid.trace,'cutin-close')<index(ownKid.trace,'pile')&&index(ownKid.trace,'commit')>index(ownKid.trace,'pile'),ownKid.trace);
 const canceledKid=await harness(kid.before);await canceledKid.api.presentLocalKidCutin();canceledKid.api.markLocalKidCutinSubmitted();canceledKid.api.cancelLocalKidCutin();canceledKid.enqueue(kid);await canceledKid.idle();
 check('canceled Kid preview cannot swallow a later accepted public cast',canceledKid.cutins().length===2,canceledKid.trace);
 const nextKid=structuredClone(kid);nextKid.before.roundNo++;nextKid.state.roundNo++;delete nextKid.gate;
 const newRoundKid=await harness(kid.before);await newRoundKid.api.presentLocalKidCutin();newRoundKid.api.markLocalKidCutinSubmitted();newRoundKid.deliver('STATE',pubState(nextKid.before));await newRoundKid.idle();newRoundKid.enqueue(nextKid);await newRoundKid.idle();
 check('a new round never inherits the old local Kid submission identity',newRoundKid.cutins().length===2,newRoundKid.trace);
 let releaseKidArt;let firstArt=true;const artCanceledKid=await harness(kid.before,{artWait:()=>{if(!firstArt)return;firstArt=false;return new Promise(resolve=>{releaseKidArt=resolve;});}});
 const delayedKid=artCanceledKid.api.presentLocalKidCutin();await until(()=>!!releaseKidArt,'local Kid art pending');artCanceledKid.api.cancelLocalKidCutin();releaseKidArt();
 check('canceling Kid while art is pending prevents a late local overlay',await delayedKid===false&&artCanceledKid.cutins().length===0,artCanceledKid.trace);artCanceledKid.enqueue(kid);await artCanceledKid.idle();
 check('fresh accepted Kid can still play after late canceled artwork',artCanceledKid.cutins().length===1,artCanceledKid.trace);

 const privateCase=sample('card-2-normal/PICK_TARGET'),privateView=await harness(privateCase.before,{guardPrivate:true,keepPrivateOpen:true});privateView.enqueue(privateCase);await until(()=>index(privateView.trace,'private-robin')>=0,'private reveal after diagonal');await wait(12);
 check('authorized private reader opens only after diagonal and still holds STATE until closed',index(privateView.trace,'cutin-close')<index(privateView.trace,'private-robin')&&index(privateView.trace,'commit')<0,privateView.trace);privateView.closeReader();await privateView.idle();check('closing original private reader releases authoritative STATE',index(privateView.trace,'commit')>index(privateView.trace,'private-robin'),privateView.trace);

 let releaseMovie;const interrupted=sample('card-4-enhanced/PLAY_CARD'),canceled=await harness(interrupted.before,{movieWait:()=>new Promise(resolve=>{releaseMovie=resolve;})});canceled.enqueue(interrupted);await until(()=>!!releaseMovie,'movie is actually pending');canceled.deliver('disconnect');releaseMovie();await wait(15);
 check('disconnect during pending movie never opens a stale pre-cut-in or dispatches effects',canceled.cutins().length===0&&index(canceled.trace,'effect:chopper_status')<0&&index(canceled.trace,'commit')<0,canceled.trace);
 check('all canonical source bytes remain stable',report.source.every(x=>hash(fs.readFileSync(x.file))===x.sha256),report.source);
 check('no unhandled queue exception',report.errors.length===0,report.errors);report.passed=true;
}catch(error){report.failure=error.stack;}
finally{process.off('unhandledRejection',noteError);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,cases:report.cases.length,errors:report.errors,failure:report.failure,report:path.join(out,'report.json')}));if(!report.passed)process.exitCode=1;}
