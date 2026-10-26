'use strict';
// Player entry context. Requires a verified account and real storage supplied by
// the platform; no test player, room, saved game or response is created here.
const source=require('./original-profile');
class QueryParameters{
 constructor(text=''){this.entries=[];if(text&&typeof text==='object'){this.entries=Array.isArray(text)?text.map(([k,v])=>[String(k),String(v)]):Object.entries(text).map(([k,v])=>[k,String(v)]);return;}for(const part of String(text).replace(/^\?/,'').split('&')){if(!part)continue;const split=part.indexOf('='),decode=v=>decodeURIComponent(v.replace(/\+/g,' '));this.entries.push([decode(split<0?part:part.slice(0,split)),decode(split<0?'':part.slice(split+1))]);}}
 get(key){return this.entries.find(pair=>pair[0]===String(key))?.[1]??null;}
 has(key){return this.entries.some(pair=>pair[0]===String(key));}
 set(key,value){key=String(key);this.entries=this.entries.filter(pair=>pair[0]!==key);this.entries.push([key,String(value)]);}
 toString(){return this.entries.map(pair=>pair.map(value=>encodeURIComponent(value)).join('=')).join('&');}
}
exports.QueryParameters=QueryParameters;
exports.create=function({account,storage,sessionStorage,randomValues,search='',navigate,notify,openFriends}){
 for(const [name,fn]of Object.entries({randomValues,navigate,notify,openFriends}))if(typeof fn!=='function')throw Error('Native player context missing '+name);
 const initial=account.snapshot(),userId=Number(initial.account?.userId);
 if(initial.authenticated!==true||!Number.isSafeInteger(userId)||userId<=0||!account.getSecret())throw Error('Verified account required for player entry');
 if(!initial.deviceId||storage.getItem('opSecret')!==account.getSecret())throw Error('Authenticated credential storage unavailable');
 let disposed=false,unsubscribe=null;const listeners=new Map(),socketListeners=[],socketIdentity=Symbol('native-account-socket');
 const active=()=>!disposed&&account.snapshot().authenticated===true&&Number(account.snapshot().account?.userId)===userId&&!!account.getSecret();
 const guard=()=>{if(!active())throw Error('Player account session changed');};
 // This is the same non-secret seed mapping as SessionVault.bootstrapScript.
 for(const field of source.seedFields)storage.setItem(field.key,String(initial.account[field.field]??field.fallback));
 storage.setItem('op_device_id',initial.deviceId);
 const window={location:{search},crypto:{getRandomValues:randomValues},setTimeout,clearTimeout,setInterval,clearInterval,requestAnimationFrame:fn=>setTimeout(()=>fn(Date.now()),0),scrollTo(){},
  addEventListener(name,fn){const list=listeners.get(name)||[];list.push(fn);listeners.set(name,list);},
  removeEventListener(name,fn){listeners.set(name,(listeners.get(name)||[]).filter(item=>item!==fn));}
 };
 const host={window,localStorage:storage,sessionStorage,URLSearchParams:QueryParameters},helpers=source.create(host),profile=helpers.createProfile();
 if(profile.userId!==userId||profile.secret!==account.getSecret())throw Error('Original BoardShared profile does not match verified account');
 const realSocket=account.getSocket();
 const socket=new Proxy(realSocket,{get(target,key){
  if(key===socketIdentity)return realSocket;
  if(key==='on'||key==='once')return (event,callback)=>{guard();const wrapped=(...args)=>{if(active())callback(...args);};socketListeners.push({event,callback,wrapped});target[key](event,wrapped);return socket;};
  if(key==='off')return (event,callback)=>{for(let i=socketListeners.length-1;i>=0;i--){const entry=socketListeners[i];if(entry.event===event&&entry.callback===callback){target.off(event,entry.wrapped);socketListeners.splice(i,1);}}return socket;};
  if(key==='emit')return (event,...args)=>{guard();return target.emit(event,...guardReplies(args));};
  if(key==='timeout')return ms=>({emit(event,...args){guard();return target.timeout(ms).emit(event,...guardReplies(args));}});
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
 function guardReplies(args){return args.map(value=>typeof value==='function'?(...reply)=>{if(active())value(...reply);}:value);}
 const state={page:'board',roomId:'',currentInviteMode:'board',profile,rooms:[],socialReady:false,socialLoading:false,socialError:'',friends:[],requestsIn:[],requestsOut:[],unread:new Map()};
 const dispatch=(name,detail)=>{if(active())for(const fn of listeners.get(name)||[])fn({detail});};
 const socialChanged=()=>{const social=account.socialState()||{};state.socialReady=social.ready===true&&Number(social.userId)===userId;state.friends=social.friends||[];state.requestsIn=social.requestsIn||[];state.requestsOut=social.requestsOut||[];state.unread=new Map(Object.entries(social.unread||{}));dispatch('board:social-updated',{ready:state.socialReady,friendCount:state.friends.length,onlineCount:state.friends.filter(friend=>friend.online).length,requestCount:state.requestsIn.length,unreadCount:[...state.unread.values()].reduce((a,b)=>a+Number(b||0),0)});};
 const shared={avatarUrlById:helpers.avatarUrlById,showToast:notify,getState:()=>state,getRooms:()=>state.rooms.map(room=>({...room})),saveRooms(rooms){guard();state.rooms=rooms.map(room=>({...room}));helpers.writeJson(helpers.STORAGE_KEYS.boardRoom,state.rooms);},setRoomContext(roomId,mode='board'){guard();state.roomId=String(roomId||'').trim();state.currentInviteMode=String(mode||'board').trim();},saveLobby(lobby){guard();helpers.writeJson(helpers.STORAGE_KEYS.boardLobby,lobby);},getLobby(roomId){guard();const lobby=helpers.readJson(helpers.STORAGE_KEYS.boardLobby,null);if(!lobby||String(lobby.roomCode||lobby.roomId).toUpperCase()!==String(roomId).trim().toUpperCase()||!lobby.players?.some(player=>Number(player.userId)===userId))throw Error('Verified room membership unavailable');return lobby;},attachSocket(value){guard();if(value?.[socketIdentity]!==realSocket)throw Error('Lobby must reuse verified account socket');},openFriends(){guard();openFriends();},refreshFriends(){guard();return account.socialRequest('refresh');}};
 window.BoardShared=shared;
 function dispose(){if(disposed)return;disposed=true;for(const {event,wrapped}of socketListeners)realSocket.off(event,wrapped);socketListeners.length=0;listeners.clear();profile.secret='';sessionStorage.clear();unsubscribe?.();}
 unsubscribe=account.subscribe((name)=>{if(!active()){dispose();notify('帳號已變更，請重新進入遊戲。');return;}if(name==='social-state')socialChanged();});socialChanged();
 return {profile,shared,host:{...host,shared,initData:{profile,lobby:null},entrySession:{ready:true,socket},navigate:async url=>{guard();return navigate(url);},getLobby:shared.getLobby},active,dispose};
};
