'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const life=require('../server/launcher-life-store');
const species=require('../server/launcher-minigames').FISH_SPECIES;
const db=new PGlite(),checks=[];
let queue=Promise.resolve(),serial=0;
const pool={query:(...args)=>db.query(...args),async connect(){const previous=queue;let done;queue=new Promise(resolve=>done=resolve);await previous;return{query:(...args)=>db.query(...args),release:done};}};
const cap={crewContentRevision:1},today=new Date().toISOString().slice(0,10),base=Date.parse(today+'T03:00:00.000Z');
const at=seconds=>new Date(base+seconds*1000),actor='room-character-luffy';
const check=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks.push({name,status:'PASS'});};
const ref=game=>({sessionId:game.id,token:game.token});
async function createUser(secret,owned=[]){
  const stats={client:{totals:{coins:73}},board:{saved:'preserve'},launcherWalletV1:{coins:100,lastGrantDay:today},launcherOwnedV1:{items:[actor,...owned]},launcherRoomV1:{revision:1,sceneId:'room-scene-default',capacityVersion:2,placements:[],characters:[{itemId:actor,x:160,y:440}]}};
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$1,$2,$3::jsonb)',[secret,'8',JSON.stringify(stats)]);
}
const get=(secret,t=0)=>life.getLauncherLife(pool,secret,at(t),cap);
async function command(secret,type,payload,t=0,requestId){
  const state=await get(secret,t);
  return life.commandLauncherLife(pool,secret,{type,payload,requestId:requestId||'fishing-qa-'+String(++serial).padStart(8,'0'),expectedRevision:state.life.revision},at(t),cap);
}
const counter={left:'right',right:'left',deep:'slack'};
const sides=[0,1,2,3];
const openings=(tile,rotation)=>(tile.type==='straight'?[0,2]:[0,1]).map(side=>(side+rotation)%4);
function repairSolution(round){
  const rotations=round.tiles.map(tile=>tile.rotation),seen=new Set();
  function visit(index,entry){
    if(seen.has(index))return false;
    seen.add(index);
    for(let rotation=0;rotation<4;rotation++){
      const ports=openings(round.tiles[index],rotation);
      if(!ports.includes(entry))continue;
      const exit=ports.find(side=>side!==entry);
      if(index===round.exit.index&&exit===1){rotations[index]=rotation;return true;}
      const x=index%3,y=Math.floor(index/3),nx=x+[0,1,0,-1][exit],ny=y+[-1,0,1,0][exit];
      if(nx<0||nx>2||ny<0||ny>2)continue;
      if(visit(ny*3+nx,(exit+2)%4)){rotations[index]=rotation;return true;}
    }
    seen.delete(index);
    return false;
  }
  assert.equal(visit(round.entry.index,3),true,'generated repair board is solvable');
  return rotations;
}
function navigationSolution(round){
  const paths=[[round.start]],visited=new Set([round.start]);
  while(paths.length){
    const current=paths.shift(),last=current.at(-1);
    if(last===round.goal)return current;
    const x=last%4,y=Math.floor(last/4);
    for(const next of [x>0?last-1:-1,x<3?last+1:-1,y>0?last-4:-1,y<3?last+4:-1]){
      if(next<0||visited.has(next)||round.blocked.includes(next))continue;
      visited.add(next);paths.push([...current,next]);
    }
  }
  throw Error('generated navigation chart is unsolvable');
}
function solve(job,round){
  if(job==='supply')return{selections:round.crates.filter(crate=>crate.category===round.order.category).map(crate=>crate.id)};
  if(job==='cooking')return{ingredients:round.recipe};
  if(job==='repair')return{rotations:repairSolution(round)};
  if(job==='navigation')return{path:navigationSolution(round)};
  return{counterMoves:round.pulls.map(pull=>counter[pull])};
}
async function play(secret,job){
  let time=0,response=await command(secret,'minigame.start',{kind:'work',characterId:actor,jobId:job});
  assert.equal(response.ok,true,JSON.stringify(response));
  let game=response.minigame;
  check(`${job}: secret catch hidden before finish`,Object.hasOwn(game,'catchSpeciesId'),false);
  while(game.challenge){
    const round=game.challenge;
    time=Math.max(time,(Date.parse(round.notBefore)-base)/1000);
    response=await command(secret,'minigame.answer',{...ref(game),roundId:round.id,...solve(job,round)},time);
    assert.equal(response.ok,true,JSON.stringify(response));
    game=response.minigame;
  }
  time=Math.max(time,(Date.parse(game.finishNotBefore)-base)/1000);
  response=await command(secret,'minigame.finish',ref(game),time);
  assert.equal(response.ok,true,JSON.stringify(response));
  check(`${job}: all rounds correct`,response.minigame.result.correctRounds,job==='fishing'?5:8);
  check(`${job}: server awards 10 coins`,response.wallet.coins,110);
  return{response,time};
}
async function main(){
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  for(const job of ['supply','cooking','repair','navigation','fishing']){
    await createUser(job);
    const {response,time}=await play(job,job);
    if(job!=='fishing')continue;
    const fish=response.minigame.result.catch;
    check('fishing: one canonical fish awarded',species.some(entry=>entry.id===fish.speciesId),true);
    check('fishing: collection persisted',(await get(job,time)).life.fishCollection.length,1);
    check('fishing: fish starts outside tank',fish.inAquarium,false);
    check('fishing: duplicate finish cannot mint fish',(await command(job,'minigame.finish',ref(response.minigame),time+1)).life.fishCollection.length,1);
    check('fishing: unknown fish cannot be displayed',(await command(job,'fish.place',{fishId:crypto.randomUUID(),inAquarium:true},time+1)).error,'fish_not_owned');
    check('fishing: display needs owned scene or tank',(await command(job,'fish.place',{fishId:fish.id,inAquarium:true},time+1)).error,'fish_aquarium_locked');
    await createUser('visitor',['room-furniture-aquarium-tank']);
    check('fishing: friend cannot move someone else fish',(await command('visitor','fish.place',{fishId:fish.id,inAquarium:true},time+1)).error,'fish_not_owned');
    const ownerRow=(await db.query('SELECT * FROM player_profiles WHERE secret=$1',['fishing'])).rows[0];
    ownerRow.stats.launcherOwnedV1.items.push('room-furniture-aquarium-tank');
    await db.query('UPDATE player_profiles SET stats=$1::jsonb WHERE secret=$2',[JSON.stringify(ownerRow.stats),'fishing']);
    check('fishing: owned tank allows placement',(await command(job,'fish.place',{fishId:fish.id,inAquarium:true},time+1)).fish.inAquarium,true);
    const projection=await life.publicProjection(pool,(await db.query('SELECT * FROM player_profiles WHERE secret=$1',['fishing'])).rows[0]);
    check('fishing: friend sees displayed fish',projection.fishCollection.map(entry=>entry.id),[fish.id]);
    check('fishing: retrieve keeps collection',(await command(job,'fish.place',{fishId:fish.id,inAquarium:false},time+1)).life.fishCollection.length,1);
    const hidden=await life.publicProjection(pool,(await db.query('SELECT * FROM player_profiles WHERE secret=$1',['fishing'])).rows[0]);
    check('fishing: friend does not see stored fish',hidden.fishCollection.length,0);
    check('fishing: re-display after retrieve',(await command(job,'fish.place',{fishId:fish.id,inAquarium:true},time+1)).fish.inAquarium,true);
    const stateRow=(await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1',[ownerRow.user_id])).rows[0];
    stateRow.state.fishCollection=Array.from({length:64},(_,index)=>({id:index===0?fish.id:crypto.randomUUID(),speciesId:species[index%species.length].id,caughtAt:at(time+1).toISOString(),inAquarium:index<6}));
    await db.query('UPDATE launcher_life_state SET state=$1::jsonb WHERE user_id=$2',[JSON.stringify(stateRow.state),ownerRow.user_id]);
    check('fishing: collection cap blocks new paid session',(await command(job,'minigame.start',{kind:'work',characterId:actor,jobId:'fishing'},time+2)).error,'fish_collection_full');
    check('fishing: seventh tank fish rejected',(await command(job,'fish.place',{fishId:stateRow.state.fishCollection[6].id,inAquarium:true},time+2)).error,'fish_aquarium_full');
    check('fishing: release removes selected catch',(await command(job,'fish.release',{fishId:stateRow.state.fishCollection[7].id},time+2)).life.fishCollection.length,63);
    check('fishing: invalid release cannot duplicate',(await command(job,'fish.release',{fishId:stateRow.state.fishCollection[7].id},time+2)).error,'fish_not_owned');
    check('fishing: wallet unchanged by collection actions',(await get(job,time+2)).wallet.coins,110);
    check('fishing: existing board save retained',(await db.query('SELECT stats FROM player_profiles WHERE secret=$1',['fishing'])).rows[0].stats.board,{saved:'preserve'});
  }
  await createUser('late-fishing');
  const lateStart=await command('late-fishing','minigame.start',{kind:'work',characterId:actor,jobId:'fishing'});
  assert.equal(lateStart.ok,true,JSON.stringify(lateStart));
  const lateGame=lateStart.minigame,lateRound=lateGame.challenge;
  const lateAt=(Date.parse(lateRound.notBefore)-base)/1000+lateRound.answerWindowMs/1000+3.1;
  const lateAnswer=await command('late-fishing','minigame.answer',{
    ...ref(lateGame),roundId:lateRound.id,...solve('fishing',lateRound)
  },lateAt);
  assert.equal(lateAnswer.ok,true,JSON.stringify(lateAnswer));
  check('fishing: server rejects correct answer after round deadline',lateAnswer.minigame.feedback.correct,false);
  check('fishing: late answer does not increase score',lateAnswer.minigame.score,0);
  const files=['server/launcher-life.js','server/launcher-life-store.js','server/launcher-minigames.js','scripts/launcher_fishing_server_qa.js'];
  const report={schemaVersion:1,status:'PASS',checks:checks.length,results:checks,sourceHashes:Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex')])),limitations:['In-memory PGlite service test with serialized transactions. Does not prove production PostgreSQL timing or human play.'],createdAt:new Date().toISOString()};
  if(process.argv[2]){fs.mkdirSync(path.dirname(path.resolve(process.argv[2])),{recursive:true});fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({status:'PASS',checks:checks.length,output:process.argv[2]||null}));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1});
