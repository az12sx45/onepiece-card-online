'use strict';
const {Callable}=require('godot');require('./native-timers').install();
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function encode(bytes){let result='';for(let i=0;i<bytes.length;i+=3){const a=bytes[i],b=bytes[i+1],c=bytes[i+2];result+=alphabet[a>>2]+alphabet[(a&3)<<4|(b??0)>>4]+(b===undefined?'=':alphabet[(b&15)<<2|(c??0)>>6])+(c===undefined?'=':alphabet[c&63]);}return result;}
function decode(value){const text=String(value),size=text.length/4*3-(text.endsWith('==')?2:text.endsWith('=')?1:0),bytes=new Uint8Array(size);let j=0;for(let i=0;i<text.length;i+=4){const n=(alphabet.indexOf(text[i])<<18)|(alphabet.indexOf(text[i+1])<<12)|((alphabet.indexOf(text[i+2])&63)<<6)|(alphabet.indexOf(text[i+3])&63);if(j<size)bytes[j++]=n>>16&255;if(j<size)bytes[j++]=n>>8&255;if(j<size)bytes[j++]=n&255;}return bytes.buffer;}
exports.install=function(pool){
 const sockets=new Map(),callbacks=[];let serial=0;
 const connect=(signal,fn)=>{const cb=Callable.create(pool,fn);pool.connect(signal,cb);callbacks.push([signal,cb]);};
 class NativeWebSocket{
  constructor(url,protocols=[]){this.url=String(url);this.readyState=0;this.binaryType='arraybuffer';this.protocol='';this.extensions='';this.listeners=new Map();this.id=++serial;sockets.set(this.id,this);const code=pool.call('start',this.id,this.url,JSON.stringify(typeof protocols==='string'?[protocols]:protocols));if(code!==0)setTimeout(()=>{this.dispatch('error',{message:'native_websocket_start_'+code});this.readyState=3;this.dispatch('close',{code:1006,reason:'native transport unavailable',wasClean:false});sockets.delete(this.id);},0);}
  get bufferedAmount(){return pool.call('buffered',this.id);}
  send(value){if(this.readyState===0)throw Error('WebSocket is connecting');if(this.readyState!==1)return;let binary=false;if(value instanceof ArrayBuffer||ArrayBuffer.isView(value)){binary=true;value=encode(value instanceof ArrayBuffer?new Uint8Array(value):new Uint8Array(value.buffer,value.byteOffset,value.byteLength));}else value=String(value);const code=pool.call('send',this.id,value,binary);if(code!==0)throw Error('Native WebSocket send failed '+code);}
  close(code=1000,reason=''){if(this.readyState>=2)return;this.readyState=2;pool.call('close_peer',this.id,code,String(reason));}
  addEventListener(type,callback){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(callback);}
  removeEventListener(type,callback){this.listeners.get(type)?.delete(callback);}
  dispatch(type,detail){const event={...detail,type,target:this};this['on'+type]?.(event);for(const cb of this.listeners.get(type)||[])cb(event);}
 }
 Object.assign(NativeWebSocket,{CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3});Object.assign(NativeWebSocket.prototype,{CONNECTING:0,OPEN:1,CLOSING:2,CLOSED:3});
 connect('peer_opened',(id,protocol)=>{const socket=sockets.get(id);if(socket){socket.readyState=1;socket.protocol=protocol;socket.dispatch('open',{});}});
 connect('peer_message',(id,value,binary)=>{const socket=sockets.get(id);if(socket)socket.dispatch('message',{data:binary?decode(value):value});});
 connect('peer_failed',(id,message)=>sockets.get(id)?.dispatch('error',{message}));
 connect('peer_closed',(id,code,reason)=>{const socket=sockets.get(id);if(socket){socket.readyState=3;socket.dispatch('close',{code:code<0?1006:code,reason,wasClean:code>=1000});sockets.delete(id);}});
 globalThis.WebSocket=NativeWebSocket;
 return {WebSocket:NativeWebSocket,active:()=>sockets.size,dispose(){for(const socket of sockets.values())socket.close();for(const [signal,cb] of callbacks)pool.disconnect(signal,cb);callbacks.length=0;sockets.clear();}};
};
