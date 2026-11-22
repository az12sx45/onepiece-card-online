'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const initSqlJs=require('sql.js');
const sharp=require('sharp');
const {createApp,normalizeWish}=require('../server');
const {MIGRATIONS,ensureDeletionSchema}=require('../storage');
const {runSetup}=require('../scripts/d1-setup');
const ADMIN='hard-delete-local-test-admin-token-0123456789';
const sample=(name,extra={})=>({author:'永刪測試'+name,message:'只存在於本機的祝福💕',group:2,style:1,avatar_gender:'female',consent:true,idempotencyKey:'hard_delete_key_'+Buffer.from(name).toString('hex'),...extra});
const sqlRows=async(store,sql,params=[])=>(await store.query(sql,params))[0].results;
async function request(base,route,method='GET',body,admin=false,headers={}){
  const res=await fetch(base+route,{method,headers:{Connection:'close',...(body?{'Content-Type':'application/json'}:{}),...(admin?{Authorization:'Bearer '+ADMIN}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
  return {status:res.status,headers:res.headers,body:await res.json()};
}
async function fixture(t){
  const dir=fs.mkdtempSync(path.resolve(__dirname,'../../../hard-delete-test-')),env={STORAGE_MODE:'sqlite-local',SQLITE_PATH:path.join(dir,'wishes.sqlite'),ADMIN_TOKEN:ADMIN,RATE_COOLDOWN_MS:'0',SSE_POLL_MS:'15'};
  let app,base;const start=async()=>{app=await createApp(env);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;};await start();t.after(async()=>app.close());
  return {dir,get app(){return app;},get base(){return base;},async restart(){await app.close();await start();},request:(...args)=>request(base,...args)};
}
async function photo(){return 'data:image/jpeg;base64,'+(await sharp({create:{width:480,height:480,channels:3,background:'#d7a0ac'}}).jpeg().toBuffer()).toString('base64');}
async function streamUntil(base,route,predicate,mutate,headers={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000),response=await fetch(base+route,{signal:controller.signal,headers:{Connection:'close',...headers}}),reader=response.body.getReader(),decoder=new TextDecoder();let text='';
  try{if(mutate)await mutate();while(true){const part=await reader.read();if(part.done)break;text+=decoder.decode(part.value,{stream:true});const frames=text.split('\n\n').filter(f=>f.includes('data: ')).map(f=>({type:f.match(/event: (.*)/)?.[1],seq:Number(f.match(/^id: (\d+)/m)?.[1]||0),data:JSON.parse(f.match(/data: (.*)/)[1])}));if(predicate(frames))return {frames,text};}throw Error('Stream ended before expected event');}
  finally{clearTimeout(timer);controller.abort();await reader.cancel().catch(()=>{});}
}

test('additive deletion schema starts through the D1 REST adapter without auto-migration, preserves legacy soft deletes and is repeatable',async()=>{
  const SQL=await initSqlJs(),db=new SQL.Database();db.run('PRAGMA foreign_keys=ON');for(const m of MIGRATIONS.filter(m=>m.name<'0004'))db.run(m.sql);
  db.run("INSERT INTO wishes(guest_name,group_number,blessing_text,blessing_grapheme_count,style_id,moderation_status,created_at,updated_at,submission_key,request_hash,client_hash) VALUES('舊軟刪資料',1,'保留舊資料',5,1,'deleted',1,2,'legacy_deleted_before_v9','request','client')");
  const tables=['wishes','avatars','wish_events','playback_state','playback_commands'],snapshot=()=>Object.fromEntries(tables.map(name=>[name,db.exec('SELECT * FROM '+name)])),before=snapshot(),original=global.fetch,seen=[];let app;
  global.fetch=async(url,options)=>{if(!String(url).startsWith('https://api.cloudflare.com/'))return original(url,options);const payload=JSON.parse(options.body);seen.push(payload.sql);assert.ok(payload.sql&&!payload.batch,'startup uses additive schema queries only');const result=db.exec(payload.sql).map(r=>({success:true,results:r.values.map(v=>Object.fromEntries(r.columns.map((c,i)=>[c,v[i]])))}));return {ok:true,json:async()=>({success:true,result})};};
  try{app=await createApp({STORAGE_MODE:'d1',CLOUDFLARE_ACCOUNT_ID:'local-mock-account',CLOUDFLARE_DATABASE_ID:'local-mock-database',CLOUDFLARE_API_TOKEN:'local-only-not-a-real-token',ADMIN_TOKEN:ADMIN});await ensureDeletionSchema(app.store);await app.store.migrate();assert.deepEqual(snapshot(),before);assert.equal(db.exec('SELECT COUNT(*) FROM deleted_receipts')[0].values[0][0],0);assert.ok(seen.some(sql=>sql.includes('CREATE TABLE IF NOT EXISTS deleted_receipts')));assert.equal(db.exec('PRAGMA foreign_key_list(wish_events)')[0].values[0][2],'wishes');}
  finally{if(app)await app.close();global.fetch=original;db.close();}
});

test('hard DELETE requires authorization, advertises capability, accepts empty body and is idempotent without exposing deleted PII',async t=>{
  const f=await fixture(t),body=sample('授權',{author:'永久移除署名',message:'永久移除專屬祝福🌹'}),saved=await f.request('/api/wishes','POST',body),id=saved.body.id;
  assert.equal((await f.request('/health')).body.hard_delete,true);
  assert.equal((await f.request('/api/admin/wishes/'+id,'DELETE')).status,401);
  assert.equal((await f.request('/api/admin/wishes/'+id,'PATCH',{moderation_status:'deleted'})).status,401);
  assert.equal((await f.request('/api/admin/wishes/99999','DELETE',undefined,true)).status,404);
  const options=await fetch(f.base+'/api/admin/wishes/'+id,{method:'OPTIONS',headers:{Connection:'close'}});assert.equal(options.status,204);assert.match(options.headers.get('access-control-allow-methods'),/DELETE/);
  const removed=await f.request('/api/admin/wishes/'+id,'DELETE',undefined,true);assert.equal(removed.status,200);assert.deepEqual({...removed.body,cursor:0},{ok:true,id,deleted:true,duplicate:false,persistent:true,cursor:0});
  const retry=await f.request('/api/admin/wishes/'+id,'DELETE',undefined,true);assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);assert.equal(retry.body.cursor,removed.body.cursor);
  assert.deepEqual(await sqlRows(f.app.store,'SELECT * FROM wishes'),[]);assert.deepEqual(await sqlRows(f.app.store,'SELECT * FROM wish_events'),[]);
  const receipts=await sqlRows(f.app.store,'SELECT * FROM deleted_receipts');assert.deepEqual(Object.keys(receipts[0]).sort(),['wish_id','submission_key','deleted_at','event_seq'].sort());assert.equal(receipts[0].submission_key,body.idempotencyKey);
  assert.deepEqual((await f.request('/api/admin/wishes','GET',undefined,true)).body.wishes,[]);assert.deepEqual((await f.request('/api/wishes')).body.wishes,[]);
  const backup=await f.request('/api/admin/export.json','GET',undefined,true);assert.deepEqual(backup.body.wishes,[]);assert.ok(!JSON.stringify(backup.body).includes(body.author));assert.ok(!JSON.stringify(backup.body).includes(body.message));
  const csv=await fetch(f.base+'/api/admin/export.csv',{headers:{Connection:'close',Authorization:'Bearer '+ADMIN}});const text=await csv.text();assert.ok(!text.includes(body.author));assert.ok(!text.includes(body.message));
  for(const payload of [body,{...body,message:'修改內容也不能復活'},{idempotencyKey:body.idempotencyKey}]){const replay=await f.request('/api/wishes','POST',payload);assert.equal(replay.status,410);assert.equal(replay.body.error_code,'WISH_DELETED');}
  const headerRetry=await f.request('/api/wishes','POST',sample('新表面編號'),false,{'Idempotency-Key':body.idempotencyKey});assert.equal(headerRetry.status,410);
  assert.equal((await f.request('/api/admin/import','POST',{wishes:[{...body,submission_key:body.idempotencyKey}]},true)).status,410);
});

test('shared JPEG survives other approved/hidden/legacy-deleted references and is purged only after its final explicit deletion',async t=>{
  const f=await fixture(t),avatar=await photo(),a=await f.request('/api/wishes','POST',sample('同照甲',{avatar})),b=await f.request('/api/wishes','POST',sample('同照乙',{avatar}));
  const canonical=(await f.request('/api/admin/export.json','GET',undefined,true)).body.wishes[0].avatar;
  const c=await f.request('/api/admin/import','POST',{wishes:[sample('同照舊刪',{avatar:canonical,moderation_status:'deleted',submission_key:'shared_legacy_deleted_nonce'})]},true),third=c.body.ids[0];
  assert.equal((await sqlRows(f.app.store,'SELECT * FROM avatars')).length,1);await f.request('/api/admin/wishes/'+b.body.id,'PATCH',{moderation_status:'hidden'},true);
  assert.equal((await f.request('/api/admin/wishes/'+a.body.id,'DELETE',undefined,true)).status,200);assert.equal((await sqlRows(f.app.store,'SELECT * FROM avatars')).length,1);
  assert.equal((await fetch(f.base+'/api/admin/avatars/'+a.body.id,{headers:{Connection:'close',Authorization:'Bearer '+ADMIN}})).status,404);assert.equal((await fetch(f.base+'/api/admin/avatars/'+b.body.id,{headers:{Connection:'close',Authorization:'Bearer '+ADMIN}})).status,200);
  await f.request('/api/admin/wishes/'+b.body.id,'DELETE',undefined,true);assert.equal((await sqlRows(f.app.store,'SELECT * FROM avatars')).length,1,'legacy soft-delete is still a live reference');
  assert.equal((await f.request('/api/admin/wishes/'+third,'PATCH',{moderation_status:'deleted'},true)).status,200,'legacy PATCH follows hard delete even when status already deleted');assert.deepEqual(await sqlRows(f.app.store,'SELECT * FROM avatars'),[]);assert.deepEqual(await sqlRows(f.app.store,'PRAGMA foreign_key_check'),[]);
});

test('live and disconnected SSE receive a durable no-PII tombstone; all-deleted restart preserves cursor and never reuses IDs or event sequences',async t=>{
  const f=await fixture(t),a=await f.request('/api/wishes','POST',sample('串流甲')),b=await f.request('/api/wishes','POST',sample('串流乙')),before=(await f.request('/health')).body;
  let deletion;const live=await streamUntil(f.base,'/api/stream?cursor='+before.cursor,frames=>frames.some(e=>e.type==='reset'&&e.data.reason==='deleted'),async()=>{deletion=await f.request('/api/admin/wishes/'+b.body.id,'DELETE',undefined,true);});
  const tomb=live.frames.find(e=>e.type==='reset');assert.deepEqual(tomb.data,{reason:'deleted',id:b.body.id,status:'deleted',cursor:deletion.body.cursor});assert.equal(tomb.seq,deletion.body.cursor);assert.ok(!live.text.includes('串流乙'));
  await f.request('/api/admin/wishes/'+a.body.id,'DELETE',undefined,true);const high=(await f.request('/health')).body;assert.equal(high.latest,b.body.id);assert.ok(high.cursor>before.cursor);assert.equal((await sqlRows(f.app.store,'SELECT * FROM wish_events')).length,0);
  await f.restart();const restored=(await f.request('/health')).body;assert.equal(restored.latest,high.latest);assert.equal(restored.cursor,high.cursor);
  const replay=await streamUntil(f.base,'/api/stream?cursor=0',frames=>frames.filter(e=>e.type==='reset').length===2);assert.deepEqual(replay.frames.filter(e=>e.type==='reset').map(e=>e.data.id),[b.body.id,a.body.id]);assert.ok(!replay.text.includes('event: wish'));
  const next=await f.request('/api/wishes','POST',sample('串流丙'));assert.ok(next.body.id>b.body.id);const now=(await f.request('/health')).body;assert.ok(now.cursor>high.cursor);
  const legacy=await streamUntil(f.base,'/api/stream?after='+b.body.id,frames=>frames.some(e=>e.type==='wish'));assert.equal(legacy.frames.filter(e=>e.type==='reset').length,0,'legacy wish-id starting cursor also includes tombstones');assert.deepEqual(legacy.frames.filter(e=>e.type==='wish').map(e=>e.data.id),[next.body.id]);
  const native=await streamUntil(f.base,'/api/stream?cursor=0',frames=>frames.some(e=>e.type==='wish'),null,{'Last-Event-ID':String(high.cursor)});assert.deepEqual(native.frames.filter(e=>e.type==='wish').map(e=>e.data.id),[next.body.id]);assert.equal(native.frames.filter(e=>e.type==='reset').length,0);
  assert.equal((await f.request('/api/wishes','POST',sample('串流乙'))).status,410);
});

test('a failed atomic delete rolls back its receipt, event removal, wish and avatar together',async t=>{
  const f=await fixture(t),saved=await f.request('/api/wishes','POST',sample('交易回滾',{avatar:await photo()})),tables=['wishes','avatars','wish_events','deleted_receipts'];
  const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async name=>[name,await sqlRows(f.app.store,'SELECT * FROM '+name)])));
  const before=await snapshot(),original=f.app.store.batch.bind(f.app.store);
  f.app.store.batch=statements=>original([...statements,{sql:'INSERT INTO deliberately_missing_rollback_table VALUES(1)',params:[]}]);
  assert.equal((await f.request('/api/admin/wishes/'+saved.body.id,'DELETE',undefined,true)).status,503);f.app.store.batch=original;assert.deepEqual(await snapshot(),before);assert.equal((await f.request('/api/admin/wishes/'+saved.body.id,'DELETE',undefined,true)).status,200);
});

