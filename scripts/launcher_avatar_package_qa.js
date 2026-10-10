'use strict';
// Real installed runtime classes, reviewed manifests, no network or real cache writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const C=require('./desktop_program_package_common');
const {RuntimeAssetCache}=require('../desktop/runtime-asset-cache');
const {HttpsProgramRuntime}=require('../desktop/program-runtime');
const root=path.resolve(__dirname,'..'),out='D:/Codex_QA/launcher-shop-r58/package-runtime-report.json';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const catalog=C.validateCatalog(JSON.parse(fs.readFileSync(path.join(root,'public/desktop/catalog-v3.json'))));
 const result={status:'RUNNING',scope:'Installed core 1.2.23 RuntimeAssetCache and HttpsProgramRuntime with committed source bytes; zero network and no formal player cache writes.',games:{}};
 for(const game of C.GAME_IDS){
  const meta=catalog.games[game],bytes=fs.readFileSync(path.join(root,'public',meta.manifestPath));assert.equal(hash(bytes),meta.manifestSha256);
  const manifest=C.validateManifest(JSON.parse(bytes),game),cache=new RuntimeAssetCache();let network=0;
  cache.buildGame(game,manifest,{filePathForAsset:a=>path.join(root,'public',a.path.replace(/^images\/avatars\/(\d+)\.webp$/,(_m,id)=>Number(id)>=51?`images/board/avatars/${id}.webp`:`images/avatars/${id}.webp`))});
  const runtime=new HttpsProgramRuntime({gameId:game,origin:'https://avatar-qa.invalid',assetCache:cache,networkFetch:()=>{network++;throw Error('Unexpected network fallback');}});
  runtime.authorize({enabled:true,gameId:game,...meta});let checked=0;
  for(let id=51;id<=222;id++)for(const p of [`images/board/avatars/${id}.webp`,...(game==='card'?[`images/avatars/${id}.webp`]:[])]){
   const expected=manifest.assets.find(a=>a.path===p);assert(expected,p);
   const r=await runtime.handle(new Request('https://avatar-qa.invalid/'+p));assert.equal(r.status,200);assert.equal(r.headers.get('X-OnePiece-Desktop-Program'),'hit');
   const body=Buffer.from(await r.arrayBuffer());assert.equal(hash(body),expected.sha256);assert.equal(body.length,expected.size);checked++;
   if(game==='card')assert.equal(expected.sha256,manifest.assets.find(a=>a.path===`images/board/avatars/${id}.webp`).sha256);
  }
  assert.equal(network,0);result.games[game]={releaseId:meta.releaseId,checked,networkFallbacks:network};
 }
 result.status='PASS';fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
