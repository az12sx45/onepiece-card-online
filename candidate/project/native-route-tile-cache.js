'use strict';
// The packaged map layout is immutable for a game instance. Repeated LAN loads
// rebuild route objects, but their lookup keys still address that same layout.
// Cache only the original geometry lookup, never game/island/reward state.
exports.create=function(original,routeKeys,layout){
 let source=null;const entries=new Map(),stats={hits:0,misses:0};
 function lookup(route,step,total=5){
  const current=layout();if(current!==source){source=current;entries.clear();}
  const key=JSON.stringify([routeKeys(route),step,total]);
  if(entries.has(key)){stats.hits++;return entries.get(key);}
  const value=original(route,step,total);stats.misses++;
  if(entries.size>=4096)entries.delete(entries.keys().next().value);
  entries.set(key,value);return value;
 }
 return {lookup,stats};
};
