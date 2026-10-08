/* Character life decisions. Rendering, navigation and all economic authority are injected. */
(function(root, factory) {
  'use strict';
  const reserved = typeof module === 'object' && module.exports ? require('./launcher-reserved-crew.js') : root.OnePieceReservedCrew;
  const api = factory(reserved);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OnePieceLife = api;
})(typeof globalThis === 'object' ? globalThis : this, function(reserved) {
  'use strict';
  const STATES = Object.freeze(['Idle','Wander','Work','Eat','Rest','Sleep','Train','Socialize','UseFurniture','SpecialAction','EventParticipant']);
  const DEFAULT_NEEDS = Object.freeze({energy:78,hunger:22,mood:72,social:68,workMotivation:62});
  const BASE_WEIGHTS = Object.freeze({Idle:2,Wander:5,Work:2,Eat:2,Rest:2,Sleep:1,Train:2,Socialize:2,UseFurniture:3,SpecialAction:1});
  const DEFAULT_CLIPS = Object.freeze({Idle:'idle',Wander:'idle',Work:'work',Eat:'eat',Rest:'rest',Sleep:'sleep',Train:'train',Socialize:'listen',UseFurniture:'work',SpecialAction:'wave',EventParticipant:'listen'});
  const clamp = (value,min,max,fallback=min) => Number.isFinite(Number(value)) ? Math.max(min,Math.min(max,Number(value))) : fallback;
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const keyOf = value => String(value || '').replace(/^room-character-/, '');
  const itemOf = key => 'room-character-' + keyOf(key);
  const pairKey = (a,b) => [keyOf(a),keyOf(b)].sort().join(':');
  const cellKey = cell => cell && Number.isInteger(cell.col) && Number.isInteger(cell.row) ? cell.col + ':' + cell.row : '';
  const stamp = value => Number.isFinite(Number(value)) ? Number(value) : Date.parse(value || '') || 0;
  const list = value => Array.isArray(value) ? value : [];
  const names = value => list(value).map(keyOf);
  const duration = (value,fallback=12000) => clamp(value,500,180000,fallback);
  function create(options={}) {
    const data = options.data || {};
    let adapter = options.adapter || {};
    const clock = typeof options.clock === 'function' ? options.clock : Date.now;
    const rng = typeof options.rng === 'function' ? options.rng : Math.random;
    const command = typeof options.command === 'function' ? options.command : async () => ({ok:false,error:'unavailable'});
    const onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
    const policy=data.policies || {};
    const foregroundGapMs=clamp(policy.foregroundGapMs,1000,86400000,180000);
    const pairCooldownMs=clamp(policy.pairCooldownMs,1000,86400000,720000);
    // Casual room conversation has its own presentation cadence. Authored rare
    // events keep the original foreground and pair cooldowns.
    const casualGapMs=clamp(options.casualConversation?.foregroundGapMs,1000,foregroundGapMs,foregroundGapMs);
    const casualPairCooldownMs=clamp(options.casualConversation?.pairCooldownMs,1000,pairCooldownMs,pairCooldownMs);
    const rareMinimum=Math.max(foregroundGapMs,clamp(policy.rareEventIntervalMs?.[0],1000,86400000,360000));
    const rareMaximum=Math.max(rareMinimum,clamp(policy.rareEventIntervalMs?.[1],1000,86400000,600000));
    const rareDelay=()=>rareMinimum+Math.floor(clamp(rng(),0,.999999,0)*(rareMaximum-rareMinimum));
    const canonical = new Set(names(data.characterKeys || data.KEYS || Object.keys(data.characters || data.CHARACTERS || {})));
    if (!canonical.size) for (const key of ['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe']) canonical.add(key);
    let released = new Set(reserved?.releasedKeys() || canonical);
    let rosterRevision = 0;
    const records = new Map(), tasks = new Map(), leases = new Map(), owned = new Set(), stationCooldowns = new Map();
    const stationUseAt = new Map(), activityCursor = new Map(), lastActivityLineAt = new Map();
    const arrivals = new Map(), acknowledged = new Set(), jobs = new Map(), pairCooldown = new Map(), eventCooldown = new Map(), lineCooldown = new Map();
    const recentEvents = [], recentLines = [];
    let pairs = {}, directive = data.defaultDirective || 'free_day', revision = 0, serial = 0, epoch = 0, disposed = false, paused = false;
    let writable = options.writable !== false, lastTick = stamp(clock()), lastNow = lastTick, nextDecision = lastTick;
    let nextForegroundAt = lastTick + 12000, nextRareAt = lastTick + rareDelay(), foreground = null, lastCheckpoint = lastTick;
    let nextActivityLineAt = lastTick;
    let serverOffset = 0, offlineSummary = null, syncedRevision = -1;
    const seenOffline = [];
    const nowOf = value => {
      const input = stamp(value === undefined ? clock() : value);
      lastNow = Math.max(lastNow,input);
      return lastNow;
    };
    const definition = key => (data.characters || data.CHARACTERS || {})[key] || {};
    const emit = () => { if (!disposed) onChange(snapshot()); };
    const safeCall = (method,...args) => {
      try { return typeof adapter[method] === 'function' ? adapter[method](...args) : undefined; }
      catch { return false; }
    };
    function world() {
      const value = safeCall('getWorld') || {};
      return {...value,actors:list(value.actors),stations:list(value.stations)};
    }
    function activeMap() {
      return new Map(world().actors.filter(a => a && released.has(keyOf(a.key || a.itemId)) && owned.has(keyOf(a.key || a.itemId))).map(a => [keyOf(a.key || a.itemId),a]));
    }
    function record(key) {
      if (!records.has(key)) records.set(key,{key,itemId:itemOf(key),state:'Idle',needs:Object.fromEntries(Object.entries(DEFAULT_NEEDS).map(([name,value])=>[name,clamp(definition(key).initialNeeds?.[name],0,100,value)])),memories:[],nextAt:lastNow,taps:[],taskToken:null,lastWorkAt:0,missingClip:''});
      return records.get(key);
    }
    function rebuildOwned(value) {
      const next = new Set(names(value).filter(key => canonical.has(key) && released.has(key)));
      for (const key of owned) if (!next.has(key)) {
        cancel(key,'ownership_changed'); records.delete(key); arrivals.delete(key); acknowledged.delete(key);
      }
      owned.clear(); for (const key of next) {owned.add(key);record(key);}
      for (const [pair] of Object.entries(pairs)) if (pair.split(':').some(key => !owned.has(key))) delete pairs[pair];
      for (const a of owned) for (const b of owned) if (a < b) {
        const id=pairKey(a,b);
        if (!pairs[id]) pairs[id]=normalizePair((data.relationships || data.RELATIONSHIPS || {})[id]);
      }
    }
    function normalizePair(value={}) {
      return Object.fromEntries(['familiarity','friendship','rivalry','respect'].map(key => [key,clamp(value?.[key],0,100,key==='rivalry'?10:55)]));
    }
    function sync(input={}) {
      if (disposed) return;
      const snap=input.life || input;
      if(Number.isSafeInteger(snap.revision)&&snap.revision<syncedRevision)return;
      const roster = Object.hasOwn(input,'releasedCharacterIds') ? input : snap;
      const nextReleased = new Set(reserved?.releasedKeys(roster) || canonical);
      const rosterChanged = [...released].join(':') !== [...nextReleased].join(':');
      released = nextReleased;
      rosterRevision = Number.isSafeInteger(roster.rosterRevision) ? roster.rosterRevision : 0;
      if (input.serverNow) serverOffset=stamp(input.serverNow)-stamp(clock());
      // A reply may be forwarded by both the IPC wrapper and command promise.
      // Do not reset local presentation needs or replay a receipt on that duplicate.
      if(Number.isSafeInteger(snap.revision)&&snap.revision===syncedRevision&&!rosterChanged)return;
      if(Number.isSafeInteger(snap.revision))syncedRevision=snap.revision;
      if (snap.ownedCharacterIds) rebuildOwned(snap.ownedCharacterIds);
      else if (world().ownedItemIds) rebuildOwned(world().ownedItemIds);
      revision=Number.isSafeInteger(snap.revision)?snap.revision:revision;
      directive=typeof snap.directive==='string'?snap.directive:directive;
      if (snap.pairs) for (const [pair,value] of Object.entries(snap.pairs)) {
        const id=pair.split(':').map(keyOf).sort().join(':');
        if (id.split(':').every(key=>owned.has(key))) pairs[id]=normalizePair(value);
      }
      for (const [id,value] of Object.entries(snap.characters || {})) {
        const key=keyOf(value.key || id); if (!owned.has(key)) continue;
        const actor=record(key);
        if (value.needs) for (const name of Object.keys(DEFAULT_NEEDS)) actor.needs[name]=clamp(value.needs[name],0,100,actor.needs[name]);
        if (Array.isArray(value.memories)) actor.memories=value.memories.filter(m=>m && typeof m.type==='string').slice(-16).map(m=>({...clone(m),timestamp:stamp(m.timestamp),strength:clamp(m.strength,0,1,.5),decay:clamp(m.decay,60000,604800000,21600000)}));
      }
      if (Array.isArray(snap.jobs)) {
        jobs.clear(); for(const job of snap.jobs) if (job?.jobId && owned.has(keyOf(job.itemId))) jobs.set(job.jobId,clone(job));
        for (const task of tasks.values()) if (task.job) {
          if(jobs.has(task.job.jobId))task.job={...task.job,...jobs.get(task.job.jobId)};
          else if(!task.pending){task.completed=true;task.phase='undocking';task.resultError='';}
        }
      }
      if (Array.isArray(snap.pendingArrivals)) {
        const current=new Set();
        for(const arrival of snap.pendingArrivals) {
          const key=keyOf(arrival?.itemId); if(!owned.has(key) || !arrival.arrivalId) continue;
          current.add(key); if(!acknowledged.has(arrival.arrivalId)) arrivals.set(key,clone(arrival));
        }
        for(const [key,arrival] of arrivals) if(!current.has(key) && !tasks.get(key)?.arrival) arrivals.delete(key);
      }
      if (Array.isArray(snap.recentEvents)) {
        for(const event of snap.recentEvents.slice(-32)) if(event?.id || event?.eventId) {
          const id=event.id || event.eventId, at=stamp(event.timestamp || event.at);
          if(!recentEvents.some(v=>v.id===id && v.timestamp===at)) recentEvents.push({id,timestamp:at});
        }
        recentEvents.splice(0,Math.max(0,recentEvents.length-32));
      }
      if(snap.offlineSummary) {
        const summary=snap.offlineSummary;
        const meaningful=Number(summary.completedJobs)>0||Number(summary.coins)>0;
        const fingerprint=String(summary.receiptId || summary.id || JSON.stringify(summary));
        if(meaningful&&!seenOffline.includes(fingerprint)) {
          offlineSummary=clone(summary);seenOffline.push(fingerprint);if(seenOffline.length>32)seenOffline.shift();
        } else offlineSummary=null;
      }
      emit();
    }
    async function invoke(type,payload,key) {
      const requestEpoch=epoch;
      if(disposed || !writable || (key && (!released.has(key)||!owned.has(key)))) return {ok:false,error:'readonly'};
      let response;
      try { response=await command(type,clone(payload)); }
      catch { response={ok:false,error:'offline'}; }
      if(disposed || epoch!==requestEpoch || (key && !owned.has(key))) return {ok:false,error:'stale'};
      if(response?.life) sync(response);
      return response || {ok:false,error:'empty_response'};
    }
    function stationDefinition(station) {
      const table=data.stations || data.STATIONS || {};
      if(Array.isArray(table)) return table.find(s=>s.id===station.type || s.type===station.type || list(s.furnitureKeys).includes(station.furnitureKey)) || {};
      return table[station.type] || Object.values(table).find(s=>list(s.furnitureKeys).includes(station.furnitureKey)) || {};
    }
    function slotCandidates(station) {
      return list(station.slots).length?station.slots.map((slot,i)=>({...slot,id:slot.id || String(i)})):
        station.cell?[{id:'0',cell:station.cell}]:[];
    }
    function blockedLease(key,cell,stationId,slotId) {
      const cooldown=stationCooldowns.get(stationId);
      if(cooldown&&cooldown.key!==key&&cooldown.until>lastNow)return true;
      return [...leases.values()].some(lease=>lease.key!==key && ((cellKey(lease.cell) && cellKey(lease.cell)===cellKey(cell)) || (stationId && lease.stationId===stationId && lease.slotId===slotId)));
    }
    function reserveBatch(entries,token) {
      const cells=new Set(), slots=new Set();
      for(const entry of entries) {
        const c=cellKey(entry.cell),s=entry.stationId?entry.stationId+':'+entry.slotId:'';
        if(!c || cells.has(c) || (s && slots.has(s)) || blockedLease(entry.key,entry.cell,entry.stationId,entry.slotId)) return false;
        if(safeCall('plan',entry.key,entry.cell,token)!==true) return false;
        cells.add(c); if(s) slots.add(s);
      }
      if(typeof adapter.reserve==='function' && safeCall('reserve',entries,token)!==true) return false;
      for(const entry of entries) leases.set(token+':'+entry.key,{...clone(entry),token});
      return true;
    }
    function releaseTask(task) {
      if(task.station&&['performing','undocking','result-pending'].includes(task.phase))stationCooldowns.set(task.station.id,{key:task.key,until:lastNow+8000});
      leases.delete(task.token+':'+task.key);
      safeCall('clearSpeech',task.key,task.token);
      safeCall('release',task.key,task.token);
      const actor=records.get(task.key);
      if(actor && actor.taskToken===task.token) {actor.taskToken=null;actor.state='Idle';actor.missingClip='';actor.nextAt=lastNow+3000+Math.floor(rng()*5000);}
      if(tasks.get(task.key)===task) tasks.delete(task.key);
    }
    function cancel(key,reason='cancelled') {
      key=keyOf(key);
      const task=tasks.get(key); if(!task) return false;
      if(foreground && foreground.keys.includes(key)) {finishEvent(false,reason);return true;}
      task.cancelled=true;
      if(task.job && writable) {
        jobs.delete(task.job.jobId);
        void invoke('work.cancel',{jobId:task.job.jobId},key);
      }
      releaseTask(task);return true;
    }
    function available(key) {
      const actor=activeMap().get(key);
      return !!actor && actor.available!==false && !tasks.has(key) && !arrivals.has(key);
    }
    function chooseWeighted(values) {
      const clean=values.filter(v=>v.weight>0); const sum=clean.reduce((s,v)=>s+v.weight,0);
      if(!sum)return null;
      let roll=clamp(rng(),0,.999999,0)*sum;
      for(const entry of clean){roll-=entry.weight;if(roll<0)return entry.value;}
      return clean[clean.length-1].value;
    }
    function scheduleAt(now) {
      const hour=new Date(now).getHours();
      const id=hour>=5&&hour<11?'morning':hour>=11&&hour<17?'day':hour>=17&&hour<22?'evening':'night';
      const table=data.schedules || data.SCHEDULES || {};
      const found=Array.isArray(table)?table.find(s=>s.id===id):table[id];
      return {id,weights:found?.weights || found?.stateWeights || {}};
    }
    function contextAt(now) {
      const date=new Date(now),month=date.getMonth()+1,hour=date.getHours();
      const provided=safeCall('getContext',now)||{};
      const daypart=hour<5||hour>=20?'night':hour<7?'dawn':hour<17?'day':'dusk';
      const season=month<=2||month===12?'winter':month<=5?'spring':month<=8?'summer':'autumn';
      return {
        daypart:['dawn','day','dusk','night'].includes(provided.daypart)?provided.daypart:daypart,
        season:['spring','summer','autumn','winter'].includes(provided.season)?provided.season:season,
        weather:['clear','cloudy','rain','snow','storm'].includes(provided.weather)?provided.weather:'clear'
      };
    }
    function weightsFor(key,now) {
      const actor=record(key),def=definition(key);
      const weights={...BASE_WEIGHTS,...(def.weights || def.stateWeights || {})};
      const schedules=scheduleAt(now);
      const dir=(data.directives || data.DIRECTIVES || {})[directive] || {};
      const personal=def.schedule?.[schedules.id]?.weights || {};
      for(const state of Object.keys(weights)) {
        weights[state]*=clamp(schedules.weights[state],.1,5,1)*clamp(personal[state],.1,5,1)*clamp((dir.weights || dir.stateWeights || dir)[state],.1,5,1);
      }
      const n=actor.needs;
      weights.Eat*=.2+n.hunger/23; weights.Rest*=.2+(100-n.energy)/25;
      weights.Sleep*=.15+(100-n.energy)/42;
      weights.Socialize*=.3+(100-n.social)/25+n.mood/120;
      weights.Work*=.2+n.workMotivation/60;
      weights.Train*=.3+n.energy/70;
      const outside=contextAt(now);
      if(['rain','snow','storm'].includes(outside.weather)) {
        weights.Wander*=outside.weather==='storm'?.42:.68;
        weights.UseFurniture*=1.28;
        weights.Socialize*=1.12;
      }
      if(outside.season==='winter')weights.Rest*=1.18;
      if(outside.daypart==='dawn')weights.Train*=1.12;
      if(outside.daypart==='night')weights.Sleep*=1.2;
      if(now-actor.lastWorkAt<180000)weights.Work=0;
      return weights;
    }
    function tickNeeds(elapsed,now) {
      const minutes=Math.min(elapsed,3600000)/60000;
      for(const key of owned) {
        const actor=record(key),rates=definition(key).needRates || {};
        const resting=['Rest','Sleep'].includes(actor.state),eating=actor.state==='Eat',social=['Socialize','EventParticipant'].includes(actor.state);
        actor.needs.energy=clamp(actor.needs.energy+minutes*(resting?3.6:-(Number(rates.energy)||.55)),15,100,78);
        actor.needs.hunger=clamp(actor.needs.hunger+minutes*(eating?-6:(Number(rates.hunger)||.7)),0,90,22);
        actor.needs.social=clamp(actor.needs.social+minutes*(social?3:-(Number(rates.social)||.35)),15,100,68);
        actor.needs.mood=clamp(actor.needs.mood+minutes*(resting||social ? .6 : .1),25,100,72);
        actor.needs.workMotivation=clamp(actor.needs.workMotivation+minutes*(actor.state==='Work'?-1.5:(Number(rates.workMotivation)||.35)),15,100,62);
        actor.memories=actor.memories.filter(m=>now-m.timestamp<(m.decay||21600000) && m.strength>0.01).slice(-16);
      }
    }
    function memory(key,type,participants,now,strength=.6) {
      const actor=record(key);
      actor.memories.push({type,participants:participants.map(itemOf),timestamp:now,strength,decay:21600000});
      actor.memories=actor.memories.slice(-16);
    }
    function memoryWeight(key,type,now) {
      return record(key).memories.filter(m=>m.type===type).reduce((sum,m)=>sum+m.strength*Math.max(0,1-(now-m.timestamp)/(m.decay||21600000)),0);
    }
    function clipFor(state,station,key) {
      const def=station?stationDefinition(station):{};
      if(state==='Work'&&list(def.stages).length)return def.stages[0].clip || 'work';
      if(state==='UseFurniture'&&station) {
        const specialist=def.specialistActions?.[key];
        const requirement=def.specialistRequirements?.[key];
        if(specialist&&(!list(requirement?.furnitureKeys).length||requirement.furnitureKeys.includes(station.furnitureKey))&&safeCall('supportsClip',key,specialist)===true)return specialist;
      }
      if(state!=='Work'&&state!=='UseFurniture')return definition(key).clips?.[state] || DEFAULT_CLIPS[state] || 'idle';
      const value=def.clips || def.actions;
      if(Array.isArray(value)&&value.length) return typeof value[0]==='string'?value[0]:value[0].clip || DEFAULT_CLIPS[state];
      const actor=definition(key);
      return actor.clips?.[state] || DEFAULT_CLIPS[state] || 'idle';
    }
    function favoritesFor(key) {
      const value=safeCall('favoriteFurniture',key);
      return list(value?.length?value:definition(key).favoriteFurniture).map(String);
    }
    function stationScore(key,station,state,now) {
      const favorites=favoritesFor(key),skill=efficiency(key,station);
      const stationDef=stationDefinition(station),specialist=stationDef.specialistActions?.[key];
      const requirement=stationDef.specialistRequirements?.[key];
      const hasSpecialist=!!specialist&&(!list(requirement?.furnitureKeys).length||requirement.furnitureKeys.includes(station.furnitureKey))&&safeCall('supportsClip',key,specialist)===true;
      const lastUsed=stationUseAt.get(key+':'+station.id)||0;
      const repeated=now-lastUsed<120000?2:0;
      const weather=contextAt(now).weather;
      const exposed=['deck','training'].includes(station.type)&&!station.furnitureKey;
      const shelter=['rain','snow','storm'].includes(weather)&&exposed?(weather==='storm'?5:2):0;
      return skill*(state==='Work'?9:3)+(favorites.includes(station.furnitureKey)?(state==='Work'?2:7):0)+(hasSpecialist?4:0)-repeated-shelter;
    }
    function candidatesFor(key,state,now) {
      if(!['Eat','Train','UseFurniture','Rest','Sleep'].includes(state))return [];
      const favorites=favoritesFor(key);
      return world().stations.filter(station=>{
        const def=stationDefinition(station);
        if(state==='Eat')return station.furnitureKey==='kitchen-table';
        if(state==='Train')return station.furnitureKey==='swords-rack'&&favorites.includes('swords-rack');
        if(state==='UseFurniture')return !!station.furnitureKey&&(!favorites.length||favorites.includes(station.furnitureKey)||efficiency(key,station)>=1.2||!!def.specialistActions?.[key]&&(!list(def.specialistRequirements?.[key]?.furnitureKeys).length||def.specialistRequirements[key].furnitureKeys.includes(station.furnitureKey)));
        return state!=='Rest'&&state!=='Sleep'||list(def.actions).some(a=>['rest','sleep'].includes(a));
      }).sort((a,b)=>stationScore(key,b,state,now)-stationScore(key,a,state,now));
    }
    function nearbyCells(key) {
      const actor=activeMap().get(key); if(!actor?.cell)return[];
      const {col,row}=actor.cell;
      return [{col,row},{col:col+1,row},{col:col-1,row},{col,row:row+1},{col,row:row-1}];
    }
    function startTask(key,state,station=null,extra={}) {
      if(!available(key) && !extra.arrival && !extra.restored)return false;
      const token='life-'+(++serial),actor=record(key);
      let selected=null;
      const candidates=station?slotCandidates(station):extra.targetCell?[{id:'manual',cell:extra.targetCell}]:nearbyCells(key).map((cell,i)=>({id:String(i),cell}));
      for(const slot of candidates) {
        const entry={key,cell:slot.cell,stationId:station?.id || '',slotId:slot.id};
        if(reserveBatch([entry],token)){selected=slot;break;}
      }
      if(!selected)return false;
      const firstClip=clipFor(state,station,key);
      const stationDef=stationDefinition(station||{}),specialist=stationDef.specialistActions?.[key];
      const requirement=stationDef.specialistRequirements?.[key];
      const specialistSupported=specialist&&(!list(requirement?.furnitureKeys).length||requirement.furnitureKeys.includes(station?.furnitureKey))&&safeCall('supportsClip',key,specialist)===true;
      const stages=state==='Work'?list(stationDef.stages).map(stage=>{
        const useSpecialist=stage.id==='operate'&&specialistSupported;
        return {...clone(stage),...(useSpecialist?{fallbackClip:stage.clip}:{}),clip:useSpecialist?specialist:stage.clip,durationMs:duration(stage.durationMs,5000)};
      }):[];
      const task={key,token,state,phase:'approach',station,slot:selected,goal:selected.cell,started:lastNow,deadline:lastNow+180000,clip:firstClip,durationMs:12000+Math.floor(rng()*16000),direction:['Eat','Rest','Sleep','Train'].includes(state)?'south':null,stages,...extra};
      tasks.set(key,task);actor.state=state;actor.taskToken=token;
      if(task.phase==='reserving')holdTask(task);
      if(task.phase!=='reserving'&&safeCall('move',key,task.goal,token)!==true){releaseTask(task);return false;}
      return task;
    }
    async function assignWork(key,stationId) {
      key=keyOf(key);
      const existing=tasks.get(key);
      if(existing?.job)return{ok:false,error:'work_active'};
      if(existing?.arrival)return{ok:false,error:'busy'};
      if(existing&&!existing.job&&!existing.arrival)cancel(key,'manual_assignment');
      if(disposed||paused||!writable||!available(key))return{ok:false,error:'unavailable'};
      const availableStations=world().stations.filter(s=>!stationId||s.id===stationId);
      availableStations.sort((a,b)=>stationScore(key,b,'Work',lastNow)-stationScore(key,a,'Work',lastNow));
      let task;
      for(const station of availableStations) if((task=startTask(key,'Work',station,{phase:'reserving'})))break;
      if(!task)return{ok:false,error:'no_station'};
      // Hold the actor and reserve its path, but do not activate or earn before arrival.
      task.phase='reserving';record(key).lastWorkAt=lastNow;
      const response=await invoke('work.reserve',{itemId:itemOf(key),stationId:task.station.id,roomRevision:world().roomRevision},key);
      if(disposed||tasks.get(key)!==task||task.cancelled) {
        if(response?.ok&&response.job?.jobId&&!disposed)void invoke('work.cancel',{jobId:response.job.jobId},key);
        return{ok:false,error:'cancelled'};
      }
      const job=response.job || list(response.life?.jobs).find(job=>job.itemId===itemOf(key));
      if(!response.ok||!job){releaseTask(task);return response.ok?{ok:false,error:'missing_job'}:response;}
      task.job=clone(job);jobs.set(job.jobId,clone(job));task.phase='approach';
      if(!paused&&(!reacquireTask(task)||safeCall('move',key,task.goal,task.token)!==true)){cancel(key,'route_failed');return{ok:false,error:'blocked_route'};}
      emit();return{...response,taskToken:task.token};
    }
    function assignDestination(key,target) {
      key=keyOf(key);
      if(disposed||paused||!writable)return{ok:false,error:'unavailable'};
      if(!owned.has(key)||!activeMap().has(key))return{ok:false,error:'not_owned'};
      const existing=tasks.get(key);
      if(existing?.job||[...jobs.values()].some(job=>keyOf(job.itemId)===key&&['reserved','active','ready'].includes(job.status)))return{ok:false,error:'work_active'};
      if(existing?.arrival)return{ok:false,error:'busy'};
      if(!target||!['floor','furniture'].includes(target.kind))return{ok:false,error:'invalid_target'};
      if(target.kind==='floor'&&(!Number.isInteger(target.cell?.col)||!Number.isInteger(target.cell?.row)))return{ok:false,error:'invalid_target'};
      if(target.kind==='furniture'&&(!target.station?.id||!list(target.station.slots).length))return{ok:false,error:'no_route'};
      if(target.kind==='floor'&&safeCall('plan',key,target.cell,'preview')!==true)return{ok:false,error:'no_route'};
      if(target.kind==='furniture'&&!target.station.slots.some(slot=>safeCall('plan',key,slot.cell,'preview')===true))return{ok:false,error:'no_route'};
      if(foreground?.keys.includes(key))finishEvent(false,'player_direction');
      else if(existing)cancel(key,'player_direction');
      if(!available(key))return{ok:false,error:'busy'};
      const station=target.kind==='furniture'?target.station:null;
      const favorites=favoritesFor(key);
      const training=station?.furnitureKey==='swords-rack'&&favorites.includes('swords-rack');
      const state=target.kind==='floor'?'SpecialAction':training?'Train':'UseFurniture';
      const task=startTask(key,state,station,{
        ...(target.kind==='floor'?{targetCell:{...target.cell}}:{}),
        clip:target.kind==='floor'?'idle':clipFor(state,station,key),
        durationMs:target.kind==='floor'?3500:training?12000:10000,
        direction:target.kind==='floor'||training?'south':null,
        directiveKind:target.kind==='floor'?'move':training?'train':'use'
      });
      if(!task)return{ok:false,error:'no_route'};
      emit();return{ok:true,state,taskToken:task.token};
    }
    function efficiency(key,station) {
      const def=definition(key);
      const stationDef=stationDefinition(station);
      const dir=(data.directives || data.DIRECTIVES || {})[directive] || {};
      return Number(def.efficiency?.[station.type] || def.workEfficiency?.[station.type] || def.efficiencies?.[station.type] || stationDef.efficiency?.[key] || 1)*clamp(dir.stationWeights?.[station.type],.1,5,1);
    }
    async function autoAssign() {
      const results=[];
      for(const key of owned) if(available(key))results.push({key,...await assignWork(key)});
      return results;
    }
    function changePhase(task,phase,now){task.phase=phase;task.phaseAt=now;}
    function holdTask(task) {
      if(typeof adapter.hold==='function')safeCall('hold',task.key,task.token);
      else safeCall('clip',task.key,'idle',{token:task.token,state:task.state,elapsedMs:0});
    }
    function finishTask(task,now) {
      if(task.arrival){completeArrival(task);return;}
      if(task.job&&!task.completed){completeWork(task);return;}
      if(!task.activityRecorded&&['Eat','Rest','Sleep','Train','UseFurniture'].includes(task.state)) {
        task.activityRecorded=true;
        if(writable)void invoke('activity.record',{itemId:itemOf(task.key),activity:task.state},task.key);
      }
      if(task.station&&safeCall('undock',task.key,task.token)!==true){changePhase(task,'undocking',now);return;}
      if(task.station)stationUseAt.set(task.key+':'+task.station.id,now);
      memory(task.key,task.state.toLowerCase(),[task.key],now,.25);releaseTask(task);
    }
    function completeWork(task) {
      if(task.pending)return;
      task.pending=true;task.phase='result-pending';
      void invoke('work.complete',{jobId:task.job.jobId},task.key).then(response=>{
        task.pending=false;if(disposed||tasks.get(task.key)!==task)return;
        if(response.ok){task.completed=true;jobs.delete(task.job.jobId);changePhase(task,'undocking',lastNow);}
        else if(response.error==='not_ready'||response.error==='work_not_ready'){changePhase(task,'performing',lastNow);task.retryAt=lastNow+10000;}
        else {task.resultError=response.error;task.retryAt=lastNow+30000;}
        emit();
      });
    }
    function completeArrival(task) {
      if(task.pending)return;
      task.pending=true;changePhase(task,'arrival-ack',lastNow);
      void invoke('arrival.ack',{arrivalId:task.arrival.arrivalId},task.key).then(response=>{
        task.pending=false;if(disposed||tasks.get(task.key)!==task)return;
        if(response.ok){acknowledged.add(task.arrival.arrivalId);arrivals.delete(task.key);releaseTask(task);}
        else{task.retryAt=lastNow+30000;task.resultError=response.error;}
        emit();
      });
    }
    function taskTick(task,now,elapsed=0) {
      if(task.event)return;
      if(!owned.has(task.key)){cancel(task.key,'ownership_changed');return;}
      if(safeCall('attending',task.key)===true) {
        // A character menu holds only local presentation. Server jobs, wallet
        // authority and reservations remain intact until the viewer closes it.
        for(const field of ['deadline','phaseAt','retryAt'])if(Number.isFinite(task[field]))task[field]+=elapsed;
        return;
      }
      if(now>task.deadline&&['approach','docking','turning','await-art'].includes(task.phase)){cancel(task.key,'blocked_timeout');return;}
      if(task.phase==='reserving'||task.pending){holdTask(task);return;}
      if(task.phase==='arrival-ack'){if(now>=task.retryAt)completeArrival(task);return;}
      if(task.phase==='result-pending'){if(now>=task.retryAt)completeWork(task);return;}
      if(task.phase==='approach') {
        if(safeCall('arrived',task.key,task.token)!==true)return;
        changePhase(task,task.station?'docking':'turning',now);
      }
      if(task.phase==='docking') {
        if(safeCall('dock',task.key,task.station,task.token)!==true)return;
        changePhase(task,'turning',now);
      }
      if(task.phase==='turning') {
        const current=activeMap().get(task.key)?.cell;
        const face=task.direction==='south'&&current?{col:current.col,row:current.row+1}:task.slot.facing || task.station?.cell || task.goal;
        if(typeof adapter.face==='function'&&safeCall('face',task.key,face,task.token)!==true)return;
        changePhase(task,'await-art',now);
      }
      if(task.phase==='await-art') {
        for(const stage of task.stages||[])if(stage.fallbackClip&&stage.clip!==stage.fallbackClip&&safeCall('clipFailed',task.key,stage.clip,task.direction)===true)stage.clip=stage.fallbackClip;
        const clips=task.stages?.length?task.stages.map(stage=>stage.clip):[task.clip];
        const complete=typeof adapter.hasClip!=='function'||clips.map(clip=>safeCall('hasClip',task.key,clip)).every(ready=>ready!==false);
        const ready=complete&&safeCall('clip',task.key,task.clip,{token:task.token,state:task.state,direction:task.direction,stationId:task.station?.id,stageId:task.stages?.[0]?.id,elapsedMs:0,durationMs:task.durationMs})===true;
        record(task.key).missingClip=ready?'':task.clip;
        if(!ready)return;
        if(task.job&&task.job.status==='reserved') {
          if(!writable)return;
          if((task.retryAt&&now<task.retryAt)||now+serverOffset<stamp(task.job.activateAfter))return;
          task.pending=true;
          void invoke('work.activate',{jobId:task.job.jobId},task.key).then(response=>{
            task.pending=false;if(disposed||tasks.get(task.key)!==task)return;
            if(!response.ok){
              task.resultError=response.error;
              if(response.error==='arrival_too_early'){task.retryAt=lastNow+1500;return;}
              cancel(task.key,'activation_failed');return;
            }
            task.job=clone(response.job || list(response.life?.jobs).find(j=>j.jobId===task.job.jobId) || {...task.job,status:'active'});
            changePhase(task,'performing',lastNow);emit();
          });
          return;
        }
        changePhase(task,'performing',now);
      }
      if(task.phase==='performing') {
        const elapsed=now-task.phaseAt;
        // Navigation clears old bubbles. A manual reply belongs to the actual
        // arrival, then the complete action is repainted after the speech pose.
        if(task.arrivalBeat&&!task.arrivalSpoken) {
          task.arrivalSpoken=true;
          const beat=task.arrivalBeat;
          safeCall('speak',task.key,beat.line,beat.mood||'focused',{pose:beat.pose||'wave',token:task.token});
        }
        // Visible pauses are brief parts of a job, not a separate fake reward timer.
        const resting=task.state==='Work' && elapsed>25000 && elapsed%45000>36000;
        let stage=null,stageElapsed=elapsed;
        const cycle=list(task.stages).reduce((sum,part)=>sum+part.durationMs,0);
        if(cycle>0) {
          stageElapsed=elapsed%cycle;
          for(const part of task.stages){stage=part;if(stageElapsed<part.durationMs)break;stageElapsed-=part.durationMs;}
        }
        const clip=resting?'rest':stage?.clip || task.clip;
        const drawn=safeCall('clip',task.key,clip,{token:task.token,state:resting?'Rest':task.state,direction:task.direction,stationId:task.station?.id,stageId:stage?.id,elapsedMs:stageElapsed,durationMs:stage?.durationMs || task.durationMs})===true;
        record(task.key).missingClip=drawn?'':clip;
        if(!drawn)return;
        if(!foreground&&!task.activitySpoken&&!task.arrivalBeat&&(task.directiveKind||['UseFurniture','Eat','Train','Rest','Work'].includes(task.state))) {
          task.activitySpoken=true;
          if(task.directiveKind||now>=nextActivityLineAt&&now-(lastActivityLineAt.get(task.key)||0)>=35000) {
            const index=activityCursor.get(task.key)||0;
            const context={...contextAt(now),activity:task.state,stationType:task.station?.type||'',furnitureKey:task.station?.furnitureKey||'',
              specialist:!!task.station&&(favoritesFor(task.key).includes(task.station.furnitureKey)||clipFor('UseFurniture',task.station,task.key)!=='work')};
            const beat=task.directiveKind
              ?safeCall('directiveBeat',task.key,task.station?.furnitureKey||'',task.directiveKind,index,context)
              :safeCall('activityBeat',task.key,task.station?.furnitureKey||'',index,context);
            if(beat?.line&&(!beat.speaker||beat.speaker===task.key)) {
              activityCursor.set(task.key,index+1);
              lastActivityLineAt.set(task.key,now);nextActivityLineAt=now+7000;
              const reactionPose=beat.mode==='acting'?beat.pose:task.directiveKind==='use'&&!context.specialist
                ?beat.mood==='annoyed'?'talk_annoyed':'surprised':'';
              safeCall('speak',task.key,String(beat.line).slice(0,160),beat.mood||'focused',{
                token:task.token,activity:true,clip,state:task.state,direction:task.direction,stationId:task.station?.id,
                reactionPose,reactionMs:reactionPose?1500:0
              });
            }
          }
        }
        if(task.job) {
          const readyAt=stamp(task.job.readyAt);
          if(task.job.status==='ready'||(readyAt>0&&now+serverOffset>=readyAt)) {
            if(!task.retryAt||now>=task.retryAt)completeWork(task);
          }
        } else if(elapsed>=task.durationMs)finishTask(task,now);
      }
      if(task.phase==='undocking') {
        if(safeCall('undock',task.key,task.token)!==true)return;
        memory(task.key,task.state.toLowerCase(),[task.key],now,.35);releaseTask(task);
      }
    }
    function eventDefinitions() {
      const value=data.events || data.EVENTS || [];
      return Array.isArray(value)?value:Object.values(value);
    }
    function requiredKeys(event){return names(event.requiredCharacters || event.required || []);}
    function pairAvailable(keys,now=lastNow) {
      return keys.every((a,index)=>keys.slice(index+1).every(b=>now>=(pairCooldown.get(pairKey(a,b))||0)));
    }
    function actionsFor(event,keys) {
      return typeof data.requiredActionsFor==='function'?data.requiredActionsFor(event,keys):list(event.requiredActions);
    }
    function actionsReady(event,keys) {
      return actionsFor(event,keys).every(action=>!keys.includes(keyOf(action.actor))||safeCall('hasClip',keyOf(action.actor),action.clip,action.direction,action.furnitureKey)===true);
    }
    function getEventPool() {
      const map=activeMap(),now=lastNow,sceneFurniture=new Set(world().stations.map(s=>s.furnitureKey));
      return eventDefinitions().filter(event=>{
        const required=requiredKeys(event);
        if(!event?.id||!required.length||!required.every(key=>owned.has(key)))return false;
        if(!required.every(key=>map.has(key)))return false;
        if(!list(event.requiredFurniture).every(key=>sceneFurniture.has(key)))return false;
        if(!actionsReady(event,required))return false;
        return true;
      }).map(event=>({...clone(event),eligible:requiredKeys(event).every(available)&&pairAvailable(requiredKeys(event),now)&&now>=(eventCooldown.get(event.id)||0)}));
    }
    function eventSteps(event,keys) {
      if(typeof data.resolveEventSteps==='function'&&event.steps)return data.resolveEventSteps(event,keys);
      const eligible=step=>names(step.requiredCharacters || step.requiresCharacters || step.requires || []).every(key=>keys.includes(key));
      const result=[];
      function visit(steps) {
        for(const step of list(steps)) {
          if(!step||!eligible(step))continue;
          const kind=step.kind||step.type;
          if(kind==='branch') {
            const wants=names(step.ifCharacters || step.characters || step.condition?.characters);
            visit(wants.every(key=>keys.includes(key))?step.then || step.steps:step.else || []);
          } else if(step.steps)visit(step.steps);
          else result.push({...step,kind:kind|| (step.line?'speak':'act')});
        }
      }
      visit(event.steps || event.turns);
      return result.filter(step=>{
        const speaker=keyOf(step.actor || step.speaker || step.key || keys[0]);
        return keys.includes(speaker);
      });
    }
    function beginEvent(event,now=lastNow) {
      if(disposed||paused||foreground||now<nextForegroundAt)return false;
      const required=requiredKeys(event),map=activeMap();
      if(!required.length||!required.every(key=>owned.has(key)&&available(key))||!pairAvailable(required,now))return false;
      if(!actionsReady(event,required))return false;
      let keys=[...required];
      for(const key of names(event.optionalCharacters))if(!keys.includes(key)&&owned.has(key)&&available(key)&&pairAvailable([...keys,key],now)&&actionsReady(event,[...keys,key]))keys.push(key);
      if(!list(event.requiredFurniture).every(key=>world().stations.some(s=>s.furnitureKey===key)))return false;
      const token='event-'+(++serial),leader=map.get(keys[0]);if(!leader?.cell)return false;
      const initialSteps=eventSteps(event,keys);
      const contact=initialSteps.find(step=>step.kind==='act'&&step.station);
      const station=world().stations.find(s=>contact?s.furnitureKey===contact.station:list(event.requiredFurniture).includes(s.furnitureKey));
      const center=station?.cell || leader.cell;
      const offsets=event.expanded?[[-2,0],[2,0],[0,2],[0,-2],[-2,1],[2,1],[-2,-1],[2,-1]]:[[0,1],[-1,0],[1,0],[0,-1],[-1,1],[1,1],[-1,-1],[1,-1],[0,2],[-2,0]];
      const entries=[];
      for(let i=0;i<keys.length;i++) {
        const key=keys[i];
        const contactSlot=contact&&keyOf(contact.actor)===key&&station?slotCandidates(station):[];
        const cells=contactSlot.length?contactSlot.map(slot=>slot.cell):i===0&&!station?[leader.cell,...offsets.map(([dc,dr])=>({col:center.col+dc,row:center.row+dr}))]:offsets.map(([dc,dr])=>({col:center.col+dc,row:center.row+dr}));
        const cell=cells.find(cell=>!entries.some(e=>cellKey(e.cell)===cellKey(cell))&&!blockedLease(key,cell)&&safeCall('plan',key,cell,token)===true);
        if(!cell){if(required.includes(key))return false;continue;}
        const slot=contactSlot.find(slot=>cellKey(slot.cell)===cellKey(cell));
        entries.push({key,cell,stationId:slot?station.id:'',slotId:slot?slot.id:String(i),facing:slot?.facing});
      }
      keys=entries.map(entry=>entry.key);
      const steps=eventSteps(event,keys);if(!steps.length||!reserveBatch(entries,token))return false;
      foreground={token,event:clone(event),keys,steps,index:0,phase:'approach',started:now,deadline:now+180000,stepAt:0,contacts:entries.filter(entry=>entry.stationId).map(entry=>({key:entry.key,station,slot:entry}))};
      for(const entry of entries) {
        const task={key:entry.key,token,event:true,state:event.legacy?'Socialize':'EventParticipant',phase:'approach',goal:entry.cell,started:now};
        tasks.set(entry.key,task);record(entry.key).state=task.state;record(entry.key).taskToken=token;
        if(safeCall('move',entry.key,entry.cell,token)!==true){finishEvent(false,'route_failed');return false;}
      }
      return true;
    }
    function finishEvent(completed,reason='') {
      const event=foreground;if(!event)return;
      foreground=null;
      const now=lastNow,id=event.event.id;
      eventCooldown.set(id,now+Math.max(rareMinimum,Number(event.event.cooldownMs)||0));
      for(const a of event.keys) for(const b of event.keys) if(a<b)pairCooldown.set(pairKey(a,b),now+Math.max(event.event.legacy?casualPairCooldownMs:pairCooldownMs,Number(event.event.pairCooldownMs)||0));
      nextForegroundAt=now+(event.event.legacy?casualGapMs:foregroundGapMs);
      // Casual dialogue uses shorter presentation limits and does not postpone
      // the independent rare-event clock.
      if(!event.event.legacy)nextRareAt=now+rareDelay();
      if(completed) {
        recentEvents.push({id,timestamp:now});recentEvents.splice(0,Math.max(0,recentEvents.length-32));
        for(const key of event.keys)memory(key,event.event.memory?.type || event.event.memoryType || id,event.keys,now,clamp(event.event.memory?.strength,0,1,.6));
        for(const a of event.keys)for(const b of event.keys)if(a<b) {
          const id=pairKey(a,b),pair=pairs[id]||normalizePair();
          for(const name of ['familiarity','friendship','rivalry','respect'])pair[name]=clamp(pair[name]+clamp(event.event.relationshipDelta?.[name],-3,3,name==='familiarity'?.4:name==='friendship'?.2:0),0,100);
          pairs[id]=pair;
        }
        if(writable&&(!event.event.legacy||eventDefinitions().some(def=>def.id===id)))void invoke('event.record',{eventId:id,participants:event.keys.map(itemOf)},event.keys[0]);
      }
      for(const key of event.keys){const task=tasks.get(key);if(task?.token===event.token)releaseTask(task);}
      emit();
    }
    function eventTick(now) {
      const event=foreground;if(!event)return;
      const active=activeMap();
      if(event.keys.some(key=>!owned.has(key)||!active.has(key))){finishEvent(false,'participant_missing');return;}
      if(now>event.deadline){finishEvent(false,'event_timeout');return;}
      if(event.phase==='approach') {
        if(!event.keys.every(key=>safeCall('arrived',key,event.token)===true))return;
        event.phase='docking';event.stepAt=0;
      }
      if(event.phase==='docking') {
        for(const contact of event.contacts||[]) {
          if(safeCall('dock',contact.key,contact.station,event.token)!==true)return;
          if(safeCall('face',contact.key,contact.slot.facing||contact.station.cell,event.token)!==true)return;
        }
        event.phase='steps';
      }
      const step=event.steps[event.index];
      if(!step){finishEvent(true);return;}
      const key=keyOf(step.actor || step.speaker || step.key || event.keys[0]);
      if(!event.stepAt) {
        event.stepAt=now;event.stepReady=false;
        if(step.kind==='move') {
          const targetActor=active.get(keyOf(step.target || step.toActor));
          const target=step.cell || (targetActor?.cell?nearbyCells(targetActor.key).find(cell=>safeCall('plan',key,cell,event.token)===true):null);
          leases.delete(event.token+':'+key);
          if(!target||!reserveBatch([{key,cell:target,stationId:'',slotId:'step'}],event.token)||safeCall('move',key,target,event.token)!==true){finishEvent(false,'step_route_failed');return;}
        } else if(step.kind==='speak') {
          if(event.event.expanded&&!event.expansionStarted){safeCall('sceneStarted',event.event);event.expansionStarted=true;}
          const line=String(step.line||'').slice(0,160),id=key+':'+line;
          if(!line || now<(lineCooldown.get(id)||0)){event.index++;event.stepAt=0;return;}
          for(const member of event.keys)safeCall('clearSpeech',member,event.token);
          safeCall('speak',key,line,step.mood || 'focused',{token:event.token,pose:step.pose || 'idle'});
          if(step.listener&&event.keys.includes(keyOf(step.listener.key)))safeCall('clip',keyOf(step.listener.key),step.listener.pose || 'listen',{token:event.token,state:'Socialize',elapsedMs:0,durationMs:duration(step.durationMs,2800)});
          lineCooldown.set(id,now+120000);recentLines.push(id);
          if(recentLines.length>80)lineCooldown.delete(recentLines.shift());
        }
      }
      if(step.kind==='move') {
        if(safeCall('arrived',key,event.token)!==true)return;
      } else if(step.kind==='act') {
        if(step.direction) {
          const actor=active.get(key),offset={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]}[step.direction];
          if(offset&&actor?.cell&&safeCall('face',key,{col:actor.cell.col+offset[0],row:actor.cell.row+offset[1]},event.token)!==true)return;
        }
        const ready=safeCall('clip',key,step.clip || step.action || 'idle',{token:event.token,state:'EventParticipant',direction:step.direction,elapsedMs:event.artAt?now-event.artAt:0,durationMs:duration(step.durationMs,2500)})===true;
        if(!ready){record(key).missingClip=step.clip || step.action || 'idle';return;}
        record(key).missingClip='';
        if(!event.artAt)event.artAt=now;
        if(now-event.artAt<duration(step.durationMs,2500))return;
      } else if(now-event.stepAt<duration(step.durationMs,step.kind==='wait'?1500:2800))return;
      event.index++;event.stepAt=0;event.artAt=0;
    }
    function chooseEvent(now) {
      if(foreground||now<nextForegroundAt)return;
      const candidates=getEventPool().filter(event=>event.eligible&&now>=nextRareAt);
      const chosen=chooseWeighted(candidates.map(event=>({value:event,weight:Math.max(1,Number(event.priority)||20)/(1+recentEvents.filter(x=>x.id===event.id).length*4+requiredKeys(event).reduce((sum,key)=>sum+memoryWeight(key,event.memory?.type||event.memoryType||event.id,now),0))})));
      if(chosen&&beginEvent(chosen,now))return;
      if(typeof adapter.socialScene!=='function')return;
      const keys=[...owned].filter(available);
      const social=[];
      for(let i=0;i<keys.length;i++)for(let j=i+1;j<keys.length;j++) {
        const a=keys[i],b=keys[j],pair=pairKey(a,b);
        if(now<(pairCooldown.get(pair)||0))continue;
        const relationship=pairs[pair]||normalizePair();
        const availableFurnitureKeys=world().stations.map(s=>s.furnitureKey).filter(Boolean);
        const favoriteFurniture=[...favoritesFor(a),...favoritesFor(b)].find(key=>availableFurnitureKeys.includes(key))||'';
        const scene=safeCall('socialScene',a,b,{
          ...contextAt(now),activity:'Socialize',furnitureKey:favoriteFurniture,
          recentSceneIds:recentEvents.slice(-6).map(e=>e.id),availableFurnitureKeys,
          relationship:clone(relationship),schedule:scheduleAt(now).id,
          needs:{[a]:clone(record(a).needs),[b]:clone(record(b).needs)},
          memories:[...record(a).memories,...record(b).memories].slice(-8).map(clone)
        });
        if(!scene?.id||!list(scene.turns).length)continue;
        const legacy={...scene,id:scene.id,requiredCharacters:[a,b],steps:scene.turns.flatMap(turn=>[{...turn,kind:'speak'},...(turn.gapAfterMs?[{kind:'wait',durationMs:turn.gapAfterMs}]:[])]),legacy:true};
        if(now<(eventCooldown.get(scene.id)||0))continue;
        const fresh=1/(1+recentEvents.filter(e=>e.id===scene.id).length);
        social.push({value:legacy,weight:(.3+relationship.friendship/100+relationship.respect/150+relationship.rivalry/300+(200-record(a).needs.social-record(b).needs.social)/100)*fresh});
      }
      const encounter=chooseWeighted(social);if(encounter)beginEvent(encounter,now);
    }
    function queueArrival(key,arrivalId) {
      key=keyOf(key);if(!owned.has(key)||!arrivalId||acknowledged.has(arrivalId))return false;
      arrivals.set(key,{itemId:itemOf(key),arrivalId});return true;
    }
    function startArrivals(now) {
      if(!writable)return;
      for(const [key,arrival] of arrivals) {
        if(tasks.has(key)||!activeMap().has(key))continue;
        const entry=safeCall('entry',key);if(!entry?.from||!entry?.to)continue;
        const token='arrival-'+(++serial);
        if(safeCall('spawnArrival',key,entry.from,token)!==true)continue;
        if(!reserveBatch([{key,cell:entry.to,stationId:'',slotId:'arrival'}],token))continue;
        const task={key,token,state:'SpecialAction',phase:'approach',goal:entry.to,slot:{cell:entry.to},clip:'wave',durationMs:2500,started:now,deadline:now+180000,arrival};
        tasks.set(key,task);record(key).state='SpecialAction';record(key).taskToken=token;
        if(safeCall('move',key,entry.to,token)!==true)releaseTask(task);
        break;
      }
    }
    function restoreJobs() {
      for(const job of jobs.values()) {
        const key=keyOf(job.itemId);if(tasks.has(key)||!available(key))continue;
        const station=world().stations.find(s=>s.id===job.stationId);
        if(!station)continue;
        if(job.status==='ready' && writable) {
          const task=startTask(key,'Work',station,{job:clone(job),restored:true});
          if(task)task.durationMs=1000;
        } else if(['active','reserved'].includes(job.status))startTask(key,'Work',station,{job:clone(job),restored:true});
      }
    }
    function autonomous(key,now) {
      if(!available(key)||now<record(key).nextAt)return;
      const weights=weightsFor(key,now);
      if(!writable)weights.Work=0;
      if(!world().stations.length){weights.Work=0;weights.UseFurniture=0;weights.Eat*=.4;}
      const state=chooseWeighted(Object.entries(weights).map(([value,weight])=>({value,weight})))||'Idle';
      const actor=record(key);actor.nextAt=now+12000+Math.floor(rng()*18000);
      if(state==='Work'){void assignWork(key);return;}
      if(state==='Wander'){actor.state='Wander';safeCall('wander',key);return;}
      if(state==='Socialize'){
        chooseEvent(now);
        if(!foreground?.keys.includes(key)){actor.state='Wander';safeCall('wander',key);}
        return;
      }
      const stations=candidatesFor(key,state,now);
      for(const station of stations)if(startTask(key,state,station))return;
      // Ground activities remain honest: never invent a missing chair, food or workbench.
      if(['Eat','UseFurniture'].includes(state)){actor.state='Wander';safeCall('wander',key);return;}
      startTask(key,STATES.includes(state)?state:'Idle');
    }
    function tick(value) {
      if(disposed||paused)return;
      const now=nowOf(value),elapsed=Math.max(0,now-lastTick);lastTick=now;
      const snapshot=world();
      if(Object.hasOwn(snapshot,'releasedCharacterIds')) {
        released=new Set(reserved?.releasedKeys(snapshot)||canonical);
        rosterRevision=Number.isSafeInteger(snapshot.rosterRevision)?snapshot.rosterRevision:rosterRevision;
      }
      if(Array.isArray(snapshot.ownedItemIds))rebuildOwned(snapshot.ownedItemIds);
      if(snapshot.writable!==undefined)writable=snapshot.writable===true;
      tickNeeds(elapsed,now);
      for(const [key,task] of [...tasks])if(!activeMap().has(key)&&!task.arrival)cancel(key,'actor_detached');
      startArrivals(now);restoreJobs();
      for(const task of [...tasks.values()])taskTick(task,now,elapsed);
      eventTick(now);
      if(now>=nextDecision){nextDecision=now+1000;chooseEvent(now);for(const key of owned)autonomous(key,now);}
      if(writable&&now-lastCheckpoint>=60000){lastCheckpoint=now;void invoke('checkpoint',{});}
      emit();
    }
    async function interact(key,action='talk') {
      key=keyOf(key);if(!owned.has(key)||!activeMap().has(key))return{ok:false,error:'not_owned'};
      if(disposed||paused)return{ok:false,error:'unavailable'};
      const actor=record(key),now=nowOf();
      if(actor.lastInteractAt&&now-actor.lastInteractAt<1800)return{ok:false,error:'interaction_cooldown'};
      actor.lastInteractAt=now;
      if(!writable)return{ok:false,error:'readonly'};
      let response;
      if(action==='talk') {
        const currentEpoch=epoch;
        try {response=typeof adapter.talk==='function'?await adapter.talk(key):{ok:false,error:'use_existing_talk'};}
        catch {response={ok:false,error:'offline'};}
        if(disposed||currentEpoch!==epoch||!owned.has(key))return{ok:false,error:'stale'};
      } else response=await invoke('character.interact',{itemId:itemOf(key),action},key);
      if(!response.ok)return response;
      cancel(key,'manual_interaction');
      const def=definition(key),lines=(data.playerLines || data.PLAYER_LINES || {})[key] || def.playerLines || {};
      const pool=list(lines[action]);
      const line=pool.length?pool[Math.floor(clamp(rng(),0,.999999,0)*pool.length)]:null;
      const target=action==='call'?safeCall('callTarget',key):null;
      const state=action==='train'?'Train':action==='gift'?'Eat':'SpecialAction';
      const task=startTask(key,state,null,{durationMs:action==='train'?15000:action==='gift'?6500:3200,
        clip:action==='train'?'train':action==='gift'?'eat':'wave',direction:'south',
        ...(target?{targetCell:target}:{}),arrivalBeat:line?(typeof line==='string'?{line}:clone(line)):null});
      if(!task)return{...response,presentationError:'blocked_route'};
      emit();return response;
    }
    function react(key) {
      key=keyOf(key);if(disposed||!owned.has(key)||!activeMap().has(key))return{ok:false,error:'not_owned'};
      const actor=record(key),now=nowOf();actor.taps=actor.taps.filter(at=>now-at<12000);
      if(actor.taps.length&&now-actor.taps[actor.taps.length-1]<1200)return{ok:false,error:'interaction_cooldown'};
      actor.taps.push(now);actor.taps=actor.taps.slice(-5);
      const lines=(data.playerLines || data.PLAYER_LINES || {})[key] || definition(key).playerLines || {};
      const values=list(actor.taps.length>=3?lines.repeatClick || lines.repeated:lines.call || lines.talk);
      const value=values.length?values[(actor.taps.length-1)%values.length]:null;
      if(!value)return{ok:false,error:'no_line'};
      const beat=typeof value==='string'?{line:value,mood:'focused',pose:'wave'}:clone(value);
      // A tap observes an occupied character instead of silently cancelling paid work.
      if(!tasks.has(key))safeCall('speak',key,beat.line,beat.mood || 'focused',{pose:beat.pose || 'wave',token:'reaction',durationMs:2800});
      return{ok:true,...beat,tapCount:actor.taps.length,busy:tasks.has(key)};
    }
    async function setDirective(id) {
      if(typeof id!=='string')return{ok:false,error:'invalid_directive'};
      const response=await invoke('directive.set',{directive:id});
      if(response.ok&&!response.life)directive=id;
      emit();return response;
    }
    function pause() {
      if(disposed||paused)return;paused=true;
      // Data and jobs survive suspension. The room adapter releases presentation bindings.
      for(const task of tasks.values()){safeCall('clearSpeech',task.key,task.token);safeCall('release',task.key,task.token);}
      leases.clear();emit();
    }
    function reacquireTask(task) {
      if(task.station) {
        const updated=world().stations.find(station=>station.id===task.station.id);
        if(!updated)return false;
        leases.delete(task.token+':'+task.key);
        const slot=slotCandidates(updated).find(slot=>reserveBatch([{key:task.key,cell:slot.cell,stationId:updated.id,slotId:slot.id}],task.token));
        if(!slot)return false;
        task.station=updated;task.slot=slot;task.goal=slot.cell;
        return true;
      }
      return reserveBatch([{key:task.key,cell:task.goal,stationId:'',slotId:task.slot?.id||'resume'}],task.token);
    }
    function resume() {
      if(disposed)return;paused=false;lastTick=nowOf();nextDecision=lastTick;
      // Rebinding must route again, never jump from a saved placement to a stale dock.
      if(foreground)finishEvent(false,'view_rebind');
      for(const task of [...tasks.values()]) {
        if(task.pending||task.phase==='reserving'){holdTask(task);continue;}
        if(!reacquireTask(task)){cancel(task.key,'station_unreachable');continue;}
        task.phase='approach';task.started=lastTick;task.deadline=lastTick+180000;
        if(safeCall('move',task.key,task.goal,task.token)!==true)cancel(task.key,'route_failed');
      }
      emit();
    }
    function rebind(next) {adapter=next || adapter;if(!paused)resume();}
    function dispose() {
      if(disposed)return;
      if(foreground)finishEvent(false,'dispose');
      for(const task of [...tasks.values()])releaseTask(task);
      epoch++;disposed=true;paused=true;leases.clear();tasks.clear();
    }
    function snapshot() {
      return {schemaVersion:1,revision,disposed,paused,directive,writable,releasedCharacterIds:[...released].map(itemOf),rosterRevision,ownedCharacterIds:[...owned].map(itemOf),
        characters:Object.fromEntries([...records].filter(([key])=>owned.has(key)).map(([key,value])=>[key,{...clone(value),memories:value.memories.map(m=>({...clone(m),currentStrength:m.strength*Math.max(0,1-(lastNow-m.timestamp)/(m.decay||21600000))}))}])),
        pairs:clone(pairs),jobs:[...jobs.values()].map(clone),pendingArrivals:[...arrivals.values()].map(clone),
        tasks:[...tasks.values()].map(t=>({key:t.key,token:t.token,state:t.state,phase:t.phase,goal:clone(t.goal),stationId:t.station?.id||'',jobId:t.job?.jobId||'',clip:t.clip||'',resultError:t.resultError||''})),
        foreground:foreground?{id:foreground.event.id,keys:[...foreground.keys],phase:foreground.phase,index:foreground.index,steps:foreground.steps.length}:null,
        reservations:[...leases.values()].map(clone),recentEvents:clone(recentEvents),nextRareAt,nextForegroundAt,offlineSummary:clone(offlineSummary)};
    }
    const initial=world();
    released=new Set(reserved?.releasedKeys(initial)||canonical);
    rosterRevision=Number.isSafeInteger(initial.rosterRevision)?initial.rosterRevision:0;
    if(initial.ownedItemIds)rebuildOwned(initial.ownedItemIds);
    return Object.freeze({sync,rebind,tick,pause,resume,dispose,snapshot,assignWork,assignDestination,autoAssign,interact,react,setDirective,queueArrival,cancel,getEventPool,
      isBusy:key=>tasks.has(keyOf(key)),stateFor:key=>records.has(keyOf(key))?clone(records.get(keyOf(key))):null,reservations:()=>[...leases.values()].map(clone),
      // Explicit scheduling entry is also useful for deterministic integration tests.
      scheduleEvent:id=>{const event=eventDefinitions().find(v=>v.id===id);return !!event&&lastNow>=(eventCooldown.get(id)||0)&&beginEvent(event,lastNow);}});
  }
  return Object.freeze({STATES,DEFAULT_NEEDS,create,CharacterLifeController:create});
});
