'use strict';
const assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {matchRoom,createNativeCardHandoff}=require('../desktop/native-card-handoff');
const {createNativeCardBridge}=require('../desktop/native-card-bridge');
const origin='https://onepiece-card-online.onrender.com';
const pause=()=>new Promise(r=>setImmediate(r));
function fixture(result){
 const events=[],wc=new EventEmitter();wc.setAudioMuted=v=>events.push(['mute',v]);
 const window={webContents:wc,isDestroyed:()=>false,setEnabled:v=>events.push(['enabled',v]),hide:()=>events.push(['hide']),show:()=>events.push(['show']),focus:()=>{},loadURL:async url=>events.push(['url',url])};
 let ready,exited,launches=0,closes=0,current=true;
 const handoff=createNativeCardHandoff({window,origin,isCurrent:()=>current,prepareReturn:room=>events.push(['return',room]),
 createRunner:({onExit})=>{exited=onExit;return {launch:async options=>{launches++;events.push(['launch',options.room]);return result||new Promise(r=>ready=r);},close:()=>closes++};},onError:err=>events.push(['error',err.message])});
 const nav=url=>{let blocked=false;wc.emit('will-navigate',{url,preventDefault:()=>blocked=true});return blocked;};
 return {handoff,events,nav,resolve:()=>ready({ok:true,matchReady:true}),exit:()=>exited(),invalidate:()=>current=false,launches:()=>launches,closes:()=>closes};
}
(async()=>{
 for(const url of ['/start.html','/board_game.html?room=A','/game.html','/game.html?room=%20A','/game.html?room=A&server=https://evil.test'])assert.equal(matchRoom(origin+url,origin),null);
 assert.equal(matchRoom('https://evil.test/game.html?room=A',origin),null);
 assert.equal(matchRoom(origin+'/game.html?room=A&server='+encodeURIComponent(origin),origin),'A');
 const f=fixture();assert(!f.nav(origin+'/start.html'));assert.equal(f.launches(),0);
 assert(f.nav(origin+'/game.html?room=A'));assert.equal(f.handoff.state(),'starting');
 assert(f.nav(origin+'/game.html?room=A'));assert.equal(f.launches(),1);
 assert(!f.events.some(e=>e[0]==='url'||e[0]==='hide'),'Original socket must stay alive during native startup');
 f.resolve();await pause();assert.equal(f.handoff.state(),'playing');assert.deepEqual(f.events.filter(e=>e[0]==='url'),[['url','about:blank']]);
 await f.exit();assert.equal(f.handoff.state(),'lobby');assert.deepEqual(f.events.filter(e=>e[0]==='return'),[['return','A']]);assert.equal(f.events.filter(e=>e[0]==='url').at(-1)[1],origin+'/start.html?desktop=1');
 f.handoff.dispose();assert.equal(f.handoff.state(),'closed');
 const bad=fixture({ok:false,error:'fixture failure'});bad.nav(origin+'/game.html?room=B');await pause();assert.equal(bad.handoff.state(),'lobby');assert(!bad.events.some(e=>e[0]==='url'));assert.equal(bad.closes(),1);
 const cancelled=fixture();cancelled.nav(origin+'/game.html?room=C');cancelled.invalidate();cancelled.resolve();await pause();assert(!cancelled.events.some(e=>e[0]==='url'));assert.equal(cancelled.closes(),1);
 const auth={getSecretForGame:()=> 'fixture-not-a-user',accountSummary:()=>({userId:1}),getGameBootstrap:()=>({}),getPreferences:()=>({})};
 const b=await createNativeCardBridge({auth,assets:{},matchRoom:'A'});let confirmed=false;b.matchReady.then(()=>confirmed=true);
 const env=b.childEnvironment;const call=async(room,token=env.PO_NATIVE_DESKTOP_TOKEN)=>fetch(env.PO_NATIVE_DESKTOP_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','X-Po-Native':token},body:JSON.stringify({method:'cardMatchReady',args:{room}})});
 try{assert.equal((await call('B')).status,400);assert.equal((await call('A','wrong')).status,403);assert(!confirmed);assert.equal((await call('A')).status,200);await pause();assert(confirmed);assert.equal(env.PO_NATIVE_CARD_ROOM,'A');}finally{b.close();}
 console.log(JSON.stringify({passed:true,originalLobby:true,delayedDisconnect:true,duplicateNavigation:true,returnToOriginal:true,rollback:true,privateReadyProtocol:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});
