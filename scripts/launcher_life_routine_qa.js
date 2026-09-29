'use strict';
// Deterministic room-routine probes with fake navigation and no coin authority.
const assert = require('node:assert/strict');
const life = require('../desktop/launcher-life');
const checks = [];
const zero = Object.fromEntries(life.STATES.map(state => [state, 0]));
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture({keys=['luffy'],weights={UseFurniture:100},stations=[],favorites={},context={},rng=.32,hasClip=true,specialists={}}={}) {
  let now=Date.UTC(2026,8,29,12),revision=0;
  const log=[],actors=keys.map((key,i)=>({key,itemId:`room-character-${key}`,cell:{col:2+i*2,row:5},available:true}));
  const data={characters:Object.fromEntries(keys.map(key=>[key,{weights:{...zero,...weights},efficiency:{kitchen:1.5,navigation:1.5,music:1.5,training:1.5,deck:1.1}}])),
    stations:{kitchen:{actions:['work'],...specialists.kitchen},navigation:{actions:['work'],...specialists.navigation},music:{actions:['work'],...specialists.music},training:{actions:['work','train'],...specialists.training},deck:{actions:['work']}},events:[]};
  const world={actors,stations,ownedItemIds:actors.map(actor=>actor.itemId)};
  const adapter={getWorld:()=>world,getContext:()=>context,favoriteFurniture:key=>favorites[key]||[],
    activityBeat:(key,furnitureKey,index,details)=>{log.push(['beat',key,furnitureKey,index,details]);return{speaker:key,line:`${key}:${details.activity}`,mood:'focused'};},
    directiveBeat:(key,furnitureKey,kind,index,details)=>{log.push(['directive',key,furnitureKey,kind,index,details]);return{speaker:key,line:`${key}:${kind}`,mood:'focused'};},
    plan:(key,cell)=>cell.col>=0&&cell.col<16&&cell.row>=0&&cell.row<8,reserve:()=>true,move:(key,cell)=>{log.push(['move',key,{...cell}]);actors.find(actor=>actor.key===key).cell={...cell};return true;},
    arrived:()=>true,face:()=>true,dock:()=>true,undock:()=>true,
    supportsClip:()=>true,hasClip:()=>hasClip,clip:(key,clip)=>{log.push(['clip',key,clip]);return hasClip;},
    speak:(key,line,mood,meta)=>log.push(['speak',key,line,mood,meta]),clearSpeech:()=>{},release:()=>{},wander:key=>log.push(['wander',key])};
  const command=async(type,payload)=>{log.push(['command',type,payload]);
    if(type==='work.reserve')return{ok:true,job:{jobId:'test-job',itemId:payload.itemId,stationId:payload.stationId,status:'reserved',activateAfter:new Date(now).toISOString()}};
    return{ok:true,life:{revision:++revision,ownedCharacterIds:world.ownedItemIds}};
  };
  const controller=life.create({data,adapter,clock:()=>now,rng:()=>rng,command});
  async function tick(ms=1000){now+=ms;controller.tick(now);await flush();}
  return {controller,data,adapter,world,log,tick,now:()=>now,setClipReady:value=>{hasClip=value;}};
}
const station=(id,type,furnitureKey,col)=>({id,type,furnitureKey,cell:{col,row:4},slots:[{id:'front',cell:{col,row:5},facing:{col,row:4}}]});
async function check(name,run){await run();checks.push(name);}

