'use strict';
// The model reuses its frame records. Remember independent scalar values so an
// in-place transform update cannot also change the comparison baseline.
exports.create=function(){
 const previous=new Map(),changed=[];
 return function(nodes){
  changed.length=0;
  for(const node of nodes){
   let old=previous.get(node.id);
   const shape=node.shapes?JSON.stringify(node.shapes):'',filter=node.canFilter?JSON.stringify([node.filters,node.filterOrigin,node.filterExtent]):'';
   const m=node.matrix;
   if(old&&old.shape===shape&&old.filter===filter&&old.alpha===node.alpha&&old.tint===node.tint&&m[0]===old.matrix[0]&&m[1]===old.matrix[1]&&m[2]===old.matrix[2]&&m[3]===old.matrix[3]&&m[4]===old.matrix[4]&&m[5]===old.matrix[5])continue;
   if(!old){old={matrix:[0,0,0,0,0,0]};previous.set(node.id,old);}
   old.shape=shape;old.filter=filter;old.alpha=node.alpha;old.tint=node.tint;
   for(let i=0;i<6;i++)old.matrix[i]=m[i];
   changed.push(node);
  }
  return changed;
 };
};
// Static texture/parent metadata is sent once. Ordinary particle ticks carry
// only id, six transform values, opacity and tint. Filter/shape changes retain
// their complete descriptors, including removal of an expired shockwave.
exports.createPacket=function(){
 const select=exports.create(),sent=new Set(),packet={geometry:{width:0,height:0},nodes:[],motion:[]};
 return function(frame){
  const resized=packet.geometry.width!==frame.geometry.width||packet.geometry.height!==frame.geometry.height;
  packet.geometry.width=frame.geometry.width;packet.geometry.height=frame.geometry.height;
  packet.nodes.length=0;packet.motion.length=0;
  for(const node of select(frame.nodes)){
   if(!sent.has(node.id)||node.canFilter||node.shapes){packet.nodes.push(node);sent.add(node.id);}
   else packet.motion.push(node.id,node.matrix[0],node.matrix[1],node.matrix[2],node.matrix[3],node.matrix[4],node.matrix[5],node.alpha,node.tint);
  }
  // Filter surfaces must follow a viewport resize even when the filter's own
  // transform and parameters stay constant (for example the bloom group).
  if(resized)for(const node of frame.nodes)if(node.canFilter&&!packet.nodes.includes(node))packet.nodes.push(node);
  return packet;
 };
};
