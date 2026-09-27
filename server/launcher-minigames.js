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
const pick = list => list[crypto.randomInt(list.length)];
const iso = ms => new Date(ms).toISOString();
function challenge(kind, roundIndex, now) {
  const id=crypto.randomUUID(), issuedAt=now.getTime();
  if(kind==='work') {
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
function create(kind,characterId,roomRevision,now,practice=false) {
  return{id:crypto.randomUUID(),token:crypto.randomBytes(24).toString('hex'),kind,characterId,practice,
    state:'playing',roomRevision,attempt:1,maxAttempts:3,roundIndex:0,totalRounds:kind==='work'?8:4,
    startedAt:now.toISOString(),expiresAt:iso(now.getTime()+180000),finishNotBefore:iso(now.getTime()+(kind==='work'?24000:20000)),
    challenge:challenge(kind,0,now),score:0,combo:0,correctRounds:0,feedback:null,result:null};
}
function retry(session,now) {
  session.attempt++;session.state='playing';session.roundIndex=0;session.score=0;session.combo=0;session.correctRounds=0;session.feedback=null;session.result=null;
  session.startedAt=now.toISOString();session.expiresAt=iso(now.getTime()+180000);session.finishNotBefore=iso(now.getTime()+(session.kind==='work'?24000:20000));
  session.challenge=challenge(session.kind,0,now);
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
    if(payload.directions!==undefined||!Array.isArray(payload.selections)||payload.selections.length>3||
      new Set(payload.selections).size!==payload.selections.length||payload.selections.some(id=>!round.crates.some(crate=>crate.id===id)))return{error:'invalid_minigame_answer'};
    const expected=round.crates.filter(crate=>crate.category===round.order.category).map(crate=>crate.id);
    correct=expected.length===payload.selections.length&&expected.every(id=>payload.selections.includes(id));
  } else {
    if(payload.selections!==undefined||!Array.isArray(payload.directions)||payload.directions.length>5||
      payload.directions.some(value=>!DIRECTIONS.includes(value)))return{error:'invalid_minigame_answer'};
    correct=payload.directions.length===round.directions.length&&payload.directions.every((value,i)=>value===round.directions[i]);
  }
  session.combo=correct?session.combo+1:0;
  if(correct){session.correctRounds++;session.score+=100+Math.min(4,session.combo-1)*25;}
  session.feedback={roundIndex:session.roundIndex,correct,combo:session.combo,correctRounds:session.correctRounds,score:session.score};
  session.roundIndex++;
  session.challenge=session.roundIndex<session.totalRounds?challenge(session.kind,session.roundIndex,now):null;
  return{};
}
module.exports={ACTIVE,CATEGORIES,ensure,save,view,active,create,retry,load,answer,contextValid};
