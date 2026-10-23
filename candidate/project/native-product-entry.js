'use strict';
const {Node,Callable}=require('godot');require('./native-timers').install();
// Real product composition. No probe-host, local server, fixture credentials,
// initial game snapshots, launch arguments or automatic room creation.
class NativeProductEntry extends Node{
 _ready(){setTimeout(()=>this.start().catch(()=>this.get_parent().call('show_failure','unavailable')),0);}
 async start(){
  const root=this.get_parent(),account=require('./native-account-service').create({websocketPool:root.get_node('Pool'),sessionNode:root.get_node('Session')});
  const http=require('./native-runtime-http').create(root.get_node('Http'));
  const social=require('./native-product-social').create({account,node:root.get('social_page'),notify:text=>root.call('notify_player',text)});
  const randomValues=array=>{
   if(!ArrayBuffer.isView(array)||![Int8Array,Uint8Array,Uint8ClampedArray,Int16Array,Uint16Array,Int32Array,Uint32Array].some(type=>array instanceof type)||array.byteLength>65536)throw TypeError('Expected bounded integer typed array');
   if(!array.byteLength)return array;
   const hex=root.call('random_hex',array.byteLength),bytes=new Uint8Array(array.buffer,array.byteOffset,array.byteLength);
   if(hex.length!==bytes.length*2)throw Error('Native random source unavailable');for(let i=0;i<bytes.length;i++)bytes[i]=parseInt(hex.slice(i*2,i*2+2),16);return array;
  };
  const lifecycle=require('./native-product-lifecycle').create({account,view:{loading:()=>root.call('show_loading'),failure:kind=>root.call('show_failure',kind),returnToLauncher:()=>root.get_tree().call_deferred('reload_current_scene')},openFriends:()=>social.show(),createSession:({openFriends})=>require('./native-product-session').create({root,account,http,randomValues,openFriends})});
  const unbindLogin=require('./ios_login').bind(root,account,()=>lifecycle.retry());
  let closing=false;
  this.release=async()=>{if(closing)return;closing=true;social.dispose();await lifecycle.dispose();http.dispose();};
  const retry=Callable.create(root,()=>{lifecycle.retry().catch(()=>root.call('show_failure','unavailable'));});
  const leave=Callable.create(root,()=>{account.clear().then(()=>this.release()).then(()=>root.get_tree().call_deferred('reload_current_scene')).catch(()=>root.call('show_failure','unavailable'));});
  root.connect('retry_requested',retry);root.connect('return_requested',leave);
  this.unbind=()=>{unbindLogin();root.disconnect('retry_requested',retry);root.disconnect('return_requested',leave);};
  await lifecycle.start();
 }
 _exit_tree(){this.unbind?.();this.release?.().catch(()=>{});}
}
exports.default=NativeProductEntry;
