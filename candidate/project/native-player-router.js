'use strict';
const {FileAccess}=require('godot');
// The native shell owns mounting/dismounting. All lobby and game actions still
// enter the original controllers. Credentials never become route parameters.
exports.create=function({context,shell,fetch}){
 for(const name of ['mountLobby','mountGame','unmount','loading','ready','error'])if(typeof shell[name]!=='function')throw Error('Native player shell missing '+name);
 if(!context.active()||typeof fetch!=='function')throw Error('Verified player context required');
 let current=null,epoch=0,closed=false,queue=Promise.resolve();
 const parse=url=>{const match=String(url).match(/^(board_start|board_game)\.html(\?[^#]*)?$/);if(!match)throw Error('Native player route unsupported');return {page:match[1],search:match[2]||'',url:String(url)};};
 async function release(entry){if(!entry)return;entry.alive=false;if(entry.binding)entry.binding.dispose();if(entry.core)entry.core.dispose();entry.socket?.dispose();entry.scope?.dispose();if(entry.game)await entry.game.dispose();await shell.unmount(entry.node);}
 async function transition(route){
  if(closed||!context.active())throw Error('Native player session unavailable');
  const token=++epoch;shell.loading();const previous=current;current=null;await release(previous);
  let next={alive:true,token,node:null,url:route.url,page:route.page};
  const navigate=url=>{if(!next.alive||closed||next.token!==epoch)return Promise.resolve(false);return go(url);};
  try{
   if(route.page==='board_start'){
    next.node=await shell.mountLobby();next.scope=require('./native-runtime-scope').create(context.host.window,route.search,navigate,'/board_start.html');next.socket=require('./native-scene-socket').create(context.host.entrySession.socket);
    let binding=null;const ui=require('./native-lobby-controls').create(JSON.parse(FileAccess.get_file_as_string('res://lobby-controls.json')),()=>binding?.schedule());
    const host={...context.host,window:next.scope.window,entrySession:{ready:true,socket:next.socket.socket},refs:ui.refs,document:ui.document,navigate};
    next.core=require('./original-lobby').create(host);binding=require('./native-lobby-scene').bind(next.node,next.core,ui);next.binding=binding;next.ui=ui;next.core.start();binding.refresh();
   }else{
    // Membership is checked before mounting or contacting the game service.
    const query=new context.host.URLSearchParams(route.search);context.shared.getLobby(query.get('room'));
    next.node=await shell.mountGame();next.game=require('./native-game-runtime').create({context,application:next.node,search:route.search,fetch,navigate});await next.game.start();
   }
   // Keep the transition frame until the destination really has its textures
   // and original server state/wait screen, rather than exposing a blank page.
   const deadline=Date.now()+30000;
   while(!next.node.call('presentation_is_ready')||(next.game&&!next.game.core.boardLan.joinedOnce&&next.game.modal.model?.kind!=='network-status')){
    if(closed||token!==epoch)throw Error('Native route superseded');
    if(Date.now()>deadline)throw Error('Native destination did not become ready');
    await new Promise(resolve=>setTimeout(resolve,16));
   }
   if(closed||token!==epoch)throw Error('Native route superseded');current=next;await shell.ready(next.node);return true;
  }catch(error){await release(next);shell.error(error.message);throw error;}
 }
 function go(url){let route;try{route=parse(url);}catch(error){shell.error(error.message);return Promise.reject(error);}const task=queue.then(()=>transition(route));queue=task.catch(()=>{});return task;}
 return {navigate:go,current:()=>current,async dispose(){if(closed)return;closed=true;epoch++;await queue;const old=current;current=null;await release(old);}};
};
