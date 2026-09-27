'use strict';
// Isolated contract and economy checks. PGlite transactions are serialized by
// this harness; they are not proof of production PostgreSQL concurrency.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const M=require('../server/launcher-minigames'),B=require('../server/launcher-life-store'),S=require('../server/launcher-profile-shop');
const checks=[],coverage={},db=new PGlite();let tail=Promise.resolve(),seq=0;
const pool={query:(...args)=>db.query(...args),async connect(){const before=tail;let release;tail=new Promise(resolve=>release=resolve);await before;return{query:(...args)=>db.query(...args),release};}};
const cap={crewContentRevision:1},today=new Date().toISOString().slice(0,10),base=Date.parse(today+'T03:00:00.000Z'),now=s=>new Date(base+s*1000),id=key=>'room-character-'+key;
const check=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks.push({name,status:'PASS'});};
const ref=session=>({sessionId:session.id,token:session.token});
const ports=(tile,rotation)=>(tile.type==='straight'?[0,2]:[0,1]).map(value=>(value+rotation)%4);
// Independent search follows reciprocal ports, rather than using a production
// solver or the generator's hidden route.
function repairSolution(round){
  const solution=round.tiles.map(tile=>tile.rotation),sideNames=['north','east','south','west'];
  function search(index,entry,visited){
    if(visited.has(index))return false;const seen=new Set(visited);seen.add(index);
    for(let rotation=0;rotation<4;rotation++){
      const sides=ports(round.tiles[index],rotation);if(!sides.includes(entry))continue;
      const exit=sides.find(side=>side!==entry);solution[index]=rotation;
      if(index===round.exit.index&&exit===sideNames.indexOf(round.exit.side))return true;
      const x=index%3+[0,1,0,-1][exit],y=Math.floor(index/3)+[-1,0,1,0][exit];
      if(x>=0&&x<3&&y>=0&&y<3&&search(y*3+x,(exit+2)%4,seen))return true;
    }
    return false;
  }
  assert.equal(search(round.entry.index,sideNames.indexOf(round.entry.side),new Set()),true,'repair generated a solvable layout');return solution;
}
function navigationSolution(round){
  const queue=[[round.start]],seen=new Set([round.start]);
  while(queue.length){const route=queue.shift(),cell=route.at(-1);if(cell===round.goal)return route;
    for(let next=0;next<round.size*round.size;next++)if(!seen.has(next)&&!round.blocked.includes(next)&&Math.abs(cell%4-next%4)+Math.abs(Math.floor(cell/4)-Math.floor(next/4))===1){seen.add(next);queue.push([...route,next]);}}
  throw new Error('navigation generated an unreachable goal');
}
function solution(session){const round=session.challenge;
  if(session.kind==='training')return{directions:round.directions};
  switch(session.jobId||'supply'){
    case'cooking':return{ingredients:round.recipe};
    case'repair':return{rotations:repairSolution(round)};
    case'navigation':return{path:navigationSolution(round)};
    default:return{selections:round.crates.filter(crate=>crate.category===round.order.category).map(crate=>crate.id)};
  }
}
function miss(session){switch(session.jobId||'supply'){
  case'cooking':return{ingredients:[]};case'repair':return{rotations:session.challenge.tiles.map(tile=>tile.rotation)};case'navigation':return{path:[]};default:return{selections:[]};}}
