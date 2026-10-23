'use strict';
// Storage adapter, not an account mock. Credential persistence is separate.
exports.create=function(native,credentialService=null){
 const initial=JSON.parse(native.call('open_json'));if(!initial.ok){const error=Error('Native storage unavailable: '+initial.error);error.name='NativeStorageError';throw error;}
 const request=input=>{const result=JSON.parse(native.call('request_json',JSON.stringify(input)));if(!result.ok){const error=new Error(result.error);error.name='NativeStorageError';throw error;}return result;};
 const secret=key=>key==='op_secret'||key==='opSecret';
 return {
  getItem(key){key=String(key);if(secret(key)){if(!credentialService)throw Error('Native credential service unavailable');return credentialService.getSecret()||null;}return request({operation:'get',key}).value;},
  setItem(key,value){key=String(key);if(secret(key))throw Error('Use the authenticated native credential service');request({operation:'set',key,value:String(value)});},
  removeItem(key){key=String(key);if(secret(key))throw Error('Use native account sign-out');request({operation:'remove',key});},
  clear(){request({operation:'clear'});},
  get length(){return request({operation:'keys'}).keys.length;},
  key(index){return request({operation:'keys'}).keys[Number(index)>>>0]??null;},
 };
};
exports.session=function(){const values=new Map();return {getItem:key=>values.get(String(key))??null,setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(String(key)),clear:()=>values.clear(),get length(){return values.size;},key:index=>[...values.keys()][Number(index)>>>0]??null};};
