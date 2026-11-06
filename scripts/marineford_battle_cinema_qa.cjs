'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),express=require('express'),{Server}=require('socket.io'),engine=require('../server/marineford-engine');
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=process.env.MF_QA_DIR;fs.mkdirSync(out,{recursive:true});
const app=express(),server=http.createServer(app),io=new Server(server),sockets=new Map(),acks=new Map(),checks=[],errors=[],evidence=[];let fromUI;const uiActions=[];
app.use((req,res,next)=>{res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob: poasset:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; media-src 'self' data: blob:");next();});
app.use(express.static(root+'/public'));app.use(express.static('D:/Codex_Release_Worktrees/card-native-server-adapter-20261029/public'));
const seats=Array.from({length:6},(_,i)=>({userId:i+1,name:i?'海賊隊員'+i:'海軍元帥',avatar:i+8,ready:true}));
io.on('connection',socket=>{
 socket.on('SOCIAL_AUTH',({secret},cb)=>{const id=Number(secret);sockets.set(id,socket);cb({ok:true,me:seats[id]});});
 socket.on('MF_ACTION',(payload,cb)=>fromUI(socket,payload,cb));
 socket.on('MF_RULES',(_,cb)=>cb({ok:true,ruleset:'20261106-kizaru-one'}));
 socket.on('MF_ACK',({sequence},cb)=>{acks.set([...sockets].find(([,s])=>s===socket)[0],sequence);cb?.({ok:true});});
});
function skill(team,seed){let h=team==='navy'?17:43;for(const c of seed)h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;return (team==='navy'?['kizaru','aokiji','akainu']:['whitebeard','marco','jozu','vista'])[h%(team==='navy'?3:4)];}
function fixture(navy,pirate,boostN=0,boostP=0,attacker=0){
 const s=engine.create(seats,0);for(const p of s.players){p.hand=[];p.played=[];p.morale=0;}
 s.players[0].hand=[navy,navy==='navy-koby'?'navy-garp':'navy-koby'];s.players[1].hand=[pirate];
 const others=engine.cards.filter(c=>c.team==='pirate'&&c.id!==pirate).slice(0,4);for(let i=2;i<6;i++)s.players[i].hand=[others[i-2].id];
 const held=new Set(s.players.flatMap(p=>p.hand));for(const team of ['navy','pirate'])s.decks[team]=engine.cards.filter(c=>c.team===team&&!held.has(c.id)).map(c=>c.id);
 s.players[0].morale=boostN;s.players[1].morale=boostP;s.turn=attacker;s.step='effect';s.jobs=[{type:'turn-end'}];
 s.pending={type:'battle-card',owner:0,cards:s.players[0].hand.slice(),battle:{attacker,defender:attacker?0:1,source:attacker,remaining:1,used:[attacker?0:1]}};
 return s;
}
(async()=>{let browser,pages=[];try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await(process.env.MF_BROWSER==='webkit'?webkit.launch():chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}));
 for(let id=0;id<3;id++){const ctx=await browser.newContext({viewport:{width:740,height:360},reducedMotion:'reduce'});
  await ctx.addInitScript(id=>{localStorage.setItem('opSecret',String(id));window.__cinemaPhases=[];window.__holdResult=false;window.__held=false;new MutationObserver(()=>{
   const layer=document.querySelector('#effectLayer');if(layer?.dataset.kind!=='battle-cinema'||!layer.querySelector('.cinema-stage'))return;
   const phase=layer.dataset.phase;
   const shot={phase,at:performance.now(),cards:[...new Set([...layer.querySelectorAll('.card-face')].map(el=>el.dataset.card))],math:[...layer.querySelectorAll('.cinema-math')].map(el=>el.textContent),skills:[...layer.querySelectorAll('.cinema-party')].map(el=>el.dataset.skill),caption:layer.querySelector('.cinema-caption')?.textContent};
   const last=window.__cinemaPhases.at(-1);if(!last||JSON.stringify(last)!==JSON.stringify(shot))window.__cinemaPhases.push(shot);
   if(phase==='result'&&window.__holdResult&&!window.__held){window.__held=true;document.getAnimations().forEach(a=>a.pause());}
  }).observe(document,{subtree:true,childList:true,attributes:true,characterData:true});},id);
  const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.text().includes('presentation failed')||m.text().includes('Content Security Policy'))errors.push(m.text());});await p.goto('http://127.0.0.1:'+server.address().port+'/marineford/index.html');await p.locator('#connection').getByText('已連線',{exact:true}).waitFor();pages.push(p);
 }
 let sequence=100,activeState;
 const recover=async s=>{activeState=s;sequence++;for(let id=0;id<3;id++){sockets.get(id).emit('MF_LOBBY',{code:'QA77',host:1,seats,you:id});sockets.get(id).emit('MF_RECOVER',{sequence,view:engine.visible(s,id),you:id});}await Promise.all(pages.map(p=>p.locator('.execution-scaffold').evaluate(i=>i.decode())));await pages[0].waitForTimeout(100);};
 const send=(r,hold=true)=>{activeState=r.state;const seq=++sequence;for(let id=0;id<3;id++)sockets.get(id).emit('MF_PRESENT',{sequence:seq,you:id,view:engine.visible(r.state,id),events:r.events.filter(e=>!e.to||e.to==='all'||e.to.includes(id))});return seq;};
 const waitACK=async seq=>{for(let k=0;k<200;k++){if([0,1,2].every(i=>acks.get(i)===seq))return;await pages[0].waitForTimeout(100);}throw Error('ACK timeout '+seq+' '+JSON.stringify([...acks]));};
 fromUI=(socket,payload,cb)=>{const id=[...sockets].find(([,s])=>s===socket)[0];if(payload.revision!==activeState.revision)return cb({ok:false,error:'stale revision'});const r=engine.apply(activeState,id,payload.action);if(!r.ok)return cb(r);const seq=send(r);uiActions.push({id,action:payload.action,seq});cb({ok:true});};
 const cases=[
  ...['kizaru','aokiji','akainu'].map((effect,i)=>({effect,team:'navy',navy:'navy-akainu',pirate:'pirate-4',attacker:i%2})),
  ...['whitebeard','marco','jozu','vista'].map((effect,i)=>({effect,team:'pirate',navy:'navy-koby',pirate:'pirate-15',attacker:i%2})),
  {effect:'akainu',team:'navy',navy:'navy-kizaru',pirate:'pirate-13',boostN:1,boostP:0,attacker:1},
  {tie:true,navy:'navy-aokiji',pirate:'pirate-7',boostN:1,boostP:1,attacker:1}
 ];
 if(process.env.MF_SMOKE||process.env.MF_EDGE_ONLY)cases.splice(1);
 for(const [index,c]of cases.entries()){
  const [width,height]=process.env.MF_EDGE_ONLY?[568,320]:index===7?[568,320]:index===8?[390,844]:index%2?[1366,768]:[740,360];
  await Promise.all(pages.map(async p=>{await p.setViewportSize({width,height});await p.emulateMedia({reducedMotion:index===0||index===3?'no-preference':'reduce'});}));
  const s=fixture(c.navy,c.pirate,c.boostN,c.boostP,c.attacker);if(process.env.MF_EDGE_ONLY||process.env.MF_FULL_EDGES){s.players[0].name='海軍元帥測試名稱很長需要確認文字換行位置';s.players[1].name='白鬍子團測試名稱很長需要確認文字換行位置';}await recover(s);
  while(c.effect&&skill(c.team,(sequence+1)+':'+c.attacker+':'+(c.attacker?0:1))!==c.effect)sequence++;
  await Promise.all(pages.map(p=>p.evaluate(()=>{window.__cinemaPhases=[];window.__holdResult=true;window.__held=false;})));
  const r=engine.apply(s,0,{type:'CHOOSE',card:c.navy});assert(r.ok);const event=r.events.find(e=>e.type==='battle'),outcome=r.events.find(e=>['defeat','tie'].includes(e.type));
  assert.equal(outcome.type,c.tie?'tie':'defeat');if(c.effect)assert.equal(s.players[outcome.player].team,c.team==='navy'?'pirate':'navy');
  const seq=send(r);await Promise.all(pages.map(p=>p.waitForFunction(()=>window.__held)));
  const phases=await Promise.all(pages.map(p=>p.evaluate(()=>window.__cinemaPhases)));
  for(let id=0;id<3;id++){
   const p=pages[id],observed=phases[id],last=observed.at(-1),ownAllowed=[c.navy,c.pirate];
   assert(observed.some(e=>e.phase==='charge'));assert(observed.some(e=>e.phase==='clash'));assert.equal(last.phase,'result');
   for(const frame of observed.filter(x=>!['reveal','result','return'].includes(x.phase))){
    if(id<2)assert(frame.cards.every(card=>ownAllowed.includes(card)));else assert.equal(frame.cards.length,0,'Observer must not see either face before impact ends');
    assert(!/被擊敗|輸牌/.test(frame.caption||''),'No early verdict');
   }
   if(id<2){assert.deepEqual([...last.cards].sort(),ownAllowed.slice().sort());assert.deepEqual(observed.find(f=>f.phase==='charge').cards.slice().sort(),ownAllowed.slice().sort());if(index===7)assert(observed.some(f=>f.math.includes('牌號 4 ＋ 士氣 2 ＝ 6')),'Morale reversal uses server score, not rank alone');}
   else assert.deepEqual(last.cards,c.tie?[]:[outcome.card]);
   if(c.tie)assert.match(last.caption,/平手/);else assert.match(last.caption,new RegExp('輸牌 '+engine.byId[outcome.card].rank+' 號'));
   if(index===0||index===3)assert(last.at-observed.find(f=>f.phase==='charge').at>=3000,'Normal-motion verdict waits for the complete exchange and impact');
   assert.equal(await p.locator('.cinema-party').count(),2);assert.equal(await p.locator('.cinema-stage img[src*="battle-"][src*="-strike-"],.cinema-actor,.mf-marco-flight').count(),0,'No character sprite in the card duel');
   await p.locator('.cinema-background').evaluate(i=>i.decode());
   const boxes=await p.locator('.cinema-party-name,.cinema-card,.cinema-math,.cinema-skill,.cinema-caption').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,w:r.width,h:r.height}}));
   assert(boxes.every(b=>b.x>=-1&&b.y>=-1&&b.right<=width+1&&b.bottom<=height+1),'Arena content must stay in viewport');
   if(process.env.MF_EDGE_ONLY||process.env.MF_FULL_EDGES){const caption=await p.locator('.cinema-caption').boundingBox();const ends=await p.locator('.cinema-skill').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().bottom));assert(ends.every(y=>y<=caption.y+1),'Long names and footer must not collide');}
   if(c.effect){const role=p.locator('.cinema-party[data-team="'+c.team+'"]');assert.equal(await role.getAttribute('data-skill'),c.effect);}
   if(index===0||index===3||index>=7)await p.screenshot({path:out+'/duel-'+index+'-'+id+'.png'});
  }
  assert.deepEqual(phases[0].at(-1).skills,phases[1].at(-1).skills,'Cosmetic skills agree across different private event lists');
  evidence.push({case:c,width,height,privateCards:[c.navy,c.pirate],outcome,phases});
  assert([0,1,2].every(id=>acks.get(id)!==seq),'ACK must wait for held result');
  await Promise.all(pages.map(p=>p.evaluate(()=>{window.__holdResult=false;document.getAnimations().forEach(a=>a.play());})));
  await waitACK(seq);for(let id=0;id<3;id++){assert.equal(await pages[id].locator('.cinema-stage,.cinema-fragment,.cinema-power').count(),0);sockets.get(id).emit('MF_CAN_ACT',{sequence:seq});}
  if(process.env.MF_EDGE_ONLY||process.env.MF_FULL_EDGES){const before=uiActions.length;const turn=r.state.turn;assert(turn<3);await pages[turn].locator('.deck[data-active=true]').click();await pages[0].waitForFunction(()=>true);for(let k=0;uiActions.length===before&&k<80;k++)await pages[0].waitForTimeout(100);assert.equal(uiActions.length,before+1);assert.equal(uiActions.at(-1).action.type,'DRAW');await waitACK(uiActions.at(-1).seq);checks.push('Normal UI draw after arena return submits exactly one valid action and completes');}
  checks.push((c.tie?'tie':c.team+' '+c.effect)+' at '+width+'x'+height+': two private combatants, one public loser, result after impact, same FX, ACK and cleanup');
 }
 if(process.env.MF_EDGE_ONLY||process.env.MF_FULL_EDGES){
  await Promise.all(pages.map(p=>p.emulateMedia({reducedMotion:'no-preference'})));const s=fixture('navy-kizaru','pirate-13',1,0,1);await recover(s);
  await Promise.all(pages.map(p=>p.evaluate(()=>{window.__holdResult=false;window.__held=false;})));
  const r=engine.apply(s,0,{type:'CHOOSE',card:'navy-kizaru'});assert(r.ok);const old=send(r);
  await Promise.all(pages.map(p=>p.waitForSelector('#effectLayer[data-phase=charge] .cinema-stage')));
  await recover(s);await pages[0].waitForTimeout(1600);
  for(let id=0;id<3;id++){assert.equal(await pages[id].locator('.cinema-stage,.cinema-power,.cinema-fragment').count(),0);assert.notEqual(acks.get(id),old);assert.equal(await pages[id].locator('#effectLayer').evaluate(e=>getComputedStyle(e).display),'none','Cancelled stage cannot leave an opaque overlay');assert.equal(await pages[id].locator('#players .portrait-button').evaluateAll(es=>es.some(e=>e.style.visibility==='hidden')),false);}
  checks.push('Recovery during charge cancels all three arenas, restores portraits, and emits no stale ACK');
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify({passed:true,checks,errors,evidence,sourceHashes:Object.fromEntries(['public/marineford/marineford.js','public/marineford/marineford.css'].map(f=>[f,require('crypto').createHash('sha256').update(fs.readFileSync(root+'/'+f)).digest('hex')])),scope:'Isolated three Socket.IO clients with real rules-engine battle packets; no physical devices/accounts'},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}catch(e){for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:out+'/failure-'+i+'.png'}).catch(()=>{});fs.writeFileSync(out+'/failure.json',JSON.stringify({error:e.stack,checks,errors},null,2));throw e;}finally{await browser?.close();io.close();server.close();}})();
