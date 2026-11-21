'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const {createApp,countText,normalizeWish}=require('../server');
const {createStore,D1Store}=require('../storage');
const ADMIN='test-only-admin-token-0123456789';
async function fixture(t,overrides={}){
  const dir=fs.mkdtempSync(path.resolve(__dirname,'../../../backend-test-'));
  const env={STORAGE_MODE:'sqlite-local',SQLITE_PATH:path.join(dir,'wishes.sqlite'),ADMIN_TOKEN:ADMIN,ALLOWED_ORIGINS:'http://localhost:8080',SSE_POLL_MS:'20',...overrides};
  let app=await createApp(env);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let base=`http://127.0.0.1:${app.server.address().port}`;
  t.after(async()=>{if(app)await app.close();});
  return {get app(){return app;},get base(){return base;},env,async restart(){await app.close();app=await createApp(env);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${app.server.address().port}`;},async request(route,method='GET',body,admin=false){const res=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(admin?{Authorization:'Bearer '+ADMIN}:{})},...(body?{body:JSON.stringify(body)}:{})});return {res,body:await res.json()};}};
}
const sample=(suffix='a',extra={})=>({author:'測試賓客'+suffix,message:'仁鈞姮儒新婚快樂 💕',style:1,group:1,idempotencyKey:'test_submission_'+suffix,consent:true,...extra});
test('Unicode graphemes: Chinese, combined accents, family and skin-tone emoji share one rule',async()=>{
  assert.equal(countText('👨‍👩‍👧‍👦👍🏽e\u0301'),3);
  const thirty='👨‍👩‍👧‍👦'.repeat(30);
  const normalized=await normalizeWish(sample('emoji',{message:thirty}));assert.equal(normalized.graphemes,30);
  await assert.rejects(()=>normalizeWish(sample('too-long',{message:thirty+'中'})),/30/);
  assert.equal((await normalizeWish(sample('single',{message:'💕'}))).graphemes,1);
});
test('SQLite durable write, idempotency conflict, pagination and restart restore',async t=>{
  const f=await fixture(t),body=sample('persistent');
  const first=await f.request('/api/wishes','POST',body);assert.equal(first.res.status,201);assert.equal(first.body.persistent,true);
  const retry=await f.request('/api/wishes','POST',body);assert.equal(retry.res.status,200);assert.equal(retry.body.duplicate,true);assert.equal(retry.body.id,first.body.id);
  const conflict=await f.request('/api/wishes','POST',{...body,message:'另一則祝福'});assert.equal(conflict.res.status,409);
  for(let i=0;i<5;i++)assert.equal((await f.request('/api/wishes','POST',sample('page-'+i))).res.status,201);
  const page=await f.request('/api/wishes?limit=2');assert.equal(page.body.wishes.length,2);assert.equal(page.body.hasMore,true);
  const next=await f.request('/api/wishes?after='+page.body.wishes.at(-1).id);assert.equal(next.body.wishes.length,4);
  await f.restart();
  const restored=await f.request('/api/wishes');assert.equal(restored.body.wishes.length,6);assert.equal(restored.body.wishes[0].message,body.message);
  const rate=await f.request('/api/wishes','POST',{...body,idempotencyKey:'test_submission_new_after_restart'});assert.equal(rate.res.status,429);
});
test('JPEG upload auto-orients EXIF, strips metadata, crops square, and requires consent',async t=>{
  const f=await fixture(t);
  const red=await sharp({create:{width:320,height:360,channels:3,background:'#ff0000'}}).png().toBuffer();
  const input=await sharp({create:{width:640,height:360,channels:3,background:'#0000ff'}}).composite([{input:red,left:0,top:0}]).jpeg().withMetadata({orientation:6}).toBuffer();
  const avatar='data:image/jpeg;base64,'+input.toString('base64');
  assert.equal((await f.request('/api/wishes','POST',sample('no-consent',{avatar,consent:false}))).res.status,400);
  const saved=await f.request('/api/wishes','POST',sample('photo',{avatar}));assert.equal(saved.res.status,201);assert.ok(saved.body.wish.avatar_path);
  const response=await fetch(f.base+saved.body.wish.avatar_path),buffer=Buffer.from(await response.arrayBuffer()),meta=await sharp(buffer).metadata();
  assert.equal(response.headers.get('content-type'),'image/jpeg');assert.equal(meta.width,480);assert.equal(meta.height,480);assert.equal(meta.orientation,undefined);assert.ok(buffer.length<=153600);
  const top=await sharp(buffer).extract({left:240,top:60,width:1,height:1}).raw().toBuffer(),bottom=await sharp(buffer).extract({left:240,top:420,width:1,height:1}).raw().toBuffer();assert.ok(top[0]>top[2]+100,'EXIF rotation places red left half at top');assert.ok(bottom[2]>bottom[0]+100,'blue right half is below, not stretched sideways');
  const backup=await f.request('/api/admin/export.json','GET',null,true);assert.equal((await f.request('/api/admin/import','POST',backup.body,true)).res.status,200,'avatar backup reimport is idempotent');
  await f.request('/api/admin/wishes/'+saved.body.id,'PATCH',{moderation_status:'hidden'},true);
  assert.equal((await fetch(f.base+saved.body.wish.avatar_path)).status,404);
  assert.equal((await fetch(f.base+'/api/admin/avatars/'+saved.body.id,{headers:{Authorization:'Bearer '+ADMIN}})).status,200);
  assert.equal((await f.request('/api/wishes','POST',sample('fake',{avatar:'data:image/jpeg;base64,YmFk'}))).res.status,400);
  assert.equal((await f.request('/api/wishes','POST',sample('png',{avatar:'data:image/png;base64,YmFk'}))).res.status,400);
});
test('moderation authorization, hidden records, CSV safety and JSON reimport',async t=>{
  const f=await fixture(t);
  const saved=await f.request('/api/wishes','POST',sample('moderate',{author:'=1+1',message:'永浴愛河'})),id=saved.body.id;
  assert.equal((await f.request('/api/admin/wishes')).res.status,401);
  assert.equal((await f.request('/api/admin/wishes/'+id,'PATCH',{moderation_status:'hidden'})).res.status,401);
  assert.equal((await f.request('/api/admin/wishes/'+id,'PATCH',{moderation_status:'hidden'},true)).res.status,200);
  assert.equal((await f.request('/api/wishes')).body.wishes.length,0);
  assert.equal((await f.request('/api/admin/wishes','GET',null,true)).body.wishes.length,1);
  const csv=await fetch(f.base+'/api/admin/export.csv',{headers:{Authorization:'Bearer '+ADMIN}});assert.equal(csv.status,200);assert.match(await csv.text(),/'=1\+1/);
  const backup=await f.request('/api/admin/export.json','GET',null,true);assert.equal(backup.body.wishes.length,1);assert.equal(backup.body.wishes[0].moderation_status,'hidden');
  const imported=await f.request('/api/admin/import','POST',backup.body,true);assert.equal(imported.res.status,200);assert.equal((await f.request('/api/admin/wishes','GET',null,true)).body.wishes.length,1);
  const restore=await f.request('/api/admin/wishes/'+id,'PATCH',{moderation_status:'approved'},true);assert.equal(restore.res.status,200);assert.equal((await f.request('/api/wishes')).body.wishes.length,1);
});
test('five simultaneous guest submissions persist in order; SSE replay cursor deduplicates',async t=>{
  const f=await fixture(t),abort=new AbortController();
  const response=await fetch(f.base+'/api/stream?cursor=0',{signal:abort.signal}),reader=response.body.getReader(),decoder=new TextDecoder();
  let stream='';
  const submissions=await Promise.all(Array.from({length:5},(_,i)=>f.request('/api/wishes','POST',sample('five-'+i))));
  for(const s of submissions)assert.equal(s.res.status,201);
  const deadline=setTimeout(()=>abort.abort(),8000);
  try{while((stream.match(/event: wish/g)||[]).length<5){const chunk=await reader.read();if(chunk.done)break;stream+=decoder.decode(chunk.value,{stream:true});}}
  finally{clearTimeout(deadline);abort.abort();await reader.cancel().catch(()=>{});}
  const events=stream.split('\n\n').filter(s=>s.includes('event: wish')).map(s=>({seq:Number(s.match(/id: (\d+)/)[1]),wish:JSON.parse(s.match(/data: (.*)/)[1])}));
  assert.equal(events.length,5);assert.deepEqual(events.map(e=>e.wish.id),[1,2,3,4,5]);assert.equal(new Set(events.map(e=>e.seq)).size,5);
  const sixth=await f.request('/api/wishes','POST',sample('sixth'));
  const reconnectAbort=new AbortController(),reconnect=await fetch(f.base+'/api/stream?cursor=0',{headers:{'Last-Event-ID':String(events.at(-1).seq)},signal:reconnectAbort.signal}),reReader=reconnect.body.getReader();let replay='';const timeout=setTimeout(()=>reconnectAbort.abort(),8000);
  try{while(!replay.includes('event: wish')){const c=await reReader.read();if(c.done)break;replay+=decoder.decode(c.value,{stream:true});}}finally{clearTimeout(timeout);reconnectAbort.abort();await reReader.cancel().catch(()=>{});}
  assert.equal((replay.match(/event: wish/g)||[]).length,1);assert.match(replay,new RegExp('"id":'+sixth.body.id));
});
test('database constraints reject a 31-character count and invalid group directly',async t=>{
  const f=await fixture(t);const sql='INSERT INTO wishes(guest_name,group_number,blessing_text,blessing_grapheme_count,style_id,moderation_status,created_at,updated_at,submission_key,request_hash,client_hash) VALUES(?,?,?,?,1,\'approved\',1,1,?,?,?)';
  await assert.rejects(()=>f.app.store.query(sql,['測試',1,'中'.repeat(31),31,'db_constraint_long','hash','hash']),/CHECK/);
  await assert.rejects(()=>f.app.store.query(sql,['測試',16,'祝福',2,'db_constraint_group','hash','hash']),/CHECK/);
});
test('production cannot silently use local or missing D1 storage',async()=>{
  await assert.rejects(()=>createStore({STORAGE_MODE:'sqlite-local',SQLITE_PATH:'unused.sqlite',RENDER:'true'}),/Render requires D1/);
  await assert.rejects(()=>createStore({}),/Missing CLOUDFLARE_ACCOUNT_ID/);
});
test('remote playback is authorized, idempotent, paginated and durable without stale commands on a new TV',async t=>{
  const f=await fixture(t);
  const initial=await f.request('/api/playback');assert.equal(initial.res.status,200);assert.equal(initial.body.paused,false);assert.equal(initial.body.latest,0);assert.deepEqual(initial.body.commands,[]);
  const command=(action,key='test_control_'+action)=>({action,requestId:key});
  assert.equal((await f.request('/api/admin/playback')).res.status,401);
  assert.equal((await f.request('/api/admin/playback','POST',command('pause'))).res.status,401);
  assert.equal((await f.request('/api/admin/playback','POST',command('delete-all'),true)).res.status,400);
  assert.equal((await f.request('/api/admin/playback','POST',{action:'next',requestId:'short'},true)).res.status,400);
  const pause=await f.request('/api/admin/playback','POST',command('pause'),true);assert.equal(pause.res.status,201);assert.equal(pause.body.state.paused,true);
  const duplicate=await f.request('/api/admin/playback','POST',command('pause'),true);assert.equal(duplicate.res.status,200);assert.equal(duplicate.body.duplicate,true);assert.equal(duplicate.body.command.id,pause.body.command.id);
  assert.equal((await f.request('/api/admin/playback','POST',command('resume','test_control_pause'),true)).res.status,409);
  for(const action of ['next','prev','replay','resume'])assert.equal((await f.request('/api/admin/playback','POST',command(action),true)).res.status,201);
  const page=await f.request('/api/playback?after=0&limit=2');assert.equal(page.body.latest,5);assert.equal(page.body.hasMore,true);assert.deepEqual(page.body.commands.map(c=>c.action),['pause','next']);assert.equal(page.body.nextCursor,2);
  const rest=await f.request('/api/playback?after='+page.body.nextCursor);assert.deepEqual(rest.body.commands.map(c=>c.action),['prev','replay','resume']);assert.equal(rest.body.nextCursor,5);assert.equal(rest.body.hasMore,false);
  const freshTV=await f.request('/api/playback');assert.equal(freshTV.body.paused,false);assert.equal(freshTV.body.latest,5);assert.deepEqual(freshTV.body.commands,[],'Fresh TV skips old next/prev/replay presses');
  await f.app.store.query('INSERT INTO playback_commands(action,request_key,created_at) VALUES(?,?,?)',['next','test_control_expired',Date.now()-120000]);
  const expired=await f.request('/api/playback?after=5');assert.deepEqual(expired.body.commands,[]);assert.equal(expired.body.nextCursor,6,'Expired transient commands still advance the cursor');
  await f.request('/api/admin/playback','POST',command('pause','test_control_pause_restart'),true);await f.restart();
  const restored=await f.request('/api/playback');assert.equal(restored.body.paused,true);assert.equal(restored.body.latest,7);assert.deepEqual(restored.body.commands,[]);assert.equal((await f.request('/api/wishes')).body.wishes.length,0,'Playback commands never modify guest records');
});
test('D1 adapter sends parameterized REST batch and never interpolates guest input',async()=>{
  const store=new D1Store({CLOUDFLARE_ACCOUNT_ID:'account',CLOUDFLARE_DATABASE_ID:'database',CLOUDFLARE_API_TOKEN:'test-secret'}),original=global.fetch,seen=[];
  global.fetch=async(url,options)=>{seen.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({success:true,result:[{success:true,results:[]}]})};};
  try{await store.batch([{sql:'INSERT INTO wishes(guest_name) VALUES(?)',params:["guest'); DROP TABLE wishes; --"]}]);assert.equal(seen[0].body.batch[0].params[0],"guest'); DROP TABLE wishes; --");assert.equal(seen[0].body.batch[0].sql,'INSERT INTO wishes(guest_name) VALUES(?)');}
  finally{global.fetch=original;}
});
test('real D1 integration read-back (requires explicit authorized credentials)',{skip:process.env.RUN_D1_INTEGRATION!=='1'?'Cloudflare login/token unavailable; real D1 not claimed':false},async()=>{
  const store=new D1Store(process.env),result=await store.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('wishes','avatars','wish_events') ORDER BY name");
  assert.equal(result[0].results.length,3);
});
