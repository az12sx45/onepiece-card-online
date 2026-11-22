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
async function fetch(url,options={}){
  try{return await globalThis.fetch(url,{...options,headers:{Connection:'close',...options.headers}});}
  catch(error){console.error('Local HTTP fixture fetch failed:',JSON.stringify({url,code:error.cause?.code,cause:error.cause?.message,localPort:error.cause?.socket?.localPort,remotePort:error.cause?.socket?.remotePort}));throw error;}
}
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
test('health advertises avatar_gender support and the required choice before a new submission',async t=>{
  const f=await fixture(t),health=await f.request('/health');
  assert.equal(health.status,200);assert.equal(health.body.avatar_gender,true);assert.equal(health.body.avatar_gender_required,true);assert.equal(health.body.persistent,true);assert.equal(health.body.writable,true);
});
test('legacy/import normalization preserves unspecified hashes and validates the gender enum',async()=>{
  const input=guest('hash'),oldHash=sha(JSON.stringify({author:input.author,message:input.message,style:input.style,group:input.group,avatar:null}));
  assert.equal((await normalizeWish(input)).avatarGender,'unspecified');
  assert.equal((await normalizeWish(input)).requestHash,oldHash);
  assert.equal((await normalizeWish({...input,avatar_gender:'unspecified'})).requestHash,oldHash);
  const male=await normalizeWish({...input,avatar_gender:'male'}),female=await normalizeWish({...input,avatar_gender:'female'});
  assert.notEqual(male.requestHash,oldHash);assert.notEqual(male.requestHash,female.requestHash);
  for(const avatar_gender of [null,'','other','MALE',1,{},'男'])await assert.rejects(()=>normalizeWish({...input,avatar_gender}),/預設頭像/);
});
test('new submissions require male or female even with a selfie; invalid choices write no rows, avatars or events',async t=>{
  const f=await fixture(t),photo=await sharp({create:{width:480,height:480,channels:3,background:'#e0cdbb'}}).jpeg().toBuffer();
  const avatar='data:image/jpeg;base64,'+photo.toString('base64'),snapshot=()=>sqlRows(f.app.store,'SELECT (SELECT COUNT(*) FROM wishes) AS wishes,(SELECT COUNT(*) FROM avatars) AS avatars,(SELECT COUNT(*) FROM wish_events) AS events');
  const before=await snapshot();
  for(const withPhoto of [false,true])for(const avatar_gender of [undefined,'unspecified','',null]){
    const result=await f.request('/api/wishes','POST',guest('required_'+withPhoto+'_'+String(avatar_gender),{author:'必填測試',avatar_gender,...(withPhoto?{avatar}:{})}));
    assert.equal(result.status,400);assert.match(result.body.error,/男生或女生|預設頭像/);
    if(avatar_gender===undefined||avatar_gender==='unspecified')assert.equal(result.body.error_code,'GENDER_REQUIRED');
    assert.deepEqual(await snapshot(),before,'rejected choice must not insert any partial record');
  }
  for(const [i,avatar_gender] of ['male','female'].entries()){
    const result=await f.request('/api/wishes','POST',guest('accepted_'+i,{avatar_gender,...(i?{avatar}:{})}));
    assert.equal(result.status,201);assert.equal(result.body.wish.avatar_gender,avatar_gender);assert.equal(Boolean(result.body.wish.avatar_path),i===1);
  }
  assert.deepEqual(await snapshot(),[{wishes:2,avatars:1,events:2}]);
});
test('v2 database migrates without rewriting guests, avatars, events or playback; reruns and old UUID retries survive restart',async t=>{
  const dir=fs.mkdtempSync(path.resolve(__dirname,'../../../avatar-gender-legacy-')),file=path.join(dir,'v2.sqlite'),SQL=await initSqlJs(),db=new SQL.Database();
  for(const migration of MIGRATIONS.filter(m=>m.name<'0003'))db.run(migration.sql);
  const image=await sharp({create:{width:480,height:480,channels:3,background:'#c9989d'}}).jpeg().toBuffer(),input=guest('legacy'),oldHash=sha(JSON.stringify({author:input.author,message:input.message,style:input.style,group:input.group,avatar:null}));
  const oldPhotoInput=guest('photo',{author:'舊照片賓客',message:'百年好合',group:2,style:1,idempotencyKey:'legacy_avatar_record',avatar:'data:image/jpeg;base64,'+image.toString('base64')}),oldPhoto=await normalizeWish(oldPhotoInput);
  db.run('INSERT INTO avatars VALUES(?,?,?,?,480,480,?)',[oldPhoto.image.id,oldPhoto.image.base64,'image/jpeg',oldPhoto.image.bytes,1234]);
  const insert="INSERT INTO wishes(id,guest_name,group_number,blessing_text,blessing_grapheme_count,avatar_id,style_id,moderation_status,created_at,updated_at,submission_key,request_hash,client_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)";
  db.run(insert,[17,input.author,input.group,input.message,7,null,input.style,'hidden',1234,2345,input.idempotencyKey,oldHash,'legacy-client-hash']);
  db.run(insert,[23,oldPhotoInput.author,2,'百年好合',4,oldPhoto.image.id,1,'approved',3456,3456,'legacy_avatar_record',oldPhoto.requestHash,'legacy-avatar-client']);
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
  for(const body of [oldPhotoInput,{...oldPhotoInput,avatar_gender:'unspecified'}]){const result=await f.request('/api/wishes','POST',body);assert.equal(result.status,200);assert.equal(result.body.id,23);assert.equal(result.body.duplicate,true);assert.ok(result.body.wish.avatar_path);}
  assert.equal((await f.request('/api/wishes','POST',{...input,avatar_gender:'male'})).status,409);
  assert.equal((await f.request('/api/wishes','POST',{...input,message:'另一則祝福'})).status,409);
  await assert.rejects(()=>f.app.store.query('UPDATE wishes SET avatar_gender=? WHERE id=17',['other']),/CHECK/);
  await checkPreserved();
});
test('unknown legacy pending keeps its UUID: changed payload conflicts with a saved receipt, or creates one valid new record',async t=>{
  const f=await fixture(t),old=guest('pending_saved',{author:'舊待確認',style:8}),upgrade={...old,avatar_gender:'female',style:1};
  assert.equal((await f.request('/api/admin/import','POST',{wishes:[{...old,submission_key:old.idempotencyKey}]},true)).status,200);
  const snapshot=()=>sqlRows(f.app.store,'SELECT id,style_id,avatar_gender,request_hash FROM wishes ORDER BY id'),before=await snapshot();
  assert.equal((await f.request('/api/wishes','POST',upgrade)).status,409);
  const receipt=await f.request('/api/wishes','POST',old);assert.equal(receipt.status,200);assert.equal(receipt.body.duplicate,true);assert.equal(receipt.body.wish.style,8);assert.equal(receipt.body.wish.avatar_gender,'unspecified');assert.deepEqual(await snapshot(),before);
  const absent=guest('pending_absent',{author:'未存待確認',style:9}),required=await f.request('/api/wishes','POST',absent);
  assert.equal(required.status,400);assert.equal(required.body.error_code,'GENDER_REQUIRED');assert.deepEqual(await snapshot(),before);
  const replacement={...absent,avatar_gender:'male',style:1},saved=await f.request('/api/wishes','POST',replacement);
  assert.equal(saved.status,201);assert.equal(saved.body.wish.style,1);assert.equal(saved.body.wish.avatar_gender,'male');
  const retry=await f.request('/api/wishes','POST',replacement);assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);assert.equal(retry.body.id,saved.body.id);assert.equal((await snapshot()).length,2);
  assert.equal((await f.request('/api/wishes','POST',absent)).status,409,'old body cannot be mistaken for the new saved receipt');
});
test('a competing write after UUID lookup returns 409 rather than claiming another payload as a receipt',async t=>{
  const f=await fixture(t),input=guest('race',{avatar_gender:'male'}),competing={...input,avatar_gender:'female'},wish=await normalizeWish(competing);
  const batch=f.app.store.batch.bind(f.app.store);let injected=false;
  f.app.store.batch=async statements=>{
    if(!injected&&statements.some(s=>s.sql.startsWith('INSERT OR IGNORE INTO wishes('))){
      injected=true;
      // Model a second D1 instance winning the unique submission_key between
      // this instance's SELECT and INSERT. The actual local SQLite constraint
      // and the public API's post-insert hash read-back still perform the check.
      await batch([{sql:'INSERT INTO wishes(guest_name,group_number,blessing_text,blessing_grapheme_count,avatar_gender,style_id,moderation_status,created_at,updated_at,submission_key,request_hash,client_hash) VALUES(?,?,?,?,?,?,\'approved\',1,1,?,?,?)',params:[wish.author,wish.group,wish.message,wish.graphemes,wish.avatarGender,wish.style,wish.key,wish.requestHash,'local-race-winner']}]);
    }
    return batch(statements);
  };
  assert.equal((await f.request('/api/wishes','POST',input)).status,409);assert.equal(injected,true);
  const saved=(await f.request('/api/wishes')).body.wishes;assert.equal(saved.length,1);assert.equal(saved[0].avatar_gender,'female');
  const receipt=await f.request('/api/wishes','POST',competing);assert.equal(receipt.status,200);assert.equal(receipt.body.duplicate,true);assert.equal(receipt.body.id,saved[0].id);
});
test('gender persists through API, SSE, restart, CSV and JSON restore; v2 backups without it still import',async t=>{
  const f=await fixture(t),abort=new AbortController(),response=await fetch(f.base+'/api/stream?cursor=0',{signal:abort.signal}),reader=response.body.getReader(),decoder=new TextDecoder();
  const photo=await sharp({create:{width:480,height:480,channels:3,background:'#a6b199'}}).jpeg().toBuffer();
  const inputs=[guest('male',{avatar_gender:'male'}),guest('female',{avatar_gender:'female',avatar:'data:image/jpeg;base64,'+photo.toString('base64')})];
  for(const input of inputs){const result=await f.request('/api/wishes','POST',input);assert.equal(result.status,201);assert.equal(result.body.wish.avatar_gender,input.avatar_gender||'unspecified');}
  assert.equal((await f.request('/api/admin/import','POST',{wishes:[guest('default')]},true)).status,200,'authenticated old backup import may retain unspecified');
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
