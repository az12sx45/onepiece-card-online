'use strict';
// Original phone fit receives native world-art rectangles. No rule/state snapshot
// is loaded here; routes and player visibility come from the live original core.
exports.create=function(api,application,window){
 const map=application.get('map_view'),functions=api.functions,maxPhysical=api.state.panZoom.maxScale;
 let initialized=false,disposed=false,timer=null,pendingReason=null,deadline=0,overviewMin=null,regionalMin=api.state.panZoom.minScale,lastWait='';
 const pending=Symbol('pending geometry'),read=()=>JSON.parse(map.call('camera_view_json'));
 function eligible(){
  const g=api.state.gameState,p=functions.currentPlayer();
  return g?.phase==='main'&&p&&!functions.isCpuPlayer(p)&&functions.canOpenShipActionsFor(p)&&application.call('can_show_commands')&&!api.presentation.mapPresentationLocked()
   &&!g.pendingMove&&!g.movementAnimating&&!g.diceRolling&&!g.routePrompt&&!g.tradePrompt&&!g.coopBattlePrompt&&!g.activeTrade&&!g.islandDecision&&!g.resolutionLock&&!api.state.battleState;
 }
 function apply(reason){
  if(!eligible())return false;
  const view=read(),model=api.presentation.mapProjection(),physical=view.factor;
  const hud=application.get('game_tools').get('hud');if(!hud.call('is_visible_in_tree')){lastWait='HUD hidden';throw pending;}
  const camera={scale:reason==='initial'?Math.max(.88,api.state.panZoom.scale):Math.max(.88,view.scale),minScale:regionalMin,maxScale:maxPhysical,x:view.x,y:view.y};
  const marks={},rect=(x,y,w,h)=>({x,y,left:x,top:y,width:w,height:h,right:x+w,bottom:y+h});
  const worldRect=a=>rect(camera.x+a[0]*camera.scale,camera.y+a[1]*camera.scale,a[2]*camera.scale,a[3]*camera.scale);
  const getGeometry=key=>{const geometry=JSON.parse(map.call('camera_geometry_json',key));if(!geometry){lastWait='geometry '+key;throw pending;}return geometry;};
  const nodes=(kind)=>model[kind==='island'?'islands':'tiles'].map(n=>({
   style:{left:String(n.x),top:String(n.y)},
   getBoundingClientRect:()=>worldRect(getGeometry(kind==='island'?'island:'+n.id:'tile:'+n.id).button),
   querySelectorAll:()=>{const g=getGeometry(kind==='island'?'island:'+n.id:'tile:'+n.id);return g.hasArt?[{getBoundingClientRect:()=>worldRect(g.art)}]:[];}
  }));
  const viewport={getBoundingClientRect:()=>rect(0,0,view.width,view.height),dispatchEvent(event){
   // Original wheel listener: disable auto-center and zoomAt the cursor by .9.
   const scale=Math.max(camera.minScale,Math.min(camera.maxScale,camera.scale*.9));
   const bx=(event.clientX-camera.x)/camera.scale,by=(event.clientY-camera.y)/camera.scale;
   camera.scale=scale;camera.x=event.clientX-bx*scale;camera.y=event.clientY-by*scale;
   api.state.autoCenterEnabled=false;
  }};
  const board={offsetWidth:model.width,getBoundingClientRect:()=>worldRect([0,0,model.width,model.height]),querySelectorAll:s=>nodes(s==='.island-node'?'island':'tile')};
  const nativeHudRect=node=>{const r=node.get_global_rect();return rect(r.position.x*physical,r.position.y*physical,r.size.x*physical,r.size.y*physical);};
  const document={getElementById:id=>id==='boardViewport'?viewport:id==='boardGameMap'?board:null,querySelectorAll:()=>[hud.get('frame'),hud.get('toggle')].map(n=>({getBoundingClientRect:()=>nativeHudRect(n)}))};
  const fit=require('./original-phone-map-camera').create({document,visible:()=>true,mark:(k,v)=>{marks[k]=v;},WheelEvent:class{constructor(type,options){Object.assign(this,options);}}});
  // The game stores sea travel as "route". The historical phone-fit helper
  // calls that presentation state "sea"; adapt only its readonly player view.
  const player=functions.currentPlayer(),cameraPlayer=player?.location?.kind==='route'
   ? {...player,location:{...player.location,kind:'sea'}}:player;
  if(!fit({api:functions,state:{panZoom:camera},game:api.state.gameState,player:cameraPlayer})){lastWait='fit declined '+JSON.stringify({view,location:player?.location,hud:nativeHudRect(hud.get('frame'))});return false;}
  regionalMin=camera.minScale;
  const target={x:camera.x/physical,y:camera.y/physical,scale:camera.scale/physical,immediate:true};
  Object.assign(api.state.panZoom,target,{minScale:camera.minScale/physical,maxScale:maxPhysical/physical});
  map.call('set_camera_limits',camera.minScale/physical,maxPhysical/physical);
  map.call('apply_source_camera_json',JSON.stringify(target));map.set_meta('source_region',JSON.stringify(marks));
  initialized=true;return true;
 }
 function attempt(){
  timer=null;if(disposed||!pendingReason)return;
  try{const done=apply(pendingReason);if(done||!eligible()){pendingReason=null;return;}}
  catch(error){if(error!==pending)throw error;}
  if(window.performance.now()>deadline){pendingReason=null;throw Error('Original regional map geometry did not become ready: '+lastWait);}
  timer=window.setTimeout(attempt,16);
 }
 function request(reason){if(disposed||(reason==='initial'&&(initialized||pendingReason)))return;if(timer!==null)window.clearTimeout(timer);pendingReason=reason;deadline=window.performance.now()+15000;timer=window.setTimeout(attempt,0);}
 return {requestInitial:()=>request('initial'),beforeTool(key){if(key==='viewWholeMapBtn'&&overviewMin===null)overviewMin=regionalMin;},afterTool(key){
  if(key==='focusPlayerBtn'){if(overviewMin!==null)regionalMin=overviewMin;overviewMin=null;request('focus');}
  if(key==='viewWholeMapBtn'){const v=read();map.call('set_camera_limits',Math.min(regionalMin/v.factor,api.state.panZoom.scale),maxPhysical/v.factor);}
 },dispose(){disposed=true;if(timer!==null)window.clearTimeout(timer);timer=null;pendingReason=null;}};
};
