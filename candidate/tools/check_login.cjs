'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const candidate=path.resolve(process.argv[2]);
const create=require(path.join(candidate,'project/original-account.js')).create;
async function exercise({badLogin=false,storageFailure=false}={}){
 const calls=[],native=[],listeners=new Map();let vault={},disconnected=false;
 const socket={connected:true,on(n,fn){listeners.set(n,fn);return this;},once(){return this;},off(){return this;},connect(){},disconnect(){disconnected=true;},timeout(){return this;},emit(event,payload,callback){
  calls.push({event,payload});let result={ok:true};
  if(event==='AUTH_LOGIN')result=badLogin?{ok:false,error:'invalid credentials'}:{ok:true,secret:'fixture-session',username:'fixture'};
  if(event==='PROFILE_GET')result={ok:true,profile:{user_id:123,name:'Fixture',avatar:8,stats:{}}};
  if(callback)queueMicrotask(()=>callback(null,result));return this;
 }};
 const account=create({nativeCall:async(method,args)=>{
  native.push(method);
  if(method==='getNativeState')return {ok:true,deviceId:'ios-fixture',account:null,secret:'',preferences:{}};
  if(method==='saveSession'){if(storageFailure)return {ok:false,error:'storage unavailable'};vault={...args};return {ok:true};}
  if(method==='clearSession'){vault={};return {ok:true};}
  throw Error('Unexpected native call');
 },io:(origin,options)=>{assert.equal(origin,'https://onepiece-card-online.onrender.com');return socket;},socialFactory:()=>({on(){},async start(){},reset(){},stop(){}})});
 await account.load();assert.equal(account.snapshot().authenticated,false);
 const result=await account.authenticate({username:' FIXTURE ',password:'fixture-password'});
 const login=calls.find(x=>x.event==='AUTH_LOGIN');assert.deepEqual(login.payload,{username:'fixture',password:'fixture-password',deviceId:'ios-fixture'});
 if(badLogin||storageFailure){assert.notEqual(result.ok,true);assert.equal(account.snapshot().authenticated,false);assert.deepEqual(vault,{});}
 else {assert.equal(result.ok,true);assert.equal(account.snapshot().account.userId,123);assert.equal(vault.secret,'fixture-session');assert.equal(JSON.stringify(vault).includes('fixture-password'),false);await account.clear();assert.equal(account.getSecret(),'');}
 account.dispose();assert.equal(disconnected,true);return native.length+calls.length;
}
(async()=>{await exercise();await exercise({badLogin:true});await exercise({storageFailure:true});console.log('PASS: existing AUTH_LOGIN/profile contract, success, refusal, secure-store failure and clear; isolated fixtures only');})().catch(error=>{console.error(error);process.exitCode=1;});