test('a tombstone racing the first lookup suppresses both image and wish writes, while the DB trigger rejects an unguarded old-server insertion',async t=>{
  const f=await fixture(t),body=sample('跨程序競態',{avatar:await photo()}),original=f.app.store.query.bind(f.app.store);let injected=false;
  f.app.store.query=async(sql,params=[])=>{const result=await original(sql,params);if(!injected&&sql==='SELECT * FROM wishes WHERE submission_key=?'&&params[0]===body.idempotencyKey){injected=true;await original('INSERT INTO deleted_receipts(wish_id,submission_key,deleted_at,event_seq) VALUES(?,?,?,?)',[777,body.idempotencyKey,Date.now(),888]);}return result;};
  const r=await f.request('/api/wishes','POST',body);f.app.store.query=original;assert.equal(r.status,410);assert.equal(injected,true);assert.deepEqual(await sqlRows(f.app.store,'SELECT * FROM avatars'),[]);assert.deepEqual(await sqlRows(f.app.store,'SELECT * FROM wishes'),[]);
  const wish=await normalizeWish(body);await assert.rejects(()=>f.app.store.query("INSERT INTO wishes(guest_name,group_number,blessing_text,blessing_grapheme_count,style_id,moderation_status,created_at,updated_at,submission_key,request_hash,client_hash) VALUES(?,?,?, ?,1,'approved',1,1,?,?,?)",[wish.author,wish.group,wish.message,wish.graphemes,wish.key,wish.requestHash,'client']),/WISH_DELETED/);
});

