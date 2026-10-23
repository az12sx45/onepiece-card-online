'use strict';
// A transport can reconnect before the server expires its old socket. Retry
// normal admission only; never force takeover or mutate the room/save payload.
exports.create=function({socket,setTimer,clearTimer,now,onExhausted}){
 let accepted=false,active=null,disposed=false;
 const stats={retries:0,recovered:0,exhausted:0};
 function cancel(){
  if(active?.timer!=null)clearTimer(active.timer);
  if(active?.deadlineTimer!=null)clearTimer(active.deadlineTimer);
  active=null;
 }
 const disconnected=()=>cancel();
 socket.on('disconnect',disconnected);
 function emit(payload,callback){
  cancel();
  const job={socketId:socket.id,deadline:now()+60000,timer:null,deadlineTimer:null,attempt:0,retried:false,lastBusy:null};
  active=job;
  const eligible=accepted&&Object.prototype.hasOwnProperty.call(payload,'knownVersion');
  function current(){return !disposed&&active===job&&socket.connected&&socket.id===job.socketId;}
  function exhausted(result){if(!current())return;stats.exhausted++;cancel();callback(result);onExhausted(result);}
  if(eligible)job.deadlineTimer=setTimer(()=>exhausted(job.lastBusy||{ok:false,error:'reconnect_join_timeout'}),60000);
  function send(){
   if(!current())return;
   job.timer=null;
   socket.emit('BOARD_JOIN_GAME',payload,(result={})=>{
    if(!current())return;
    if(eligible&&result.error==='campaign_already_connected'){
     job.lastBusy=result;
     const remaining=job.deadline-now();
     if(remaining>0&&job.attempt<14){
      job.retried=true;stats.retries++;
      const delay=Math.min(remaining,Math.min(5000,1000*2**job.attempt++));
      job.timer=setTimer(send,delay);return;
     }
     exhausted(result);return;
    }
    cancel();
    if(result.ok){accepted=true;if(job.retried)stats.recovered++;}
    callback(result);
   });
  }
  send();
  return socket;
 }
 return {emit,stats,dispose(){disposed=true;cancel();socket.off('disconnect',disconnected);}};
};