const row=async secret=>(await db.query('SELECT * FROM player_profiles WHERE secret=$1',[secret])).rows[0];
const get=(secret,t=0)=>B.getLauncherLife(pool,secret,now(t),cap);
async function add(secret,coins=100){const keys=['luffy','zoro','nami','sanji'];return db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$1,$2,$3::jsonb)',[secret,'8',JSON.stringify({client:{totals:{coins:73}},board:{saved:'keep'},launcherWalletV1:{coins,lastGrantDay:today},launcherOwnedV1:{items:keys.map(id)},launcherRoomV1:{revision:1,sceneId:'room-scene-default',capacityVersion:2,placements:[],characters:keys.map((key,i)=>({itemId:id(key),x:150+i*70,y:440}))}})]);}
async function cmd(secret,type,payload,t=0,options={}){const snap=options.snapshot||await get(secret,t);return B.commandLauncherLife(pool,secret,{type,payload,requestId:options.requestId||'work-variants-'+String(++seq).padStart(8,'0'),expectedRevision:options.revision??snap.life.revision},now(t),cap);}
const start=(secret,jobId,actor='luffy',t=0,extra={})=>cmd(secret,'minigame.start',{kind:'work',characterId:id(actor),...(jobId===undefined?{}:{jobId}),...extra},t);
async function play(secret,response,t=0,wrong=0){let session=response.minigame;
  while(session.challenge){t=Math.max(t,(Date.parse(session.challenge.notBefore)-base)/1000);response=await cmd(secret,'minigame.answer',{...ref(session),roundId:session.challenge.id,...(wrong-->0?miss(session):solution(session))},t);assert.equal(response.ok,true,JSON.stringify(response));session=response.minigame;}
  t=Math.max(t,(Date.parse(session.finishNotBefore)-base)/1000);return{response:await cmd(secret,'minigame.finish',ref(session),t),t};
}
async function main(){
  for(const jobId of ['cooking','repair','navigation']){
    let rounds=0;const layouts=new Set();
    for(let n=0;n<32;n++){
      const session=M.create('work',id('luffy'),1,now(0),false,jobId);
      for(let index=0;index<8;index++){
        const round=session.challenge,input=solution(session);
        if(jobId==='repair'){
          const unsolved=structuredClone(session);assert.deepEqual(M.answer(unsolved,{roundId:round.id,rotations:round.tiles.map(tile=>tile.rotation)},new Date(round.notBefore)),{});assert.equal(unsolved.feedback.correct,false);
          layouts.add(round.tiles.map(tile=>tile.type+tile.rotation).join(','));
        }
        if(jobId==='navigation'){assert.ok(input.path.length-1<=round.maxSteps);assert.equal(round.blocked.includes(round.start)||round.blocked.includes(round.goal),false);layouts.add(round.blocked.join(','));}
        if(jobId==='cooking'){assert.equal(new Set(round.ingredients.map(item=>item.id)).size,6);assert.ok(round.recipe.every(key=>round.ingredients.some(item=>item.id===key)));layouts.add(round.recipeLabel);}
        assert.deepEqual(M.answer(session,{roundId:round.id,...input},new Date(round.notBefore)),{});assert.equal(session.feedback.correct,true);rounds++;
      }
      assert.equal(session.correctRounds,8);assert.equal(session.challenge,null);
    }
    coverage[jobId]={generatedRounds:rounds,distinctLayouts:layouts.size};check(jobId+' generated rounds are all independently solvable',rounds,256);check(jobId+' contains layout variation',layouts.size>1,true);
  }
  for(const jobId of ['supply','cooking','repair','navigation']){
    const session=M.create('work',id('luffy'),1,now(0),false,jobId),round=session.challenge,input=solution(session);
    check(jobId+' rejects premature answer',M.answer(structuredClone(session),{roundId:round.id,...input},now(0)).error,'minigame_too_early');
    check(jobId+' rejects cross-game answer injection',M.answer(structuredClone(session),{roundId:round.id,...input,directions:[]},new Date(round.notBefore)).error,'invalid_minigame_answer');
    const timeout=structuredClone(session);check(jobId+' accepts legal timeout input',M.answer(timeout,{roundId:round.id,...miss(session)},new Date(round.notBefore)),{});check(jobId+' timeout is a miss',timeout.feedback.correct,false);
  }
  const navigation=M.create('work',id('luffy'),1,now(0),false,'navigation');navigation.challenge={...navigation.challenge,start:0,goal:15,blocked:[5],maxSteps:6};
  for(const [label,route] of [['teleport',[0,15]],['row-wrap',[0,1,2,3,4,8,12,13,14,15]],['reef',[0,1,5,9,13,14,15]],['backtracking',[0,1,0,4,8,12,13,14,15]],['over-budget',[0,1,2,6,10,9,13,14,15]]]){
    const test=structuredClone(navigation);check('navigation '+label+' is scored as wrong',M.answer(test,{roundId:test.challenge.id,path:route},new Date(test.challenge.notBefore)),{});check('navigation '+label+' cannot pass',test.feedback.correct,false);
  }
  const repair=M.create('work',id('luffy'),1,now(0),false,'repair');
  for(const rotations of [[],Array(9).fill(4),Array(9).fill(-1),Array(9).fill(0.5),Array(9).fill('1')])check('repair malformed rotation rejected '+JSON.stringify(rotations),M.answer(structuredClone(repair),{roundId:repair.challenge.id,rotations},new Date(repair.challenge.notBefore)).error,'invalid_minigame_answer');
  const cooking=M.create('work',id('luffy'),1,now(0),false,'cooking');check('cooking rejects forged ingredient',M.answer(cooking,{roundId:cooking.challenge.id,ingredients:['coin']},new Date(cooking.challenge.notBefore)).error,'invalid_minigame_answer');
  const reversed=structuredClone(cooking);M.answer(reversed,{roundId:reversed.challenge.id,ingredients:[...reversed.challenge.recipe].reverse()},new Date(reversed.challenge.notBefore));check('cooking requires the recipe sequence',reversed.feedback.correct,false);
  const train=M.create('training',id('luffy'),1,now(0));check('training rejects work answerfield',M.answer(train,{roundId:train.challenge.id,directions:train.challenge.directions,ingredients:[]},new Date(train.challenge.notBefore)).error,'invalid_minigame_answer');
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  await add('invalid');for(const jobId of ['treasure','',null,{},1])check('unknown work job rejected '+JSON.stringify(jobId),(await start('invalid',jobId)).error,'invalid_minigame');
  check('rejected jobs consume no work allowance',(await row('invalid')).stats.launcherCompanionsV1.workStartsToday,0);
  check('training cannot carry a work jobId',(await cmd('invalid','minigame.start',{kind:'training',characterId:id('luffy'),jobId:'cooking'})).error,'invalid_minigame');
  for(const jobId of ['cooking','repair','navigation']){
    await add(jobId);const first=await start(jobId,jobId),session=first.minigame;
    check(jobId+' public session preserves selected job',session.jobId,jobId);check(jobId+' holds shared global allowance',(await row(jobId)).stats.launcherCompanionsV1.workStartsToday,1);
    check(jobId+' opening never grants coins',first.wallet.coins,100);check(jobId+' gets enough time for eight rounds',Date.parse(session.expiresAt)-Date.parse(session.startedAt),300000);
    check(jobId+' reconnect preserves current puzzle',(await get(jobId,1)).activeMinigame.challenge,session.challenge);
    check(jobId+' blocks parallel work variant',(await start(jobId,'supply','zoro',1)).error,'minigame_active');
    const input={...ref(session),roundId:session.challenge.id,...solution(session)},t=(Date.parse(session.challenge.notBefore)-base)/1000;
    check(jobId+' client reward injection rejected',(await cmd(jobId,'minigame.answer',{...input,coins:1000},t)).error,'invalid_command');
    const answered=await cmd(jobId,'minigame.answer',input,t,{requestId:jobId+'-answer-idempotent'});
    check(jobId+' answer request is idempotent',(await cmd(jobId,'minigame.answer',input,t,{requestId:jobId+'-answer-idempotent'})).minigame.roundIndex,1);
    check(jobId+' old round cannot be replayed',(await cmd(jobId,'minigame.answer',input,t)).error,'minigame_round_conflict');
    const won=await play(jobId,answered,t);check(jobId+' awards shop coins once',won.response.wallet.coins,110);check(jobId+' awards fixed ten coins',won.response.minigame.result.coins,10);check(jobId+' awards existing affinity',won.response.minigame.result.affinity,1);
    check(jobId+' keeps the existing ledger namespace',won.response.receipt.operationId,'life-work:minigame-'+session.id);
    check(jobId+' repeated completion returns same receipt',(await cmd(jobId,'minigame.finish',ref(session),won.t+1)).receipt,won.response.receipt);
    check(jobId+' duplicate finish never adds coins',(await get(jobId,won.t+1)).wallet.coins,110);
    check(jobId+' preserves Board save',(await row(jobId)).stats.board,{saved:'keep'});check(jobId+' preserves Card coins',(await row(jobId)).stats.client.totals.coins,73);
    check(jobId+' can spend coins through current shop',(await S.changeLauncherItem(pool,jobId,'bgm-op-01','buy',cap)).ok,true);
    await add(jobId+'-retry');const retryStart=await start(jobId+'-retry',jobId),failure=await play(jobId+'-retry',retryStart,0,8);
    check(jobId+' failure does not pay',failure.response.wallet.coins,100);const retry=await cmd(jobId+'-retry','minigame.retry',ref(retryStart.minigame),failure.t+1);
    check(jobId+' retry retains job identity',retry.minigame.jobId,jobId);check(jobId+' retry reserves no extra quota',(await row(jobId+'-retry')).stats.launcherCompanionsV1.workStartsToday,1);
    check(jobId+' retry can earn one reward',(await play(jobId+'-retry',retry,failure.t+1)).response.wallet.coins,110);
  }
  await add('legacy');const legacy=await start('legacy');check('missing jobId stays supply',legacy.minigame.jobId,'supply');
  const stored=(await db.query('SELECT session FROM launcher_minigame_sessions WHERE session_id=$1',[legacy.minigame.id])).rows[0].session;delete stored.jobId;
  await db.query('UPDATE launcher_minigame_sessions SET session=$1::jsonb WHERE session_id=$2',[JSON.stringify(stored),stored.id]);
  check('pre-update stored session is projected as supply',(await get('legacy')).activeMinigame.jobId,'supply');
  check('pre-update stored session completes without migration',(await play('legacy',{minigame:(await get('legacy')).activeMinigame})).response.wallet.coins,110);
  await add('quota');for(const [index,jobId] of ['cooking','repair','navigation','supply','repair','cooking'].entries()){
    const r=await start('quota',jobId,['luffy','zoro','nami'][Math.floor(index/2)]);assert.equal(r.ok,true);await cmd('quota','minigame.cancel',ref(r.minigame));
  }
  check('switching work games cannot bypass global six starts',(await start('quota','navigation','sanji')).error,'work_daily_limit');
  check('legacy background API shares the global quota',(await S.startLauncherCharacterWork(pool,'quota',id('sanji'),now(0),cap)).error,'work_daily_limit');
  await add('actor-quota');for(const jobId of ['cooking','repair']){const r=await start('actor-quota',jobId);await cmd('actor-quota','minigame.cancel',ref(r.minigame));}
  check('switching work games cannot bypass actor two starts',(await start('actor-quota','navigation')).error,'work_daily_limit');
  await add('expiry');const expires=await start('expiry','repair');check('new repair still active at 240 seconds',(await get('expiry',240)).activeMinigame.id,expires.minigame.id);check('repair expires at 300 seconds',(await get('expiry',301)).activeMinigame,null);check('expired new game never pays',(await get('expiry',301)).wallet.coins,100);
  await add('full',495);check('new cooking respects full wallet',(await start('full','cooking')).error,'wallet_full');check('wallet full consumes no quota',(await row('full')).stats.launcherCompanionsV1.workStartsToday,0);
  await add('ready',480);const readyStart=await start('ready','navigation'),fill=(await row('ready')).stats;fill.launcherWalletV1.coins=495;await db.query('UPDATE player_profiles SET stats=$1::jsonb WHERE secret=$2',[JSON.stringify(fill),'ready']);
  const ready=await play('ready',readyStart);check('navigation holds reward when wallet fills',ready.response.error,'wallet_full');check('ready reward survives game timeout',(await get('ready',310)).activeMinigame.state,'ready');
  await S.changeLauncherItem(pool,'ready','bgm-op-01','buy',cap);check('held navigation reward claims after shop spend',(await cmd('ready','minigame.finish',ref(readyStart.minigame),311)).wallet.coins,495);check('held navigation creates one ledger receipt',Number((await db.query('SELECT count(*) AS n FROM launcher_wallet_ledger WHERE user_id=$1',[(await row('ready')).user_id])).rows[0].n),1);
  const sources=['server/launcher-minigames.js','server/launcher-life-store.js','scripts/launcher_work_variants_server_qa.js'],report={schemaVersion:1,status:'PASS',checks:checks.length,coverage,results:checks,sourceHashes:Object.fromEntries(sources.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex')])),limitations:['PGlite isolated in-memory database with serialized transactions; not production PostgreSQL concurrency or human play testing.'],createdAt:new Date().toISOString()};
  const output=process.argv[2];if(output){fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify({status:'PASS',checks:checks.length,coverage,output:output||null}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(()=>db.close());
