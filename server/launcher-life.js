'use strict';

const crypto = require('node:crypto');
const DAY_MS = 86400000;
const MAX_OFFLINE_MS = 8 * 60 * 60 * 1000;
const RESERVATION_MS = 10 * 60 * 1000;
const MAX_JOBS = 6;
const CREW = require('./launcher-crew-release').releasedKeys;
const NEED_KEYS = Object.freeze(['energy','hunger','mood','social','workMotivation']);
const DEFAULT_NEEDS = Object.freeze({ energy: 80, hunger: 20, mood: 75, social: 70, workMotivation: 70 });
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const clone = value => JSON.parse(JSON.stringify(value));
const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : min));
const keyOf = id => typeof id === 'string' && id.startsWith('room-character-') && CREW.includes(id.slice(15)) ? id.slice(15) : null;
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
const day = now => now.toISOString().slice(0,10);
const pairKey = (a,b) => [keyOf(a) || a,keyOf(b) || b].sort().join(':');
function content() { return require('../desktop/launcher-life-data'); }
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
function commandHash(command) { return crypto.createHash('sha256').update(canonical({ type: command.type, payload: command.payload || {} })).digest('hex'); }
function legacyJobId(itemId, startedAt) { return 'legacy-' + crypto.createHash('sha256').update(itemId+'|'+startedAt).digest('hex').slice(0,32); }
function character(itemId, source = {}, now = new Date()) {
  const saved = object(source), needs = {};
  const defaults = content().characters?.[keyOf(itemId)]?.initialNeeds || DEFAULT_NEEDS;
  for (const key of NEED_KEYS) needs[key] = Math.round(clamp(saved.needs?.[key] ?? defaults[key])*100)/100;
  return { itemId, key: keyOf(itemId), needs, createdAt:iso(saved.createdAt)||now.toISOString(),
    memories: (Array.isArray(saved.memories) ? saved.memories : []).filter(m => m && typeof m.type === 'string' && iso(m.timestamp)).slice(-16),
    lastInteractions: object(saved.lastInteractions), giftDay: saved.giftDay || '', giftsToday: Math.max(0,Math.min(2,Math.trunc(Number(saved.giftsToday)||0))),
    activityHistory:(Array.isArray(saved.activityHistory)?saved.activityHistory:[]).filter(a=>a&&iso(a.at)).slice(-12),lastActivityAt:iso(saved.lastActivityAt) };
}
function normalizeState(raw, ownedIds, activeIds, now) {
  const saved = object(raw), owned = [...new Set(ownedIds.filter(keyOf))], set = new Set(owned);
  const state = { schemaVersion: 1, revision: Number.isSafeInteger(saved.revision) && saved.revision >= 0 ? saved.revision : 0,
    ownedCharacterIds: owned, activeCharacterIds: activeIds.filter(id => set.has(id)),
    characters: Object.fromEntries(owned.map(id => [id,character(id,object(saved.characters)[id],now)])),
    pairs: {}, directive: typeof saved.directive==='string' && Object.hasOwn(content().directives||{},saved.directive) ? saved.directive : 'free_day',
    jobs: (Array.isArray(saved.jobs) ? saved.jobs : []).filter(j => j && set.has(j.itemId) && typeof j.jobId === 'string').slice(0,10),
    pendingArrivals: (Array.isArray(saved.pendingArrivals) ? saved.pendingArrivals : []).filter(a => a && set.has(a.itemId) && typeof a.arrivalId === 'string').slice(0,10),
    arrivedCharacterIds: (Array.isArray(saved.arrivedCharacterIds) ? saved.arrivedCharacterIds : owned).filter(id => set.has(id)),
    recentEvents: (Array.isArray(saved.recentEvents) ? saved.recentEvents : []).filter(e => e && typeof e.eventId === 'string' && iso(e.at)).slice(-32),
    lastSimulatedAt: iso(saved.lastSimulatedAt) || now.toISOString(), lastSeenAt: iso(saved.lastSeenAt) || now.toISOString(),
    lastExitAt: iso(saved.lastExitAt), offlineSummary: { elapsedMs:0,completedJobs:0,coins:0 } };
  for (let a=0;a<owned.length;a++) for(let b=a+1;b<owned.length;b++) {
    const key=pairKey(owned[a],owned[b]), prior=object(object(saved.pairs)[key]);
    const initial=content().relationships?.[key]||{};
    state.pairs[key]={ familiarity:clamp(prior.familiarity??initial.familiarity??35), friendship:clamp(prior.friendship??initial.friendship??50), rivalry:clamp(prior.rivalry??initial.rivalry??10), respect:clamp(prior.respect??initial.respect??55) };
  }
  return state;
}
function stationFor(room, stationId) {
  if (stationId === 'deck' || stationId === 'training') return { stationId, type:stationId, furnitureId:null, x:480, y:460, rotation:0, capacity:6 };
  const entry=room.placements.find(p=>p.itemId===stationId);
  if(!entry)return null;
  const type=content().stationForFurniture(stationId)?.type;
  return type ? { stationId, type, furnitureId:entry.itemId, x:entry.x,y:entry.y,rotation:entry.rotation,capacity:1 } : null;
}
function stationFingerprint(station) { return canonical({stationId:station.stationId,x:station.x,y:station.y,rotation:station.rotation}); }
function validJobContext(job,state,room) {
  const station=stationFor(room,job.stationId);
  return state.activeCharacterIds.includes(job.itemId) && station && (!job.stationFingerprint || job.stationFingerprint===stationFingerprint(station));
}
function aggregate(state, now) {
  const ms=Math.min(MAX_OFFLINE_MS,Math.max(0,now.getTime()-Date.parse(state.lastSimulatedAt)));
  const offline=Boolean(state.lastExitAt) || now.getTime()-Date.parse(state.lastSeenAt)>90000;
  const hours=ms/3600000;
  for(const actor of Object.values(state.characters)) {
    const job=state.jobs.find(j=>j.itemId===actor.itemId && j.status==='active');
    const workingHours=job?Math.max(0,Math.min(ms,Date.parse(job.readyAt)-Date.parse(state.lastSimulatedAt)))/3600000:0;
    const restingHours=hours-workingHours, rates=content().characters?.[actor.key]?.needRates||{};
    actor.needs.energy=clamp(actor.needs.energy+restingHours*5-workingHours*(rates.energy||.1)*60);
    actor.needs.hunger=clamp(actor.needs.hunger+(workingHours*7+restingHours*3)*(rates.hunger||.12)/.12);
    actor.needs.social=clamp(actor.needs.social-hours*(rates.social||.04)*60);
    actor.needs.mood=clamp(actor.needs.mood+(65-actor.needs.mood)*Math.min(1,hours/8));
    actor.needs.workMotivation=clamp(actor.needs.workMotivation+restingHours*3-workingHours*(rates.workMotivation||.05)*60);
    for(const key of NEED_KEYS) {
      const bounds=content().needBounds?.[key]||[0,100];
      actor.needs[key]=Math.round(clamp(actor.needs[key],bounds[0],bounds[1])*100)/100;
    }
    actor.memories=actor.memories.filter(m=>m.strength>0&&now.getTime()-Date.parse(m.timestamp)<clamp(m.decay||21600000,60000,2*DAY_MS)).slice(-16);
  }
  state.jobs=state.jobs.filter(j=>j.status!=='reserved'||Date.parse(j.expiresAt)>now.getTime());
  for(const job of state.jobs) if(job.status==='active'&&Date.parse(job.readyAt)<=now.getTime())job.status='ready';
  state.lastSimulatedAt=now.toISOString();state.lastSeenAt=now.toISOString();state.lastExitAt=null;
  state.offlineSummary={elapsedMs:offline?ms:0,completedJobs:0,coins:0};
  return {offline,elapsedMs:ms};
}
function addMemory(state,itemId,type,participants,now,strength=.5,decay=21600000) {
  const actor=state.characters[itemId];if(!actor)return;
  actor.memories.push({type,participants:participants.filter(id=>state.characters[id]),timestamp:now.toISOString(),strength:clamp(strength,0,1),decay:clamp(decay,60000,2*DAY_MS)});actor.memories=actor.memories.slice(-16);
}
function safeSpawn(room) {
  const occupants=[...room.characters,...room.placements];
  for(const row of [7,6,5,4,3,2,1,0])for(const col of [0,15,1,14,2,13,3,12,4,11,5,10,6,9,7,8]) {
    const t=(row+.5)/8,left=164+(28-164)*t,right=796+(932-796)*t;
    const p={x:Math.round((left+(right-left)*(col+.5)/16)*100)/100,y:Math.round((267+248*t)*100)/100};
    if(occupants.every(o=>Math.hypot(o.x-p.x,o.y-p.y)>64))return p;
  }
  return null;
}
function publicLife(state) { const result=clone(state);delete result.lastExitAt;return result; }
module.exports={DAY_MS,MAX_OFFLINE_MS,RESERVATION_MS,MAX_JOBS,CREW,NEED_KEYS,DEFAULT_NEEDS,object,clone,clamp,keyOf,iso,day,pairKey,content,canonical,commandHash,legacyJobId,normalizeState,stationFor,stationFingerprint,validJobContext,aggregate,addMemory,safeSpawn,publicLife};
