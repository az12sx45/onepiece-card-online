'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('../server/index.js'),'utf8');
const constants=source.match(/const TURN_IDLE_MS[^]*?const IDLE_WARN_MS[^\n]+/)[0];
const fn=source.slice(source.indexOf('function armRoomWatchdogs('),source.indexOf('// ====== 房間清單',source.indexOf('function armRoomWatchdogs(')));
let checks=0;
for(const pending of [false,true])for(const waiting of [false,true]){
 let now=0,serial=0;const timers=new Map(),calls=[];
 const room={phase:'playing',state:{turnIndex:0,players:[{alive:true,isCPU:false},{alive:true,isCPU:false}],pending:pending?{target:1}:null}};
 const ctx={rooms:new Map([['QA',room]]),ensureRoomResilience(){},cardVenueReady:{waiting:()=>waiting},cardPresentationReady:{waiting:()=>false},pendingResponderId:s=>s.pending?.target??null,
 setTimeout(fn,ms){timers.set(++serial,{fn,at:now+ms});return serial},clearTimeout:id=>timers.delete(id),warnPlayerBeforeTakeover:(r,i)=>calls.push(['warn',i,now]),setPlayerAutoControl:(r,i)=>calls.push(['takeover',i,now]),emitRoomToast(){},runCpuLoop(){}};
 vm.runInNewContext(constants+'\n'+fn,ctx);ctx.armRoomWatchdogs('QA');
 const advance=t=>{for(const [id,item]of [...timers].sort((a,b)=>a[1].at-b[1].at))if(item.at<=t&&timers.has(id)){now=item.at;timers.delete(id);item.fn()}now=t};
 advance(30000);assert.equal(calls.length,0);checks++;
 advance(79999);assert.equal(calls.length,0);checks++;
 advance(80000);assert.equal(calls.filter(c=>c[0]==='warn').length,waiting?0:pending?2:1);checks++;
 advance(89999);assert.equal(calls.filter(c=>c[0]==='takeover').length,0);checks++;
 advance(90000);assert.equal(calls.filter(c=>c[0]==='takeover').length,waiting?0:pending?2:1);checks++;
}
console.log(JSON.stringify({passed:true,checks,scope:'Actual armRoomWatchdogs source under controlled timers: 90 seconds turn and pending, warning at 80 seconds, no timeout during venue-ready barrier.'}));
