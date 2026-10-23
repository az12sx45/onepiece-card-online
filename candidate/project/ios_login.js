'use strict';
const {Callable}=require('godot');
// Keep AUTH_LOGIN/PROFILE_GET, identity checks and session persistence owned by
// the existing account controller. Passwords are never logged or persisted.
exports.bind=function(root,account,enter){
 let busy=false,closed=false;
 const handler=Callable.create(root,async(username,password)=>{
  if(busy||closed)return;busy=true;
  try{
   const result=await account.authenticate({username,password});password='';
   if(closed)return;
   if(result?.ok===true)await enter();else root.call('login_failed');
  }catch{if(!closed)root.call('login_failed');}
  finally{password='';busy=false;}
 });
 root.connect('login_requested',handler);
 return ()=>{closed=true;root.disconnect('login_requested',handler);};
};
