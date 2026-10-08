'use strict';
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),H=require('./launcher_life_integration_qa');
const data=require('../tools/launcher-room/dialogue-v47/integrated-v2.json'),out='D:/Codex_QA/launcher-fishing-r47/dialogue-browser';fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await H.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});H.setBrowser(browser);const checks=[];
try{for(const [label,width,height]of [['desktop',1440,900],['minimum',960,640]]){
 const row=data.pairs.find(r=>r.id==='life26_pair_zoro_sanji_meal_13'),event={...row,requiredCharacters:row.pair,requiredFurniture:[],expanded:true,legacy:true,steps:row.turns.flatMap(t=>[{...t,kind:'speak'}, {kind:'wait',durationMs:t.gapAfterMs}])};
 const {page,errors}=await H.create({owned:row.pair,extraEvents:[event],onlyExtraEvents:true});await page.setViewportSize({width,height});await page.locator('#roomStage').scrollIntoViewIfNeeded();
 await page.evaluate(()=>{__integration.db[42].profile.name='航海者';__integration.refresh();});
 await H.advance(page,await page.evaluate(()=>Math.max(0,__launcherRoomTest.snapshot().life.nextForegroundAt-Date.now()+250)));
 const started=await page.evaluate(id=>{__launcherRoomTest.lifeTick();if(__launcherRoomTest.snapshot().life.foreground?.id===id)return true;for(const k of ['zoro','sanji'])__launcherRoomTest.lifeCancel(k);return __launcherRoomTest.lifeEvent(id);},row.id);assert(started,'scripted scene begins through real controller');
 const seen=new Set(),frames=new Set();let pictured=false,complete=false;
 for(let t=0;t<110000;t+=500){await H.advance(page,500);const state=await H.snap(page);for(const n of state.nodes){if(n.speech)seen.add(n.speech);if(state.nodes.some(v=>v.speech))frames.add(n.key+':'+n.pose+':'+n.frame);}if(seen.size&&!pictured){await page.locator('#roomStage').screenshot({path:path.join(out,label+'-conversation.png')});pictured=true;}if(seen.size===3&&!state.life.foreground){complete=true;break;}}
 assert(complete,'all three turns complete');assert.deepEqual([...seen],row.turns.map(t=>t.line));assert(frames.size>=4,'decoded full-body speaker and listener poses follow turns');assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>__integration.calls.filter(c=>c.type==='fish.release'||c.type==='work.reserve').length),0);
 checks.push({label,turns:[...seen],actingPoseSamples:frames.size,complete,noEconomicCommands:true});await page.close();
 }fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',checks,scope:'Real Chromium/controller/BFS/decoded acting poses; each acting pose is one image, not a newly generated animation; fixture transport, no formal account acceptance'},null,2));console.log('PASS two viewport three-turn conversations and body pose transitions');}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
