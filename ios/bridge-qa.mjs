import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
const nativeCalls = [], serverCalls = [], intervals = [];
let session = {};
const context = vm.createContext({ console, crypto:webcrypto, setTimeout, clearTimeout,
  setInterval: (...args) => { const id=setInterval(...args); intervals.push(id); return id; }, clearInterval,
  window: { webkit: { messageHandlers: { launcher: { postMessage: async value => {
    nativeCalls.push(value);
    if(value.method==='loadSession') return session;
    if(value.method==='saveSession') { session=structuredClone(value.args[0]); return {ok:true}; }
    if(value.method==='getAssetsState') return {games:{card:{status:'installed'},board:{status:'installed'},chess:{status:'installed'}}};
    if(value.method.includes('Update')) return {ok:false,state:{status:'unavailable'}};
    return {ok:true};
  } } } } },
});
context.window.io=()=>{
  const socket={connected:true,on:()=>socket,off:()=>socket,disconnect:()=>{socket.connected=false;},
    timeout:()=>socket,emit:(event,payload,callback)=>{
      serverCalls.push({event,payload});
      if(!callback)return;
      const result=event==='AUTH_LOGIN'?{ok:true,secret:'qa-session-only',username:payload.username}:
        event==='PROFILE_GET'?{ok:true,profile:{user_id:42,name:'測試船長',avatar:8,stats:{}}}:
        event==='LAUNCHER_SHOP_BUY'?{ok:false,error:'insufficient_coins'}:
        event==='FRIENDS_LIST'?{ok:true,friends:[],requestsIn:[],requestsOut:[]}:{ok:true};
      callback(null,result);
    }};
  return socket;
};
try {
  vm.runInContext(fs.readFileSync(new URL('./GameAssets/launcher/modules.js',import.meta.url),'utf8'),context);
  vm.runInContext(fs.readFileSync(new URL('./bridge.js',import.meta.url),'utf8'),context);
  const api=context.window.onePieceDesktop;
  const preload=fs.readFileSync(new URL('../desktop/preload.js',import.meta.url),'utf8');
  const expected=[...preload.matchAll(/^\s{2}(\w+):/gm)].map(m=>m[1]).sort();
  assert.deepEqual(Object.keys(api).sort(),expected);
  assert.equal((await api.getState()).authenticated,false);
  assert.equal((await api.buyLauncherItem('ava-1')).ok,false);
  assert.equal(serverCalls.some(c=>c.event==='LAUNCHER_SHOP_BUY'),false);
  assert.equal((await api.login({username:'TestUser',password:'qa-password-only'})).ok,true);
  assert.equal((await api.getState()).authenticated,true);
  assert.equal(session.secret,'qa-session-only');
  assert.equal(JSON.stringify(session).includes('qa-password-only'),false);
  assert.equal(session.state.account.userId,42);
  assert.equal((await api.buyLauncherItem('ava-1')).ok,false);
  assert.equal(session.state.account.coins,0);
  assert.equal((await api.launchGame('board')).ok,true);
  const launch=nativeCalls.find(c=>c.method==='launchGame');
  assert.equal(launch.args[1].op_board_user_id,'42');
  assert.equal(launch.args[1].opSecret,'qa-session-only');
  assert.equal((await api.getLauncherUpdateState()).state.status,'unavailable');
  await api.logout();
  assert.equal(session.secret,'');
  assert.equal(session.state.account,null);
  assert.equal((await api.getState()).authenticated,false);
  console.log(JSON.stringify({status:'PASS',contractMethods:expected.length,checks:['unauthenticated transaction blocked','password excluded from persistent session','server rejection preserved','game bootstrap matches account','logout clears native session','unfinished updater reported unavailable'],deviceAcceptance:'NOT_RUN'}));
} finally { for(const id of intervals)clearInterval(id); }
