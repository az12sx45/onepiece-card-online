'use strict';
const assert=require('node:assert/strict'),{stampCardResult}=require('../server/card-result-identity');
const room={},final={ranking:[{id:0,coins:4},{id:1,coins:1}],seasonNo:1};let clock=1000;
const delivery=()=>{const visible={final:structuredClone(final)};stampCardResult(room,visible,()=>clock++);return visible.final.endedAt;};
assert.equal(delivery(),1000);assert.equal(delivery(),1000); // two viewers and retransmission
assert.equal(delivery(),1000);assert.equal(final.endedAt,undefined); // authoritative state unchanged
stampCardResult(room,{turnStep:'draw',final:null},()=>clock++); // same room starts another full match
assert.equal(delivery(),1001);assert.equal(delivery(),1001); // second match is awarded once, independently
const other={};const vis={final:structuredClone(final)};stampCardResult(other,vis,()=>clock++);assert.equal(vis.final.endedAt,1002);
assert.equal(vis.nativeCardProtocol,1);
console.log(JSON.stringify({passed:true,checks:8,retransmissionStable:true,sameRoomNewMatchDistinct:true,rulesStateUnchanged:true}));