test('full database backup keeps only minimal tombstones and AUTOINCREMENT watermarks; rerunning migration does not purge old soft deletes',async t=>{
  const f=await fixture(t),old=sample('備份舊軟刪',{moderation_status:'deleted',submission_key:'backup_legacy_soft_deleted'});await f.request('/api/admin/import','POST',{wishes:[old]},true);const saved=await f.request('/api/wishes','POST',sample('備份永久刪'));await f.request('/api/admin/wishes/'+saved.body.id,'DELETE',undefined,true);const before=await sqlRows(f.app.store,'SELECT * FROM wishes');
  await runSetup(f.app.store,'migrate',null,()=>{});assert.deepEqual(await sqlRows(f.app.store,'SELECT * FROM wishes'),before);const file=path.join(f.dir,'private-backup.json');await runSetup(f.app.store,'backup',file,()=>{});const data=JSON.parse(fs.readFileSync(file,'utf8'));assert.equal(data.version,3);assert.equal(data.tables.deleted_receipts.length,1);assert.equal(data.tables.wishes.length,1);assert.equal(data.tables.wishes[0].moderation_status,'deleted');assert.ok(!JSON.stringify(data).includes('備份永久刪'));
  assert.ok(data.tables.sqlite_sequence.find(s=>s.name==='wishes').seq>=saved.body.id);assert.ok(data.tables.sqlite_sequence.find(s=>s.name==='wish_events').seq>=data.tables.deleted_receipts[0].event_seq);
});

test('incompatible pre-existing deletion receipt schema fails closed without touching legacy guests',async()=>{
  const SQL=await initSqlJs(),db=new SQL.Database();db.run("CREATE TABLE deleted_receipts(wish_id INTEGER PRIMARY KEY,wrong_field TEXT); CREATE TABLE keep_me(value TEXT); INSERT INTO keep_me VALUES('unchanged')");
  const store={async query(sql){return db.exec(sql).map(r=>({results:r.values.map(v=>Object.fromEntries(r.columns.map((c,i)=>[c,v[i]])))}));},async executeSchema(){throw Error('must not mutate incompatible schema');}};
  try{await assert.rejects(()=>ensureDeletionSchema(store),/incompatible/);assert.equal(db.exec('SELECT value FROM keep_me')[0].values[0][0],'unchanged');}finally{db.close();}
});