(async()=>{
  await check('favorite reachable furniture wins over earlier catalog order; ambience reaches actual action beat',async()=>{
    const f=fixture({stations:[station('map','navigation','map-table',6),station('table','kitchen','kitchen-table',9)],
      favorites:{luffy:['kitchen-table']},context:{daypart:'dusk',season:'autumn',weather:'rain'}});
    await f.tick(1);
    assert.equal(f.controller.snapshot().tasks[0].stationId,'table');
    await f.tick();
    assert(f.log.some(entry=>entry[0]==='clip'&&entry[1]==='luffy'));
    const beat=f.log.find(entry=>entry[0]==='beat');
    assert.equal(beat[2],'kitchen-table');
    assert.deepEqual([beat[4].daypart,beat[4].season,beat[4].weather,beat[4].activity],['dusk','autumn','rain','UseFurniture']);
    assert(f.log.some(entry=>entry[0]==='speak'&&entry[2]==='luffy:UseFurniture'));
    f.controller.dispose();
  });
  await check('specialist uses approved full body clip at owned station',async()=>{
    const f=fixture({keys:['sanji'],stations:[station('stove','kitchen','galley-stove',7)],favorites:{sanji:['galley-stove']},
      specialists:{kitchen:{specialistActions:{sanji:'cook'},specialistRequirements:{sanji:{furnitureKeys:['galley-stove']}}}}});
    await f.tick(1);await f.tick();
    assert.equal(f.controller.snapshot().tasks[0].stationId,'stove');
    assert(f.log.some(entry=>entry[0]==='clip'&&entry[1]==='sanji'&&entry[2]==='cook'));
    f.controller.dispose();
  });
  await check('no purchased furniture means no imaginary furniture activity; floor training stays available',async()=>{
    const furniture=fixture({stations:[]});await furniture.tick(1);
    assert.notEqual(furniture.controller.stateFor('luffy').state,'UseFurniture');
    assert(furniture.controller.snapshot().tasks.every(task=>!task.stationId));furniture.controller.dispose();
    const training=fixture({weights:{Train:100},stations:[]});await training.tick(1);await training.tick();
    assert.equal(training.controller.snapshot().tasks[0].stationId,'');
    assert(training.log.some(entry=>entry[0]==='clip'&&entry[2]==='train'));
    training.controller.dispose();
  });
  await check('storm encourages sheltered activity while clear weather allows wandering',async()=>{
    const props={weights:{Wander:1,UseFurniture:1},stations:[station('table','kitchen','kitchen-table',7)],favorites:{luffy:['kitchen-table']},rng:.35};
    const clear=fixture({...props,context:{weather:'clear'}});await clear.tick(1);
    assert.equal(clear.controller.stateFor('luffy').state,'Wander');clear.controller.dispose();
    const storm=fixture({...props,context:{weather:'storm'}});await storm.tick(1);
    assert.equal(storm.controller.stateFor('luffy').state,'UseFurniture');storm.controller.dispose();
  });
  await check('dialogue waits until action art is ready, so lines match visible activity',async()=>{
    const f=fixture({stations:[station('table','kitchen','kitchen-table',7)],hasClip:false});
    await f.tick(1);await f.tick();
    assert.equal(f.log.filter(entry=>entry[0]==='beat').length,0);
    f.setClipReady(true);await f.tick();
    assert.equal(f.log.filter(entry=>entry[0]==='beat').length,1);
    f.controller.dispose();
  });
  await check('automatic paid work reserves character skill station through existing server command',async()=>{
    const f=fixture({keys:['sanji'],weights:{Work:100},stations:[station('map','navigation','map-table',5),station('stove','kitchen','galley-stove',8)],favorites:{sanji:['galley-stove']}});
    await f.tick(1);
    const reserve=f.log.find(entry=>entry[0]==='command'&&entry[1]==='work.reserve');
    assert.equal(reserve[2].stationId,'stove');
    assert.equal(f.controller.snapshot().jobs.length,1);
    assert(!f.log.some(entry=>entry[0]==='command'&&entry[1]==='work.complete'));
    f.controller.dispose();
  });
  await check('casual crew scenes use shorter pair cadence and receive season, time and weather without changing rare timer',async()=>{
    let now=Date.UTC(2026,11,29,21),seenContext=null;
    const keys=['luffy','zoro'],actors=keys.map((key,i)=>({key,itemId:`room-character-${key}`,cell:{col:4+i*2,row:5},available:true}));
    const data={characters:Object.fromEntries(keys.map(key=>[key,{weights:{...zero}}])),events:[]};
    const adapter={getWorld:()=>({actors,stations:[],ownedItemIds:actors.map(actor=>actor.itemId)}),
      getContext:()=>({daypart:'night',season:'winter',weather:'snow'}),favoriteFurniture:()=>[],
      socialScene:(a,b,context)=>{seenContext=context;const id=context.recentSceneIds.includes('first')?'second':'first';return{id,turns:[{actor:a,line:id,durationMs:500}]};},
      plan:()=>true,move:()=>true,arrived:()=>true,face:()=>true,dock:()=>true,undock:()=>true,
      hasClip:()=>true,clip:()=>true,speak:()=>{},clearSpeech:()=>{},release:()=>{},wander:()=>{}};
    const controller=life.create({data,adapter,clock:()=>now,rng:()=>0,
      casualConversation:{foregroundGapMs:75000,pairCooldownMs:90000},command:async()=>({ok:true})});
    const rareAt=controller.snapshot().nextRareAt;
    controller.tick(now+=12000);
    assert.equal(controller.snapshot().foreground.id,'first');
    assert.deepEqual([seenContext.daypart,seenContext.season,seenContext.weather,seenContext.activity],['night','winter','snow','Socialize']);
    for(let i=0;i<12&&controller.snapshot().foreground;i++)controller.tick(now+=1000);
    assert.equal(controller.snapshot().foreground,null);
    const end=now,after=controller.snapshot();
    assert.equal(after.nextForegroundAt,end+75000);
    assert.equal(after.nextRareAt,rareAt);
    for(const key of keys)controller.cancel(key);
    controller.tick(now=end+75000);
    assert.equal(controller.snapshot().foreground,null,'same pair still cooling down');
    for(const key of keys)controller.cancel(key);
    controller.tick(now=end+90000);
    assert.equal(controller.snapshot().foreground.id,'second');
    controller.dispose();
  });
  await check('click-to-move reaches a real floor cell and speaks only on arrival without server coins',async()=>{
    const f=fixture({weights:{Idle:100},context:{daypart:'dawn',season:'spring',weather:'clear'}});
    const result=f.controller.assignDestination('luffy',{kind:'floor',cell:{col:8,row:6}});
    assert(result.ok);assert.deepEqual(f.controller.snapshot().tasks[0].goal,{col:8,row:6});
    assert.equal(f.controller.assignDestination('luffy',{kind:'floor',cell:{col:-1,row:6}}).error,'no_route');
    await f.tick();
    const beat=f.log.find(entry=>entry[0]==='directive');
    assert.equal(beat[3],'move');assert.equal(beat[5].daypart,'dawn');
    assert(f.log.some(entry=>entry[0]==='speak'&&entry[2]==='luffy:move'));
    assert(!f.log.some(entry=>entry[0]==='command'&&entry[1].startsWith('work.')));
    f.controller.dispose();
  });
  await check('clicked expert furniture animates specialist; other crew use safe full-body attempt and fitting response',async()=>{
    const stove=station('stove','kitchen','galley-stove',7);
    const specialists={kitchen:{specialistActions:{sanji:'cook'},specialistRequirements:{sanji:{furnitureKeys:['galley-stove']}}}};
    for(const key of ['sanji','luffy']) {
      const f=fixture({keys:[key],weights:{Idle:100},favorites:{sanji:['galley-stove']},specialists});
      const result=f.controller.assignDestination(key,{kind:'furniture',station:stove});assert(result.ok);
      await f.tick();
      assert(f.log.some(entry=>entry[0]==='clip'&&entry[2]===(key==='sanji'?'cook':'work')));
      const beat=f.log.find(entry=>entry[0]==='directive');
      assert.equal(beat[3],'use');assert.equal(beat[5].specialist,key==='sanji');
      const response=f.log.find(entry=>entry[0]==='speak'&&entry[2]===`${key}:use`);
      assert.equal(response[4].reactionPose,key==='sanji'?'':'surprised');
      assert.equal(response[4].reactionMs,key==='sanji'?0:1500);
      assert(!f.log.some(entry=>entry[0]==='command'&&entry[1].startsWith('work.')));
      f.controller.dispose();
    }
  });
  await check('paid work cannot be interrupted by floor or furniture assignment',async()=>{
    const stove=station('stove','kitchen','galley-stove',7);
    const f=fixture({keys:['sanji'],weights:{Idle:100},stations:[stove]});
    assert((await f.controller.assignWork('sanji','stove')).ok);
    assert.equal(f.controller.assignDestination('sanji',{kind:'floor',cell:{col:8,row:6}}).error,'work_active');
    assert.equal(f.controller.assignDestination('sanji',{kind:'furniture',station:stove}).error,'work_active');
    assert.equal(f.controller.snapshot().jobs.length,1);
    assert(!f.log.some(entry=>entry[0]==='command'&&entry[1]==='work.cancel'));
    f.controller.dispose();
  });
  await check('server job reservation blocks a new assignment before its visual task restores',async()=>{
    const f=fixture({keys:['sanji'],weights:{Idle:100},stations:[station('stove','kitchen','galley-stove',7)]});
    f.controller.sync({revision:1,ownedCharacterIds:['room-character-sanji'],jobs:[{jobId:'server-job',itemId:'room-character-sanji',stationId:'stove',status:'reserved'}]});
    assert.equal(f.controller.snapshot().tasks.length,0);
    assert.equal(f.controller.assignDestination('sanji',{kind:'floor',cell:{col:8,row:6}}).error,'work_active');
    assert(!f.log.some(entry=>entry[0]==='command'&&entry[1]==='work.cancel'));
    f.controller.dispose();
  });
  console.log(JSON.stringify({ok:true,checks:checks.length,results:checks,scope:'Virtual clock, fake navigation and server authority; no coins minted by client, browser art or deployment claim.'},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
