import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('Sources/App.swift',import.meta.url),'utf8');
const script=source.match(/let frameRuntime = """([\s\S]*?)"""/)[1];
assert.match(source,/source:frameRuntime,injectionTime:\.atDocumentStart,forMainFrameOnly:false/);
assert.match(source,/source:injection,injectionTime:\.atDocumentStart,forMainFrameOnly:true/);
const calls=[];
function context(hostname,port){
  const sandbox={location:{hostname,port},navigator:{serviceWorker:{}},localStorage:{setItem(){throw new Error('frame changed account');},removeItem(){throw new Error('frame cleared account');}}};
  sandbox.window=sandbox;
  return vm.createContext(sandbox);
}
const local=context('127.0.0.1','49154');
vm.runInContext(script,local);
local.io=(...args)=>{calls.push(args);return {connected:false};};
local.io({transports:['websocket','polling']});
assert.equal(calls[0][0],'https://onepiece-card-online.onrender.com');
assert.deepEqual(calls[0][1].transports,['websocket','polling']);
local.io('http://127.0.0.1:49154',{reconnection:true});
assert.equal(calls[1][0],'https://onepiece-card-online.onrender.com');
local.io('https://example.com',{reconnection:false});
assert.equal(calls[2][0],'https://example.com');
assert.equal(local.devicePixelRatio,1);
const foreign=context('example.com','49154');vm.runInContext(script,foreign);
assert.equal(Object.hasOwn(foreign,'io'),false);
const launcher=context('127.0.0.1','49152');vm.runInContext(script,launcher);
assert.equal(Object.hasOwn(launcher,'io'),false);
console.log('PASS: iframe socket endpoint/options; external and launcher frames untouched; no account writes');
