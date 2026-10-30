'use strict';
// Publish only this release's reviewed program delta. Existing live media are
// preserved, including shared-avatar aliases that are absent from this checkout.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {execFileSync}=require('child_process');
const P=require('../tools/desktop-r2-publisher/publish');
const root=path.resolve(__dirname,'..');
async function main(){
 const options=P.parseArguments(process.argv.slice(2));
 assert.equal(options.catalogVersion,3);assert.deepEqual(options.gameIds,['card']);
 const read=rel=>execFileSync('git',['show','HEAD:'+rel],{cwd:root,maxBuffer:12e6});
 const next=JSON.parse(read('public/desktop/catalog-v3.json'));
 const response=await fetch('https://onepiece-card-online.onrender.com/desktop/catalog-v3.json');assert.equal(response.status,200);
 const base=await response.json();assert.deepEqual(next.sourceTrees,base.sourceTrees);
 for(const game of ['board','chess'])assert.deepEqual(next.games[game],base.games[game]);
 assert.equal(base.games.card.releaseId,'package-3df07c30b9c7bcee','Expected reviewed public baseline');
 const oldResponse=await fetch('https://onepiece-card-online.onrender.com/'+base.games.card.manifestPath);assert.equal(oldResponse.status,200);
 const oldBytes=Buffer.from(await oldResponse.arrayBuffer());assert.equal(P.sha256Bytes(oldBytes),base.games.card.manifestSha256);
 const old=JSON.parse(oldBytes),current=JSON.parse(read('public/'+next.games.card.manifestPath));
 const allow=['css/card-desktop-table.css','game.html','js/card-desktop-table.js'];
 assert.deepEqual(current.assets.filter(a=>!allow.includes(a.path)),old.assets.filter(a=>!allow.includes(a.path)));
 const inventory=await P.loadPublishInventory({repoRoot:root,gameIds:['card'],catalogVersion:3});
 inventory.records=inventory.records.filter(r=>r.sources.some(s=>allow.includes(s)));
 assert.equal(inventory.records.length,3);assert.ok(inventory.records.every(r=>r.sources.every(s=>allow.includes(s))));
 inventory.uniqueFiles=inventory.logicalFiles=3;
 inventory.uniqueBytes=inventory.logicalBytes=inventory.records.reduce((n,r)=>n+r.size,0);
 let context;
 try{
  if(options.live){const config=P.loadLiveConfiguration(),sdk=require('@aws-sdk/client-s3');context={client:new sdk.S3Client(config),bucket:config.bucket,HeadObjectCommand:sdk.HeadObjectCommand,PutObjectCommand:sdk.PutObjectCommand};}
  const result=await P.publishInventory(inventory,{live:options.live,concurrency:3,liveContext:context});
  if(options.live)for(const r of inventory.records){const res=await fetch(next.assetBlobBaseUrl+'/'+r.sha256.slice(0,2)+'/'+r.sha256);assert.equal(res.status,200);const bytes=Buffer.from(await res.arrayBuffer());assert.equal(bytes.length,r.size);assert.equal(P.sha256Bytes(bytes),r.sha256);}
  console.log(JSON.stringify({...result,release:next.games.card.releaseId,publicReadback:!!options.live,retainedMediaFiles:1054}));
 }finally{context?.client.destroy();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
