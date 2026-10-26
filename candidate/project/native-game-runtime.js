'use strict';
const {Callable,FileAccess,Time}=require('godot');
const original=require('./original-core'),refs=require('./native-scene-refs');
const {NativeMapScene}=require('./native-map-scene'),{NativeBattleScene}=require('./native-battle-scene'),{NativeModalBridge}=require('./native-modal-bridge');
// Product composition: state is initialized by the original startup and server.
// No QA snapshot, default player or fixture room is accepted here.
exports.create=function({context,application,search,fetch,navigate,controlsChanged=()=>{}}){
 if(!context.active()||typeof fetch!=='function'||typeof navigate!=='function')throw Error('Verified native game entry required');
 const query=new context.host.URLSearchParams(search),room=query.get('room');
 if(!room||!['1'].includes(query.get('online')||query.get('lan')))throw Error('Original online game route required');
 context.shared.getLobby(room);
 const scope=require('./native-runtime-scope').create(context.host.window,search,navigate,'/board_game.html',application),window=scope.window;
 // Enable the source's two phone-only Aokiji authority reconciliation guards.
 // This flag does not install CSS or replace any story/rule implementation.
 window.__TABLETOP_PHONE_DIALOG__=true;
 const musicTransport=require('./native-html-audio').create(application.get('music_audio'));
 window.Audio=musicTransport.Audio;window.localStorage=context.host.localStorage;window.performance={now:()=>Time.get_ticks_msec()};
 window.getComputedStyle=node=>{if(node?.nativeComputedStyle)return node.nativeComputedStyle;throw Error('Native style query requires a mounted control');};
 const music=require('./original-bgm').install(window);
 const seaSplash=require('./native-sea-splash').create(application.get('sea_splash'),window);
 const sound=require('./native-board-audio').create({node:application.get('ui_sound'),window});
 let core,controller,draftAuthority,disposed=false,queued=false,mapQueued=false,lastControls='',started=false,starting=false,battleMusicHold=null,katakuriFocus=null;
 const listeners=[],realSocket=context.host.entrySession.socket,connections=[];
 const snapshotWire=require('./native-json-snapshot-wire').create();
 const joinRecovery=require('./native-join-recovery').create({socket:realSocket,setTimer:window.setTimeout,clearTimer:window.clearTimeout,now:()=>Time.get_ticks_msec(),onExhausted:result=>{if(!disposed)core.functions.showBoardCampaignInitialLoadFailure(result.error);}});
 const socket=new Proxy(realSocket,{get(target,key){
  if(key==='connected')return !disposed&&target.connected;
  if(key==='on')return (event,fn)=>{const wrapped=(...args)=>{if(!disposed)scope.measure('socket:'+event,()=>fn(...args));};listeners.push({event,fn,wrapped});target.on(event,wrapped);return socket;};
  if(key==='off')return (event,fn)=>{for(let i=listeners.length-1;i>=0;i--){const item=listeners[i];if(item.event===event&&item.fn===fn){target.off(event,item.wrapped);listeners.splice(i,1);}}return socket;};
  if(key==='emit')return (event,...args)=>{if(disposed)return false;return scope.measure('socket-send:'+event,()=>{const guarded=args.map(arg=>typeof arg==='function'?(...reply)=>{if(!disposed)arg(...reply);}:arg);if(event==='BOARD_JOIN_GAME'&&typeof guarded[1]==='function')return joinRecovery.emit(guarded[0],guarded[1]);return snapshotWire.emit(target,event,...guarded);});};
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
 window.io=()=>socket;
 function publishControls(){if(disposed||queued)return;queued=true;window.setTimeout(()=>{queued=false;const model={...controls.project(),available:started&&map.canShowCommands()&&!core.presentation.mapPresentationLocked()},json=JSON.stringify(model);if(json!==lastControls){lastControls=json;application.get('game_tools').call('apply_json',json);controlsChanged(model);}},0);}
 // Like the source phone presenter, reconcile after the synchronous source
 // action finishes. closeModal may immediately open another full-screen page.
 function scheduleMapControls(){if(disposed||mapQueued)return;mapQueued=true;window.requestAnimationFrame(()=>{mapQueued=false;if(!started||disposed)return;controller.sync();publishControls();});}
 const controls=require('./native-game-controls').create(publishControls),map=new NativeMapScene(application),modal=new NativeModalBridge(application,{navigate});
 const battleNode=application.get_node('Battle');
 battleNode.get('timeline').get('audio').set('muted',false);
 const battle=new NativeBattleScene(battleNode,{closeModal:()=>modal.clear(),log(){},map(){map.refresh(core.presentation.mapProjection());scheduleMapControls();return true;},ships(){const complete=map.refreshShips(core.presentation.shipProjection());scheduleMapControls();return complete;}});
 const presentationStorage=require('./native-presentation-storage').create(context.host.localStorage);
 window.localStorage=presentationStorage.storage;
 const host={...context.host,localStorage:presentationStorage.storage,window,fetch,measure:scope.measure,captureJsonSnapshot:snapshotWire.capture,initData:{profile:context.profile,lobby:context.shared.getLobby(room)}};
 host.refs=refs.create({extraControls:controls.nodes,clearModal:()=>modal.clear(),controlsChanged:publishControls,renderModalMarkup:(name,html)=>{modal.render(name,html);draftAuthority?.capture();},queryModalControls:selector=>modal.query(selector)});
 const remoteControl=require('./native-remote-ui-control');
 host.refs.turnTransitionBanner=remoteControl.create(battleNode.get('timeline').get('turn_banner'));
 const overlayRegistry=new Map([['battlePageOverlay',{classList:{contains:key=>key==='closing'?battle.closing:key==='open'?battleNode.call('is_visible'):key==='ready'?battle.ready():false}}],['battlePageFrame',{dataset:{loaded:true}}]]);
 map.overlayBlocked=()=>[...overlayRegistry.entries()].some(([id,overlay])=>id.endsWith('PageOverlay')&&(overlay.opening||overlay.classList?.contains?.('open')||overlay.classList?.contains?.('closing')));
 const itemReveal=require('./native-item-reveal-bridge').bind(host.refs,overlayRegistry,application.get('item_reveal_hud'));
 const evolution=require('./native-evolution-bridge').bind(host.refs,application.get('evolution_hud'));
 host.document=refs.createOverlayLookup(overlayRegistry,modal.controls,selector=>modal.query(selector));
 const seaTrain=require('./native-sea-train-bridge').bind(host.refs,host.document,application.get('sea_train_layer'));host.document=seaTrain.document;
 const finalRoute=require('./native-final-route-bridge').bind(host,application,()=>core);
 const kuma=require('./native-kuma-bridge').bind(host,application,()=>core);
 const york=require('./native-york-platform').bind(host,application,()=>core,overlayRegistry);const egghead=require('./native-egghead-bridge').bind(host,application,overlayRegistry);
 const nika=require('./native-nika-presentation').create(application,host.document);
 host.bindInputs=api=>api.bindNativeInputs();
 host.bindPresentation=api=>{
  presentationStorage.bind(api.presentation.battleSnapshotKey);
  api.presentation.attachBoardActionHud(remoteControl.create(application.get('board_notice')));
  map.camera=require('./native-map-camera').create(api,application,window);
  controller=require('./native-map-platform').create(api,map);
  const bindings=require('./native-battle-platform').bind(api,battle,host.window),render=bindings.renderAll;
  const presentation={...bindings,...controller.bindings,...modal.bindings(),...nika.bind(api),playSeaEncounterSplash:name=>seaSplash.play(name),renderAll(){render();api.functions.renderHeader();api.functions.renderCurrentPlayer();publishControls();}};
  return Object.fromEntries(Object.entries(presentation).map(([name,fn])=>[name,typeof fn==='function'?function(...args){return scope.measure('presentation:'+name,()=>fn.apply(this,args));}:fn]));
 };
 host.shared={...context.shared,showToast:text=>application.get("shared_toasts").call("show_message",String(text||""))};
 core=original.create(host);modal.nativeRefs=host.refs;modal.tavernPresentation=new (require('./native-tavern-reveal').NativeTavernReveal)(modal,window);
 const reconcileTurnControls=require('./native-turn-control-sync').create(core,host.refs);
 const reconcileInteractions=require('./native-interaction-sync').create(core,host.refs);
 const reconcileBattleSurface=require('./native-battle-lifecycle').create(core,battle);
 draftAuthority=require('./native-draft-authority').create(core,modal);
 let lastCpuDiagnostic='',nextCpuDiagnostic=0;
 const waterNode=application.get('water_seven_page'),water=require('./native-water-seven').create({core,parentHost:host,registry:overlayRegistry,catalog:JSON.parse(FileAccess.get_file_as_string('res://water-seven-controls.json')),present:model=>waterNode.call('apply_json',JSON.stringify(model)),hide:()=>waterNode.call('close_surface'),geometry:node=>JSON.parse(waterNode.call('geometry_json',node.id)),scrollIntoView(){/* Reading offsets belong to the persistent native page. */}});
 const marineford=require('./native-marineford-platform').create({core,parentHost:host,registry:overlayRegistry,application});
 const impel=require('./native-impel-down-platform').create({core,parentHost:host,registry:overlayRegistry,application});
 const spar=require('./native-spar-platform').create({core,parentHost:host,registry:overlayRegistry,application});
 function connect(node,name,fn){const callback=Callable.create(node,fn);node.connect(name,callback);connections.push({node,name,callback});}
 connect(application.get_tree(),'process_frame',()=>{if(disposed||!started)return;reconcileBattleSurface();reconcileInteractions();if(reconcileTurnControls()){draftAuthority.reconcile();scheduleMapControls();}});
 // Keep internal diagnostics independent of the JS timers being diagnosed.
 // GDScript print also remains observable in Android template_release.
 connect(application.get_tree(),'process_frame',()=>{const now=Time.get_ticks_msec();if(disposed||!started||now<nextCpuDiagnostic)return;nextCpuDiagnostic=now+2000;const flags=JSON.stringify({cpu:core.functions.isCpuPlayer(core.functions.currentPlayer()),...core.presentation.cpuAutomationStatus(),battle:!!core.state.battleState,battleAnimating:!!core.state.battleState?.animating,battleResult:core.state.battleState?.result||"",battleWindow:core.functions.battleWindowIsActive(),battleVisible:battle.isOpen(),battleClosing:battle.closing,battlePending:battle.hasPendingBattlePresentation(),remoteBattleViews:core.boardLan.pendingRemoteBattleViews.length,restoreAttempts:core.boardLan.initialStateRequestAttempts,joined:core.boardLan.joinedOnce,version:core.boardLan.version,pendingState:!!core.boardLan.pendingState,inFlightState:!!core.boardLan.inFlightState,lastError:core.boardLan.lastError});if(flags!==lastCpuDiagnostic){lastCpuDiagnostic=flags;application.call('report_cpu_diagnostic',flags);}});
 connect(application,'audio_unlock_requested',()=>{music.unlock();sound.api.unlock();});
 connect(application,'ui_control_activated',json=>sound.control(JSON.parse(json)));
 connect(battleNode,'cinematic_music_hold',held=>{if(held){battleMusicHold?.restore();battleMusicHold=require('./original-battle-bgm').hold(window);}else{battleMusicHold?.restore();battleMusicHold=null;}});
 connect(battleNode,'katakuri_music_focus',held=>{katakuriFocus?.release();katakuriFocus=held?music.acquireAudioFocus('katakuri-future-sight',{volumeRatio:.08,fadeOutMs:280,fadeInMs:720}):null;});
 connect(application,'map_controls_visibility_changed',()=>{if(started&&!disposed)scheduleMapControls();});
 connect(application.get('game_tools'),'command_requested',(key,value)=>{key=String(key);map.camera.beforeTool(key);const result=controls.activate(key,String(value));if(result)map.camera.afterTool(key);});
 connect(waterNode,'command_requested',key=>water.activate(String(key)));
 connect(application.get('york_page'),'command_requested',key=>{york.activate(String(key)).catch(e=>console.error('York command: '+e.stack));});
 connect(application.get('york_page'),'drag_requested',(card,target)=>{york.drag(Number(card),Number(target)).catch(e=>console.error('York drag: '+e.stack));});
 connect(application.get('egghead_effect'),'skip_requested',()=>{egghead.skip().catch(e=>console.error('Egghead skip: '+e.stack));});
 connect(waterNode,'resized',()=>water.resize());
 connect(application,'helm_command_json',json=>{const value=JSON.parse(json);controller.command(value.action,value.playerId);});
 connect(application,'map_command_json',json=>{const value=JSON.parse(json);controller.mapCommand(value.type,value.payload);});
 const dispatchBattle=require('./native-battle-command').create(core);
 // Signals have no return contract. Do not ask GodotJS to convert the JS
 // command envelope returned by the dispatcher into an engine Variant.
 connect(battleNode,'command_json',json=>{const intent=JSON.parse(json);scope.measure('battle-command:'+intent.type,()=>dispatchBattle(intent));});
 connect(battleNode,'targets_requested',id=>battleNode.call('apply_targets_json',JSON.stringify(require('./native-battle-menus').itemTargets(core.functions.getBattleView(),String(id)))));
 function startupAssets(){const result=new Set(['mobile/art-ui/mobile-panel-v013.png','mobile/art-ui/mobile-row-v013.png']);const visit=value=>{if(typeof value==='string'&&/^images\/.+\.(?:webp|png|jpe?g)(?:\?|$)/i.test(value))result.add(value.split('?')[0]);else if(value&&typeof value==='object')Object.values(value).forEach(visit);};visit(core.presentation.startupAssets());return [...result];}
 return {core,controls,modal,battle,map,scope,water,marineford,impel,snapshotWire,joinRecovery,async start(){
  if(starting||started||disposed)throw Error('Native game entry already started or disposed');starting=true;
  const assets=JSON.stringify(startupAssets()),deadline=Date.now()+30000;
  while(!application.call('warm_assets_json',assets)){if(disposed)throw Error('Native entry cancelled');if(Date.now()>deadline)throw Error('Original opening assets unavailable');await new Promise(resolve=>setTimeout(resolve,16));}
  if(disposed)throw Error('Native entry cancelled');started=true;core.startNative();publishControls();
 },async dispose(){
  if(disposed)return;disposed=true;joinRecovery.dispose();for(const item of listeners)realSocket.off(item.event,item.wrapped);listeners.length=0;
  // This core is being unmounted. Invalidate its transient battle identity
  // before releasing UI waits so the original stale-battle guards terminate
  // continuations. Retain gameState, paid rewards and persisted saves unchanged.
  core.state.battleState=null;
  battle.spectatorPlayback?.dispose();
  seaSplash.dispose();nika.dispose();
  if(battle.judicialReward)battle.judicialReward.close();
  // The source story finishes only after its authoritative command changes
  // the snapshot. Unmounting must release the presentation before waitIdle.
  battle.zephyr.close();
  sound.dispose();battleMusicHold?.restore();battleMusicHold=null;katakuriFocus?.release();katakuriFocus=null;music.stop({fadeMs:0});musicTransport.dispose();scope.dispose();for(const {node,name,callback}of connections)node.disconnect(name,callback);
  connections.length=0;
  egghead.dispose();york.dispose();kuma.dispose();finalRoute.dispose();water.dispose();marineford.dispose();impel.dispose();spar.dispose();evolution.dispose();itemReveal.dispose();seaTrain.dispose();application.get("shared_toasts").call("clear");application.get('game_tools').call('close_surface');modal.dispose();await battle.waitIdle();battle.dispose();map.dispose();
 }};
};


