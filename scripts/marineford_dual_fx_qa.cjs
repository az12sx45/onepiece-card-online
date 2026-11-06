'use strict';
const fs=require('fs'),http=require('http'),assert=require('node:assert/strict'),express=require('express'),{Server}=require('socket.io'),engine=require('../server/marineford-engine');
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=require('path').resolve(__dirname,'..'),out=process.env.MF_QA_DIR,checks=[],raster=[],errors=[],sockets=new Map(),acks=new Map();fs.mkdirSync(out,{recursive:true});
const app=express(),server=http.createServer(app),io=new Server(server);
app.use(express.static(root+'/public'));app.use(express.static('D:/Codex_Release_Worktrees/card-native-server-adapter-20261029/public'));
const seats=Array.from({length:6},(_,i)=>({userId:i+1,name:i?'海賊'+i:'海軍',avatar:i+8,ready:true}));
io.on('connection',socket=>{
 socket.on('SOCIAL_AUTH',({secret},cb)=>{const id=Number(secret);sockets.set(id,socket);cb({ok:true,me:seats[id]});});
 socket.on('MF_RULES',(_,cb)=>cb({ok:true,ruleset:'20261106-kizaru-one'}));
 socket.on('MF_ACK',({sequence},cb)=>{acks.set(Number([...sockets].find(([,s])=>s===socket)[0]),sequence);cb?.({ok:true});});
});
(async()=>{let browser;try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await(process.env.MF_BROWSER==='webkit'?webkit.launch():chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}));
 const pages=[];
 for(let id=0;id<3;id++){const ctx=await browser.newContext({viewport:{width:740,height:360}});await ctx.addInitScript(id=>localStorage.setItem('opSecret',String(id)),id);const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.text().includes('presentation failed'))errors.push(m.text());});await p.goto('http://127.0.0.1:'+server.address().port+'/marineford/index.html');await p.locator('#connection').getByText('已連線',{exact:true}).waitFor();pages.push(p);}
 let sequence=100;
 const recover=async s=>{sequence++;for(let id=0;id<3;id++){const socket=sockets.get(id);socket.emit('MF_LOBBY',{code:'QA66',host:1,seats,you:id});socket.emit('MF_RECOVER',{sequence,view:engine.visible(s,id),you:id});}await Promise.all(pages.map(p=>p.locator('.execution-scaffold').evaluate(i=>i.decode())));await pages[0].waitForTimeout(100);};
 const present=r=>{const seq=++sequence;for(let id=0;id<3;id++)sockets.get(id).emit('MF_PRESENT',{sequence:seq,you:id,view:engine.visible(r.state,id),events:r.events.filter(e=>e.to==='all'||!e.to||e.to.includes(id))});return seq;};
 const waitACK=async seq=>{for(let k=0;k<200;k++){if([0,1,2].every(id=>acks.get(id)===seq))return;await pages[0].waitForTimeout(100);}throw Error('ACK timeout '+seq+' '+JSON.stringify([...acks]));};
 const positions=p=>p.locator('#players .seat').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]}));
 for(const [w,h]of (process.env.MF_CANCEL_ONLY?[]:process.env.MF_RASTER_ONLY?[[640,320]]:[[640,320],[1366,768]])){
  await Promise.all(pages.map(p=>p.setViewportSize({width:w,height:h})));
  for(const card of (process.env.MF_RASTER_ONLY?[]:['pirate-1','pirate-2','pirate-3']))for(const hit of [false,true]){
   const s=engine.create(seats,0);s.turn=1;s.step='effect';s.players[1].played=[card];s.players[0].hand=hit?['navy-kizaru','justice-4']:['navy-koby','navy-garp'];s.pending={type:'guess',owner:1,targets:[0],digits:[4]};await recover(s);
   const before=await Promise.all(pages.map(positions)),r=engine.apply(s,1,{type:'CHOOSE',digit:4});assert(r.ok);const seq=present(r);
   await Promise.all(pages.map(p=>p.waitForSelector('.mf-marco-flight')));
   for(let id=0;id<3;id++){const p=pages[id];assert.equal(await p.locator('#effectLayer').getAttribute('data-facing'),id?'back':'front');await p.locator('.mf-marco-flight').evaluate(i=>i.decode());assert.match(await p.locator('.mf-marco-flight').getAttribute('src'),id?/back-v2/:/phoenix-v1/);assert.equal(await p.locator('#effectLayer .effect-caption,#effectLayer .card-face').count(),0);assert.deepEqual(await positions(p),before[id]);}
   await Promise.all(pages.map(p=>p.locator('.mf-marco-flight').evaluate(el=>{for(const a of el.getAnimations()){a.pause();a.currentTime=540;}})));
   for(let id=0;id<3;id++){const v=await pages[id].locator('.mf-marco-flight').evaluate(el=>({m:new DOMMatrixReadOnly(getComputedStyle(el).transform).m11,r:el.getBoundingClientRect().toJSON()}));assert(id?v.m>0:v.m<0);assert(v.r.y>=-2&&v.r.bottom<=h+2);}
   await Promise.all(pages.map((p,id)=>p.screenshot({path:out+'/marco-'+card+'-'+w+'-'+hit+'-'+id+'.png'})));
   await Promise.all(pages.map(p=>p.locator('.mf-marco-flight').evaluate(el=>el.getAnimations().forEach(a=>a.play()))));
   await waitACK(seq);
   if(hit){assert.equal(r.state.pending.type,'defeat-choice');const next=engine.apply(r.state,0,{type:'CHOOSE',card:'navy-kizaru'});assert(next.ok);const chosen=present(next);await Promise.all(pages.map(p=>p.waitForSelector('.mf-marco-half')));for(const p of pages){assert.equal(await p.locator('.mf-marco-half').count(),2);assert.equal(await p.locator('#effectLayer .effect-caption').count(),0);}await waitACK(chosen);}
   checks.push(w+' '+card+' Marco '+(hit?'hit':'miss')+': all three viewers, opposite front/rear, no private reveal, fixed HUD, split then result/ACK');
  }
  const s=engine.create(seats,0);s.step='effect';s.players[0].played=['justice-1'];const safe=engine.cards.filter(c=>c.team==='pirate'&&c.rank!==4);s.players[1].hand=['pirate-10'];for(let i=2;i<6;i++)s.players[i].hand=[safe[i].id];s.pending={type:'guess',owner:0,targets:[1,2,3,4,5],digits:[4]};await recover(s);
  const before=await Promise.all(pages.map(positions)),r=engine.apply(s,0,{type:'CHOOSE',digit:4});assert(r.ok);const seq=present(r);
  await Promise.all(pages.map(p=>p.waitForSelector('.laser-result')));
  await Promise.all(pages.map(p=>p.evaluate(()=>document.getAnimations().forEach(a=>a.pause()))));
  for(let id=0;id<3;id++){
   const p=pages[id];await p.evaluate(()=>document.getAnimations().forEach(a=>a.pause()));
   assert.equal(await p.locator('.laser-hand-target').count(),5);assert.equal(await p.locator('[data-barrage-holes="12"]').count(),1);assert.equal(await p.locator('[data-barrage-burned=true]').count(),1);assert.equal(await p.locator('.laser-hand-target[data-player="2"] [data-barrage-burned=true]').count(),0);
   assert.deepEqual(await positions(p),before[id]);assert.equal(await p.locator('.laser-hand-target[data-player="3"] .card-face').count(),0);
   const surface=p.locator('[data-barrage-burned=true]'),r=await surface.boundingBox();assert(r.width>0);
   const clip={x:Math.max(0,r.x),y:Math.max(0,r.y),width:r.width,height:r.height};
   const visible=(await p.screenshot({clip})).toString('base64');await surface.evaluate(e=>e.style.visibility='hidden');
   const background=(await p.screenshot({clip})).toString('base64');await surface.evaluate(e=>e.style.visibility='');
   const samples=await p.evaluate(async({visible,background})=>{async function decode(s){const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return {w:i.width,h:i.height,d:x.getImageData(0,0,i.width,i.height).data};}const [a,b]=await Promise.all([decode(visible),decode(background)]);const diff=(x,y)=>{const k=(Math.floor(y*a.h)*a.w+Math.floor(x*a.w))*4;return Math.max(...[0,1,2].map(c=>Math.abs(a.d[k+c]-b.d[k+c])));};return {holes:Array.from({length:12},(_,i)=>diff(.22+i%3*.28+(Math.floor(i/3)%2?.04:0),.18+Math.floor(i/3)*.21)),edge:diff(.5,.04)};},{visible,background});
   raster.push({width:w,viewer:id,...samples});
   assert(samples.holes.every(d=>d<14),'Mask must visibly reveal background: '+JSON.stringify(samples));assert(samples.edge>15,'Non-hole card still visible');
   await p.screenshot({path:out+'/barrage-'+w+'-'+id+'.png'});
  }
  await Promise.all(pages.map(p=>p.evaluate(()=>document.getAnimations().forEach(a=>a.play()))));
  await waitACK(seq);checks.push(w+' barrage: 12 real raster holes only on hit; 3 viewers, private cards hidden, fixed HUD, ACK completes');
 }
 if(process.env.MF_CANCEL_ONLY){
  const s=engine.create(seats,0);s.turn=1;s.step='effect';s.players[1].played=['pirate-2'];s.players[0].hand=['navy-koby','navy-garp'];s.pending={type:'guess',owner:1,targets:[0],digits:[4]};await recover(s);
  const r=engine.apply(s,1,{type:'CHOOSE',digit:4});assert(r.ok);const canceled=present(r);
  await Promise.all(pages.map(p=>p.waitForSelector('.mf-marco-flight')));await recover(s);await pages[0].waitForTimeout(1800);
  for(let id=0;id<3;id++){assert.equal(await pages[id].locator('#effectLayer>*').count(),0);assert.notEqual(acks.get(id),canceled);}
  checks.push('Marco recovery cancels all three perspectives without stale result or ACK');
  const again=present(r);await Promise.all(pages.map(p=>p.waitForSelector('.mf-marco-flight')));await waitACK(again);
  checks.push('All three viewers can complete a fresh guess after cancellation');
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify({passed:true,checks,raster,errors,sourceHashes:Object.fromEntries(['public/marineford/marineford.js','public/marineford/art/v2/fx-marco-phoenix-back-v2.webp'].map(f=>[f,require('crypto').createHash('sha256').update(fs.readFileSync(root+'/'+f)).digest('hex')])),scope:'Three simultaneous isolated Socket.IO clients with real engine packets, Chrome/WebKit raster checks; no real accounts or physical-device claim'},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}catch(e){fs.writeFileSync(out+'/failure.json',JSON.stringify({error:e.stack,checks,errors},null,2));throw e;}finally{await browser?.close();io.close();server.close();}})();
