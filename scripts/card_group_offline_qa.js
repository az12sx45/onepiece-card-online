const fs=require('node:fs'),path=require('node:path'),{spawn,spawnSync}=require('node:child_process');

// Minimal Socket.IO text framing for isolated server assertions; no extra dependency.
function io(url){const handlers={},ws=new (require('ws'))(url.replace('http','ws')+'/socket.io/?EIO=4&transport=websocket',{headers:{'User-Agent':'Mozilla/5.0 Chrome/144.0.0.0 Electron/44.1.1',Origin:url}});const s={connected:false,on(type,fn){(handlers[type]??=[]).push(fn);return s;},emit(type,value){ws.send('42'+JSON.stringify([type,value]));},disconnect(){s.connected=false;ws.close();}};ws.onmessage=event=>{const text=String(event.data);if(text.startsWith('0'))ws.send('40');else if(text.startsWith('40'))s.connected=true;else if(text==='2')ws.send('3');else if(text.startsWith('42')){const [type,value]=JSON.parse(text.slice(2));for(const fn of handlers[type]||[])fn(value);}};ws.onerror=()=>{};return s;}
const root=path.resolve(__dirname,'..'),port=30970,room='QA-offline-'+Date.now(),clients=[],states=[],ids=[],acks=new Set(),checks=[];const finalMode=process.env.CARD_QA_FINAL==='1';let log='',automatic=false,endedAt=0,endedRound=null,offlineId=null;
const server=spawn(process.execPath,['scripts/card_group_server_fixture.js'],{cwd:root,windowsHide:true,env:{...process.env,DATABASE_URL:'',PORT:String(port)},stdio:['pipe','pipe','pipe']});server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);
const wait=async(fn,ms=30000)=>{const until=Date.now()+ms;while(Date.now()<until){if(fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Timed out');};
const check=(name,pass)=>{checks.push({name,pass});if(!pass)throw Error(name);};
const action=(i,type,payload={})=>clients[i].emit('ACTION',{roomId:room,playerId:ids[i],secret:'offline-'+i+'-'+room,type,payload});
(async()=>{let passed=false,failure;try{
 await wait(()=>log.includes('Server listening'));
 for(let i=0;i<3;i++){
  const s=io('http://127.0.0.1:'+port,{transports:['websocket'],reconnection:false});clients.push(s);
  s.on('JOINED',x=>{ids[i]=x.playerId;});
  s.on('STATE',x=>{states[i]=x;if(!automatic||!x.presentationReady?.waiting)return;const g=x.presentationReady;if(finalMode&&x.final&&!endedAt){endedAt=Date.now();endedRound=x.roundNo;}if(!finalMode&&x.turnStep==='ended'&&i===2){if(!endedAt){endedAt=Date.now();endedRound=x.roundNo;offlineId=ids[i];s.disconnect();}return;}const key=i+'/'+g.id;if(!acks.has(key)){acks.add(key);action(i,'PRESENTATION_READY',{id:g.id,roundNo:g.roundNo});}});
  await wait(()=>s.connected);s.emit('JOIN_ROOM',{roomId:room,displayName:'OfflineQA'+i,secret:'offline-'+i+'-'+room,cpuCount:3});await wait(()=>ids[i]!=null&&states[i]);
 }
 await wait(()=>states[0].players.length===3);for(let i=0;i<3;i++)action(i,'LOBBY_READY');await new Promise(r=>setTimeout(r,150));action(0,'START_GAME');await wait(()=>states.every(s=>s.players.length===6&&s.venueReady?.waiting));
 for(let i=0;i<3;i++){const g=states[i].venueReady;action(i,'VENUE_READY',{id:g.id,roundNo:g.roundNo});}
 await wait(()=>states.every(s=>!s.venueReady.waiting));automatic=true;server.stdin.write(JSON.stringify({room,scenario:finalMode?'game-final':'cpu-final'})+'\n');await wait(()=>endedAt>0,45000);
 if(finalMode){
  await wait(()=>!states[0].presentationReady.waiting);await new Promise(r=>setTimeout(r,4500));
  check('finished game does not automatically create another round',states[0].roundNo===endedRound&&!!states[0].final);
  action(0,'NEXT_ROUND');await new Promise(r=>setTimeout(r,500));check('manual next round cannot bypass final settlement',states[0].roundNo===endedRound&&!!states[0].final);
 }else{
 await wait(()=>states[0].presentationReady.ready.length===2);
 check('eliminated disconnected viewer remains required during grace',states[0].presentationReady.required.includes(offlineId)&&states[0].presentationReady.waiting);
 await wait(()=>Date.now()-endedAt>=4200);check('auto next does not jump past disconnected viewer grace',states[0].roundNo===endedRound);
 await wait(()=>states[0].roundNo===endedRound+1,15000);
 check('after grace CPU takeover releases presentation wait',states[0].players[offlineId].isCPU===true);
 check('fresh venue requires remaining connected humans only',states[0].venueReady.required.length===2&&states[0].venueReady.waiting);
 }
 passed=true;
 }catch(e){failure=e.stack;}finally{for(const c of clients)c.disconnect();spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true});const report={passed,checks,failure,scope:finalMode?'Real isolated Socket.IO/engine: final chest settlement blocks automatic and manual next round; test-only state seed, no physical devices.':'Real isolated Socket.IO/engine: eliminated viewer disconnects during CPU victory; 8-second grace, takeover and fresh venue gate. Test-only state seed; no physical devices.'};if(!passed){report.log=log.slice(-2000);process.exitCode=1;}if(process.env.CARD_QA_REPORT)fs.writeFileSync(process.env.CARD_QA_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}})();
