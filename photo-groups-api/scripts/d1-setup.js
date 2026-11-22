'use strict';
// Secrets come from the current process / Render environment, never arguments or logs.
const fs=require('node:fs');
const path=require('node:path');
const {D1Store}=require('../storage');
async function runSetup(store,command,target,log=console.log){
  if(command==='migrate'){
    await store.migrate();
    const result=await store.query("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('wishes','avatars','wish_events','playback_state','playback_commands','deleted_receipts') ORDER BY name");
    const tables=result[0]?.results?.map(r=>r.name)||[];
    if(tables.length!==6)throw new Error('Migration read-back incomplete');
    const column=(await store.query('PRAGMA table_info(wishes)'))[0]?.results?.find(c=>c.name==='avatar_gender');
    if(!column)throw new Error('Avatar gender column read-back incomplete');
    log(JSON.stringify({ok:true,storage:store.mode,tables,avatar_gender:{type:column.type,notnull:column.notnull,default:column.dflt_value}}));return;
  }
  if(command==='backup'){
    if(!target)throw new Error('Usage: npm run backup:d1 -- <private-output.json>');
    const data={version:3,exported_at:new Date().toISOString(),tables:{}};
    // Preserve AUTOINCREMENT watermarks even when every wish/event was removed.
    for(const table of ['avatars','wishes','wish_events','playback_state','playback_commands','deleted_receipts','sqlite_sequence']){
      data.tables[table]=[];let offset=0;
      while(true){const key=table==='wish_events'?'seq':table==='deleted_receipts'?'wish_id':table==='sqlite_sequence'?'name':'id';const result=await store.query(`SELECT * FROM ${table} ORDER BY ${key} LIMIT 200 OFFSET ?`,[offset]),page=result[0]?.results||[];data.tables[table].push(...page);if(page.length<200)break;offset+=200;}
    }
    const file=path.resolve(target);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(data),{mode:0o600});log(JSON.stringify({ok:true,path:file,counts:Object.fromEntries(Object.entries(data.tables).map(([k,v])=>[k,v.length]))}));return;
  }
  throw new Error('Use migrate or backup');
}
if(require.main===module)Promise.resolve().then(()=>runSetup(new D1Store(process.env),process.argv[2],process.argv[3])).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={runSetup};
