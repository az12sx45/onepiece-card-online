'use strict';

// Sessions are private server records. Profile-row locking in life-store also
// serializes them with the existing shop, background jobs and wallet ledger.
const crypto = require('node:crypto');
const fishingV4 = require('./launcher-fishing-v4');
const fishingV5 = require('./launcher-fishing-v5');
const ACTIVE = new Set(['playing', 'ready', 'failed']);
const CATEGORIES = Object.freeze({food:'食材',tools:'工具',books:'書籍'});
const SUPPLIES = Object.freeze({
  food:[['meat','燻肉'],['orange','橘子'],['flour','麵粉']],
  tools:[['rope','繩索'],['hammer','木槌'],['nails','船釘']],
  books:[['logbook','航海日誌'],['chart','海圖'],['history','歷史文獻']]
});
const DIRECTIONS = ['left','up','right'];
const WORK_JOBS = Object.freeze(['supply','cooking','repair','navigation','fishing']);
// Keep all existing IDs stable for saves. The added 17 species plus the three
// already present below (Adventure Fish, Panther Shark, Elephant Tuna) match
// the 20 fish records in the supplied Unlimited Adventure ISO. The other six
// legacy catches remain available in this launcher's fishing pools.
const FISH_SPECIES = Object.freeze([
  Object.freeze({id:'balloon-catfish',label:'氣球鯰魚',sourceName:'フウセンナマズ',weight:5}),
  Object.freeze({id:'glistening-saury',label:'閃亮秋刀魚',sourceName:'ギラギラサンマ',weight:4}),
  Object.freeze({id:'smile-jellyfish',label:'微笑水母',sourceName:'スマイルクラゲ',weight:4}),
  Object.freeze({id:'panda-shark',label:'熊貓鯊',sourceName:'パンサメ',weight:2}),
  Object.freeze({id:'butterflyfish',label:'蝶魚',sourceName:'チョウチョウウオ',weight:0}),
  Object.freeze({id:'adventure-fish',label:'冒險魚',sourceName:'アドベンチャーフィッシュ',weight:0}),
  Object.freeze({id:'cola-sunfish',label:'可樂翻車魚',sourceName:'コーラセマンボウ',weight:0}),
  Object.freeze({id:'reef-shark',label:'鯊魚',sourceName:'サメ',weight:0}),
  Object.freeze({id:'elephant-tuna',label:'象鼻鮪魚',sourceName:'エレファントホンマグロ',weight:0}),
  Object.freeze({id:'lovely-angel',label:'可愛天使魚',sourceName:'ラブリーエンゼル',weight:0}),
  Object.freeze({id:'striped-clam',label:'條紋蛤蜊',sourceName:'シマアサリ',weight:0}),
  Object.freeze({id:'cutie-piranha',label:'可愛食人魚',sourceName:'キューティピラニア',weight:0}),
  Object.freeze({id:'claw-shrimp',label:'剪刀蝦',sourceName:'ハサミエビ',weight:0}),
  Object.freeze({id:'pumpkin-octopus',label:'南瓜章魚',sourceName:'パンプキンオクトパス',weight:0}),
  Object.freeze({id:'maple-salmon',label:'紅葉鮭魚',sourceName:'紅葉シャケ',weight:0}),
  Object.freeze({id:'lava-flounder',label:'熔岩比目魚',sourceName:'溶岩ヒラメ',weight:0}),
  Object.freeze({id:'treasure-pearl-clam',label:'寶藏珍珠貝',sourceName:'トレジャーパールガイ',weight:0}),
  Object.freeze({id:'electric-catfish',label:'感電鯰魚',sourceName:'カンデンキナマズ',weight:0}),
  Object.freeze({id:'demon-bonito',label:'鬼鰹魚',sourceName:'オニガツオ',weight:0}),
  Object.freeze({id:'guiding-anglerfish',label:'引路鮟鱇魚',sourceName:'導きアンコウ',weight:0}),
  Object.freeze({id:'ice-fish',label:'冰晶魚',sourceName:'アイスフィッシュ',weight:0}),
  Object.freeze({id:'beat-alligator',label:'節奏鱷魚',sourceName:'ビートアリゲーター',weight:0}),
  Object.freeze({id:'aurora-sunfish',label:'極光翻車魚',sourceName:'オーロラマンボウ',weight:0}),
  Object.freeze({id:'burning-dragon',label:'燃燒龍',sourceName:'バーニングドラゴン',weight:0}),
  Object.freeze({id:'great-terigius',label:'巨型泰利吉烏斯',sourceName:'グレートテリギウス',weight:0}),
  Object.freeze({id:'golden-whale',label:'黃金鯨',sourceName:'ゴールデンホエール',weight:0}),
  // Species names below are confirmed by bundle entry names in the supplied
  // Fishing Master XAPK. Rarity, habitats and fighting rules are launcher art.
  Object.freeze({id:'largemouth-bass',label:'大嘴鱸魚',sourceName:'largemouthbass',weight:0}),
  Object.freeze({id:'warmouth',label:'暖口太陽魚',sourceName:'warmouth',weight:0}),
  Object.freeze({id:'congo-bichir',label:'剛果多鰭魚',sourceName:'congobichir',weight:0}),
  Object.freeze({id:'paddlefish',label:'匙吻鱘',sourceName:'paddlefish',weight:0}),
  Object.freeze({id:'alligator-gar',label:'鱷雀鱔',sourceName:'alligatorgar',weight:0}),
  Object.freeze({id:'dolphinfish',label:'鯕鰍',sourceName:'dolphinfish_rare_b01',weight:0}),
  Object.freeze({id:'lionfish',label:'獅子魚',sourceName:'lionfish_elite_b01',weight:0}),
  Object.freeze({id:'dusky-grouper',label:'褐石斑魚',sourceName:'duskygrouper_rare',weight:0}),
  Object.freeze({id:'goliath-grouper',label:'巨型石斑魚',sourceName:'goliathgrouper',weight:0}),
  Object.freeze({id:'white-marlin',label:'白馬林魚',sourceName:'whitemarlin_monster_b01',weight:0})
]);
// These collectible grades are authored for the launcher. The supplied ISO
// identifies species and fight behavior; it does not define this rarity scale.
// Keeping rarity derived from the species ID preserves existing collection
// records and makes catches saved before this release display consistently.
const FISH_RARITY_BY_ID = Object.freeze({
  'balloon-catfish':'common','glistening-saury':'common','smile-jellyfish':'common',
  'butterflyfish':'common','lovely-angel':'common','claw-shrimp':'common',
  'cutie-piranha':'common','maple-salmon':'common','lava-flounder':'common',
  'adventure-fish':'uncommon','cola-sunfish':'uncommon','pumpkin-octopus':'uncommon',
  'electric-catfish':'uncommon','demon-bonito':'uncommon','ice-fish':'uncommon',
  'striped-clam':'uncommon','guiding-anglerfish':'uncommon',
  'panda-shark':'rare','reef-shark':'rare','elephant-tuna':'rare',
  'treasure-pearl-clam':'rare','beat-alligator':'rare','aurora-sunfish':'rare',
  'great-terigius':'rare',
  'burning-dragon':'legendary','golden-whale':'legendary',
  'largemouth-bass':'common','warmouth':'common',
  'congo-bichir':'uncommon','dolphinfish':'uncommon','lionfish':'uncommon',
  'paddlefish':'rare','alligator-gar':'rare','dusky-grouper':'rare',
  'goliath-grouper':'legendary','white-marlin':'legendary'
});
const FISHING_BAITS = Object.freeze(['worm','shrimp','lure']);
const FISHING_SPOTS = Object.freeze(['shore','reef','deep','freshwater','magma','rainbow']);
const FISHING_CAST_ZONES = Object.freeze({
  near:Object.freeze({x:.46,y:.55}),
  mid:Object.freeze({x:.66,y:.45}),
  far:Object.freeze({x:.81,y:.34})
});
// Habitats follow the game's fishing guide where known: freshwater, sea,
// magma, and rainbow water. Bait preferences and probabilities are new rules
// for this launcher; they are not claimed to be the original game's odds.
// Each ordered triple supplies the near, middle and far cast pools through the
// existing weighting rule. Magma deliberately has only its two source fish.
// Shellfish are occasional catches on shore/reef worm or rainbow shrimp;
// they are not the default near-water catch across unrelated bait and seas.
const FISHING_V3_POOLS = Object.freeze({
  shore:Object.freeze({
    worm:Object.freeze([['lovely-angel',5],['striped-clam',1],['adventure-fish',2]]),
    shrimp:Object.freeze([['claw-shrimp',5],['pumpkin-octopus',4],['panda-shark',2]]),
    lure:Object.freeze([['glistening-saury',5],['demon-bonito',4],['elephant-tuna',2]])
  }),
  reef:Object.freeze({
    worm:Object.freeze([['butterflyfish',5],['treasure-pearl-clam',1],['panda-shark',2]]),
    shrimp:Object.freeze([['smile-jellyfish',5],['pumpkin-octopus',4],['panda-shark',2]]),
    lure:Object.freeze([['cola-sunfish',5],['panda-shark',4],['reef-shark',2]])
  }),
  deep:Object.freeze({
    worm:Object.freeze([['smile-jellyfish',5],['cola-sunfish',4],['reef-shark',2]]),
    shrimp:Object.freeze([['cola-sunfish',5],['elephant-tuna',4],['golden-whale',1]]),
    lure:Object.freeze([['panda-shark',5],['reef-shark',4],['golden-whale',1]])
  }),
  freshwater:Object.freeze({
    worm:Object.freeze([['cutie-piranha',5],['electric-catfish',4],['guiding-anglerfish',2]]),
    shrimp:Object.freeze([['balloon-catfish',5],['maple-salmon',4],['beat-alligator',2]]),
    lure:Object.freeze([['demon-bonito',5],['ice-fish',4],['great-terigius',1]])
  }),
  magma:Object.freeze({
    worm:Object.freeze([['lava-flounder',8],['lava-flounder',3],['burning-dragon',1]]),
    shrimp:Object.freeze([['lava-flounder',7],['lava-flounder',4],['burning-dragon',2]]),
    lure:Object.freeze([['lava-flounder',6],['lava-flounder',5],['burning-dragon',3]])
  }),
  rainbow:Object.freeze({
    worm:Object.freeze([['lovely-angel',5],['adventure-fish',4],['aurora-sunfish',1]]),
    shrimp:Object.freeze([['adventure-fish',5],['treasure-pearl-clam',1],['aurora-sunfish',2]]),
    lure:Object.freeze([['adventure-fish',5],['lovely-angel',4],['aurora-sunfish',2]])
  })
});
// Additional target fish do not replace any existing route. The three weights
// correspond to near/middle/far casts; zero makes a species absent at range.
const FISHING_GUEST_POOLS = Object.freeze({
  freshwater:Object.freeze({
    worm:Object.freeze([['largemouth-bass',4,2,0],['warmouth',3,1,0]]),
    shrimp:Object.freeze([['congo-bichir',0,3,2],['paddlefish',0,1,2]]),
    lure:Object.freeze([['alligator-gar',0,1,2]])
  }),
  shore:Object.freeze({lure:Object.freeze([['dolphinfish',1,2,2]])}),
  reef:Object.freeze({
    shrimp:Object.freeze([['lionfish',1,2,2]]),
    lure:Object.freeze([['dusky-grouper',0,1,2]])
  }),
  deep:Object.freeze({
    shrimp:Object.freeze([['goliath-grouper',0,1,1]]),
    lure:Object.freeze([['white-marlin',0,1,1]])
  })
});
const FISHING_V3_DIFFICULTY = Object.freeze({
  'balloon-catfish':0,'butterflyfish':0,'striped-clam':0,'lovely-angel':0,'claw-shrimp':0,
  'cutie-piranha':1,'adventure-fish':1,'glistening-saury':1,'smile-jellyfish':1,
  'pumpkin-octopus':1,'maple-salmon':1,'lava-flounder':1,
  'cola-sunfish':2,'panda-shark':2,'treasure-pearl-clam':2,'electric-catfish':2,
  'demon-bonito':2,'guiding-anglerfish':2,'ice-fish':2,
  'reef-shark':3,'elephant-tuna':3,'beat-alligator':3,'aurora-sunfish':3,
  'burning-dragon':3,'great-terigius':3,'golden-whale':3,
  'warmouth':0,'largemouth-bass':1,'congo-bichir':1,'dolphinfish':1,'lionfish':1,
  'paddlefish':2,'alligator-gar':2,'dusky-grouper':2,
  'goliath-grouper':3,'white-marlin':3
});
const FISH_COUNTER = Object.freeze({left:'right',right:'left',deep:'slack'});
const FISHING_V2_ROUNDS = 3;
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
function fishingChallenge(id,roundIndex,issuedAt) {
  // The fight pattern stays on the server; only the current pull is shown.
  const pattern=Array.from({length:24},(_,index)=>index<2?'steady':pick(['steady','steady','surge']));
  return {id,fishingVersion:2,stage:'cast',castAt:null,biteAt:null,hookUntil:null,fightUntil:null,
    distance:100,tension:12,pullIndex:0,pull:'steady',fightPattern:pattern,
    showcaseMs:0,answerWindowMs:90000,notBefore:iso(issuedAt)};
}
function fishingChallengeV3(id,issuedAt) {
  const round=fishingChallenge(id,0,issuedAt);
  round.fishingVersion=3;
  round.castZone=null;
  round.castTarget=null;
  round.fightPattern=null;
  round.pullDirection='steady';
  return round;
}
function prepareFishingFight(round,speciesId) {
  const difficulty=FISHING_V3_DIFFICULTY[speciesId]??1;
  round.distance=82+difficulty*4;
  // Every fish has enough calm pulls and countersteer openings to be landed.
  // Harder species add more directional runs, never an impossible all-deep loop.
  const fixed=['steady','steady','steady','steady','steady','steady','steady','steady',
    'left','right','left','right','left','right','left','right'];
  const varied=Array.from({length:14},()=>crypto.randomInt(10)<2+difficulty?
    pick(['left','right','deep']):'steady');
  round.fightPattern=['steady','steady',...shuffled([...fixed,...varied])];
}
function fishingPoolFor(spotId,baitId,castZone) {
  const entries=FISHING_V3_POOLS[spotId]?.[baitId];
  if(!entries||!Object.hasOwn(FISHING_CAST_ZONES,castZone))return null;
  const extras=FISHING_GUEST_POOLS[spotId]?.[baitId]||[];
  const index={near:1,mid:2,far:3}[castZone];
  const guest=extras.filter(entry=>entry[index]>0).map(entry=>[entry[0],entry[index]]);
  if(castZone==='near')return [[entries[0][0],entries[0][1]*3],entries[1],...guest];
  // Legendary fish are an occasional targeted catch at far range, rather
  // than becoming the default catch simply because the last slot is boosted.
  // The middle pool is lower still, so distance remains meaningful.
  if(FISH_RARITY_BY_ID[entries[2][0]]==='legendary'){
    if(castZone==='far')return [[entries[1][0],entries[1][1]*5],[entries[2][0],1],...guest];
    return [[entries[0][0],entries[0][1]*5],[entries[1][0],entries[1][1]*5],
      [entries[2][0],1],...guest];
  }
  if(castZone==='far')return [entries[1],[entries[2][0],entries[2][1]*3],...guest];
  return [...entries,...guest];
}
function fishingSpeciesFor(spotId,baitId,castZone) {
  const entries=fishingPoolFor(spotId,baitId,castZone);
  if(!entries)return null;
  const roll=crypto.randomInt(entries.reduce((sum,[,weight])=>sum+weight,0));
  let remaining=roll;
  for(const [id,weight] of entries){remaining-=weight;if(remaining<0)return id;}
  return entries.at(-1)[0];
}
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
function workChallenge(jobId,id,roundIndex,issuedAt,fishingVersion=1) {
  if(jobId==='fishing') {
    if(fishingVersion===2)return fishingChallenge(id,roundIndex,issuedAt);
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
function challenge(kind, roundIndex, now, jobId='supply',fishingVersion=1,speciesId=null,rodLevel=0,flickMode=false) {
  const id=crypto.randomUUID(), issuedAt=now.getTime();
  if(kind==='fishing')return fishingVersion===5?fishingV5.create(id,issuedAt,rodLevel,flickMode):
    fishingVersion===4?fishingV4.create(id,issuedAt,rodLevel):fishingChallengeV3(id,issuedAt);
  if(kind==='work') {
    const variant=workChallenge(jobId,id,roundIndex,issuedAt,fishingVersion);if(variant)return variant;
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
  if(result.challenge?.fishingVersion>=2){
    result.challenge={...result.challenge};delete result.challenge.fightPattern;
    if(result.challenge.fishingVersion===5){
      // Species rhythm is server-private until the catch is settled.
      delete result.challenge.behavior;delete result.challenge.reelHoldMs;
      delete result.challenge.nextTurnAt;
      delete result.challenge.turnsRemaining;delete result.challenge.phaseIndex;
      delete result.challenge.phaseUntil;
      delete result.challenge.motionSeed;
      if(result.challenge.stage==='fight'&&result.challenge.flickMode&&
        Date.parse(result.challenge.flickReliefUntil)>Date.parse(result.challenge.lastSimAt)){
        result.challenge.flickAssistUntil=result.challenge.flickReliefUntil;
      }
      delete result.challenge.flickReliefUntil;
      result.challenge.pullIntensity=fishingV5.displayIntensity(
        result.challenge.pullIntensity,result.challenge.runState);
    }
  }
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
function create(kind,characterId,roomRevision,now,practice=false,jobId='supply',fishingVersion=1,baitId=null,spotId=null,rodLevel=0,flickMode=false) {
  const clockedFishingVersion=fishingVersion===5?5:fishingVersion===4?4:3;
  const enabledFlickMode=kind==='fishing'&&clockedFishingVersion===5&&flickMode===true;
  const catchSpeciesId=kind==='work'&&jobId==='fishing'?
    pick(FISH_SPECIES.filter(species=>species.weight>0).flatMap(species=>Array(species.weight).fill(species.id))):null;
  const session={id:crypto.randomUUID(),token:crypto.randomBytes(24).toString('hex'),kind,characterId,practice,
    ...(kind==='work'?{jobId}:{}),
    ...(catchSpeciesId?{catchSpeciesId}:{}),
    ...(kind==='fishing'?{fishingVersion:clockedFishingVersion,baitId,spotId,castZone:null,
      ...(enabledFlickMode?{flickMode:true}:{}),
      ...(clockedFishingVersion>=4?{rodLevel:fishingV4.rodLevel(rodLevel)}:{})}:kind==='work'&&jobId==='fishing'?{fishingVersion}:{}),
    state:'playing',roomRevision,attempt:1,maxAttempts:kind==='fishing'?1:3,roundIndex:0,totalRounds:kind==='fishing'?1:kind==='work'?(jobId==='fishing'&&fishingVersion===2?FISHING_V2_ROUNDS:jobId==='fishing'?5:8):4,
    startedAt:now.toISOString(),finishNotBefore:iso(now.getTime()+(kind==='fishing'?0:kind==='work'?24000:20000)),
    challenge:challenge(kind,0,now,jobId,kind==='fishing'?clockedFishingVersion:fishingVersion,catchSpeciesId,rodLevel,enabledFlickMode),score:0,combo:0,correctRounds:0,feedback:null,result:null};
  session.expiresAt=iso(now.getTime()+durationFor(session));return session;
}
function retry(session,now) {
  session.attempt++;session.state='playing';session.roundIndex=0;session.score=0;session.combo=0;session.correctRounds=0;session.feedback=null;session.result=null;
  session.startedAt=now.toISOString();session.expiresAt=iso(now.getTime()+durationFor(session));session.finishNotBefore=iso(now.getTime()+(session.kind==='work'?24000:20000));
  session.challenge=challenge(session.kind,0,now,jobFor(session),session.fishingVersion||1,session.catchSpeciesId,session.rodLevel,session.flickMode===true);
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
function advanceRound(session,correct,now,reason='') {
  session.combo=correct?session.combo+1:0;
  if(correct){session.correctRounds++;session.score+=100+Math.min(4,session.combo-1)*25;}
  session.feedback={roundIndex:session.roundIndex,correct,combo:session.combo,correctRounds:session.correctRounds,score:session.score,...reason?{reason}:{}};
  session.roundIndex++;
  session.challenge=session.roundIndex<session.totalRounds?challenge(session.kind,session.roundIndex,now,jobFor(session),session.fishingVersion||1,session.catchSpeciesId,session.rodLevel,session.flickMode===true):null;
  return{};
}
function answerClockedFishing(session,payload,now) {
  const round=session.challenge,actions=payload.counterMoves;
  const engine=round.fishingVersion===5?fishingV5:fishingV4;
  if(!Array.isArray(actions)||actions.length!==1||
      !['cast','hook','control','flick','burst','special','specialKey','sync','timeout'].includes(actions[0])||
      ['selections','ingredients','rotations','path'].some(key=>payload[key]!==undefined)||
      payload.directions!==undefined&&!(actions[0]==='specialKey'&&Array.isArray(payload.directions)&&payload.directions.length===1&&['left','right','up','down'].includes(payload.directions[0])))
    return{error:'invalid_minigame_answer'};
  const move=actions[0],at=now.getTime();
  if(move==='cast') {
    const hasPower=payload.castPower!==undefined;
    if(hasPower&&(!Number.isInteger(payload.castPower)||payload.castPower<0||payload.castPower>100)||
        payload.castZone!==undefined&&(!Object.hasOwn(FISHING_CAST_ZONES,payload.castZone)||
          hasPower&&payload.castZone!==engine.castZoneForPower(payload.castPower))||
        !hasPower&&typeof payload.castZone!=='string'||
        payload.reeling!==undefined||payload.steer!==undefined||payload.paying!==undefined||
        payload.flickDirection!==undefined||payload.flickCueId!==undefined)
      return{error:'invalid_fishing_cast_zone'};
  }else if(move==='control') {
    if(payload.castZone!==undefined||payload.castPower!==undefined||typeof payload.reeling!=='boolean'||
        !Number.isInteger(payload.steer)||![-1,0,1].includes(payload.steer)||
        payload.paying!==undefined&&typeof payload.paying!=='boolean'||
        payload.reeling&&payload.paying||payload.flickDirection!==undefined||
        payload.flickCueId!==undefined)
      return{error:'invalid_fishing_control'};
  }else if(move==='flick'){
    if(round.fishingVersion!==5||payload.castZone!==undefined||payload.castPower!==undefined||
        payload.reeling!==undefined||payload.steer!==undefined||payload.paying!==undefined||
        !['left','right','up'].includes(payload.flickDirection)||
        !Number.isInteger(payload.flickCueId)||payload.flickCueId<1||payload.flickCueId>10000)
      return{error:'invalid_fishing_flick'};
  }else if(payload.castZone!==undefined||payload.castPower!==undefined||
      payload.reeling!==undefined||payload.steer!==undefined||payload.paying!==undefined||
      payload.flickDirection!==undefined||payload.flickCueId!==undefined)
    return{error:'invalid_minigame_answer'};
  if(round.stage==='cast') {
    if(move==='sync'){engine.observe(round,now);return{};}
    if(move!=='cast')return{error:'invalid_fishing_action'};
    const zone=payload.castPower===undefined?payload.castZone:engine.castZoneForPower(payload.castPower);
    const target=payload.castPower===undefined?FISHING_CAST_ZONES[zone]:
      engine.castTargetForPower(payload.castPower,FISHING_CAST_ZONES);
    session.castZone=zone;
    session.catchSpeciesId=fishingSpeciesFor(session.spotId,session.baitId,zone);
    engine.cast(round,now,session.baitId,zone,target);
    return{};
  }
  if(round.stage==='wait') {
    if(at>Date.parse(round.hookUntil)){
      if(move==='hook'||move==='sync'||move==='timeout')return advanceRound(session,false,now,'missed_bite');
      return{error:'invalid_fishing_action'};
    }
    if(move==='sync'){engine.observe(round,now);return{};}
    if(move==='timeout')return{error:'invalid_fishing_action'};
    if(move!=='hook')return{error:'invalid_fishing_action'};
    if(at<Date.parse(round.biteAt))return{error:'fishing_not_bitten'};
    round.characterKey=session.characterId.slice(15);
    engine.hook(round,now,FISHING_V3_DIFFICULTY[session.catchSpeciesId]??1,session.catchSpeciesId);
    return{};
  }
  if(round.stage!=='fight')return{error:'invalid_fishing_action'};
  const result=engine.simulate(round,now,FISHING_V3_DIFFICULTY[session.catchSpeciesId]??1);
  if(result)return advanceRound(session,result==='landed',now,result);
  if(move==='timeout')return{error:'invalid_fishing_action'};
  if(move==='sync')return{};
  if(['burst','special','specialKey'].includes(move)){
    if(round.fishingVersion!==5||move==='specialKey'&&!payload.directions)return{error:'invalid_fishing_action'};
    const response=engine.power(round,now,move,payload.directions?.[0]);
    if(response.error)return response;
    if(response.settlement)return advanceRound(session,response.settlement==='landed',now,response.settlement);
    return{};
  }
  if(move==='flick'){
    const flickResult=engine.flick(round,now,payload.flickDirection,payload.flickCueId);
    if(flickResult.error)return{error:flickResult.error};
    if(flickResult.settlement)return advanceRound(session,flickResult.settlement==='landed',now,flickResult.settlement);
    return{};
  }
  if(move!=='control')return{error:'invalid_fishing_action'};
  // Repeated heartbeat is allowed once per control lease; changes are accepted
  // immediately so releasing the button never waits on an action cooldown.
  const same=round.control?.reeling===payload.reeling&&round.control?.steer===payload.steer&&
    Boolean(round.control?.paying)===Boolean(payload.paying);
  if(same&&Number.isFinite(Date.parse(round.lastControlAt))&&
      at-Date.parse(round.lastControlAt)<180)return{error:'fishing_action_cooldown'};
  engine.control(round,now,payload.reeling,payload.steer,payload.paying===true);
  round.lastControlAt=iso(at);
  return{};
}
function answerFishingV2(session,payload,now) {
  const round=session.challenge,action=payload.counterMoves;
  if(!Array.isArray(action)||action.length!==1||!
    (round.fishingVersion===3?['cast','hook','reel','slack','steerLeft','steerRight','timeout']:['cast','hook','reel','slack','timeout']).includes(action[0])||
    ['selections','directions','ingredients','rotations','path','castPower','paying'].some(key=>payload[key]!==undefined))return{error:'invalid_minigame_answer'};
  const move=action[0],at=now.getTime();
  if(payload.castZone!==undefined&&(round.fishingVersion!==3||move!=='cast')||
    round.fishingVersion===3&&move==='cast'&&
      (typeof payload.castZone!=='string'||!Object.hasOwn(FISHING_CAST_ZONES,payload.castZone)))
    return{error:'invalid_fishing_cast_zone'};
  if(round.stage==='cast') {
    if(move!=='cast')return{error:'invalid_fishing_action'};
    if(round.fishingVersion===3){
      session.castZone=payload.castZone;
      session.catchSpeciesId=fishingSpeciesFor(session.spotId,session.baitId,payload.castZone);
      round.castZone=payload.castZone;
      round.castTarget={...FISHING_CAST_ZONES[payload.castZone]};
      prepareFishingFight(round,session.catchSpeciesId);
    }
    round.stage='wait';round.castAt=iso(at);
    const waitMs=round.fishingVersion===3?{worm:4800,shrimp:3900,lure:3300}[session.baitId]+crypto.randomInt(1500):3600+crypto.randomInt(1600);
    round.biteAt=iso(at+waitMs);round.hookUntil=iso(Date.parse(round.biteAt)+(round.fishingVersion===3?2800:3200));
    return{};
  }
  if(round.stage==='wait') {
    if(move==='timeout')return at>Date.parse(round.hookUntil)?advanceRound(session,false,now,'missed_bite'):{error:'invalid_fishing_action'};
    if(move!=='hook')return{error:'invalid_fishing_action'};
    if(at<Date.parse(round.biteAt))return advanceRound(session,false,now,'early_hook');
    if(at>Date.parse(round.hookUntil))return advanceRound(session,false,now,'missed_bite');
    round.stage='fight';round.hookedAt=iso(at);round.fightUntil=iso(at+50000);round.lastActionAt=iso(at);
    if(round.fishingVersion===3){round.pullDirection=round.fightPattern[0];round.pull='steady';}
    else round.pull=round.fightPattern[0];
    return{};
  }
  if(round.stage!=='fight')return{error:'invalid_fishing_action'};
  if(at>Date.parse(round.fightUntil))return advanceRound(session,false,now,'escaped');
  if(move==='timeout')return{error:'invalid_fishing_action'};
  if(!['reel','slack'].includes(move)&&!(round.fishingVersion===3&&['steerLeft','steerRight'].includes(move)))return{error:'invalid_fishing_action'};
  if(at-Date.parse(round.lastActionAt)<240)return{error:'fishing_action_cooldown'};
  round.lastActionAt=iso(at);
  if(move==='reel'){
    const difficulty=round.fishingVersion===3?(FISHING_V3_DIFFICULTY[session.catchSpeciesId]??1):0;
    round.distance=Math.max(0,round.distance-(round.pull==='surge'?13-difficulty:18-difficulty));
    round.tension=Math.min(100,round.tension+(round.pull==='surge'?29+difficulty*2:15+difficulty));
  }else if(move==='slack'){
    round.distance=Math.min(100,round.distance+(
      round.fishingVersion===3&&round.pullDirection==='deep'?0:2));
    round.tension=Math.max(0,round.tension-(
      round.fishingVersion===3&&round.pullDirection==='deep'?40:32));
  }else{
    const correct=round.pullDirection==='left'&&move==='steerRight'||
      round.pullDirection==='right'&&move==='steerLeft';
    round.distance=Math.max(0,Math.min(100,round.distance+(correct?-4:4)));
    round.tension=Math.max(0,Math.min(100,round.tension+(correct?-25:21)));
  }
  if(round.tension>=100)return advanceRound(session,false,now,'line_snapped');
  if(round.distance<=0)return advanceRound(session,true,now,'landed');
  round.pullIndex++;
  if(round.fishingVersion===3){
    round.pullDirection=round.fightPattern[round.pullIndex%round.fightPattern.length];
    round.pull=round.pullDirection==='steady'?'steady':'surge';
  }else round.pull=round.fightPattern[round.pullIndex%round.fightPattern.length];
  return{};
}
function answer(session,payload,now) {
  if(session.state!=='playing'||!session.challenge)return{error:'minigame_round_complete'};
  const round=session.challenge;
  if(payload.roundId!==round.id)return{error:'minigame_round_conflict'};
  if(now.getTime()<Date.parse(round.notBefore))return{error:'minigame_too_early'};
  if(session.kind==='fishing'&&(round.fishingVersion===4||round.fishingVersion===5))return answerClockedFishing(session,payload,now);
  if((session.kind==='fishing'||session.kind==='work'&&jobFor(session)==='fishing')&&round.fishingVersion>=2)return answerFishingV2(session,payload,now);
  let correct=false;
  if(session.kind==='work') {
    const jobId=jobFor(session),field={supply:'selections',cooking:'ingredients',repair:'rotations',navigation:'path',fishing:'counterMoves'}[jobId];
    if(!field||['selections','directions','ingredients','rotations','path','counterMoves','castZone','castPower','paying'].some(key=>key!==field&&payload[key]!==undefined))return{error:'invalid_minigame_answer'};
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
    if(['selections','ingredients','rotations','path','castZone','castPower','paying'].some(key=>payload[key]!==undefined)||!Array.isArray(payload.directions)||payload.directions.length>5||
      payload.directions.some(value=>!DIRECTIONS.includes(value)))return{error:'invalid_minigame_answer'};
    correct=payload.directions.length===round.directions.length&&payload.directions.every((value,i)=>value===round.directions[i]);
  }
  // The round timer is authoritative on the server, with a short allowance
  // for network latency. A late answer advances as a miss, never as a catch.
  const latestAnswerMs = Date.parse(round.notBefore) + Number(round.answerWindowMs) + 3000;
  if(!Number.isFinite(latestAnswerMs)||now.getTime()>latestAnswerMs)correct=false;
  return advanceRound(session,correct,now);
}
module.exports={ACTIVE,CATEGORIES,WORK_JOBS,FISH_SPECIES,FISH_RARITY_BY_ID,FISHING_BAITS,FISHING_SPOTS,FISHING_CAST_ZONES,FISHING_V3_POOLS,FISHING_GUEST_POOLS,FISHING_V3_DIFFICULTY,fishingPoolFor,ensure,save,view,active,create,retry,load,answer,contextValid};
