'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const initSqlJs=require('sql.js');
const sharp=require('sharp');
const {createApp,normalizeWish}=require('../server');
const {MIGRATIONS}=require('../storage');
const ADMIN='test-only-avatar-admin-token-0123456789';
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const guest=(suffix,extra={})=>({author:'測試'+suffix,message:'新婚快樂 💕',style:2,group:3,idempotencyKey:'avatar_gender_'+suffix,consent:true,...extra});
async function fixture(t,{file,...overrides}={}){
  if(!file)file=path.join(fs.mkdtempSync(path.resolve(__dirname,'../../../avatar-gender-test-')),'wishes.sqlite');
  const env={STORAGE_MODE:'sqlite-local',SQLITE_PATH:file,ADMIN_TOKEN:ADMIN,ALLOWED_ORIGINS:'http://localhost:8080',SSE_POLL_MS:'20',RATE_COOLDOWN_MS:'0',...overrides};
  let app=await createApp(env),base;
  const listen=async()=>{await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${app.server.address().port}`;};await listen();
  t.after(async()=>app.close());
  return {get app(){return app;},get base(){return base;},async restart(){await app.close();app=await createApp(env);await listen();},async request(route,method='GET',body,admin=false){const response=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(admin?{Authorization:'Bearer '+ADMIN}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};}};
}
async function sqlRows(store,sql,params=[]){return (await store.query(sql,params))[0].results;}
test('health advertises avatar_gender capability for clients before a gender-aware submission',async t=>{
  const f=await fixture(t),health=await f.request('/health');
  assert.equal(health.status,200);assert.equal(health.body.avatar_gender,true);assert.equal(health.body.persistent,true);assert.equal(health.body.writable,true);
});
test('avatar gender is optional, enum validated, and unspecified preserves historical submission hashes',async()=>{
  const input=guest('hash'),oldHash=sha(JSON.stringify({author:input.author,message:input.message,style:input.style,group:input.group,avatar:null}));
  assert.equal((await normalizeWish(input)).avatarGender,'unspecified');
  assert.equal((await normalizeWish(input)).requestHash,oldHash);
  assert.equal((await normalizeWish({...input,avatar_gender:'unspecified'})).requestHash,oldHash);
  const male=await normalizeWish({...input,avatar_gender:'male'}),female=await normalizeWish({...input,avatar_gender:'female'});
  assert.notEqual(male.requestHash,oldHash);assert.notEqual(male.requestHash,female.requestHash);
  for(const avatar_gender of [null,'','other','MALE',1,{},'男'])await assert.rejects(()=>normalizeWish({...input,avatar_gender}),/預設頭像/);
});
test('v2 database migrates without rewriting guests, avatars, events or playback; reruns and old UUID retries survive restart',async t=>{
  const dir=fs.mkdtempSync(path.resolve(__dirname,'../../../avatar-gender-legacy-')),file=path.join(dir,'v2.sqlite'),SQL=await initSqlJs(),db=new SQL.Database();
  for(const migration of MIGRATIONS.filter(m=>m.name<'0003'))db.run(migration.sql);
  const image=await sharp({create:{width:480,height:480,channels:3,background:'#c9989d'}}).jpeg().toBuffer(),avatarId=sha(image),input=guest('legacy'),oldHash=sha(JSON.stringify({author:input.author,message:input.message,style:input.style,group:input.group,avatar:null}));
  db.run('INSERT INTO avatars VALUES(?,?,?,?,480,480,?)',[avatarId,image.toString('base64'),'image/jpeg',image.length,1234]);
  const insert="INSERT INTO wishes(id,guest_name,group_number,blessing_text,blessing_grapheme_count,avatar_id,style_id,moderation_status,created_at,updated_at,submission_key,request_hash,client_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)";
  db.run(insert,[17,input.author,input.group,input.message,7,null,input.style,'hidden',1234,2345,input.idempotencyKey,oldHash,'legacy-client-hash']);
  db.run(insert,[23,'舊照片賓客',2,'百年好合',4,avatarId,1,'approved',3456,3456,'legacy_avatar_record','preserved-avatar-hash','legacy-avatar-client']);
  db.run('INSERT INTO playback_commands(action,request_key,created_at) VALUES(?,?,?)',['pause','legacy_playback_pause',4567]);
  const tables=['wishes','avatars','wish_events','playback_state','playback_commands'];
  const before=Object.fromEntries(tables.map(table=>[table,db.exec('SELECT * FROM '+table)[0]]));
  fs.writeFileSync(file,Buffer.from(db.export()));db.close();
  const f=await fixture(t,{file});
  const checkPreserved=async()=>{
    for(const table of tables){const actual=await sqlRows(f.app.store,'SELECT * FROM '+table),expected=before[table];assert.deepEqual(actual.map(row=>expected.columns.map(key=>row[key])),expected.values,table+' old columns preserved');}
    assert.deepEqual((await sqlRows(f.app.store,'SELECT id,avatar_gender FROM wishes ORDER BY id')).map(row=>[row.id,row.avatar_gender]),[[17,'unspecified'],[23,'unspecified']]);
    assert.equal((await sqlRows(f.app.store,'PRAGMA table_info(wishes)')).filter(c=>c.name==='avatar_gender').length,1);
  };
  await checkPreserved();await f.app.store.migrate();await f.app.store.migrate();await checkPreserved();await f.restart();await checkPreserved();
  for(const body of [input,{...input,avatar_gender:'unspecified'}]){const result=await f.request('/api/wishes','POST',body);assert.equal(result.status,200);assert.equal(result.body.id,17);assert.equal(result.body.duplicate,true);assert.equal(result.body.wish.moderation_status,'hidden');assert.equal(result.body.wish.avatar_gender,'unspecified');}
  assert.equal((await f.request('/api/wishes','POST',{...input,avatar_gender:'male'})).status,409);
  assert.equal((await f.request('/api/wishes','POST',{...input,message:'另一則祝福'})).status,409);
  await assert.rejects(()=>f.app.store.query('UPDATE wishes SET avatar_gender=? WHERE id=17',['other']),/CHECK/);
  await checkPreserved();
});
test('gender persists through API, SSE, restart, CSV and JSON restore; v2 backups without it still import',async t=>{
  const f=await fixture(t),abort=new AbortController(),response=await fetch(f.base+'/api/stream?cursor=0',{signal:abort.signal}),reader=response.body.getReader(),decoder=new TextDecoder();
  const photo=await sharp({create:{width:480,height:480,channels:3,background:'#a6b199'}}).jpeg().toBuffer();
  const inputs=[guest('male',{avatar_gender:'male'}),guest('female',{avatar_gender:'female',avatar:'data:image/jpeg;base64,'+photo.toString('base64')}),guest('default')];
  for(const input of inputs){const result=await f.request('/api/wishes','POST',input);assert.equal(result.status,201);assert.equal(result.body.wish.avatar_gender,input.avatar_gender||'unspecified');}
  let stream='';const timeout=setTimeout(()=>abort.abort(),8000);
  try{while((stream.match(/event: wish/g)||[]).length<3){const chunk=await reader.read();if(chunk.done)break;stream+=decoder.decode(chunk.value,{stream:true});}}
  finally{clearTimeout(timeout);abort.abort();await reader.cancel().catch(()=>{});}
  const events=stream.split('\n\n').filter(part=>part.includes('event: wish')).map(part=>JSON.parse(part.match(/data: (.*)/)[1]));
  assert.deepEqual(events.map(w=>w.avatar_gender),['male','female','unspecified']);
  const retry=await f.request('/api/wishes','POST',inputs[0]);assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);
  assert.equal((await f.request('/api/wishes','POST',{...inputs[0],avatar_gender:'female'})).status,409);
  assert.equal((await f.request('/api/wishes','POST',guest('bad',{avatar_gender:'invalid'}))).status,400);
  const rowsBefore=(await f.request('/api/wishes')).body.wishes;await f.restart();assert.deepEqual((await f.request('/api/wishes')).body.wishes,rowsBefore);
  const csvResponse=await fetch(f.base+'/api/admin/export.csv',{headers:{Authorization:'Bearer '+ADMIN}}),csv=await csvResponse.text();assert.equal(csvResponse.status,200);assert.match(csv.split('\r\n')[0],/avatar_path,avatar_gender,created_at/);assert.match(csv,/"male"/);assert.match(csv,/"female"/);assert.match(csv,/"unspecified"/);
  const backup=await f.request('/api/admin/export.json','GET',null,true);assert.deepEqual(backup.body.wishes.map(w=>w.avatar_gender),['male','female','unspecified']);
  const restored=await fixture(t);assert.equal((await restored.request('/api/admin/import','POST',backup.body,true)).status,200);assert.equal((await restored.request('/api/admin/import','POST',backup.body,true)).status,200);
  const restoredRows=(await restored.request('/api/wishes')).body.wishes;assert.equal(restoredRows.length,3);assert.deepEqual(restoredRows.map(w=>w.avatar_gender),['male','female','unspecified']);assert.ok(restoredRows[1].avatar_path);
  const restoredImage=Buffer.from(await (await fetch(restored.base+restoredRows[1].avatar_path)).arrayBuffer()),sourceImage=Buffer.from(backup.body.wishes[1].avatar.split(',')[1],'base64');assert.equal(sha(restoredImage),sha(sourceImage),'restored canonical avatar bytes preserved');
  const v2Backup={version:2,wishes:backup.body.wishes.filter(w=>w.avatar_gender==='unspecified').map(({avatar_gender,...wish})=>wish)};
  assert.equal((await f.request('/api/admin/import','POST',v2Backup,true)).status,200,'old backup deduplicates existing default gender');
  const v2Restored=await fixture(t);assert.equal((await v2Restored.request('/api/admin/import','POST',v2Backup,true)).status,200);assert.equal((await v2Restored.request('/api/wishes')).body.wishes[0].avatar_gender,'unspecified');
});
