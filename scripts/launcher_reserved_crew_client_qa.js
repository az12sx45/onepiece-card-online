'use strict';
// Isolated content/controller/decoder contract probes. No real accounts, DB, image quality or deployment acceptance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=process.env.LAUNCHER_RESERVED_CANDIDATE||path.resolve(__dirname,'..');
const out=process.env.LAUNCHER_RESERVED_QA_OUT||path.join(root,'tools/launcher-room/presentation-v125/review-evidence'),read=name=>fs.readFileSync(path.join(root,'desktop',name),'utf8'),load=name=>require(path.join(root,'desktop',name));
const R=load('launcher-reserved-crew.js'),D=load('launcher-life-data.js'),Q=load('launcher-room-dialogue.js'),L=load('launcher-life.js'),M=load('launcher-room-motion.js'),A=load('launcher-life-actions.js');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex'),json=value=>JSON.parse(JSON.stringify(value)),id=key=>'room-character-'+key;
const files=['launcher-reserved-crew.js','launcher-room.js','launcher-room-motion.js','launcher-life-actions.js','launcher-life-data.js','launcher-room-dialogue.js','launcher-life.js','launcher-life-room.js','launcher.html'];
const bindings=()=>Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(root,'desktop',file)))]));
const sourceSha256=bindings(),checks=[];
async function check(name,test){await test();checks.push({name,status:'PASS'});console.log('PASS '+name);}
function baseline(file,requires={}){const source=cp.execFileSync('git',['show','b8a459e8a5ed49aead8aee93b96a76728e02b537:desktop/'+file],{cwd:root,encoding:'utf8'});const ctx={module:{exports:{}},require:name=>{if(!(name in requires))throw new Error('Unexpected baseline require '+name);return requires[name];}};vm.runInNewContext(source,ctx,{filename:file});return ctx.module.exports;}
function fixture({released,owned=['ace'],placed=owned}={}){
  let now=Date.UTC(2026,8,27,12),revision=1;const calls=[],actors=placed.map((key,index)=>({key,itemId:id(key),cell:{col:index+1,row:6},available:true,moving:false}));
  const world={ownedItemIds:owned.map(id),actors,roomRevision:1,stations:[{id:'deck',type:'deck',furnitureKey:'',cell:{col:8,row:6},slots:[{id:'floor',cell:{col:8,row:6},facing:{col:8,row:7}}]}]};
  if(released!==undefined){world.releasedCharacterIds=released.map(id);world.rosterRevision=2;}
  const adapter={getWorld:()=>world,plan:()=>true,reserve:()=>true,move:()=>true,arrived:()=>true,face:()=>true,dock:()=>true,undock:()=>true,clip:()=>true,hasClip:()=>true,hold:()=>true,release:()=>true,wander:()=>{},speak:()=>{},clearSpeech:()=>{},callTarget:()=>({col:7,row:6}),entry:()=>({from:{col:0,row:6},to:{col:2,row:6}}),spawnArrival:()=>true};
  const controller=L.create({data:D,adapter,clock:()=>now,rng:()=>0,command:async(type,payload)=>{calls.push({type,payload});return{ok:false,error:'fixture_denied'};}});
  function sync(stamp=released){const response={life:{revision:revision++,ownedCharacterIds:world.ownedItemIds,characters:{},jobs:[],pendingArrivals:[],pairs:{},directive:'free_day'}};if(stamp!==undefined){response.releasedCharacterIds=stamp.map(id);response.rosterRevision=2;}controller.sync(response);}
  sync();return{controller,calls,world,sync,tick:()=>{now+=1000;controller.tick(now);}};
}
(async()=>{fs.mkdirSync(out,{recursive:true});
  await check('registry-default-denies-reserved-and-rejects-unknown-ids',()=>{
    assert.deepEqual(R.releasedKeys(),R.LEGACY_KEYS);assert.deepEqual(R.releasedKeys({releasedCharacterIds:['room-character-ace','not-a-character','ace']}),['ace']);
    assert.deepEqual(R.releasedKeys({releasedCharacterIds:[]}),[]);assert.equal(R.crewContentRevision,1);assert.equal(R.SUPPORTED_KEYS.length,14);assert(Object.isFrozen(R.characters.ace));
    for(const k of R.RESERVED_KEYS)assert.equal(R.shopMetadata[k].itemId,id(k));
  });
  await check('legacy-ten-content-and-motion-unchanged',()=>{
    const oldQ=baseline('launcher-room-dialogue.js'),oldD=baseline('launcher-life-data.js',{'./launcher-room-dialogue.js':oldQ}),oldM=baseline('launcher-room-motion.js');
    for(const key of R.LEGACY_KEYS){assert.deepEqual(json(D.characters[key]),json(oldD.characters[key]));assert.deepEqual(json(Q.PROFILES[key]),json(oldQ.PROFILES[key]));assert.deepEqual(json(Q.SOLO[key]),json(oldQ.SOLO[key]));assert.deepEqual(json(M.metadata(key)),json(oldM.metadata(key)));}
    for(const [key,scenes] of Object.entries(oldQ.SCENES))assert.deepEqual(json(Q.SCENES[key]),json(scenes));
    for(const event of oldD.authoredEvents)assert.deepEqual(json(D.eventById[event.id]),json(event));
    assert.deepEqual(json(D.policies),json(oldD.policies));assert.equal(D.policies.maxPresentCharacters,10);
  });
  await check('four-complete-profiles-and-all-46-new-pairings',()=>{
    assert.equal(Object.keys(R.scenes).length,46);assert.equal(D.characterKeys.length,14);
    const newIds=new Set();
    for(const key of R.RESERVED_KEYS){
      const c=D.characters[key];assert(c.name&&c.traits.length>=3&&c.voiceGuide&&c.canonicalSource);assert.equal(c.clips.Work,'work');assert(!Object.values(c.clips).includes('medicine'));
      for(const kind of ['chat','work','bond','rest','claim']){const beats=Q.SOLO[key][kind];assert(beats.length>=(kind==='chat'?6:kind==='claim'?2:4));assert.equal(new Set(beats.map(b=>b.line)).size,beats.length);}
      for(const kind of ['talk','repeated','call','gift','train','welcome'])assert(D.playerLines[key][kind].length>=3);
      for(const other of R.SUPPORTED_KEYS.filter(k=>k!==key)){assert(Q.hasPair(key,other));const scene=Q.scene(key,other);assert(scene.turns.length>=4);assert.deepEqual(Q.scene(other,key),scene);}
    }
    for(const scenes of Object.values(R.scenes))for(const scene of scenes){
      assert(!newIds.has(scene.id));newIds.add(scene.id);assert(scene.turns.length>=4&&scene.turns.length%2===0);
      scene.turns.forEach((b,i)=>{assert.equal(b.speaker,scene.pair[i%2]);assert.equal(b.listener.key,scene.pair[(i+1)%2]);assert(Q.POSES.includes(b.pose)&&Q.MOODS.includes(b.mood));assert(!/[种连长对这吗帮个时样盘项静还]/u.test(b.line));assert(!/TODO|待補|undefined|\$\{|<|>/u.test(b.line));assert(Array.from(b.line).length<=50);if(b.line.includes('妾身'))assert.equal(b.speaker,'hancock');if(b.line.includes('草帽當家的'))assert.equal(b.speaker,'law');if(b.line.includes('老夫'))assert.equal(b.speaker,'jinbe');});
    }
    assert.equal(R.events.length,4);for(const e of R.events){assert.equal(e.currencyReward,0);assert(e.steps.some(s=>s.kind==='act'&&s.clip==='work'));assert(D.eventById[e.id]);}
    for(const [a,b,first] of [['sabo','usopp','usopp'],['sabo','chopper','chopper'],['law','usopp','usopp'],['hancock','sanji','sanji'],['hancock','chopper','chopper']])assert.equal(Q.scene(a,b).turns[0].speaker,first,'Authored question/answer voice order survives reverse encounters');
  });
  await check('four-default-dormant-despite-forged-owned-and-placed',async()=>{
    for(const key of R.RESERVED_KEYS){const f=fixture({owned:[key,'luffy']});f.tick();assert.deepEqual(f.controller.snapshot().ownedCharacterIds,[id('luffy')]);assert.equal((await f.controller.interact(key,'gift')).ok,false);assert.equal((await f.controller.assignWork(key)).ok,false);assert(!f.controller.getEventPool().some(e=>e.requiredCharacters.includes(key)));assert(!f.calls.some(c=>c.payload.itemId===id(key)));f.controller.dispose();}
  });
  await check('single-released-owned-placed-character-can-request-work',async()=>{
    for(const key of R.RESERVED_KEYS){const f=fixture({released:[...R.LEGACY_KEYS,key],owned:[key]});assert.deepEqual(f.controller.snapshot().ownedCharacterIds,[id(key)]);assert(f.controller.getEventPool().some(e=>e.id===`life-reserved-${key}-supplies`));const result=await f.controller.assignWork(key,'deck');assert.equal(result.error,'fixture_denied');assert.equal(f.calls[0].type,'work.reserve');assert.equal(f.calls[0].payload.itemId,id(key));assert(!f.controller.snapshot().ownedCharacterIds.some(v=>R.RESERVED_KEYS.filter(k=>k!==key).map(id).includes(v)));f.controller.dispose();}
  });
  await check('release-alone-ownership-alone-placement-alone-do-not-activate',async()=>{
    for(const key of R.RESERVED_KEYS)for(const test of [{released:[...R.LEGACY_KEYS,key],owned:[],placed:[key]},{released:[...R.LEGACY_KEYS,key],owned:[key],placed:[]},{released:R.LEGACY_KEYS,owned:[key],placed:[key]}]){const f=fixture(test);assert.equal((await f.controller.interact(key,'gift')).ok,false);assert.equal((await f.controller.assignWork(key)).ok,false);assert(!f.controller.getEventPool().some(e=>e.requiredCharacters.includes(key)));assert.equal(f.calls.length,0);f.controller.dispose();}
  });
  await check('same-life-revision-roster-update-and-old-server-fallback',()=>{
    const f=fixture({owned:['ace']});const snap={revision:10,ownedCharacterIds:[id('ace')],characters:{},jobs:[],pendingArrivals:[]};f.controller.sync({life:snap,releasedCharacterIds:R.LEGACY_KEYS.map(id)});assert.equal(f.controller.snapshot().ownedCharacterIds.length,0);
    f.controller.sync({life:snap,releasedCharacterIds:[...R.LEGACY_KEYS,'ace'].map(id),rosterRevision:2});assert.deepEqual(f.controller.snapshot().ownedCharacterIds,[id('ace')]);
    f.controller.sync({life:{...snap,revision:11}});assert.equal(f.controller.snapshot().ownedCharacterIds.length,0);assert.equal(f.calls.length,0);f.controller.dispose();
  });
  await check('68-exact-asset-paths-and-no-nonexistent-specialist-clips',()=>{
    const urls=[];for(const key of R.RESERVED_KEYS){urls.push(R.assetUrl(key,'portrait.webp'));for(const direction of M.DIRECTIONS){urls.push(M.atlasUrl(key,direction));urls.push(M.atlasUrl(key,direction,'acting_v4'));urls.push(A.url(key,'work',direction));}for(const clip of ['eat','rest','sleep','train'])urls.push(A.url(key,clip,'south'));for(const clip of ['medicine','cook','read','music','craft','helm']){assert.equal(A.supported(key,clip),false);assert.equal(A.url(key,clip,'south'),'');}}
    assert.equal(urls.length,68);assert.equal(new Set(urls).size,68);assert(urls.every(u=>u.includes('/reserved_v1/')&&u.endsWith('.webp')));assert.equal(R.assetUrl('ace','../portrait.webp'),'');assert.equal(R.assetUrl('luffy','portrait.webp'),'');
    assert.equal(M.atlasUrl('luffy','east'),'opui://launcher/images/launcher_room/motion_v4/luffy/east.webp');assert.equal(A.url('chopper','medicine','south'),'opui://launcher/images/launcher_room/life_v1/chopper/medicine-south.webp');
  });
  await check('browser-umd-global-order-and-hd-decoder-geometry',async()=>{
    const ctx={};ctx.globalThis=ctx;ctx.window=ctx;vm.createContext(ctx);for(const file of ['launcher-reserved-crew.js','launcher-room-dialogue.js','launcher-room-motion.js','launcher-life-data.js','launcher-life-actions.js','launcher-life.js'])vm.runInContext(read(file),ctx,{filename:file});assert.equal(ctx.OnePieceLifeData.characterKeys.length,14);assert.equal(ctx.OnePieceRoomDialogue.profile('ace').name,'艾斯');
    class Image {set src(value){this._src=value;this.naturalWidth=value.includes('/acting/')?2048:value.includes('/walk/')?1536:value.includes('/reserved_v1/')?1024:512;this.naturalHeight=value.includes('/walk/')?384:value.includes('/reserved_v1/')?256:128;if(this.onload)queueMicrotask(()=>this.onload());}get src(){return this._src;}async decode(){}}
    ctx.Image=Image;global.Image=Image;try{
      const motion=await ctx.OnePieceRoomMotion.preload('ace',Image).promise;const acting=await ctx.OnePieceRoomMotion.preloadActions('ace',Image).promise;assert.equal(Object.keys(motion.errors).length,0);assert.equal(Object.keys(acting.errors).length,0);
      const record=ctx.OnePieceLifeActions.preload('ace','work','south');await record.promise;assert(record.ready);assert.equal(record.cell,256);
      const drawCalls=[],canvas={width:0,height:0,getContext:()=>({clearRect(){},drawImage(...args){drawCalls.push(args);}})};ctx.OnePieceLifeActions.draw(canvas,'ace','work','south',900);assert.equal(canvas.width,256);assert.equal(drawCalls[0][1],768);assert.equal(drawCalls[0][3],256);
      const legacy=ctx.OnePieceLifeActions.preload('luffy','work','south');await legacy.promise;assert(legacy.ready);assert.equal(legacy.cell,128);
    }finally{delete global.Image;}
    const html=read('launcher.html');assert(html.indexOf('launcher-reserved-crew.js')<html.indexOf('launcher-room-dialogue.js'));
  });
  assert.deepEqual(bindings(),sourceSha256,'runtime remained stable while tests ran');
  const report={schema:'one-piece-launcher-reserved-client-qa/1',baselineCommit:'b8a459e8a5ed49aead8aee93b96a76728e02b537',ok:true,generatedAt:new Date().toISOString(),checks:checks.length,results:checks,sourceRoot:root,sourceSha256,sourceNormalizedSha256:Object.fromEntries(files.map(file=>[file,sha(read(file).replace(/\r\n/g,'\n'))])),sourceHashNormalization:'UTF-8 decoded text; replace CRLF (\\r\\n) with LF (\\n) only; no other changes.',testScriptSha256:sha(fs.readFileSync(__filename)),scope:'Isolated Node/VM controller, data and synthetic Image decoder contracts; no real account/DB writes, real asset decode, visual quality, human acceptance or deployment.',humanAcceptance:false};
  fs.writeFileSync(path.join(out,'CLIENT_RELEASE_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,checks:checks.length,out}));
})().catch(error=>{fs.writeFileSync(path.join(out,'CLIENT_RESERVED_QA_FAILURE.json'),JSON.stringify({ok:false,error:error.stack,checks},null,2));console.error(error.stack);process.exitCode=1;});
