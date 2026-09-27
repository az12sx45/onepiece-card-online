'use strict';
/* Content/ownership contract QA. This does not certify rendering or deployed gameplay. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const dataPath = path.join(root, 'desktop', 'launcher-life-data.js');
const dialoguePath = path.join(root, 'desktop', 'launcher-room-dialogue.js');
const d = require(dataPath);
const dialogue = require(dialoguePath);
let assertions=0;
const check=(condition,message)=>{assert.ok(condition,message);assertions++;};
const equal=(a,b,message)=>{assert.deepEqual(a,b,message);assertions++;};
const keys=d.characterKeys, stationKeys=Object.keys(d.stations), directions=['south','east','north','west'];
const furniture=[...new Set(Object.values(d.stations).flatMap(s=>s.furnitureKeys))];
const allContext={ownedCharacters:keys,presentCharacters:keys,availableFurnitureKeys:furniture,hasAction:()=>true};
const bins={solo:0,pair:0,triple:0,chain:0};

equal(keys.length,10,'ten accepted characters preserved');
equal(d.policies.maxPresentCharacters,10,'all ten owned characters fit the room contract');
const legacyText=Object.values(dialogue.SCENES).flat().flatMap(scene=>scene.turns.map(turn=>turn.line)).join('\n');
for(const phrase of ['佛朗基有很粗的！我去拿！','我再去叫他講一次！','我去叫喬巴！','我去叫魯夫！','你一直動，我就一直包不好！','牠還在窗外等你道歉！','要聽一段嗎？我彈輕些。'])
  check(!legacyText.includes(phrase),'removed unsupported current-scene claim: '+phrase);
for(const id of ['luffy-brook-3','robin-brook-3','brook-jinbe-3']) {
  const event=d.legacyEvents.find(value=>value.id===id);
  check(!!event,'stable reviewed scene '+id);
  check(!event.steps.some(step=>/在這裡彈|慢慢彈|我彈輕些/.test(step.line)),'no phantom piano in '+id);
}
for(const key of keys) for(const beat of dialogue.SOLO[key].bond)
  for(const other of keys.filter(value=>value!==key)) check(!beat.line.includes(d.characters[other].name),'legacy player bond cannot call absent '+other);

equal(stationKeys.sort(),['deck','helm','kitchen','library','medical','music','navigation','training','workshop']);
equal(Object.keys(d.relationships).length,45,'all unordered pairs');
equal(d.authoredEvents.length,32,'authored event inventory');
equal(d.legacyEvents.length,151,'old scene IDs retained');
equal(d.events.length,183,'complete event inventory');
equal(Object.keys(d.eventById).length,d.events.length,'unique stable event IDs');
check(Object.isFrozen(d) && Object.isFrozen(d.characters.luffy.weights),'deep frozen shared contract');

for(const key of keys) {
  const c=d.characters[key];
  equal(c.itemId,'room-character-'+key,key+' stable product ID');
  equal(Object.values(c.weights).reduce((a,b)=>a+b,0),100,key+' weighted personality');
  for(const station of stationKeys)check(Number.isFinite(c.efficiency[station])&&c.efficiency[station]>0,key+' may perform '+station);
  equal(c.efficiency,c.workEfficiency,key+' server/client efficiency identical');
  for(const [name,value] of Object.entries(c.initialNeeds))check(value>=d.needBounds[name][0]&&value<=d.needBounds[name][1],key+' valid '+name);
  for(const [name,value] of Object.entries(c.needRates))check(Number.isFinite(value)&&value>=0,key+' soft '+name+' need rate');
  for(const kind of ['talk','repeated','call','gift','train','welcome']) {
    const lines=d.playerLines[key][kind];
    check(lines.length>=3,key+' varied '+kind);
    for(const line of lines) {
      check(line.line.length>=3&&line.line.length<=100,key+' bounded '+kind+' line');
      check(dialogue.POSES.includes(line.pose)&&dialogue.MOODS.includes(line.mood),key+' real pose '+kind);
      for(const other of keys.filter(x=>x!==key))check(!line.line.includes(d.characters[other].name),key+' player '+kind+' cannot call absent '+other);
    }
  }
  for(const other of keys.filter(x=>x!==key)) {
    const pair=d.relationships[d.relationshipKey(key,other)];
    check(!!pair,key+'/'+other+' relationship exists');
    for(const dim of ['familiarity','friendship','rivalry','respect'])check(pair[dim]>=0&&pair[dim]<=100,'bounded '+dim);
    check(pair.seedIsGameTuning===true,'relationships not claimed as canon rankings');
  }
}
check(d.relationships['sanji:zoro'].rivalry>70&&d.relationships['sanji:zoro'].friendship>70,'rivalry does not mean hostility');
check(d.stations.deck.freeFloor&&d.stations.training.freeFloor,'free basic work and training');
equal(d.stations.kitchen.specialistRequirements.sanji.furnitureKeys,['galley-stove'],'cook never uses bare dining table');
for(const [type,station] of Object.entries(d.stations)) {
  check(station.type===type&&station.requiresReachableSlot&&station.occupancy===1,'exclusive reachable station '+type);
  check(station.stages.length>=3,'multi-stage real work '+type);
  for(const stage of station.stages)check(stage.stationary&&stage.requiresCompleteBodySequence&&stage.durationMs>0&&d.actionCoverage.clips[stage.clip],'real work phase '+type+'/'+stage.id);
  for(const [key,clip] of Object.entries(station.specialistActions||{}))check(d.actionCoverage.clips[clip]?.actors.includes(key),'supported specialist '+type+'/'+key);
}
for(const [id,def] of Object.entries(d.directives))check(def.availableInAllPhases&&Object.values(def.weights).every(n=>n>0),'directive '+id+' never locks play');
for(const [id,def] of Object.entries(d.schedules))check(def.hardLock===false&&Object.values(def.weights).every(n=>n>0),'phase '+id+' soft only');
check(d.policies.maxMemoriesPerCharacter<=24&&d.policies.maxRecentEvents<=32&&d.policies.memoryTtlMs<=86400000,'bounded finite memory');
check(d.policies.eventCurrencyReward===0,'dialogue client cannot create shop coins');

function inspectSteps(event,steps,allowed) {
  for(const step of steps) {
    if(step.kind==='branch') {
      check(step.ifCharacters.every(k=>event.optionalCharacters.includes(k)||event.requiredCharacters.includes(k)),event.id+' defined branch members');
      inspectSteps(event,step.then||[],allowed);inspectSteps(event,step.else||[],allowed);continue;
    }
    check(allowed.has(step.actor),event.id+' actor is declared');
    if(step.kind==='act') {
      const clip=d.actionCoverage.clips[step.clip];
      check(clip&&clip.actors.includes(step.actor),event.id+' authored actor has action capability');
      check(!step.direction||clip.directions.includes(step.direction),event.id+' truthful facing');
      check(step.durationMs>=1000&&step.durationMs<=15000,event.id+' bounded action time');
      for(const required of clip.requiresFurniture||[])check(event.requiredFurniture.includes(required),event.id+' true tool/furniture requirement '+required);
    } else if(step.kind==='speak') {
      check(step.line&&step.line.length<=160,event.id+' bounded line');
      check(dialogue.POSES.includes(step.pose)&&dialogue.MOODS.includes(step.mood),event.id+' supported spoken expression');
    } else check(['wait','move'].includes(step.kind),event.id+' controller-supported step');
  }
}
for(const event of d.events) {
  check(event.requiredCharacters.length>=1&&event.requiredCharacters.every(k=>keys.includes(k)),event.id+' canonical required characters');
  check(event.optionalCharacters.every(k=>keys.includes(k)&&!event.requiredCharacters.includes(k)),event.id+' distinct optional characters');
  check(event.requiredCharacters.length+event.optionalCharacters.length<=8,event.id+' fits room cap');
  check(event.requiredFurniture.every(k=>furniture.includes(k)),event.id+' explicit physical furniture');
  if(event.location.type==='station')check(stationKeys.includes(event.location.stationType),event.id+' server-valid station type');
  check(event.currencyReward===0&&event.cooldownMs>=90000,event.id+' no event coin mint and cooldown');
  equal(event.availablePhases,['morning','day','evening','night'],event.id+' visible for night players');
  inspectSteps(event,event.steps,new Set([...event.requiredCharacters,...event.optionalCharacters]));
  check(d.isEventEligible(event,allContext),event.id+' positive eligibility');
  for(const missing of event.requiredCharacters) {
    check(!d.isEventEligible(event,{...allContext,ownedCharacters:keys.filter(k=>k!==missing)}),event.id+' absent ownership rejected: '+missing);
    check(!d.isEventEligible(event,{...allContext,presentCharacters:keys.filter(k=>k!==missing)}),event.id+' owned but unplaced rejected: '+missing);
    check(!d.isEventEligible(event,{...allContext,isAvailable:k=>k!==missing}),event.id+' occupied required actor rejected');
  }
  for(const missing of event.requiredFurniture)check(!d.isEventEligible(event,{...allContext,availableFurnitureKeys:furniture.filter(k=>k!==missing)}),event.id+' each AND furniture required');
  check(d.isEventEligible(event,{...allContext,ownedCharacters:keys.map(k=>'room-character-'+k),presentCharacters:keys.map(k=>'room-character-'+k),availableFurnitureKeys:furniture.map(k=>'room-furniture-'+k)}),event.id+' full item ID normalization');
  const baseReq=d.requiredActionsFor(event,event.requiredCharacters);
  if(baseReq.length) {
    check(!d.isEventEligible(event,{...allContext,hasAction:undefined}),event.id+' no fake pose fallback when action inventory unavailable');
    for(const absent of baseReq)check(!d.isEventEligible(event,{...allContext,hasAction:(actor,clip)=>!(actor===absent.actor&&clip===absent.clip)}),event.id+' missing required full-body clip rejected');
  }
  if(event.source==='life-authored-v1')bins[event.kind]++;
  const count=1<<event.optionalCharacters.length;
  for(let mask=0;mask<count;mask++) {
    const selected=event.optionalCharacters.filter((_,i)=>mask&(1<<i));
    const present=[...event.requiredCharacters,...selected],steps=d.resolveEventSteps(event,present);
    check(steps.length>0&&steps.every(s=>present.includes(s.actor)),event.id+' optional subset '+mask+' never speaks offscreen');
    check(d.isEventEligible(event,{...allContext,presentCharacters:present}),event.id+' subset '+mask+' has natural ending');
    if(event.kind==='chain'&&mask===0)check(steps.at(-1).kind==='speak'&&event.requiredCharacters.includes(steps.at(-1).actor),event.id+' solo-safe spoken ending');
  }
}
equal(bins,{solo:10,pair:12,triple:6,chain:4},'varied authored kinds');
// Cross every possible inventory/presence subset, not only ideal all-owned rooms.
for(let mask=0;mask<(1<<keys.length);mask++) {
  const subset=keys.filter((_,i)=>mask&(1<<i));
  for(const event of d.events) {
    const expected=event.requiredCharacters.every(k=>subset.includes(k));
    equal(d.isEventEligible(event,{...allContext,ownedCharacters:subset}),expected,'inventory subset '+mask+'/'+event.id);
    equal(d.isEventEligible(event,{...allContext,presentCharacters:subset}),expected,'presence subset '+mask+'/'+event.id);
  }
}
for(const [pair,scenes] of Object.entries(dialogue.SCENES)) {
  check(scenes.some(s=>!s.tags.length),pair+' can socialize with no bought furniture');
  for(const scene of scenes) {
    const imported=d.eventById[scene.id];
    equal(imported.requiredCharacters,scene.pair,scene.id+' same cast');
    equal(imported.steps.map(s=>s.line),scene.turns.map(t=>t.line),scene.id+' accepted dialogue preserved');
  }
}
const chain=d.eventById['life-chain-brook-small-tune'];
const context={...allContext,hasAction:(actor,clip)=>!(actor==='jinbe'&&clip==='rest')};
check(d.isEventEligible(chain,context),'optional missing rest art does not cancel solo music');
check(!d.selectEventParticipants(chain,context).includes('jinbe'),'optional missing clip naturally excluded');
check(!d.selectEventParticipants(chain,{...allContext,isAvailable:key=>key!=='nami'}).includes('nami'),'occupied optional character naturally excluded');

// Verify both consumers receive the same data; browser has no CommonJS globals.
const sandbox=vm.createContext({});
vm.runInContext(fs.readFileSync(dialoguePath,'utf8'),sandbox,{filename:'launcher-room-dialogue.js'});
vm.runInContext(fs.readFileSync(dataPath,'utf8'),sandbox,{filename:'launcher-life-data.js'});
equal(JSON.parse(JSON.stringify(sandbox.OnePieceLifeData)),JSON.parse(JSON.stringify(d)),'browser/server UMD parity');
const report={ok:true,scope:'content schema, canon guardrails, all 1024 owned/present subsets, optional branches, shared UMD parity; not art or live gameplay acceptance',assertions,
  counts:{characters:keys.length,stations:stationKeys.length,pairs:Object.keys(d.relationships).length,events:d.events.length,authoredEvents:d.authoredEvents.length,legacyEvents:d.legacyEvents.length,bins},
  dataSha256:crypto.createHash('sha256').update(fs.readFileSync(dataPath)).digest('hex')};
const outputIndex=process.argv.indexOf('--output');
if(outputIndex>=0&&process.argv[outputIndex+1])fs.writeFileSync(path.resolve(process.argv[outputIndex+1]),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
