'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const P=require('../tools/desktop-r2-publisher/publish');
const root=path.resolve(__dirname,'..'),manifestPath='public/desktop/marineford-media-v1.json';
function visualAssets(){
 const art=path.join(root,'public/marineford/art'),v2=path.join(art,'v2');
 const required=[...require('../public/marineford/cards.json').map(c=>c.id),'new_cover','field','button','hud','navy-frame','pirate-frame','navy-back','pirate-back','fx-fire','fx-ice','fx-quake'];
 required.push(...require('../public/marineford/cards.json').map(c=>'redraw-'+c.id),'redraw-scaffold','redraw-morale-pirate','redraw-morale-navy');
 required.push('victory-ace-route','scaffold-field-navy','scaffold-field-pirate');
 required.push(...Array.from({length:6},(_,i)=>'refined-justice-'+(i+1)),'scaffold-rear','lobby-panorama','command-panel','meter-fortress-vertical','meter-execution-vertical','fx-fortress-break');
 const missing=required.filter(name=>!fs.existsSync(path.join(v2,name+'.webp')));
 if(missing.length)throw Error('Release blocked: missing new Marineford art: '+missing.join(', '));
 return [...fs.readdirSync(art).filter(n=>n.endsWith('.webp')).map(n=>'marineford/art/'+n),...fs.readdirSync(v2).filter(n=>n.endsWith('.webp')).map(n=>'marineford/art/v2/'+n),'images/game_launcher/launcher_marineford_cover_v2.webp'];
}
async function main(){const publish=process.argv.includes('--publish'),live=process.argv.includes('--live');if(!publish){const files=visualAssets();const assets=files.sort().map(p=>{const bytes=fs.readFileSync(path.join(root,'public',p));return {path:p,kind:'image',mime:'image/webp',size:bytes.length,sha256:P.sha256Bytes(bytes)};});fs.writeFileSync(path.join(root,manifestPath),P.canonicalJson({schema:1,gameId:'marineford',assets}));console.log(JSON.stringify({files:assets.length,bytes:assets.reduce((n,a)=>n+a.size,0)}));return;}
 const manifest=JSON.parse(P.readGitHeadBlob(root,'desktop/marineford-media-v1.json'));assert.equal(manifest.gameId,'marineford');const records=manifest.assets.map(a=>({...a,key:P.objectKeyForSha256(a.sha256),games:['marineford'],sources:[a.path]}));const inventory={catalogSchema:3,repoRoot:root,publicRoot:path.join(root,'public'),records,logicalFiles:records.length,uniqueFiles:records.length,logicalBytes:records.reduce((n,a)=>n+a.size,0),uniqueBytes:records.reduce((n,a)=>n+a.size,0)};let context;try{if(live){const config=P.loadLiveConfiguration(),sdk=require('@aws-sdk/client-s3');context={client:new sdk.S3Client(config),bucket:config.bucket,HeadObjectCommand:sdk.HeadObjectCommand,PutObjectCommand:sdk.PutObjectCommand};}const result=await P.publishInventory(inventory,{live,concurrency:4,liveContext:context});if(live)for(const a of records){const response=await fetch('https://game-assets.rihdi.tw/desktop/blobs/sha256/'+a.sha256.slice(0,2)+'/'+a.sha256);assert.equal(response.status,200);const bytes=Buffer.from(await response.arrayBuffer());assert.equal(P.sha256Bytes(bytes),a.sha256);assert.equal(bytes.length,a.size);}console.log(JSON.stringify({...result,publicReadback:live}));}finally{context?.client.destroy();}}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
