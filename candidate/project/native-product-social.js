'use strict';
const {Callable}=require('godot');
// Uses the existing launcher social controller, including validation and server
// acknowledgements. Only the visible projection is native, with stable row ids.
exports.create=function({account,node,notify}){
 let opened=false,peer=0,busy=false,closed=false,last='',owner=0;
 const snapshot=()=>account.socialState()||{};
 function render(){
  if(!opened||closed)return;const state=snapshot();if(owner!==state.userId){owner=state.userId;peer=0;node.call('clear_input');}const friends=state.friends||[],person=friends.find(p=>p.userId===peer);
  if(peer&&!person)peer=0;
  const time=ts=>{const d=new Date(Number(ts)||Date.now());return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
  const rows=peer?(state.conversations?.[peer]||[]).map(m=>({key:'message:'+m.id,text:(m.from===state.userId?'我':person.name)+'　'+time(m.ts)+'\n'+m.body,actions:[]})):[
   ...(state.requestsIn||[]).map(p=>({key:'incoming:'+p.userId,text:p.name+'　好友邀請',actions:[{key:'accept:'+p.userId,label:'接受'},{key:'decline:'+p.userId,label:'拒絕'}]})),
   ...(state.requestsOut||[]).map(p=>({key:'outgoing:'+p.userId,text:p.name+'　等待對方確認',actions:[]})),
   ...friends.map(p=>({key:'friend:'+p.userId,text:p.name+'　'+(p.online?'在線':'離線')+(state.unread?.[p.userId]?'　未讀 '+state.unread[p.userId]:''),actions:[{key:'chat:'+p.userId,label:'聊天'},{key:'remove:'+p.userId,label:'移除'}]}))];
  const model={title:peer?'與 '+person.name+' 聊天':'好友與聊天',ready:state.ready===true,busy,chat:!!peer,rows,empty:peer?'尚無聊天訊息。':state.ready?'目前沒有好友。可在下方輸入對方的玩家名稱送出邀請。':'正在讀取好友清單…'};
  const json=JSON.stringify(model);if(json!==last){node.call('apply_json',json);last=json;}
 }
 async function perform(key,value=''){
  if(closed||!opened)return;
  if(key==='close'){if(peer){peer=0;render();}else{opened=false;last='';node.call('hide');}return;}
  if(busy)return;
  const [action,id]=String(key).split(':');const userId=Number(id);
  if(action==='chat'){if(!snapshot().friends?.some(p=>p.userId===userId))return;peer=userId;render();}
  const operation=action==='chat'?'history':action==='submit'?(peer?'send':'add'):action;
  if(!['refresh','history','send','add','accept','decline','remove'].includes(operation))return;
  const payload=operation==='add'?{name:value}:operation==='send'?{userId:peer,body:value}:{userId};
  busy=true;render();
  try{
   const result=await account.socialRequest(operation,payload);if(closed)return;
   if(result?.ok){if(operation==='send'||operation==='add')node.call('clear_submitted_input',value);if(operation==='history')await account.socialRequest('read',{userId:payload.userId});}
   else notify('操作未完成，請確認連線後再試。');
  }catch{if(!closed)notify('好友服務暫時無法連線，請稍後再試。');}
  finally{busy=false;if(!closed)render();}
 }
 const command=Callable.create(node,(key,value)=>{perform(String(key),String(value)).catch(()=>notify('好友操作未完成。'));});node.connect('command_requested',command);
 const unsubscribe=account.subscribe(event=>{if(event==='social-state')render();});
 return {show(){if(closed)return;opened=true;render();node.call('show');perform('refresh');},dispose(){if(closed)return;closed=true;opened=false;unsubscribe();node.disconnect('command_requested',command);node.call('hide');}};
};
