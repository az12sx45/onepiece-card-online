'use strict';
// Minimal retained scene model for the exact original VFX calculations. Every
// object maps to a persistent native draw item. Filter descriptors preserve the
// source parameters; numerical and GPU comparisons are checked separately.
let sequence=0;
const point=(x=0,y=x)=>({x,y,set(a,b=a){this.x=a;this.y=b;}});
class Container{
 constructor(){this.id=++sequence;this.children=[];this.parent=null;this.position=point();this.scale=point(1);this.rotation=0;this.alpha=1;this.tint=0xffffff;this.filters=[];this.blendMode='normal';}
 get x(){return this.position.x;}set x(value){this.position.x=value;}get y(){return this.position.y;}set y(value){this.position.y=value;}
 addChild(...nodes){for(const node of nodes){if(node.parent)node.parent.children=node.parent.children.filter(n=>n!==node);node.parent=this;this.children.push(node);}return nodes[0];}
 getBounds(){const boxes=[];const visit=(node,parent)=>{const m=multiply(parent,matrix(node));for(const [x,y] of localPoints(node))boxes.push([m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);node.children.forEach(child=>visit(child,m));};let parent=[1,0,0,1,0,0],lineage=[];for(let n=this.parent;n;n=n.parent)lineage.unshift(n);for(const n of lineage)parent=multiply(parent,matrix(n));visit(this,parent);if(!boxes.length)return {x:0,y:0,width:0,height:0};const xs=boxes.map(p=>p[0]),ys=boxes.map(p=>p[1]);return {x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};}
}
class Sprite extends Container{
 constructor(texture){super();this.texture=texture;this.anchor=point();}
 get width(){return Math.abs(this.scale.x)*this.texture.width;}set width(value){this.scale.x=value/this.texture.width;}
 get height(){return Math.abs(this.scale.y)*this.texture.height;}set height(value){this.scale.y=value/this.texture.height;}
}
class Graphics extends Container{
 constructor(){super();this.shapes=[];this.pending=null;}
 clear(){this.shapes=[];this.pending=null;return this;}
 poly(points){this.pending={type:'poly',points:[...points]};return this;}
 rect(x,y,width,height){this.pending={type:'rect',x,y,width,height};return this;}
 ellipse(x,y,width,height){this.pending={type:'ellipse',x,y,width,height};return this;}
 fill(style){this.shapes.push({...this.pending,fill:{alpha:1,...style}});this.pending=null;return this;}
 stroke(style){this.shapes.push({...this.pending,stroke:{alpha:1,...style}});this.pending=null;return this;}
}
class Particle extends Sprite{
 constructor(options){super(options.texture);this.anchor.set(options.anchorX,options.anchorY);this.alpha=options.alpha;}
 get scaleX(){return this.scale.x;}set scaleX(value){this.scale.x=value;}
 get scaleY(){return this.scale.y;}set scaleY(value){this.scale.y=value;}
}
class ParticleContainer extends Container{constructor(options){super();this.options=options;}addParticle(node){return this.addChild(node);}}
class AdvancedBloomFilter{constructor(options){Object.assign(this,options);this.type='bloom';}}
class RGBSplitFilter{constructor(options){Object.assign(this,options);this.type='rgb-split';}}
class ShockwaveFilter{constructor(options){Object.assign(this,options);this.type='shockwave';}}
function matrix(node){const c=Math.cos(node.rotation),s=Math.sin(node.rotation);return [c*node.scale.x,s*node.scale.x,-s*node.scale.y,c*node.scale.y,node.x,node.y];}
function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
function localPoints(node){if(node.texture){const {width:w,height:h}=node.texture;return [[-w*node.anchor.x,-h*node.anchor.y],[w*(1-node.anchor.x),-h*node.anchor.y],[w*(1-node.anchor.x),h*(1-node.anchor.y)],[-w*node.anchor.x,h*(1-node.anchor.y)]];}const points=[];for(const shape of node.shapes||[]){if(shape.type==='poly')for(let i=0;i<shape.points.length;i+=2)points.push([shape.points[i],shape.points[i+1]]);else if(shape.type==='rect')points.push([shape.x,shape.y],[shape.x+shape.width,shape.y+shape.height]);else points.push([shape.x-shape.width,shape.y-shape.height],[shape.x+shape.width,shape.y+shape.height]);}if(!points.length)return [];const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return [[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)],[Math.min(...xs),Math.max(...ys)]];}
// A frame is a borrowed view, consumed synchronously before the next tick.
// Keep records and their transform arrays alive for the scene's lifetime instead
// of allocating one record and several arrays for every particle, every frame.
const snapshots=new WeakMap();
function snapshot(root,filterIds=[]){
 let cache=snapshots.get(root);if(!cache){cache={nodes:[],records:new Map()};snapshots.set(root,cache);}
 let count=0;
 const visit=node=>{
  if(node===root){for(const child of node.children)visit(child);return;}
  let data=cache.records.get(node.id);
  if(!data){data={id:node.id,matrix:[0,0,0,0,0,0]};cache.records.set(node.id,data);}
  const m=data.matrix,c=Math.cos(node.rotation),s=Math.sin(node.rotation);
  m[0]=c*node.scale.x;m[1]=s*node.scale.x;m[2]=-s*node.scale.y;m[3]=c*node.scale.y;m[4]=node.x;m[5]=node.y;
  data.parent=node.parent===root?0:node.parent.id;data.alpha=node.alpha;data.tint=node.tint;data.blend=node.blendMode;data.filters=node.filters;
  if(filterIds.includes(node.id)){
   data.canFilter=true;
   if(node.filters.some(filter=>filter.type==='shockwave')){
    const bounds=node.getBounds();data.filterOrigin||=[0,0];data.filterExtent||=[0,0];
    data.filterOrigin[0]=bounds.x;data.filterOrigin[1]=bounds.y;data.filterExtent[0]=bounds.width;data.filterExtent[1]=bounds.height;
   }else{delete data.filterOrigin;delete data.filterExtent;}
  }
  if(node.texture){data.texture=node.texture.key;data.width=node.texture.width;data.height=node.texture.height;data.anchor||=[0,0];data.anchor[0]=node.anchor.x;data.anchor[1]=node.anchor.y;}
  if(node.shapes)data.shapes=node.shapes;
  cache.nodes[count++]=data;for(const child of node.children)visit(child);
 };
 visit(root);cache.nodes.length=count;return cache.nodes;
}
Object.assign(exports,{Container,Graphics,Particle,ParticleContainer,Sprite,AdvancedBloomFilter,RGBSplitFilter,ShockwaveFilter,snapshot});
