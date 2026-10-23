'use strict';
// Presentation queue for the original spectator visual protocol. No rules,
// network versions, rewards or turn state are modified here.
exports.create=function({update,play,resume,reportError}){
 let active=false,disposed=false,latest=null,hasLatest=false;
 const queue=[],seen=new Set();
 async function drain(){
  if(active||disposed)return;active=true;
  try{
   while(queue.length&&!disposed){const view=queue.shift();update(view);const event=view?.battle?.visualEvent;if(event?.id)await play(event);}
  }catch(error){reportError(error);}
  finally{
   active=false;
   if(!disposed){
    if(queue.length){void drain();return;}
    if(hasLatest){const view=latest;latest=null;hasLatest=false;update(view);}
    resume();
   }
  }
 }
 function enqueue(view){
  const id=String(view?.battle?.visualEvent?.id||'');
  if(disposed||!id||seen.has(id))return false;
  seen.add(id);while(seen.size>512)seen.delete(seen.values().next().value);
  queue.push(view);void drain();return true;
 }
 return {
  refresh(view){return enqueue(view);},
  update(view){
   if(disposed)return;
   if(view?.battle?.canControl===false&&enqueue(view))return;
   if(active||queue.length){latest=view;hasLatest=true;}else update(view);
  },
  status:()=>({active,pending:queue.length}),
  dispose(){disposed=true;queue.length=0;latest=null;hasLatest=false;},
 };
};
