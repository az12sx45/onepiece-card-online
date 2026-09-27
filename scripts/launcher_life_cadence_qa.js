'use strict';
// Policy regression probes: fake clock/navigation/authority, not browser or DB acceptance.
const assert=require('node:assert/strict');
const crypto=require('node:crypto'),fs=require('node:fs');
const life=require('../desktop/launcher-life');
const shared=require('../desktop/launcher-life-data');
const checks=[];
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const story=(id,required=['luffy','zoro'],extra={})=>({id,requiredCharacters:required,steps:[{kind:'speak',actor:required[0],line:id,durationMs:500}],...extra});
function fixture(events=[],options={}) {
  let now=Date.UTC(2026,8,27),revision=0;
  const cast=['luffy','zoro','nami','sanji'];
  const actors=cast.map((key,i)=>({key,itemId:'room-character-'+key,cell:{col:3+i*2,row:3},available:true,moving:false}));
  const zero=Object.fromEntries(life.STATES.map(key=>[key,0]));
  const data={characters:Object.fromEntries(cast.map(key=>[key,{weights:{...zero,Idle:1}}])),events,...(options.defaultPolicies?{}:{policies:shared.policies})};
  const log=[];
  const adapter={getWorld:()=>({actors,stations:[],ownedItemIds:actors.map(a=>a.itemId)}),plan:()=>true,
    move:(key,cell)=>{actors.find(a=>a.key===key).cell={...cell};return true;},arrived:()=>true,face:()=>true,dock:()=>true,undock:()=>true,release:()=>true,clip:()=>true,hasClip:()=>true,
    speak:(key,line)=>log.push({key,line}),clearSpeech:()=>{},socialScene:options.socialScene};
  const controller=life.create({data,adapter,clock:()=>now,rng:()=>options.rng??0,command:async()=>({ok:true,life:{revision:++revision}})});
  async function tick(at=now+500){now=at;controller.tick(now);await flush();}
  async function jump(at){actors.forEach(a=>a.available=false);await tick(at);actors.forEach(a=>a.available=true);}
  async function finish(){for(let i=0;i<40&&controller.snapshot().foreground;i++)await tick();assert.equal(controller.snapshot().foreground,null);return now;}
  return{controller,log,actors,data,tick,jump,finish,now:()=>now};
}
async function check(name,run){await run();checks.push({name,pass:true});}
(async()=>{
  await check('shared/default policy has 12-second initial foreground and 6–10-minute rare window',async()=>{
    assert.equal(shared.policies.foregroundGapMs,180000);assert.equal(shared.policies.pairCooldownMs,720000);assert.deepEqual(shared.policies.rareEventIntervalMs,[360000,600000]);
    for(const defaultPolicies of [false,true])for(const rng of [0,.999999]) {
      const f=fixture([],{defaultPolicies,rng}),s=f.controller.snapshot();
      assert.equal(s.nextForegroundAt-f.now(),12000);assert(s.nextRareAt-f.now()>=360000&&s.nextRareAt-f.now()<=600000);f.controller.dispose();
    }
  });
  await check('authored completion imposes 3-minute foreground and fresh 6–10-minute rare delay',async()=>{
    const f=fixture([story('one'),story('other',['nami','sanji'])],{rng:.5});await f.jump(f.now()+12000);assert(f.controller.scheduleEvent('one'));const end=await f.finish(),s=f.controller.snapshot();
    assert.equal(s.nextForegroundAt,end+180000);assert.equal(s.nextRareAt,end+480000);await f.jump(end+179999);assert.equal(f.controller.scheduleEvent('other'),false);
    await f.jump(end+180000);assert(f.controller.scheduleEvent('other'));f.controller.dispose();
  });
  await check('same pair cannot bypass 12-minute cooldown with another event id; longer scene cooldown survives',async()=>{
    const f=fixture([story('long',undefined,{cooldownMs:900000}),story('different')]);await f.jump(f.now()+12000);assert(f.controller.scheduleEvent('long'));const end=await f.finish();
    await f.jump(end+719999);assert.equal(f.controller.getEventPool().find(e=>e.id==='different').eligible,false);assert.equal(f.controller.scheduleEvent('different'),false);
    await f.jump(end+720000);assert.equal(f.controller.getEventPool().find(e=>e.id==='different').eligible,true);assert.equal(f.controller.scheduleEvent('long'),false);
    await f.jump(end+900000);assert(f.controller.scheduleEvent('long'));f.controller.dispose();
  });
  await check('longer per-scene pair cooldown is retained across different event ids',async()=>{
    const f=fixture([story('pair-long',undefined,{pairCooldownMs:960000}),story('different')]);await f.jump(f.now()+12000);assert(f.controller.scheduleEvent('pair-long'));const end=await f.finish();
    await f.jump(end+720000);assert.equal(f.controller.scheduleEvent('different'),false);await f.jump(end+960000);assert(f.controller.scheduleEvent('different'));f.controller.dispose();
  });
  await check('optional participant on pair cooldown is omitted and authored solo branch finishes',async()=>{
    const optional=story('optional',['luffy'],{optionalCharacters:['zoro'],steps:[{kind:'branch',ifCharacters:['zoro'],then:[{kind:'speak',actor:'zoro',line:'optional pair branch',durationMs:500}],else:[{kind:'speak',actor:'luffy',line:'solo',durationMs:500}]}]});
    const f=fixture([story('pair'),optional]);await f.jump(f.now()+12000);assert(f.controller.scheduleEvent('pair'));const end=await f.finish();
    await f.jump(end+180000);assert(f.controller.scheduleEvent('optional'));assert.deepEqual(f.controller.snapshot().foreground.keys,['luffy']);await f.finish();assert(f.log.some(x=>x.line==='solo'));assert(!f.log.some(x=>x.line==='optional pair branch'));f.controller.dispose();
  });
  await check('legacy fallback obeys shared foreground/pair limits without starving independent rare clock',async()=>{
    let enabled=true;
    const f=fixture([],{socialScene:(a,b)=>enabled&&a==='luffy'&&b==='zoro'?{id:'legacy',cooldownMs:900000,turns:[{actor:a,line:'legacy line',durationMs:500}]}:null});
    const rareAt=f.controller.snapshot().nextRareAt;await f.tick(f.now()+12000);assert.equal(f.controller.snapshot().foreground.id,'legacy');const end=await f.finish();
    const s=f.controller.snapshot();assert.equal(s.nextForegroundAt,end+180000);assert.equal(s.nextRareAt,rareAt);
    await f.tick(end+180000);assert.equal(f.controller.snapshot().foreground,null);await f.tick(end+720000);assert.equal(f.controller.snapshot().foreground,null);
    await f.tick(end+900000);assert.equal(f.controller.snapshot().foreground.id,'legacy');enabled=false;f.controller.dispose();
  });
  console.log(JSON.stringify({ok:true,checks:checks.length,results:checks,controllerSha256:crypto.createHash('sha256').update(fs.readFileSync(require.resolve('../desktop/launcher-life'))).digest('hex'),scope:'Virtual clock with fake navigation and authority. Shared-policy and eligibility regression only; no real-time, browser, DB or deployment acceptance.'},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
