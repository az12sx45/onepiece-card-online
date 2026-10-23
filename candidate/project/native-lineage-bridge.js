'use strict';
const {Callable,Time}=require('godot'),Controls=require('./native-lineage-controls'),project=require('./native-lineage-model').project;
class NativeLineageBridge{
 constructor(battleStage){
  this.stage=battleStage;this.view=battleStage.get('lineage_view');if(!this.view)throw Error('Native extraction presentation missing');this.pendingView=null;this.preparedScope='';this.queued=false;this.disposed=false;this.listeners=new Map();this.lastPacket='';
  const parent={addEventListener:(name,fn)=>{if(!['resize','keydown'].includes(name))throw Error('Unsupported extraction window event '+name);if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);},removeEventListener:(name,fn)=>this.listeners.get(name)?.delete(fn)};
  this.scope=require('./native-runtime-scope').create(parent,'',()=>{throw Error('Extraction cannot navigate');},'/board_game.html',battleStage);
  this.tree=Controls.create({changed:()=>this.schedule(),bounds:node=>this.bounds(node)});
  this.tree.addRoot('div',{id:'battleViewport'});const stage=this.tree.addRoot('div',{id:'battleStage'}),enemy=this.tree.addRoot('div',{id:'enemyCard'}),wrap=this.tree.addRoot('div',{id:'enemyPortraitWrap'});stage.appendChild(enemy);enemy.appendChild(wrap);
  const window=this.scope.window;window.document=this.tree.document;window.visualViewport=null;Object.defineProperty(window,'innerWidth',{get:()=>this.view.get('size').x});Object.defineProperty(window,'innerHeight',{get:()=>this.view.get('size').y});window.performance={now:()=>Time.get_ticks_msec()};
  window.getComputedStyle=node=>{const fallback=node.style.transform||'none';if(fallback==='none')return{transform:fallback};const angle=new Controls.RotationMatrix(fallback);const degrees=Math.atan2(angle.b,angle.a)*180/Math.PI;return{transform:'rotate('+this.view.call('rendered_rotation',node.uid,degrees)+'deg)'};};
  this.api=require('./original-lineage').create({window,performance:window.performance,DOMMatrixReadOnly:Controls.RotationMatrix});
  this.input=Callable.create(this.view,(uid,type,x,y,pointer)=>{if(this.disposed)return;this.tree.dispatch(String(uid),String(type),{clientX:x,clientY:y,pointerId:pointer,deltaY:y});this.flush();});this.view.connect('source_input',this.input);
  this.warmed=Callable.create(this.view,scope=>{if(this.disposed||scope!==this.pendingView?.battle?.lineageExtraction?.scopeKey)return;this.preparedScope=scope;this.refresh(this.pendingView);});this.view.connect('source_assets_ready',this.warmed);
  this.resized=Callable.create(this.view,()=>{for(const fn of this.listeners.get('resize')||[])fn({});this.flush();});this.view.connect('resized',this.resized);
 }
 bounds(node){
  const name=node.id||(['lineage-launcher-showcase','lineage-launcher-bay','lineage-cylinder-rotator'].find(c=>node.classList?.contains(c))||'');
  if(!['battleStage','lineageExtractionRoot','enemyCard','enemyPortraitWrap','lineage-launcher-showcase','lineage-launcher-bay','lineage-cylinder-rotator'].includes(name))throw Error('Unbound extraction geometry '+name);
  return JSON.parse(this.view.call('source_bounds_json',name));
 }
 schedule(){if(this.queued||this.disposed)return;this.queued=true;Promise.resolve().then(()=>{this.queued=false;if(!this.disposed&&this.api)this.flush();});}
 flush(){
  if(this.disposed||!this.api||!this.pendingView?.battle?.lineageExtraction)return;
  const packet=project(this.api),json=JSON.stringify(packet);if(json===this.lastPacket)return;this.lastPacket=json;this.view.call('apply_source_json',json);
 }
 refresh(view){
  this.pendingView=view;
  const extraction=view?.battle?.lineageExtraction;
  if(!extraction){this.api.refresh(view);this.view.call('reset_surface');this.preparedScope='';this.lastPacket='';return;}
  if(this.preparedScope!==extraction.scopeKey){this.view.call('prepare_source_json',JSON.stringify({scope:extraction.scopeKey,enemy:extraction.enemy,participants:extraction.participants}));return;}
  const send=(type,payload)=>{this.stage.emit_signal('command_json',JSON.stringify({type,payload}));return true;};
  this.api.refresh(view,{start:(extractorId,playerId)=>send('lineage-extraction-start',{extractorId,playerId}),complete:(grades,playerId)=>send('lineage-extraction-complete',{grades,playerId}),decline:playerId=>send('lineage-extraction-decline',{playerId}),dismiss:()=>this.view.call('close_surface')});this.flush();
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.api.functions.clearActivity();this.scope.dispose();this.view.disconnect('source_input',this.input);this.view.disconnect('source_assets_ready',this.warmed);this.view.disconnect('resized',this.resized);this.tree.dispose();this.listeners.clear();this.view.call('reset_surface');}
}
exports.NativeLineageBridge=NativeLineageBridge;
