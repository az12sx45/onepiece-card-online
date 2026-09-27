'use strict';
// Pure controller probes with a virtual clock, fake navigation and a fake authority.
// These tests do not claim real DB concurrency, animation quality or public deployment.
const assert = require('node:assert/strict');
const life = require('../desktop/launcher-life');
const checks = [];
const flush = () => new Promise(resolve => setImmediate(resolve));
const clone = value => JSON.parse(JSON.stringify(value));
function fixture(options={}) {
  let now=Date.UTC(2026,8,27,12), sequence=0, serverJobs=[], arrivalRecords=[];
  const log=[], positions=new Map(), pendingMoves=new Map(), owned=(options.owned||['luffy','zoro']).map(key=>'room-character-'+key);
  const zero=Object.fromEntries(life.STATES.map(state=>[state,0]));
  const keys=['luffy','zoro','sanji','nami'];
  const data=options.data||{characters:Object.fromEntries(keys.map(key=>[key,{weights:{...zero,Idle:1}}])),events:options.events||[],relationships:{'luffy:zoro':{familiarity:82,friendship:84,rivalry:5,respect:89}}};
  const actors=owned.map((id,index)=>({key:id.replace('room-character-',''),itemId:id,cell:{col:index,row:1},moving:false,available:true}));
  for(const actor of actors)positions.set(actor.key,actor);
  const stations=options.stations===false?[]:[{id:'room-furniture-kitchen-table',type:'kitchen',furnitureKey:'kitchen-table',cell:{col:5,row:3},slots:[{id:'cook',cell:{col:5,row:4},facing:{col:5,row:3}}]}];
  const state={ownedItemIds:owned,actors,stations,writable:options.writable!==false};
  const adapter={
    getWorld:()=>state,
    plan:(key,cell)=>options.blocked!==true&&cell.col>=0&&cell.col<16&&cell.row>=0&&cell.row<8,
    move:(key,cell,token)=>{log.push(['move',key,token]);const actor=positions.get(key);if(!actor)return false;actor.moving=true;pendingMoves.set(key,{cell:clone(cell),at:now+500,token});return true;},
    arrived:(key)=>!pendingMoves.has(key),
    face:()=>true,dock:()=>true,undock:()=>true,
    clip:(key,clip,meta)=>{log.push(['clip',key,clip,meta.state]);return options.missingClip!==true;},
    speak:(key,line)=>log.push(['speak',key,line]),
    clearSpeech:()=>{},
    release:(key,token)=>{log.push(['release',key,token]);pendingMoves.delete(key);const actor=positions.get(key);if(actor)actor.moving=false;},
    wander:key=>log.push(['wander',key]),
    entry:key=>({from:{col:0,row:0},to:{col:3,row:2}}),
    spawnArrival:(key,cell)=>{const actor={key,itemId:'room-character-'+key,cell,moving:false,available:true};positions.set(key,actor);state.actors.push(actor);log.push(['spawn',key]);return true;}
  };
  const snapshot=()=>({revision:sequence,ownedCharacterIds:[...state.ownedItemIds],characters:{},jobs:clone(serverJobs),pendingArrivals:clone(arrivalRecords),pairs:{},directive:'free'});
  async function command(type,payload) {
    log.push(['command',type,clone(payload)]);
    if(options.command)return options.command(type,payload);
    sequence++;
    let job;
    if(type==='work.reserve') {
      job={jobId:'job-'+sequence,itemId:payload.itemId,stationId:payload.stationId,status:'reserved',durationMs:4000,readyAt:null};
      serverJobs.push(job);
    } else if(type==='work.activate') {
      job=serverJobs.find(j=>j.jobId===payload.jobId);assert(job,'activation has a real reservation');
      job.status='active';job.activatedAt=now;job.readyAt=now+4000;
    } else if(type==='work.complete') {
      job=serverJobs.find(j=>j.jobId===payload.jobId);
      if(!job||now<job.readyAt)return{ok:false,error:'not_ready',life:snapshot()};
      serverJobs=serverJobs.filter(j=>j!==job);
    } else if(type==='work.cancel')serverJobs=serverJobs.filter(j=>j.jobId!==payload.jobId);
    else if(type==='arrival.ack')arrivalRecords=arrivalRecords.filter(a=>a.arrivalId!==payload.arrivalId);
    return{ok:true,life:snapshot(),job:clone(job||null),receipt:type==='work.complete'?{id:'receipt-'+sequence}:undefined};
  }
  const controller=life.create({data,adapter,command,clock:()=>now,rng:()=>.31});
  async function advance(ms,step=250) {
    const target=now+ms;
    while(now<target) {
      now=Math.min(target,now+step);
      for(const [key,pending] of pendingMoves)if(now>=pending.at){const actor=positions.get(key);actor.cell=clone(pending.cell);actor.moving=false;pendingMoves.delete(key);}
      controller.tick(now);await flush();
    }
  }
  return{controller,data,adapter,state,log,positions,advance,now:()=>now,
    setNow:value=>{now=value;},snapshot,
    setArrivals:values=>{arrivalRecords=clone(values);controller.sync(snapshot());},
    cancelAll:()=>{for(const actor of state.actors)controller.cancel(actor.key);},
    owned,serverJobs:()=>serverJobs};
}
async function check(name,run){await run();checks.push({name,pass:true});}
(async()=>{
  await check('requirements exclude every event with an unowned required actor',async()=>{
    const f=fixture({events:[{id:'missing-cook',requiredCharacters:['luffy','sanji'],steps:[{kind:'speak',actor:'luffy',line:'午餐'}]},{id:'present-pair',requiredCharacters:['luffy','zoro'],steps:[{kind:'speak',actor:'luffy',line:'出發'}]}]});
    assert.deepEqual(f.controller.getEventPool().map(e=>e.id),['present-pair']);
    assert(!f.controller.snapshot().characters.sanji);
    f.controller.dispose();
  });
  await check('ownership loss releases task and blocks late reserve response',async()=>{
    let reply;
    const f=fixture({command:(type)=>type==='work.reserve'?new Promise(resolve=>{reply=resolve;}):Promise.resolve({ok:true})});
    const pending=f.controller.assignWork('luffy');await flush();
    assert(f.controller.isBusy('luffy'));
    f.state.ownedItemIds=['room-character-zoro'];f.controller.tick(f.now()+100);
    reply({ok:true,job:{jobId:'late',itemId:'room-character-luffy',status:'reserved'}});await pending;
    assert(!f.controller.isBusy('luffy'));assert(!f.controller.snapshot().characters.luffy);
    assert(!f.log.some(e=>e[0]==='command'&&e[1]==='work.activate'));
    f.controller.dispose();
  });
  await check('work reserve precedes physical movement, activation follows arrival and real clip',async()=>{
    const f=fixture();
    const result=await f.controller.assignWork('luffy');assert(result.ok);
    const reserve=f.log.findIndex(e=>e[0]==='command'&&e[1]==='work.reserve'),move=f.log.findIndex(e=>e[0]==='move');
    assert(reserve>=0&&move>reserve);
    assert(!f.log.some(e=>e[0]==='command'&&e[1]==='work.activate'));
    await f.advance(600);
    const activate=f.log.findIndex(e=>e[0]==='command'&&e[1]==='work.activate');
    assert(activate>f.log.findIndex(e=>e[0]==='clip'));
    await f.advance(5000);
    assert.equal(f.log.filter(e=>e[0]==='command'&&e[1]==='work.complete').length,1);
    assert.equal(f.controller.snapshot().jobs.length,0);
    f.controller.dispose();
  });
  await check('missing animation never activates or claims a work reward',async()=>{
    const f=fixture({missingClip:true});
    assert((await f.controller.assignWork('luffy')).ok);await f.advance(7000);
    assert.equal(f.controller.snapshot().tasks.find(t=>t.key==='luffy').phase,'await-art');
    assert.equal(f.controller.stateFor('luffy').missingClip,'work');
    assert(!f.log.some(e=>e[0]==='command'&&['work.activate','work.complete'].includes(e[1])));
    f.controller.dispose();
  });
  await check('station slot is exclusive; every suitable character can reserve when released',async()=>{
    const f=fixture();
    assert((await f.controller.assignWork('luffy')).ok);
    assert.equal((await f.controller.assignWork('zoro')).error,'no_station');
    f.controller.cancel('luffy');await flush();
    assert((await f.controller.assignWork('zoro')).ok);
    assert.equal(f.controller.reservations().filter(l=>l.stationId==='room-furniture-kitchen-table').length,1);
    f.controller.dispose();
  });
  await check('unreachable routes never reserve server work or teleport',async()=>{
    const f=fixture({blocked:true});const before=clone(f.state.actors);
    assert.equal((await f.controller.assignWork('luffy')).error,'no_station');
    assert(!f.log.some(e=>e[0]==='command'));assert.deepEqual(f.state.actors,before);
    f.controller.dispose();
  });
  await check('reserved offline job must physically arrive again before activate',async()=>{
    const f=fixture();
    f.controller.sync({ownedCharacterIds:f.owned,jobs:[{jobId:'old',itemId:'room-character-luffy',stationId:'room-furniture-kitchen-table',status:'reserved',readyAt:null}]});
    f.controller.tick(f.now()+1);
    assert(f.log.some(e=>e[0]==='move'&&e[1]==='luffy'));
    assert(!f.log.some(e=>e[0]==='command'&&e[1]==='work.activate'));
    f.controller.dispose();
  });
  await check('optional chain members absent are skipped without spawning or error',async()=>{
    const event={id:'snack',requiredCharacters:['luffy'],optionalCharacters:['sanji','nami'],cooldownMs:600000,steps:[
      {kind:'speak',actor:'luffy',line:'這份我拿走囉。',durationMs:500},
      {kind:'branch',ifCharacters:['sanji'],then:[{kind:'speak',actor:'sanji',line:'還沒分好！',durationMs:500}],else:[{kind:'speak',actor:'luffy',line:'好吃！',durationMs:500}]},
      {kind:'speak',actor:'nami',requiresCharacters:['nami'],line:'別在這裡追！'}]};
    const f=fixture({owned:['luffy'],events:[event]});await f.advance(12500);f.cancelAll();
    assert(f.controller.scheduleEvent('snack'));await f.advance(4000);
    assert.deepEqual(f.log.filter(e=>e[0]==='speak').map(e=>e[1]),['luffy','luffy']);
    assert(!f.log.some(e=>e[0]==='spawn'));assert(!f.controller.snapshot().foreground);
    assert(f.controller.stateFor('luffy').memories.some(m=>m.type==='snack'));
    assert(!f.controller.scheduleEvent('snack'));
    f.controller.dispose();
  });
  await check('multi-participant event waits for all real routes and releases all leases',async()=>{
    const f=fixture({owned:['luffy','zoro','sanji'],events:[{id:'team',requiredCharacters:['luffy','zoro','sanji'],steps:[{kind:'speak',actor:'sanji',line:'都到齊再端上來。',durationMs:500}]}]});
    await f.advance(12500);f.cancelAll();assert(f.controller.scheduleEvent('team'));
    assert.equal(f.controller.reservations().filter(l=>l.token.startsWith('event')).length,3);
    assert.equal(f.log.filter(e=>e[0]==='speak').length,0);
    await f.advance(1750);
    assert.equal(f.log.filter(e=>e[0]==='speak').length,1);
    assert(!f.controller.snapshot().foreground);
    assert(!f.controller.reservations().some(l=>l.token.startsWith('event')));
    f.controller.dispose();
  });
  await check('losing a chain participant cancels the event and frees the other participants',async()=>{
    const f=fixture({events:[{id:'pair',requiredCharacters:['luffy','zoro'],steps:[{kind:'wait',actor:'luffy',durationMs:9000}]}]});
    await f.advance(12500);f.cancelAll();assert(f.controller.scheduleEvent('pair'));
    f.state.ownedItemIds=['room-character-luffy'];f.controller.tick(f.now()+50);
    assert(!f.controller.snapshot().foreground);
    assert(!f.controller.reservations().some(l=>l.token.startsWith('event')));
    assert(!f.controller.snapshot().recentEvents.some(e=>e.id==='pair'));
    f.controller.dispose();
  });
  await check('arrival is acknowledged once only after walking and greeting',async()=>{
    const f=fixture({owned:['luffy']});
    f.setArrivals([{arrivalId:'arrival-1',itemId:'room-character-luffy',createdAt:f.now()}]);
    f.controller.tick(f.now()+1);assert(f.log.some(e=>e[0]==='move'));
    assert(!f.log.some(e=>e[0]==='command'&&e[1]==='arrival.ack'));
    await f.advance(4500);
    assert.equal(f.log.filter(e=>e[0]==='command'&&e[1]==='arrival.ack').length,1);
    f.setArrivals([{arrivalId:'arrival-1',itemId:'room-character-luffy',createdAt:f.now()}]);
    await f.advance(4000);
    assert.equal(f.log.filter(e=>e[0]==='command'&&e[1]==='arrival.ack').length,1);
    assert.equal(f.controller.queueArrival('sanji','bad'),false);
    f.controller.dispose();
  });
  await check('rare events are not scheduled every twenty seconds',async()=>{
    const f=fixture({owned:['luffy'],events:[{id:'quiet',requiredCharacters:['luffy'],priority:40,steps:[{kind:'wait',actor:'luffy',durationMs:500}]}]});
    await f.advance(140000,1000);
    assert(!f.controller.snapshot().recentEvents.some(e=>e.id==='quiet'));
    assert(f.controller.snapshot().nextRareAt>f.now());
    f.controller.dispose();
  });
  await check('memory is bounded, decays, and relationship dimensions remain separate',async()=>{
    const f=fixture();const entries=Array.from({length:35},(_,i)=>({type:'memory-'+i,timestamp:f.now()-1000,strength:1,decay:60000}));
    f.controller.sync({ownedCharacterIds:f.owned,characters:{'room-character-luffy':{needs:{energy:80,hunger:10,mood:70,social:60,workMotivation:50},memories:entries}}});
    assert.equal(f.controller.stateFor('luffy').memories.length,16);
    assert.deepEqual(Object.keys(f.controller.snapshot().pairs['luffy:zoro']).sort(),['familiarity','friendship','respect','rivalry']);
    await f.advance(65000,1000);
    assert(!f.controller.stateFor('luffy').memories.some(m=>m.type.startsWith('memory-')));
    f.controller.dispose();
  });
  await check('clock jumps never create negative needs or claim unactivated work',async()=>{
    const f=fixture();f.controller.tick(f.now());
    f.setNow(f.now()-3600000);f.controller.tick();
    assert(Object.values(f.controller.stateFor('luffy').needs).every(n=>Number.isFinite(n)&&n>=0&&n<=100));
    f.setNow(f.now()+86400000*100);f.controller.tick();
    assert(Object.values(f.controller.stateFor('luffy').needs).every(n=>n>=0&&n<=100));
    assert(!f.log.some(e=>e[0]==='command'&&e[1]==='work.complete'));
    f.controller.dispose();
  });
  await check('rebind preserves needs and jobs instead of reinitializing the controller',async()=>{
    const f=fixture();await f.controller.assignWork('luffy');await f.advance(600);
    const before=f.controller.stateFor('luffy').needs;
    f.controller.pause();f.controller.rebind(f.adapter);f.controller.resume();
    assert.deepEqual(f.controller.stateFor('luffy').needs,before);
    assert.equal(f.controller.snapshot().jobs.length,1);
    assert(f.controller.isBusy('luffy'));f.controller.dispose();
  });
  await check('read-only visitor controller never submits life commands',async()=>{
    const f=fixture({writable:false});await f.advance(70000,1000);
    assert.equal((await f.controller.assignWork('luffy')).error,'unavailable');
    assert.equal((await f.controller.interact('luffy','gift')).error,'readonly');
    assert(!f.log.some(e=>e[0]==='command'));f.controller.dispose();
  });
  await check('dispose prevents asynchronous callbacks from restoring life state',async()=>{
    let resolve;
    const f=fixture({command:()=>new Promise(done=>{resolve=done;})});
    const promise=f.controller.assignWork('luffy');await flush();f.controller.dispose();
    resolve({ok:true,job:{jobId:'late',itemId:'room-character-luffy'},life:{ownedCharacterIds:f.owned,jobs:[]}});
    await promise;
    assert(f.controller.snapshot().disposed);assert.equal(f.controller.snapshot().tasks.length,0);
    assert.equal(f.controller.reservations().length,0);
  });
  await check('weighted decisions expose varied life states while unavailable furniture is not invented',async()=>{
    const visited=new Set();
    for(const selected of ['Idle','Wander','Rest','Sleep','Train','SpecialAction','UseFurniture','Eat']) {
      const f=fixture({owned:['luffy']});
      f.data.characters.luffy.weights={...Object.fromEntries(life.STATES.map(s=>[s,0])),[selected]:100};
      f.controller.tick(f.now()+1);visited.add(f.controller.stateFor('luffy').state);f.controller.dispose();
    }
    for(const selected of ['Idle','Wander','Rest','Sleep','Train','SpecialAction','UseFurniture','Eat'])assert(visited.has(selected),selected);
    const f=fixture({owned:['luffy'],stations:false});
    f.data.characters.luffy.weights={...Object.fromEntries(life.STATES.map(s=>[s,0])),Eat:100};
    f.controller.tick(f.now()+1);assert.equal(f.controller.stateFor('luffy').state,'Wander');f.controller.dispose();
  });
  await check('older server revisions cannot restore removed ownership or stale jobs',async()=>{
    const f=fixture();f.controller.sync({revision:9,ownedCharacterIds:['room-character-luffy'],characters:{},jobs:[],directive:'research'});
    f.controller.sync({revision:8,ownedCharacterIds:f.owned,characters:{},jobs:[{jobId:'stale',itemId:'room-character-zoro',status:'active'}],directive:'free_day'});
    const result=f.controller.snapshot();assert.equal(result.revision,9);assert.equal(result.directive,'research');
    assert.deepEqual(result.ownedCharacterIds,['room-character-luffy']);assert.equal(result.jobs.length,0);f.controller.dispose();
  });
  await check('duplicate IPC forwarding and later heartbeat do not replay an offline receipt',async()=>{
    const f=fixture();const summary={receiptId:'offline-1',elapsedMs:120000,completedJobs:1,coins:10};
    f.controller.sync({revision:1,ownedCharacterIds:f.owned,jobs:[],offlineSummary:summary});
    assert.equal(f.controller.snapshot().offlineSummary.coins,10);
    f.controller.sync({revision:2,ownedCharacterIds:f.owned,jobs:[],offlineSummary:summary});
    assert.equal(f.controller.snapshot().offlineSummary,null);
    f.controller.sync({revision:2,ownedCharacterIds:f.owned,jobs:[],offlineSummary:summary});
    assert.equal(f.controller.snapshot().offlineSummary,null);f.controller.dispose();
  });
  await check('station stages require available real clips and play distinct actions',async()=>{
    const f=fixture();f.data.stations={kitchen:{stages:[{id:'prepare',clip:'work',durationMs:750},{id:'review',clip:'read',durationMs:750}]}};
    let ready=false;f.adapter.hasClip=(_key,clip)=>clip!=='read'||ready;
    await f.controller.assignWork('luffy');await f.advance(800);
    assert(!f.log.some(e=>e[0]==='command'&&e[1]==='work.activate'));
    ready=true;await f.advance(2400);
    assert(f.log.some(e=>e[0]==='clip'&&e[2]==='work'));
    assert(f.log.some(e=>e[0]==='clip'&&e[2]==='read'));f.controller.dispose();
  });
  await check('event action gate requires decoded art, not a semantic action name',async()=>{
    const f=fixture({events:[{id:'eat',requiredCharacters:['luffy'],requiredActions:[{actor:'luffy',clip:'eat',direction:'south'}],steps:[{kind:'act',actor:'luffy',clip:'eat',direction:'south'}]}]});
    assert.equal(f.controller.getEventPool().length,0);
    f.adapter.hasClip=()=>true;assert.equal(f.controller.getEventPool().length,1);f.controller.dispose();
  });
  await check('repeated taps use authored escalation without mutating economy',async()=>{
    const f=fixture({owned:['luffy']});f.data.playerLines={luffy:{call:[{line:'嗯？怎麼啦？'}],repeatClick:[{line:'哈哈，你還要戳幾次？'}]}};
    assert.equal(f.controller.react('luffy').line,'嗯？怎麼啦？');
    assert.equal(f.controller.react('luffy').error,'interaction_cooldown');
    f.setNow(f.now()+1300);f.controller.react('luffy');f.setNow(f.now()+1300);
    assert.equal(f.controller.react('luffy').line,'哈哈，你還要戳幾次？');
    assert(!f.log.some(e=>e[0]==='command'));f.controller.dispose();
  });
  await check('furniture removed during editor suspension cancels its reservation safely',async()=>{
    const f=fixture();await f.controller.assignWork('luffy');f.controller.pause();f.state.stations=[];f.controller.resume();await flush();
    assert(!f.controller.isBusy('luffy'));assert.equal(f.controller.reservations().length,0);
    assert(f.log.some(e=>e[0]==='command'&&e[1]==='work.cancel'));f.controller.dispose();
  });
  await check('real authored data integrates without admitting unowned cast or nonexistent furniture',async()=>{
    const data=require('../desktop/launcher-life-data');
    const f=fixture({data,owned:['luffy','zoro']});f.adapter.hasClip=()=>true;
    assert(f.controller.getEventPool().length>0);
    for(const event of f.controller.getEventPool()) {
      assert(event.requiredCharacters.every(key=>['luffy','zoro'].includes(key)));
      assert(event.requiredFurniture.every(key=>key==='kitchen-table'));
    }
    await f.advance(240000,1000);
    assert.deepEqual(f.controller.snapshot().ownedCharacterIds.sort(),['room-character-luffy','room-character-zoro']);
    assert(f.log.filter(e=>e[0]==='speak').every(e=>['luffy','zoro'].includes(e[1])));
    assert.equal(f.log.filter(e=>e[0]==='spawn').length,0);f.controller.dispose();
  });
  console.log(JSON.stringify({ok:true,checks:checks.length,scope:'Pure controller with virtual clock and fake renderer/server. No visual, database, or public deployment acceptance.',results:checks},null,2));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
