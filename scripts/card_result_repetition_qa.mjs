import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require=createRequire(import.meta.url),engine=require('../server/engine.js'),adapter=require('../server/card_skill_intent.js');
const root=path.resolve(import.meta.dirname,'..');
const file='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/web/card-result-cutins.js';
const source=fs.readFileSync(file,'utf8'),hash=b=>createHash('sha256').update(b).digest('hex');
const out=process.env.RESULT_REPETITION_QA_OUT||'D:/Codex_QA/card-result-repetition-20261103/'+Date.now();
fs.mkdirSync(out,{recursive:true});
const report={passed:false,scope:'Real engine/decorator transactions exercised through the actual shared result/pile wrapper in an isolated minimal DOM. Timers are shortened; no browser geometry, physical device, account or deployment claim.',source:{file,bytes:Buffer.byteLength(source),sha256:hash(source)},checks:[],cases:[]};
const legacyCommit='45602234069809a36c17fca0cc971144919df425';
const legacyHtml=execFileSync('git',['-C',root,'show',legacyCommit+':public/game.html'],{encoding:'utf8',maxBuffer:8*1024*1024});
const legacySource=legacyHtml.split('<!-- CARD_RESULT_CUTINS_BEGIN -->')[1]?.split('<!-- CARD_RESULT_CUTINS_END -->')[0]?.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
if(!legacySource?.includes('api.resultCutinVersion=1'))throw Error('Missing actual prior result wrapper');
report.legacyWrapper={commit:legacyCommit,file:'public/game.html#CARD_RESULT_CUTINS',bytes:Buffer.byteLength(legacySource),sha256:hash(legacySource)};
const check=(name,pass,detail)=>report.checks.push({name,pass:!!pass,detail});
const all=require('./card_all_effect_cases.js').buildCases(),sample=label=>{const c=all.find(c=>c.label===label);if(!c)throw Error('Missing fixture '+label);return structuredClone(c);};
function transaction(room,action,label){const before=room.state,result=engine.applyAction(before,action),rules=JSON.stringify(result.state);adapter.decorate(room,before,action,result);if(JSON.stringify(result.state)!==rules)throw Error('Decorator mutated rules');room.state=result.state;return{label,before,action,state:result.state,events:result.emits};}
function queenChain(){const room={state:sample('12-tails/QUEEN_COIN').before},result=[],old=Math.random;try{for(const [i,face] of ['T','T','H'].entries()){Math.random=()=>face==='T'?.9:.1;result.push(transaction(room,{type:'QUEEN_COIN',playerId:room.state.pending.target},'queen-chain-'+i));}}finally{Math.random=old;}return result;}
const publicState=s=>({roundNo:s.roundNo,pending:structuredClone(s.pending),log:[...s.log],players:s.players.map(({id,alive,skipNext})=>({id,alive,skipNext}))});
async function harness(options={}){
 const shown=[],loaded=[],pile=[],early=[],listeners=new Map();
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={setProperty(){}};this.attributes={};this._text='';this.parent=null;}
  set textContent(v){this._text=String(v);}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  setAttribute(k,v){this.attributes[k]=String(v);}
  append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}if(this===document.body)for(const node of nodes)shown.push({card:node.dataset.card,text:node.textContent,phase:node.dataset.phase});}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
  animate(){return{cancel(){}};}
 }
 const document={hidden:false,readyState:'complete',body:null,createElement:tag=>new Node(tag),getElementById(){return null;},addEventListener(type,fn){listeners.set('doc:'+type,fn);}};document.body=new Node('body');
 const api={presentPileBatch:async(events,next)=>{pile.push({events,next});return'original-pile';},presentCardSkillBatch:async events=>{early.push(events);return'original-skill';},isCardSkillIntroBusy:()=>false,presentationEffectsBusy:()=>false,cancelCardSkillIntro(){},loadCardArt:async(kind,id)=>{loaded.push({kind,id});return options.art?options.art():{src:'https://fixture/art-'+id+'.webp'};}};
 const context=vm.createContext({state:null,me:{roomId:'REPETITION-QA'},window:{CardPhonePresentation:api,__TABLETOP_ANDROID_TEST_ORIGIN:'http://fixture'},location:{origin:'http://fixture',pathname:'/game.html'},document,socket:{on:(type,fn)=>listeners.set('socket:'+type,fn)},CARD_TEXT:Object.fromEntries(Array.from({length:20},(_,id)=>[id,{name:engine._util.cardById(id).name,baseTitle:'招式',enhTitle:'強化招式'}])),pname:id=>'Audit'+id,matchMedia:()=>({matches:true}),setTimeout:(fn,ms)=>setTimeout(fn,ms>100?2:ms),clearTimeout,isCpuSkipFastMode:()=>false});
 if(options.legacy){vm.runInContext(legacySource,context);await new Promise(resolve=>setTimeout(resolve,5));}
 vm.runInContext(source,context);await new Promise(resolve=>setTimeout(resolve,5));
 async function present(c,extra=[]){context.state=publicState(c.before);const events=[...c.events,...extra],next=publicState(c.state),before=JSON.stringify({events,next});const value=await api.presentPileBatch(events,next);check(c.label+' preserves backend snapshot and original effects',before===JSON.stringify({events,next})&&value==='original-pile'&&pile.at(-1).events===events);return value;}
 return{api,context,document,listeners,shown,loaded,pile,early,present};
}
try{
 for(const label of ['3-protected/PICK_TARGET','3-dodging/PICK_TARGET','5-protected/PICK_TARGET','5-dodging/PICK_TARGET','6-protected/PICK_TARGET','6-dodging/PICK_TARGET','8-protected/PICK_TARGET','8-dodging/PICK_TARGET','14-protected/PICK_TARGET','14-dodging/PICK_TARGET']){
  const c=sample(label),h=await harness();await h.present(c);check(label+' keeps defense effects without any diagonal or artwork decode',h.shown.length===0&&h.loaded.length===0,{shown:h.shown,loaded:h.loaded});
 }
 for(const label of ['bigmom-pay/PICK_TARGET','bigmom-pay/BIGMOM_CHOICE','bigmom-die/BIGMOM_CHOICE']){
  const c=sample(label),h=await harness();await h.present(c);check(label+' keeps choice/payment/elimination without a diagonal',h.shown.length===0&&h.loaded.length===0,{shown:h.shown,events:c.events.map(e=>e.type)});
 }
 for(const [label,text] of [['14-heads/BIGMOM_COIN','護盾'],['14-tails/BIGMOM_COIN','閃避'],['card-7-enhanced/PICK_TARGET','下回合跳過'],['5-protected/PLAY_CARD',null]]){
  if(text===null)continue;const c=sample(label),h=await harness();await h.present(c);check(label+' keeps one authoritative successful card result',h.shown.length===1&&h.shown[0].text.includes(text),h.shown);
 }
 for(const label of ['16-protected/PLAY_CARD','16-dodging/PLAY_CARD']){
  const c=sample(label),h=await harness();await h.present(c);check(label+' mixed all-player success still reports frozen players, not defense',h.shown.length===1&&h.shown[0].text.includes('已凍結')&&!h.shown[0].text.includes('擋下')&&!h.shown[0].text.includes('閃避成功'),h.shown);
 }
 for(const blocked of [false,true]){
  const before=sample('card-8-enhanced/LUFFY_BOOST_COMMIT').before;before.players.forEach((p,i)=>{if(i===1||blocked&&i>0)p.protected=true;});
  const c=transaction({state:before},{type:'LUFFY_BOOST_COMMIT',playerId:0,payload:{go:true}},'luffy-all-duel-'+(blocked?'all-blocked':'partial-success')),h=await harness();await h.present(c);
  check(c.label+' reports actual public eliminations only',blocked?h.shown.length===0:h.shown.length===1&&h.shown[0].text.includes('出局'),h.shown);
 }
 const repeatedNamiBase=sample('card-7-enhanced/PICK_TARGET').before;repeatedNamiBase.players[1].skipNext=true;
 const repeatedNami=transaction({state:repeatedNamiBase},{type:'PICK_TARGET',playerId:0,payload:{target:1}},'already-paralyzed-nami'),paralyzed=await harness();await paralyzed.present(repeatedNami);
 check('already paralyzed target receives no duplicate Nami result diagonal',paralyzed.shown.length===0&&paralyzed.loaded.length===0,{shown:paralyzed.shown,old:repeatedNami.before.players[1].skipNext,next:repeatedNami.state.players[1].skipNext});
 const luffyRoom={state:sample('card-8-normal/PICK_TARGET').before},firstDuel=transaction(luffyRoom,{type:'PICK_TARGET',playerId:0,payload:{target:1}},'luffy-first-real-duel'),secondDuel=transaction(luffyRoom,{type:'LUFFY_SECOND',playerId:0,payload:{target:2}},'luffy-second-real-duel'),luffy=await harness();await luffy.present(firstDuel);await luffy.present(secondDuel);
 check('Luffy distinct second actual duel remains independently announced',luffy.shown.length===2&&luffy.loaded.length===2,{shown:luffy.shown,events:[firstDuel.events.map(e=>e.type),secondDuel.events.map(e=>e.type)]});
 const chain=queenChain(),queen=await harness();
 for(const c of chain)await queen.present(c);
 check('three real Queen coin decisions share one diagonal and one art decode',queen.shown.length===1&&queen.loaded.length===1,{shown:queen.shown,loaded:queen.loaded,targets:chain.map(c=>c.before.pending.target)});
 const last=chain.at(-1),room={state:structuredClone(last.state)};room.state.turnIndex=0;room.state.turnStep='choose';room.state.players[0].hand=12;room.state.players[0].tempDraw=8;
 transaction(room,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},'new-queen-cast');
 const old=Math.random;let second;try{Math.random=()=>.1;second=transaction(room,{type:'QUEEN_COIN',playerId:room.state.pending.target},'same-round-new-queen');}finally{Math.random=old;}
 await queen.present(second);check('same actor new Queen cast in same round may report again',queen.shown.length===2&&queen.loaded.length===2,{round:firstRound(chain),shown:queen.shown,playLines:second.state.log.filter(x=>x.includes(' 打出 12｜'))});
 const fresh=structuredClone(chain[0]);fresh.label='new-round-queen';fresh.before.roundNo++;fresh.state.roundNo++;await queen.present(fresh);check('next round Queen cast has independent presentation',queen.shown.length===3,queen.shown);
 const duplicate=await harness(),zoro=sample('card-5-enhanced/PICK_TARGET');await duplicate.present(zoro);await duplicate.present(zoro);
 check('retransmitted identical public result cannot decode or show another diagonal',duplicate.shown.length===1&&duplicate.loaded.length===1,{shown:duplicate.shown,loaded:duplicate.loaded});
 const laterState=structuredClone(zoro);laterState.label='same-result-newer-public-log';laterState.state.log.push('公開介面狀態更新');await duplicate.present(laterState);check('same accepted result with a newer public state still cannot replay',duplicate.shown.length===1&&duplicate.loaded.length===1,{shown:duplicate.shown,loaded:duplicate.loaded});
 const automatic=await harness(),auto=structuredClone(chain[0]);auto.label='automatic-paralysis-only';auto.events=[{to:'all',type:'log',text:'P2 跳過回合（麻痺解除）'}];auto.state.log=[...auto.before.log,'P2 跳過回合（麻痺解除）'];await automatic.present(auto);check('automatic paralysis skip without a public cast declaration has no diagonal',automatic.shown.length===0&&automatic.loaded.length===0);
 const privateOnly={to:0,type:'peek'};Object.defineProperty(privateOnly,'cardId',{enumerable:false,get(){throw Error('Private card id was read');}});Object.defineProperty(privateOnly,'lines',{enumerable:false,get(){throw Error('Private peek lines were read');}});
 const privacy=await harness();await privacy.present(sample('card-5-normal/PICK_TARGET'),[privateOnly]);check('public result never reads another event private card fields',privacy.shown.length===1);
 const untouched=await harness(),c=sample('14-heads/BIGMOM_COIN');await untouched.api.presentCardSkillBatch(c.events);check('accepted skill wrapper retains every real effect and suppresses only early intent',untouched.early.length===1&&untouched.early[0].length===c.events.filter(e=>e.type!=='card_skill_intent').length&&untouched.early[0].every(e=>e.type!=='card_skill_intent'));
 let release;const canceled=await harness({art:()=>new Promise(resolve=>{release=resolve;})});const pending=canceled.present(zoro);while(!release)await new Promise(resolve=>setTimeout(resolve,1));canceled.api.cancelCardSkillIntro();release({src:'https://fixture/late.webp'});await pending;check('late artwork completion after cancellation never opens a diagonal',canceled.shown.length===0,canceled.shown);
 await canceled.present(zoro);check('retransmitting a canceled result cannot decode or reopen it',canceled.shown.length===0&&canceled.loaded.length===1,{shown:canceled.shown,loaded:canceled.loaded});
 const upgrade=await harness({legacy:true});await upgrade.present(sample('14-heads/BIGMOM_COIN'));check('version 2 mounts over the actual prior version 1 wrappers without duplicate result',upgrade.api.resultCutinVersion===2&&upgrade.shown.length===1&&upgrade.loaded.length===1,{shown:upgrade.shown,loaded:upgrade.loaded,legacy:report.legacyWrapper});
 const wrapper=upgrade.api.presentPileBatch;vm.runInContext(source,upgrade.context);await new Promise(resolve=>setTimeout(resolve,5));check('version 2 repeated installation cannot wrap the result queue twice',upgrade.api.presentPileBatch===wrapper);
 report.sourceStable=hash(fs.readFileSync(file))===report.source.sha256;check('shared module stays byte-identical throughout this QA',report.sourceStable);report.passed=report.checks.every(c=>c.pass);
}catch(error){report.failure=error.stack;}
function firstRound(chain){return chain[0].before.roundNo;}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,failed:report.checks.filter(c=>!c.pass).map(c=>c.name),failure:report.failure,report:path.join(out,'report.json')}));
if(!report.passed)process.exitCode=1;
