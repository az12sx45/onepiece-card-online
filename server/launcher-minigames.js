'use strict';

// Sessions are private server records. Profile-row locking in life-store also
// serializes them with the existing shop, background jobs and wallet ledger.
const crypto = require('node:crypto');
const ACTIVE = new Set(['playing', 'ready', 'failed']);
const CATEGORIES = Object.freeze({food:'食材',tools:'工具',books:'書籍'});
const SUPPLIES = Object.freeze({
  food:[['meat','燻肉'],['orange','橘子'],['flour','麵粉']],
  tools:[['rope','繩索'],['hammer','木槌'],['nails','船釘']],
  books:[['logbook','航海日誌'],['chart','海圖'],['history','歷史文獻']]
});
const DIRECTIONS = ['left','up','right'];
const WORK_JOBS = Object.freeze(['supply','cooking','repair','navigation','fishing']);
// Existing catches in One Piece: Unlimited World Red. Keep this list stable for saves.
const FISH_SPECIES = Object.freeze([
  Object.freeze({id:'balloon-catfish',label:'氣球鯰魚',sourceName:'フウセンナマズ',weight:5}),
  Object.freeze({id:'glistening-saury',label:'閃亮秋刀魚',sourceName:'ギラギラサンマ',weight:4}),
  Object.freeze({id:'smile-jellyfish',label:'微笑水母',sourceName:'スマイルクラゲ',weight:4}),
  Object.freeze({id:'panda-shark',label:'熊貓鯊',sourceName:'パンサメ',weight:2})
]);
const FISH_COUNTER = Object.freeze({left:'right',right:'left',deep:'slack'});
const INGREDIENTS = Object.freeze({meat:'肉塊',fish:'鮮魚',onion:'洋蔥',potato:'馬鈴薯',rice:'白飯',salt:'海鹽',lemon:'檸檬',orange:'橘子',apple:'蘋果',cream:'鮮奶油'});
const RECIPES = Object.freeze([
  {label:'港口燉肉',steps:['onion','meat','potato','salt']},
  {label:'香煎鮮魚',steps:['fish','salt','lemon']},
  {label:'船員特製肉飯',steps:['rice','meat','onion']},
  {label:'橘香水果杯',steps:['orange','apple','cream']}
]);
const SIDES = ['north','east','south','west'];
const PIPE_PATHS = [[3,4,5],[3,0,1,2,5],[3,6,7,8,5],[3,4,1,2,5],[3,0,1,4,7,8,5],[3,6,7,4,1,2,5]];
const pick = list => list[crypto.randomInt(list.length)];
const iso = ms => new Date(ms).toISOString();
function shuffled(list) {
  const result=[...list];for(let i=result.length-1;i>0;i--){const j=crypto.randomInt(i+1);[result[i],result[j]]=[result[j],result[i]];}return result;
}
function jobFor(session) {return session.kind==='work'?(session.jobId||'supply'):null;}
function durationFor(session) {return session.kind==='work'&&jobFor(session)!=='supply'?300000:180000;}
function ports(tile,rotation) {return(tile.type==='straight'?[0,2]:[0,1]).map(side=>(side+rotation)%4);}
function neighbor(index,side,size) {
  const x=index%size,y=Math.floor(index/size),nx=x+[0,1,0,-1][side],ny=y+[-1,0,1,0][side];
  return nx<0||ny<0||nx>=size||ny>=size?-1:ny*size+nx;
}
function sideBetween(from,to,size) {return to===from-size?0:to===from+1?1:to===from+size?2:3;}
function repairConnected(round,rotations) {
  let index=round.entry.index,entrySide=SIDES.indexOf(round.entry.side);const visited=new Set();
  while(!visited.has(index)) {
    visited.add(index);const openings=ports(round.tiles[index],rotations[index]);
    if(!openings.includes(entrySide))return false;
    const exitSide=openings.find(side=>side!==entrySide);
    if(index===round.exit.index&&exitSide===SIDES.indexOf(round.exit.side))return true;
    const next=neighbor(index,exitSide,round.size);if(next<0)return false;
    index=next;entrySide=(exitSide+2)%4;
  }
  return false;
}
function workChallenge(jobId,id,roundIndex,issuedAt) {
  if(jobId==='fishing') {
    const pulls=Array.from({length:roundIndex<2?3:4},()=>pick(['left','right','deep']));
    return{id,pulls,showcaseMs:950,answerWindowMs:12500,notBefore:iso(issuedAt+3000)};
  }
  if(jobId==='cooking') {
    const dish=pick(RECIPES),recipe=[...dish.steps],extra=shuffled(Object.keys(INGREDIENTS).filter(key=>!recipe.includes(key))).slice(0,6-recipe.length);
    return{id,recipe,recipeLabel:dish.label,ingredients:shuffled([...recipe,...extra]).map(key=>({id:key,label:INGREDIENTS[key]})),showcaseMs:1200,answerWindowMs:10000,notBefore:iso(issuedAt+3000)};
  }
  if(jobId==='repair') {
    const route=pick(roundIndex<2?PIPE_PATHS.slice(0,4):PIPE_PATHS.slice(1));
    const tiles=Array.from({length:9},(_,i)=>({id:id+'-'+i,type:pick(['straight','elbow']),rotation:crypto.randomInt(4)}));
    for(let i=0;i<route.length;i++) {
      const before=i===0?3:sideBetween(route[i],route[i-1],3),after=i===route.length-1?1:sideBetween(route[i],route[i+1],3);
      tiles[route[i]].type=(before+2)%4===after?'straight':'elbow';
    }
    const round={id,size:3,tiles,entry:{index:3,side:'west'},exit:{index:5,side:'east'},showcaseMs:700,answerWindowMs:18000,notBefore:iso(issuedAt+3000)};
    // A solved layout is never handed to the player, including by coincidence.
    while(repairConnected(round,tiles.map(tile=>tile.rotation)))tiles[3].rotation=(tiles[3].rotation+1)%4;
    return round;
  }
  if(jobId==='navigation') {
    const size=4,corners=[[12,3],[0,15],[3,12],[15,0]],[start,goal]=pick(corners),route=[start];
    let current=start;
    // Carve a shortest route first. Reefs only occupy other cells, so every
    // random chart is reachable within the declared move allowance.
    while(current!==goal) {
      const choices=[],x=current%size,y=Math.floor(current/size),gx=goal%size,gy=Math.floor(goal/size);
      if(x!==gx)choices.push(current+Math.sign(gx-x));if(y!==gy)choices.push(current+size*Math.sign(gy-y));
      current=pick(choices);route.push(current);
    }
    const blocked=shuffled(Array.from({length:16},(_,i)=>i).filter(i=>!route.includes(i))).slice(0,roundIndex<2?4:6).sort((a,b)=>a-b);
    return{id,size,start,goal,blocked,maxSteps:roundIndex<3?10:8,showcaseMs:900,answerWindowMs:16000,notBefore:iso(issuedAt+3000)};
  }
  return null;
}
function challenge(kind, roundIndex, now, jobId='supply') {
  const id=crypto.randomUUID(), issuedAt=now.getTime();
  if(kind==='work') {
    const variant=workChallenge(jobId,id,roundIndex,issuedAt);if(variant)return variant;
    const category=pick(Object.keys(CATEGORIES)), targets=1+crypto.randomInt(2);
    const categories=[...Array(targets).fill(category),...Array(3-targets).fill(null).map(()=>pick(Object.keys(CATEGORIES).filter(key=>key!==category)))];
    for(let i=categories.length-1;i>0;i--){const j=crypto.randomInt(i+1);[categories[i],categories[j]]=[categories[j],categories[i]];}
    const crates=categories.map((key,i)=>{const [assetKey,label]=pick(SUPPLIES[key]);return{id:id+'-'+i,assetKey,label,category:key};});
    const answerWindowMs=Math.round(4500-roundIndex*1500/7);
    return{id,crates,order:{category,label:CATEGORIES[category]},showcaseMs:700,answerWindowMs,notBefore:iso(issuedAt+3000)};
  }
  const directions=Array.from({length:[3,4,4,5][roundIndex]},()=>pick(DIRECTIONS));
  const showcaseMs=directions.length*550+600;
  return{id,directions,showcaseMs,answerWindowMs:4500,notBefore:iso(issuedAt+showcaseMs)};
}
async function ensure(db) {
  await db.query(`CREATE TABLE IF NOT EXISTS launcher_minigame_sessions (
    session_id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, status TEXT NOT NULL,
    session JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  await db.query('CREATE INDEX IF NOT EXISTS launcher_minigame_sessions_owner_status ON launcher_minigame_sessions(user_id,status)');
}
async function save(db,userId,session) {
  await db.query(`INSERT INTO launcher_minigame_sessions(session_id,user_id,status,session) VALUES($1,$2,$3,$4::jsonb)
    ON CONFLICT(session_id) DO UPDATE SET status=EXCLUDED.status,session=EXCLUDED.session,updated_at=now()`,[session.id,userId,session.state,JSON.stringify(session)]);
}
function view(session) {
  if(!session)return null;
  const {roomRevision,...result}=session;
  if(session.kind==='work')result.jobId=jobFor(session);
  // The catch is drawn by the server and revealed only after settlement.
  delete result.catchSpeciesId;
  return JSON.parse(JSON.stringify(result));
}
function contextValid(session,state,room) {
  return state.activeCharacterIds.includes(session.characterId)&&room.revision===session.roomRevision;
}
async function active(db,userId,now,state,room) {
  const found=await db.query("SELECT session FROM launcher_minigame_sessions WHERE user_id=$1 AND status IN ('playing','ready','failed') FOR UPDATE",[userId]);
  const result=[];
  for(const row of found.rows) {
    const session=row.session;
    if(!contextValid(session,state,room))session.state='invalidated';
    else if(session.state!=='ready'&&Date.parse(session.expiresAt)<=now.getTime())session.state='expired';
    if(!ACTIVE.has(session.state)){session.challenge=null;await save(db,userId,session);}else result.push(session);
  }
  return result;
}
function create(kind,characterId,roomRevision,now,practice=false,jobId='supply') {
  const session={id:crypto.randomUUID(),token:crypto.randomBytes(24).toString('hex'),kind,characterId,practice,
    ...(kind==='work'?{jobId}:{}),
    ...(kind==='work'&&jobId==='fishing'?{catchSpeciesId:pick(FISH_SPECIES.flatMap(species=>Array(species.weight).fill(species.id)))}:{}),
    state:'playing',roomRevision,attempt:1,maxAttempts:3,roundIndex:0,totalRounds:kind==='work'?(jobId==='fishing'?5:8):4,
    startedAt:now.toISOString(),finishNotBefore:iso(now.getTime()+(kind==='work'?24000:20000)),
    challenge:challenge(kind,0,now,jobId),score:0,combo:0,correctRounds:0,feedback:null,result:null};
  session.expiresAt=iso(now.getTime()+durationFor(session));return session;
}
function retry(session,now) {
  session.attempt++;session.state='playing';session.roundIndex=0;session.score=0;session.combo=0;session.correctRounds=0;session.feedback=null;session.result=null;
  session.startedAt=now.toISOString();session.expiresAt=iso(now.getTime()+durationFor(session));session.finishNotBefore=iso(now.getTime()+(session.kind==='work'?24000:20000));
  session.challenge=challenge(session.kind,0,now,jobFor(session));
}
function validId(value){return typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);}
function validToken(value){return typeof value==='string'&&/^[a-f0-9]{48}$/.test(value);}
async function load(db,userId,payload) {
  if(!validId(payload.sessionId)||!validToken(payload.token))return null;
  const row=(await db.query('SELECT session FROM launcher_minigame_sessions WHERE user_id=$1 AND session_id=$2 FOR UPDATE',[userId,payload.sessionId])).rows[0];
  if(!row)return null;
  const session=row.session;
  return crypto.timingSafeEqual(Buffer.from(session.token),Buffer.from(payload.token))?session:null;
}
function answer(session,payload,now) {
  if(session.state!=='playing'||!session.challenge)return{error:'minigame_round_complete'};
  const round=session.challenge;
  if(payload.roundId!==round.id)return{error:'minigame_round_conflict'};
  if(now.getTime()<Date.parse(round.notBefore))return{error:'minigame_too_early'};
  let correct=false;
  if(session.kind==='work') {
    const jobId=jobFor(session),field={supply:'selections',cooking:'ingredients',repair:'rotations',navigation:'path',fishing:'counterMoves'}[jobId];
    if(!field||['selections','directions','ingredients','rotations','path','counterMoves'].some(key=>key!==field&&payload[key]!==undefined))return{error:'invalid_minigame_answer'};
    if(jobId==='fishing') {
      if(!Array.isArray(payload.counterMoves)||payload.counterMoves.length>round.pulls.length||payload.counterMoves.some(move=>!['left','right','slack'].includes(move)))return{error:'invalid_minigame_answer'};
      correct=payload.counterMoves.length===round.pulls.length&&payload.counterMoves.every((move,index)=>move===FISH_COUNTER[round.pulls[index]]);
    } else if(jobId==='cooking') {
      if(!Array.isArray(payload.ingredients)||payload.ingredients.length>round.recipe.length||payload.ingredients.some(id=>!round.ingredients.some(item=>item.id===id)))return{error:'invalid_minigame_answer'};
      correct=payload.ingredients.length===round.recipe.length&&payload.ingredients.every((id,i)=>id===round.recipe[i]);
    } else if(jobId==='repair') {
      if(!Array.isArray(payload.rotations)||payload.rotations.length!==9||payload.rotations.some(value=>!Number.isInteger(value)||value<0||value>3))return{error:'invalid_minigame_answer'};
      correct=repairConnected(round,payload.rotations);
    } else if(jobId==='navigation') {
      const route=payload.path;
      if(!Array.isArray(route)||route.length>16||route.some(value=>!Number.isInteger(value)||value<0||value>=16))return{error:'invalid_minigame_answer'};
      correct=route.length>=2&&route.length-1<=round.maxSteps&&route[0]===round.start&&route.at(-1)===round.goal&&new Set(route).size===route.length&&route.every((cell,i)=>!round.blocked.includes(cell)&&(i===0||Math.abs(cell%4-route[i-1]%4)+Math.abs(Math.floor(cell/4)-Math.floor(route[i-1]/4))===1));
    } else {
    if(!Array.isArray(payload.selections)||payload.selections.length>3||
      new Set(payload.selections).size!==payload.selections.length||payload.selections.some(id=>!round.crates.some(crate=>crate.id===id)))return{error:'invalid_minigame_answer'};
    const expected=round.crates.filter(crate=>crate.category===round.order.category).map(crate=>crate.id);
    correct=expected.length===payload.selections.length&&expected.every(id=>payload.selections.includes(id));
    }
  } else {
    if(['selections','ingredients','rotations','path'].some(key=>payload[key]!==undefined)||!Array.isArray(payload.directions)||payload.directions.length>5||
      payload.directions.some(value=>!DIRECTIONS.includes(value)))return{error:'invalid_minigame_answer'};
    correct=payload.directions.length===round.directions.length&&payload.directions.every((value,i)=>value===round.directions[i]);
  }
  // The round timer is authoritative on the server, with a short allowance
  // for network latency. A late answer advances as a miss, never as a catch.
  const latestAnswerMs = Date.parse(round.notBefore) + Number(round.answerWindowMs) + 3000;
  if(!Number.isFinite(latestAnswerMs)||now.getTime()>latestAnswerMs)correct=false;
  session.combo=correct?session.combo+1:0;
  if(correct){session.correctRounds++;session.score+=100+Math.min(4,session.combo-1)*25;}
  session.feedback={roundIndex:session.roundIndex,correct,combo:session.combo,correctRounds:session.correctRounds,score:session.score};
  session.roundIndex++;
  session.challenge=session.roundIndex<session.totalRounds?challenge(session.kind,session.roundIndex,now,jobFor(session)):null;
  return{};
}
module.exports={ACTIVE,CATEGORIES,WORK_JOBS,FISH_SPECIES,ensure,save,view,active,create,retry,load,answer,contextValid};
