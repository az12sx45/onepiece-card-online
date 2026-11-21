'use strict';
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');
const SCHEMA = fs.readFileSync(path.join(__dirname,'migrations/0001_wishes.sql'),'utf8');

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
  async migrate(){return this.query(SCHEMA);}
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
  async migrate(){this.db.run(SCHEMA);this.save();}
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
module.exports={createStore,D1Store,SCHEMA};
