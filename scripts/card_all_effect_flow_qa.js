const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const {buildCases}=require('./card_all_effect_cases'),engine=require('../server/engine');
const flow=fs.readFileSync('C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/web/card-phone-flow.js','utf8'),guard=fs.readFileSync(path.join(__dirname,'card_outcome_guard.js'),'utf8');
let checks=0;const check=(name,fn)=>{try{fn();checks++;}catch(e){e.message=name+': '+e.message;throw e;}};
function harness(initial,viewer,installGuard=true){
 let now=0,id=0,jobs=new Map(),fx=false,coin=false,introResolve,pileResolve;const committed=[],effects=[];
 const root={dataset:{}},document={hidden:false,readyState:'complete',documentElement:root,body:{},getElementById:()=>null,addEventListener(){}};
 const handlers={EMIT:[e=>committed.push(['EMIT',e])],STATE:[s=>{ctx.state=s;committed.push(['STATE',s]);}]};
 const socket={listeners:t=>(handlers[t]||[]).slice(),off(t,fn){handlers[t]=(handlers[t]||[]).filter(f=>f!==fn);},on(t,fn){(handlers[t]??=[]).push(fn);},emit(){}};
 const deliver=(t,x)=>{for(const fn of (handlers[t]||[]).slice())fn(x);};
 const api={isEffectBusy:()=>fx,isCoinBusy:()=>coin,presentPlayEvent(){},presentCardSkillBatch:()=>new Promise(resolve=>introResolve=resolve),presentEffectEvent(e){effects.push(e);if(e.type!=='log')fx=true;},presentPileBatch:()=>new Promise(resolve=>pileResolve=resolve),flushDeferredResults(){fx=true;},restoreHandArt(){}};
 const ctx={window:{CardPhonePresentation:api,addEventListener(){}},document,socket,location:{origin:'https://onepiece-card-online.onrender.com',pathname:'/game.html'},state:initial,me:{playerId:viewer},sendAction(){},MutationObserver:class{observe(){}},setTimeout(fn,ms=0){jobs.set(++id,{at:now+ms,fn});return id;},clearTimeout(id){jobs.delete(id);},requestAnimationFrame(fn){jobs.set(++id,{at:now+1,fn});return id;}};
 vm.createContext(ctx);vm.runInContext(flow,ctx);if(installGuard)vm.runInContext(guard,ctx);
 async function advance(ms){const end=now+ms;for(let i=0;i<10000;i++){const next=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;jobs.delete(next[0]);next[1].fn();for(let j=0;j<5;j++)await Promise.resolve();}now=end;for(let j=0;j<5;j++)await Promise.resolve();}
 return {api,ctx,committed,effects,deliver,advance,releaseIntro(){introResolve?.(null);},releasePile(){pileResolve?.();},fx(v){fx=v;},coin(v){coin=v;}};
}
(async()=>{
 const cases=buildCases();
 // Reproduce the previous 100ms packet split without the new transaction guard.
 const legacy=harness({},0,false);legacy.deliver('EMIT',{to:'all',type:'log',text:'勝者 Audit0'});await legacy.advance(200);legacy.releaseIntro();await legacy.advance(100);legacy.releasePile();await legacy.advance(100);legacy.fx(false);await legacy.advance(200);
 check('old flow can expose an orphan outcome before its STATE',()=>assert.equal(legacy.committed[0]?.[1]?.text,'勝者 Audit0'));
 for(const c of cases){
  for(let viewer=0;viewer<6;viewer++){
   const h=harness(engine.getVisibleState(c.before,viewer),viewer);await h.advance(1);
   const visible=c.events.filter(e=>e.to==='all'||e.to===viewer);
   for(const e of visible){h.deliver('EMIT',e);await h.advance(160);}
   check(c.label+' delayed packets '+viewer,()=>{assert.equal(h.committed.length,0);assert.equal(h.effects.length,0);if(visible.length)assert.equal(h.api.canSendPresentedAction(),false);});
   h.deliver('STATE',engine.getVisibleState(c.state,viewer));await h.advance(200);
   check(c.label+' intro barrier '+viewer,()=>assert.equal(h.committed.length,0));
   h.releaseIntro();await h.advance(100);h.fx(false);await h.advance(150);
   check(c.label+' pile barrier '+viewer,()=>assert.equal(h.committed.length,0));
   h.releasePile();await h.advance(150);
   check(c.label+' result narration barrier '+viewer,()=>assert.equal(h.committed.length,0));
   h.fx(false);await h.advance(200);
   check(c.label+' final commit '+viewer,()=>{assert.equal(h.committed.filter(([t])=>t==='STATE').length,1);assert.deepEqual(h.ctx.state,engine.getVisibleState(c.state,viewer));assert.equal(h.committed.filter(([t])=>t==='EMIT').length,visible.filter(e=>e.type!=='enh_fx').length);});
  }
 }
 const coin=harness({},0);await coin.advance(1);coin.coin(true);coin.api.presentEffectEvent({type:'bigmom_status',status:'protect'});await coin.advance(3000);check('no coin status during animation',()=>assert.equal(coin.effects.length,0));coin.coin(false);await coin.advance(100);check('coin status after animation',()=>assert.equal(coin.effects[0].status,'protect'));
 const reset=harness({},0);await reset.advance(1);reset.deliver('EMIT',{to:'all',type:'log',text:'old result'});reset.deliver('disconnect');reset.deliver('STATE',{});await reset.advance(200);reset.releaseIntro();await reset.advance(100);reset.releasePile();await reset.advance(100);reset.fx(false);await reset.advance(200);check('disconnect discards stale result',()=>assert.ok(!reset.committed.some(([t])=>t==='EMIT')));
 for(const c of cases){if(c.action.type==='PLAY_CARD'&&c.state.pending)check('no activation before selection '+c.label,()=>assert.ok(!c.events.some(e=>['enh_fx','play_fx','card_skill_intent'].includes(e.type))));}
 for(const c of cases)for(const e of c.events.filter(e=>e.type==='card_skill_intent'))check('public declaration whitelist '+c.label,()=>assert.deepEqual(Object.keys(e).sort(),['cardId','casterId','enhanced','mode','targetId','to','type']));
 const silent=cases.find(c=>c.label==='silenced-roger/PLAY_CARD');check('silenced card has no movie or activation',()=>assert.ok(!silent.events.some(e=>['enh_fx','play_fx','card_skill_intent'].includes(e.type))));
 const secondary=cases.find(c=>c.label==='zoro-secondary-silence/PICK_TARGET');check('secondary silence does not suppress chosen discard',()=>assert.equal(secondary.events[0]?.mode,'discard'));
 const response=cases.find(c=>c.label==='card-14-enhanced/BIGMOM_CHOICE');check('Big Mom response announced before elimination',()=>{assert.equal(response.events[0].mode,'decline');assert.equal(response.events[0].casterId,response.action.playerId);});
 const result={passed:true,checks,cases:cases.length,viewers:6,scope:'Original engine 20 cards normal/enhanced plus defense and chained decisions; real flow module with controlled animation barriers, split network packets and all six visible states. Not a rendered animation or physical-device test.'};
 if(process.env.CARD_AUDIT_REPORT)fs.writeFileSync(process.env.CARD_AUDIT_REPORT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.message,e.stack);process.exitCode=1;});
