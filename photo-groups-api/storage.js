'use strict';
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const MIGRATIONS = fs.readdirSync(path.join(__dirname,'migrations')).filter(name=>/^\d+_.*\.sql$/.test(name)).sort().map(name=>({name,sql:fs.readFileSync(path.join(__dirname,'migrations',name),'utf8')}));
async function deletionSchemaReady(store){
  const columns=(await store.query('PRAGMA table_info(deleted_receipts)'))[0]?.results||[];
  if(!columns.length)return false;
  const expected={wish_id:'INTEGER',submission_key:'TEXT',deleted_at:'INTEGER',event_seq:'INTEGER'};
  if(columns.length!==4||Object.entries(expected).some(([name,type])=>!columns.some(c=>c.name===name&&String(c.type).toUpperCase()===type&&(name==='wish_id'?c.pk===1:c.notnull===1))))throw new Error('Existing deletion receipt schema is incompatible; no guest records were changed.');
  const table=(await store.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='deleted_receipts'"))[0]?.results?.[0]?.sql||'';
  if(!/submission_key\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(table)||!/event_seq\s+INTEGER\s+NOT\s+NULL\s+UNIQUE/i.test(table))throw new Error('Deletion receipts require unique nonces and cursors; no guest records were changed.');
  const trigger=(await store.query("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='wishes_reject_deleted_submission'"))[0]?.results?.[0]?.sql;
  if(!trigger)return false;
  if(!/BEFORE\s+INSERT\s+ON\s+wishes/i.test(trigger)||!/RAISE\s*\(\s*ABORT\s*,\s*'WISH_DELETED'\s*\)/i.test(trigger)||!/submission_key\s*=\s*NEW\.submission_key/i.test(trigger))throw new Error('Deletion replay guard is incompatible; no guest records were changed.');
  return true;
}
async function ensureDeletionSchema(store){
  if(await deletionSchemaReady(store))return true;
  const migration=MIGRATIONS.find(m=>m.name==='0004_hard_delete_receipts.sql');
  if(!migration)throw new Error('Deletion receipt migration is missing.');
  // Safe on an existing live schema: CREATE IF NOT EXISTS only, never a purge.
  await store.executeSchema(migration.sql);
  if(!await deletionSchemaReady(store))throw new Error('Deletion receipt migration read-back incomplete.');
  return true;
}
async function avatarGenderSchemaReady(store){
  const columns=(await store.query('PRAGMA table_info(wishes)'))[0]?.results||[];
  const column=columns.find(c=>c.name==='avatar_gender');
  if(!column)return false;
  const table=(await store.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='wishes'"))[0]?.results?.[0]?.sql||'';
  if(String(column.type).toUpperCase()!=='TEXT'||column.notnull!==1||column.dflt_value!=="'unspecified'"||! /CHECK\s*\(\s*avatar_gender\s+IN\s*\(\s*'male'\s*,\s*'female'\s*,\s*'unspecified'\s*\)\s*\)/i.test(table))throw new Error('Existing avatar_gender schema is incompatible; no guest records were changed.');
  return true;
}
async function migrateStore(store){
  for(const migration of MIGRATIONS){
    // The original two migrations use IF NOT EXISTS. SQLite has no matching
    // ADD COLUMN syntax, so probe the actual schema before applying 0003.
    if(migration.name==='0003_avatar_gender.sql'){
      if(await avatarGenderSchemaReady(store))continue;
      try{await store.executeSchema(migration.sql);}
      catch(error){if(!await avatarGenderSchemaReady(store))throw error;}
      if(!await avatarGenderSchemaReady(store))throw new Error('Avatar gender migration read-back incomplete.');
    }else if(migration.name==='0004_hard_delete_receipts.sql')await ensureDeletionSchema(store);
    else await store.executeSchema(migration.sql);
  }
}

class D1Store {
  constructor(env) {
    for (const key of ['CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_DATABASE_ID','CLOUDFLARE_API_TOKEN']) {
      if (!env[key]) throw new Error(`Missing ${key}; production writes require persistent D1 storage.`);
    }
    this.url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID)}/d1/database/${encodeURIComponent(env.CLOUDFLARE_DATABASE_ID)}/query`;
    this.token=env.CLOUDFLARE_API_TOKEN;
    this.mode='d1';
    this.persistent=true;
  }
  async query(sql,params=[]) {
    const response=await fetch(this.url,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify({sql,params}),signal:AbortSignal.timeout(20000)});
    const data=await response.json();
    if(!response.ok || !data.success || data.result?.some(r=>!r.success)) throw new Error('Persistent database request failed. Check D1 availability, quota and token permissions.');
    return data.result || [];
  }
  async batch(statements) {
    const response=await fetch(this.url,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify({batch:statements}),signal:AbortSignal.timeout(20000)});
    const data=await response.json();
    if(!response.ok || !data.success || data.result?.some(r=>!r.success)) throw new Error('Persistent database transaction failed.');
    return data.result || [];
  }
  async executeSchema(sql){return this.query(sql);}
  async migrate(){return migrateStore(this);}
  async close(){}
}

class LocalStore {
  constructor(db,file){this.db=db;this.file=file;this.mode='sqlite-local';this.persistent=true;}
  run(sql,params=[]) {
    const stmt=this.db.prepare(sql);
    try{stmt.bind(params);const rows=[];while(stmt.step())rows.push(stmt.getAsObject());return {success:true,results:rows,meta:{changes:this.db.getRowsModified()}};}finally{stmt.free();}
  }
  save(){
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    const temp=this.file+'.tmp';
    fs.writeFileSync(temp,Buffer.from(this.db.export()),{mode:0o600});
    fs.renameSync(temp,this.file);
  }
  async query(sql,params=[]) {
    const result=this.run(sql,params);
    if(!/^\s*(SELECT|PRAGMA|EXPLAIN)\b/i.test(sql))this.save();
    return [result];
  }
  async batch(statements){
    this.db.run('BEGIN IMMEDIATE');
    try{const results=statements.map(s=>this.run(s.sql,s.params||[]));this.db.run('COMMIT');this.save();return results;}
    catch(e){this.db.run('ROLLBACK');throw e;}
  }
  async executeSchema(sql){this.db.run(sql);this.save();}
  async migrate(){return migrateStore(this);}
  async close(){this.save();this.db.close();}
}
async function createStore(env=process.env){
  const mode=env.STORAGE_MODE || 'd1';
  if(mode==='d1')return new D1Store(env);
  if(mode!=='sqlite-local')throw new Error('STORAGE_MODE must be d1 or sqlite-local.');
  if(env.NODE_ENV==='production' || env.RENDER)throw new Error('sqlite-local is for local verification only; Render requires D1.');
  if(!env.SQLITE_PATH)throw new Error('Set an explicit SQLITE_PATH for the local persistent database.');
  const SQL=await initSqlJs();
  const file=path.resolve(env.SQLITE_PATH);
  const db=fs.existsSync(file)?new SQL.Database(fs.readFileSync(file)):new SQL.Database();
  db.run('PRAGMA foreign_keys=ON');
  const store=new LocalStore(db,file);await store.migrate();return store;
}
module.exports={createStore,D1Store,MIGRATIONS,ensureDeletionSchema,deletionSchemaReady};
