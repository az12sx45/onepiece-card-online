const fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process');

// Minimal Socket.IO text framing for isolated server assertions; no extra dependency.
function io(url){const handlers={},ws=new (require('ws'))(url.replace('http','ws')+'/socket.io/?EIO=4&transport=websocket',{headers:{'User-Agent':'Mozilla/5.0 Chrome/144.0.0.0 Electron/44.1.1',Origin:url}});const s={connected:false,on(type,fn){(handlers[type]??=[]).push(fn);return s;},emit(type,value){ws.send('42'+JSON.stringify([type,value]));},disconnect(){s.connected=false;ws.close();}};ws.onmessage=event=>{const text=String(event.data);if(text.startsWith('0'))ws.send('40');else if(text.startsWith('40'))s.connected=true;else if(text==='2')ws.send('3');else if(text.startsWith('42')){const [type,value]=JSON.parse(text.slice(2));for(const fn of handlers[type]||[])fn(value);}};ws.onerror=()=>{};return s;}

const root=path.resolve(__dirname,'..'),port=30972,room='QA-resume-'+Date.now(),clients=[],checks=[];let log='';
const server=spawn(process.execPath,['scripts/card_group_server_fixture.js'],{cwd:root,windowsHide:true,env:{...process.env,DATABASE_URL:'',PORT:String(port)},stdio:['pipe','pipe','pipe']});server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
const wait=async(fn,ms=15000)=>{const until=Date.now()+ms;while(Date.now()<until){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Timed out: '+log.slice(-250));};
const check=(name,pass)=>{checks.push({name,pass});if(!pass)throw Error(name);};
async function join(secret,resumeOnly){const c=io('http://127.0.0.1:'+port);clients.push(c);c.secret=secret;c.on('JOINED',x=>c.id=x.playerId).on('STATE',x=>c.state=x).on('ROOM_UNAVAILABLE',x=>c.unavailable=x);await wait(()=>c.connected);c.emit('JOIN_ROOM',{roomId:room,displayName:'ResumeQA',secret,cpuCount:3,resumeOnly});return c;}
const action=(c,type,payload={})=>c.emit('ACTION',{roomId:room,playerId:c.id,secret:c.secret,type,payload});
(async()=>{let passed=false,failure;try{
 await wait(()=>log.includes('Server listening'));
 const missing=await join('missing',true);await wait(()=>missing.unavailable);check('Resume of missing room rejects instead of creating one seat',missing.id==null&&missing.unavailable.reason==='expired');missing.disconnect();
 const a=await join('owner',false);await wait(()=>a.id!=null);const b=await join('friend',false);await wait(()=>b.id!=null&&a.state?.players.length===2);action(a,'LOBBY_READY');action(b,'LOBBY_READY');await new Promise(r=>setTimeout(r,150));action(a,'START_GAME');await wait(()=>a.state?.players.length===5&&a.state.venueReady?.waiting);check('Normal lobby creation and CPU seats unchanged',true);
 const before=a.state.players.map(x=>x.id),seat=a.id;a.disconnect();const rejoined=await join('owner',true);await wait(()=>rejoined.id!=null&&rejoined.state?.players.length===5);check('Live reconnect restores same seat and all five players',rejoined.id===seat&&JSON.stringify(rejoined.state.players.map(x=>x.id))===JSON.stringify(before));
 server.stdin.write(JSON.stringify({room,scenario:'expire-room'})+'\n');await wait(()=>log.includes('"scenario":"expire-room"'));rejoined.disconnect();b.disconnect();
 const expired=await join('owner',true);await wait(()=>expired.unavailable);check('Expired game does not silently rebuild as solo lobby',expired.id==null&&!expired.state);
 passed=true;
 }catch(e){failure=e.stack;}finally{clients.forEach(c=>c.disconnect());spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true});const r={passed,checks,failure,scope:'Isolated real Socket.IO/engine; missing and explicitly expired rooms plus reconnect to original five seats'};fs.writeFileSync(process.env.CARD_QA_REPORT,JSON.stringify(r,null,2));console.log(JSON.stringify(r));if(!passed)process.exitCode=1;}})();
